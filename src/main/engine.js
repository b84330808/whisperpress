'use strict';
const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const config = require('./config');

const WHISPER_CPP_VERSION = 'v1.8.6';
const ENGINE_ZIPS = {
  cpu: { name: 'whisper-blas-bin-x64.zip', sizeMB: 16 },
  cuda: { name: 'whisper-cublas-12.4.0-bin-x64.zip', sizeMB: 439 },
};
const MODEL_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

// id -> file is `ggml-<id>.bin` on Hugging Face (ggerganov/whisper.cpp)
const MODELS = [
  { id: 'tiny', sizeMB: 78, ram: '~0.4 GB', tier: 'fastest' },
  { id: 'base', sizeMB: 148, ram: '~0.5 GB', tier: 'fast' },
  { id: 'small', sizeMB: 488, ram: '~1.0 GB', tier: 'balanced' },
  { id: 'medium-q5_0', sizeMB: 539, ram: '~1.2 GB', tier: 'accurate' },
  { id: 'large-v3-turbo-q5_0', sizeMB: 574, ram: '~1.5 GB', tier: 'recommended' },
  { id: 'large-v3-turbo', sizeMB: 1620, ram: '~2.5 GB', tier: 'accurate' },
  { id: 'large-v3-q5_0', sizeMB: 1080, ram: '~2.5 GB', tier: 'max-quality' },
];

// Deterministic Traditional/Simplified conversion (the initial prompt only *biases*
// the script whisper picks; OpenCC guarantees it).
const occConverters = {};
function convertChinese(text, variant) {
  if (!text || variant === 'auto') return text;
  try {
    if (!occConverters[variant]) {
      const OpenCC = require('opencc-js');
      occConverters[variant] = variant === 'traditional'
        ? OpenCC.Converter({ from: 'cn', to: 'twp' })
        : OpenCC.Converter({ from: 'twp', to: 'cn' });
    }
    return occConverters[variant](text);
  } catch (e) {
    console.error('opencc failed', e.message);
    return text;
  }
}
function isChineseLang(lang) { return /^(zh|chinese)/i.test(lang || ''); }
// for streamed segments before the detected language is known: hanzi but no kana
function looksChinese(text) { return /[一-鿿]/.test(text) && !/[぀-ヿ]/.test(text); }

// whisper emits ASCII punctuation in Chinese text; switch to full-width, but only
// after a CJK character so Latin fragments (names, code) keep theirs
function normalizeChinesePunct(text) {
  return text
    .replace(/([一-鿿])\s*,\s*/g, '$1，')
    .replace(/([一-鿿])\s*\?/g, '$1？')
    .replace(/([一-鿿])\s*!/g, '$1！')
    .replace(/([一-鿿])\s*;/g, '$1；')
    .replace(/([一-鿿])\s*\.(?=$|\s|[一-鿿])/g, '$1。');
}
function postprocessChinese(text, variant) {
  return normalizeChinesePunct(convertChinese(text, variant));
}

class Engine extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.port = 0;
    this.state = 'stopped'; // stopped | starting | ready | error
    this.stateDetail = '';
    this.downloads = new Map(); // key -> AbortController
    this.startSeq = 0;
    this.busy = false;
  }

  // ---------- paths / discovery ----------
  get dataRoot() { return config.get().storageDir || app.getPath('userData'); }
  get root() { return path.join(this.dataRoot, 'engine'); }
  get modelDir() { return path.join(this.dataRoot, 'models'); }
  flavorDir(flavor) { return path.join(this.root, flavor); }
  findExe(name, flavor) {
    const dir = this.flavorDir(flavor || config.get().engineFlavor);
    if (!fs.existsSync(dir)) return null;
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name.toLowerCase() === name) return p;
      }
    }
    return null;
  }
  modelPath(id) { return path.join(this.modelDir, `ggml-${id}.bin`); }
  installedModels() {
    return MODELS.filter((m) => fs.existsSync(this.modelPath(m.id))).map((m) => m.id);
  }
  getState() {
    const flavor = config.get().engineFlavor;
    return {
      whisperCppVersion: WHISPER_CPP_VERSION,
      engineInstalled: !!this.findExe('whisper-server.exe', flavor),
      flavors: {
        cpu: !!this.findExe('whisper-server.exe', 'cpu'),
        cuda: !!this.findExe('whisper-server.exe', 'cuda'),
      },
      flavor,
      models: MODELS.map((m) => ({ ...m, installed: fs.existsSync(this.modelPath(m.id)) })),
      currentModel: config.get().model,
      server: this.state,
      serverDetail: this.stateDetail,
      busy: this.busy,
      activeDownloads: [...this.downloads.keys()],
      storageDir: this.dataRoot,
    };
  }

  _setState(s, detail = '') {
    this.state = s;
    this.stateDetail = detail;
    this.emit('status', this.getState());
  }

  // ---------- downloads ----------
  async _download(key, url, dest, totalHint) {
    const ac = new AbortController();
    this.downloads.set(key, ac);
    this.emit('status', this.getState()); // activeDownloads changed
    const tmp = `${dest}.part`;
    try {
      const res = await fetch(url, { signal: ac.signal, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const total = Number(res.headers.get('content-length')) || totalHint || 0;
      let received = 0;
      let lastEmit = 0;
      const counter = new (require('stream').Transform)({
        transform: (chunk, _enc, cb) => {
          received += chunk.length;
          const now = Date.now();
          if (now - lastEmit > 150) {
            lastEmit = now;
            this.emit('progress', { key, received, total, pct: total ? Math.round((received / total) * 100) : -1 });
          }
          cb(null, chunk);
        },
      });
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await pipeline(Readable.fromWeb(res.body), counter, fs.createWriteStream(tmp));
      fs.renameSync(tmp, dest);
      this.emit('progress', { key, received, total, pct: 100, done: true });
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      this.emit('progress', { key, error: ac.signal.aborted ? 'cancelled' : String(e.message || e) });
      throw e;
    } finally {
      this.downloads.delete(key);
    }
  }
  cancelDownload(key) {
    const ac = this.downloads.get(key);
    if (ac) ac.abort();
  }

  // Detect CPU/RAM/NVIDIA GPU and recommend a flavor + model.
  async detectHardware() {
    const cpus = os.cpus();
    const info = {
      cpuName: ((cpus[0] && cpus[0].model) || 'CPU').replace(/\s+/g, ' ').trim(),
      cores: cpus.length,
      ramGB: Math.round(os.totalmem() / 1073741824),
      gpu: null,
    };
    try {
      const out = await new Promise((resolve, reject) => {
        const p = spawn('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true });
        let s = '';
        p.stdout.on('data', (d) => { s += d; });
        p.on('error', reject);
        p.on('exit', (c) => (c === 0 ? resolve(s) : reject(new Error(`nvidia-smi exit ${c}`))));
      });
      const [name, mem] = out.trim().split('\n')[0].split(',').map((x) => x.trim());
      if (name) info.gpu = { name, vramMB: Number(mem) || 0 };
    } catch { /* no NVIDIA GPU / driver */ }

    let flavor = 'cpu';
    let model = 'base';
    if (info.gpu && info.gpu.vramMB >= 3000) {
      flavor = 'cuda';
      model = 'large-v3-turbo-q5_0';
    } else if (info.ramGB >= 16 && info.cores >= 8) {
      model = 'large-v3-turbo-q5_0';
    } else if (info.ramGB >= 8) {
      model = 'small';
    }
    info.recommend = { flavor, model };
    return info;
  }

  // Move engine + models to a new folder and use it from now on.
  async setStorageDir(newDir) {
    const oldRoot = this.dataRoot;
    if (!newDir || path.resolve(newDir).toLowerCase() === path.resolve(oldRoot).toLowerCase()) return this.getState();
    if (this.downloads.size) throw new Error('downloads in progress');
    this.busy = true;
    this._setState(this.state, this.stateDetail); // broadcast busy
    try {
      this.stop();
      this.cancelFileTranscription();
      await new Promise((r) => setTimeout(r, 400));
      fs.mkdirSync(newDir, { recursive: true });
      for (const sub of ['engine', 'models']) {
        const src = path.join(oldRoot, sub);
        const dst = path.join(newDir, sub);
        if (fs.existsSync(src)) {
          await fs.promises.cp(src, dst, { recursive: true, force: true });
          try { fs.rmSync(src, { recursive: true, force: true }); } catch { /* leftovers are harmless */ }
        }
      }
      config.set({ storageDir: newDir });
      if (config.get().model) this.start();
    } finally {
      this.busy = false;
      this.emit('status', this.getState());
    }
    return this.getState();
  }

  async installEngine(flavor) {
    flavor = flavor || config.get().engineFlavor;
    const zip = ENGINE_ZIPS[flavor];
    if (!zip) throw new Error(`unknown flavor ${flavor}`);
    const url = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_CPP_VERSION}/${zip.name}`;
    const zipPath = path.join(this.root, zip.name);
    await this._download(`engine:${flavor}`, url, zipPath, zip.sizeMB * 1024 * 1024);
    // a running server/cli holds locks inside the target dir — stop before replacing
    this.stop();
    this.cancelFileTranscription();
    await new Promise((r) => setTimeout(r, 400));
    const dir = this.flavorDir(flavor);
    for (let i = 0; i < 4; i++) {
      try { fs.rmSync(dir, { recursive: true, force: true }); break; }
      catch { await new Promise((r) => setTimeout(r, 600)); } // if it stays locked, overwrite in place
    }
    // Expand-Archive is always available on Windows; avoids a JS unzip dependency.
    await new Promise((resolve, reject) => {
      const p = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`,
      ], { windowsHide: true });
      let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`unzip failed: ${err}`))));
      p.on('error', reject);
    });
    try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
    if (!this.findExe('whisper-server.exe', flavor)) throw new Error('whisper-server.exe not found in archive');
    this.emit('status', this.getState());
    if (config.get().model && config.get().engineFlavor === flavor) this.start();
  }

  async downloadModel(id) {
    const m = MODELS.find((x) => x.id === id);
    if (!m) throw new Error(`unknown model ${id}`);
    await this._download(`model:${id}`, `${MODEL_BASE}/ggml-${id}.bin`, this.modelPath(id), m.sizeMB * 1024 * 1024);
    this.emit('status', this.getState());
  }
  deleteModel(id) {
    if (config.get().model === id && this.proc) this.stop();
    try { fs.unlinkSync(this.modelPath(id)); } catch { /* ignore */ }
    this.emit('status', this.getState());
  }

  // ---------- server lifecycle ----------
  _threads() {
    const t = config.get().threads;
    if (t > 0) return t;
    return Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2)));
  }
  async _freePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const { port } = srv.address();
        srv.close(() => resolve(port));
      });
      srv.on('error', reject);
    });
  }

  async start() {
    const seq = ++this.startSeq;
    this.stop();
    const cfg = config.get();
    const exe = this.findExe('whisper-server.exe');
    const modelId = cfg.model;
    if (!exe) { this._setState('stopped', 'no-engine'); return false; }
    if (!modelId || !fs.existsSync(this.modelPath(modelId))) { this._setState('stopped', 'no-model'); return false; }

    this._setState('starting', modelId);
    this.port = await this._freePort();
    if (seq !== this.startSeq) return false;

    const args = [
      '-m', this.modelPath(modelId),
      '--host', '127.0.0.1',
      '--port', String(this.port),
      '-t', String(this._threads()),
      '-l', cfg.language || 'auto',
      // the server defaults to greedy decoding (bs -1, bo 2) unlike whisper-cli;
      // greedy notoriously drops Chinese punctuation — match the CLI's beam search
      '-bs', '5', '-bo', '5',
    ];
    if (cfg.translate) args.push('-tr');
    if (cfg.initialPrompt) args.push('--prompt', cfg.initialPrompt);

    const proc = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true });
    this.proc = proc;
    let stderrTail = '';
    proc.stderr.on('data', (d) => { stderrTail = (stderrTail + d.toString()).slice(-2000); });
    proc.stdout.on('data', () => { /* drain */ });
    proc.on('exit', (code) => {
      if (this.proc === proc) {
        this.proc = null;
        if (this.state !== 'stopped') this._setState('error', `server exited (${code})\n${stderrTail.slice(-400)}`);
      }
    });
    proc.on('error', (e) => {
      if (this.proc === proc) { this.proc = null; this._setState('error', String(e.message)); }
    });

    // wait until the HTTP server accepts connections (model is loaded before listen)
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (seq !== this.startSeq || this.proc !== proc) return false;
      try {
        await fetch(`http://127.0.0.1:${this.port}/`, { method: 'GET' });
        this._setState('ready', modelId);
        return true;
      } catch { await new Promise((r) => setTimeout(r, 300)); }
    }
    this._setState('error', 'server start timeout');
    this.stop();
    return false;
  }

  stop() {
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      try { p.kill(); } catch { /* ignore */ }
    }
    if (this.state !== 'stopped') this._setState('stopped', this.stateDetail === 'no-engine' ? 'no-engine' : '');
  }

  // ---------- transcription (short clips, warm server) ----------
  async transcribe(wavBuffer, opts = {}) {
    if (this.state !== 'ready') {
      const ok = await this.start();
      if (!ok) throw new Error('engine-not-ready');
    }
    const cfg = config.get();
    const fd = new FormData();
    fd.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
    fd.append('response_format', 'verbose_json');
    fd.append('temperature', '0.0');
    fd.append('temperature_inc', '0.2');
    const lang = opts.language || cfg.language || 'auto';
    if (lang && lang !== 'auto') fd.append('language', lang);
    const res = await fetch(`http://127.0.0.1:${this.port}/inference`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`inference failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    if (j.error) throw new Error(`inference failed: ${j.error}`);
    const language = j.language || lang;
    const isZh = isChineseLang(language);
    const variant = isZh ? config.get().chineseVariant : 'auto';
    const post = (s) => (isZh ? postprocessChinese(s, variant) : s);
    const segments = Array.isArray(j.segments)
      ? j.segments.map((s) => ({ t0: Math.round((s.start || 0) * 1000), t1: Math.round((s.end || 0) * 1000), text: post((s.text || '').trim()) }))
      : null;
    return { text: post((j.text || '').trim()), segments, language };
  }

  // ---------- transcription (long files, streaming CLI) ----------
  // onSegment({t0,t1,text}), onProgress(pct). Returns {text, segments, language}.
  async transcribeFile(wavPath, opts = {}, onSegment, onProgress) {
    const cli = this.findExe('whisper-cli.exe');
    if (!cli) throw new Error('engine-not-ready');
    const cfg = config.get();
    const modelId = cfg.model;
    if (!modelId || !fs.existsSync(this.modelPath(modelId))) throw new Error('engine-not-ready');
    const outBase = path.join(os.tmpdir(), `whisperpress-${Date.now()}`);
    const lang = opts.language || cfg.language || 'auto';
    const args = [
      '-m', this.modelPath(modelId),
      '-f', wavPath,
      '-l', lang,
      '-t', String(this._threads()),
      '-oj', '-of', outBase,
      '-pp', '-np',
    ];
    if (cfg.translate) args.push('-tr');
    if (cfg.initialPrompt) args.push('--prompt', cfg.initialPrompt);

    return new Promise((resolve, reject) => {
      const proc = spawn(cli, args, { cwd: path.dirname(cli), windowsHide: true });
      this.cliProc = proc;
      const segRe = /\[(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\]\s?(.*)/;
      const progRe = /progress\s*=\s*(\d+)%/g;
      const scanProgress = (s) => {
        let m, last = -1;
        while ((m = progRe.exec(s))) last = +m[1];
        if (last >= 0 && onProgress) onProgress(last);
      };
      let buf = '';
      proc.stdout.on('data', (d) => {
        buf += d.toString('utf8');
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          const m = segRe.exec(line);
          if (m && onSegment) {
            const t0 = (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4];
            const t1 = (+m[5] * 3600 + +m[6] * 60 + +m[7]) * 1000 + +m[8];
            let text = m[9].trim();
            // detected language is only known at the end; use a heuristic for live output
            if (lang === 'zh' || (lang === 'auto' && looksChinese(text))) {
              text = postprocessChinese(text, config.get().chineseVariant);
            }
            onSegment({ t0, t1, text });
          } else {
            scanProgress(line);
          }
        }
      });
      let stderrTail = '';
      proc.stderr.on('data', (d) => {
        const s = d.toString('utf8');
        stderrTail = (stderrTail + s).slice(-2000);
        scanProgress(s);
      });
      proc.on('error', reject);
      proc.on('exit', (code) => {
        this.cliProc = null;
        if (code !== 0) return reject(new Error(`whisper-cli exited ${code}: ${stderrTail.slice(-400)}`));
        try {
          const j = JSON.parse(fs.readFileSync(`${outBase}.json`, 'utf8'));
          try { fs.unlinkSync(`${outBase}.json`); } catch { /* ignore */ }
          const language = (j.result && j.result.language) || lang;
          const isZh = isChineseLang(language);
          const variant = isZh ? config.get().chineseVariant : 'auto';
          const segments = (j.transcription || []).map((s) => ({
            t0: s.offsets ? s.offsets.from : 0,
            t1: s.offsets ? s.offsets.to : 0,
            text: isZh ? postprocessChinese((s.text || '').trim(), variant) : (s.text || '').trim(),
          }));
          resolve({
            text: segments.map((s) => s.text).join('\n').trim(),
            segments,
            language,
          });
        } catch (e) { reject(e); }
      });
    });
  }
  cancelFileTranscription() {
    if (this.cliProc) { try { this.cliProc.kill(); } catch { /* ignore */ } this.cliProc = null; }
  }
}

module.exports = new Engine();
module.exports.MODELS = MODELS;
