# Microsoft Edge 版本

本项目使用 Chrome/Edge 均支持的 Manifest V3、原生 JavaScript 和标准扩展 API。Edge 发行包与 Chrome 共用核心代码，区别仅在发行目录和随包说明，不维护第二套字幕逻辑。

## 本地侧载

1. 打开 `edge://extensions/`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择 `outputs/netflix-youtube-deepseek-subtitle-translator-edge`。
5. 打开扩展设置，填写 DeepSeek API Key。
6. 在 Netflix 或 YouTube 播放器中开启英文/日文字幕。

## Edge Add-ons 发布准备

- 上传 Edge 发行 ZIP，压缩包根目录必须直接包含 `manifest.json`。
- 商店隐私说明应明确：API Key 保存在本地 `chrome.storage.local`；字幕文本只发送给用户配置的 DeepSeek API；不收集浏览记录，不下载视频，不破解 DRM。
- 商店权限说明应列出 `storage`、`scripting`、`webNavigation`，以及 Netflix、YouTube、DeepSeek 三个 host 权限的用途。
- 发布给他人前，建议使用后端代理保护 API Key，并补充正式隐私政策和支持页面。

## 兼容性边界

Edge 版本面向基于 Chromium 的当前 Microsoft Edge。Firefox 不在本版本范围内。Chrome 与 Edge 发行包必须由同一份已通过测试的源码生成，禁止分别修改平台运行逻辑。
