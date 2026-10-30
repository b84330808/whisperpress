'use strict';
// Run with `npm test` (node --test). Forced Traditional/Simplified script and
// full-width punctuation for Chinese output.
const test = require('node:test');
const assert = require('node:assert/strict');
const zh = require('../src/main/chinese');

test('chinese: detected language, or hanzi without kana in the text', () => {
  assert.equal(zh.isChineseText('zh', ''), true);
  assert.equal(zh.isChineseText('chinese', 'hello'), true);
  // mixed Chinese/English speech is often detected as English
  assert.equal(zh.isChineseText('en', '幫我跑 pytest 然後 git commit'), true);
  assert.equal(zh.isChineseText('en', 'run pytest then git commit'), false);
  // Japanese uses hanzi too
  assert.equal(zh.isChineseText('ja', '東京駅'), false);
  assert.equal(zh.isChineseText('en', 'テストを実行して'), false);
  assert.equal(zh.isChineseText(undefined, undefined), false);
});

test('chinese: forced script and full-width punctuation after hanzi only', () => {
  assert.equal(zh.postprocessChinese('这个软件很好用,对吧?', 'traditional'), '這個軟體很好用，對吧？');
  assert.equal(zh.postprocessChinese('這個軟體很好用', 'simplified'), '这个软件很好用');
  assert.equal(zh.postprocessChinese('幫我跑 pytest,然後 git commit.', 'auto'), '幫我跑 pytest,然後 git commit.');
  assert.equal(zh.postprocessChinese('好. 開始吧!', 'auto'), '好。 開始吧！');
  assert.equal(zh.postprocessChinese('版本 1.2.3 很好...', 'auto'), '版本 1.2.3 很好...');
});
