/**
 * EchoMusic 恶搞整活插件 v1.2.0
 *
 * 功能：
 *   1. 随机延时触发 — 在设定时间范围内随机选取延时，到点自动执行恶搞操作
 *   2. 两种恶搞模式：
 *      - 假死（无响应）：阻塞 UI 线程使窗口完全无响应
 *      - 蓝屏模拟：弹出占据整个屏幕的页面，无法关闭，覆盖所有内容
 *   3. 主题感知 — UI 自动跟随 EchoMusic 暗色/亮色主题变化
 *
 * ⚠️ 警告：假死模式会导致窗口无法操作，只能通过任务管理器结束进程！
 *
 * 作者: ZHCOOL520
 * GitHub: https://github.com/ZHCOOL520
 */

// ─── 存储键名 ────────────────────────────────────
const STORAGE_KEY = "prank-system-settings";

// ─── 默认设置 ────────────────────────────────────
const DEFAULT_SETTINGS = {
  enabled: true,              // 是否启用插件
  prankMode: "fullscreen",    // 恶搞模式："freeze" | "fullscreen"
  minTime: 5,                 // 最早触发时间（分钟），最小值 5
  maxTime: 30,                // 最晚触发时间（分钟），最大值 ≤ 1440
};

// ─── 运行时状态 ──────────────────────────────────
let state = null;             // Vue reactive 状态对象
let settingsDispose = null;   // 设置面板注销函数
let pageDispose = null;       // 独立页面注销函数
let styleDispose = null;      // CSS 注入注销函数
let saveTimer = 0;            // 防抖定时器
let prankTimer = null;        // 恶搞延时 setTimeout 句柄
let countdownTimer = null;    // 倒计时刷新 interval 句柄
let countdownSeconds = 0;     // 倒计时剩余秒数
let fullscreenOverlay = null; // 全屏覆盖层 DOM
let fullscreenInterval = null; // 全屏动画 interval

// ─── 工具：数值钳制 ──────────────────────────────
const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, Number(value) || min));

// ─── 设置归一化 ──────────────────────────────────
const normalizeSettings = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    enabled: source.enabled !== false,
    prankMode: ["freeze", "fullscreen"].includes(source.prankMode)
      ? source.prankMode
      : "fullscreen",
    minTime: clamp(source.minTime ?? DEFAULT_SETTINGS.minTime, 5, 1440),
    maxTime: clamp(source.maxTime ?? DEFAULT_SETTINGS.maxTime, 5, 1440),
  };
};

// ─── 防抖保存 ────────────────────────────────────
const scheduleSave = (ctx) => {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    if (!state) return;
    void ctx.storage.set(STORAGE_KEY, normalizeSettings(state.settings));
  }, 240);
};

// ─── 更新设置 ────────────────────────────────────
const updateSettings = (ctx, patch) => {
  if (!state) return;
  const prev = state.settings;
  state.settings = normalizeSettings({ ...prev, ...patch });
  if (state.settings.maxTime < state.settings.minTime) {
    state.settings.maxTime = state.settings.minTime;
  }
  scheduleSave(ctx);
};

// ─── 格式化倒计时 ────────────────────────────────
const formatCountdown = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0")
  );
};

// ─── 获取恶搞模式显示名称 ────────────────────────
const getPrankModeLabel = (mode) => {
  switch (mode) {
    case "freeze": return "💀 假死（无响应）";
    case "fullscreen": return "🟦 蓝屏模拟";
    default: return mode;
  }
};

// ══════════════════════════════════════════════════
//  蓝屏模拟覆盖层
// ══════════════════════════════════════════════════

// ─── 全屏覆盖层中显示的恶搞内容池 ──────────────────
const FULLSCREEN_PRANKS = [
  {
    emote: "💀",
    title: "你被骗了！",
    subtitle: "这个页面没有关闭按钮，好好享受吧 🤡",
    bgGradient: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  },
  {
    emote: "😈",
    title: "Oops! Something went wrong...",
    subtitle: "Just kidding. There's nothing wrong. But you can't close this either. 🎭",
    bgGradient: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
  },
  {
    emote: "🎭",
    title: "系统已被锁定",
    subtitle: "别担心，这不是真的。但你也关不掉。🌚",
    bgGradient: "linear-gradient(135deg, #2d132c, #801336, #c72c41)",
  },
  {
    emote: "🃏",
    title: "GET PRANKED!",
    subtitle: "Your music player has been taken over by ZHCOOL520. 😎",
    bgGradient: "linear-gradient(135deg, #000428, #004e92)",
  },
  {
    emote: "👻",
    title: "你的电脑被我控制了！",
    subtitle: "哈哈开玩笑的，只是这个窗口你关不掉而已。🎃",
    bgGradient: "linear-gradient(135deg, #1b1b2f, #3a1c47, #73346b)",
  },
];

/**
 * 显示蓝屏模拟覆盖层（强制全屏）
 *
 * 特点：
 *   - z-index: 2147483647（最大值），覆盖一切
 *   - 无关闭按钮，无键盘快捷键退出
 *   - 阻止所有鼠标/键盘事件冒泡
 *   - 带闪烁动画增加恶搞效果
 *   - 尝试调用浏览器全屏 API 进入真·全屏
 *   - 每 3 秒添加一个浮动 emoji 粒子
 */
const showFullscreenOverlay = () => {
  if (fullscreenOverlay) return; // 已存在

  const prank = FULLSCREEN_PRANKS[Math.floor(Math.random() * FULLSCREEN_PRANKS.length)];

  // 创建覆盖层
  fullscreenOverlay = document.createElement("div");
  fullscreenOverlay.id = "prank-fullscreen-overlay";
  fullscreenOverlay.innerHTML = `
    <div class="prank-fs-backdrop" style="background:${prank.bgGradient};">
      <div class="prank-fs-content">
        <div class="prank-fs-emote" id="prank-fs-emote">${prank.emote}</div>
        <h1 class="prank-fs-title">${prank.title}</h1>
        <p class="prank-fs-subtitle">${prank.subtitle}</p>
        <div class="prank-fs-particles" id="prank-fs-particles"></div>
      </div>
    </div>
  `;
  document.body.appendChild(fullscreenOverlay);

  // 阻止所有事件
  const blockEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  fullscreenOverlay.addEventListener("click", blockEvent, true);
  fullscreenOverlay.addEventListener("mousedown", blockEvent, true);
  fullscreenOverlay.addEventListener("mouseup", blockEvent, true);
  fullscreenOverlay.addEventListener("keydown", blockEvent, true);
  fullscreenOverlay.addEventListener("keyup", blockEvent, true);
  fullscreenOverlay.addEventListener("keypress", blockEvent, true);
  fullscreenOverlay.addEventListener("contextmenu", blockEvent, true);
  fullscreenOverlay.addEventListener("wheel", blockEvent, true);

  // 尝试浏览器全屏 API
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  } catch (_) {}

  // 动画：表情闪烁 + 随机浮动粒子
  let tick = 0;
  fullscreenInterval = window.setInterval(() => {
    tick++;
    // emote 大小脉动
    const emoteEl = document.getElementById("prank-fs-emote");
    if (emoteEl) {
      const scale = 1 + Math.sin(tick * 0.15) * 0.3;
      emoteEl.style.transform = `scale(${scale})`;
    }
    // 每 3 秒添加浮动粒子
    if (tick % 3 === 0) {
      const particles = document.getElementById("prank-fs-particles");
      if (particles) {
        const p = document.createElement("span");
        p.className = "prank-fs-particle";
        p.textContent = ["🎭", "🤡", "💀", "😈", "👻", "🎃", "🃏", "💩"][Math.floor(Math.random() * 8)];
        p.style.left = Math.random() * 90 + "%";
        p.style.animationDuration = (3 + Math.random() * 6) + "s";
        p.style.fontSize = (16 + Math.random() * 48) + "px";
        particles.appendChild(p);
        // 自动清除
        setTimeout(() => p.remove(), 9000);
      }
    }
  }, 1000);
};

/**
 * 隐藏全屏覆盖层（仅在 deactivate 时调用）
 */
const hideFullscreenOverlay = () => {
  if (fullscreenInterval) {
    window.clearInterval(fullscreenInterval);
    fullscreenInterval = null;
  }
  if (fullscreenOverlay?.parentNode) {
    fullscreenOverlay.parentNode.removeChild(fullscreenOverlay);
    fullscreenOverlay = null;
  }
  // 退出全屏
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch (_) {}
};

// ══════════════════════════════════════════════════
//  假死模式
// ══════════════════════════════════════════════════

/**
 * 执行假死 — 阻塞主线程使窗口完全无响应
 */
const executeFreeze = (ctx) => {
  ctx.toast.warning("💀 窗口即将无响应…");
  setTimeout(() => {
    try {
      const sab = new SharedArrayBuffer(4);
      Atomics.wait(new Int32Array(sab), 0, 0, 999999999);
    } catch (_) {
      // eslint-disable-next-line no-constant-condition
      while (true) { /* 死循环阻塞主线程 */ }
    }
  }, 500);
};

// ══════════════════════════════════════════════════
//  定时器 & 执行调度
// ══════════════════════════════════════════════════

/**
 * 停止所有定时器
 */
const clearAllTimers = () => {
  if (prankTimer) { window.clearTimeout(prankTimer); prankTimer = null; }
  if (countdownTimer) { window.clearInterval(countdownTimer); countdownTimer = null; }
  countdownSeconds = 0;
};

/**
 * 执行恶搞操作
 */
const executePrank = (ctx) => {
  if (!state) return;

  state.countdownActive = false;
  state.countdownDisplay = "--:--:--";
  clearAllTimers();

  const mode = state.settings.prankMode;

  if (mode === "fullscreen") {
    ctx.toast.warning("🟦 蓝屏模拟…");
    showFullscreenOverlay();
  } else if (mode === "freeze") {
    executeFreeze(ctx);
  }
};

/**
 * 启动延时倒计时
 */
const startPrankCountdown = (ctx) => {
  if (!state || !state.settings.enabled) return;

  clearAllTimers();

  const min = state.settings.minTime;
  const max = Math.max(state.settings.maxTime, min);
  const delayMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
  countdownSeconds = delayMinutes * 60;

  state.countdownActive = true;
  state.countdownDisplay = formatCountdown(countdownSeconds);

  ctx.toast.info(
    `🎭 恶搞整活将在 ${delayMinutes} 分钟后触发 (${getPrankModeLabel(state.settings.prankMode)})`
  );

  prankTimer = window.setTimeout(() => { executePrank(ctx); }, countdownSeconds * 1000);

  countdownTimer = window.setInterval(() => {
    countdownSeconds--;
    if (state) state.countdownDisplay = formatCountdown(Math.max(0, countdownSeconds));
  }, 1000);
};

/**
 * 取消倒计时
 */
const cancelCountdown = (ctx) => {
  clearAllTimers();
  if (state) {
    state.countdownActive = false;
    state.countdownDisplay = "--:--:--";
  }
  ctx.toast.info("已取消恶搞定时");
};

// ══════════════════════════════════════════════════
//  Vue 设置面板组件
// ══════════════════════════════════════════════════

const createSettingsComponent = (ctx) =>
  ctx.vue.defineComponent({
    name: "PrankSystemSettings",
    setup() {
      const { defineAsyncComponent, h } = ctx.vue;
      const Button = defineAsyncComponent(ctx.ui.components.Button);
      const Select = defineAsyncComponent(ctx.ui.components.Select);
      const Switch = defineAsyncComponent(ctx.ui.components.Switch);
      const Input = defineAsyncComponent(ctx.ui.components.Input);

      const modeOptions = [
        { label: "🟦 蓝屏模拟", value: "fullscreen" },
        { label: "💀 假死（无响应）", value: "freeze" },
      ];

      const resetSettings = () => {
        updateSettings(ctx, DEFAULT_SETTINGS);
        clearAllTimers();
        if (state?.settings.enabled) startPrankCountdown(ctx);
        ctx.toast.success("设置已恢复默认");
      };

      const doTestPrank = () => {
        if (!state) return;
        if (state.settings.prankMode === "fullscreen") {
          ctx.toast.warning("🟦 蓝屏模拟…");
          showFullscreenOverlay();
        } else {
          executeFreeze(ctx);
        }
      };

      return () => {
        if (!state) return h("div", "加载中…");
        const s = state.settings;

        return h("div", { class: "prank-settings-panel" }, [
          // ══ 全局开关 ══
          h("div", { class: "prank-setting-group" }, [
            h("h3", { class: "prank-setting-title" }, "🎛️ 全局设置"),
            h("label", { class: "prank-setting-row" }, [
              h("span", "启用插件"),
              h(Switch, {
                modelValue: s.enabled,
                "onUpdate:modelValue": (v) => {
                  updateSettings(ctx, { enabled: Boolean(v) });
                  clearAllTimers();
                  if (v && state?.settings.enabled) startPrankCountdown(ctx);
                },
                style: "flex-shrink: 0; margin-left: auto;"
              }),
            ]),
            h("div", { class: "prank-setting-hint" },
              "启用后自动开始随机延时倒计时，到点直接执行恶搞操作。"
            ),
          ]),

          // ══ 恶搞模式 ══
          h("div", { class: "prank-setting-group" }, [
            h("h3", { class: "prank-setting-title" }, "🎯 恶搞模式"),
            h(Select, {
              modelValue: s.prankMode,
              options: modeOptions,
              "onUpdate:modelValue": (value) => {
                updateSettings(ctx, { prankMode: value });
                clearAllTimers();
                if (state?.settings.enabled) startPrankCountdown(ctx);
              },
            }),
            h("div", { class: "prank-setting-hint" },
              s.prankMode === "fullscreen"
                ? "触发后弹出占据全屏的恶搞页面，无法关闭，覆盖所有内容。"
                : "触发后窗口将完全无响应，只能通过任务管理器结束进程。"
            ),
          ]),

          // ══ 延时范围 ══
          h("div", { class: "prank-setting-group" }, [
            h("h3", { class: "prank-setting-title" }, "⏱️ 随机延时范围"),
            h("div", { class: "prank-range" }, [
              h("div", { class: "prank-range-group" }, [
                h("span", { class: "prank-range-label" }, "最早（分钟）"),
                h(Input, {
                  modelValue: String(s.minTime),
                  type: "number", min: 5, max: 1440,
                  "onUpdate:modelValue": (v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n >= 5 && n <= 1440) {
                      updateSettings(ctx, { minTime: n });
                      if (state.settings.maxTime < n) updateSettings(ctx, { maxTime: n });
                      clearAllTimers();
                      if (state?.settings.enabled) startPrankCountdown(ctx);
                    }
                  },
                }),
              ]),
              h("span", { class: "prank-range-sep" }, "—"),
              h("div", { class: "prank-range-group" }, [
                h("span", { class: "prank-range-label" }, "最晚（分钟）"),
                h(Input, {
                  modelValue: String(s.maxTime),
                  type: "number", min: 5, max: 1440,
                  "onUpdate:modelValue": (v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n >= 5 && n <= 1440) {
                      updateSettings(ctx, { maxTime: n });
                      clearAllTimers();
                      if (state?.settings.enabled) startPrankCountdown(ctx);
                    }
                  },
                }),
              ]),
            ]),
            h("div", { class: "prank-setting-hint" },
              `将在 ${s.minTime} 至 ${Math.max(s.maxTime, s.minTime)} 分钟内随机触发。最短 5 分钟，最长 1440 分钟（24 小时）。`
            ),
          ]),

          // ══ 倒计时 ══
          state.countdownActive
            ? h("div", { class: "prank-countdown" }, [
                h("div", { class: "prank-countdown-time" }, state.countdownDisplay),
                h("div", { class: "prank-countdown-label" },
                  `距离触发倒计时 · ${getPrankModeLabel(s.prankMode)}`
                ),
              ])
            : null,

          // ══ 操作 ══
          h("div", { class: "prank-setting-group" }, [
            h("h3", { class: "prank-setting-title" }, "🎮 操作"),
            h("div", { class: "prank-setting-actions" }, [
              state.countdownActive
                ? h(Button, {
                    variant: "danger", size: "sm",
                    onClick: () => cancelCountdown(ctx),
                  }, { default: () => "✕ 取消倒计时" })
                : h(Button, {
                    variant: "primary", size: "sm",
                    onClick: () => startPrankCountdown(ctx),
                    disabled: !s.enabled,
                  }, { default: () => "⏱️ 开始倒计时" }),
            ]),
          ]),

          // ══ 风险警告 ══
          h("div", { class: "prank-warning-box" }, [
            h("div", { class: "prank-warning-title" }, "⚠️ 重要安全警告"),
            h("div", { class: "prank-warning-text" },
              "此操作可能影响正常使用！作者不承担任何责任。\n\n" +
              "假死模式会使窗口完全无响应，只能通过任务管理器结束进程。\n" +
              "蓝屏模拟模式会占据整个屏幕，覆盖所有内容且无法关闭（除非在插件管理中禁用此插件）。"
            ),
          ]),

          // ══ 立即测试 ══
          h("div", { class: "prank-setting-group" }, [
            h("h3", { class: "prank-setting-title" }, "🧪 立即执行"),
            h("div", { class: "prank-test-btns" }, [
              h(Button, {
                variant: "danger", size: "sm",
                onClick: doTestPrank,
              }, { default: () => `⚡ 立即执行：${getPrankModeLabel(s.prankMode)}` }),
            ]),
            h("div", { class: "prank-setting-hint" },
              "点击按钮立即触发当前选择的恶搞操作，不会等待倒计时。"
            ),
          ]),

          // ══ 关于作者 ══
          h("div", { class: "prank-setting-group prank-about" }, [
            h("h3", { class: "prank-setting-title" }, "👤 关于作者"),
            h("div", { class: "prank-about-content" }, [
              h("div", { class: "prank-about-avatar" }, "🎭"),
              h("div", { class: "prank-about-info" }, [
                h("div", { class: "prank-about-name" }, "ZHCOOL520"),
                h("div", { class: "prank-about-desc" }, "EchoMusic 猎奇插件开发者"),
                h("a", {
                  class: "prank-about-link",
                  href: "https://github.com/ZHCOOL520",
                  target: "_blank", rel: "noopener noreferrer",
                }, "🔗 github.com/ZHCOOL520"),
              ]),
            ]),
            h("div", { class: "prank-about-version" }, [
              h("span", null, "恶搞整活插件 v1.2.0"),
              h("span", { class: "prank-about-sep" }, "·"),
              h("span", null, "基于 EchoMusic 插件 API"),
            ]),
          ]),
        ]);
      };
    },
  });

// ══════════════════════════════════════════════════
//  独立页面
// ══════════════════════════════════════════════════

const createPageComponent = (ctx) =>
  ctx.vue.defineComponent({
    name: "PrankSystemPage",
    setup() {
      const SettingsComponent = createSettingsComponent(ctx);
      return () =>
        ctx.vue.h("div", { class: "prank-system-page" }, [
          ctx.vue.h("div", { class: "prank-system-page-header" }, [
            ctx.vue.h("h2", { class: "prank-system-page-title" }, "🎭 恶搞整活"),
            ctx.vue.h("span", { class: "prank-system-page-author" }, "by ZHCOOL520"),
          ]),
          ctx.vue.h("div", { class: "prank-system-page-body" }, [
            ctx.vue.h(SettingsComponent),
          ]),
        ]);
    },
  });

const PAGE_CSS = `
.prank-system-page {
  padding: 24px;
  max-width: 560px;
  margin: 0 auto;
}
.prank-system-page-header {
  text-align: center;
  margin-bottom: 28px;
}
.prank-system-page-title {
  font-size: 22px;
  font-weight: 720;
  letter-spacing: 3px;
  margin: 0 0 6px 0;
  color: var(--color-text-main);
}
.prank-system-page-author {
  font-size: 11px;
  color: var(--color-text-secondary);
  opacity: 0.45;
  letter-spacing: 2px;
}

/* ── 蓝屏模拟覆盖层（强制全屏）── */
#prank-fullscreen-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 2147483647;
  pointer-events: all;
  user-select: none;
}
.prank-fs-backdrop {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: prank-fs-pulse 2s ease-in-out infinite;
}
@keyframes prank-fs-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.15); }
}
.prank-fs-content {
  text-align: center;
  padding: 40px;
  position: relative;
  z-index: 1;
}
.prank-fs-emote {
  font-size: 120px;
  animation: prank-fs-bounce 0.6s ease-in-out infinite alternate;
  display: block;
  line-height: 1;
}
@keyframes prank-fs-bounce {
  from { transform: translateY(0) scale(1); }
  to { transform: translateY(-20px) scale(1.1); }
}
.prank-fs-title {
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 30px rgba(255,255,255,0.5);
  margin: 20px 0 12px;
  letter-spacing: 2px;
}
.prank-fs-subtitle {
  font-size: 16px;
  color: rgba(255,255,255,0.7);
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.6;
}
.prank-fs-particles {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.prank-fs-particle {
  position: absolute;
  bottom: -60px;
  animation: prank-fs-float linear forwards;
  opacity: 0.7;
}
@keyframes prank-fs-float {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 0.8;
  }
  80% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-110vh) rotate(720deg) scale(0.3);
    opacity: 0;
  }
}
`;

// ══════════════════════════════════════════════════
//  插件激活入口
// ══════════════════════════════════════════════════

export async function activate(ctx) {
  const saved = await ctx.storage.get(STORAGE_KEY);
  const settings = normalizeSettings(saved);

  state = ctx.vue.reactive({
    settings,
    countdownActive: false,
    countdownDisplay: "--:--:--",
  });

  styleDispose = ctx.css.inject(PAGE_CSS, { id: "prank-system-styles" });

  settingsDispose = ctx.ui.settings.define({
    title: "恶搞整活",
    description: "设置恶搞模式和延时范围，到点直接执行。",
    component: createSettingsComponent(ctx),
  });

  pageDispose = ctx.ui.addPage({
    id: "prank-system",
    title: "恶搞整活",
    icon: "tabler:mood-crazy-happy",
    component: createPageComponent(ctx),
    sidebar: { section: "plugins", sectionTitle: "插件", order: 30 },
  });

  ctx.commands.register("prank-system.test", () => {
    const mode = state?.settings.prankMode || "fullscreen";
    if (mode === "fullscreen") showFullscreenOverlay();
    else executeFreeze(ctx);
  });
  ctx.commands.register("prank-system.cancel", () => cancelCountdown(ctx));

  if (state.settings.enabled) {
    setTimeout(() => startPrankCountdown(ctx), 2000);
  }

  ctx.toast.success("🎭 恶搞整活 已启用 — ZHCOOL520");
}

// ══════════════════════════════════════════════════
//  插件停用入口
// ══════════════════════════════════════════════════

export function deactivate() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = 0;
  clearAllTimers();
  hideFullscreenOverlay();
  settingsDispose?.();
  pageDispose?.();
  styleDispose?.();
  settingsDispose = null;
  pageDispose = null;
  styleDispose = null;
  state = null;
}
