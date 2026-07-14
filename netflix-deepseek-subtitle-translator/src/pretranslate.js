"use strict";

const BATCH_SIZE = 30;

const fields = {
  subtitleFile: document.getElementById("subtitleFile"),
  videoKey: document.getElementById("videoKey"),
  targetLanguage: document.getElementById("targetLanguage"),
  model: document.getElementById("model"),
  progress: document.getElementById("progress"),
  summary: document.getElementById("summary"),
  status: document.getElementById("status")
};

let parsedCues = [];
let currentFileName = "";
let paused = false;

document.addEventListener("DOMContentLoaded", init);
document.getElementById("parseFile").addEventListener("click", parseSelectedFile);
document.getElementById("startTranslate").addEventListener("click", startPretranslation);
document.getElementById("pauseTranslate").addEventListener("click", () => {
  paused = true;
  showStatus("已请求暂停，当前批次结束后会保存进度并停止。");
});
document.getElementById("deleteSet").addEventListener("click", deleteCurrentSet);

async function init() {
  const params = new URLSearchParams(location.search);
  fields.videoKey.value = params.get("videoKey") || "";

  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (response && response.ok) {
    fields.targetLanguage.value = response.settings.targetLanguage || "zh-CN";
    fields.model.value = response.settings.model || "deepseek-v4-flash";
  }
}

async function parseSelectedFile() {
  const file = fields.subtitleFile.files && fields.subtitleFile.files[0];
  if (!file) {
    showStatus("请先选择 SRT 或 VTT 字幕文件。", true);
    return;
  }

  currentFileName = file.name;
  const text = await readSubtitleFileText(file);
  parsedCues = window.NDSTSubtitleParser.parseSubtitleFile(text, file.name);
  if (!parsedCues.length) {
    showStatus("没有解析到有效字幕。", true);
    return;
  }

  if (!fields.videoKey.value.trim()) {
    fields.videoKey.value = guessVideoKey(file.name);
  }

  fields.progress.value = 0;
  fields.summary.textContent = buildSummary(parsedCues, 0);
  showStatus("解析完成，可以开始预翻译。");
}

async function readSubtitleFileText(file) {
  const buffer = await file.arrayBuffer();
  const candidates = [];
  for (const encoding of ["utf-8", "gb18030", "shift_jis", "big5"]) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: false });
      const text = decoder.decode(buffer);
      candidates.push({ encoding, text, score: scoreDecodedSubtitleText(text) });
    } catch (error) {
      // Some Chromium builds may not expose every legacy decoder.
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? candidates[0].text : await file.text();
}

function scoreDecodedSubtitleText(text) {
  const value = String(text || "");
  if (!value.trim()) return -Infinity;
  const replacement = (value.match(/\uFFFD/g) || []).length;
  const timeLines = (value.match(/-->|(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}/g) || []).length;
  const cjk = (value.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  const suspicious = (value.match(/[\uFFFD\u00a4\u00c3\u00c2\u00e5\u00e6\u00e7\u00f0\u00fe\u00d0\u00de]/g) || []).length;
  const privateUse = (value.match(/[\uE000-\uF8FF]/g) || []).length;
  return timeLines * 8 + cjk * 0.6 + latin * 0.15 - replacement * 20 - suspicious * 1.5 - privateUse * 6;
}

async function startPretranslation() {
  if (!parsedCues.length) {
    await parseSelectedFile();
    if (!parsedCues.length) return;
  }

  const videoKey = fields.videoKey.value.trim();
  if (!videoKey) {
    showStatus("请填写视频 Key。", true);
    return;
  }

  paused = false;
  const targetLanguage = fields.targetLanguage.value;
  const model = fields.model.value;
  const existing = await chrome.runtime.sendMessage({
    type: "LOAD_PRETRANSLATED_CUES",
    query: { videoKey, targetLanguage, model }
  });

  const existingByCue = buildExistingTranslationMap(
    existing && existing.ok && Array.isArray(existing.cues) ? existing.cues : []
  );

  const workingCues = parsedCues.map((cue) => ({
    ...cue,
    translation: getReusableTranslation(cue, existingByCue) || cue.translation || ""
  }));

  let translatedCount = workingCues.filter((cue) => cue.translation).length;
  updateProgress(translatedCount, workingCues.length, workingCues);

  for (let index = 0; index < workingCues.length; index += BATCH_SIZE) {
    if (paused) break;

    const batch = workingCues.slice(index, index + BATCH_SIZE);
    const missing = batch.filter((cue) => !cue.translation);
    if (missing.length) {
      showStatus(`正在翻译 ${index + 1}-${Math.min(index + BATCH_SIZE, workingCues.length)} / ${workingCues.length}`);
      const response = await chrome.runtime.sendMessage({
        type: "TRANSLATE_BATCH",
        items: missing.map((cue) => ({ id: cue.id, text: cue.sourceText })),
        options: { targetLanguage, model }
      });

      if (!response || !response.ok) {
        showStatus(response && response.error ? response.error : "批量翻译失败", true);
        return;
      }

      const translatedById = new Map(response.items.map((item) => [String(item.id), item.text]));
      for (const cue of missing) {
        cue.translation = translatedById.get(String(cue.id)) || cue.translation || "";
      }
      translatedCount = workingCues.filter((cue) => cue.translation).length;
    }

    await saveCues(videoKey, targetLanguage, model, workingCues);
    updateProgress(translatedCount, workingCues.length, workingCues);
  }

  parsedCues = workingCues;
  await saveCues(videoKey, targetLanguage, model, workingCues);
  updateProgress(workingCues.filter((cue) => cue.translation).length, workingCues.length, workingCues);
  showStatus(paused ? "已暂停，进度已保存。再次开始会跳过已翻译字幕。" : "整集预翻译完成。");
}

async function saveCues(videoKey, targetLanguage, model, cues) {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_PRETRANSLATED_CUES",
    payload: {
      videoKey,
      fileName: currentFileName,
      targetLanguage,
      model,
      cues
    }
  });
  if (!response || !response.ok) {
    throw new Error(response && response.error ? response.error : "保存预翻译字幕失败");
  }
}

function buildExistingTranslationMap(cues) {
  const entries = new Map();
  for (const cue of cues || []) {
    const id = String(cue.cueId || cue.id || "");
    const translation = String(cue.translation || "").trim();
    if (!id || !translation) continue;
    entries.set(id, {
      sourceText: normalizeCueSourceText(cue.sourceText || cue.text),
      translation
    });
  }
  return entries;
}

function getReusableTranslation(cue, existingByCue) {
  const existing = existingByCue.get(String(cue && cue.id || ""));
  if (!existing) return "";
  return existing.sourceText === normalizeCueSourceText(cue && (cue.sourceText || cue.text))
    ? existing.translation
    : "";
}

function normalizeCueSourceText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function deleteCurrentSet() {
  const videoKey = fields.videoKey.value.trim();
  if (!videoKey) {
    showStatus("请先填写要删除的视频 Key。", true);
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "DELETE_PRETRANSLATED_CUES",
    query: {
      videoKey,
      targetLanguage: fields.targetLanguage.value,
      model: fields.model.value
    }
  });
  if (!response || !response.ok) {
    showStatus("删除失败。", true);
    return;
  }
  fields.progress.value = 0;
  showStatus("已删除当前字幕集。");
}

function buildSummary(cues, translatedCount = 0) {
  const duration = cues.reduce((max, cue) => Math.max(max, cue.end || 0), 0);
  return [
    `字幕条数：${cues.length}`,
    `视频 Key：${fields.videoKey.value || "未填写"}`,
    `总时长：${formatDuration(duration)}`,
    `预计批次：${Math.ceil(cues.length / BATCH_SIZE)}`,
    `已翻译：${translatedCount}/${cues.length}`
  ].join("\n");
}

function updateProgress(done, total, cues = parsedCues) {
  fields.progress.max = total || 100;
  fields.progress.value = done;
  fields.summary.textContent = cues.length ? buildSummary(cues, done) : "";
}

function showStatus(message, isError = false) {
  fields.status.textContent = message;
  fields.status.classList.toggle("error", isError);
}

function guessVideoKey(fileName) {
  return String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
