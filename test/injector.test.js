'use strict';
// Run with `npm test` (node --test). Paste mode borrows the clipboard; what the
// user had copied must come back afterwards. The SendInput helper is replaced.
require('./helpers/stubs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { clipboard } = require('electron');
const injector = require('../src/main/injector');

const sent = [];
injector._send = async (cmd) => { sent.push(`${cmd} with "${clipboard.readText()}" on the clipboard`); return ''; };
test.beforeEach(() => { sent.length = 0; });

test('paste: the transcript is pasted, then text, rich text and images are put back', async () => {
  const screenshot = { isEmpty: () => false };
  clipboard.write({ text: 'copied', html: '<b>copied</b>', rtf: '{\\rtf1 copied}', image: screenshot });
  await injector.inject('dictated text', { mode: 'paste', restoreClipboard: true });
  assert.deepEqual(sent, ['PASTE with "dictated text" on the clipboard']);
  assert.equal(clipboard.readText(), 'copied');
  assert.equal(clipboard.readHTML(), '<b>copied</b>');
  assert.equal(clipboard.readRTF(), '{\\rtf1 copied}');
  assert.equal(clipboard.readImage(), screenshot);
});

test('paste: an image copied on its own comes back', async () => {
  const screenshot = { isEmpty: () => false };
  clipboard.write({ image: screenshot });
  await injector.inject('dictated text', { mode: 'paste', restoreClipboard: true });
  assert.equal(clipboard.readImage(), screenshot);
  assert.equal(clipboard.readText(), '');
});

test('paste without restore leaves the transcript on the clipboard', async () => {
  clipboard.write({ text: 'copied', html: '<b>copied</b>' });
  await injector.inject('dictated text', { mode: 'paste', restoreClipboard: false });
  assert.equal(clipboard.readText(), 'dictated text');
  assert.equal(clipboard.readHTML(), '');
});
