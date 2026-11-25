(() => {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('nav-links');
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.textContent = isOpen ? '×' : '☰';
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
      }
    });
  }

  const API_URL = 'https://script.google.com/macros/s/AKfycbyfmQu1aS4RoALeCUu8H0I7ZGFu5rxxwvflT0f5Snut1islwGGtmmPTjfAqft69uv3sCg/exec';
  const INSTALLER_URL = 'https://github.com/AirTextPad/airtext-pad/releases/latest/download/AirTextPadSetup.exe';
  const modal = document.getElementById('download-modal');
  const form = document.getElementById('subscriber-form');
  const emailInput = document.getElementById('subscriber-email');
  const consent = document.getElementById('subscriber-consent');
  const status = document.getElementById('form-status');
  const submit = document.getElementById('subscriber-submit');
  const manual = document.getElementById('manual-download');
  const responseFrame = document.getElementById('subscriber-response-frame');
  const dialog = modal.querySelector('.download-dialog');
  const loadingPanel = document.getElementById('download-loading');
  let waitingForResponse = false;
  let responseTimer = null;

  function setStatus(message, kind = 'info') {
    status.style.color = kind === 'error' ? '#b42318' : kind === 'success' ? '#16804a' : '#627187';
    status.textContent = message;
  }

  function startDownload() {
    // Trigger a real browser download navigation; keep a visible manual link as fallback.
    const link = document.createElement('a');
    link.href = INSTALLER_URL;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    manual.classList.add('visible');
  }

  function showPageNotice(message) {
    let notice = document.getElementById('download-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'download-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.style.cssText = 'position:fixed;z-index:1100;right:22px;top:22px;right:22px;max-width:min(420px,calc(100vw - 32px));padding:14px 18px;border:1px solid #cfe8dc;border-radius:13px;background:#effaf4;color:#176b46;box-shadow:0 12px 35px #0002;font:600 13px/1.5 "DM Sans",sans-serif';
      document.body.appendChild(notice);
    }
    notice.innerHTML = '';
    const bell = document.createElement('span');
    bell.setAttribute('aria-hidden', 'true');
    bell.textContent = '♧';
    bell.style.cssText = 'flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:#eaf1ff;color:#2768f5;font-size:18px';
    const text = document.createElement('span');
    text.textContent = message;
    notice.append(bell, text);
    notice.style.display = 'flex';
    window.setTimeout(() => { notice.style.display = 'none'; }, 6500);
  }

  function openModal(event) {
    if (event) event.preventDefault();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    form.reset();
    dialog.classList.remove('is-loading');
    loadingPanel.hidden = true;
    submit.disabled = false;
    submit.textContent = 'Download AirTextPad';
    waitingForResponse = false;
    if (responseTimer) window.clearTimeout(responseTimer);
    responseTimer = null;
    setStatus('');
    manual.classList.remove('visible');
    window.setTimeout(() => emailInput.focus(), 50);
  }

  function closeModal() {
    dialog.classList.remove('is-loading');
    loadingPanel.hidden = true;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function completeDownload(message) {
    waitingForResponse = false;
    if (responseTimer) window.clearTimeout(responseTimer);
    responseTimer = null;
    submit.disabled = false;
    submit.textContent = 'Download AirTextPad';
    startDownload();
    closeModal();
    showPageNotice(message + ' Your download is starting.');
  }

  // Apps Script can complete the POST inside the hidden iframe even when
  // its postMessage is blocked by Google's cross-origin redirect. The final
  // iframe load is the fallback confirmation that the request returned.
  responseFrame.addEventListener('load', () => {
    if (!waitingForResponse) return;
    completeDownload('Your email submission has been received.');
  });

  document.querySelectorAll('[data-download-trigger]').forEach(link => link.addEventListener('click', openModal));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
form.addEventListener('submit', event => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const hasEmail = email.length > 0;
  const hasConsent = consent.checked;

  // No email: download immediately, without creating a subscriber record.
  if (!hasEmail) {
    dialog.classList.add('is-loading');
    loadingPanel.hidden = false;

    window.setTimeout(() => {
      startDownload();
      closeModal();
      showPageNotice(
        'Your download is starting. No email address was submitted.'
      );
    }, 350);

    return;
  }

  // If an email is supplied, validate it whether consent is checked or not.
  if (!emailInput.checkValidity()) {
    emailInput.reportValidity();
    return;
  }

  if (waitingForResponse) return;

  waitingForResponse = true;
  submit.disabled = true;
  submit.textContent = 'Saving email…';

  dialog.classList.add('is-loading');
  loadingPanel.hidden = false;
  setStatus('');

  const oldForm = document.getElementById('subscriber-post-form');
  if (oldForm) oldForm.remove();

  const postForm = document.createElement('form');
  postForm.id = 'subscriber-post-form';
  postForm.method = 'POST';
  postForm.action = API_URL;
  postForm.target = 'subscriber-response-frame';
  postForm.hidden = true;

  [
    ['email', email],
    ['consent', hasConsent ? 'true' : 'false']
  ].forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    postForm.appendChild(input);
  });

  document.body.appendChild(postForm);
  postForm.submit();

  responseTimer = window.setTimeout(() => {
    if (!waitingForResponse) return;

    waitingForResponse = false;
    submit.disabled = false;
    submit.textContent = 'Download AirTextPad';

    dialog.classList.remove('is-loading');
    loadingPanel.hidden = true;

    setStatus(
      'We could not confirm that your email was saved. Please try again.',
      'error'
    );
  }, 10000);
});

  window.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.type !== 'airtextpad-subscription-result' || !waitingForResponse) return;

    if (responseTimer) window.clearTimeout(responseTimer);
    responseTimer = null;

    if (data.success) {
      const message = data.alreadySubscribed
        ? 'Welcome back — this email is already subscribed.'
        : (data.message || 'You are subscribed to AirTextPad updates.');
      completeDownload(message);
    } else {
      waitingForResponse = false;
      submit.disabled = false;
      submit.textContent = 'Download AirTextPad';
      setStatus(data.message || 'We could not save your subscription. Please try again, or download without subscribing.', 'error');
    }
  });
})();
