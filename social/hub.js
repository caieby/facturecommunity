const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authButtons = document.getElementById('hubAuthButtons');
const loginButton = document.getElementById('hubLoginButton');
const signupButton = document.getElementById('hubSignupButton');
const loginModal = document.getElementById('hubLoginModal');
const signupModal = document.getElementById('hubSignupModal');

function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

document.querySelectorAll('[data-modal-close]').forEach((button) => {
  button.addEventListener('click', () => {
    closeModal(document.getElementById(button.dataset.modalClose));
  });
});

loginButton?.addEventListener('click', () => openModal(loginModal));
signupButton?.addEventListener('click', () => openModal(signupModal));

document.getElementById('hubSignupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById('hubSignupError');
  const statusEl = document.getElementById('hubSignupStatus');
  errorEl.textContent = '';
  statusEl.textContent = '';

  const password = document.getElementById('hubSignupPassword').value;
  const email = document.getElementById('hubSignupEmail').value.trim();

  if (!email) {
    errorEl.textContent = 'Please enter your email.';
    return;
  }
  if (password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/social/home.html`,
      },
    });

    if (error) {
      errorEl.textContent = error.message;
      submitButton.disabled = false;
      return;
    }

    if (data.session) {
      window.location.href = 'home.html';
      return;
    }

    event.target.reset();
    statusEl.textContent = 'Account created! Check your email and click the confirmation link, then come back to this page and log in.';
    submitButton.disabled = false;
  } catch (err) {
    errorEl.textContent = 'Something went wrong. Please try again.';
    submitButton.disabled = false;
  }
});

document.getElementById('hubLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById('hubLoginError');
  errorEl.textContent = '';

  const email = document.getElementById('hubLoginEmail').value.trim();
  const password = document.getElementById('hubLoginPassword').value;

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      errorEl.textContent = error.message.toLowerCase().includes('confirm')
        ? 'Please confirm your email before logging in.'
        : 'Incorrect email or password.';
      submitButton.disabled = false;
      return;
    }

    window.location.href = 'home.html';
  } catch (err) {
    errorEl.textContent = 'Something went wrong. Please try again.';
    submitButton.disabled = false;
  }
});

async function redirectIfLoggedIn() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;

  const { error } = await client.auth.getUser();
  if (error) {
    await client.auth.signOut();
    return;
  }

  window.location.href = 'home.html';
}

redirectIfLoggedIn();
