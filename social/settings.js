const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSession = null;

const usernameForm = document.getElementById('usernameForm');
const settingsUsernameInput = document.getElementById('settingsUsernameInput');
const settingsUsernamePassword = document.getElementById('settingsUsernamePassword');
const usernameFormError = document.getElementById('usernameFormError');
const usernameFormStatus = document.getElementById('usernameFormStatus');
const usernameHint = document.getElementById('usernameHint');
let originalUsername = '';
let usernameChangedAt = null;

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

const deletePostsButton = document.getElementById('deletePostsButton');
const deletePostsError = document.getElementById('deletePostsError');
const deletePostsStatus = document.getElementById('deletePostsStatus');

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
    .select('username, dm_privacy, username_changed_at')
    .eq('id', session.user.id)
    .single();

  originalUsername = (profile && profile.username) || '';
  usernameChangedAt = profile ? profile.username_changed_at : null;
  settingsUsernameInput.value = originalUsername;
  updateUsernameHint();
  dmPrivacySelect.value = (profile && profile.dm_privacy) || 'everyone';

  refreshEmailStatus(userData.user);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function getUsernameCooldownDaysLeft() {
  if (!usernameChangedAt) return 0;
  const msSinceChange = Date.now() - new Date(usernameChangedAt).getTime();
  const daysSinceChange = msSinceChange / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(7 - daysSinceChange));
}

function updateUsernameHint() {
  const daysLeft = getUsernameCooldownDaysLeft();
  usernameHint.textContent = daysLeft > 0
    ? `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
    : 'Changing your username requires your current password and can only be done once every 7 days.';
}

usernameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  usernameFormError.textContent = '';
  usernameFormStatus.textContent = '';

  const newUsername = settingsUsernameInput.value.trim();

  if (newUsername === originalUsername) {
    usernameFormError.textContent = 'That is already your username.';
    return;
  }
  if (!isValidUsername(newUsername)) {
    usernameFormError.textContent = 'Usernames must be 3-20 characters and can only contain letters, numbers, and underscores.';
    return;
  }

  const daysLeft = getUsernameCooldownDaysLeft();
  if (daysLeft > 0) {
    usernameFormError.textContent = `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;
    return;
  }

  if (!settingsUsernamePassword.value) {
    usernameFormError.textContent = 'Please enter your current password.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error: verifyError } = await client.auth.signInWithPassword({
    email: currentSession.user.email,
    password: settingsUsernamePassword.value,
  });

  if (verifyError) {
    usernameFormError.textContent = 'Incorrect password.';
    submitButton.disabled = false;
    return;
  }

  const newUsernameChangedAt = new Date().toISOString();

  const { error } = await client
    .from('profiles')
    .update({ username: newUsername, username_changed_at: newUsernameChangedAt })
    .eq('id', currentSession.user.id);

  if (error) {
    usernameFormError.textContent = error.message.includes('duplicate')
      ? 'That username is already taken.'
      : `Error: ${error.message}`;
    submitButton.disabled = false;
    return;
  }

  originalUsername = newUsername;
  usernameChangedAt = newUsernameChangedAt;
  settingsUsernamePassword.value = '';
  updateUsernameHint();
  usernameFormStatus.textContent = 'Username updated!';
  submitButton.disabled = false;
});

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

deletePostsButton.addEventListener('click', async () => {
  deletePostsError.textContent = '';
  deletePostsStatus.textContent = '';

  const confirmed = window.confirm('Permanently delete all of your posts? This cannot be undone.');
  if (!confirmed) return;

  deletePostsButton.disabled = true;

  const { error } = await client
    .from('posts')
    .delete()
    .eq('author_id', currentSession.user.id);

  if (error) {
    deletePostsError.textContent = error.message;
    deletePostsButton.disabled = false;
    return;
  }

  deletePostsStatus.textContent = 'All of your posts have been deleted.';
  deletePostsButton.disabled = false;
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
