"use strict";

(function exposeSubtitleParser(global) {
  function parseSubtitleFile(text, fileName = "") {
    const normalized = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

    if (!normalized) {
      return [];
    }

    if (/^WEBVTT\b/i.test(normalized) || /\.vtt$/i.test(fileName)) {
      return parseVtt(normalized);
    }
    return parseSrt(normalized);
  }

  function parseSrt(text) {
    return text
      .split(/\n{2,}/)
      .map((block, index) => parseCueBlock(block, index + 1))
      .filter(Boolean);
  }

  function parseVtt(text) {
    const body = text
      .replace(/^WEBVTT[^\n]*(\n|$)/i, "")
      .split("\n")
      .filter((line) => !/^NOTE\b|^STYLE\b|^REGION\b/i.test(line.trim()))
      .join("\n")
      .trim();

    return body
      .split(/\n{2,}/)
      .map((block, index) => parseCueBlock(block, index + 1))
      .filter(Boolean);
  }

  function parseCueBlock(block, fallbackIndex) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;

    let id = String(fallbackIndex);
    let timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex < 0) return null;

    if (timeLineIndex > 0) {
      id = lines[0];
    }

    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

    const sourceText = lines
      .slice(timeLineIndex + 1)
      .map(cleanSubtitleLine)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!sourceText || isCorruptSubtitleText(sourceText)) return null;

    return {
      id,
      start,
      end,
      sourceText,
      translation: ""
    };
  }

  function parseTimestamp(value) {
    const clean = String(value || "")
      .replace(/\s+.*/, "")
      .replace(",", ".");
    const parts = clean.split(":");
    if (parts.length < 2 || parts.length > 3) return NaN;

    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    if (![hours, minutes, seconds].every(Number.isFinite)) return NaN;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function cleanSubtitleLine(line) {
    return String(line || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\{\\.*?\}/g, "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isCorruptSubtitleText(text) {
    const value = String(text || "");
    if (!value.trim()) return true;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uE000-\uF8FF]/.test(value)) return true;
    if (/\uFFFD/.test(value)) return true;
    if (/-->|WEBVTT\b/i.test(value)) return true;
    if (/\b(?:[2-9]\d|\d{3,}):[0-5]\d\b/.test(value)) return true;
    const compact = value.replace(/\s+/g, "");
    if (!compact) return true;
    const suspicious = (compact.match(/[\uFFFD\u00a4\u00c3\u00c2\u00e5\u00e6\u00e7\u00f0\u00fe\u00d0\u00de]/g) || []).length;
    const readable = (compact.match(/[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
    if (compact.length >= 8 && suspicious >= 2) return true;
    return compact.length >= 12 && suspicious / compact.length > 0.18 && readable / compact.length < 0.65;
  }

  global.NDSTSubtitleParser = {
    parseSubtitleFile,
    parseSrt,
    parseVtt,
    parseTimestamp,
    isCorruptSubtitleText
  };
})(typeof self !== "undefined" ? self : window);
