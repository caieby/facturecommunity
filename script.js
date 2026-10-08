const ageGate = document.getElementById('ageGate');

// Not a one-time "agree once, never see again" gate: past the cooldown
// window, each page load has a random chance of re-prompting, so bots
// can't just solve it once and skip verification forever after.
const HUMAN_VERIFY_KEY = 'factureHumanVerifiedAt';
const HUMAN_REVERIFY_COOLDOWN_MS = 30 * 60 * 1000;
const HUMAN_REVERIFY_CHANCE = 0.15;

function onTurnstileSuccess() {
  if (ageGate) {
    ageGate.hidden = true;
    document.body.style.overflow = '';
  }
  try {
    localStorage.setItem(HUMAN_VERIFY_KEY, String(Date.now()));
  } catch (error) {
    // Storage unavailable (e.g. private browsing) - not required to proceed.
  }
  document.dispatchEvent(new CustomEvent('facture:humanVerified'));
}

if (ageGate) {
  let lastVerifiedAt = 0;
  try {
    lastVerifiedAt = Number(localStorage.getItem(HUMAN_VERIFY_KEY)) || 0;
  } catch (error) {
    lastVerifiedAt = 0;
  }

  const withinCooldown = Date.now() - lastVerifiedAt < HUMAN_REVERIFY_COOLDOWN_MS;
  const shouldShow = lastVerifiedAt === 0 || (!withinCooldown && Math.random() < HUMAN_REVERIFY_CHANCE);

  if (shouldShow) {
    ageGate.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

const menuToggle = document.getElementById('menuToggle');
const menuDropdown = document.getElementById('menuDropdown');

if (menuToggle && menuDropdown) {
  const isSiteMenu = !!menuToggle.closest('.site-menu');

  menuToggle.addEventListener('click', () => {
    const isOpen = menuDropdown.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
    if (isSiteMenu) {
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }
  });

  document.addEventListener('click', (event) => {
    if (!menuToggle.contains(event.target) && !menuDropdown.contains(event.target)) {
      menuDropdown.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      if (isSiteMenu) {
        document.body.style.overflow = '';
      }
    }
  });
}

document.querySelectorAll('.copy-button').forEach((button) => {
  const target = document.getElementById(button.dataset.copyTarget);
  if (!target) return;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      const originalLabel = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalLabel;
      }, 1500);
    } catch (error) {
      button.textContent = 'Failed';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 1500);
    }
  });
});

let downloadToastEl = null;
let downloadToastHideTimer = null;
let activeDownloadHref = '';
let activeDownloadName = '';

function ensureDownloadToast() {
  if (downloadToastEl) return downloadToastEl;

  const toast = document.createElement('div');
  toast.className = 'download-toast';
  toast.innerHTML = `
    <span class="download-toast-text">Download started, don't see it?</span>
    <button type="button" class="download-toast-button">Click here to restart the download!</button>
  `;
  document.body.appendChild(toast);

  toast.querySelector('.download-toast-button').addEventListener('click', () => {
    if (!activeDownloadHref) return;
    const tempLink = document.createElement('a');
    tempLink.href = activeDownloadHref;
    tempLink.download = activeDownloadName;
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
  });

  downloadToastEl = toast;
  return toast;
}

document.querySelectorAll('a[download]').forEach((link) => {
  link.addEventListener('click', () => {
    activeDownloadHref = link.getAttribute('href');
    activeDownloadName = link.getAttribute('download') || '';

    const toast = ensureDownloadToast();
    toast.classList.add('visible');
    clearTimeout(downloadToastHideTimer);
    downloadToastHideTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 10000);
  });
});

const galleryMedia = document.getElementById('galleryMedia');
const galleryPrev = document.getElementById('galleryPrev');
const galleryNext = document.getElementById('galleryNext');
const galleryDots = document.getElementById('galleryDots');

if (galleryMedia && galleryPrev && galleryNext && galleryDots) {
  const items = [
    'assets/img1.gif',
    'assets/med2.gif',
    'assets/med3.gif',
    'assets/med4.gif',
    'assets/med5.gif',
    'assets/med6.gif',
    'assets/med7.gif',
  ];
  let currentIndex = 0;

  items.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gallery-dot';
    dot.setAttribute('aria-label', `Go to media ${index + 1}`);
    dot.addEventListener('click', () => showItem(index));
    galleryDots.appendChild(dot);
  });

  const dots = galleryDots.querySelectorAll('.gallery-dot');

  function showItem(index) {
    currentIndex = (index + items.length) % items.length;
    galleryMedia.src = items[currentIndex];
    galleryMedia.alt = `Community media ${currentIndex + 1}`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
  }

  galleryPrev.addEventListener('click', () => showItem(currentIndex - 1));
  galleryNext.addEventListener('click', () => showItem(currentIndex + 1));

  showItem(0);
}

let comingSoonModalEl = null;

function ensureComingSoonModal() {
  if (comingSoonModalEl) return comingSoonModalEl;

  const modal = document.createElement('div');
  modal.className = 'hub-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="hub-modal-card">
      <button type="button" class="hub-modal-close" aria-label="Close">&times;</button>
      <h2 class="subsection-title">Coming Soon</h2>
      <p class="section-intro">FactureHub isn't open yet — check back soon!</p>
      <button type="button" class="action-button">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => { modal.hidden = true; };
  modal.querySelector('.hub-modal-close').addEventListener('click', close);
  modal.querySelector('.action-button').addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  comingSoonModalEl = modal;
  return modal;
}

document.querySelectorAll('a[href="social/"], a[href="/social/"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    ensureComingSoonModal().hidden = false;
  });
});

if (typeof supabase !== 'undefined') {
  const presenceClient = supabase.createClient(
    'https://vrhfajwulxjfmgzyzaxx.supabase.co',
    'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB'
  );

  presenceClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;

    presenceClient
      .from('profiles')
      .select('theme')
      .eq('id', session.user.id)
      .single()
      .then(({ data: profile }) => {
        if (!profile || !profile.theme) return;
        let stored = null;
        try { stored = localStorage.getItem('facture-theme'); } catch (e) {}
        if (profile.theme === stored) return;

        try { localStorage.setItem('facture-theme', profile.theme); } catch (e) {}
        if (profile.theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      });

    const presenceChannel = presenceClient.channel('facturehub-online', {
      config: { presence: { key: session.user.id } },
    });

    presenceChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });
  });
}

const REPORT_REASONS = [
  'Illegal Content',
  'Disturbing content (such as gore or scat)',
  'Hateful/extremist Content',
  'Harassment or Bullying',
  'Spam or Scam',
  'Impersonation',
  'Other',
];

let reportModalEl = null;
let reportSubmitHandler = null;

function ensureReportModal() {
  if (reportModalEl) return reportModalEl;

  const modal = document.createElement('div');
  modal.className = 'hub-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="hub-modal-card">
      <button type="button" class="hub-modal-close" aria-label="Close">&times;</button>
      <h2 class="subsection-title">Submit a Report</h2>
      <form class="hub-form" id="reportForm">
        ${REPORT_REASONS.map((r, i) => `
          <label class="report-reason-option">
            <input type="radio" name="reportReason" value="${r}" ${i === 0 ? 'required' : ''}>
            <span>${r}</span>
          </label>
        `).join('')}
        <textarea class="hub-form-input hub-form-textarea" id="reportCustomReason" placeholder="Describe the issue..." maxlength="500" hidden></textarea>
        <p class="hub-form-error" id="reportFormError"></p>
        <p class="hub-form-status" id="reportFormStatus"></p>
        <button type="submit" class="action-button">Submit Report</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => { modal.hidden = true; };
  modal.querySelector('.hub-modal-close').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });

  const customReasonInput = modal.querySelector('#reportCustomReason');
  modal.querySelectorAll('input[name="reportReason"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      customReasonInput.hidden = !(radio.checked && radio.value === 'Other');
    });
  });

  modal.querySelector('#reportForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = modal.querySelector('#reportFormError');
    const statusEl = modal.querySelector('#reportFormStatus');
    errorEl.textContent = '';
    statusEl.textContent = '';

    const selected = modal.querySelector('input[name="reportReason"]:checked');
    if (!selected) {
      errorEl.textContent = 'Please select a reason.';
      return;
    }

    const reason = selected.value;
    const customReason = reason === 'Other' ? customReasonInput.value.trim() : null;
    if (reason === 'Other' && !customReason) {
      errorEl.textContent = 'Please describe the issue.';
      return;
    }

    if (!reportSubmitHandler) return;

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const { error } = await reportSubmitHandler(reason, customReason);
    submitButton.disabled = false;

    if (error) {
      errorEl.textContent = error.message;
      return;
    }

    statusEl.textContent = 'Report submitted. Thank you for helping keep Facture safe.';
    setTimeout(close, 1500);
  });

  reportModalEl = modal;
  return modal;
}

let moderationModalEl = null;
let moderationWarnHandler = null;
let moderationTerminateHandler = null;

function ensureModerationModal() {
  if (moderationModalEl) return moderationModalEl;

  const modal = document.createElement('div');
  modal.className = 'hub-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="hub-modal-card">
      <button type="button" class="hub-modal-close" aria-label="Close">&times;</button>
      <h2 class="subsection-title">Moderation Actions</h2>
      <p class="section-intro" id="moderationTarget"></p>
      <p class="section-intro" id="moderationWarningCount"></p>

      <form class="hub-form" id="moderationForm">
        <label class="hub-form-label" for="moderationReason">Reason (required)</label>
        <textarea class="hub-form-input hub-form-textarea" id="moderationReason" maxlength="500" required></textarea>

        <p class="hub-form-error" id="moderationError"></p>
        <p class="hub-form-status" id="moderationStatus"></p>

        <div class="moderation-action-buttons">
          <button type="submit" class="action-button" id="moderationWarnButton" data-action="warn">Issue Warning</button>
          <button type="submit" class="action-button moderation-terminate-button" id="moderationTerminateButton" data-action="terminate">Terminate Account</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => { modal.hidden = true; };
  modal.querySelector('.hub-modal-close').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });

  modal.querySelector('#moderationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = modal.querySelector('#moderationError');
    const statusEl = modal.querySelector('#moderationStatus');
    errorEl.textContent = '';
    statusEl.textContent = '';

    const reason = modal.querySelector('#moderationReason').value.trim();
    if (!reason) {
      errorEl.textContent = 'Please provide a reason.';
      return;
    }

    const action = event.submitter ? event.submitter.dataset.action : 'warn';
    if (action === 'terminate' && !window.confirm('Permanently terminate this account? This can be appealed, but is a severe action.')) {
      return;
    }

    const buttons = modal.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });

    const handler = action === 'terminate' ? moderationTerminateHandler : moderationWarnHandler;
    const { error, result } = handler ? await handler(reason) : { error: new Error('No handler configured.') };

    buttons.forEach((b) => { b.disabled = false; });

    if (error) {
      errorEl.textContent = error.message;
      return;
    }

    statusEl.textContent = action === 'terminate'
      ? 'Account terminated.'
      : `Warning issued (warning #${result}).`;
    setTimeout(close, 1500);
  });

  moderationModalEl = modal;
  return modal;
}

function openModerationModal(targetLabel, warningCount, onWarn, onTerminate) {
  moderationWarnHandler = onWarn;
  moderationTerminateHandler = onTerminate;
  const modal = ensureModerationModal();
  modal.querySelector('#moderationForm').reset();
  modal.querySelector('#moderationTarget').textContent = `Target: ${targetLabel}`;
  modal.querySelector('#moderationWarningCount').textContent = `Current warning count: ${warningCount}`;
  modal.querySelector('#moderationError').textContent = '';
  modal.querySelector('#moderationStatus').textContent = '';
  modal.hidden = false;
}

function openReportModal(onSubmit) {
  reportSubmitHandler = onSubmit;
  const modal = ensureReportModal();
  modal.querySelector('#reportForm').reset();
  modal.querySelector('#reportCustomReason').hidden = true;
  modal.querySelector('#reportFormError').textContent = '';
  modal.querySelector('#reportFormStatus').textContent = '';
  modal.hidden = false;
}

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  const input = document.getElementById(button.dataset.passwordToggle);
  if (!input) return;

  button.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    button.classList.toggle('hub-password-toggle--active', !showing);
  });
});
