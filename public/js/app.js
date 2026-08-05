(() => {
    const socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000
    });

    const els = {
        body: document.body,
        authModal: document.getElementById('auth-modal'),
        authInput: document.getElementById('auth-passcode-input'),
        authSubmit: document.getElementById('auth-submit-btn'),
        authError: document.getElementById('auth-error'),
        portal: document.getElementById('sync-portal'),
        portalQr: document.getElementById('portal-qr'),
        portalIp: document.getElementById('portal-ip'),
        portalPasscode: document.getElementById('portal-passcode'),
        portalStatus: document.getElementById('portal-status'),
        installBanner: document.getElementById('install-banner'),
        installBannerBtn: document.getElementById('install-banner-btn'),
        installBannerClose: document.getElementById('install-banner-close'),
        installBannerTitle: document.getElementById('install-banner-title'),
        installBannerSub: document.getElementById('install-banner-sub'),
        installBannerHint: document.getElementById('install-banner-hint'),
        copyIpBtn: document.getElementById('copy-ip-btn'),
        refreshNetworkBtn: document.getElementById('refresh-network-btn'),
        portalClose: document.getElementById('portal-close-btn'),
        liveExitLink: document.getElementById('live-exit-link'),
        supportModal: document.getElementById('support-modal'),
        supportOpen: document.getElementById('support-open-btn'),
        supportClose: document.getElementById('support-close-btn'),
        themeToggle: document.getElementById('theme-toggle-btn'),
        themeColorMeta: document.getElementById('theme-color-meta'),
        appVersion: document.getElementById('app-version'),
        checkUpdateBtn: document.getElementById('check-update-btn'),
        copyAppInfoBtn: document.getElementById('copy-app-info-btn'),
        updateStatus: document.getElementById('update-status'),
        serialKeyInput: document.getElementById('serial-key-input'),
        activateSerialBtn: document.getElementById('activate-serial-btn'),
        clearSerialBtn: document.getElementById('clear-serial-btn'),
        licenseStatus: document.getElementById('license-status'),
        licensePlanBadge: document.getElementById('license-plan-badge'),
        licensePlanCopy: document.getElementById('license-plan-copy'),
        exportNotesBtn: document.getElementById('export-notes-btn'),
        importNotesBtn: document.getElementById('import-notes-btn'),
        importNotesInput: document.getElementById('import-notes-input'),
        pwaStatus: document.getElementById('pwa-status'),
        showPortal: document.getElementById('show-portal-btn'),
        notesList: document.getElementById('notes-list'),
        search: document.getElementById('search-notes'),
        hostUrl: document.getElementById('host-url'),
        hostPortStatus: document.getElementById('host-port-status'),
        portRestartBadge: document.getElementById('port-restart-badge'),
        hostCopyUrlBtn: document.getElementById('host-copy-url-btn'),
        hostShowQrBtn: document.getElementById('host-show-qr-btn'),
        hostPasscodeInput: document.getElementById('host-passcode-input'),
        hostRemoteAuthInput: document.getElementById('host-remote-auth-input'),
        hostPortInput: document.getElementById('host-port-input'),
        hostAutoQrInput: document.getElementById('host-auto-qr-input'),
        editHostSettingsBtn: document.getElementById('edit-host-settings-btn'),
        saveHostSettingsBtn: document.getElementById('save-host-settings-btn'),
        mainView: document.getElementById('main-view'),
        previewTitle: document.getElementById('preview-title'),
        markdown: document.getElementById('markdown-render'),
        syncNoteLiveBtn: document.getElementById('sync-note-live-btn'),
        syncDraftLiveBtn: document.getElementById('sync-draft-live-btn'),
        editTitle: document.getElementById('edit-title'),
        titleCount: document.getElementById('title-count'),
        editContent: document.getElementById('edit-content'),
        scratchpad: document.getElementById('scratchpad'),
        toast: document.getElementById('toast'),
        deleteNoteModal: document.getElementById('delete-note-modal'),
        cancelDeleteNoteBtn: document.getElementById('cancel-delete-note-btn'),
        confirmDeleteNoteBtn: document.getElementById('confirm-delete-note-btn'),
        clearLiveModal: document.getElementById('clear-live-modal'),
        cancelClearLiveBtn: document.getElementById('cancel-clear-live-btn'),
        confirmClearLiveBtn: document.getElementById('confirm-clear-live-btn')
    };

    const TITLE_LIMIT = Number(els.editTitle.getAttribute('maxlength')) || 15;
    const AUTH_CACHE_KEY = 'atp_passcode_cache';
    const THEME_STORAGE_KEY = 'atp_theme';
    const LICENSE_STORAGE_KEY = 'atp_license_state';

    const state = {
        notes: [],
        activeNoteId: null,
        view: 'library',
        initialized: false,
        dirty: false,
        deferredInstallPrompt: null,
        toastTimer: null,
        liveTimer: null,
        liveAckTimer: null,
        lastPendingLiveText: '',
        lastLiveRevision: 0,
        authRequired: false,
        isAuthorized: true,
        hostPasscode: '',
        canManageHost: false,
        requireRemoteAuth: true,
        preferredPort: null,
        autoShowQr: false,
        portFallbackActive: false,
        activePort: null,
        pendingDeleteNoteId: null,
        numericToastTimer: null,
        routeViewParam: (() => new URLSearchParams(window.location.search).get('view'))(),
        initialRouteView: (() => {
            const qp = new URLSearchParams(window.location.search).get('view');
            if (qp === 'live') return 'live';
            return window.matchMedia('(max-width: 900px)').matches ? 'library' : 'live';
        })(),
        liveFocusMode: false,
        hostSettingsEditMode: false
    };

    const $ = (id) => document.getElementById(id);

    const iconPaths = {
        Back: '<path d="m15 18-6-6 6-6"/><path d="M21 12H9"/>',
        Clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
        Close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        Copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        Delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
        Edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        Help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 4.9 2.3c-.9.7-1.4 1.2-1.4 2.7"/><path d="M12 17h.01"/>',
        Install: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
        Key: '<path d="M21 2 11 12"/><circle cx="7.5" cy="16.5" r="5.5"/><path d="m15 8 3 3"/><path d="m17 6 3 3"/>',
        Library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
        Link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
        Moon: '<path d="M12 3a6.7 6.7 0 0 0 8.8 8.8A8.4 8.4 0 1 1 12 3Z"/>',
        QR: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h2v2h-2z"/><path d="M19 14h2v4h-4v-2h2z"/><path d="M14 19h2v2h-2z"/><path d="M19 21v-2h2"/>',
        Refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5"/>',
        Save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
        Send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
        Sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        Download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
        Upload: '<path d="M12 21V9"/><path d="m17 14-5-5-5 5"/><path d="M5 3h14"/>'
    };

    function renderIconForControl(control) {
        const name = control?.dataset?.icon;
        const paths = iconPaths[name] || iconPaths.Help;
        if (!paths || control.querySelector('.ui-icon')) return;
        const icon = document.createElement('span');
        icon.className = 'ui-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${paths}</svg>`;
        control.prepend(icon);
    }

    function refreshIconForControl(control) {
        if (!control) return;
        const paths = iconPaths[control.dataset.icon] || iconPaths.Help;
        const icon = control.querySelector('.ui-icon');
        if (!icon || !paths) {
            renderIconForControl(control);
            return;
        }
        icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${paths}</svg>`;
    }

    function renderButtonIcons() {
        document.querySelectorAll('button[data-icon], a[data-icon]').forEach(renderIconForControl);
    }

    function currentTheme() {
        return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(theme, persist = true) {
        const nextTheme = theme === 'dark' ? 'dark' : 'light';
        const isDark = nextTheme === 'dark';
        document.documentElement.dataset.theme = nextTheme;
        document.documentElement.style.colorScheme = nextTheme;
        els.body.dataset.theme = nextTheme;
        if (els.themeColorMeta) els.themeColorMeta.setAttribute('content', isDark ? '#0f1218' : '#2563eb');
        [els.themeToggle].forEach((button) => {
            if (!button) return;
            const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
            button.dataset.icon = isDark ? 'Sun' : 'Moon';
            button.dataset.label = isDark ? 'Light' : 'Dark';
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
            button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
            const hidden = button.querySelector('.visually-hidden');
            if (hidden) hidden.textContent = label;
            refreshIconForControl(button);
        });
        if (persist) localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }

    function toggleTheme() {
        applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
        notify(currentTheme() === 'dark' ? 'Dark mode on' : 'Light mode on');
    }

    function text(value) {
        return String(value ?? '');
    }

    function sameId(a, b) {
        return String(a) === String(b);
    }

    function coerceLiveText(value) {
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return '';
    }

    function normalizeTitle(value) {
        return text(value).trim().slice(0, TITLE_LIMIT);
    }

    function normalizePasscode(value) {
        return text(value).replace(/\D+/g, '');
    }

    function enforceNumericPasscodeInput(inputEl) {
        const raw = text(inputEl.value);
        const numeric = normalizePasscode(raw);
        if (raw === numeric) return;
        inputEl.value = numeric;
        if (state.numericToastTimer) return;
        notify('Only numeric allowed');
        state.numericToastTimer = setTimeout(() => {
            state.numericToastTimer = null;
        }, 900);
    }

    function updateTitleCount() {
        const trimmedTitle = text(els.editTitle.value).slice(0, TITLE_LIMIT);
        if (els.editTitle.value !== trimmedTitle) els.editTitle.value = trimmedTitle;
        els.titleCount.textContent = `${trimmedTitle.length}/${TITLE_LIMIT}`;
        els.titleCount.classList.toggle('is-full', trimmedTitle.length >= TITLE_LIMIT);
    }

    function escapeHtml(value) {
        return text(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function renderMarkdown(source) {
        const escaped = escapeHtml(source || 'No content yet.');
        const blocks = escaped.split(/\n{2,}/).map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('### ')) return `<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`;
            if (trimmed.startsWith('## ')) return `<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`;
            if (trimmed.startsWith('# ')) return `<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`;
            if (trimmed.startsWith('- ')) {
                const items = trimmed.split('\n').map((line) => `<li>${inlineMarkdown(line.replace(/^- /, ''))}</li>`).join('');
                return `<ul>${items}</ul>`;
            }
            return `<p>${inlineMarkdown(trimmed).replaceAll('\n', '<br>')}</p>`;
        });
        return blocks.join('');
    }

    function inlineMarkdown(value) {
        return value
            .replace(/==([^=]+)==/g, '<mark>$1</mark>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    function updateTextAreaWithSelection(textarea, transform) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const value = textarea.value || '';
        const selected = value.slice(start, end);
        const result = transform(selected, value, start, end);
        if (!result || typeof result.text !== 'string') return;
        textarea.value = value.slice(0, start) + result.text + value.slice(end);
        const caret = typeof result.caret === 'number' ? result.caret : (start + result.text.length);
        textarea.focus();
        textarea.setSelectionRange(caret, caret);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function applyFormat(textarea, action) {
        const wrap = (prefix, suffix = prefix, fallback = 'text') => updateTextAreaWithSelection(textarea, (sel) => {
            const source = sel || fallback;
            return { text: `${prefix}${source}${suffix}` };
        });

        if (action === 'bold') return wrap('**');
        if (action === 'italic') return wrap('*');
        if (action === 'highlight') return wrap('==');
        if (action === 'code') return wrap('`');
        if (action === 'h1') {
            return updateTextAreaWithSelection(textarea, (sel) => ({ text: `# ${sel || 'Heading'}\n` }));
        }
        if (action === 'h2') {
            return updateTextAreaWithSelection(textarea, (sel) => ({ text: `## ${sel || 'Subheading'}\n` }));
        }
        if (action === 'bullet') {
            return updateTextAreaWithSelection(textarea, (sel) => {
                const base = sel || 'List item';
                const lines = base.split('\n').map((line) => line.startsWith('- ') ? line : `- ${line}`);
                return { text: lines.join('\n') };
            });
        }
    }

    function activeNote() {
        return state.notes.find((note) => sameId(note.id, state.activeNoteId)) || null;
    }

    function setView(view, options = {}) {
        state.view = view;
        els.body.dataset.view = view;
        if (options.openPanel !== undefined) {
            els.body.dataset.panelOpen = String(options.openPanel);
        } else if (view !== 'library') {
            els.body.dataset.panelOpen = 'true';
        }
        updateTabs();
        keepEditorUnlocked();
    }

    function setLiveFocusMode(enabled) {
        state.liveFocusMode = !!enabled;
        els.body.dataset.liveFocus = state.liveFocusMode ? 'true' : 'false';
    }

    function isMobileViewport() {
        return window.matchMedia('(max-width: 900px)').matches;
    }

    function updateTabs() {
        const activeSection = state.view === 'live' ? 'live' : 'library';
        ['library', 'live'].forEach((name) => {
            const selected = activeSection === name;
            const desktopTab = $(`${name}-tab`);
            const mobileTab = $(`mobile-${name}-btn`);
            desktopTab?.classList.toggle('active', selected);
            desktopTab?.setAttribute('aria-pressed', selected ? 'true' : 'false');
            mobileTab?.classList.toggle('active', selected);
            mobileTab?.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    }

    function normalizeSerialKey(value) {
        const clean = text(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        return clean.match(/.{1,4}/g)?.join('-') || '';
    }

    function updateStatusMessage(message, isSuccess = false) {
        if (!els.updateStatus) return;
        els.updateStatus.textContent = message;
        els.updateStatus.classList.toggle('is-success', !!isSuccess);
    }

    function updateLicenseStatus(message, isSuccess = false) {
        if (!els.licenseStatus) return;
        els.licenseStatus.textContent = message;
        els.licenseStatus.classList.toggle('is-success', !!isSuccess);
    }

    function readLicenseState() {
        try {
            return JSON.parse(localStorage.getItem(LICENSE_STORAGE_KEY) || 'null') || null;
        } catch (error) {
            return null;
        }
    }

    function writeLicenseState(license) {
        if (!license) {
            localStorage.removeItem(LICENSE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
    }

    function renderLicenseState() {
        const license = readLicenseState();
        if (!license) {
            if (els.licensePlanBadge) els.licensePlanBadge.textContent = 'Free';
            if (els.licensePlanCopy) els.licensePlanCopy.textContent = 'Basic local sync is active.';
            updateLicenseStatus('No serial key activated.');
            if (els.serialKeyInput) els.serialKeyInput.value = '';
            return;
        }
        if (els.licensePlanBadge) els.licensePlanBadge.textContent = 'Pro pending';
        if (els.licensePlanCopy) els.licensePlanCopy.textContent = 'Serial saved locally. Connect a license server before paid launch.';
        if (els.serialKeyInput) els.serialKeyInput.value = normalizeSerialKey(license.serialKey);
        updateLicenseStatus(`Serial saved on ${license.activatedAt}. Online validation not connected yet.`, true);
    }

    function checkForUpdate() {
        updateStatusMessage('Checking configured update channel...');
        window.setTimeout(() => {
            updateStatusMessage('No update service connected yet. Add your endpoint here when releases are ready.');
            notify('Update checker ready to connect');
        }, 550);
    }

    function activateSerialKey() {
        const serialKey = normalizeSerialKey(els.serialKeyInput?.value);
        if (els.serialKeyInput) els.serialKeyInput.value = serialKey;
        if (!/^([A-Z0-9]{4}-){3}[A-Z0-9]{4}$/.test(serialKey)) {
            updateLicenseStatus('Enter a 16-character serial key.');
            notify('Serial key format needed');
            return;
        }
        updateLicenseStatus('Serial key captured. Connect validation API to complete activation.', true);
        writeLicenseState({
            serialKey,
            status: 'pending_validation',
            plan: 'pro',
            activatedAt: new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
        });
        renderLicenseState();
        notify('Serial key ready for validation');
    }

    function exportNotes() {
        const payload = {
            app: 'AirTextPad',
            version: els.appVersion?.textContent || '1.0.0',
            exportedAt: new Date().toISOString(),
            notes: state.notes
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `airtextpad-notes-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        notify('Notes exported');
    }

    function importNotesFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || '{}'));
                const incomingNotes = Array.isArray(parsed) ? parsed : parsed.notes;
                if (!Array.isArray(incomingNotes) || !incomingNotes.length) {
                    notify('No notes found in file');
                    return;
                }
                socket.emit('import-notes', { notes: incomingNotes, mode: 'merge' }, (ack) => {
                    if (!ack?.ok) {
                        notify(ack?.message || 'Import failed');
                        return;
                    }
                    notify(`Imported ${ack.imported || incomingNotes.length} notes`);
                });
            } catch (error) {
                notify('Invalid backup file');
            } finally {
                if (els.importNotesInput) els.importNotesInput.value = '';
            }
        };
        reader.onerror = () => notify('Unable to read file');
        reader.readAsText(file);
    }

    function openPortal() {
        els.portal.hidden = false;
        els.portal.setAttribute('aria-hidden', 'false');
        els.portal.classList.remove('is-hidden');
    }

    function setAuthGate(required) {
        state.authRequired = !!required;
        state.isAuthorized = !required;
        els.authError.hidden = true;
        els.authModal.hidden = !required;
        els.authModal.setAttribute('aria-hidden', required ? 'false' : 'true');
        if (required) {
            const cached = sessionStorage.getItem(AUTH_CACHE_KEY) || '';
            if (/^\d{4,}$/.test(cached)) {
                socket.emit('auth-passcode', cached);
            }
        }
        if (required) {
            requestAnimationFrame(() => els.authInput.focus());
        } else {
            els.authInput.value = '';
        }
        keepEditorUnlocked();
    }

    function closePortal() {
        els.portal.classList.add('is-hidden');
        els.portal.setAttribute('aria-hidden', 'true');
        els.portal.hidden = true;
        keepEditorUnlocked();
    }

    function enterAppToCanvas() {
        closePortal();
        setLiveFocusMode(isMobileViewport());
        setView('live', { openPanel: true });
        requestAnimationFrame(() => {
            els.scratchpad.focus();
            keepEditorUnlocked();
        });
    }

    function openSupport() {
        els.supportModal.hidden = false;
        els.supportModal.setAttribute('aria-hidden', 'false');
    }

    function showPortalFromSupport() {
        closeSupport();
        openPortal();
    }

    function closeSupport() {
        els.supportModal.setAttribute('aria-hidden', 'true');
        els.supportModal.hidden = true;
        keepEditorUnlocked();
    }

    function notify(message) {
        clearTimeout(state.toastTimer);
        els.toast.textContent = message;
        els.toast.classList.add('visible');
        state.toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2200);
    }

    function setHostSettingsEditMode(editMode) {
        state.hostSettingsEditMode = !!editMode;
        els.hostPasscodeInput.readOnly = !editMode;
        els.hostRemoteAuthInput.disabled = !editMode;
        els.hostPortInput.readOnly = !editMode;
        els.hostPortInput.disabled = !editMode;
        els.hostAutoQrInput.disabled = !editMode;
        els.saveHostSettingsBtn.disabled = !editMode;
        els.editHostSettingsBtn.textContent = editMode ? 'Cancel' : 'Edit';
    }

    function updateRestartBadge() {
        const selectedPort = Number(els.hostPortInput.value || state.preferredPort || 3000);
        els.portRestartBadge.hidden = !state.hostSettingsEditMode || selectedPort === Number(state.preferredPort || 3000);
    }

    function setHostManagementState(canManage) {
        state.canManageHost = !!canManage;
        els.body.dataset.canManageHost = state.canManageHost ? 'true' : 'false';
        if (!state.canManageHost) setHostSettingsEditMode(false);
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isIosSafari() {
        const ua = window.navigator.userAgent || '';
        const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        return isAppleMobile && isSafari;
    }

    function showInstallBanner({ title, subtitle, hint = '', actionLabel = 'Install', actionHidden = false }) {
        if (!els.installBanner) return;
        if (els.installBannerTitle) els.installBannerTitle.textContent = title;
        if (els.installBannerSub) els.installBannerSub.textContent = subtitle;
        if (els.installBannerHint) {
            els.installBannerHint.textContent = hint;
            els.installBannerHint.hidden = !hint;
        }
        if (els.installBannerBtn) {
            els.installBannerBtn.hidden = !!actionHidden;
            els.installBannerBtn.textContent = actionLabel;
        }
        els.installBanner.hidden = false;
        els.installBanner.setAttribute('aria-hidden', 'false');
    }

    function updatePwaStatus(message, persistent = false) {
        if (!els.pwaStatus) return;
        if (!message) {
            els.pwaStatus.hidden = true;
            els.pwaStatus.textContent = '';
            return;
        }
        els.pwaStatus.textContent = message;
        els.pwaStatus.hidden = false;
        if (!persistent) {
            setTimeout(() => {
                if (els.pwaStatus.textContent === message) updatePwaStatus('');
            }, 4200);
        }
    }

    function setupPwa() {
        if (isStandalone()) {
            els.body.dataset.pwa = 'standalone';
            hideInstallBanner();
            updatePwaStatus('Installed app mode', true);
            return;
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(() => updatePwaStatus(isStandalone() ? 'Installed app mode' : 'Ready for app install when your browser allows it'))
                .catch(() => updatePwaStatus('PWA install needs a secure browser connection'));
        } else {
            updatePwaStatus('This browser does not support app install');
        }

        if (isIosSafari()) {
            showInstallBanner({
                title: 'Use as a mobile app',
                subtitle: 'Add AirTextPad to your home screen for a full-screen app experience on iPhone.',
                hint: 'Safari: tap Share, then choose Add to Home Screen.',
                actionHidden: true
            });
            updatePwaStatus('iPhone install: Share -> Add to Home Screen', true);
        }
    }

    function showInstallButton(event) {
        event.preventDefault();
        state.deferredInstallPrompt = event;
        showInstallBanner({
            title: 'Install AirTextPad',
            subtitle: 'Pin it to your home screen for a faster, full-screen mobile workspace.',
            actionLabel: 'Install'
        });
        updatePwaStatus('Install AirTextPad for a full-screen mobile experience', true);
    }

    async function installApp() {
        if (!state.deferredInstallPrompt) {
            updatePwaStatus('Open this app over HTTPS or localhost to enable install');
            return;
        }
        state.deferredInstallPrompt.prompt();
        const result = await state.deferredInstallPrompt.userChoice;
        state.deferredInstallPrompt = null;
        // hide banner when prompt acted on
        if (els.installBanner) {
            els.installBanner.hidden = true;
            els.installBanner.setAttribute('aria-hidden', 'true');
        }
        updatePwaStatus(result.outcome === 'accepted' ? 'App installed' : 'Install dismissed');
    }

    function renderNotes() {
        const query = els.search.value.trim().toLowerCase();
        const filtered = state.notes.filter((note) => {
            return text(note.title).toLowerCase().includes(query) || text(note.content).toLowerCase().includes(query);
        });

        els.notesList.replaceChildren();

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-list';
            empty.textContent = query ? 'No matching snippets' : 'No saved snippets';
            els.notesList.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach((note) => {
            const card = document.createElement('article');
            card.className = 'note-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.dataset.noteId = note.id;
            card.classList.toggle('active', sameId(note.id, state.activeNoteId));

            const title = document.createElement('strong');
            title.textContent = normalizeTitle(note.title) || 'Untitled';
            const meta = document.createElement('span');
            meta.textContent = note.date || '';
            const excerpt = document.createElement('small');
            excerpt.textContent = text(note.content).replace(/\s+/g, ' ').slice(0, 92) || 'Empty note';

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'delete-note';
            deleteButton.dataset.icon = 'Delete';
            deleteButton.textContent = 'Delete';
            renderIconForControl(deleteButton);
            deleteButton.title = 'Delete note';
            deleteButton.setAttribute('aria-label', 'Delete note');
            deleteButton.dataset.deleteId = note.id;

            card.append(title, meta, excerpt, deleteButton);
            fragment.appendChild(card);
        });
        els.notesList.appendChild(fragment);
    }

    function loadNote(id) {
        if (state.dirty && !confirm('Discard unsaved changes?')) return;
        const note = state.notes.find((item) => sameId(item.id, id));
        if (!note) return;
        state.activeNoteId = String(note.id);
        state.dirty = false;
        els.editTitle.value = normalizeTitle(note.title);
        updateTitleCount();
        els.editContent.value = note.content || '';
        renderPreview(note);
        renderNotes();
        setView('preview', { openPanel: true });
    }

    function renderPreview(note = activeNote()) {
        const title = normalizeTitle(note?.title || els.editTitle.value) || 'Untitled';
        const content = note?.content ?? els.editContent.value;
        els.previewTitle.textContent = title;
        els.markdown.innerHTML = renderMarkdown(content);
    }

    function createNote() {
        if (state.dirty && !confirm('Discard unsaved changes?')) return;
        state.activeNoteId = null;
        state.dirty = false;
        els.editTitle.value = '';
        updateTitleCount();
        els.editContent.value = '';
        setView('editor', { openPanel: true });
        renderNotes();
        requestAnimationFrame(() => els.editTitle.focus());
    }

    function editNote() {
        const note = activeNote();
        if (note) {
            els.editTitle.value = normalizeTitle(note.title);
            updateTitleCount();
            els.editContent.value = note.content || '';
        }
        state.dirty = false;
        setView('editor', { openPanel: true });
        requestAnimationFrame(() => els.editContent.focus());
    }

    function saveNote() {
        const payload = {
            title: normalizeTitle(els.editTitle.value) || 'Untitled',
            content: els.editContent.value
        };

        const eventName = state.activeNoteId ? 'edit-note' : 'save-note';
        const outgoing = state.activeNoteId ? { id: state.activeNoteId, ...payload } : payload;
        socket.emit(eventName, outgoing, (ack) => {
            if (!ack?.ok) {
                notify(ack?.message || 'Save failed');
                return;
            }
            if (ack.id) state.activeNoteId = String(ack.id);
            state.dirty = false;
            renderPreview({ title: payload.title, content: payload.content });
            setView('preview', { openPanel: true });
            notify('Saved');
        });
    }

    function deleteNote(id) {
        const targetId = String(id);
        socket.emit('delete-note', targetId, (ack) => {
            if (!ack?.ok) {
                notify(ack?.message || 'Delete failed');
                return;
            }
            if (sameId(state.activeNoteId, targetId)) {
                state.activeNoteId = null;
                state.dirty = false;
                els.editTitle.value = '';
                updateTitleCount();
                els.editContent.value = '';
                setView('library', { openPanel: false });
            }
            notify('Deleted');
        });
    }

    function openDeleteDialog(id) {
        state.pendingDeleteNoteId = String(id);
        els.deleteNoteModal.hidden = false;
        els.deleteNoteModal.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => els.confirmDeleteNoteBtn.focus());
    }

    function closeDeleteDialog() {
        state.pendingDeleteNoteId = null;
        els.deleteNoteModal.setAttribute('aria-hidden', 'true');
        els.deleteNoteModal.hidden = true;
    }

    function openClearLiveDialog() {
        els.clearLiveModal.hidden = false;
        els.clearLiveModal.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => els.confirmClearLiveBtn.focus());
    }

    function closeClearLiveDialog() {
        els.clearLiveModal.setAttribute('aria-hidden', 'true');
        els.clearLiveModal.hidden = true;
    }

    function clearLiveSync() {
        els.scratchpad.value = '';
        socket.emit('update-live', '');
        notify('Cleared');
    }

    function closePanel() {
        els.body.dataset.panelOpen = 'false';
        if (state.view !== 'live') setView('library', { openPanel: false });
    }

    function copyText(value, successMessage) {
        const content = text(value);
        if (!content) {
            notify('Nothing to copy');
            return;
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(content).then(() => notify(successMessage)).catch(() => legacyCopy(content, successMessage));
            return;
        }
        legacyCopy(content, successMessage);
    }

    function legacyCopy(value, successMessage) {
        const copyBox = document.createElement('textarea');
        copyBox.value = value;
        copyBox.style.position = 'fixed';
        copyBox.style.left = '-9999px';
        document.body.appendChild(copyBox);
        copyBox.select();
        document.execCommand('copy');
        copyBox.remove();
        notify(successMessage);
    }

    function sendLiveUpdate() {
        if (!state.isAuthorized) {
            setAuthGate(true);
            return;
        }
        clearTimeout(state.liveTimer);
        state.liveTimer = setTimeout(() => {
            const outgoingText = els.scratchpad.value;
            state.lastPendingLiveText = outgoingText;
            clearTimeout(state.liveAckTimer);
            state.liveAckTimer = setTimeout(() => {
                notify('Sync delayed, retrying...');
                socket.emit('update-live', {
                    text: state.lastPendingLiveText,
                    rev: state.lastLiveRevision
                }, (retryAck) => {
                    if (retryAck?.ok) state.lastLiveRevision = Number(retryAck.rev || state.lastLiveRevision);
                });
            }, 2000);
            socket.emit('update-live', {
                text: outgoingText,
                rev: state.lastLiveRevision
            }, (ack) => {
                clearTimeout(state.liveAckTimer);
                if (!ack?.ok) {
                    if (ack?.reason === 'stale_revision') {
                        notify('Synced to latest revision');
                        state.lastLiveRevision = Number(ack.rev || state.lastLiveRevision);
                        return;
                    }
                    if (ack?.reason === 'rate_limited') return;
                    notify('Live sync send failed');
                    return;
                }
                state.lastLiveRevision = Number(ack.rev || state.lastLiveRevision);
            });
        }, 80);
    }

    function publishToLiveSync(value) {
        if (!state.isAuthorized) {
            setAuthGate(true);
            return;
        }

        const nextText = text(value);
        if (!nextText.trim()) {
            notify('Nothing to sync');
            return;
        }

        clearTimeout(state.liveTimer);
        clearTimeout(state.liveAckTimer);
        els.scratchpad.value = nextText;
        state.lastPendingLiveText = nextText;
        socket.emit('update-live', {
            text: nextText,
            rev: state.lastLiveRevision
        }, (ack) => {
            if (!ack?.ok) {
                if (ack?.reason === 'stale_revision') {
                    state.lastLiveRevision = Number(ack.rev || state.lastLiveRevision);
                    notify('Synced to latest revision');
                    return;
                }
                notify('Live sync send failed');
                return;
            }
            state.lastLiveRevision = Number(ack.rev || state.lastLiveRevision);
            notify('Sent to Live Sync');
        });

        closePortal();
        if (isMobileViewport()) setLiveFocusMode(true);
        setView('live', { openPanel: true });
        requestAnimationFrame(() => {
            els.scratchpad.focus();
            keepEditorUnlocked();
        });
    }

    function keepEditorUnlocked() {
        [els.editTitle, els.editContent].forEach((el) => {
            el.disabled = false;
            el.readOnly = false;
            el.removeAttribute('disabled');
            el.removeAttribute('readonly');
        });

        const canEditLive = state.isAuthorized;
        els.scratchpad.disabled = false;
        els.scratchpad.readOnly = !canEditLive;
        els.scratchpad.removeAttribute('disabled');
        if (canEditLive) {
            els.scratchpad.removeAttribute('readonly');
        } else {
            els.scratchpad.setAttribute('readonly', 'readonly');
        }
    }

    function bindEvents() {
        els.authSubmit.addEventListener('click', () => {
            const passcode = normalizePasscode(els.authInput.value);
            els.authInput.value = passcode;
            socket.emit('auth-passcode', passcode);
        });
        els.authInput.addEventListener('input', () => {
            enforceNumericPasscodeInput(els.authInput);
        });
        els.authInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                els.authSubmit.click();
            }
        });
        els.portalClose.addEventListener('click', enterAppToCanvas);
        els.showPortal.addEventListener('click', openPortal);
        els.supportOpen.addEventListener('click', openSupport);
        els.supportClose.addEventListener('click', closeSupport);
        els.themeToggle?.addEventListener('click', toggleTheme);
        if (els.installBannerBtn) els.installBannerBtn.addEventListener('click', installApp);
        if (els.installBannerClose) els.installBannerClose.addEventListener('click', () => {
            if (els.installBanner) {
                els.installBanner.hidden = true;
                els.installBanner.setAttribute('aria-hidden', 'true');
            }
            updatePwaStatus('Install dismissed', true);
        });
        els.supportModal.addEventListener('click', (event) => {
            if (event.target === els.supportModal) closeSupport();
        });
        els.checkUpdateBtn?.addEventListener('click', checkForUpdate);
        els.copyAppInfoBtn?.addEventListener('click', () => {
            const info = [
                `AirTextPad Pro ${els.appVersion?.textContent || '1.0.0'}`,
                `Active URL: ${els.hostUrl?.textContent || 'Detecting...'}`
            ].join('\n');
            copyText(info, 'App info copied');
        });
        els.serialKeyInput?.addEventListener('input', () => {
            els.serialKeyInput.value = normalizeSerialKey(els.serialKeyInput.value);
        });
        els.activateSerialBtn?.addEventListener('click', activateSerialKey);
        els.clearSerialBtn?.addEventListener('click', () => {
            els.serialKeyInput.value = '';
            writeLicenseState(null);
            renderLicenseState();
            notify('Serial key cleared');
        });
        els.exportNotesBtn?.addEventListener('click', exportNotes);
        els.importNotesBtn?.addEventListener('click', () => els.importNotesInput?.click());
        els.importNotesInput?.addEventListener('change', () => {
            importNotesFile(els.importNotesInput.files?.[0]);
        });
        els.copyIpBtn.addEventListener('click', () => copyText(els.portalIp.textContent, 'Link copied'));
        els.hostCopyUrlBtn.addEventListener('click', () => copyText(els.hostUrl.textContent, 'Host URL copied'));
        els.hostShowQrBtn.addEventListener('click', showPortalFromSupport);
        els.editHostSettingsBtn.addEventListener('click', () => {
            if (state.hostSettingsEditMode) {
                els.hostPasscodeInput.value = state.hostPasscode;
                els.hostRemoteAuthInput.checked = !!state.requireRemoteAuth;
                els.hostPortInput.value = String(state.preferredPort || 3000);
                els.hostAutoQrInput.checked = !!state.autoShowQr;
                updateRestartBadge();
                setHostSettingsEditMode(false);
                notify('Changes discarded');
                return;
            }
            setHostSettingsEditMode(true);
        });
        els.hostPasscodeInput.addEventListener('input', () => {
            enforceNumericPasscodeInput(els.hostPasscodeInput);
        });
        els.hostPortInput.addEventListener('input', () => {
            updateRestartBadge();
        });
        els.saveHostSettingsBtn.addEventListener('click', () => {
            if (!state.hostSettingsEditMode) return;
            const passcode = normalizePasscode(els.hostPasscodeInput.value);
            const nextPort = Number(els.hostPortInput.value || state.preferredPort || 3000);
            els.hostPasscodeInput.value = passcode;
            if (els.hostRemoteAuthInput.checked && !/^\d{4,}$/.test(passcode)) {
                notify('Passcode must be numeric and at least 4 digits');
                return;
            }
            if (!Number.isInteger(nextPort) || nextPort < 1024 || nextPort > 65535) {
                notify('Port must be between 1024 and 65535');
                return;
            }
            socket.emit('update-host-settings', {
                passcode,
                requireRemoteAuth: !!els.hostRemoteAuthInput.checked,
                port: nextPort,
                autoShowQr: !!els.hostAutoQrInput.checked
            });
        });
        els.refreshNetworkBtn.addEventListener('click', () => {
            socket.emit('request-network-refresh');
            notify('Refreshing network...');
        });
        $('new-note-btn').addEventListener('click', createNote);
        $('save-note-btn').addEventListener('click', saveNote);
        $('edit-note-btn').addEventListener('click', editNote);
        $('copy-note-btn').addEventListener('click', () => copyText(els.editContent.value, 'Snippet copied'));
        els.syncNoteLiveBtn.addEventListener('click', () => publishToLiveSync(els.editContent.value));
        els.syncDraftLiveBtn.addEventListener('click', () => publishToLiveSync(els.editContent.value));
        $('copy-live-btn').addEventListener('click', () => copyText(els.scratchpad.value, 'Live text copied'));
        $('clear-live-btn').addEventListener('click', () => {
            if (!els.scratchpad.value) {
                clearLiveSync();
                return;
            }
            openClearLiveDialog();
        });

        ['back-preview-btn', 'back-editor-btn'].forEach((id) => $(id).addEventListener('click', closePanel));
        els.liveExitLink.addEventListener('click', () => {
            setLiveFocusMode(false);
            setView('library', { openPanel: false });
        });
        ['library-tab', 'mobile-library-btn'].forEach((id) => $(id)?.addEventListener('click', () => {
            setLiveFocusMode(false);
            setView('library', { openPanel: false });
        }));
        ['live-tab', 'mobile-live-btn'].forEach((id) => $(id)?.addEventListener('click', () => {
            closePortal();
            if (isMobileViewport()) setLiveFocusMode(true);
            setView('live', { openPanel: true });
            requestAnimationFrame(() => {
                els.scratchpad.focus();
                keepEditorUnlocked();
            });
        }));

        els.search.addEventListener('input', renderNotes);
        els.editTitle.addEventListener('input', () => {
            updateTitleCount();
            state.dirty = true;
        });
        els.editContent.addEventListener('input', () => { state.dirty = true; });
        els.scratchpad.addEventListener('input', sendLiveUpdate);
        els.cancelDeleteNoteBtn.addEventListener('click', closeDeleteDialog);
        els.confirmDeleteNoteBtn.addEventListener('click', () => {
            if (state.pendingDeleteNoteId !== null) deleteNote(state.pendingDeleteNoteId);
            closeDeleteDialog();
        });
        els.deleteNoteModal.addEventListener('click', (event) => {
            if (event.target === els.deleteNoteModal) closeDeleteDialog();
        });
        els.cancelClearLiveBtn.addEventListener('click', closeClearLiveDialog);
        els.confirmClearLiveBtn.addEventListener('click', () => {
            clearLiveSync();
            closeClearLiveDialog();
        });
        els.clearLiveModal.addEventListener('click', (event) => {
            if (event.target === els.clearLiveModal) closeClearLiveDialog();
        });
        document.querySelectorAll('.format-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const action = btn.dataset.action;
                const textarea = document.getElementById(target);
                if (!textarea) return;
                if (target === 'scratchpad' && !state.isAuthorized) {
                    setAuthGate(true);
                    return;
                }
                applyFormat(textarea, action);
            });
        });

        els.notesList.addEventListener('click', (event) => {
            const deleteTarget = event.target.closest('[data-delete-id]');
            if (deleteTarget) {
                event.stopPropagation();
                openDeleteDialog(deleteTarget.dataset.deleteId);
                return;
            }
            const card = event.target.closest('[data-note-id]');
            if (card) loadNote(card.dataset.noteId);
        });
        els.notesList.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('[data-note-id]');
            if (!card) return;
            event.preventDefault();
            loadNote(card.dataset.noteId);
        });

        window.addEventListener('focus', keepEditorUnlocked);
        document.addEventListener('visibilitychange', keepEditorUnlocked);
        window.addEventListener('beforeinstallprompt', showInstallButton);
        window.addEventListener('appinstalled', () => {
            if (els.installBanner) {
                els.installBanner.hidden = true;
                els.installBanner.setAttribute('aria-hidden', 'true');
            }
            updatePwaStatus('App installed', true);
        });
    }

    // Install banner handlers (if present)
    function hideInstallBanner() {
        if (!els.installBanner) return;
        els.installBanner.hidden = true;
        els.installBanner.setAttribute('aria-hidden', 'true');
    }

    function applyNetworkData(data) {
        const url = `http://${data.localIP}:${data.port}/?view=live`;
        if (data.qrCode) els.portalQr.src = data.qrCode;
        els.portalIp.textContent = url;
        if (!state.requireRemoteAuth) {
            els.portalPasscode.textContent = 'Password: Open access';
        } else if (state.canManageHost) {
            els.portalPasscode.textContent = `Password: ${state.hostPasscode || 'Not set'}`;
        } else {
            els.portalPasscode.textContent = 'Password required';
        }
        els.hostUrl.textContent = url;
        state.activePort = Number(data.port || 0);
        const preferred = Number(data.preferredPort || state.preferredPort || data.port || 3000);
        state.preferredPort = preferred;
        const fallbackActive = Boolean(data.portFallbackActive);
        state.portFallbackActive = fallbackActive;
        els.hostPortStatus.textContent = fallbackActive
            ? `Preferred ${preferred}, using ${data.port} (port busy)`
            : `Using preferred port ${preferred}`;
        const available = Array.isArray(data.addresses) ? data.addresses.filter(Boolean) : [];
        const connectionText = available.length > 1
            ? `Connected. ${available.length} network routes detected.`
            : 'Connected. Single route detected.';
        els.portalStatus.textContent = data.passcodeEnabled
            ? `${connectionText} Remote password protection is ON.`
            : `${connectionText} Remote password protection is OFF.`;
    }

    socket.on('auth-required', (data) => {
        setAuthGate(!!data?.required);
    });

    socket.on('auth-success', () => {
        state.isAuthorized = true;
        const current = normalizePasscode(els.authInput.value);
        if (/^\d{4,}$/.test(current)) sessionStorage.setItem(AUTH_CACHE_KEY, current);
        setAuthGate(false);
        notify('Access unlocked');
    });

    socket.on('auth-failed', (data) => {
        state.isAuthorized = false;
        sessionStorage.removeItem(AUTH_CACHE_KEY);
        els.authError.hidden = false;
        els.authInput.select();
        keepEditorUnlocked();
        notify(data?.message || 'Incorrect passcode');
    });

    socket.on('init-data', (data) => {
        state.notes = Array.isArray(data.notes) ? data.notes : [];
        state.lastLiveRevision = Number(data.liveRevision || 0);
        if (els.appVersion && data.appVersion) els.appVersion.textContent = text(data.appVersion);
        state.hostPasscode = text(data.hostPasscode || '');
        setHostManagementState(Boolean(data.canManageHost));
        state.requireRemoteAuth = Boolean(data.requireRemoteAuth);
        state.preferredPort = Number(data.preferredPort || 3000);
        state.autoShowQr = Boolean(data.autoShowQr);
        els.hostPasscodeInput.value = state.canManageHost ? normalizePasscode(state.hostPasscode) : '';
        els.hostRemoteAuthInput.checked = state.requireRemoteAuth;
        els.hostPortInput.value = String(state.preferredPort || 3000);
        els.hostAutoQrInput.checked = state.autoShowQr;
        updateRestartBadge();
        setHostSettingsEditMode(false);
        if (!state.dirty) els.scratchpad.value = data.currentText || '';
        applyNetworkData(data);

        renderNotes();

        if (!state.initialized) {
            state.initialized = true;
            if (state.initialRouteView === 'live') {
                setLiveFocusMode(isMobileViewport());
                setView('live', { openPanel: true });
            } else {
                setLiveFocusMode(false);
                setView('library', { openPanel: false });
            }
            const shouldShowDesktopQrFirst = !isMobileViewport() && state.routeViewParam !== 'live';
            if (shouldShowDesktopQrFirst) {
                openPortal();
            } else {
                closePortal();
            }
        }

        keepEditorUnlocked();
    });

    socket.on('network-updated', (data) => {
        applyNetworkData(data);
        notify('Network updated');
    });

    socket.on('host-settings-updated', (data) => {
        if (data?.success) {
            state.hostPasscode = text(els.hostPasscodeInput.value || '');
            state.requireRemoteAuth = !!els.hostRemoteAuthInput.checked;
            state.preferredPort = Number(els.hostPortInput.value || 3000);
            state.autoShowQr = !!els.hostAutoQrInput.checked;
            updateRestartBadge();
            setHostSettingsEditMode(false);
            const message = data.portUpdated
                ? 'Host settings saved. Restart app to apply new port.'
                : 'Host settings saved.';
            notify(message);
            return;
        }
        notify(data?.message || 'Unable to save host settings');
    });

    socket.on('sync-live', (payload) => {
        const nextRev = Number(payload?.rev || 0);
        if (nextRev && nextRev < state.lastLiveRevision) return;
        if (nextRev) state.lastLiveRevision = nextRev;
        const nextValue = typeof payload === 'object' && payload !== null
            ? coerceLiveText(payload.text)
            : coerceLiveText(payload);
        if (els.scratchpad.value === nextValue) return;

        if (document.activeElement === els.scratchpad) {
            const prevLength = els.scratchpad.value.length;
            const start = els.scratchpad.selectionStart || 0;
            const end = els.scratchpad.selectionEnd || 0;
            const delta = nextValue.length - prevLength;
            els.scratchpad.value = nextValue;
            const nextPos = Math.max(0, start + delta);
            const nextEnd = Math.max(0, end + delta);
            els.scratchpad.setSelectionRange(nextPos, nextEnd);
            return;
        }

        els.scratchpad.value = nextValue;
    });

    socket.on('note-saved-id', (id) => {
        state.activeNoteId = String(id);
    });

    function refreshActiveNoteIfNeeded() {
        const note = activeNote();
        if (note && !state.dirty && state.view !== 'editor') {
            els.editTitle.value = normalizeTitle(note.title);
            updateTitleCount();
            els.editContent.value = note.content || '';
            renderPreview(note);
        }
        renderNotes();
        keepEditorUnlocked();
    }

    socket.on('notes-updated', (notes) => {
        state.notes = Array.isArray(notes) ? notes : [];
        refreshActiveNoteIfNeeded();
    });

    socket.on('note-created', (note) => {
        if (!note || !note.id) return;
        state.notes = [note, ...state.notes.filter((n) => !sameId(n.id, note.id))];
        refreshActiveNoteIfNeeded();
    });

    socket.on('note-updated', (note) => {
        if (!note || !note.id) return;
        state.notes = state.notes.map((n) => sameId(n.id, note.id) ? note : n);
        refreshActiveNoteIfNeeded();
    });

    socket.on('note-deleted', (payload) => {
        const targetId = String(payload?.id || '');
        if (!targetId) return;
        state.notes = state.notes.filter((n) => !sameId(n.id, targetId));
        if (sameId(state.activeNoteId, targetId)) {
            state.activeNoteId = null;
            state.dirty = false;
            els.editTitle.value = '';
            updateTitleCount();
            els.editContent.value = '';
            setView('library', { openPanel: false });
        }
        refreshActiveNoteIfNeeded();
    });

    socket.io.on('reconnect_attempt', () => {
        notify('Reconnecting...');
    });
    socket.io.on('reconnect', () => {
        notify('Connection restored');
    });
    socket.io.on('error', () => {
        notify('Network error');
    });

    renderButtonIcons();
    applyTheme(currentTheme(), false);
    renderLicenseState();
    bindEvents();
    setupPwa();
    updateTabs();
    updateTitleCount();
    keepEditorUnlocked();
})();
