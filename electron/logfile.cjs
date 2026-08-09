'use strict';

// The shell's half of the log file.
//
// Node appends json_event records to the SAME daily file the Go backend writes,
// because the one failure this whole subsystem exists to diagnose — the sidecar
// dying before it prints a URL — can only be read by interleaving the shell's
// spawn/exit lines with the backend's own, by timestamp. Two files would make
// the reader do that by hand. Records are told apart by fields.role and
// fields.pid.
//
// Sharing is safe because both writers do the same thing: open with 'a'
// (O_APPEND on POSIX, FILE_APPEND_DATA on Windows) and issue exactly one write
// per whole line. Do not switch to createWriteStream — it may coalesce or split
// via writev — and do not use appendFileSync, which opens and closes per line.
//
// Everything here must match internal/logging exactly: the filename uses the
// LOCAL date, the @timestamp is UTC with three fractional digits, and retention
// is 7 days behind the same .retention marker and .retention.lock claim.

const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG_DIR =
  process.env.KUBE_INS_LOG_DIR || path.join(os.homedir(), '.kube-ins', 'logs');

const FILE_PREFIX = 'kube-inspector-';
const FILE_SUFFIX = '.log';
const DAY_FILE_RE = /^kube-inspector-(\d{4})-(\d{2})-(\d{2})\.log$/;

const MAX_RECORD = 32 * 1024;
const RETAIN_DAYS = 7;
const SWEEP_MARKER = '.retention';
const SWEEP_LOCK = '.retention.lock';
const SWEEP_MIN_GAP_MS = 6 * 60 * 60 * 1000;
const SWEEP_LOCK_TTL_MS = 5 * 60 * 1000;

// The sidecar prints its RPC token on stdout, and rememberLog feeds that same
// stdout here. Persisting it would write a live credential into a file whose
// entire purpose is to be attached to a bug report and emailed.
const SECRET = /(kube-ins shell token)\s+\S+/g;

let fd = null;
let currentName = '';
let appVersion = '0.0.0';

const pad2 = (n) => String(n).padStart(2, '0');

const dayFileName = (d) =>
  `${FILE_PREFIX}${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}${FILE_SUFFIX}`;

function ensureOpen(now) {
  const name = dayFileName(now);
  if (fd !== null && name === currentName) return;
  if (fd !== null) {
    try { fs.closeSync(fd); } catch { /* already gone */ }
    fd = null;
  }
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  fd = fs.openSync(path.join(LOG_DIR, name), 'a', 0o600);
  currentName = name;
  // Rollover is a name comparison on every write rather than a timer: it is
  // self-correcting after a suspend, which a midnight timer is not.
  sweep(now);
}

function write(level, logger, message, fields = {}) {
  try {
    const now = new Date();
    ensureOpen(now);

    const rec = {
      '@timestamp': now.toISOString(),
      '@version': '1',
      level,
      message: scrub(String(message)),
      logger,
      fields: {
        service: 'kube-inspector',
        version: appVersion,
        role: 'shell',
        pid: process.pid,
        ...fields,
      },
    };

    let line = JSON.stringify(rec) + '\n';
    if (line.length > MAX_RECORD) {
      line =
        JSON.stringify({
          ...rec,
          message: rec.message.slice(0, 8000),
          fields: { ...rec.fields, truncated: true },
        }) + '\n';
    }
    fs.writeSync(fd, line);
  } catch {
    // Logging must never be the reason the shell fails to start.
  }
}

function scrub(s) {
  return s.replace(SECRET, '$1 <redacted>');
}

// sweep deletes day files older than RETAIN_DAYS. Node runs it too, not just
// Go: the shell can start, fail to spawn a sidecar and quit, in which case no
// Go process ever runs to prune.
function sweep(now) {
  try {
    const marker = path.join(LOG_DIR, SWEEP_MARKER);
    try {
      if (now - fs.statSync(marker).mtime < SWEEP_MIN_GAP_MS) return;
    } catch { /* no marker yet: proceed */ }

    const lock = path.join(LOG_DIR, SWEEP_LOCK);
    let lockFd;
    try {
      lockFd = fs.openSync(lock, 'wx', 0o600); // O_CREAT|O_EXCL
    } catch {
      try {
        if (now - fs.statSync(lock).mtime > SWEEP_LOCK_TTL_MS) fs.unlinkSync(lock);
      } catch { /* raced with the holder */ }
      return;
    }
    fs.closeSync(lockFd);

    try {
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);

      for (const name of fs.readdirSync(LOG_DIR)) {
        // Strict match, so .level, .retention and anything a user drops in
        // this directory are structurally undeletable.
        const m = DAY_FILE_RE.exec(name);
        if (!m) continue;
        // The date in the name, never mtime: mtime lies while a process holds
        // a file open across midnight.
        const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (day >= cutoff) continue;
        try { fs.unlinkSync(path.join(LOG_DIR, name)); } catch { /* held open */ }
      }
      fs.writeFileSync(marker, '', { mode: 0o600 });
      fs.utimesSync(marker, now, now);
    } finally {
      try { fs.unlinkSync(lock); } catch { /* already gone */ }
    }
  } catch {
    // Retention is housekeeping; never let it break logging.
  }
}

module.exports = {
  dir: () => LOG_DIR,
  setVersion: (v) => { if (v) appVersion = v; },
  scrub,
  write,
  debug: (logger, message, fields) => write('DEBUG', logger, message, fields),
  info: (logger, message, fields) => write('INFO', logger, message, fields),
  warn: (logger, message, fields) => write('WARN', logger, message, fields),
  error: (logger, message, fields) => write('ERROR', logger, message, fields),
  close: () => {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* already gone */ }
      fd = null;
    }
  },
};
