const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSession = null;
let uploadedAvatarUrl = null;
let uploadedBannerUrl = null;

const onboardModal = document.getElementById('onboardModal');
const onboardAvatarDrop = document.getElementById('onboardAvatarDrop');
const onboardAvatarInput = document.getElementById('onboardAvatarInput');
const onboardAvatarPreview = document.getElementById('onboardAvatarPreview');
const onboardAvatarPlaceholder = document.getElementById('onboardAvatarPlaceholder');
const onboardAvatarStatus = document.getElementById('onboardAvatarStatus');
const onboardBannerDrop = document.getElementById('onboardBannerDrop');
const onboardBannerInput = document.getElementById('onboardBannerInput');
const onboardBannerPreview = document.getElementById('onboardBannerPreview');
const onboardBannerPlaceholder = document.getElementById('onboardBannerPlaceholder');
const onboardBannerStatus = document.getElementById('onboardBannerStatus');
const onboardForm = document.getElementById('onboardForm');
const onboardError = document.getElementById('onboardError');
const onboardBackButton = document.getElementById('onboardBackButton');
const onboardSkipButton = document.getElementById('onboardSkipButton');
const onboardNextButton = document.getElementById('onboardNextButton');
const onboardSubmitButton = document.getElementById('onboardSubmitButton');
const onboardProgressDots = document.querySelectorAll('[data-step-dot]');
const onboardSteps = document.querySelectorAll('.onboard-step');
const ONBOARD_STEP_COUNT = onboardSteps.length;

let onboardCurrentStep = 1;

onboardAvatarDrop.addEventListener('click', () => onboardAvatarInput.click());
onboardBannerDrop.addEventListener('click', () => onboardBannerInput.click());

function showOnboardStep(step) {
  onboardCurrentStep = step;
  onboardError.textContent = '';

  onboardSteps.forEach((el) => {
    el.hidden = Number(el.dataset.step) !== step;
  });

  onboardProgressDots.forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.stepDot) <= step);
  });

  onboardBackButton.hidden = step === 1;
  onboardSkipButton.hidden = step !== ONBOARD_STEP_COUNT;
  onboardNextButton.hidden = step === ONBOARD_STEP_COUNT;
  onboardSubmitButton.hidden = step !== ONBOARD_STEP_COUNT;
}

function validateOnboardStep(step) {
  if (step === 1) {
    if (!uploadedAvatarUrl) {
      onboardError.textContent = 'Please choose a profile picture.';
      return false;
    }
    return true;
  }

  if (step === 2) {
    const username = document.getElementById('onboardUsername').value.trim();
    const displayName = document.getElementById('onboardDisplayName').value.trim();
    const genderIdentity = document.getElementById('onboardGenderIdentity').value.trim();
    const nsfwAccountChoice = document.querySelector('input[name="onboardNsfwAccount"]:checked');

    if (!isValidUsername(username)) {
      onboardError.textContent = 'Username must be 3-20 characters: letters, numbers, and underscores only.';
      return false;
    }
    if (!displayName) {
      onboardError.textContent = 'Please enter a display name.';
      return false;
    }
    if (!genderIdentity) {
      onboardError.textContent = 'Please enter your gender identity.';
      return false;
    }
    if (!nsfwAccountChoice) {
      onboardError.textContent = 'Please let us know if this is a dedicated NSFW account.';
      return false;
    }
    return true;
  }

  return true;
}

const onboardAdultConfirmCache = { confirmed: false };

document.getElementById('onboardNsfwYes').addEventListener('change', async (event) => {
  if (!event.target.checked) return;
  if (!(await ensureAdultConfirmed(client, currentSession.user.id, onboardAdultConfirmCache))) {
    event.target.checked = false;
  }
});

onboardNextButton.addEventListener('click', () => {
  if (!validateOnboardStep(onboardCurrentStep)) return;
  showOnboardStep(onboardCurrentStep + 1);
});

onboardBackButton.addEventListener('click', () => {
  showOnboardStep(onboardCurrentStep - 1);
});

onboardSkipButton.addEventListener('click', () => {
  submitOnboarding();
});

// Pressing Enter in a text field on an earlier step would otherwise submit
// the form early (browsers do this automatically whenever a submit button
// exists anywhere in the form, even a hidden one) — redirect that to Next.
onboardForm.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && onboardCurrentStep !== ONBOARD_STEP_COUNT) {
    event.preventDefault();
    onboardNextButton.click();
  }
});

const pageLoading = document.getElementById('pageLoading');
const homeContent = document.getElementById('homeContent');
const homeGreeting = document.getElementById('homeGreeting');
const homeAvatar = document.getElementById('homeAvatar');
const homeBanner = document.getElementById('homeBanner');
const homeLogoutButton = document.getElementById('homeLogoutButton');
const profileMenuLink = document.getElementById('profileMenuLink');
const reactivateModal = document.getElementById('reactivateModal');
const reactivateButton = document.getElementById('reactivateButton');
const reactivateError = document.getElementById('reactivateError');
const restoreDeletionModal = document.getElementById('restoreDeletionModal');
const restoreDeletionDate = document.getElementById('restoreDeletionDate');
const restoreDeletionButton = document.getElementById('restoreDeletionButton');
const restoreDeletionError = document.getElementById('restoreDeletionError');
const moderationPanelLink = document.getElementById('moderationPanelLink');
const warningModal = document.getElementById('warningModal');
const warningReasonText = document.getElementById('warningReasonText');
const warningError = document.getElementById('warningError');
const warningAckButton = document.getElementById('warningAckButton');
const warningAppealButton = document.getElementById('warningAppealButton');
const suspensionModal = document.getElementById('suspensionModal');
const suspensionReasonText = document.getElementById('suspensionReasonText');
const suspensionUntilText = document.getElementById('suspensionUntilText');
const suspensionLogoutButton = document.getElementById('suspensionLogoutButton');
const suspensionAppealButton = document.getElementById('suspensionAppealButton');
const terminationModal = document.getElementById('terminationModal');
const terminationReasonText = document.getElementById('terminationReasonText');
const terminationLogoutButton = document.getElementById('terminationLogoutButton');
const terminationAppealButton = document.getElementById('terminationAppealButton');
const appealResolvedModal = document.getElementById('appealResolvedModal');
const appealResolvedCard = document.getElementById('appealResolvedCard');
const appealResolvedIcon = document.getElementById('appealResolvedIcon');
const appealResolvedTitle = document.getElementById('appealResolvedTitle');
const appealResolvedMessage = document.getElementById('appealResolvedMessage');
const appealResolvedAckButton = document.getElementById('appealResolvedAckButton');
const appealModal = document.getElementById('appealModal');
const appealPrompt = document.getElementById('appealPrompt');
const appealForm = document.getElementById('appealForm');
const appealReason = document.getElementById('appealReason');
const appealError = document.getElementById('appealError');
const appealStatus = document.getElementById('appealStatus');
const appealAlreadySubmitted = document.getElementById('appealAlreadySubmitted');
const appealNumberText = document.getElementById('appealNumberText');
let latestInfractionActionId = null;
const chatMenuToggle = document.getElementById('chatMenuToggle');
const chatMenuDropdown = document.getElementById('chatMenuDropdown');
const notifMenuToggle = document.getElementById('notifMenuToggle');
const notifMenuDropdown = document.getElementById('notifMenuDropdown');
const notifBadge = document.getElementById('notifBadge');
const notifEmpty = document.getElementById('notifEmpty');

if (chatMenuToggle && chatMenuDropdown) {
  chatMenuToggle.addEventListener('click', () => {
    const isOpen = chatMenuDropdown.classList.toggle('open');
    chatMenuToggle.setAttribute('aria-expanded', isOpen);
  });

  document.addEventListener('click', (event) => {
    if (!chatMenuToggle.contains(event.target) && !chatMenuDropdown.contains(event.target)) {
      chatMenuDropdown.classList.remove('open');
      chatMenuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

async function loadNotifications() {
  const { data: notifications } = await client
    .from('notifications')
    .select('id, type, actor_id, conversation_id, is_read, created_at')
    .eq('user_id', currentSession.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  const unreadCount = (notifications || []).filter((n) => !n.is_read).length;
  notifBadge.hidden = unreadCount === 0;
  notifBadge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);

  notifMenuDropdown.querySelectorAll('.notif-row').forEach((el) => el.remove());
  notifEmpty.hidden = (notifications || []).length > 0;

  for (const notif of notifications || []) {
    const { data: actor } = await client
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', notif.actor_id)
      .single();

    if (!actor) continue;

    notifMenuDropdown.appendChild(buildNotifRow(notif, actor));
  }
}

function buildNotifRow(notif, actor) {
  const row = document.createElement('li');
  row.className = `notif-row${notif.is_read ? '' : ' unread'}`;

  const avatarHtml = actor.avatar_url
    ? `<img class="notif-avatar" src="${actor.avatar_url}" alt="">`
    : '<div class="notif-avatar notif-avatar--placeholder"></div>';

  const actionText = notif.type === 'follow'
    ? `<strong>${actor.display_name}</strong> followed you`
    : `<strong>${actor.display_name}</strong> sent you a message`;

  row.innerHTML = `
    ${avatarHtml}
    <span class="notif-text">${actionText}</span>
  `;

  row.querySelector('.notif-text').addEventListener('click', async () => {
    await client.from('notifications').update({ is_read: true }).eq('id', notif.id);
    if (notif.type === 'follow') {
      window.location.href = `/social/profiles/${actor.id}/`;
    } else {
      window.location.href = `/social/direct-messages.html?open=${notif.conversation_id}`;
    }
  });

  if (notif.type === 'follow') {
    client
      .from('follows')
      .select('follower_id')
      .eq('follower_id', currentSession.user.id)
      .eq('following_id', actor.id)
      .maybeSingle()
      .then(({ data: alreadyFollowing }) => {
        if (!alreadyFollowing) {
          const followBackButton = document.createElement('button');
          followBackButton.type = 'button';
          followBackButton.className = 'notif-follow-back';
          followBackButton.textContent = 'Follow Back';
          followBackButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            await client.from('follows').insert({ follower_id: currentSession.user.id, following_id: actor.id });
            followBackButton.remove();
          });
          row.appendChild(followBackButton);
        }
      });
  }

  return row;
}

if (notifMenuToggle && notifMenuDropdown) {
  notifMenuToggle.addEventListener('click', async () => {
    const isOpen = notifMenuDropdown.classList.toggle('open');
    notifMenuToggle.setAttribute('aria-expanded', isOpen);

    if (isOpen) {
      await client.from('notifications').update({ is_read: true }).eq('user_id', currentSession.user.id).eq('is_read', false);
      notifBadge.hidden = true;
      notifMenuDropdown.querySelectorAll('.notif-row').forEach((el) => el.classList.remove('unread'));
    }
  });

  document.addEventListener('click', (event) => {
    if (!notifMenuToggle.contains(event.target) && !notifMenuDropdown.contains(event.target)) {
      notifMenuDropdown.classList.remove('open');
      notifMenuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function subscribeToNotifications() {
  client
    .channel(`notifications-${currentSession.user.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentSession.user.id}` },
      () => {
        loadNotifications();
      }
    )
    .subscribe();
}

async function init() {
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const { error: userError } = await client.auth.getUser();
  if (userError) {
    await client.auth.signOut();
    window.location.href = 'index.html';
    return;
  }

  currentSession = session;
  profileMenuLink.href = `profiles/${session.user.id}/`;

  const { data: profile } = await client
    .from('profiles')
    .select('display_name, avatar_url, banner_url, gender_identity, is_deactivated, deletion_requested_at, role, warning_count, pending_warning_reason, suspended_until, terminated_at, termination_reason')
    .eq('id', session.user.id)
    .single();

  const { data: unseenAppeal } = await client
    .from('appeals')
    .select('id, status')
    .eq('user_id', session.user.id)
    .in('status', ['approved', 'denied'])
    .is('acknowledged_at', null)
    .order('resolved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unseenAppeal) {
    const approved = unseenAppeal.status === 'approved';
    appealResolvedCard.classList.toggle('mod-screen-card--approved', approved);
    appealResolvedTitle.classList.toggle('mod-screen-title--approved', approved);
    appealResolvedIcon.textContent = approved ? '✅' : '❌';
    appealResolvedMessage.textContent = approved
      ? 'Your appeal has been reviewed and accepted.'
      : 'Your appeal has been reviewed and denied.';
    appealResolvedAckButton.onclick = async () => {
      appealResolvedAckButton.disabled = true;
      await client.rpc('acknowledge_appeal', { _appeal_id: unseenAppeal.id });
      appealResolvedModal.hidden = true;
      appealResolvedAckButton.disabled = false;
      init();
    };
    pageLoading.hidden = true;
    appealResolvedModal.hidden = false;
    return;
  }

  if (profile && (profile.role === 'moderator' || profile.role === 'owner')) {
    moderationPanelLink.hidden = false;
  }

  if (profile && (profile.terminated_at || (profile.suspended_until && new Date(profile.suspended_until) > new Date()) || profile.pending_warning_reason)) {
    const { data: latestAction } = await client
      .from('moderation_actions')
      .select('id')
      .eq('target_user_id', session.user.id)
      .in('action_type', ['warn', 'terminate'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    latestInfractionActionId = latestAction ? latestAction.id : null;
  }

  if (profile && profile.terminated_at) {
    terminationReasonText.textContent = profile.termination_reason || 'No reason provided.';
    pageLoading.hidden = true;
    terminationModal.hidden = false;
    return;
  }

  if (profile && profile.suspended_until && new Date(profile.suspended_until) > new Date()) {
    suspensionReasonText.textContent = profile.pending_warning_reason || 'No reason provided.';
    suspensionUntilText.textContent = new Date(profile.suspended_until).toLocaleString();
    pageLoading.hidden = true;
    suspensionModal.hidden = false;
    return;
  }

  if (profile && profile.suspended_until && new Date(profile.suspended_until) <= new Date()) {
    await client
      .from('profiles')
      .update({ suspended_until: null, pending_warning_reason: null })
      .eq('id', session.user.id);
  }

  if (profile && profile.pending_warning_reason) {
    warningReasonText.textContent = profile.pending_warning_reason;
    pageLoading.hidden = true;
    warningModal.hidden = false;
    return;
  }

  await loadNotifications();
  subscribeToNotifications();

  if (profile && profile.deletion_requested_at) {
    const deletionDate = new Date(profile.deletion_requested_at);
    deletionDate.setDate(deletionDate.getDate() + 30);
    restoreDeletionDate.textContent = deletionDate.toLocaleDateString();
    pageLoading.hidden = true;
    restoreDeletionModal.hidden = false;
    return;
  }

  if (profile && profile.is_deactivated) {
    pageLoading.hidden = true;
    reactivateModal.hidden = false;
    return;
  }

  const onboardingComplete = !!(profile && profile.avatar_url && profile.gender_identity);

  if (!onboardingComplete) {
    showOnboardStep(1);
    pageLoading.hidden = true;
    onboardModal.hidden = false;
    return;
  }

  pageLoading.hidden = true;
  showHome(profile);
}

function showHome(profile) {
  homeContent.hidden = false;
  homeGreeting.textContent = `Welcome, ${profile.display_name}, what would you like to do today?`;

  if (profile.avatar_url) {
    homeAvatar.src = profile.avatar_url;
    homeAvatar.hidden = false;
  }

  if (profile.banner_url) {
    homeBanner.src = profile.banner_url;
    homeBanner.hidden = false;
  }
}

async function uploadProfileImage(file, filenamePrefix, previewEl, statusEl) {
  if (file.size > 5 * 1024 * 1024) {
    statusEl.textContent = 'Image must be under 5MB.';
    return null;
  }

  statusEl.textContent = 'Uploading...';

  const ext = file.name.split('.').pop();
  const path = `${currentSession.user.id}/${filenamePrefix}.${ext}`;

  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    statusEl.textContent = `Upload failed: ${uploadError.message}`;
    return null;
  }

  const { data: publicUrlData } = client.storage.from('avatars').getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  previewEl.src = url;
  previewEl.hidden = false;
  statusEl.textContent = 'Uploaded!';

  return url;
}

onboardAvatarInput.addEventListener('change', async () => {
  const file = onboardAvatarInput.files[0];
  if (!file) return;
  const url = await uploadProfileImage(file, 'avatar', onboardAvatarPreview, onboardAvatarStatus);
  if (url) {
    uploadedAvatarUrl = url;
    onboardAvatarPlaceholder.hidden = true;
  }
});

onboardBannerInput.addEventListener('change', async () => {
  const file = onboardBannerInput.files[0];
  if (!file) return;
  const url = await uploadProfileImage(file, 'banner', onboardBannerPreview, onboardBannerStatus);
  if (url) {
    uploadedBannerUrl = url;
    onboardBannerPlaceholder.hidden = true;
  }
});

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

async function submitOnboarding() {
  onboardError.textContent = '';

  // Steps 1-2 hold required fields and are always validated on their own
  // Next click, so re-checking them here just guards against reaching this
  // point some other way. Step 3 (bio/pronouns) is optional by design, so
  // Skip can call this directly without validating it at all.
  if (!validateOnboardStep(1)) { showOnboardStep(1); return; }
  if (!validateOnboardStep(2)) { showOnboardStep(2); return; }

  const username = document.getElementById('onboardUsername').value.trim();
  const displayName = document.getElementById('onboardDisplayName').value.trim();
  const genderIdentity = document.getElementById('onboardGenderIdentity').value.trim();
  const bio = document.getElementById('onboardBio').value.trim();
  const pronouns = document.getElementById('onboardPronouns').value.trim();
  const isNsfwAccount = document.getElementById('onboardNsfwYes').checked;

  onboardSubmitButton.disabled = true;
  onboardSkipButton.disabled = true;

  const { data: updatedProfile, error } = await client
    .from('profiles')
    .upsert({
      id: currentSession.user.id,
      username,
      display_name: displayName,
      avatar_url: uploadedAvatarUrl,
      banner_url: uploadedBannerUrl,
      bio: bio || null,
      pronouns: pronouns || null,
      gender_identity: genderIdentity,
      is_nsfw_account: isNsfwAccount,
    })
    .select('display_name, avatar_url, banner_url, gender_identity')
    .single();

  if (error) {
    onboardError.textContent = error.message.includes('duplicate')
      ? 'That username is already taken.'
      : `Error: ${error.message}`;
    onboardSubmitButton.disabled = false;
    onboardSkipButton.disabled = false;
    return;
  }

  onboardModal.hidden = true;
  showHome(updatedProfile);
}

onboardForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitOnboarding();
});

homeLogoutButton.addEventListener('click', async (event) => {
  event.preventDefault();
  await client.auth.signOut();
  window.location.href = 'index.html';
});

async function openAppealModal() {
  appealError.textContent = '';
  appealStatus.textContent = '';
  appealForm.reset();

  const { data: appeal } = await client
    .from('appeals')
    .select('appeal_number, status')
    .eq('user_id', currentSession.user.id)
    .eq('moderation_action_id', latestInfractionActionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (appeal && appeal.status === 'pending') {
    appealPrompt.hidden = true;
    appealNumberText.textContent = appeal.appeal_number;
    appealAlreadySubmitted.hidden = false;
  } else {
    appealPrompt.hidden = false;
    appealAlreadySubmitted.hidden = true;
  }

  appealModal.hidden = false;
}

warningAppealButton.addEventListener('click', openAppealModal);
suspensionAppealButton.addEventListener('click', openAppealModal);
terminationAppealButton.addEventListener('click', openAppealModal);

appealModal.querySelector('.hub-modal-close').addEventListener('click', () => { appealModal.hidden = true; });
appealModal.addEventListener('click', (event) => { if (event.target === appealModal) appealModal.hidden = true; });

appealForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  appealError.textContent = '';
  appealStatus.textContent = '';

  const reason = appealReason.value.trim();
  if (!reason) {
    appealError.textContent = 'Please explain why this decision should be reconsidered.';
    return;
  }

  const submitButton = appealForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data, error } = await client
    .from('appeals')
    .insert({ user_id: currentSession.user.id, reason, moderation_action_id: latestInfractionActionId })
    .select('appeal_number')
    .single();

  submitButton.disabled = false;

  if (error) {
    appealError.textContent = error.message;
    return;
  }

  appealStatus.textContent = `Appeal submitted (${data.appeal_number}). A moderator will review it soon.`;
  setTimeout(() => {
    appealPrompt.hidden = true;
    appealNumberText.textContent = data.appeal_number;
    appealAlreadySubmitted.hidden = false;
  }, 1500);
});

suspensionLogoutButton.addEventListener('click', async () => {
  await client.auth.signOut();
  window.location.href = 'index.html';
});

terminationLogoutButton.addEventListener('click', async () => {
  await client.auth.signOut();
  window.location.href = 'index.html';
});

warningAckButton.addEventListener('click', async () => {
  warningError.textContent = '';
  warningAckButton.disabled = true;

  const { error } = await client
    .from('profiles')
    .update({ is_deactivated: false, pending_warning_reason: null })
    .eq('id', currentSession.user.id);

  warningAckButton.disabled = false;

  if (error) {
    warningError.textContent = error.message;
    return;
  }

  warningModal.hidden = true;
  init();
});

reactivateButton.addEventListener('click', async () => {
  reactivateError.textContent = '';
  reactivateButton.disabled = true;

  const { error } = await client
    .from('profiles')
    .update({ is_deactivated: false })
    .eq('id', currentSession.user.id);

  if (error) {
    reactivateError.textContent = error.message;
    reactivateButton.disabled = false;
    return;
  }

  reactivateModal.hidden = true;
  reactivateButton.disabled = false;
  init();
});

restoreDeletionButton.addEventListener('click', async () => {
  restoreDeletionError.textContent = '';
  restoreDeletionButton.disabled = true;

  const { error } = await client
    .from('profiles')
    .update({ deletion_requested_at: null })
    .eq('id', currentSession.user.id);

  if (error) {
    restoreDeletionError.textContent = error.message;
    restoreDeletionButton.disabled = false;
    return;
  }

  restoreDeletionModal.hidden = true;
  restoreDeletionButton.disabled = false;
  init();
});

init();
