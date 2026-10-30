'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const engine = require('./engine');
const notes = require('./notes');
const windows = require('./windows');

// Serialized queue for long-running file/meeting transcriptions (whisper-cli,
// streamed segment-by-segment so the UI shows text as it is recognized).
class Jobs extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.counter = 0;
  }

  submit({ name, wavBuffer, durationMs, source, language, keepAudio }) {
    const id = `job-${++this.counter}`;
    const job = { id, name, wavBuffer, durationMs, source: source || 'import', language, keepAudio, cancelled: false };
    this.queue.push(job);
    this._emit(job, { phase: 'queued' });
    this._pump();
    return id;
  }

  cancel(id) {
    const qi = this.queue.findIndex((j) => j.id === id);
    if (qi >= 0) {
      const [job] = this.queue.splice(qi, 1);
      job.cancelled = true;
      this._emit(job, { phase: 'cancelled' });
      return;
    }
    if (this.current && this.current.id === id) {
      this.current.cancelled = true;
      engine.cancelFileTranscription();
    }
  }

  _emit(job, payload) {
    windows.broadcast('job:update', { id: job.id, name: job.name, source: job.source, ...payload });
  }

  async _pump() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift();
    this.current = job;
    const tmpWav = path.join(os.tmpdir(), `whisperpress-${job.id}.wav`);
    let note = null;
    try {
      fs.writeFileSync(tmpWav, job.wavBuffer);
      note = notes.create({
        title: job.name,
        text: '',
        segments: [],
        durationMs: job.durationMs,
        source: job.source,
      });
      if (job.keepAudio) {
        notes.update(note.id, { audioFile: notes.saveAudio(note.id, job.wavBuffer) });
      }
      job.wavBuffer = null; // free memory
      this._emit(job, { phase: 'transcribing', pct: 0, noteId: note.id });
      windows.broadcast('notes:changed');

      const segments = [];
      let lastFlush = 0;
      const result = await engine.transcribeFile(tmpWav, { language: job.language }, (seg) => {
        segments.push(seg);
        this._emit(job, { phase: 'transcribing', segment: seg, noteId: note.id });
        const now = Date.now();
        if (now - lastFlush > 4000) {
          lastFlush = now;
          notes.update(note.id, { segments: [...segments], text: segments.map((s) => s.text).join('\n') });
        }
      }, (pct) => this._emit(job, { phase: 'transcribing', pct, noteId: note.id }));

      if (job.cancelled) throw new Error('cancelled');
      notes.update(note.id, {
        text: result.text,
        segments: result.segments,
        language: result.language,
      });
      windows.broadcast('notes:changed');
      this._emit(job, { phase: 'done', noteId: note.id });
    } catch (e) {
      const cancelled = job.cancelled || String(e.message).includes('cancelled');
      if (note) {
        if (cancelled && !notes.get(note.id)?.text) notes.remove(note.id);
        windows.broadcast('notes:changed');
      }
      this._emit(job, cancelled ? { phase: 'cancelled' } : { phase: 'error', error: String(e.message || e) });
    } finally {
      try { fs.unlinkSync(tmpWav); } catch { /* ignore */ }
      this.current = null;
      this._pump();
    }
  }
}

module.exports = new Jobs();
