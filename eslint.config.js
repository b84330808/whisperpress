'use strict';
// `npm run lint`. ESLint's recommended rules; the app runs in three places:
// Electron's main process (Node), the renderer pages (browser) and an audio worklet.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'release/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: globals.node },
    rules: {
      // full-width spaces (U+3000) and the BOM are matched on purpose in CJK text
      'no-irregular-whitespace': ['error', { skipRegExps: true, skipTemplates: true }],
    },
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['src/renderer/common/pcm-worklet.js'],
    languageOptions: { globals: globals.audioWorklet },
  },
];
