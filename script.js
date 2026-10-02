const ageGate = document.getElementById('ageGate');
const ageGateYes = document.getElementById('ageGateYes');
const ageGateNo = document.getElementById('ageGateNo');

function onTurnstileSuccess() {
  if (ageGateYes) {
    ageGateYes.disabled = false;
  }
}

if (ageGate) {
  let alreadyVerified = false;
  try {
    alreadyVerified = localStorage.getItem('factureAgeVerified') === 'true';
  } catch (error) {
    alreadyVerified = false;
  }

  if (!alreadyVerified) {
    ageGate.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  ageGateYes.addEventListener('click', () => {
    ageGate.hidden = true;
    document.body.style.overflow = '';
    try {
      localStorage.setItem('factureAgeVerified', 'true');
    } catch (error) {
      // Storage unavailable (e.g. private browsing) - not required to proceed.
    }
  });

  ageGateNo.addEventListener('click', () => {
    window.open('', '_self');
    window.close();
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 200);
  });
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
