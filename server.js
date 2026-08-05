const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const crypto = require('crypto');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const packageMeta = require('./package.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const NETWORK_POLL_MS = 4000;
const DEFAULT_PORT = 3000;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 60000;
const AUTH_STATE_TTL_MS = AUTH_LOCK_MS * 2;
const MAX_LIVE_TEXT = 20000;
const MAX_NOTE_TITLE = 60;
const MAX_NOTE_CONTENT = 50000;
const MAX_IMPORT_NOTES = 1000;
const LIVE_MIN_INTERVAL_MS = 40;
const authAttemptState = new Map();

let serverReadyResolve;
let serverReadyReject;
const serverReady = new Promise((resolve, reject) => {
    serverReadyResolve = resolve;
    serverReadyReject = reject;
});

function logInfo(message, meta = {}) {
    console.log(`[AirTextPad] ${message}`, Object.keys(meta).length ? meta : '');
}

function logWarn(message, meta = {}) {
    console.warn(`[AirTextPad] ${message}`, Object.keys(meta).length ? meta : '');
}

function getAppStoragePath() {
    if (process.versions.electron) {
        try {
            const { app: electronApp } = require('electron');
            const userPath = electronApp.getPath('userData');
            if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
            return userPath;
        } catch (error) {
            logWarn('storage_path_unavailable', { error: String(error?.message || error) });
        }
    }
    return __dirname;
}

const STORAGE_PATH = getAppStoragePath();
const DATA_FILE = path.join(STORAGE_PATH, 'notes.json');
const ENV_FILE = path.join(STORAGE_PATH, '.env');

// Load environment variables from storage path
require('dotenv').config({ path: ENV_FILE });

let accessPasscode = (process.env.ACCESS_PASSCODE || process.env.ACCESS_PASSWORD || '').trim();
function normalizePort(value, fallback = DEFAULT_PORT) {
    const nextPort = Number(value);
    return Number.isInteger(nextPort) && nextPort >= 1024 && nextPort <= 65535 ? nextPort : fallback;
}

let preferredPort = normalizePort(process.env.PORT, DEFAULT_PORT);
let autoShowQr = String(process.env.AUTO_SHOW_QR || 'false').toLowerCase() === 'true';
let requireRemoteAuth = String(process.env.REQUIRE_REMOTE_AUTH || 'true').toLowerCase() === 'true';
let port = preferredPort;
let portFallbackActive = false;
let listenAttempt = 0;

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

let currentText = "";
let liveRevision = 0;
let notes = [];
let saveWriteChain = Promise.resolve();

if (fs.existsSync(DATA_FILE)) {
    try { notes = JSON.parse(fs.readFileSync(DATA_FILE)); } catch (e) { notes = []; }
}

function saveToFile() {
    const payload = JSON.stringify(notes, null, 2);
    const writeTask = saveWriteChain.then(() => fs.promises.writeFile(DATA_FILE, payload));
    saveWriteChain = writeTask.catch((err) => logWarn('notes_write_failed', { error: String(err?.message || err) }));
    return writeTask;
}

function generatePasscode() {
    return String(crypto.randomInt(100000, 1000000));
}

function createNoteId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function emitAck(ack, payload) {
    if (typeof ack === 'function') ack(payload);
}

function emitWriteError(ack) {
    emitAck(ack, { ok: false, message: 'Unable to save changes to disk.' });
}

function normalizePasscode(value, fallback = '') {
    const numeric = String(value || '').replace(/\D+/g, '');
    return /^\d{4,}$/.test(numeric) ? numeric : fallback;
}

function sanitizeLiveText(value) {
    if (typeof value === 'string') return value.slice(0, MAX_LIVE_TEXT);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, MAX_LIVE_TEXT);
    return '';
}

function sanitizeNotePayload(payload = {}) {
    const title = String(payload.title ?? '').trim().slice(0, MAX_NOTE_TITLE) || 'Untitled Note';
    const content = String(payload.content ?? '').slice(0, MAX_NOTE_CONTENT);
    return { title, content };
}

function normalizeNoteList(value) {
    const source = Array.isArray(value) ? value : [];
    return source.slice(0, MAX_IMPORT_NOTES).map((item) => {
        const safe = sanitizeNotePayload(item);
        return {
            id: item?.id ? String(item.id) : createNoteId(),
            title: safe.title,
            content: safe.content,
            date: String(item?.date || new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
        };
    });
}

function getAuthStateKey(socket) {
    return String(socket.handshake.address || 'unknown');
}

function cleanExpiredAuthAttempts() {
    const now = Date.now();
    for (const [key, value] of authAttemptState.entries()) {
        if (!value.lockUntil && now - Number(value.updatedAt || 0) > AUTH_STATE_TTL_MS) {
            authAttemptState.delete(key);
            continue;
        }
        if (value.lockUntil && value.lockUntil < now - AUTH_STATE_TTL_MS) {
            authAttemptState.delete(key);
        }
    }
}

function writeEnvValue(key, value) {
    try {
        let lines = [];
        if (fs.existsSync(ENV_FILE)) {
            lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
        }
        let found = false;
        lines = lines.map((line) => {
            if (!line.trim() || line.trim().startsWith('#')) return line;
            const [existingKey] = line.split('=');
            if (existingKey === key) {
                found = true;
                return `${key}=${value}`;
            }
            return line;
        });
        if (!found) lines.push(`${key}=${value}`);
        fs.writeFileSync(ENV_FILE, `${lines.filter((line) => line !== undefined).join('\n').trim()}\n`);
        return true;
    } catch (error) {
        logWarn('env_write_failed', { key, error: String(error?.message || error) });
        return false;
    }
}

accessPasscode = normalizePasscode(accessPasscode, generatePasscode());
writeEnvValue('ACCESS_PASSWORD', accessPasscode);

function getNetworkSnapshot() {
    const networkInterfaces = os.networkInterfaces();
    const candidates = [];

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        for (const iface of interfaces || []) {
            if (iface.family !== 'IPv4' || iface.internal) continue;
            candidates.push({ name, address: iface.address });
        }
    }

    if (!candidates.length) {
        return { primaryIP: 'localhost', addresses: ['localhost'] };
    }

    const preferred = candidates.find((item) => /wi-?fi|wireless|wlan|wl/i.test(item.name))
        || candidates.find((item) => item.address.startsWith('192.168.'))
        || candidates.find((item) => item.address.startsWith('10.'))
        || candidates.find((item) => item.address.startsWith('172.'))
        || candidates[0];

    const addresses = [preferred.address, ...candidates.map((item) => item.address)]
        .filter((value, index, arr) => arr.indexOf(value) === index);

    return { primaryIP: preferred.address, addresses };
}

let networkState = getNetworkSnapshot();

async function buildNetworkPayload() {
    const url = `http://${networkState.primaryIP}:${port}/?view=live`;
    return {
        localIP: networkState.primaryIP,
        port,
        preferredPort,
        portFallbackActive,
        qrCode: await QRCode.toDataURL(url),
        addresses: networkState.addresses,
        passcodeEnabled: requireRemoteAuth && Boolean(accessPasscode)
    };
}

async function broadcastNetworkState() {
    const payload = await buildNetworkPayload();
    io.emit('network-updated', payload);
}

io.on('connection', async (socket) => {
    const clientAddress = String(socket.handshake.address || '');
    const isLocalClient = clientAddress === '::1'
        || clientAddress === '127.0.0.1'
        || clientAddress === '::ffff:127.0.0.1';
    const isRemoteAuthEnabled = () => requireRemoteAuth && Boolean(accessPasscode);
    let isAuthorized = isLocalClient || !isRemoteAuthEnabled();
    const emitInitData = async () => {
        const networkPayload = await buildNetworkPayload();
        socket.emit('init-data', {
            currentText,
            liveRevision,
            notes,
            ...networkPayload,
            appVersion: packageMeta.version || '1.0.0',
            canManageHost: isLocalClient,
            hostPasscode: isLocalClient ? (accessPasscode || '') : '',
            preferredPort,
            autoShowQr,
            requireRemoteAuth
        });
    };
    socket.emit('network-updated', await buildNetworkPayload());
    logInfo('client_connected', { id: socket.id, address: clientAddress });

    socket.emit('auth-required', { required: !isAuthorized });
    if (isAuthorized) {
        socket.emit('auth-success');
        await emitInitData();
    }

    socket.on('auth-passcode', async (value) => {
        cleanExpiredAuthAttempts();
        const stateKey = getAuthStateKey(socket);
        const now = Date.now();
        const authState = authAttemptState.get(stateKey) || { attempts: 0, lockUntil: 0, updatedAt: now };
        if (authState.lockUntil > now) {
            socket.emit('auth-failed', {
                message: `Too many attempts. Retry in ${Math.ceil((authState.lockUntil - now) / 1000)}s.`
            });
            return;
        }
        const submitted = String(value || '').replace(/\D+/g, '');
        if (!isRemoteAuthEnabled() || submitted === accessPasscode) {
            authAttemptState.delete(stateKey);
            isAuthorized = true;
            socket.emit('auth-success');
            await emitInitData();
            return;
        }
        authState.attempts += 1;
        authState.updatedAt = now;
        if (authState.attempts >= AUTH_MAX_ATTEMPTS) {
            authState.attempts = 0;
            authState.lockUntil = now + AUTH_LOCK_MS;
        }
        authAttemptState.set(stateKey, authState);
        socket.emit('auth-failed', {
            message: authState.lockUntil > now
                ? `Too many attempts. Retry in ${Math.ceil((authState.lockUntil - now) / 1000)}s.`
                : 'Incorrect passcode'
        });
        logWarn('auth_failed', { id: socket.id, address: clientAddress });
    });

    const requireAuth = (handler) => (...args) => {
        if (!isAuthorized) {
            socket.emit('auth-required', { required: true });
            return;
        }
        handler(...args);
    };

    socket.on('request-network-refresh', requireAuth(async () => {
        networkState = getNetworkSnapshot();
        await broadcastNetworkState();
    }));

    let lastLiveUpdateAt = 0;
    socket.on('update-live', requireAuth((payload, ack) => {
        const now = Date.now();
        if (now - lastLiveUpdateAt < LIVE_MIN_INTERVAL_MS) {
            if (typeof ack === 'function') ack({ ok: false, reason: 'rate_limited', rev: liveRevision });
            return;
        }
        lastLiveUpdateAt = now;
        const incoming = typeof payload === 'object' && payload !== null ? payload : { text: payload };
        const incomingRev = Number(incoming.rev || 0);
        if (incomingRev && incomingRev < liveRevision) {
            if (typeof ack === 'function') ack({ ok: false, reason: 'stale_revision', rev: liveRevision });
            socket.emit('sync-live', { text: currentText, rev: liveRevision });
            logWarn('live_update_stale', { id: socket.id, incomingRev, liveRevision });
            return;
        }
        const nextText = sanitizeLiveText(incoming.text);
        if (nextText === currentText) {
            if (typeof ack === 'function') ack({ ok: true, rev: liveRevision });
            return;
        }
        currentText = nextText;
        liveRevision += 1;
        socket.broadcast.emit('sync-live', { text: nextText, rev: liveRevision });
        if (typeof ack === 'function') ack({ ok: true, rev: liveRevision });
        logInfo('live_update', { id: socket.id, rev: liveRevision, payloadSize: nextText.length });
    }));

    socket.on('save-note', requireAuth(async (d, ack) => {
        const safe = sanitizeNotePayload(d);
        const newId = createNoteId();
        const n = { id: newId, title: safe.title, content: safe.content, date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
        try {
            notes.unshift(n);
            await saveToFile();
            io.emit('note-created', n);
            socket.emit('note-saved-id', newId);
            emitAck(ack, { ok: true, id: newId });
        } catch (error) {
            notes = notes.filter((note) => note.id !== newId);
            emitWriteError(ack);
        }
    }));

    socket.on('edit-note', requireAuth(async (d, ack) => {
        const safe = sanitizeNotePayload(d);
        const i = notes.findIndex(x => String(x.id) === String(d.id));
        if (i !== -1) {
            const previous = { ...notes[i] };
            notes[i].title = safe.title;
            notes[i].content = safe.content;
            try {
                await saveToFile();
                io.emit('note-updated', notes[i]);
                emitAck(ack, { ok: true, id: notes[i].id });
            } catch (error) {
                notes[i] = previous;
                emitWriteError(ack);
            }
            return;
        }
        emitAck(ack, { ok: false, message: 'Note not found.' });
    }));

    socket.on('delete-note', requireAuth(async (id, ack) => {
        const targetId = String(id);
        const previousNotes = notes;
        notes = notes.filter(x => String(x.id) !== targetId);
        try {
            await saveToFile();
            io.emit('note-deleted', { id: targetId });
            emitAck(ack, { ok: true, id: targetId });
        } catch (error) {
            notes = previousNotes;
            emitWriteError(ack);
        }
    }));

    socket.on('import-notes', requireAuth(async (payload, ack) => {
        const incomingNotes = normalizeNoteList(payload?.notes);
        if (!incomingNotes.length) {
            emitAck(ack, { ok: false, message: 'No valid notes found in import file.' });
            return;
        }

        const previousNotes = notes;
        const mode = payload?.mode === 'replace' ? 'replace' : 'merge';
        if (mode === 'replace') {
            notes = incomingNotes;
        } else {
            const existingIds = new Set(notes.map((note) => String(note.id)));
            const uniqueIncoming = incomingNotes.map((note) => {
                if (!existingIds.has(String(note.id))) return note;
                return { ...note, id: createNoteId() };
            });
            notes = [...uniqueIncoming, ...notes].slice(0, MAX_IMPORT_NOTES);
        }

        try {
            await saveToFile();
            io.emit('notes-updated', notes);
            emitAck(ack, { ok: true, imported: incomingNotes.length, total: notes.length });
        } catch (error) {
            notes = previousNotes;
            emitWriteError(ack);
        }
    }));

    socket.on('update-host-settings', requireAuth(async (payload) => {
        if (!isLocalClient) {
            socket.emit('host-settings-updated', {
                success: false,
                message: 'Host settings can only be changed on this computer.'
            });
            return;
        }
        const nextPasscode = String(payload?.passcode ?? '').replace(/\D+/g, '');
        const nextPreferredPort = normalizePort(payload?.port, preferredPort);
        const nextAutoShowQr = Boolean(payload?.autoShowQr);
        const nextRequireRemoteAuth = Boolean(payload?.requireRemoteAuth);
        const portUpdated = nextPreferredPort !== preferredPort;

        if (nextRequireRemoteAuth && !nextPasscode) {
            socket.emit('host-settings-updated', {
                success: false,
                message: 'Passcode is required when remote password protection is ON.'
            });
            return;
        }

        if (nextPasscode && !/^\d{4,}$/.test(nextPasscode)) {
            socket.emit('host-settings-updated', {
                success: false,
                message: 'Passcode must be numeric and at least 4 digits.'
            });
            return;
        }

        preferredPort = nextPreferredPort;
        writeEnvValue('PORT', String(nextPreferredPort));

        accessPasscode = nextPasscode;
        autoShowQr = nextAutoShowQr;
        requireRemoteAuth = nextRequireRemoteAuth;
        writeEnvValue('ACCESS_PASSWORD', nextPasscode);
        writeEnvValue('AUTO_SHOW_QR', String(nextAutoShowQr));
        writeEnvValue('REQUIRE_REMOTE_AUTH', String(nextRequireRemoteAuth));

        await emitInitData();
        await broadcastNetworkState();
        socket.emit('host-settings-updated', { success: true, portUpdated });
    }));

    socket.on('disconnect', () => {
        logInfo('client_disconnected', { id: socket.id, address: clientAddress });
    });
});

function startServer(targetPort) {
    const attemptId = ++listenAttempt;
    server.listen(targetPort, '0.0.0.0', () => {
        if (attemptId !== listenAttempt) return;
        port = targetPort;
        portFallbackActive = preferredPort !== port;
        qrcodeTerminal.generate(`http://${networkState.primaryIP}:${port}`, { small: true });
        console.log(`[AirTextPad] Listening on port ${port}`);
        if (accessPasscode) console.log('[AirTextPad] Wi-Fi access passcode is enabled.');
        if (typeof serverReadyResolve === 'function') serverReadyResolve(port);
    });
}

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        const fallback = port + 1;
        listenAttempt += 1;
        port = fallback;
        portFallbackActive = true;
        console.log(`[AirTextPad] Port in use. Retrying on ${fallback}...`);
        setTimeout(() => startServer(fallback), 200);
        return;
    }
    if (typeof serverReadyReject === 'function') serverReadyReject(err);
    throw err;
});

startServer(preferredPort);

module.exports = { serverReady };

setInterval(async () => {
    const next = getNetworkSnapshot();
    const prevKey = `${networkState.primaryIP}|${networkState.addresses.join(',')}`;
    const nextKey = `${next.primaryIP}|${next.addresses.join(',')}`;

    if (prevKey !== nextKey) {
        networkState = next;
        await broadcastNetworkState();
    }
}, NETWORK_POLL_MS);
