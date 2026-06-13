// ─── 存储键名 — 插件私有 KV 存储的 key ─────────────────
const STORAGE_KEY = "genshin-launcher-settings";

// ─── 默认设置 — 首次使用或恢复默认时的初始值 ─────────────
const DEFAULT_SETTINGS = {
  mode: "cloud",       // 启动模式："cloud" 云原神 | "local" 本地启动
  localPath: "",       // 本地客户端可执行文件路径
  minTime: 10,         // 随机延时最早分钟数
  maxTime: 60,         // 随机延时最晚分钟数
};

// ─── 运行时状态与资源句柄 ──────────────────────────────
let state = null;              // Vue reactive 状态对象，包含 settings / countdownActive / countdownDisplay
let settingsDispose = null;    // 设置面板注销函数
let pageDispose = null;        // 独立页面注销函数
let sidebarDispose = null;     // 侧边栏入口注销函数
let styleDispose = null;       // CSS 注入注销函数
let saveTimer = 0;             // 防抖定时器，避免频繁写入存储
let countdownTimer = null;     // 倒计时 interval 定时器
let countdownSeconds = 0;      // 倒计时剩余秒数

// ─── 工具：数值钳制 — 将 value 限制在 [min, max] 区间 ──
const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, Number(value) || min));

// ─── 设置归一化 — 合并存储值，校验字段合法性 ───────────
const normalizeSettings = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    mode: source.mode === "local" ? "local" : "cloud",
    localPath: typeof source.localPath === "string" ? source.localPath : "",
    minTime: clamp(source.minTime ?? DEFAULT_SETTINGS.minTime, 1, 300),
    maxTime: clamp(source.maxTime ?? DEFAULT_SETTINGS.maxTime, 1, 300),
  };
};

// ─── 防抖保存 — 240ms 内多次修改只写一次存储 ──────────
const scheduleSave = (ctx) => {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    if (!state) return;
    void ctx.storage.set(STORAGE_KEY, normalizeSettings(state.settings));
  }, 240);
};

// ─── 更新设置 — 合并 patch，确保 maxTime ≥ minTime ────
const updateSettings = (ctx, patch) => {
  if (!state) return;
  const prev = state.settings;
  state.settings = normalizeSettings({ ...prev, ...patch });
  // 保证最晚时间不小于最早时间
  if (state.settings.maxTime < state.settings.minTime) {
    state.settings.maxTime = state.settings.minTime;
  }
  scheduleSave(ctx);
};

// ─── 格式化倒计时 — 秒数 → HH:MM:SS ──────────────────
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

// ─── 执行启动 — 根据当前模式打开云原神或本地客户端 ─────
const doLaunch = (ctx) => {
  if (!state) return;

  if (state.settings.mode === "cloud") {
    // 云原神模式：通过 Electron shell 打开浏览器，失败时回退到 window.open
    if (ctx.electron?.shell?.openExternal) {
      ctx.electron.shell
        .openExternal("https://ys.mihoyo.com/cloud/#/")
        .catch(() => {
          window.open("https://ys.mihoyo.com/cloud/#/", "_blank");
        });
    } else {
      window.open("https://ys.mihoyo.com/cloud/#/", "_blank");
    }
    ctx.toast.success("正在启动云原神…");
  } else if (state.settings.localPath) {
    // 本地模式：通过 Electron shell.openPath 启动本地 .exe
    if (ctx.electron?.shell?.openPath) {
      ctx.electron.shell.openPath(state.settings.localPath).then((err) => {
        if (err) {
          ctx.toast.warning("启动失败: " + err);
        } else {
          ctx.toast.success("正在启动本地客户端…");
        }
      });
    } else {
      ctx.toast.info("请手动运行: " + state.settings.localPath);
    }
  }
};

// ─── 取消倒计时 — 清除定时器，重置界面状态 ────────────
const cancelCountdown = (ctx) => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownSeconds = 0;
  if (state) {
    state.countdownActive = false;
    state.countdownDisplay = "--:--:--";
  }
  ctx.toast.info("已取消定时启动");
};

// ─── 开始定时启动 — 随机生成延时，启动倒计时 ──────────
const startLaunch = (ctx) => {
  if (!state) return;
  if (countdownTimer) return;

  // 本地模式校验：未选文件时提示并阻止
  if (state.settings.mode === "local" && !state.settings.localPath) {
    ctx.toast.warning("本地模式下请先选择启动文件路径");
    return;
  }

  // 在 [minTime, maxTime] 范围内随机取整分钟数
  const min = state.settings.minTime;
  const max = Math.max(state.settings.maxTime, min);
  const delayMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
  countdownSeconds = delayMinutes * 60;

  state.countdownActive = true;
  state.countdownDisplay = formatCountdown(countdownSeconds);

  ctx.toast.info(`将在 ${delayMinutes} 分钟后启动原神`);

  // 每秒更新倒计时显示
  countdownTimer = window.setInterval(() => {
    countdownSeconds--;
    if (state) {
      state.countdownDisplay = formatCountdown(countdownSeconds);
    }
    if (countdownSeconds <= 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
      if (state) {
        state.countdownActive = false;
        state.countdownDisplay = "--:--:--";
      }
      doLaunch(ctx);
    }
  }, 1000);
};

// ─── 设置面板 CSS（内联注入）──────────────────────────
const SETTINGS_CSS = `
.genshin-launcher-settings {
  display: grid;
  gap: 18px;
  color: var(--color-text-main);
}

.genshin-launcher-section {
  display: grid;
  gap: 10px;
}

.genshin-launcher-section-title {
  font-size: 11px;
  font-weight: 680;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  opacity: 0.8;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--color-border-light, rgba(128,128,128,0.15));
}

.genshin-launcher-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.genshin-launcher-label {
  font-size: 13px;
  font-weight: 580;
}

.genshin-launcher-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  opacity: 0.7;
}

.genshin-launcher-path-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.genshin-launcher-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 7px 10px;
  background: var(--color-bg-subtle, rgba(128,128,128,0.06));
  border-radius: 6px;
  cursor: default;
}

.genshin-launcher-path.empty {
  font-style: italic;
  opacity: 0.55;
}

.genshin-launcher-range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}

.genshin-launcher-range-group {
  display: grid;
  gap: 4px;
}

.genshin-launcher-range-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.genshin-launcher-range-sep {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding-top: 14px;
}

.genshin-launcher-countdown {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 14px;
  border-radius: 10px;
  background: var(--color-bg-subtle, rgba(128,128,128,0.05));
  gap: 2px;
}

.genshin-launcher-countdown-time {
  font-size: 32px;
  font-weight: 720;
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  color: var(--color-primary, #c8a45c);
  letter-spacing: 2px;
}

.genshin-launcher-countdown-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  opacity: 0.65;
}

.genshin-launcher-actions {
  display: grid;
  gap: 8px;
}
`;

// ─── 构建设置面板 Vue 组件 ──────────────────────────
// 该组件同时用于插件管理页的"设置"按钮和独立页面
const createSettingsComponent = (ctx) =>
  ctx.vue.defineComponent({
    name: "GenshinLauncherSettings",
    setup() {
      // 异步加载宿主内置 UI 组件
      const { defineAsyncComponent, h, ref } = ctx.vue;
      const Button = defineAsyncComponent(ctx.ui.components.Button);
      const Select = defineAsyncComponent(ctx.ui.components.Select);
      const Switch = defineAsyncComponent(ctx.ui.components.Switch);
      const Input = defineAsyncComponent(ctx.ui.components.Input);

      // 模式下拉选项
      const modeOptions = [
        { label: "☁️ 云原神", value: "cloud" },
        { label: "💻 本地启动", value: "local" },
      ];

      // 重置设置为默认值
      const resetSettings = (ctx) => {
        updateSettings(ctx, DEFAULT_SETTINGS);
        ctx.toast.success("设置已恢复默认");
      };

      // 打开系统文件选择器，筛选 .exe / .lnk
      const selectLocalFile = async (ctx) => {
        const result = await ctx.dialog.selectFiles({
          title: "选择原神启动文件",
          filters: [
            { name: "可执行文件", extensions: ["exe", "lnk", "bat", "cmd"] },
            { name: "所有文件", extensions: ["*"] },
          ],
        });
        if (!result.canceled && result.paths?.[0]) {
          updateSettings(ctx, { localPath: result.paths[0], mode: "local" });
          ctx.toast.success("已加载本地启动路径");
        }
      };

      // 判断当前是否为云原神模式
      const isCloud = () => state?.settings.mode === "cloud";

      return () => {
        if (!state) return h("div", "加载中…");
        const settings = state.settings;

        return h("div", { class: "genshin-launcher-settings" }, [
          // ── 第 1 区：启动模式选择 ──
          h("div", { class: "genshin-launcher-section" }, [
            h("div", { class: "genshin-launcher-section-title" }, "启动模式"),
            h(Select, {
              modelValue: settings.mode,
              options: modeOptions,
              "onUpdate:modelValue": (value) => {
                updateSettings(ctx, {
                  mode: value === "local" ? "local" : "cloud",
                });
              },
            }),
            isCloud()
              ? h(
                  "div",
                  { class: "genshin-launcher-hint" },
                  "通过云端串流游玩，无需下载游戏",
                )
              : null,
          ]),

          // ── 第 2 区：本地启动路径（仅本地模式显示）───
          !isCloud()
            ? h("div", { class: "genshin-launcher-section" }, [
                h(
                  "div",
                  { class: "genshin-launcher-section-title" },
                  "本地启动路径",
                ),
                h("div", { class: "genshin-launcher-path-row" }, [
                  h(
                    "div",
                    {
                      class:
                        "genshin-launcher-path" +
                        (settings.localPath ? "" : " empty"),
                      onClick: () => selectLocalFile(ctx),
                      title: settings.localPath || "点击选择可执行文件",
                    },
                    settings.localPath || "未选择文件 — 点击此处浏览",
                  ),
                  h(
                    Button,
                    {
                      variant: "outline",
                      size: "xs",
                      onClick: () => selectLocalFile(ctx),
                    },
                    { default: () => "浏览" },
                  ),
                ]),
                h(
                  "div",
                  { class: "genshin-launcher-hint" },
                  "选择原神客户端 .exe 或快捷方式 .lnk 文件",
                ),
              ])
            : null,

          // ── 第 3 区：随机延时起止范围 ──
          h("div", { class: "genshin-launcher-section" }, [
            h("div", { class: "genshin-launcher-section-title" }, "随机延时范围"),
            h("div", { class: "genshin-launcher-range" }, [
              h("div", { class: "genshin-launcher-range-group" }, [
                h(
                  "span",
                  { class: "genshin-launcher-range-label" },
                  "最早（分钟）",
                ),
                h(Input, {
                  modelValue: String(settings.minTime),
                  type: "number",
                  min: 1,
                  max: 300,
                  "onUpdate:modelValue": (value) => {
                    const v = parseInt(value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 300) {
                      updateSettings(ctx, { minTime: v });
                    }
                  },
                }),
              ]),
              h("span", { class: "genshin-launcher-range-sep" }, "—"),
              h("div", { class: "genshin-launcher-range-group" }, [
                h(
                  "span",
                  { class: "genshin-launcher-range-label" },
                  "最晚（分钟）",
                ),
                h(Input, {
                  modelValue: String(settings.maxTime),
                  type: "number",
                  min: 1,
                  max: 300,
                  "onUpdate:modelValue": (value) => {
                    const v = parseInt(value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 300) {
                      updateSettings(ctx, { maxTime: v });
                    }
                  },
                }),
              ]),
            ]),
            h(
              "div",
              { class: "genshin-launcher-hint" },
              `启动时将在 ${settings.minTime} 至 ${Math.max(settings.maxTime, settings.minTime)} 分钟内随机延时`,
            ),
          ]),

          // ── 第 4 区：倒计时显示（仅倒计时进行中显示）───
          state.countdownActive
            ? h("div", { class: "genshin-launcher-countdown" }, [
                h(
                  "div",
                  { class: "genshin-launcher-countdown-time" },
                  state.countdownDisplay,
                ),
                h(
                  "div",
                  { class: "genshin-launcher-countdown-label" },
                  "距离启动倒计时",
                ),
              ])
            : null,

          // ── 第 5 区：操作按钮 ──
          h("div", { class: "genshin-launcher-actions" }, [
            // 倒计时进行中显示「取消」按钮
            state.countdownActive
              ? h(
                  Button,
                  {
                    variant: "danger",
                    size: "sm",
                    onClick: () => cancelCountdown(ctx),
                  },
                  { default: () => "✕ 取消定时启动" },
                )
              // 非倒计时状态显示「启动」按钮
              : h(
                  Button,
                  {
                    variant: "primary",
                    size: "sm",
                    onClick: () => startLaunch(ctx),
                  },
                  { default: () => "⚡ 启动原神" },
                ),
            // 非倒计时状态显示「立即启动测试」按钮（跳过延时直接启动）
            !state.countdownActive
              ? h(
                  Button,
                  {
                    variant: "outline",
                    size: "xs",
                    onClick: () => {
                      if (state.settings.mode === "local" && !state.settings.localPath) {
                        ctx.toast.warning("本地模式下请先选择启动文件路径");
                        return;
                      }
                      doLaunch(ctx);
                    },
                  },
                  { default: () => "🧪 立即启动测试" },
                )
              : null,
            // 「恢复默认设置」按钮
            h(
              Button,
              {
                variant: "outline",
                size: "xs",
                onClick: () => resetSettings(ctx),
              },
              { default: () => "恢复默认设置" },
            ),
          ]),
        ]);
      };
    },
  });

// ─── 构建立页面 Vue 组件（含标题头 + 设置面板）──────────
const createPageComponent = (ctx) =>
  ctx.vue.defineComponent({
    name: "GenshinLauncherPage",
    setup() {
      const SettingsComponent = createSettingsComponent(ctx);

      return () =>
        ctx.vue.h("div", { class: "genshin-launcher-page" }, [
          // 页面标题区：插件名称 + 作者标识
          ctx.vue.h("div", { class: "genshin-launcher-page-header" }, [
            ctx.vue.h("h2", { class: "genshin-launcher-page-title" }, "✨ 原神启动"),
            ctx.vue.h(
              "span",
              { class: "genshin-launcher-page-author" },
              "by ZHCOOL520",
            ),
          ]),
          // 设置面板内容
          ctx.vue.h("div", { class: "genshin-launcher-page-body" }, [
            ctx.vue.h(SettingsComponent),
          ]),
        ]);
    },
  });

// ─── 独立页面 CSS（与设置面板 CSS 分开管理）───────────
const PAGE_CSS = `
.genshin-launcher-page {
  padding: 24px;
  max-width: 520px;
  margin: 0 auto;
}

.genshin-launcher-page-header {
  text-align: center;
  margin-bottom: 24px;
}

.genshin-launcher-page-title {
  font-size: 20px;
  font-weight: 720;
  letter-spacing: 2px;
  margin: 0 0 4px 0;
  color: var(--color-text-main);
}

.genshin-launcher-page-author {
  font-size: 11px;
  color: var(--color-text-secondary);
  opacity: 0.5;
  letter-spacing: 1px;
}
`;

// ─── 插件激活入口 — EchoMusic 加载插件时调用 ──────────
export async function activate(ctx) {
  // 初始化响应式状态，从存储中读取已有设置
  state = ctx.vue.reactive({
    settings: normalizeSettings(await ctx.storage.get(STORAGE_KEY)),
    countdownActive: false,
    countdownDisplay: "--:--:--",
  });

  // 注入全局 CSS（设置面板 + 页面样式）
  styleDispose = ctx.css.inject(SETTINGS_CSS + "\n" + PAGE_CSS, {
    id: "genshin-launcher-styles",
  });

  // 注册插件管理页的「设置」入口
  settingsDispose = ctx.ui.settings.define({
    title: "原神启动",
    description: "设置启动模式、本地路径和延时范围。",
    component: createSettingsComponent(ctx),
  });

  // 注册独立页面 + 侧边栏导航入口
  pageDispose = ctx.ui.addPage({
    id: "launcher",
    title: "原神启动",
    icon: "tabler:rocket",
    component: createPageComponent(ctx),
    sidebar: {
      section: "plugins",
      sectionTitle: "插件",
      order: 20,
    },
  });

  ctx.toast.success("原神启动 已启用 — ZHCOOL520");
}

// ─── 插件停用入口 — EchoMusic 禁用/卸载插件时调用 ─────
export function deactivate() {
  // 清理防抖定时器
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = 0;

  // 清理倒计时定时器
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownSeconds = 0;

  // 逐一调用宿主提供的注销函数，释放注册的资源
  settingsDispose?.();
  pageDispose?.();
  styleDispose?.();
  sidebarDispose?.();
  settingsDispose = null;
  pageDispose = null;
  styleDispose = null;
  sidebarDispose = null;
  state = null;
}
