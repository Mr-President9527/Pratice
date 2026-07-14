# Netflix & YouTube DeepSeek Subtitle Translator

一个本地自用的 Chromium Manifest V3 字幕翻译插件。它可以读取 Netflix 或 YouTube 播放器当前显示的英文/日文字幕，调用 DeepSeek 翻译成中文，并用插件 overlay 统一显示字幕。Chrome 与 Microsoft Edge 使用同一套核心代码，但提供独立发行包。

## 当前能力

- 只在 `https://www.netflix.com/*` 和 `https://www.youtube.com/*` 生效。
- 不请求 `<all_urls>` 权限。
- 不抓取 Netflix/YouTube 完整字幕轨道，不破解 DRM，不下载视频。
- 默认隐藏平台原生字幕的视觉显示，但不删除字幕节点，仍可读取当前屏幕字幕。
- 支持实时识别当前字幕并翻译。
- 支持导入本地 `.srt` / `.vtt`，分批预翻译整集字幕并保存到 IndexedDB。
- YouTube 支持普通视频、Shorts 和直播播放页。
- 支持中文模式和双语模式。
- 使用内存缓存、`chrome.storage.local` 持久缓存、请求去重和过期请求保护降低重复请求。
- 原字幕真正消失后，译文会延迟约 `250–550ms` 清空；如果 Netflix 错误地持续保留旧 DOM 文本，也会在约 `8–14s` 后强制清除，避免上一句字幕一直停留。

## 0.2.3 保守检测补丁

- Netflix 原生字幕容器仍挂载时优先判定字幕已开启。
- 避免自定义字幕渲染与浏览器辅助轨道状态不一致造成误提示。

## 0.2.2 字幕开启状态检测修复

- 正常对白间隙不再显示“请先开启字幕”。
- 新增字幕轨道三态检测：`enabled`、`disabled`、`unknown`。
- 只有所有可识别字幕轨道明确处于关闭状态时才显示开启字幕提示。
- 插件为隐藏原生字幕而设置成 `hidden` 的轨道仍会被正确识别为已开启。
- 没有足够证据判断字幕关闭时保持画面空白，避免误提示。

## 0.2.1 API 稳定性修复

- 区分 DeepSeek `400/401/402/403/422/429/5xx` 错误，不再全部显示为“检查网络或 API Key”。
- 对网络中断、超时、限流和服务器繁忙增加一次短延迟自动重试。
- 单次 API 请求超过 8 秒会主动结束，避免后台请求长时间占用。
- 设置页“测试 API”会直接提示 Key 失效、余额不足、请求过频或服务繁忙等具体原因。

## 0.2.0 平台扩展

- 新增独立的 YouTube 字幕识别和 overlay，不会在 Netflix 页面加载或运行。
- YouTube 只读取播放器内 `.ytp-caption-segment`，不扫描标题、评论、推荐或页面正文。
- YouTube 原字幕使用 `opacity: 0`、`visibility: hidden` 隐藏，字幕 DOM 仍保留供读取。
- YouTube 支持中文模式、双语模式、缓存优先、上下文翻译、过期请求保护和字幕消失延迟。
- YouTube 预翻译使用 `youtube-<video id>` 作为 videoKey，并支持时间轴偏移。
- Netflix 的四个运行文件保持与 `0.1.84` 完全相同，并有 SHA-256 完整性测试保护。
- 新增 Chrome 与 Microsoft Edge 独立发行目录及压缩包。

## 0.1.84 检验与优化

- 修复“清空缓存”只清本地存储、没有清内存缓存的问题。
- 串行化持久缓存写入，避免多条翻译并发完成时互相覆盖。
- 清空缓存会使此前仍在执行的旧请求失去写缓存资格，防止缓存被异步请求重新填回。
- 预翻译续传现在同时核对 cue ID 和原文，换过字幕文件后不会误用旧译文。
- 预翻译播放按时间二分查找 cue，拖动进度和长字幕文件下的查找成本从线性扫描降为对数级。
- 新增缓存并发、字幕解析、预翻译续传和时间轴查找回归测试。

## Chrome 安装

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 Chrome 发行目录，或本项目文件夹 `netflix-deepseek-subtitle-translator`。
5. 修改代码后需要在扩展管理页点击“重新加载”。

## Microsoft Edge 安装

1. 打开 `edge://extensions/`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择 Edge 发行目录 `netflix-youtube-deepseek-subtitle-translator-edge`。
5. 商店发布或打包说明见 `EDGE.md`。

## 基础使用

1. 点击插件图标，打开“设置”。
2. 填写 DeepSeek API Key。
3. 选择模型、目标语言、显示模式和字幕样式。
4. 打开 Netflix 或 YouTube 播放页。
5. 在播放器中先开启英文或日文字幕/CC。
6. 默认实时模式下，插件会读取当前显示字幕并显示中文 overlay。

## 整集预翻译

1. 在设置页或 popup 点击“打开整集预翻译”。
2. 选择本地合法来源的 `.srt` 或 `.vtt` 字幕文件。
3. 填写或确认 `videoKey`。Netflix 使用 `netflix-<watch id>`，YouTube 使用 `youtube-<video id>`。
4. 点击“解析字幕”，确认条数、时长和批次数。
5. 点击“开始预翻译”。每批最多 30 条，会复用现有 `TRANSLATE_BATCH`。
6. 中途可点击“暂停”，进度会保存；再次开始会跳过已翻译 cue。
7. 在设置页把“字幕来源”切换为“本地预翻译字幕”。

预翻译模式下不会调用实时翻译 API；播放时只按 `video.currentTime + subtitleOffsetMs` 查找本地 cue 并渲染 overlay。

## 关键设置

- `hideNativeSubtitles`：默认开启。开启时隐藏当前平台原生字幕的视觉显示，避免重叠。
- `subtitleSourceMode`：`live` 为实时识别，`pretranslated` 为本地预翻译字幕。
- `subtitleOffsetMs`：预翻译字幕整体偏移，正数表示按更晚时间查找，负数表示提前。
- `advancedSubtitleFallback`：默认关闭。只有 Netflix timed text 容器识别不到字幕时，才建议临时打开高级 fallback。

## 验证不再重叠

1. 设置页确认“隐藏平台原生字幕”已开启。
2. 进入 Netflix 或 YouTube 播放页并开启英文/日文字幕。
3. 正常播放时应只看到插件 overlay，不应同时看到平台原生字幕。
4. popup 的“当前平台”和“页面接管”应显示对应平台及当前 build。

## 验证缓存变快

1. 播放到一句字幕，等待翻译出现。
2. 倒回让同一句再次出现。
3. 命中内存缓存或本地缓存时，overlay 应明显更快出现，并且不会重复请求 DeepSeek。

## 验证过期请求保护

1. 找一段字幕变化较快的片段。
2. 快速拖动进度条或连续快进。
3. 旧请求稍后返回时，不应覆盖当前字幕；内容脚本会用递增的 `subtitleSeq/requestSequence` 只接受当前字幕结果。

## 验证字幕正常消失

播放中观察一句字幕结束的瞬间：原字幕节点被隐藏后，插件译文应在约半秒内消失，而不是一直保留到下一句。Netflix 另有 `8–14s` 的旧 DOM 文本硬兜底；YouTube 只信任当前 caption window，不使用页面正文 fallback。

## 验证误识别修复

- 默认只读取 Netflix timed text 相关容器，例如 `.player-timedtext`、`.player-timedtext-text-container`、`[data-uia*="player-timedtext"]`。
- 默认不会扫描播放器中所有 `span/div/p`。
- 剧集名、菜单、按钮、进度条、设置面板、`S1 E2` 这类标题信息会被过滤，不进入缓存和 API。
- 只有打开 `advancedSubtitleFallback` 时，才启用更严格的位置和稳定性 fallback。
- YouTube 只读取当前播放器的 `.ytp-caption-window-container`、`.caption-window` 和 `.ytp-caption-segment`，不启用全页面文本 fallback。

## 文件说明

- `manifest.json`：MV3 配置，只声明 Netflix、YouTube、DeepSeek 和必要扩展权限。
- `src/background.js`：设置、缓存、DeepSeek 单句/批量请求、IndexedDB 消息转发。
- `src/content-netflix.js`：Netflix 页面字幕识别、原字幕隐藏、overlay 渲染、预翻译播放同步。
- `src/overlay.css`：字幕 overlay 样式。
- `src/content-youtube.js`：YouTube 播放器字幕识别、翻译、缓存和预翻译同步。
- `src/youtube-overlay.css`：YouTube 原字幕隐藏和透明 overlay 样式。
- `src/options.html` / `src/options.js`：设置页面。
- `src/popup.html` / `src/popup.js`：popup 状态、开关、预翻译入口。
- `src/pretranslate.html` / `src/pretranslate.js`：本地字幕导入和整集预翻译页面。
- `src/subtitle-parser.js`：SRT/VTT 解析。
- `src/pretranslated-store.js`：IndexedDB 存储整集字幕。
- `assets/icon.svg`：扩展图标。
- `tests/`：字幕识别、缓存并发、SRT/VTT 解析、预翻译续传和 text track 隐藏回归测试。
- `EDGE.md`：Microsoft Edge 侧载和发布说明。

## 本地检查

在项目目录中运行 `node tests/<测试文件>.test.js` 可以执行单项回归测试；当前项目不需要安装 npm 依赖。发布前还应对 `src/*.js` 逐个执行 `node --check`，并确认 `manifest.json` 不包含 `<all_urls>`。

## 当前限制

实时模式仍然可能慢一拍，因为它必须等 Netflix 或 YouTube 把当前字幕渲染到 DOM 后才能读取，再发起网络翻译。缓存命中会很快，但第一次出现的新句子无法彻底避免网络延迟。

YouTube 必须先开启可见字幕/CC；插件不会请求或下载 YouTube 的完整字幕轨道。YouTube 页面结构变化时可能需要更新严格 caption 选择器，但不会回退到扫描评论和标题。

彻底解决慢一拍的方向是使用整集预翻译：用户手动导入 SRT/VTT，插件先批量翻译并保存到 IndexedDB，播放时只按时间查表显示，不再等待实时 API。

## API Key 安全

API Key 只保存在本地浏览器的 `chrome.storage.local`。这适合个人自用；如果要发布给他人，应改成后端代理方案，避免把 API Key 暴露在浏览器扩展环境中。
