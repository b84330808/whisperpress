<p align="center">
  <img src="assets/icon.png" width="96" alt="WhisperPress icon" />
</p>

<h1 align="center">WhisperPress</h1>

<p align="center">
  <b>Hold a key. Speak. Your words appear — in any app.</b><br/>
  Fully offline voice typing &amp; voice notes for Windows, powered by <a href="https://github.com/ggml-org/whisper.cpp">whisper.cpp</a>.
</p>

<p align="center">
  <a href="README.zh-Hant.md">繁體中文</a> · English
</p>

---

## Why WhisperPress?

Press and hold a hotkey (default **F9**), talk, release — your speech is transcribed locally and typed straight into whatever app your cursor is in: your editor, browser, chat, terminal. Every dictation is also saved as a searchable note.

- **100% offline.** Audio never leaves your PC. No account, no cloud, no telemetry.
- **Works everywhere.** A true global hotkey + simulated paste/typing — VS Code, Word, Slack, anything.
- **More than dictation.** Import audio files, record meetings (system audio), summarize and ask questions with a local LLM.

## Features

| | |
|---|---|
| 🎙 **Push-to-talk dictation** | Hold to talk, or quick-tap to lock recording. Toggle mode available. |
| ⌨️ **Types into any app** | Pastes at the cursor (clipboard is restored), or types character-by-character. |
| 📝 **Notes history** | Every dictation/transcription saved locally as a note. Search, edit, copy. |
| 📂 **Audio file import** | MP3, M4A, WAV, OGG, FLAC… with live streaming output while transcribing. |
| 🖥 **Meeting recording** | Captures system audio (Teams / Meet / Zoom) + your mic, transcribes locally. |
| 🌍 **100+ languages** | Whisper multilingual models, auto-detect or fixed language, optional translate-to-English. |
| 🈶 **Traditional/Simplified Chinese** | Deterministic OpenCC conversion of Chinese output — no model roulette. |
| ✦ **AI summaries & Q&A** | Optional. Point it at any OpenAI-compatible endpoint — e.g. local [Ollama](https://ollama.com) to stay offline. |
| ⏱ **Timestamped export** | Export notes as `.txt`, `.md`, or `.srt` subtitles. |
| 🔒 **Private by architecture** | Models run on your CPU/GPU via whisper.cpp. Notes are plain JSON on your disk. |
| 🪶 **Custom vocabulary** | Initial-prompt hints for names, jargon, and output style (e.g. Traditional Chinese). |

## Download

Grab the latest build from the **[Releases page](https://github.com/b84330808/whisperpress/releases/latest)**:

- `WhisperPress-Setup-x.x.x.exe` — installer (recommended, creates a desktop shortcut)
- `WhisperPress-Portable-x.x.x.exe` — portable, just download and run

> Windows SmartScreen may warn on first run (the binaries are not code-signed). Click **More info → Run anyway**. All source code is public here — review it or build it yourself.

## Getting started

### Run from source

Requires [Node.js](https://nodejs.org) 20+ on Windows 10/11.

```powershell
git clone https://github.com/b84330808/whisperpress.git
cd whisperpress
npm install
npm start
```

On first run, WhisperPress downloads the whisper.cpp engine (~16 MB, [v1.8.6 release binaries](https://github.com/ggml-org/whisper.cpp/releases)) and the model you pick. Everything after that is offline.

### Build the installer

```powershell
npm run dist     # NSIS installer + portable exe in release/
```

## Models

Downloaded on demand from [Hugging Face (ggerganov/whisper.cpp)](https://huggingface.co/ggerganov/whisper.cpp):

| Model | Size | Best for |
|---|---|---|
| tiny / base | 78–148 MB | quick drafts, fast CPUs not required |
| small | 488 MB | good general balance |
| **large-v3-turbo (q5_0)** | **574 MB** | **recommended — best speed/accuracy** |
| medium q5_0 / large-v3 q5_0 | 539 MB – 1.1 GB | maximum accuracy |

NVIDIA GPU? Switch *Settings → Compute* to **CUDA** for a much faster engine build.

## Tips

- **Traditional Chinese output**: pick *Settings → Transcription → Chinese output script → Force Traditional* for a guaranteed script (OpenCC); a vocabulary hint like `以下是繁體中文的逐字稿：` further improves word choice.
- **Tap to lock**: quick-tap the hotkey to keep recording hands-free; press it again to finish. `Esc` cancels.
- **AI features**: install [Ollama](https://ollama.com), `ollama pull qwen3:4b`, then enable AI in Settings with the default base URL `http://localhost:11434/v1`.

## How it works

- [Electron](https://electronjs.org) UI; no heavyweight frameworks — plain HTML/CSS/JS.
- [uiohook-napi](https://github.com/SnosMe/uiohook-napi) for the global push-to-talk hook (prebuilt, no compiler needed).
- Mic/system audio captured via WebAudio at 16 kHz mono, encoded to WAV.
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) `whisper-server` kept warm for instant dictation; `whisper-cli` streams long files segment-by-segment.
- Text injection via Win32 `SendInput` (Ctrl+V paste with clipboard restore, or per-character Unicode typing) through a tiny persistent PowerShell helper — no native module compilation anywhere.
- Notes are one JSON file each in `%APPDATA%\WhisperPress\notes`.

## Privacy

Your audio is processed in-memory and (optionally) stored **only** on your disk. The app talks to the network exclusively to download engine/model files at setup, and — only if you enable AI features — to the endpoint *you* configure.

## Roadmap

- [ ] SenseVoice / Parakeet engines (sherpa-onnx) for even faster CJK transcription
- [ ] Streaming (real-time) dictation preview
- [ ] VAD-based auto-stop
- [ ] Per-app vocabulary profiles
- [ ] Installer code signing

## License

[MIT](LICENSE)
