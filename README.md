<p align="center">
  <img src="assets/icon.png" width="96" alt="WhisperPress icon" />
</p>

<h1 align="center">WhisperPress</h1>

<p align="center">
  <b>Hold a key. Speak. Your words appear — in any app.</b><br/>
  Free, fully offline push-to-talk voice typing &amp; voice notes for Windows, powered by <a href="https://github.com/ggml-org/whisper.cpp">whisper.cpp</a>.
</p>

<p align="center">
  <a href="https://github.com/b84330808/whisperpress/releases/latest"><img src="https://img.shields.io/github/v/release/b84330808/whisperpress" alt="Latest release" /></a>
  <a href="https://github.com/b84330808/whisperpress/actions/workflows/ci.yml"><img src="https://github.com/b84330808/whisperpress/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6" alt="Windows 10 | 11" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/b84330808/whisperpress" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="README.zh-Hant.md">繁體中文</a> · English · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <img src="assets/demo.gif" width="850" alt="WhisperPress demo — dictating Chinese, English and Japanese into Notepad" />
</p>

<p align="center">🔊 <b>Full demo with real voice</b> — Chinese, English and Japanese dictated into Notepad:</p>

https://github.com/user-attachments/assets/8db4657f-edae-42f2-b6db-351bb214fe22

<!--
  Screenshots to add (none exist yet; the GIF above only shows dictation into Notepad).
  Capture at 100% display scaling, about 1100 px wide:
  1. assets/screenshot-coding.png: Windows Terminal running Claude Code, the recording pill
     showing the "</> code" badge, and a mixed-language prompt such as
     "幫我跑 pytest，然後 git commit" already typed at the prompt.
  2. assets/screenshot-meeting.png: the Meeting view during a recording, with live captions
     scrolling in the transcript box.
  3. assets/screenshot-notes.png: the Notes view with a few dictations, one note open, and
     its AI summary shown (only if AI is set up; otherwise leave the summary out).
  Then replace this comment with:
  <p align="center">
    <img src="assets/screenshot-coding.png" width="32%" alt="Coding mode in Windows Terminal" />
    <img src="assets/screenshot-meeting.png" width="32%" alt="Live captions while recording a meeting" />
    <img src="assets/screenshot-notes.png" width="32%" alt="Notes history" />
  </p>
-->

---

## Quick start

1. Download **`WhisperPress-Setup-x.x.x.exe`** from the [latest release](https://github.com/b84330808/whisperpress/releases/latest) and run it.
   Windows SmartScreen may warn because the installer isn't code-signed: click **More info → Run anyway**.
2. On first launch, WhisperPress downloads the whisper.cpp engine (~16 MB) and lets you pick a model. The recommended **large-v3-turbo-q5_0** is a 574 MB download. This is the only step that needs the internet.
3. Click into any text box, **hold F9, speak, and release**. The text is typed at your cursor and saved as a note.

Tap F9 instead of holding it to record hands-free, then press it again to finish. `Esc` cancels. The hotkey can be changed in *Settings → Dictation*.

## Why WhisperPress?

Press and hold a hotkey (default **F9**), talk, release — your speech is transcribed locally and typed straight into whatever app your cursor is in: your editor, browser, chat, terminal. Every dictation is also saved as a searchable note.

- **100% offline.** Audio never leaves your PC. No account, no cloud, no telemetry.
- **Works everywhere.** A true global hotkey + simulated paste/typing — VS Code, Word, Slack, anything.
- **More than dictation.** Import audio files, record meetings (system audio), summarize and ask questions with a local LLM.

## Features

| | |
|---|---|
| 🎙 **Push-to-talk dictation** | Hold to talk, or quick-tap to lock recording. Toggle mode available. |
| ⌨️ **Types into any app** | Pastes at the cursor (your clipboard, including images and formatted text, is restored), or types character-by-character. |
| 📝 **Notes history** | Every dictation/transcription saved locally as a note. Search, edit, copy. |
| 📂 **Audio file import** | MP3, M4A, WAV, OGG, FLAC… with live streaming output while transcribing. |
| 🖥 **Meeting recording** | Records system audio (Teams / Meet / Zoom, videos…) with or without your mic, shows live captions while recording, then transcribes the whole recording locally. |
| 🌍 **99 languages** | Whisper multilingual models, auto-detect or fixed language, optional translate-to-English. |
| 🈶 **Traditional/Simplified Chinese** | Deterministic OpenCC conversion of Chinese output — no model roulette. |
| ✦ **AI summaries & Q&A** | Optional. Point it at any OpenAI-compatible endpoint — e.g. local [Ollama](https://ollama.com) to stay offline. |
| ⏱ **Timestamped export** | Export notes as `.txt`, `.md`, or `.srt` subtitles. |
| 🔒 **Private by architecture** | Models run on your CPU/GPU via whisper.cpp. Notes are plain JSON on your disk. |
| 🪶 **Custom vocabulary** | Initial-prompt hints for names, jargon, and output style. |
| 🧑‍💻 **Coding mode** | Dictate into Windows Terminal, VS Code or Claude Code: mixed Chinese/Japanese/English speech, a code vocabulary (`use effect` → `useEffect`), and Enter only if you want it. |
| 💻 **Hardware-aware setup** | Detects your CPU / RAM / NVIDIA GPU and applies the best engine + model in one click. |

## Coding mode

For talking to a terminal, an editor or an AI coding agent such as Claude Code. Turn it on in *Settings → Coding mode*, or from the tray menu:

- **Auto**: on whenever the window you're dictating into is a terminal or code editor (Windows Terminal, PowerShell, cmd, VS Code, Cursor, Windsurf, JetBrains IDEs, Android Studio, Visual Studio, Sublime Text, WezTerm, Alacritty…). Add other apps by process name, e.g. `Claude`.
- **Always on**, or **Off** (the default).

What changes while it's on (the overlay shows a `</> code` badge):

- **Mixed languages.** Whisper gets a sample sentence in your UI language with English code terms in it, so "幫我跑 pytest，然後 git commit" or "npm install してから" keep the English words in Latin script.
- **Code vocabulary.** A list of terms you say (`pytest, kubectl, useEffect, …`) biases Whisper toward those spellings and fixes case and spacing afterwards: `Pytest` → `pytest`, `use effect` → `useEffect`, `node js` → `Node.js`. Lines like `cube control => kubectl` replace what Whisper heard with what you meant. Paths, URLs and flags (`package.json`, `github.com/…`, `--use-effect`) are left alone.
- **No sentence-final period**, so `git status` doesn't arrive as `git status.`.
- **Enter is up to you.** By default the text is inserted and you press Enter after checking it. Turn on *Press Enter after inserting* to run the command or send the prompt hands-free.

Still fully offline: the vocabulary is only a prompt for the local model. Terminals running as administrator can't receive input from a normal app (a Windows rule); run WhisperPress as admin too if you need that.

## Requirements

- **Windows 10 or 11, 64-bit (x64).** macOS and Linux are not supported (see the [FAQ](#faq)).
- **Memory and disk** depend on the model: from ~0.4 GB of RAM and 78 MB of disk for `tiny` to ~1.5 GB and 574 MB for the recommended model (table below), plus the 16 MB engine.
- **A microphone** for dictation. Meeting recording also works with system audio only.
- **Optional:** an NVIDIA GPU for the CUDA engine (a ~440 MB download instead of 16 MB). Other GPUs are not used; the CPU engine runs everywhere.
- **Internet** only for the first download of the engine (GitHub) and models (Hugging Face), and for the optional AI features if you point them at a server outside your PC.

## Download

Grab the latest build from the **[Releases page](https://github.com/b84330808/whisperpress/releases/latest)**:

- `WhisperPress-Setup-x.x.x.exe` — installer (recommended, creates a desktop shortcut)
- `WhisperPress-Portable-x.x.x.exe` — portable, just download and run

> Windows SmartScreen may warn on first run (the binaries are not code-signed). Click **More info → Run anyway**. All source code is public here — review it or build it yourself.

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

Downloaded on demand from [Hugging Face (ggerganov/whisper.cpp)](https://huggingface.co/ggerganov/whisper.cpp). RAM figures are the app's own rough estimates.

| Model | Download | RAM | Best for |
|---|---|---|---|
| tiny | 78 MB | ~0.4 GB | quick drafts on any PC |
| base | 148 MB | ~0.5 GB | fast, older PCs |
| small | 488 MB | ~1.0 GB | good general balance |
| medium-q5_0 | 539 MB | ~1.2 GB | higher accuracy |
| **large-v3-turbo-q5_0** | **574 MB** | **~1.5 GB** | **recommended — best speed/accuracy** |
| large-v3-turbo | 1.6 GB | ~2.5 GB | turbo without quantization |
| large-v3-q5_0 | 1.1 GB | ~2.5 GB | maximum accuracy, slowest |

Not sure? *Settings → Models & engine → Hardware recommendation* picks an engine and model for your PC and applies them in one click. NVIDIA GPU? Switch *Settings → Models & engine → Compute* to **CUDA** for a much faster engine build.

## Tips

- **Traditional Chinese output**: pick *Settings → Transcription → Chinese output script → Force Traditional* for a guaranteed script (OpenCC); a vocabulary hint like `以下是繁體中文的逐字稿：` further improves word choice.
- **Tap to lock**: quick-tap the hotkey to keep recording hands-free; press it again to finish. `Esc` cancels.
- **AI features**: install [Ollama](https://ollama.com), `ollama pull qwen3:4b`, then enable AI in Settings with the default base URL `http://localhost:11434/v1`.

## Limitations

- **Windows only**, x64.
- **Text appears after you release the key**, not while you speak. Longer dictations take longer to transcribe; how long depends on your CPU/GPU and the model.
- **Apps running as administrator** can't receive typed or pasted text from a normal app (a Windows rule). Run WhisperPress as administrator if you need to dictate into them.
- **Paste mode borrows the clipboard** for a moment. Text, formatted text and images you had copied are put back; copied files are not. Use *Insert text by → Typing each character* to leave the clipboard alone.
- **Meeting recording captures everything your PC plays**, not a single app. It records through Windows' screen-sharing audio; the screen image is discarded.
- **Whisper can mishear**, and over silence or music it sometimes invents text (video outros, subtitle credits). WhisperPress drops the common invented lines but can't catch everything.
- **No auto-update.** New versions are published on the [Releases page](https://github.com/b84330808/whisperpress/releases); *Watch → Custom → Releases* on GitHub notifies you.
- **The installers are not code-signed**, so SmartScreen warns on first run.

## FAQ

**Is it really offline?**
After the one-time download of the engine and model, yes: recording, transcription and notes all stay on your PC, and dictation works with the network unplugged. The only other network use is the optional AI feature, which talks to the endpoint *you* configure (Ollama or LM Studio keep that on your PC too).

**Which model should I choose?**
Start with `large-v3-turbo-q5_0`. If transcription feels slow on an older PC, try `small` or `base`. The hardware recommendation in *Settings → Models & engine* suggests one for your machine.

**Can I change the hotkey?**
Yes, in *Settings → Dictation*. Any key or combination works, including a modifier on its own such as Right Ctrl. You can also switch from hold-to-talk to press-to-start / press-to-stop.

**The text doesn't show up in some app. What can I do?**
If the app runs as administrator, run WhisperPress as administrator too. If the app blocks pasting, set *Insert text by* to *Typing each character*. With *Clipboard only*, the text is left on the clipboard for you to paste yourself. Every dictation is also saved in *Notes*, so nothing is lost.

**Does it handle Chinese, Japanese, or mixed languages?**
Yes. The multilingual Whisper models cover 99 languages, auto-detected or fixed in *Settings → Transcription*. For Chinese, *Chinese output script* forces Traditional or Simplified characters. Coding mode keeps English terms in Latin script inside Chinese or Japanese speech.

**Does it run on macOS or Linux?**
No. Typing into other apps (Win32 `SendInput`), unpacking the engine and capturing system audio are Windows-specific today.

**Where is my data, and how do I remove it?**
Notes, settings and (by default) the engine and models live in `%APPDATA%\WhisperPress`. *Settings → Models & engine* can move the engine and models to another folder. Uninstalling keeps that folder, so updating never loses your notes; delete it yourself to remove everything.

**Is it free?**
Yes. MIT-licensed, no account, no paid tier.

## How it works

- [Electron](https://electronjs.org) UI; no heavyweight frameworks — plain HTML/CSS/JS.
- [uiohook-napi](https://github.com/SnosMe/uiohook-napi) for the global push-to-talk hook (prebuilt, no compiler needed).
- Mic/system audio captured via WebAudio at 16 kHz mono, encoded to WAV.
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) `whisper-server` kept warm for instant dictation; `whisper-cli` streams long files segment-by-segment.
- Text injection via Win32 `SendInput` (Ctrl+V paste with clipboard restore, or per-character Unicode typing) through a tiny persistent PowerShell helper — no native module compilation anywhere.
- Notes are one JSON file each in `%APPDATA%\WhisperPress\notes`.

## Privacy

Your audio is processed in-memory and (optionally) stored **only** on your disk. The app talks to the network exclusively to download engine/model files at setup, and — only if you enable AI features — to the endpoint *you* configure.

## Development

```powershell
npm test         # unit tests (plain Node, no Electron or whisper needed)
npm run lint     # ESLint
```

CI runs both, plus a syntax check of every script, on pull requests and pushes to `main`. Issues and pull requests are welcome.

## Roadmap

- [ ] SenseVoice / Parakeet engines (sherpa-onnx) for even faster CJK transcription
- [ ] Streaming (real-time) dictation preview
- [ ] VAD-based auto-stop
- [ ] Per-app vocabulary profiles
- [ ] Installer code signing

## License

[MIT](LICENSE)

If WhisperPress saves you some typing, a ⭐ helps other people find it.
