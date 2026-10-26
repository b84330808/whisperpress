'use strict';
// Coding mode: dictation tuned for terminals, code editors and AI coding
// prompts (Claude Code, Copilot Chat…). Mixed zh/ja/en speech is steered with
// a mixed-language initial prompt plus the user's code vocabulary, and the
// transcript is fixed up so code terms come out spelled the way they are typed.
// Pure functions only (no Electron), so `npm test` runs them under plain Node.

// Process names (without .exe, lower-case) that count as "coding apps" for
// the Auto setting: terminals, editors and IDEs.
const DEFAULT_CODING_APPS = [
  // terminals
  'windowsterminal', 'openconsole', 'conhost', 'cmd', 'powershell', 'pwsh',
  'wezterm-gui', 'alacritty', 'hyper', 'tabby', 'mintty', 'warp', 'kitty',
  // editors / IDEs
  'code', 'code - insiders', 'cursor', 'windsurf', 'zed', 'devenv',
  'idea64', 'pycharm64', 'webstorm64', 'goland64', 'rider64', 'clion64', 'phpstorm64', 'rubymine64',
  'studio64', 'sublime_text', 'notepad++', 'nvim-qt', 'neovide', 'gvim',
];

// Prefilled in Settings so the format is obvious; the user edits it freely.
const DEFAULT_VOCABULARY = [
  'pytest, kubectl, useEffect, useState, npm, npx, pnpm, git, GitHub, TypeScript, JavaScript, Node.js',
  'Claude Code, README, localhost, async, await, refactor, commit, rebase, merge, pull request',
  '# spoken form => written form',
  'cube control, kube control => kubectl',
  'pie test, p test => pytest',
].join('\n');

// A sample sentence in the user's language with code terms left in English.
// Whisper continues the prompt's style, so this keeps English terms in Latin
// script inside Chinese/Japanese speech and keeps punctuation on.
const STYLE_HINTS = {
  'zh-Hant': '好，先用 pytest 跑測試，再 git commit 然後 push。',
  ja: 'はい、pytest でテストを実行して、git commit してから push します。',
  en: 'OK, run pytest first, then git commit and push.',
};

// whisper.cpp keeps at most n_text_ctx / 2 = 224 prompt tokens and drops the
// oldest ones beyond that. Stay under it so the vocabulary isn't cut.
const PROMPT_TOKEN_BUDGET = 200;

const ASCII_WORD = 'A-Za-z0-9_';
const HAS_CJK = /[　-鿿가-힯＀-￯]/;

function normalizeAppName(name) {
  return String(name || '').trim().replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
}

function parseAppList(text) {
  return String(text || '').split(/[,;\n]/).map(normalizeAppName).filter(Boolean);
}

function isCodingApp(processName, extraApps = '') {
  const name = normalizeAppName(processName);
  if (!name) return false;
  return DEFAULT_CODING_APPS.includes(name) || parseAppList(extraApps).includes(name);
}

// mode: 'off' | 'on' | 'auto'
function shouldUseCodingMode(mode, processName, extraApps = '') {
  if (mode === 'on') return true;
  if (mode === 'auto') return isCodingApp(processName, extraApps);
  return false;
}

// One entry per line or comma-separated; `#` starts a comment line.
//   pytest, useEffect                -> terms
//   cube control, kube cuddle => kubectl   -> replacements (and kubectl is a term)
function parseVocabulary(text) {
  const terms = [];
  const replacements = [];
  const addTerm = (t) => { if (t && !terms.includes(t)) terms.push(t); };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const arrow = line.match(/^(.*?)\s*(?:=>|→)\s*(.+)$/);
    if (arrow) {
      const to = arrow[2].trim();
      for (const from of arrow[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        replacements.push({ from, to });
      }
      addTerm(to);
      continue;
    }
    for (const t of line.split(',').map((s) => s.trim())) addTerm(t);
  }
  return { terms, replacements };
}

// Rough whisper (GPT-2 BPE) token count: ~3 ASCII chars per token, and a CJK
// character is 3 UTF-8 bytes, often 2 tokens. Errs on the high side.
function estimateTokens(s) {
  let n = 0;
  for (const ch of String(s)) n += ch.charCodeAt(0) < 128 ? 1 / 3 : 2;
  return Math.ceil(n);
}

function buildCodingPrompt({ basePrompt = '', locale = 'en', vocabulary = '' } = {}) {
  const head = [String(basePrompt).trim(), STYLE_HINTS[locale] || STYLE_HINTS.en].filter(Boolean).join(' ');
  const { terms } = parseVocabulary(vocabulary);
  const kept = [];
  for (const t of terms) {
    if (estimateTokens(`${head} ${[...kept, t].join(', ')}.`) > PROMPT_TOKEN_BUDGET) break;
    kept.push(t);
  }
  return kept.length ? `${head} ${kept.join(', ')}.` : head;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "useEffect" -> use, Effect; "Node.js" -> Node, js; "GitHub Actions" -> Git, Hub, Actions
function splitTermParts(term) {
  return term
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean);
}

// Matches the spoken/mis-cased variants of an ASCII term: any case, and the
// parts joined by nothing, a space, a dot, a dash or an underscore. Bounded by
// non-word characters, so "npm" never matches inside "pnpm". Words that are
// part of a path, URL, e-mail or CLI flag (package.json, github.com/…,
// --use-effect) are left alone.
function termRegex(term) {
  const parts = splitTermParts(term).map(escapeRe);
  const before = `(?<![${ASCII_WORD}./\\\\@:-])`;
  const after = `(?![${ASCII_WORD}/\\\\@-])(?![.:][${ASCII_WORD}/])`;
  return new RegExp(`${before}${parts.join('[\\s._-]?')}${after}`, 'gi');
}

function spokenRegex(from) {
  if (HAS_CJK.test(from)) return new RegExp(from.split(/\s+/).map(escapeRe).join('\\s*'), 'g');
  const words = from.split(/\s+/).map(escapeRe);
  return new RegExp(`(?<![${ASCII_WORD}])${words.join('[\\s-]*')}(?![${ASCII_WORD}])`, 'gi');
}

function applyVocabulary(text, vocabulary) {
  const vocab = typeof vocabulary === 'string' ? parseVocabulary(vocabulary) : vocabulary;
  let out = String(text || '');
  for (const { from, to } of vocab.replacements) {
    out = out.replace(spokenRegex(from), () => to);
  }
  // Longest first, so "GitHub Actions" wins over "GitHub". Terms shorter than
  // 3 letters ("Go", "C") would re-case ordinary words; they stay prompt-only.
  const fixable = vocab.terms
    .filter((t) => !HAS_CJK.test(t) && t.replace(/[^A-Za-z0-9]/g, '').length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const term of fixable) {
    out = out.replace(termRegex(term), () => term);
  }
  return out;
}

// A sentence-final period breaks a shell command ("git status." ) and is noise
// in a chat prompt. An ellipsis is kept.
function stripTrailingPeriod(text) {
  return String(text || '').replace(/(?<![.。．])[.。．]\s*$/, '').trimEnd();
}

function postprocessCoding(text, vocabulary) {
  return stripTrailingPeriod(applyVocabulary(text, vocabulary)).trim();
}

module.exports = {
  DEFAULT_CODING_APPS,
  DEFAULT_VOCABULARY,
  STYLE_HINTS,
  PROMPT_TOKEN_BUDGET,
  normalizeAppName,
  isCodingApp,
  shouldUseCodingMode,
  parseVocabulary,
  estimateTokens,
  buildCodingPrompt,
  applyVocabulary,
  stripTrailingPeriod,
  postprocessCoding,
};
