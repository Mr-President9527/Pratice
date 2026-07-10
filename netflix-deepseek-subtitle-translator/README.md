# Netflix DeepSeek Subtitle Translator

一个本地自用的 Chrome Manifest V3 Netflix 字幕翻译插件。它可以读取 Netflix 当前显示的英文/日文字幕，调用 DeepSeek 翻译成中文，并用插件 overlay 统一显示字幕。

## 当前能力

- 只在 `https://www.netflix.com/*` 生效。
- 不请求 `<all_urls>` 权限。
- 不抓取 Netflix 完整字幕轨道，不破解 DRM，不下载视频。
- 默认隐藏 Netflix 原生字幕的视觉显示，但不删除字幕节点，仍可读取当前屏幕字幕。
- 支持实时识别当前字幕并翻译。
- 支持导入本地 `.srt` / `.vtt`，分批预翻译整集字幕并保存到 IndexedDB。
- 支持中文模式和双语模式。
- 使用内存缓存、`chrome.storage.local` 持久缓存、请求去重和过期请求保护降低重复请求。
- 原字幕真正消失后，译文会延迟约 `250–550ms` 清空；如果 Netflix 错误地持续保留旧 DOM 文本，也会在约 `8–14s` 后强制清除，避免上一句字幕一直停留。

## 0.1.84 检验与优化

- 修复“清空缓存”只清本地存储、没有清内存缓存的问题。
- 串行化持久缓存写入，避免多条翻译并发完成时互相覆盖。
- 清空缓存会使此前仍在执行的旧请求失去写缓存资格，防止缓存被异步请求重新填回。
- 预翻译续传现在同时核对 cue ID 和原文，换过字幕文件后不会误用旧译文。
- 预翻译播放按时间二分查找 cue，拖动进度和长字幕文件下的查找成本从线性扫描降为对数级。
- 新增缓存并发、字幕解析、预翻译续传和时间轴查找回归测试。

## 安装

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目文件夹：`netflix-deepseek-subtitle-translator`。
5. 修改代码后需要在扩展管理页点击“重新加载”。

## 基础使用

1. 点击插件图标，打开“设置”。
2. 填写 DeepSeek API Key。
3. 选择模型、目标语言、显示模式和字幕样式。
4. 打开 Netflix 播放页。
5. 在 Netflix 播放器中先开启英文或日文字幕。
6. 默认实时模式下，插件会读取当前显示字幕并显示中文 overlay。

## 整集预翻译

1. 在设置页或 popup 点击“打开整集预翻译”。
2. 选择本地合法来源的 `.srt` 或 `.vtt` 字幕文件。
3. 填写或确认 `videoKey`。从 Netflix 播放页打开时，默认是 `netflix-<watch id>`。
4. 点击“解析字幕”，确认条数、时长和批次数。
5. 点击“开始预翻译”。每批最多 30 条，会复用现有 `TRANSLATE_BATCH`。
6. 中途可点击“暂停”，进度会保存；再次开始会跳过已翻译 cue。
7. 在设置页把“字幕来源”切换为“本地预翻译字幕”。

预翻译模式下不会调用实时翻译 API；播放时只按 `video.currentTime + subtitleOffsetMs` 查找本地 cue 并渲染 overlay。

## 关键设置

- `hideNativeSubtitles`：默认开启。开启时隐藏 Netflix 原生字幕的视觉显示，避免重叠。
- `subtitleSourceMode`：`live` 为实时识别，`pretranslated` 为本地预翻译字幕。
- `subtitleOffsetMs`：预翻译字幕整体偏移，正数表示按更晚时间查找，负数表示提前。
- `advancedSubtitleFallback`：默认关闭。只有 Netflix timed text 容器识别不到字幕时，才建议临时打开高级 fallback。

## 验证不再重叠

1. 设置页确认“隐藏 Netflix 原生字幕”已开启。
2. 进入 Netflix 播放页并开启英文/日文字幕。
3. 正常播放时应只看到插件 overlay，不应同时看到 Netflix 原生字幕。
4. 关闭该开关后，Netflix 原生字幕会恢复，插件 overlay 会默认上移到底部约 18% 便于对照。

## 验证缓存变快

1. 播放到一句字幕，等待翻译出现。
2. 倒回让同一句再次出现。
3. 命中内存缓存或本地缓存时，overlay 应明显更快出现，并且不会重复请求 DeepSeek。

## 验证过期请求保护

1. 找一段字幕变化较快的片段。
2. 快速拖动进度条或连续快进。
3. 旧请求稍后返回时，不应覆盖当前字幕；内容脚本会用递增的 `subtitleSeq/requestSequence` 只接受当前字幕结果。

## 验证字幕正常消失

播放中观察一句字幕结束的瞬间：原字幕节点被隐藏后，插件译文应在约半秒内消失，而不是一直保留到下一句。若 Netflix 页面短暂残留上一句 DOM 文本，插件最多保留约 `8–14s`，随后清空并等待下一条不同字幕。

## 验证误识别修复

- 默认只读取 Netflix timed text 相关容器，例如 `.player-timedtext`、`.player-timedtext-text-container`、`[data-uia*="player-timedtext"]`。
- 默认不会扫描播放器中所有 `span/div/p`。
- 剧集名、菜单、按钮、进度条、设置面板、`S1 E2` 这类标题信息会被过滤，不进入缓存和 API。
- 只有打开 `advancedSubtitleFallback` 时，才启用更严格的位置和稳定性 fallback。

## 文件说明

- `manifest.json`：MV3 配置，只声明 Netflix、DeepSeek 和 storage 权限。
- `src/background.js`：设置、缓存、DeepSeek 单句/批量请求、IndexedDB 消息转发。
- `src/content-netflix.js`：Netflix 页面字幕识别、原字幕隐藏、overlay 渲染、预翻译播放同步。
- `src/overlay.css`：字幕 overlay 样式。
- `src/options.html` / `src/options.js`：设置页面。
- `src/popup.html` / `src/popup.js`：popup 状态、开关、预翻译入口。
- `src/pretranslate.html` / `src/pretranslate.js`：本地字幕导入和整集预翻译页面。
- `src/subtitle-parser.js`：SRT/VTT 解析。
- `src/pretranslated-store.js`：IndexedDB 存储整集字幕。
- `assets/icon.svg`：扩展图标。
- `tests/`：字幕识别、缓存并发、SRT/VTT 解析、预翻译续传和 text track 隐藏回归测试。

## 本地检查

在项目目录中运行 `node tests/<测试文件>.test.js` 可以执行单项回归测试；当前项目不需要安装 npm 依赖。发布前还应对 `src/*.js` 逐个执行 `node --check`，并确认 `manifest.json` 不包含 `<all_urls>`。

## 当前限制

实时模式仍然可能慢一拍，因为它必须等 Netflix 把当前字幕渲染到 DOM 后才能读取，再发起网络翻译。缓存命中会很快，但第一次出现的新句子无法彻底避免网络延迟。

彻底解决慢一拍的方向是使用整集预翻译：用户手动导入 SRT/VTT，插件先批量翻译并保存到 IndexedDB，播放时只按时间查表显示，不再等待实时 API。

## API Key 安全

API Key 只保存在本地浏览器的 `chrome.storage.local`。这适合个人自用；如果要发布给他人，应改成后端代理方案，避免把 API Key 暴露在浏览器扩展环境中。
