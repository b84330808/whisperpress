'use strict';
// Chinese output: forced Traditional/Simplified script and full-width punctuation.
// Pure functions only (no Electron), so `npm test` runs them under plain Node.

// Deterministic Traditional/Simplified conversion (the initial prompt only *biases*
// the script whisper picks; OpenCC guarantees it).
const occConverters = {};
function convertChinese(text, variant) {
  if (!text || variant === 'auto') return text;
  try {
    if (!occConverters[variant]) {
      const OpenCC = require('opencc-js');
      occConverters[variant] = variant === 'traditional'
        ? OpenCC.Converter({ from: 'cn', to: 'twp' })
        : OpenCC.Converter({ from: 'twp', to: 'cn' });
    }
    return occConverters[variant](text);
  } catch (e) {
    console.error('opencc failed', e.message);
    return text;
  }
}
function isChineseLang(lang) { return /^(zh|chinese)/i.test(lang || ''); }
// for streamed segments before the detected language is known: hanzi but no kana
function looksChinese(text) { return /[一-鿿]/.test(text) && !/[぀-ヿ]/.test(text); }

// Chinese mixed with English terms is often detected as "english"; the forced
// script must still apply, so also go by the text itself. Japanese uses hanzi
// too, so a transcript detected as Japanese never counts.
function isChineseText(language, text) {
  return isChineseLang(language) || (!/^(ja|japanese)/i.test(language || '') && looksChinese(text || ''));
}

// whisper emits ASCII punctuation in Chinese text; switch to full-width, but only
// after a CJK character so Latin fragments (names, code) keep theirs
function normalizeChinesePunct(text) {
  return text
    .replace(/([一-鿿])\s*,\s*/g, '$1，')
    .replace(/([一-鿿])\s*\?/g, '$1？')
    .replace(/([一-鿿])\s*!/g, '$1！')
    .replace(/([一-鿿])\s*;/g, '$1；')
    .replace(/([一-鿿])\s*\.(?=$|\s|[一-鿿])/g, '$1。');
}
function postprocessChinese(text, variant) {
  return normalizeChinesePunct(convertChinese(text, variant));
}

module.exports = {
  convertChinese,
  isChineseLang,
  looksChinese,
  isChineseText,
  normalizeChinesePunct,
  postprocessChinese,
};
