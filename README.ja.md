<p align="center">
  <img src="assets/icon.png" width="96" alt="WhisperPress icon" />
</p>

<h1 align="center">WhisperPress</h1>

<p align="center">
  <b>キーを押しながら話すだけ。文字はカーソルの位置に — どのアプリでも。</b><br/>
  <a href="https://github.com/ggml-org/whisper.cpp">whisper.cpp</a> 駆動、無料で完全オフラインの Windows 用プッシュトゥトーク音声入力＆ボイスノート。
</p>

<p align="center">
  <a href="https://github.com/b84330808/whisperpress/releases/latest"><img src="https://img.shields.io/github/v/release/b84330808/whisperpress" alt="Latest release" /></a>
  <a href="https://github.com/b84330808/whisperpress/actions/workflows/ci.yml"><img src="https://github.com/b84330808/whisperpress/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6" alt="Windows 10 | 11" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/b84330808/whisperpress" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="README.zh-Hant.md">繁體中文</a> · <a href="README.md">English</a> · 日本語
</p>

<p align="center">
  <img src="assets/demo.gif" width="850" alt="WhisperPress デモ — 中国語・英語・日本語をメモ帳に直接音声入力" />
</p>

<p align="center">🔊 <b>実際の音声付きフルデモ</b> — 中国語・英語・日本語をメモ帳に音声入力：</p>

https://github.com/user-attachments/assets/8db4657f-edae-42f2-b6db-351bb214fe22

---

## クイックスタート

1. [最新リリース](https://github.com/b84330808/whisperpress/releases/latest)から **`WhisperPress-Setup-x.x.x.exe`** をダウンロードして実行します。
   インストーラーはコード署名されていないため、Windows SmartScreen の警告が出ることがあります。「**詳細情報**」→「**実行**」をクリックしてください。
2. 初回起動時に whisper.cpp エンジン（約 16 MB）がダウンロードされ、モデルを選べます。おすすめの **large-v3-turbo-q5_0** は 574 MB です。インターネットが必要なのはこの手順だけです。
3. 任意のテキスト入力欄をクリックし、**F9 を押しながら話して、離します**。テキストがカーソル位置に入力され、ノートとしても保存されます。

押し続ける代わりに F9 を軽くタップするとハンズフリーで録音し、もう一度押すと確定します。`Esc` でキャンセル。ホットキーは「設定 → 音声入力」で変更できます。

## WhisperPress とは？

ホットキー（既定では **F9**）を押しながら話して離すだけ。音声は端末内で文字起こしされ、エディタ・ブラウザ・チャット・ターミナルなど、カーソルがあるアプリにそのまま入力されます。すべての音声入力は検索可能なノートとしても保存されます。

- **100% オフライン。** 音声が PC の外に出ることはありません。アカウント不要、クラウドなし、テレメトリなし。
- **どこでも使える。** 本物のグローバルホットキー＋貼り付け／キー入力エミュレーション — VS Code、Word、Slack、何でも OK。
- **音声入力だけじゃない。** 音声ファイルの取り込み、会議録音（システム音声）、ローカル LLM での要約と Q&A。

## 機能

| | |
|---|---|
| 🎙 **プッシュトゥトーク音声入力** | 押している間だけ録音、軽くタップでロック。トグルモードもあり。 |
| ⌨️ **どのアプリにも入力** | カーソル位置に貼り付け（クリップボードは画像や書式付きテキストも含めて復元）、または 1 文字ずつ入力。 |
| 📝 **ノート履歴** | すべての音声入力・文字起こしをローカルに保存。検索・編集・コピー。 |
| 📂 **音声ファイル取り込み** | MP3、M4A、WAV、OGG、FLAC など。文字起こし中の逐次表示つき。 |
| 🖥 **会議録音** | システム音声（Teams / Meet / Zoom、動画など）をマイクあり・なしで録音。録音中はライブ字幕を表示し、終了後に録音全体をローカルで文字起こし。 |
| 🌍 **99 言語** | Whisper 多言語モデル。自動検出・言語固定・英語への翻訳に対応。 |
| 🈶 **繁体字／簡体字の統一出力** | OpenCC による決定的な変換 — モデル任せにしません。 |
| ✦ **AI 要約 & Q&A** | オプション。任意の OpenAI 互換エンドポイントに対応 — [Ollama](https://ollama.com) ならオフラインのまま。 |
| ⏱ **タイムスタンプ付きエクスポート** | `.txt`、`.md`、`.srt` 字幕として出力。 |
| 🔒 **設計レベルのプライバシー** | モデルは whisper.cpp 経由で CPU/GPU 上で動作。ノートはディスク上のただの JSON。 |
| 🪶 **カスタム語彙** | 初期プロンプトで人名・専門用語・出力スタイルを誘導。 |
| 🧑‍💻 **コーディングモード** | Windows Terminal・VS Code・Claude Code に音声入力：日本語／中国語／英語の混在、コード用語集（`use effect` → `useEffect`）、Enter を押すかどうかは選択可能。 |
| 💻 **ハードウェア自動推奨** | CPU／RAM／NVIDIA GPU を検出し、最適なエンジンとモデルをワンクリックで適用。 |

## コーディングモード

ターミナル、エディタ、Claude Code のような AI コーディングエージェントに話しかけるためのモードです。*設定 → コーディングモード* かトレイメニューでオンにします：

- **自動**：入力先のウィンドウがターミナルやコードエディタのときだけオン（Windows Terminal、PowerShell、cmd、VS Code、Cursor、Windsurf、JetBrains IDE、Android Studio、Visual Studio、Sublime Text、WezTerm、Alacritty…）。ほかのアプリはプロセス名で追加できます（例：`Claude`）。
- **常にオン**、または **オフ**（既定）。

オンのときの違い（録音ピルに `</> code` バッジが出ます）：

- **言語の混在**：UI の言語で書かれ英語のコード用語を含む例文を Whisper に渡すので、「npm install してから git commit」や「幫我跑 pytest」の英語部分が英字のまま残ります。
- **コード用語集**：よく言う用語（`pytest, kubectl, useEffect, …`）で Whisper のつづりを誘導し、文字起こし後に大文字小文字と空白も直します：`Pytest` → `pytest`、`use effect` → `useEffect`、`node js` → `Node.js`。`cube control => kubectl` のような行は、聞き取った語を意図した語に置き換えます。パス・URL・フラグ（`package.json`、`github.com/…`、`--use-effect`）は変更しません。
- **文末の句点を外す**ので、`git status` が `git status。` になりません。
- **Enter は選べます**：既定ではテキストを入力するだけで、確認してから自分で Enter を押します。「入力後に Enter を押す」をオンにすると、コマンドの実行やプロンプトの送信まで手を使わずに行えます。

完全オフラインのままです：用語集はローカルモデルへのプロンプトにすぎません。管理者として実行中のターミナルは通常のアプリからの入力を受け付けません（Windows の制限）。必要なら WhisperPress も管理者として実行してください。

## 動作環境

- **Windows 10 / 11、64 ビット（x64）。** macOS と Linux には対応していません（[FAQ](#faq) を参照）。
- **メモリとディスク**はモデルによります：`tiny` の約 0.4 GB・78 MB から、おすすめモデルの約 1.5 GB・574 MB まで（下の表）。これに 16 MB のエンジンが加わります。
- 音声入力には**マイク**が必要です。会議録音はシステム音声だけでも使えます。
- **オプション：** NVIDIA GPU があれば CUDA エンジンを使えます（ダウンロードは 16 MB ではなく約 440 MB）。それ以外の GPU は使われません。CPU エンジンはどこでも動きます。
- **インターネット**が必要なのは、エンジン（GitHub）とモデル（Hugging Face）の初回ダウンロード時と、AI 機能を PC 外のサーバーに接続する場合だけです。

## ダウンロード

**[Releases ページ](https://github.com/b84330808/whisperpress/releases/latest)** から最新版をどうぞ：

- `WhisperPress-Setup-x.x.x.exe` — インストーラー版(推奨、デスクトップにショートカットを作成)
- `WhisperPress-Portable-x.x.x.exe` — ポータブル版、ダウンロードしてすぐ実行

> 初回実行時に Windows SmartScreen の警告が出ることがあります(バイナリはコード署名されていません)。「**詳細情報**」→「**実行**」をクリックしてください。ソースコードはすべて公開されています — 自分で確認もビルドも可能です。

### ソースから実行

Windows 10/11 と [Node.js](https://nodejs.org) 20+ が必要です。

```powershell
git clone https://github.com/b84330808/whisperpress.git
cd whisperpress
npm install
npm start
```

初回起動時に whisper.cpp エンジン(約 16 MB、[v1.8.6 公式ビルド](https://github.com/ggml-org/whisper.cpp/releases))と選択したモデルをダウンロードします。以降はすべてオフラインで動作します。

### インストーラーのビルド

```powershell
npm run dist     # NSIS インストーラー + ポータブル exe を release/ に出力
```

## モデル

[Hugging Face（ggerganov/whisper.cpp）](https://huggingface.co/ggerganov/whisper.cpp)から必要に応じてダウンロードします。メモリの数値はアプリ内の大まかな目安です。

| モデル | ダウンロード | メモリ | 向いている用途 |
|---|---|---|---|
| tiny | 78 MB | 約 0.4 GB | どの PC でも高速な下書き |
| base | 148 MB | 約 0.5 GB | 高速、古めの PC 向け |
| small | 488 MB | 約 1.0 GB | バランス重視 |
| medium-q5_0 | 539 MB | 約 1.2 GB | より高い精度 |
| **large-v3-turbo-q5_0** | **574 MB** | **約 1.5 GB** | **おすすめ — 速度と精度のベスト** |
| large-v3-turbo | 1.6 GB | 約 2.5 GB | 量子化なしの turbo |
| large-v3-q5_0 | 1.1 GB | 約 2.5 GB | 最高精度、最も低速 |

迷ったら「設定 → モデルとエンジン → ハードウェア推奨」が PC に合ったエンジンとモデルを選び、ワンクリックで適用します。NVIDIA GPU をお持ちなら「設定 → モデルとエンジン → 演算方式」を **CUDA** に切り替えると大幅に高速化します。

## ヒント

- **タップでロック**：ホットキーを軽くタップするとハンズフリーで録音継続、もう一度押すと確定。`Esc` でキャンセル。
- **AI 機能**：[Ollama](https://ollama.com) をインストールして `ollama pull qwen3:4b`、設定で AI を有効化（既定の Base URL `http://localhost:11434/v1` のままで OK）。
- **中国語の字形**：「設定 → 文字起こし → 中国語の出力字形」で繁体字／簡体字を保証できます。

## 制限事項

- **Windows（x64）専用**です。
- **テキストはキーを離した後に表示されます**。話しながらリアルタイムには出ません。長く話すほど文字起こしに時間がかかり、速度は CPU/GPU とモデル次第です。
- **管理者として実行中のアプリ**は、通常のアプリからの入力や貼り付けを受け付けません（Windows のルール）。そうしたアプリに入力したい場合は WhisperPress も管理者として実行してください。
- **貼り付けモードは一時的にクリップボードを使います**。コピーしていたテキスト・書式付きテキスト・画像は元に戻りますが、コピーしたファイルは戻りません。クリップボードに触れたくない場合は「テキスト入力方式」を「1 文字ずつ入力」にしてください。
- **会議録音は PC で再生されるすべての音を録音します**。特定のアプリだけを録ることはできません。Windows の画面共有の音声を使って録音し、画面の映像は破棄します。
- **Whisper は聞き間違えることがあり**、無音や音楽の部分で存在しない文（動画の締めの挨拶や字幕のクレジットなど）を作ることがあります。よくあるものは除去しますが、すべては防げません。
- **自動更新はありません。** 新しいバージョンは [Releases ページ](https://github.com/b84330808/whisperpress/releases) で公開されます。GitHub で *Watch → Custom → Releases* を選ぶと通知を受け取れます。
- **インストーラーはコード署名されていない**ため、初回実行時に SmartScreen の警告が出ます。

## FAQ

**本当にオフラインですか？**
エンジンとモデルを一度ダウンロードした後は、はい。録音・文字起こし・ノートはすべて PC 内で完結し、ネットワークを切っても音声入力できます。それ以外の通信はオプションの AI 機能だけで、*あなたが*設定したエンドポイントにのみ接続します（Ollama や LM Studio を使えばそれも PC 内で完結します）。

**どのモデルを選べばいいですか？**
まずは `large-v3-turbo-q5_0` を。古い PC で文字起こしが遅いと感じたら `small` や `base` を試してください。「設定 → モデルとエンジン」のハードウェア推奨がお使いの PC に合ったものを提案します。

**ホットキーは変更できますか？**
はい、「設定 → 音声入力」で変更できます。どのキーや組み合わせでも使え、右 Ctrl のような修飾キー単体も設定できます。「押している間だけ録音」から「押して開始・もう一度押して終了」に切り替えることもできます。

**一部のアプリでテキストが入力されません。**
そのアプリが管理者として実行されている場合は、WhisperPress も管理者として実行してください。貼り付けを受け付けないアプリでは「テキスト入力方式」を「1 文字ずつ入力」に。「クリップボードのみ」にすると、テキストはクリップボードに残るので自分で貼り付けられます。すべての音声入力は「ノート」にも保存されるので失われません。

**日本語・中国語や、言語が混ざった話し方に対応していますか？**
はい。Whisper 多言語モデルは 99 言語に対応し、自動検出または「設定 → 文字起こし」で固定できます。中国語は「中国語の出力字形」で繁体字か簡体字に統一できます。コーディングモードでは、日本語や中国語の中の英語の用語が英字のまま残ります。

**macOS や Linux で動きますか？**
いいえ。他のアプリへの入力（Win32 `SendInput`）、エンジンの展開、システム音声の取得が、現在は Windows 専用の仕組みです。

**データはどこにありますか？完全に削除するには？**
ノート、設定、そして（既定では）エンジンとモデルは `%APPDATA%\WhisperPress` にあります。「設定 → モデルとエンジン」でエンジンとモデルを別のフォルダに移せます。アンインストールしてもこのフォルダは残るため、アップデートでノートが消えることはありません。すべて削除したい場合はこのフォルダを手動で削除してください。

**無料ですか？**
はい。MIT ライセンスで、アカウント不要、有料プランもありません。

## 仕組み

- [Electron](https://electronjs.org) UI。重いフレームワークなし — 素の HTML/CSS/JS。
- [uiohook-napi](https://github.com/SnosMe/uiohook-napi) によるグローバルホットキー（ビルド済み、コンパイラ不要）。
- マイク／システム音声は WebAudio で 16 kHz モノラル取得、WAV にエンコード。
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) の `whisper-server` を常駐させ音声入力を即応答に。長いファイルは `whisper-cli` でセグメント単位にストリーミング。
- テキスト入力は Win32 `SendInput`（クリップボード復元付きの Ctrl+V 貼り付け、または 1 文字ずつの Unicode 入力）を小さな常駐 PowerShell ヘルパー経由で実行 — ネイティブモジュールのコンパイルは一切不要。
- ノートは `%APPDATA%\WhisperPress\notes` に 1 件 1 JSON ファイル。

## プライバシー

音声はメモリ内で処理され、（任意で）あなたのディスクに**のみ**保存されます。ネットワーク通信はセットアップ時のエンジン／モデルのダウンロードと、AI 機能を有効にした場合に*あなたが*設定したエンドポイントへの送信だけです。

## 開発

```powershell
npm test         # ユニットテスト（素の Node で実行。Electron や whisper は不要）
npm run lint     # ESLint
```

CI はプルリクエストと `main` への push のたびに、この 2 つとすべてのスクリプトの構文チェックを実行します。Issue やプルリクエストを歓迎します。

## ロードマップ

- [ ] SenseVoice / Parakeet エンジン（sherpa-onnx）— CJK をさらに高速に
- [ ] リアルタイム音声入力プレビュー
- [ ] VAD による自動停止
- [ ] アプリごとの語彙プロファイル
- [ ] インストーラーのコード署名

## ライセンス

[MIT](LICENSE)

WhisperPress で入力の手間が減ったら、⭐ をいただけると他の人にも見つけてもらいやすくなります。
