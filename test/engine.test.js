'use strict';
// Run with `npm test` (node --test). The whisper server lifecycle without a real
// server, and the parsing of whisper-cli output for imported files and meetings.
require('./helpers/stubs');
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/main/engine');

// Stands in for the real loader: each start() leaves the server "starting"
// until the test finishes or fails that load.
function fakeLoads() {
  const loads = [];
  engine._start = () => {
    engine._setState('starting', 'base');
    return new Promise((resolve) => {
      loads.push({
        ready: () => { engine._setState('ready', 'base'); resolve(true); },
        superseded: () => resolve(false),
      });
    });
  };
  return loads;
}

test('engine: a server still loading its model is waited for, not restarted', async () => {
  const loads = fakeLoads();
  engine.start(); // e.g. at launch
  // dictation and live meeting captions both arrive while the model loads
  const waits = [engine.ensureReady(), engine.ensureReady()];
  await new Promise((r) => setImmediate(r));
  assert.equal(loads.length, 1, 'the load in progress was restarted');
  loads[0].ready();
  assert.deepEqual(await Promise.all(waits), [true, true]);
  assert.equal(loads.length, 1);
  assert.equal(await engine.ensureReady(), true);
  assert.equal(loads.length, 1);
});

test('engine: a stopped server is started, and a load replaced by a newer one is followed', async () => {
  const loads = fakeLoads();
  engine._setState('stopped');
  const wait = engine.ensureReady();
  assert.equal(loads.length, 1);
  engine.start(); // settings changed mid-load: a newer load replaces it
  loads[0].superseded();
  loads[1].ready();
  assert.equal(await wait, true);
  assert.equal(loads.length, 2);
});

const cliJson = (language, texts) => ({
  result: { language },
  transcription: texts.map((text, i) => ({ offsets: { from: i * 1000, to: i * 1000 + 900 }, text: ` ${text}` })),
});

test('file transcripts: forced Chinese script also when mixed speech is detected as English', () => {
  const r = engine.parseCliOutput(cliJson('en', ['我们用 pytest 跑测试,', '然后 git push']), 'auto', 'traditional');
  assert.equal(r.language, 'en');
  assert.deepEqual(r.segments.map((s) => s.text), ['我們用 pytest 跑測試，', '然後 git push']);
  assert.equal(r.text, '我們用 pytest 跑測試，\n然後 git push');
  assert.deepEqual([r.segments[1].t0, r.segments[1].t1], [1000, 1900]);
});

test('file transcripts: English and Japanese are left alone, invented lines dropped', () => {
  const en = engine.parseCliOutput(cliJson('en', ['Hello there, team.', 'Subtitles by the Amara.org community']), 'auto', 'traditional');
  assert.deepEqual(en.segments.map((s) => s.text), ['Hello there, team.']);
  const ja = engine.parseCliOutput(cliJson('ja', ['東京駅', 'ご視聴ありがとうございました']), 'auto', 'simplified');
  assert.deepEqual(ja.segments.map((s) => s.text), ['東京駅']);
  assert.equal(engine.parseCliOutput({}, 'zh', 'auto').language, 'zh');
});
