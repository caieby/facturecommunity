const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSession = null;

const settingsUsername = document.getElementById('settingsUsername');
const settingsEmailStatus = document.getElementById('settingsEmailStatus');
const emailForm = document.getElementById('emailForm');
const settingsEmailInput = document.getElementById('settingsEmailInput');
const emailFormError = document.getElementById('emailFormError');
const emailFormStatus = document.getElementById('emailFormStatus');
const resendVerificationGroup = document.getElementById('resendVerificationGroup');
const resendVerificationButton = document.getElementById('resendVerificationButton');

const passwordForm = document.getElementById('passwordForm');
const settingsNewPassword = document.getElementById('settingsNewPassword');
const settingsConfirmPassword = document.getElementById('settingsConfirmPassword');
const passwordFormError = document.getElementById('passwordFormError');
const passwordFormStatus = document.getElementById('passwordFormStatus');

const deactivateButton = document.getElementById('deactivateButton');
const deactivateError = document.getElementById('deactivateError');
const deactivateStatus = document.getElementById('deactivateStatus');

const deleteAccountButton = document.getElementById('deleteAccountButton');
const deleteError = document.getElementById('deleteError');

const privacyForm = document.getElementById('privacyForm');
const dmPrivacySelect = document.getElementById('dmPrivacySelect');
const privacyFormError = document.getElementById('privacyFormError');
const privacyFormStatus = document.getElementById('privacyFormStatus');

async function init() {
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    window.location.href = '/social/index.html';
    return;
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    await client.auth.signOut();
    window.location.href = '/social/index.html';
    return;
  }

  currentSession = session;

  const { data: profile } = await client
    .from('profiles')
    .select('username, dm_privacy')
    .eq('id', session.user.id)
    .single();

  settingsUsername.textContent = profile ? `@${profile.username}` : 'Unknown';
  dmPrivacySelect.value = (profile && profile.dm_privacy) || 'everyone';

  refreshEmailStatus(userData.user);
}

function refreshEmailStatus(user) {
  settingsEmailInput.value = user.email || '';

  if (user.email_confirmed_at) {
    settingsEmailStatus.textContent = `${user.email} is verified.`;
    resendVerificationGroup.hidden = true;
  } else {
    settingsEmailStatus.textContent = `${user.email} is on file but not yet confirmed. Check your inbox for the confirmation link.`;
    resendVerificationGroup.hidden = false;
  }
}

emailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  emailFormError.textContent = '';
  emailFormStatus.textContent = '';

  const email = settingsEmailInput.value.trim();
  if (!email) {
    emailFormError.textContent = 'Please enter an email address.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error } = await client.auth.updateUser(
    { email },
    { emailRedirectTo: `${window.location.origin}/social/settings.html` }
  );

  if (error) {
    emailFormError.textContent = error.message;
  } else {
    emailFormStatus.textContent = `Confirmation link sent to ${email}. Click it to finish updating your email.`;
  }

  submitButton.disabled = false;
});

resendVerificationButton.addEventListener('click', async () => {
  resendVerificationButton.disabled = true;
  emailFormError.textContent = '';
  emailFormStatus.textContent = '';

  const { error } = await client.auth.resend({
    type: 'signup',
    email: currentSession.user.email,
  });

  if (error) {
    emailFormError.textContent = error.message;
  } else {
    emailFormStatus.textContent = 'Confirmation email resent!';
  }

  resendVerificationButton.disabled = false;
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  passwordFormError.textContent = '';
  passwordFormStatus.textContent = '';

  const newPassword = settingsNewPassword.value;
  const confirmPassword = settingsConfirmPassword.value;

  if (newPassword.length < 8) {
    passwordFormError.textContent = 'Password must be at least 8 characters.';
    return;
  }
  if (newPassword !== confirmPassword) {
    passwordFormError.textContent = 'Passwords do not match.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error } = await client.auth.updateUser({ password: newPassword });

  if (error) {
    passwordFormError.textContent = error.message;
  } else {
    passwordFormStatus.textContent = 'Password updated!';
    passwordForm.reset();
  }

  submitButton.disabled = false;
});

deactivateButton.addEventListener('click', async () => {
  deactivateError.textContent = '';
  deactivateStatus.textContent = '';

  const confirmed = window.confirm('Deactivate your account? Your profile will be hidden until you log back in.');
  if (!confirmed) return;

  deactivateButton.disabled = true;

  const { error } = await client
    .from('profiles')
    .update({ is_deactivated: true })
    .eq('id', currentSession.user.id);

  if (error) {
    deactivateError.textContent = error.message;
    deactivateButton.disabled = false;
    return;
  }

  await client.auth.signOut();
  window.location.href = '/social/index.html';
});

deleteAccountButton.addEventListener('click', async () => {
  deleteError.textContent = '';

  const confirmed = window.confirm('Schedule your account for deletion? You\'ll have 30 days to change your mind by logging back in before it\'s permanently erased.');
  if (!confirmed) return;

  deleteAccountButton.disabled = true;

  const { error } = await client
    .from('profiles')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', currentSession.user.id);

  if (error) {
    deleteError.textContent = error.message;
    deleteAccountButton.disabled = false;
    return;
  }

  await client.auth.signOut();
  window.location.href = '/social/index.html';
});

privacyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  privacyFormError.textContent = '';
  privacyFormStatus.textContent = '';

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error } = await client
    .from('profiles')
    .update({ dm_privacy: dmPrivacySelect.value })
    .eq('id', currentSession.user.id);

  if (error) {
    privacyFormError.textContent = error.message;
  } else {
    privacyFormStatus.textContent = 'Privacy setting saved!';
  }

  submitButton.disabled = false;
});

init();
