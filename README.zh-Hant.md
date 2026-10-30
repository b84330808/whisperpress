<p align="center">
  <img src="assets/icon.png" width="96" alt="WhisperPress icon" />
</p>

<h1 align="center">WhisperPress</h1>

<p align="center">
  <b>按住按鍵、開口說話，文字就出現在游標處 — 任何應用程式都行。</b><br/>
  以 <a href="https://github.com/ggml-org/whisper.cpp">whisper.cpp</a> 驅動、免費且完全離線的 Windows 按住即說語音輸入與語音筆記。
</p>

<p align="center">
  <a href="https://github.com/b84330808/whisperpress/releases/latest"><img src="https://img.shields.io/github/v/release/b84330808/whisperpress" alt="Latest release" /></a>
  <a href="https://github.com/b84330808/whisperpress/actions/workflows/ci.yml"><img src="https://github.com/b84330808/whisperpress/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6" alt="Windows 10 | 11" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/b84330808/whisperpress" alt="MIT license" /></a>
</p>

<p align="center">
  繁體中文 · <a href="README.md">English</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <img src="assets/demo.gif" width="850" alt="WhisperPress 示範 — 中英日三語聽寫直接打進記事本" />
</p>

<p align="center">🔊 <b>含真人聲音的完整示範</b> — 中英日三語直接聽寫進記事本：</p>

https://github.com/user-attachments/assets/8db4657f-edae-42f2-b6db-351bb214fe22

---

## 快速開始

1. 從 [最新版本](https://github.com/b84330808/whisperpress/releases/latest) 下載 **`WhisperPress-Setup-x.x.x.exe`** 並執行。
   因為安裝檔沒有程式碼簽章，Windows SmartScreen 可能會跳出警告：點「**其他資訊**」→「**仍要執行**」。
2. 第一次啟動時，WhisperPress 會下載 whisper.cpp 引擎（約 16 MB），並讓你選擇模型。推薦的 **large-v3-turbo-q5_0** 需下載 574 MB。只有這一步需要網路。
3. 點進任何文字輸入框，**按住 F9、說話、放開**。文字會打在游標處，同時存成筆記。

不想一直按著的話，快速點一下 F9 就能免持錄音，再按一次結束；`Esc` 取消。快捷鍵可在「設定 → 語音輸入」更改。

## 為什麼選 WhisperPress？

按住快捷鍵（預設 **F9**）說話、放開——語音在本機轉錄，文字直接打進你游標所在的應用程式：編輯器、瀏覽器、聊天視窗、終端機都可以。每段語音輸入同時保存為可搜尋的筆記。

- **100% 離線。** 聲音永遠不離開你的電腦。不用帳號、不上雲、無遙測。
- **到處都能用。** 真正的全域快捷鍵＋模擬貼上/打字——VS Code、Word、Slack 都沒問題。
- **不只是聽寫。** 匯入音檔、錄製會議（系統聲音）、用本機 LLM 做摘要與問答。

## 功能特色

| | |
|---|---|
| 🎙 **按住即說（Push-to-talk）** | 按住說話，或快速點按鎖定錄音；也有切換模式。 |
| ⌨️ **打字進任何應用程式** | 在游標處貼上（剪貼簿會自動還原，包含圖片與格式化文字），或逐字輸入。 |
| 📝 **筆記歷史** | 每次聽寫／轉錄都在本機存成筆記，可搜尋、編輯、複製。 |
| 📂 **音檔匯入** | MP3、M4A、WAV、OGG、FLAC…，轉錄過程即時逐段顯示。 |
| 🖥 **會議錄音** | 錄下系統聲音（Teams／Meet／Zoom、影片…），可選擇是否加上麥克風；錄音時即時顯示字幕，結束後在本機轉錄整段錄音。 |
| 🌍 **99 種語言** | Whisper 多語模型，自動偵測或指定語言，可翻譯成英文。 |
| 🈶 **繁／簡體強制輸出** | 以 OpenCC 確定性轉換中文輸出（含台灣用語），不靠模型機率。 |
| ✦ **AI 摘要與問答** | 選用功能。接任何 OpenAI 相容端點——例如本機 [Ollama](https://ollama.com)，保持完全離線。 |
| ⏱ **帶時間軸匯出** | 筆記可匯出 `.txt`、`.md` 或 `.srt` 字幕。 |
| 🔒 **架構層級的隱私** | 模型透過 whisper.cpp 在你的 CPU/GPU 上執行；筆記是磁碟上的純 JSON。 |
| 🪶 **自訂詞彙** | Initial prompt 提示人名、術語與輸出風格。 |
| 🧑‍💻 **程式模式** | 對 Windows Terminal、VS Code、Claude Code 口述：中／日／英混講、程式詞彙（`use effect` → `useEffect`），要不要自動按 Enter 由你決定。 |
| 💻 **硬體偵測建議** | 自動偵測 CPU／記憶體／NVIDIA GPU，一鍵套用最適合的引擎與模型。 |

## 程式模式

給「對終端機、編輯器或 Claude Code 這類 AI 程式助理說話」用的模式。在 *設定 → 程式模式* 或系統匣選單開啟：

- **自動**：口述的目標視窗是終端機或程式編輯器時自動開啟（Windows Terminal、PowerShell、cmd、VS Code、Cursor、Windsurf、JetBrains IDE、Android Studio、Visual Studio、Sublime Text、WezTerm、Alacritty…）。其他 App 可用程序名稱加入，例如 `Claude`。
- **一律開啟**，或 **關閉**（預設）。

開啟時的差別（錄音膠囊會顯示 `</> code` 標記）：

- **中／日／英混講**：給 Whisper 一句用你介面語言寫、夾帶英文程式術語的範例句，「幫我跑 pytest，然後 git commit」或「npm install してから」裡的英文會保持英文拼寫。
- **程式詞彙**：列出你常說的詞（`pytest, kubectl, useEffect, …`），讓 Whisper 偏向這些拼法，轉錄後再修正大小寫與空格：`Pytest` → `pytest`、`use effect` → `useEffect`、`node js` → `Node.js`。像 `cube control => kubectl` 這樣的一行，會把聽到的換成你要的。路徑、網址、參數（`package.json`、`github.com/…`、`--use-effect`）不會被改。
- **去掉句尾句號**，`git status` 不會變成 `git status。`。
- **要不要按 Enter 由你決定**：預設只輸入文字，你確認後自己按 Enter；開啟「輸入後自動按 Enter」就能免手執行指令或送出提示。

一樣完全離線：詞彙只是給本機模型的提示。以系統管理員身分執行的終端機，無法接收一般程式送來的輸入（Windows 的限制）；需要的話請把 WhisperPress 也用系統管理員身分執行。

## 系統需求

- **Windows 10 或 11，64 位元（x64）。** 不支援 macOS 與 Linux（見 [常見問題](#常見問題)）。
- **記憶體與磁碟空間**依模型而定：從 `tiny` 的約 0.4 GB 記憶體、78 MB 磁碟，到推薦模型的約 1.5 GB、574 MB（見下方表格），另加 16 MB 的引擎。
- **麥克風**（語音輸入用）。會議錄音也可以只錄系統聲音。
- **選用：** NVIDIA 顯卡可用 CUDA 引擎（下載約 440 MB，而非 16 MB）。其他顯卡不會被使用；CPU 引擎到處都能跑。
- **網路**只在第一次下載引擎（GitHub）與模型（Hugging Face）時需要；若 AI 功能接的是你電腦以外的伺服器，使用時也需要。

## 下載安裝

到 **[Releases 頁面](https://github.com/b84330808/whisperpress/releases/latest)** 下載：

- `WhisperPress-Setup-x.x.x.exe` — 安裝版（建議，會建桌面捷徑）
- `WhisperPress-Portable-x.x.x.exe` — 免安裝版，下載即用

> 第一次執行時 Windows SmartScreen 可能會跳出警告（因為安裝檔未購買程式碼簽章），點「**其他資訊**」→「**仍要執行**」即可。原始碼全部公開在這裡，可自行檢視或自行打包。

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

依需求從 [Hugging Face（ggerganov/whisper.cpp）](https://huggingface.co/ggerganov/whisper.cpp)下載。記憶體數字是 App 內建的粗略估計。

| 模型 | 下載大小 | 記憶體 | 適合 |
|---|---|---|---|
| tiny | 78 MB | 約 0.4 GB | 任何電腦都能快速打草稿 |
| base | 148 MB | 約 0.5 GB | 快速，適合較舊的電腦 |
| small | 488 MB | 約 1.0 GB | 一般均衡 |
| medium-q5_0 | 539 MB | 約 1.2 GB | 更準確 |
| **large-v3-turbo-q5_0** | **574 MB** | **約 1.5 GB** | **推薦——速度與準確率最佳** |
| large-v3-turbo | 1.6 GB | 約 2.5 GB | 未量化的 turbo |
| large-v3-q5_0 | 1.1 GB | 約 2.5 GB | 準確率最高，速度最慢 |

不確定選哪個？「設定 → 模型與引擎 → 硬體建議」會依你的電腦挑好引擎與模型，一鍵套用。有 NVIDIA 顯卡？到「設定 → 模型與引擎 → 運算方式」切換成 **CUDA**，引擎速度大幅提升。

## 小技巧

- **繁體中文輸出**：到「設定 → 轉錄 → 中文輸出字形」選「強制繁體中文」即可保證繁體（OpenCC 確定性轉換）；詞彙提示 `以下是繁體中文的逐字稿：` 則能進一步提升用詞品質。
- **點按鎖定**：快速點一下快捷鍵即可免持續按住錄音，再按一次完成；`Esc` 取消。
- **AI 功能**：安裝 [Ollama](https://ollama.com)、執行 `ollama pull qwen3:4b`，然後在設定啟用 AI（預設端點 `http://localhost:11434/v1`）。

## 限制

- **只支援 Windows**（x64）。
- **放開按鍵後文字才出現**，不是邊說邊出字。說得越久，轉錄越久；實際速度取決於你的 CPU/GPU 與模型。
- **以系統管理員身分執行的程式**無法接收一般程式送來的文字（Windows 的規則）。需要對它們口述時，請把 WhisperPress 也用系統管理員身分執行。
- **貼上模式會暫時借用剪貼簿**。你原本複製的文字、格式化文字與圖片都會放回去，但複製的檔案不會。想完全不動剪貼簿，請把「文字輸入方式」改成「逐字打字」。
- **會議錄音會錄下電腦播放的所有聲音**，無法只錄單一程式。它透過 Windows 的螢幕分享音訊錄音，螢幕畫面會直接丟棄。
- **Whisper 可能聽錯**，在靜音或音樂段落偶爾會憑空生出文字（影片結尾語、字幕組署名）。WhisperPress 會濾掉常見的幻覺句，但無法全部攔下。
- **不會自動更新。** 新版本會發佈在 [Releases 頁面](https://github.com/b84330808/whisperpress/releases)；在 GitHub 上按 *Watch → Custom → Releases* 就能收到通知。
- **安裝檔沒有程式碼簽章**，所以第一次執行時 SmartScreen 會警告。

## 常見問題

**真的完全離線嗎？**
引擎與模型下載一次之後，是的：錄音、轉錄與筆記都留在你的電腦上，拔掉網路線也能聽寫。唯一其他的連網情況是選用的 AI 功能，它只連到*你自己*設定的端點（用 Ollama 或 LM Studio 的話也一樣留在本機）。

**該選哪個模型？**
先用 `large-v3-turbo-q5_0`。如果在舊電腦上轉錄太慢，改用 `small` 或 `base`。「設定 → 模型與引擎」裡的硬體建議會替你的電腦挑一個。

**可以換快捷鍵嗎？**
可以，在「設定 → 語音輸入」。任何按鍵或組合鍵都行，也可以單獨用一個修飾鍵，例如右 Ctrl。也能從「按住說話」改成「按一下開始、再按一下結束」。

**某些應用程式裡文字沒有出現，怎麼辦？**
如果那個程式以系統管理員身分執行，請把 WhisperPress 也用系統管理員身分執行。如果它擋掉貼上，把「文字輸入方式」改成「逐字打字」。選「只複製到剪貼簿」的話，文字會留在剪貼簿讓你自己貼。每段語音輸入也都存在「筆記」裡，不會遺失。

**支援中文、日文或多語混講嗎？**
支援。Whisper 多語模型涵蓋 99 種語言，可自動偵測或在「設定 → 轉錄」指定。中文可用「中文輸出字形」強制繁體或簡體。程式模式會讓中文或日文裡夾雜的英文術語保持英文拼寫。

**可以在 macOS 或 Linux 上用嗎？**
目前不行。打字進其他程式（Win32 `SendInput`）、解壓引擎與擷取系統聲音，目前都是 Windows 專用的做法。

**資料存在哪裡？要怎麼完全移除？**
筆記、設定，以及（預設情況下的）引擎與模型都在 `%APPDATA%\WhisperPress`。「設定 → 模型與引擎」可以把引擎與模型搬到其他資料夾。解除安裝不會刪除這個資料夾，所以更新版本不會弄丟筆記；想全部移除的話請自行刪除。

**要錢嗎？**
不用。MIT 授權、不用帳號、沒有付費版。

## 運作原理

- [Electron](https://electronjs.org) UI，無前端框架——純 HTML/CSS/JS。
- [uiohook-napi](https://github.com/SnosMe/uiohook-napi) 提供全域按鍵監聽（預編譯，不需編譯器）。
- 麥克風／系統聲音用 WebAudio 以 16 kHz 單聲道擷取並編成 WAV。
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) 的 `whisper-server` 常駐記憶體讓聽寫即時回應；長音檔用 `whisper-cli` 逐段串流。
- 文字注入用 Win32 `SendInput`（Ctrl+V 貼上＋剪貼簿還原，或逐字 Unicode 輸入），透過常駐 PowerShell helper 實作——全程不需編譯原生模組。
- 筆記是 `%APPDATA%\WhisperPress\notes` 下的單檔 JSON。

## 隱私

聲音只在記憶體中處理，（選擇性地）只存在你的磁碟上。App 僅在初次安裝時連網下載引擎／模型；若你啟用 AI 功能，才會連到**你自己設定**的端點。

## 開發

```powershell
npm test         # 單元測試（純 Node，不需要 Electron 或 whisper）
npm run lint     # ESLint
```

CI 會在 pull request 與推送到 `main` 時執行這兩項，外加所有程式檔的語法檢查。歡迎提 issue 與 pull request。

## 開發路線

- [ ] SenseVoice / Parakeet 引擎（sherpa-onnx），中日韓更快
- [ ] 即時串流聽寫預覽
- [ ] VAD 自動停止
- [ ] 各應用程式專屬詞彙
- [ ] 安裝程式簽章

## 授權

[MIT](LICENSE)

如果 WhisperPress 幫你省下打字的時間，給個 ⭐ 能讓更多人找到它。
