'use strict';
// Run with `npm test` (node --test). Lines whisper invents over silence must be
// dropped from long transcriptions, while real speech stays.
const test = require('node:test');
const assert = require('node:assert/strict');
const { isHallucination } = require('../src/main/hallucinations');

test('hallucinations: known outros and subtitle credits, either script', () => {
  for (const s of [
    '請不吝點贊 訂閱 轉發 打賞支援明鏡與點點欄目',
    '请不吝点赞 订阅 转发 打赏支持明镜与点点栏目',
    '字幕由Amara.org社区提供',
    '中文字幕 by 某某',
    'Subtitles by the Amara.org community',
    'ご視聴ありがとうございました',
  ]) assert.equal(isHallucination(s), true, s);
});

test('hallucinations: real speech is kept', () => {
  for (const s of [
    '大家好，今天的會議要討論新版本的釋出時間。',
    '接下來請工程團隊報告目前的進度。',
    'Thanks for watching, see you next week.',
    'Please subscribe to the mailing list.',
    '這個字幕檔要明天交',
    '',
    undefined,
  ]) assert.equal(isHallucination(s), false, String(s));
});
