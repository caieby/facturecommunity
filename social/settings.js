const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { experimental: { passkey: true } },
});

let currentSession = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

const usernameForm = document.getElementById('usernameForm');
const settingsUsernameInput = document.getElementById('settingsUsernameInput');
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

const standingMeterFill = document.getElementById('standingMeterFill');
const standingLabel = document.getElementById('standingLabel');
const standingDetail = document.getElementById('standingDetail');
const toggleInfractionsButton = document.getElementById('toggleInfractionsButton');
const infractionList = document.getElementById('infractionList');
const infractionEmpty = document.getElementById('infractionEmpty');

const infractionAppealModal = document.getElementById('infractionAppealModal');
const infractionAppealTarget = document.getElementById('infractionAppealTarget');
const infractionAppealForm = document.getElementById('infractionAppealForm');
const infractionAppealReason = document.getElementById('infractionAppealReason');
const infractionAppealError = document.getElementById('infractionAppealError');
const infractionAppealStatus = document.getElementById('infractionAppealStatus');
let appealTargetActionId = null;

const themeOptionPurple = document.getElementById('themeOptionPurple');
const themeOptionDark = document.getElementById('themeOptionDark');
const themeError = document.getElementById('themeError');

const autoUnblurNsfwCheckbox = document.getElementById('autoUnblurNsfwCheckbox');
const autoUnblurError = document.getElementById('autoUnblurError');
const nsfwAccountCheckbox = document.getElementById('nsfwAccountCheckbox');
const nsfwAccountError = document.getElementById('nsfwAccountError');
const adultConfirmCache = { confirmed: false };

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { localStorage.setItem('facture-theme', theme); } catch (e) {}
}

[themeOptionPurple, themeOptionDark].forEach((input) => {
  input.addEventListener('change', async () => {
    themeError.textContent = '';
    const theme = input.value;
    applyTheme(theme);

    const { error } = await client
      .from('profiles')
      .update({ theme })
      .eq('id', currentSession.user.id);

    if (error) {
      themeError.textContent = error.message;
    }
  });
});

autoUnblurNsfwCheckbox.addEventListener('change', async () => {
  autoUnblurError.textContent = '';

  if (autoUnblurNsfwCheckbox.checked) {
    if (!(await ensureAdultConfirmed(client, currentSession.user.id, adultConfirmCache))) {
      autoUnblurNsfwCheckbox.checked = false;
      return;
    }
  }

  const { error } = await client
    .from('profiles')
    .update({ auto_unblur_nsfw: autoUnblurNsfwCheckbox.checked })
    .eq('id', currentSession.user.id);

  if (error) {
    autoUnblurError.textContent = error.message;
    autoUnblurNsfwCheckbox.checked = !autoUnblurNsfwCheckbox.checked;
  }
});

nsfwAccountCheckbox.addEventListener('change', async () => {
  nsfwAccountError.textContent = '';

  if (nsfwAccountCheckbox.checked) {
    if (!(await ensureAdultConfirmed(client, currentSession.user.id, adultConfirmCache))) {
      nsfwAccountCheckbox.checked = false;
      return;
    }
  }

  const { error } = await client
    .from('profiles')
    .update({ is_nsfw_account: nsfwAccountCheckbox.checked })
    .eq('id', currentSession.user.id);

  if (error) {
    nsfwAccountError.textContent = error.message;
    nsfwAccountCheckbox.checked = !nsfwAccountCheckbox.checked;
  }
});

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
    .select('username, dm_privacy, username_changed_at, warning_count, suspended_until, terminated_at, termination_reason, theme, auto_unblur_nsfw, confirmed_adult_content, is_nsfw_account')
    .eq('id', session.user.id)
    .single();

  autoUnblurNsfwCheckbox.checked = !!(profile && profile.auto_unblur_nsfw);
  nsfwAccountCheckbox.checked = !!(profile && profile.is_nsfw_account);
  adultConfirmCache.confirmed = !!(profile && profile.confirmed_adult_content);

  originalUsername = (profile && profile.username) || '';
  usernameChangedAt = profile ? profile.username_changed_at : null;
  settingsUsernameInput.value = originalUsername;
  updateUsernameHint();
  dmPrivacySelect.value = (profile && profile.dm_privacy) || 'everyone';

  const theme = (profile && profile.theme) || 'purple';
  themeOptionPurple.checked = theme === 'purple';
  themeOptionDark.checked = theme === 'dark';
  applyTheme(theme);

  refreshEmailStatus(userData.user);
  renderAccountStanding(profile || {});
  refreshMfaStatus();
  refreshPasskeys();
}

function renderAccountStanding(profile) {
  const count = profile.warning_count || 0;
  const percent = Math.min(100, Math.round((count / 6) * 100));
  standingMeterFill.style.width = `${percent}%`;

  let colorClass = '';
  if (count >= 5) colorClass = 'standing-critical';
  else if (count >= 3) colorClass = 'standing-danger';
  else if (count >= 1) colorClass = 'standing-warn';

  standingMeterFill.className = `standing-meter-fill ${colorClass}`;
  standingLabel.className = `standing-label ${colorClass}`;

  const isSuspended = profile.suspended_until && new Date(profile.suspended_until) > new Date();

  if (profile.terminated_at) {
    standingLabel.textContent = 'Terminated';
    standingDetail.textContent = `Your account was permanently terminated. Reason: ${profile.termination_reason || 'No reason provided.'} You can appeal this from the infraction history below.`;
  } else if (isSuspended) {
    standingLabel.textContent = 'Suspended';
    standingDetail.textContent = `Your account is suspended until ${new Date(profile.suspended_until).toLocaleString()}.`;
  } else if (count === 0) {
    standingLabel.textContent = 'Good Standing';
    standingDetail.textContent = 'You have no infractions on your account. Keep it up!';
  } else if (count <= 2) {
    standingLabel.textContent = `${count} Warning${count === 1 ? '' : 's'}`;
    standingDetail.textContent = `${3 - count} more warning${3 - count === 1 ? '' : 's'} will result in a 7-day suspension.`;
  } else if (count === 3) {
    standingLabel.textContent = '3 Warnings';
    standingDetail.textContent = 'One more warning will result in a 14-day suspension.';
  } else if (count === 4) {
    standingLabel.textContent = '4 Warnings';
    standingDetail.textContent = 'One more warning will result in a 30-day suspension.';
  } else {
    standingLabel.textContent = '5 Warnings';
    standingDetail.textContent = 'This is your final warning. One more infraction will result in permanent account termination.';
  }

  if (count > 0 || profile.terminated_at) {
    toggleInfractionsButton.hidden = false;
  }
}

async function loadInfractions() {
  const { data: actions } = await client
    .from('moderation_actions')
    .select('id, action_type, reason, resulting_warning_count, created_at, target_post_id, target_message_id, target_content')
    .eq('target_user_id', currentSession.user.id)
    .in('action_type', ['warn', 'terminate'])
    .order('created_at', { ascending: false });

  const { data: myAppeals } = await client
    .from('appeals')
    .select('moderation_action_id, status')
    .eq('user_id', currentSession.user.id);

  const appealByActionId = new Map();
  (myAppeals || []).forEach((appeal) => {
    if (appeal.moderation_action_id) appealByActionId.set(appeal.moderation_action_id, appeal.status);
  });

  infractionList.innerHTML = '';
  infractionList.appendChild(infractionEmpty);

  if (!actions || actions.length === 0) {
    infractionEmpty.hidden = false;
    return;
  }

  infractionEmpty.hidden = true;

  actions.forEach((action) => {
    const existingAppealStatus = appealByActionId.get(action.id);
    const targetId = action.target_post_id || action.target_message_id;
    const targetIdLabel = action.target_post_id ? 'Post ID' : action.target_message_id ? 'Message ID' : null;

    const card = document.createElement('div');
    card.className = 'infraction-card';
    card.innerHTML = `
      <div class="infraction-card-header">
        <span class="infraction-type">${action.action_type === 'terminate' ? 'Termination' : 'Warning'}</span>
        <span class="infraction-date">${new Date(action.created_at).toLocaleDateString()}</span>
      </div>
      <p class="infraction-reason">${escapeHtml(action.reason)}</p>
      ${action.target_content ? `<p class="infraction-reason"><strong>Flagged content:</strong> ${escapeHtml(action.target_content)}</p>` : ''}
      ${targetId ? `<p class="infraction-reason"><strong>${targetIdLabel}:</strong> ${escapeHtml(targetId)}</p>` : ''}
      ${existingAppealStatus
        ? `<p class="infraction-appeal-status">Appeal ${existingAppealStatus}.</p>`
        : '<button type="button" class="hub-text-link" data-action-id="' + action.id + '">Appeal this infraction</button>'}
    `;

    const appealButton = card.querySelector('[data-action-id]');
    if (appealButton) {
      appealButton.addEventListener('click', () => {
        appealTargetActionId = action.id;
        infractionAppealTarget.textContent = `Appealing: ${action.action_type === 'terminate' ? 'Termination' : 'Warning'} issued ${new Date(action.created_at).toLocaleDateString()} — ${action.reason}${action.target_content ? ` (flagged content: ${action.target_content})` : ''}${targetId ? ` (${targetIdLabel}: ${targetId})` : ''}`;
        infractionAppealForm.reset();
        infractionAppealError.textContent = '';
        infractionAppealStatus.textContent = '';
        infractionAppealModal.hidden = false;
      });
    }

    infractionList.appendChild(card);
  });
}

toggleInfractionsButton.addEventListener('click', async () => {
  const showing = !infractionList.hidden;
  infractionList.hidden = showing;
  toggleInfractionsButton.textContent = showing ? 'View Infraction History' : 'Hide Infraction History';
  if (!showing) await loadInfractions();
});

infractionAppealModal.querySelector('.hub-modal-close').addEventListener('click', () => {
  infractionAppealModal.hidden = true;
});
infractionAppealModal.addEventListener('click', (event) => {
  if (event.target === infractionAppealModal) infractionAppealModal.hidden = true;
});

infractionAppealForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  infractionAppealError.textContent = '';
  infractionAppealStatus.textContent = '';

  const reason = infractionAppealReason.value.trim();
  if (!reason) {
    infractionAppealError.textContent = 'Please explain why this infraction should be reconsidered.';
    return;
  }

  const submitButton = infractionAppealForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data, error } = await client
    .from('appeals')
    .insert({ user_id: currentSession.user.id, reason, moderation_action_id: appealTargetActionId })
    .select('appeal_number')
    .single();

  submitButton.disabled = false;

  if (error) {
    infractionAppealError.textContent = error.message;
    return;
  }

  infractionAppealStatus.textContent = `Appeal submitted (${data.appeal_number}). A moderator will review it soon.`;
  setTimeout(() => {
    infractionAppealModal.hidden = true;
    loadInfractions();
  }, 1500);
});

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
    : 'Changing your username needs extra confirmation and can only be done once every 7 days.';
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

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  if (!(await requestStepUpVerification())) {
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

  if (!(await requestStepUpVerification())) {
    submitButton.disabled = false;
    return;
  }

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

  if (!(await requestStepUpVerification())) {
    deletePostsButton.disabled = false;
    return;
  }

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

  if (!(await requestStepUpVerification())) {
    deactivateButton.disabled = false;
    return;
  }

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

  if (!(await requestStepUpVerification())) {
    deleteAccountButton.disabled = false;
    return;
  }

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

const mfaIntro = document.getElementById('mfaIntro');
const mfaToggleButton = document.getElementById('mfaToggleButton');
const mfaEnrollPanel = document.getElementById('mfaEnrollPanel');
const mfaQrWrap = document.getElementById('mfaQrWrap');
const mfaSecretText = document.getElementById('mfaSecretText');
const mfaVerifyForm = document.getElementById('mfaVerifyForm');
const mfaVerifyCode = document.getElementById('mfaVerifyCode');
const mfaVerifyError = document.getElementById('mfaVerifyError');
const mfaCancelEnrollButton = document.getElementById('mfaCancelEnrollButton');
const mfaDisablePanel = document.getElementById('mfaDisablePanel');
const mfaDisableForm = document.getElementById('mfaDisableForm');
const mfaDisableCode = document.getElementById('mfaDisableCode');
const mfaDisableError = document.getElementById('mfaDisableError');
const mfaCancelDisableButton = document.getElementById('mfaCancelDisableButton');

let pendingMfaFactorId = null;
let mfaEnabled = false;

async function refreshMfaStatus() {
  const { data, error } = await client.auth.mfa.listFactors();

  if (error) {
    mfaIntro.textContent = 'Could not load two-factor authentication status.';
    return;
  }

  const verified = data.totp.find((factor) => factor.status === 'verified');
  const unverified = data.totp.find((factor) => factor.status === 'unverified');

  if (unverified) {
    await client.auth.mfa.unenroll({ factorId: unverified.id });
  }

  mfaEnrollPanel.hidden = true;
  mfaDisablePanel.hidden = true;

  mfaEnabled = !!verified;
  mfaToggleButton.hidden = false;
  mfaToggleButton.textContent = mfaEnabled ? 'Disable 2FA' : 'Enable 2FA';
  mfaIntro.textContent = mfaEnabled
    ? 'Two-factor authentication is enabled on your account.'
    : 'Add an extra layer of security with an authenticator app (Google Authenticator, Authy, etc.).';
}

mfaToggleButton.addEventListener('click', async () => {
  if (mfaEnabled) {
    mfaDisableError.textContent = '';
    mfaDisableForm.reset();
    mfaToggleButton.hidden = true;
    mfaDisablePanel.hidden = false;
    return;
  }

  mfaVerifyError.textContent = '';
  mfaToggleButton.disabled = true;

  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp' });

  mfaToggleButton.disabled = false;

  if (error) {
    mfaVerifyError.textContent = error.message;
    return;
  }

  pendingMfaFactorId = data.id;

  mfaQrWrap.innerHTML = '';
  const qrImage = document.createElement('img');
  qrImage.src = data.totp.qr_code;
  qrImage.alt = 'Two-factor authentication QR code';
  mfaQrWrap.appendChild(qrImage);
  mfaSecretText.textContent = data.totp.secret;

  mfaVerifyForm.reset();
  mfaToggleButton.hidden = true;
  mfaEnrollPanel.hidden = false;
});

mfaCancelEnrollButton.addEventListener('click', async () => {
  if (pendingMfaFactorId) {
    await client.auth.mfa.unenroll({ factorId: pendingMfaFactorId });
    pendingMfaFactorId = null;
  }
  mfaEnrollPanel.hidden = true;
  mfaToggleButton.hidden = false;
});

mfaVerifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  mfaVerifyError.textContent = '';

  const code = mfaVerifyCode.value.trim();
  if (!/^\d{6}$/.test(code)) {
    mfaVerifyError.textContent = 'Enter the 6-digit code from your authenticator app.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({ factorId: pendingMfaFactorId });

  if (challengeError) {
    mfaVerifyError.textContent = challengeError.message;
    submitButton.disabled = false;
    return;
  }

  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: pendingMfaFactorId,
    challengeId: challengeData.id,
    code,
  });

  submitButton.disabled = false;

  if (verifyError) {
    mfaVerifyError.textContent = 'Incorrect code. Please try again.';
    return;
  }

  pendingMfaFactorId = null;
  await refreshMfaStatus();
});

mfaCancelDisableButton.addEventListener('click', () => {
  mfaDisablePanel.hidden = true;
  mfaToggleButton.hidden = false;
});

mfaDisableForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  mfaDisableError.textContent = '';

  const code = mfaDisableCode.value.trim();
  if (!/^\d{6}$/.test(code)) {
    mfaDisableError.textContent = 'Enter the 6-digit code from your authenticator app.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data: factorsData, error: factorsError } = await client.auth.mfa.listFactors();
  const factor = factorsData && factorsData.totp.find((f) => f.status === 'verified');

  if (factorsError || !factor) {
    mfaDisableError.textContent = 'Two-factor authentication is not currently enabled.';
    submitButton.disabled = false;
    await refreshMfaStatus();
    return;
  }

  const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({ factorId: factor.id });

  if (challengeError) {
    mfaDisableError.textContent = challengeError.message;
    submitButton.disabled = false;
    return;
  }

  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    mfaDisableError.textContent = 'Incorrect code. Please try again.';
    submitButton.disabled = false;
    return;
  }

  const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId: factor.id });

  submitButton.disabled = false;

  if (unenrollError) {
    mfaDisableError.textContent = unenrollError.message;
    return;
  }

  mfaDisableCode.value = '';
  await refreshMfaStatus();
  await refreshPasskeys();
});

const passkeyList = document.getElementById('passkeyList');
const passkeyError = document.getElementById('passkeyError');
const passkeyStatus = document.getElementById('passkeyStatus');
const passkeyAddButton = document.getElementById('passkeyAddButton');
const passkeyNameModal = document.getElementById('passkeyNameModal');
const passkeyNameForm = document.getElementById('passkeyNameForm');
const passkeyNameInput = document.getElementById('passkeyNameInput');
const passkeyNameError = document.getElementById('passkeyNameError');

passkeyNameModal.querySelector('.hub-modal-close').addEventListener('click', () => {
  passkeyNameModal.hidden = true;
});
passkeyNameModal.addEventListener('click', (event) => {
  if (event.target === passkeyNameModal) passkeyNameModal.hidden = true;
});

async function refreshPasskeys() {
  await cleanupOrphanedPasskeys(client);

  const { data: passkeys, error } = await client.auth.passkey.list();

  if (error) {
    passkeyList.innerHTML = '';
    passkeyError.textContent = 'Could not load your passkeys.';
    return;
  }

  if (!passkeys || passkeys.length === 0) {
    passkeyList.innerHTML = '<p class="page-hint">No passkeys yet.</p>';
    return;
  }

  passkeyList.innerHTML = '';
  passkeys.forEach((passkey) => {
    const row = document.createElement('div');
    row.className = 'passkey-row';
    row.innerHTML = `
      <div>
        <div class="passkey-row-name">${escapeHtml(passkey.friendly_name || 'Passkey')}</div>
        <div class="passkey-row-date">Added ${new Date(passkey.created_at).toLocaleDateString()}</div>
      </div>
      <button type="button" class="passkey-row-delete" aria-label="Remove passkey">&times;</button>
    `;
    row.querySelector('.passkey-row-delete').addEventListener('click', async () => {
      passkeyError.textContent = '';
      passkeyStatus.textContent = '';

      if (!(await requestStepUpVerification({ requireTotp: true }))) return;

      const { error: deleteError } = await client.auth.passkey.delete({ passkeyId: passkey.id });
      if (deleteError) {
        passkeyError.textContent = deleteError.message;
        return;
      }
      passkeyStatus.textContent = 'Passkey removed.';
      await refreshPasskeys();
    });
    passkeyList.appendChild(row);
  });
}

passkeyAddButton.addEventListener('click', async () => {
  passkeyError.textContent = '';
  passkeyStatus.textContent = '';

  if (!(await hasVerifiedTotp())) {
    passkeyError.textContent = 'Set up two-factor authentication before adding a passkey.';
    return;
  }

  passkeyNameError.textContent = '';
  passkeyNameForm.reset();
  passkeyNameModal.hidden = false;
  passkeyNameInput.focus();
});

passkeyNameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  passkeyNameError.textContent = '';

  const name = passkeyNameInput.value.trim();
  if (!name) {
    passkeyNameError.textContent = 'Give this passkey a name.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  if (!(await requestStepUpVerification({ requireTotp: true }))) {
    submitButton.disabled = false;
    return;
  }

  try {
    const { data, error } = await client.auth.registerPasskey();

    if (error) {
      passkeyNameError.textContent = error.message;
      submitButton.disabled = false;
      return;
    }

    if (data && data.id) {
      await client.auth.passkey.update({ passkeyId: data.id, friendlyName: name });
    }

    submitButton.disabled = false;
    passkeyNameModal.hidden = true;
    passkeyStatus.textContent = `Added "${name}".`;
    await refreshPasskeys();
  } catch (err) {
    passkeyNameError.textContent = 'Something went wrong. Please try again.';
    submitButton.disabled = false;
  }
});

const stepUpModal = document.getElementById('stepUpModal');
const stepUpChoiceButtons = document.getElementById('stepUpChoiceButtons');
const stepUpShowCodeButton = document.getElementById('stepUpShowCodeButton');
const stepUpCodeOption = document.getElementById('stepUpCodeOption');
const stepUpCodeForm = document.getElementById('stepUpCodeForm');
const stepUpCodeInput = document.getElementById('stepUpCodeInput');
const stepUpPasskeyButton = document.getElementById('stepUpPasskeyButton');
const stepUpPasswordOption = document.getElementById('stepUpPasswordOption');
const stepUpPasswordForm = document.getElementById('stepUpPasswordForm');
const stepUpPasswordInput = document.getElementById('stepUpPasswordInput');
const stepUpError = document.getElementById('stepUpError');
const stepUpCancelButton = document.getElementById('stepUpCancelButton');

let stepUpResolve = null;

function closeStepUp(result) {
  stepUpModal.hidden = true;
  stepUpCodeForm.reset();
  stepUpPasswordForm.reset();
  stepUpError.textContent = '';
  if (stepUpResolve) {
    const resolve = stepUpResolve;
    stepUpResolve = null;
    resolve(result);
  }
}

async function confirmAal2(maxAttempts = 10, delayMs = 150) {
  let lastAal = null;
  let lastErr = null;
  for (let i = 0; i < maxAttempts; i++) {
    const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    lastAal = aal;
    lastErr = aalError;
    if (aal && aal.currentLevel === 'aal2') return { ok: true };
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return {
    ok: false,
    debug: `aal=${lastAal ? `${lastAal.currentLevel}->${lastAal.nextLevel}` : 'null'}${lastErr ? ` err=${lastErr.message}` : ''}`,
  };
}

async function hasVerifiedTotp() {
  const { data } = await client.auth.mfa.listFactors();
  return !!(data && data.totp.find((factor) => factor.status === 'verified'));
}

async function requestStepUpVerification({ requireTotp = false } = {}) {
  if (!(await requireHumanCheck())) return false;

  const totpEnrolled = await hasVerifiedTotp();

  let hasPasskey = false;
  if (!requireTotp) {
    try {
      const { data: passkeys } = await client.auth.passkey.list();
      hasPasskey = !!(passkeys && passkeys.length > 0);
    } catch (e) {
    }
  }

  stepUpError.textContent = '';
  stepUpCodeForm.reset();
  stepUpPasswordForm.reset();
  stepUpChoiceButtons.hidden = true;
  stepUpCodeOption.hidden = true;
  stepUpPasswordOption.hidden = true;

  if (requireTotp) {
    stepUpCodeOption.hidden = false;
  } else if (totpEnrolled || hasPasskey) {
    stepUpPasskeyButton.hidden = !hasPasskey;
    stepUpShowCodeButton.hidden = !totpEnrolled;
    stepUpChoiceButtons.hidden = false;
  } else {
    stepUpPasswordOption.hidden = false;
  }

  stepUpModal.hidden = false;

  return new Promise((resolve) => {
    stepUpResolve = resolve;
  });
}

stepUpShowCodeButton.addEventListener('click', () => {
  stepUpError.textContent = '';
  stepUpChoiceButtons.hidden = true;
  stepUpCodeOption.hidden = false;
  stepUpCodeInput.focus();
});

stepUpPasskeyButton.addEventListener('click', async () => {
  stepUpError.textContent = '';
  stepUpPasskeyButton.disabled = true;

  try {
    const { data, error } = await client.auth.signInWithPasskey();
    stepUpPasskeyButton.disabled = false;

    if (error) {
      stepUpError.textContent = 'Could not verify with your passkey. Please try again.';
      return;
    }

    if (data.user && data.user.id !== currentSession.user.id) {
      stepUpError.textContent = 'That passkey belongs to a different account.';
      return;
    }

    const aal2Check = await confirmAal2();
    if (!aal2Check.ok) {
      stepUpError.textContent = `Verified, but your session didn't update (${aal2Check.debug}). Please screenshot this and try again.`;
      return;
    }

    closeStepUp(true);
  } catch (err) {
    stepUpPasskeyButton.disabled = false;
    stepUpError.textContent = 'Something went wrong. Please try again.';
  }
});

stepUpCodeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  stepUpError.textContent = '';

  const code = stepUpCodeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    stepUpError.textContent = 'Enter the 6-digit code from your authenticator app.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data: factorsData } = await client.auth.mfa.listFactors();
  const factor = factorsData && factorsData.totp.find((f) => f.status === 'verified');

  if (!factor) {
    stepUpError.textContent = 'Something went wrong. Please try again.';
    submitButton.disabled = false;
    return;
  }

  const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError) {
    stepUpError.textContent = challengeError.message;
    submitButton.disabled = false;
    return;
  }

  const { data: verifyData, error: verifyError } = await client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    stepUpError.textContent = 'Incorrect code. Please try again.';
    submitButton.disabled = false;
    return;
  }

  if (verifyData && verifyData.access_token && verifyData.refresh_token) {
    await client.auth.setSession({
      access_token: verifyData.access_token,
      refresh_token: verifyData.refresh_token,
    });
  }

  const aal2Check = await confirmAal2();
  if (!aal2Check.ok) {
    stepUpError.textContent = `Verified, but your session didn't update (${aal2Check.debug}). Please screenshot this and try again.`;
    submitButton.disabled = false;
    return;
  }

  submitButton.disabled = false;
  closeStepUp(true);
});

stepUpPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  stepUpError.textContent = '';

  const password = stepUpPasswordInput.value;
  if (!password) {
    stepUpError.textContent = 'Please enter your current password.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { error } = await client.auth.signInWithPassword({ email: currentSession.user.email, password });

  submitButton.disabled = false;

  if (error) {
    stepUpError.textContent = 'Incorrect password.';
    return;
  }

  closeStepUp(true);
});

stepUpCancelButton.addEventListener('click', () => closeStepUp(false));

init();
