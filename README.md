# ZHCOOL520 猎奇插件源

> ⚠️ **非官方插件源** — 本插件源与 EchoMusic 官方无关，所有插件均由社区开发者 ZHCOOL520 个人维护。收录的插件以「猎奇」为主题，主打趣味、整活和非常规体验。

本仓库收录 EchoMusic 猎奇向插件。EchoMusic 2.2.6-beta.11 起支持在「插件管理」中浏览在线插件源。

---

## 在线插件源

EchoMusic 2.2.6-beta.11 起支持在「插件管理」中浏览在线插件源。本仓库根目录提供 `echo-plugins.json`，可以直接作为插件源添加：

```text
https://github.com/ZHCOOL520/EchoMusicPlugins
```

添加后，EchoMusic 会读取仓库根目录的 `echo-plugins.json`。这个文件只是插件源索引，负责告诉 EchoMusic「有哪些插件、插件仓库在哪里、插件目录在哪里」。插件的名称、版本、描述、作者、图标、入口文件、能力声明和兼容性要求，都以插件仓库里的 `manifest.json` 为准。

刷新在线插件列表时，EchoMusic 会先读取插件源索引，再根据每个条目的 `repo` 和 `path` 读取对应插件目录下的 `manifest.json`。安装时会下载插件仓库 zip，只提取 `path` 指向的目录并再次校验其中的 `manifest.json`。

### 插件源索引格式

```json
{
  "name": "ZHCOOL520 猎奇插件源",
  "homepage": "https://github.com/ZHCOOL520/EchoMusicPlugins",
  "description": "非官方 EchoMusic 猎奇插件合集，收录广告系统、原神启动等趣味插件。",
  "plugins": [
    {
      "id": "echo-ad-system",
      "path": "echo-ad-system",
      "repo": "https://github.com/ZHCOOL520/EchoMusicPlugins",
      "homepage": "https://github.com/ZHCOOL520/EchoMusicPlugins/tree/main/echo-ad-system",
      "tags": ["ad", "monetization", "bing-wallpaper", "startup-audio", "猎奇"]
    },
    {
      "id": "genshin-launcher",
      "path": "genshin-launcher",
      "repo": "https://github.com/ZHCOOL520/EchoMusicPlugins",
      "homepage": "https://github.com/ZHCOOL520/EchoMusicPlugins/tree/main/genshin-launcher",
      "tags": ["game", "launcher", "genshin", "cloud-gaming", "猎奇"]
    }
  ]
}
```

字段说明：

- `id`：推荐填写。用于标识索引条目；如果填写，必须和插件 `manifest.json` 中的 `id` 一致。
- `path`：可选。插件目录相对仓库 zip 根目录的路径，目录内必须包含 `manifest.json`。
- `repo`：可选。插件源码仓库地址；留空时默认使用插件源仓库。可以填写 `owner/repo` 或 GitHub 仓库 URL。
- `homepage`：可选。插件详情页或说明页地址，主要用于展示。
- `tags`：可选。用于在线插件列表的分类和搜索。

不要在 `echo-plugins.json` 中维护插件 `version`、`description`、`author`、`icon`、`main`、`style`、`capabilities`、`requires` 等字段。这些信息属于插件自身清单，应写在插件目录的 `manifest.json` 中。

---

## 插件列表

### 🔫 广告系统（echo-ad-system）

> v2.0.0 · by ZHCOOL520

把 EchoMusic 变成一个「带广告的音乐播放器」——开屏广告、播放中插播广告、启动音效，甚至支持 Bing 每日壁纸做广告背景。猎奇指数拉满。

**功能特性：**

- 🔊 **启动音效** — 软件启动时自动播放音频（如「嗨喽酷狗」），支持插件目录内相对路径、`file://` 本地路径、`https://` 在线地址，音量 0~100% 可调，内置测试播放按钮。
- 🚀 **开屏广告** — 应用启动时全屏弹出，带倒计时进度条，展示时长 3~30 秒可配，可跳过时间可配，从广告池随机选取轮换。
- 🎵 **播放中插播广告** — 音乐播放随机时长后自动暂停弹广告，触发间隔 60~7200 秒可配，广告展示时长 3~60 秒可配，倒计时结束后自动恢复播放，仅在播放状态触发。
- 🖼️ **Bing 每日壁纸** — 今日壁纸 / 近 8 天随机 / 自定义列表 / 混合模式 / 纯色背景，5 种图片来源模式可选。
- 🎨 **自定义配置** — 每条广告独立配置标题、副标题、跳转链接、背景色、文字色、强调色，支持自定义图片列表多张轮换。
- 🌗 **主题感知** — UI 自动跟随 EchoMusic 暗色/亮色主题变化。

**文件结构：**

```
echo-ad-system/
├── manifest.json          # 插件清单
├── index.js               # 插件主入口
├── style.css              # 全局样式（主题感知）
├── icon.svg               # 插件图标
├── echo-plugins.json      # （旧版兼容）
├── README.md              # 插件说明
└── audio/
    ├── hello-kugou.mp3    # 内置「嗨喽酷狗」音频
    └── guanzhu.mp3        # 内置「关注」音频
```

**配置说明：**

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 全局开关 | ✅ | 总开关，关闭后所有广告功能停用 |
| 启动音效启用 | ✅ | 启动时播放音频 |
| 音频文件路径 | `audio/hello-kugou.mp3` | 支持相对/绝对/URL 路径 |
| 音量 | 80% | 0~100% |
| 开屏广告启用 | ✅ | 启动时全屏展示广告 |
| 开屏展示时长 | 5 秒 | 3~30 秒 |
| 开屏可跳过时间 | 2 秒后 | 1~15 秒 |
| 播放中广告启用 | ✅ | 播放中随机插播广告 |
| 最短间隔 | 300 秒 | 60~3600 秒 |
| 最长间隔 | 600 秒 | 60~7200 秒 |
| 展示时长 | 8 秒 | 3~60 秒 |
| 可跳过时间 | 3 秒后 | 1~30 秒 |
| 图片来源 | Bing 今日 | 5 种模式可选 |
| 每条广告独立配色 | 各自预设 | 背景色/文字色/强调色自由搭配 |

### 🚀 原神启动（genshin-launcher）

> v1.0.0 · by ZHCOOL520

在 EchoMusic 里一键启动原神——支持云原神和本地启动两种模式，内置随机延时启动逻辑，带倒计时界面和侧边栏入口。

> 💡 灵感来源：在听歌软件里塞一个原神启动器，难道还不够猎奇吗？

**功能特性：**

- ☁️ **云原神模式** — 通过系统浏览器打开云原神网页，无需下载游戏客户端。
- 💻 **本地启动模式** — 选择本地 `.exe` / `.lnk` 文件直接启动，支持文件浏览器选择路径。
- ⏱️ **随机延时启动** — 在设定的时间范围内随机取一个延时值，到点自动启动，带实时倒计时显示（HH:MM:SS 格式）。
- 🔢 **延时范围可调** — 最早 1~300 分钟、最晚 1~300 分钟自由设定，自动保证最晚 ≥ 最早。
- 🧪 **立即启动测试** — 跳过延时直接启动，方便测试配置是否正确。
- 🧭 **独立页面 + 侧边栏** — 注册专门的「原神启动」页面和侧边栏导航入口，操作集中方便。
- 💾 **设置持久化** — 所有配置自动保存到插件 KV 存储，重启不丢失。

**文件结构：**

```
genshin-launcher/
├── manifest.json          # 插件清单
├── index.js               # 插件主入口（设置面板 + 独立页面 + 倒计时逻辑）
├── style.css              # 全局样式
└── icon.svg               # 插件图标（紫蓝渐变星门设计）
```

**配置说明：**

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 启动模式 | ☁️ 云原神 | 选择「云原神」通过浏览器游玩，或「本地启动」运行本地客户端 |
| 本地启动路径 | 未选择 | 仅本地模式显示，点击浏览选择 `.exe` / `.lnk` 文件 |
| 最早延时 | 10 分钟 | 随机延时范围下限（1~300 分钟） |
| 最晚延时 | 60 分钟 | 随机延时范围上限（1~300 分钟），自动 ≥ 最早延时 |

**使用流程：**

1. 在侧边栏「插件」分组下点击「原神启动」，或在插件管理页打开设置。
2. 选择启动模式（云原神 / 本地启动）。
3. 本地模式需先选择客户端 `.exe` 路径。
4. 设置随机延时范围，点击「⚡ 启动原神」开始倒计时。
5. 倒计时期间可点击「✕ 取消定时启动」取消。
6. 如需立即测试，点击「🧪 立即启动测试」跳过延时。

---

## 安装方式

### 方式一：在线安装（推荐）

1. 打开 EchoMusic → 插件管理 → 添加插件源
2. 输入插件源地址：

```text
https://github.com/ZHCOOL520/EchoMusicPlugins
```

3. 刷新在线插件列表，找到「广告系统」或「原神启动」点击安装。
4. 安装完成后启用插件即可。

### 方式二：手动安装

1. 下载本仓库 ZIP 或克隆到本地：

```bash
git clone https://github.com/ZHCOOL520/EchoMusicPlugins.git
```

2. 在 EchoMusic 插件管理页点击「打开目录」。
3. 将 `echo-ad-system` 和/或 `genshin-launcher` 文件夹复制到插件目录。
4. 刷新插件列表，启用插件。

### 方式三：单个插件仓库

如果只想安装其中一个插件，也可以直接使用对应插件目录。将 `echo-ad-system` 或 `genshin-launcher` 文件夹单独复制到 EchoMusic 插件目录即可。

---

## 插件目录结构

在「插件管理」中点击「打开目录」。EchoMusic 的本地插件目录会直接包含各个插件文件夹：

```text
<EchoMusic 插件目录>/
  echo-ad-system/
    manifest.json
    index.js
    style.css
    icon.svg
  genshin-launcher/
    manifest.json
    index.js
    style.css
    icon.svg
```

---

## manifest.json 清单格式

每个插件目录必须包含 `manifest.json`，作为插件的权威清单。格式如下：

```json
{
  "id": "echo-ad-system",
  "name": "广告系统",
  "version": "2.0.0",
  "description": "开屏广告 + 播放中插播广告 + 启动音效…",
  "author": "ZHCOOL520",
  "icon": "icon.svg",
  "main": "index.js",
  "style": "style.css",
  "runtime": {
    "miniPlayer": false,
    "desktopLyric": false
  },
  "capabilities": {
    "audioSource": false,
    "audioSpectrum": false,
    "kugouApi": false,
    "localFiles": false,
    "lyricEffects": false,
    "lyrics": false,
    "process": false
  },
  "requires": {
    "echoMusicVersion": ">=2.2.6"
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 插件唯一标识，必须全小写英文 + 连字符 |
| `name` | ✅ | 插件显示名称 |
| `version` | ✅ | 语义化版本号，如 `1.0.0` |
| `description` | ✅ | 一句话描述插件功能 |
| `author` | ✅ | 作者名称 |
| `icon` | 推荐 | 插件图标，支持相对路径、`https` 和 `data:image/*` |
| `main` | 可选 | 入口文件，默认 `index.js`，支持 `.js` / `.mjs` |
| `style` | 可选 | 样式文件，仅支持 `.css` |
| `runtime` | 可选 | `miniPlayer` / `desktopLyric`：是否在独立窗口中加载 |
| `capabilities` | 可选 | 声明插件需要的能力：`audioSource`、`audioSpectrum`、`kugouApi`、`localFiles`、`lyricEffects`、`lyrics`、`process` |
| `requires` | 可选 | `echoMusicVersion`：semver range 版本要求，如 `>=2.2.6` |

---

## 安全提示

插件属于用户信任后运行的本地代码。当前插件运行在渲染进程的浏览器 ESM 环境中，EchoMusic 不声明也不伪装成权限沙箱；**请只启用来源可信的插件**。

如果插件导致界面异常，可以在插件管理页启用「插件安全模式」、禁用或卸载对应插件。

本插件源为社区非官方源。如遇问题，请在 [GitHub Issues](https://github.com/ZHCOOL520/EchoMusicPlugins/issues) 反馈。

---

## 开源协议

MIT License — 详见各插件目录下的 LICENSE 文件。

---

## 作者

**[ZHCOOL520](https://github.com/ZHCOOL520)** — EchoMusic 猎奇向插件开发者。

欢迎 PR 和 Star ⭐，也欢迎提交你自己的猎奇插件。
