# ZHCOOL520 猎奇插件源

> ⚠️ **第三方非官方插件源** — 与 EchoMusic 官方无关，主打搞笑整活和比较神人（奇葩/离谱）的插件分享。风格轻松幽默，非严肃实用型插件。请谨慎安装，出 bug 不负责（逃

本仓库收录 EchoMusic 猎奇向插件，定位就是一个**整活合集**。如果你想要正经功能，出门右转[官方插件源](https://github.com/hoowhoami/EchoMusicPlugins)。

---

## 本插件源包含的插件

| 插件 | 一句话介绍 |
|------|-----------|
| 🔫 广告系统 | 在播放器里塞广告，体验一把当厂商的感觉 |
| 🚀 原神启动 | 在听歌软件里启动原神，跨次元联动 |

更多详细介绍请查看各插件目录下的 README。

---

## 官方插件有哪些？

EchoMusic 官方插件源（[https://github.com/hoowhoami/EchoMusicPlugins](https://github.com/hoowhoami/EchoMusicPlugins)）包含的插件有：

- **dynamic-island-lyric** — 灵动岛歌词
- **water-lyrics** — 水歌词特效
- **page-motion** — 页面过渡动画
- **scroll-assistant** — 滚动辅助
- **cover-fallback** — 封面回退
- **lyric-info-scroll** — 歌词信息滚动
- **spectrum-visualizer** — 频谱可视化
- **webdav-music** — WebDAV 音乐源
- **echomusic-vinyl-rotation** — 黑胶唱片旋转
- **Lyrics-bridge** — 歌词桥接
- **echo-miuix-plugin** — MIUIX 主题

以上为官方维护的实用型插件。本插件源的插件与官方无关，纯属整活。

---

## 在线插件源

EchoMusic 2.2.6-beta.11 起支持在「插件管理」中浏览在线插件源。添加以下地址即可：

```text
https://github.com/ZHCOOL520/EchoMusicPluginst
```

插件源索引文件为根目录的 `echo-plugins.json`。

---

## 安装方式

### 方式一：在线安装（推荐）

1. 打开 EchoMusic → 插件管理 → 添加插件源
2. 输入插件源地址：`https://github.com/ZHCOOL520/EchoMusicPluginst`
3. 刷新在线插件列表，找到想安装的插件点击安装

### 方式二：手动安装

1. 下载本仓库 ZIP 或克隆到本地
2. 将对应插件文件夹复制到 EchoMusic 插件目录
3. 刷新插件列表，启用插件

---

## 插件开发指南

想自己动手做一个 EchoMusic 插件？以下是标准规范，与官方插件完全一致。

### 插件目录结构

一个标准插件文件夹的布局如下（以官方 `dynamic-island-lyric` 为例）：

```
<plugin-id>/          # 插件目录名即插件 id
├── manifest.json     # 插件清单（必须）
├── index.js          # 插件主入口（必须）
├── style.css         # 全局样式文件（可选）
├── icon.svg          # 插件图标（推荐）
└── ...               # 其他资源文件
```

### manifest.json 模板

`manifest.json` 是插件的权威清单，字段必须与官方规范对齐：

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "一句话描述插件功能",
  "author": "你的名字",
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
    "echoMusicVersion": ">=2.2.5"
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 插件唯一标识，全小写英文连字符 |
| `name` | ✅ | 插件显示名称 |
| `version` | ✅ | 语义化版本号，如 `1.0.0` |
| `description` | ✅ | 一句话描述 |
| `author` | ✅ | 作者名称 |
| `icon` | 推荐 | 插件图标，支持相对路径 / `https://` / `data:image/*` |
| `main` | 可选 | 入口文件，默认 `index.js`，支持 `.js` / `.mjs` |
| `style` | 可选 | 样式文件，仅 `.css` |
| `runtime` | 可选 | `miniPlayer` / `desktopLyric`：是否在独立窗口中加载 |
| `capabilities` | 可选 | 声明插件需要的能力：`audioSource`、`audioSpectrum`、`kugouApi`、`localFiles`、`lyricEffects`、`lyrics`、`process` |
| `requires` | 可选 | `echoMusicVersion`：semver 版本要求 |

### 快速搭建插件骨架

使用以下命令快速创建插件目录结构和模板文件：

```bash
# 克隆官方插件源，参考官方结构
mkdir my-plugin
cd my-plugin

# 创建 manifest.json（参考上方模板）
touch manifest.json index.js style.css icon.svg
```

或者直接参考本仓库已有插件的目录结构进行修改。只要 `manifest.json` 格式正确，EchoMusic 就能识别加载。

### 发布到本插件源

如果你想将自己开发的插件提交到本插件源，请确保：

1. `manifest.json` 字段完整、格式正确，与官方规范对齐
2. 插件目录放在仓库根目录下，目录名即插件 `id`
3. 在 `echo-plugins.json` 中添加对应的索引条目（参考现有格式）
4. 提交 PR 或联系作者审核

---

## 安全提示

插件属于用户信任后运行的本地代码。**请只启用来源可信的插件**。

如果插件导致界面异常，可以在插件管理页启用「插件安全模式」、禁用或卸载对应插件。

---

## 开源协议

MIT License

---

## 作者

**[ZHCOOL520](https://github.com/ZHCOOL520)**

欢迎 PR 和 Star ⭐，也欢迎提交你的整活插件。
