'use strict';
// Run with `npm test` (node --test). Covers the pure coding-mode logic; the
// Electron, whisper and SendInput parts are exercised by running the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const coding = require('../src/main/coding');

const DEFAULTS = coding.parseVocabulary(coding.DEFAULT_VOCABULARY);
const fix = (text, vocab = DEFAULTS) => coding.postprocessCoding(text, vocab);

test('coding apps: terminals and editors by process name, any case, with or without .exe', () => {
  for (const name of ['WindowsTerminal', 'WindowsTerminal.exe', 'Code', 'code.exe', 'Cursor', 'pwsh', 'C:\\Windows\\System32\\cmd.exe', 'idea64']) {
    assert.equal(coding.isCodingApp(name), true, name);
  }
  for (const name of ['chrome', 'slack', 'WINWORD', 'notepad', '', undefined]) {
    assert.equal(coding.isCodingApp(name), false, String(name));
  }
});

test('coding apps: user-added names count too', () => {
  assert.equal(coding.isCodingApp('Claude', 'claude, obsidian.exe'), true);
  assert.equal(coding.isCodingApp('Obsidian', 'claude, obsidian.exe'), true);
  assert.equal(coding.isCodingApp('Slack', 'claude, obsidian.exe'), false);
});

test('mode: off never, on always, auto only in coding apps', () => {
  assert.equal(coding.shouldUseCodingMode('off', 'WindowsTerminal'), false);
  assert.equal(coding.shouldUseCodingMode('on', 'slack'), true);
  assert.equal(coding.shouldUseCodingMode('auto', 'WindowsTerminal'), true);
  assert.equal(coding.shouldUseCodingMode('auto', 'slack'), false);
  assert.equal(coding.shouldUseCodingMode('auto', ''), false);
});

test('vocabulary: terms, comments and spoken => written replacements', () => {
  const v = coding.parseVocabulary('pytest, kubectl\n# comment\n\nuseEffect\ncube control, kube cuddle => kubectl\n派測試 → pytest');
  assert.deepEqual(v.terms, ['pytest', 'kubectl', 'useEffect']);
  assert.deepEqual(v.replacements, [
    { from: 'cube control', to: 'kubectl' },
    { from: 'kube cuddle', to: 'kubectl' },
    { from: '派測試', to: 'pytest' },
  ]);
});

test('code terms come out spelled the way they are typed', () => {
  assert.equal(fix('幫我跑 Pytest，然後看 use effect 的 bug。'), '幫我跑 pytest，然後看 useEffect 的 bug');
  assert.equal(fix('node js and type script'), 'Node.js and TypeScript');
  assert.equal(fix('pnpm install and NPM run build'), 'pnpm install and npm run build');
  assert.equal(fix('push it to git hub'), 'push it to GitHub');
  assert.equal(fix('用 cube control get pods'), '用 kubectl get pods');
  assert.equal(fix('Pie test を実行して'), 'pytest を実行して');
  assert.equal(fix('幫我跑 p-test'), '幫我跑 pytest');
});

test('a term never matches inside a longer word', () => {
  assert.equal(fix('pnpm and npmrc'), 'pnpm and npmrc');
  assert.equal(fix('gitignore'), 'gitignore');
});

test('paths, URLs, e-mail and flags are left alone', () => {
  const v = coding.parseVocabulary('JSON, GitHub, useEffect');
  assert.equal(fix('open package.json', v), 'open package.json');
  assert.equal(fix('see https://github.com/b84330808 now', v), 'see https://github.com/b84330808 now');
  assert.equal(fix('mail me@github.io', v), 'mail me@github.io');
  assert.equal(fix('pass --use-effect', v), 'pass --use-effect');
  assert.equal(fix('edit src\\useeffect.ts', v), 'edit src\\useeffect.ts');
  assert.equal(fix('print the Json', v), 'print the JSON');
});

test('replacement text is inserted literally', () => {
  const v = coding.parseVocabulary('home dir => $HOME');
  assert.equal(fix('cd home dir', v), 'cd $HOME');
});

test('short terms stay prompt-only so ordinary words keep their case', () => {
  const v = coding.parseVocabulary('Go, C');
  assert.equal(fix('go ahead and c the result', v), 'go ahead and c the result');
});

test('trailing period is dropped, other punctuation kept', () => {
  assert.equal(fix('git status.'), 'git status');
  assert.equal(fix('跑測試。'), '跑測試');
  assert.equal(fix('テストを実行して。'), 'テストを実行して');
  assert.equal(fix('wait...'), 'wait...');
  assert.equal(fix('is it green?'), 'is it green?');
  assert.equal(fix('first. second'), 'first. second');
});

test('prompt: style sentence for the UI language, then as many terms as fit', () => {
  const zh = coding.buildCodingPrompt({ locale: 'zh-Hant', vocabulary: 'pytest, kubectl' });
  assert.equal(zh, `${coding.STYLE_HINTS['zh-Hant']} pytest, kubectl.`);
  const ja = coding.buildCodingPrompt({ locale: 'ja', basePrompt: 'はい。', vocabulary: 'useEffect' });
  assert.equal(ja, `はい。 ${coding.STYLE_HINTS.ja} useEffect.`);
  assert.equal(coding.buildCodingPrompt({ locale: 'xx' }), coding.STYLE_HINTS.en);
});

test('prompt: stays inside the whisper prompt budget', () => {
  const many = Array.from({ length: 400 }, (_, i) => `term${i}`).join(', ');
  const p = coding.buildCodingPrompt({ locale: 'zh-Hant', basePrompt: '你好，準備好了嗎？嗯，我們開始吧。', vocabulary: many });
  assert.ok(coding.estimateTokens(p) <= coding.PROMPT_TOKEN_BUDGET, `${coding.estimateTokens(p)} tokens`);
  assert.ok(p.includes('term0'));
  assert.ok(!p.includes('term399'));
});

test('default vocabulary prompt fits whole', () => {
  const p = coding.buildCodingPrompt({ locale: 'zh-Hant', basePrompt: '你好，準備好了嗎？嗯，我們開始吧。', vocabulary: coding.DEFAULT_VOCABULARY });
  for (const t of DEFAULTS.terms) assert.ok(p.includes(t), t);
});
