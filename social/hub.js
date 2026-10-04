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

const forgotPasswordLink = document.getElementById('hubForgotPasswordLink');
const forgotPasswordModal = document.getElementById('hubForgotPasswordModal');
const hubForgotEmailForm = document.getElementById('hubForgotEmailForm');
const hubForgotEmail = document.getElementById('hubForgotEmail');
const hubForgotEmailError = document.getElementById('hubForgotEmailError');
const hubForgotResetForm = document.getElementById('hubForgotResetForm');
const hubForgotCode = document.getElementById('hubForgotCode');
const hubForgotNewPassword = document.getElementById('hubForgotNewPassword');
const hubForgotConfirmPassword = document.getElementById('hubForgotConfirmPassword');
const hubForgotResetError = document.getElementById('hubForgotResetError');
const hubForgotResetStatus = document.getElementById('hubForgotResetStatus');
let forgotPasswordEmail = '';

forgotPasswordLink?.addEventListener('click', () => {
  closeModal(loginModal);
  hubForgotEmailForm.hidden = false;
  hubForgotResetForm.hidden = true;
  hubForgotEmailForm.reset();
  hubForgotResetForm.reset();
  hubForgotEmailError.textContent = '';
  hubForgotResetError.textContent = '';
  hubForgotResetStatus.textContent = '';
  openModal(forgotPasswordModal);
});

hubForgotEmailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hubForgotEmailError.textContent = '';

  const email = hubForgotEmail.value.trim();
  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  submitButton.disabled = false;

  if (error) {
    hubForgotEmailError.textContent = error.message;
    return;
  }

  forgotPasswordEmail = email;
  hubForgotEmailForm.hidden = true;
  hubForgotResetForm.hidden = false;
});

hubForgotResetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hubForgotResetError.textContent = '';
  hubForgotResetStatus.textContent = '';

  const rawCode = hubForgotCode.value.trim();
  const code = rawCode.toUpperCase().startsWith('FACT-') ? rawCode.slice(5) : rawCode;
  const newPassword = hubForgotNewPassword.value;
  const confirmPassword = hubForgotConfirmPassword.value;

  if (newPassword.length < 8) {
    hubForgotResetError.textContent = 'Password must be at least 8 characters.';
    return;
  }
  if (newPassword !== confirmPassword) {
    hubForgotResetError.textContent = 'Passwords do not match.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error: verifyError } = await client.auth.verifyOtp({
    email: forgotPasswordEmail,
    token: code,
    type: 'email',
  });

  if (verifyError) {
    hubForgotResetError.textContent = 'That code is invalid or expired.';
    submitButton.disabled = false;
    return;
  }

  const { error: updateError } = await client.auth.updateUser({ password: newPassword });

  submitButton.disabled = false;

  if (updateError) {
    hubForgotResetError.textContent = updateError.message;
    return;
  }

  hubForgotResetStatus.textContent = 'Password reset! Redirecting...';
  setTimeout(() => {
    window.location.href = 'home.html';
  }, 1200);
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

const hubActiveUsers = document.getElementById('hubActiveUsers');
const hubTotalUsers = document.getElementById('hubTotalUsers');

async function loadTotalUsers() {
  const { count, error } = await client
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  hubTotalUsers.textContent = error ? '?' : count;
}

function trackActiveUsers() {
  const presenceChannel = client.channel('facturehub-online');

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const count = Object.keys(presenceChannel.presenceState()).length;
      hubActiveUsers.textContent = count;
    })
    .subscribe();
}

loadTotalUsers();
trackActiveUsers();
