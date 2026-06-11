<p align="center">
  <img src="assets/icon.png" width="96" alt="WhisperPress icon" />
</p>

<h1 align="center">WhisperPress</h1>

<p align="center">
  <b>按住按鍵、開口說話，文字就出現在游標處 — 任何應用程式都行。</b><br/>
  以 <a href="https://github.com/ggml-org/whisper.cpp">whisper.cpp</a> 驅動、完全離線的 Windows 語音輸入與語音筆記。
</p>

<p align="center">
  繁體中文 · <a href="README.md">English</a>
</p>

---

## 為什麼選 WhisperPress？

按住快捷鍵（預設 **F9**）說話、放開——語音在本機轉錄，文字直接打進你游標所在的應用程式：編輯器、瀏覽器、聊天視窗、終端機都可以。每段語音輸入同時保存為可搜尋的筆記。

- **100% 離線。** 聲音永遠不離開你的電腦。不用帳號、不上雲、無遙測。
- **到處都能用。** 真正的全域快捷鍵＋模擬貼上/打字——VS Code、Word、Slack 都沒問題。
- **不只是聽寫。** 匯入音檔、錄製會議（系統聲音）、用本機 LLM 做摘要與問答。

## 功能特色

| | |
|---|---|
| 🎙 **按住即說（Push-to-talk）** | 按住說話，或快速點按鎖定錄音；也有切換模式。 |
| ⌨️ **打字進任何應用程式** | 在游標處貼上（自動還原剪貼簿），或逐字輸入。 |
| 📝 **筆記歷史** | 每次聽寫／轉錄都在本機存成筆記，可搜尋、編輯、複製。 |
| 📂 **音檔匯入** | MP3、M4A、WAV、OGG、FLAC…，轉錄過程即時逐段顯示。 |
| 🖥 **會議錄音** | 擷取系統聲音（Teams／Meet／Zoom）＋你的麥克風，本機轉錄。 |
| 🌍 **100+ 語言** | Whisper 多語模型，自動偵測或指定語言，可翻譯成英文。 |
| ✦ **AI 摘要與問答** | 選用功能。接任何 OpenAI 相容端點——例如本機 [Ollama](https://ollama.com)，保持完全離線。 |
| ⏱ **帶時間軸匯出** | 筆記可匯出 `.txt`、`.md` 或 `.srt` 字幕。 |
| 🔒 **架構層級的隱私** | 模型透過 whisper.cpp 在你的 CPU/GPU 上執行；筆記是磁碟上的純 JSON。 |
| 🪶 **自訂詞彙** | Initial prompt 提示人名、術語與輸出風格（例如繁體中文）。 |

## 開始使用

### 從原始碼執行

需要 Windows 10/11 與 [Node.js](https://nodejs.org) 20+。

```powershell
git clone https://github.com/b84330808/whisperpress.git
cd whisperpress
npm install
npm start
```

首次啟動會下載 whisper.cpp 引擎（約 16 MB，[v1.8.6 官方預編譯](https://github.com/ggml-org/whisper.cpp/releases)）與你選擇的模型，之後全程離線。

### 打包安裝程式

```powershell
npm run dist     # NSIS 安裝程式＋免安裝版，輸出到 release/
```

## 模型

依需求從 [Hugging Face（ggerganov/whisper.cpp）](https://huggingface.co/ggerganov/whisper.cpp)下載：

| 模型 | 大小 | 適合 |
|---|---|---|
| tiny / base | 78–148 MB | 快速草稿 |
| small | 488 MB | 一般均衡 |
| **large-v3-turbo（q5_0）** | **574 MB** | **推薦——速度與準確率最佳** |
| medium q5_0 / large-v3 q5_0 | 539 MB – 1.1 GB | 追求最高準確率 |

有 NVIDIA 顯卡？到「設定 → 運算方式」切換成 **CUDA**，引擎速度大幅提升。

## 小技巧

- **繁體中文輸出**：把詞彙提示設成 `以下是繁體中文的逐字稿：`（介面語言是繁體中文時會自動設定）。
- **點按鎖定**：快速點一下快捷鍵即可免持續按住錄音，再按一次完成；`Esc` 取消。
- **AI 功能**：安裝 [Ollama](https://ollama.com)、執行 `ollama pull qwen3:4b`，然後在設定啟用 AI（預設端點 `http://localhost:11434/v1`）。

## 運作原理

- [Electron](https://electronjs.org) UI，無前端框架——純 HTML/CSS/JS。
- [uiohook-napi](https://github.com/SnosMe/uiohook-napi) 提供全域按鍵監聽（預編譯，不需編譯器）。
- 麥克風／系統聲音用 WebAudio 以 16 kHz 單聲道擷取並編成 WAV。
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) 的 `whisper-server` 常駐記憶體讓聽寫即時回應；長音檔用 `whisper-cli` 逐段串流。
- 文字注入用 Win32 `SendInput`（Ctrl+V 貼上＋剪貼簿還原，或逐字 Unicode 輸入），透過常駐 PowerShell helper 實作——全程不需編譯原生模組。
- 筆記是 `%APPDATA%\WhisperPress\notes` 下的單檔 JSON。

## 隱私

聲音只在記憶體中處理，（選擇性地）只存在你的磁碟上。App 僅在初次安裝時連網下載引擎／模型；若你啟用 AI 功能，才會連到**你自己設定**的端點。

## 開發路線

- [ ] SenseVoice / Parakeet 引擎（sherpa-onnx），中日韓更快
- [ ] 即時串流聽寫預覽
- [ ] VAD 自動停止
- [ ] 各應用程式專屬詞彙
- [ ] 安裝程式簽章

## 授權

[MIT](LICENSE)
