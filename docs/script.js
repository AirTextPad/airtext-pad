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
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
      }
    });
  }

  const API_URL = 'https://script.google.com/macros/s/AKfycbyQLFahxPsRbB6mH-Yy_tCdy17X-Ew7nz6RKZ7ZKQ_fr2SxFOYnXLA-dSy8sh8u1ddK2A/exec';
  const INSTALLER_URL = 'https://github.com/AirTextPad/airtext-pad/releases/latest/download/AirTextPadSetup.exe';
  const modal = document.getElementById('download-modal');
  const form = document.getElementById('subscriber-form');
  const emailInput = document.getElementById('subscriber-email');
  const consent = document.getElementById('subscriber-consent');
  const status = document.getElementById('form-status');
  const submit = document.getElementById('subscriber-submit');
  const manual = document.getElementById('manual-download');
  const frame = document.getElementById('subscriber-response-frame');
  let waitingForResponse = false;

  function startDownload() {
    window.location.href = INSTALLER_URL;
    manual.classList.add('visible');
  }
  function openModal(event) {
    if (event) event.preventDefault();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    status.textContent = '';
    manual.classList.remove('visible');
    window.setTimeout(() => emailInput.focus(), 50);
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-download-trigger]').forEach(link => link.addEventListener('click', openModal));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.getElementById('continue-download').addEventListener('click', () => {
    closeModal();
    startDownload();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!emailInput.checkValidity()) {
      emailInput.reportValidity();
      return;
    }
    if (!consent.checked) {
      status.textContent = 'Tick the consent box to subscribe, or choose “Continue without subscribing”.';
      return;
    }
    if (waitingForResponse) return;

    waitingForResponse = true;
    submit.disabled = true;
    submit.textContent = 'Saving subscription…';
    status.style.color = '#627187';
    status.textContent = 'Saving your email securely to the subscriber sheet…';

    const oldForm = document.getElementById('subscriber-post-form');
    if (oldForm) oldForm.remove();
    const postForm = document.createElement('form');
    postForm.id = 'subscriber-post-form';
    postForm.method = 'POST';
    postForm.action = API_URL;
    postForm.target = 'subscriber-response-frame';
    postForm.hidden = true;
    const fields = { email: emailInput.value.trim(), consent: 'true' };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      postForm.appendChild(input);
    });
    document.body.appendChild(postForm);
    postForm.submit();
  });

  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'airtextpad-subscription-result') return;
    waitingForResponse = false;
    submit.disabled = false;
    submit.textContent = 'OK — Download AirTextPad';
    if (data.success) {
      status.style.color = '#16804a';
      status.textContent = data.message || 'Subscription saved. Starting your download…';
      startDownload();
    } else {
      status.style.color = '#b42318';
      status.textContent = data.message || 'We could not save your subscription. Please try again.';
    }
  });
})();