const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let viewedUserId = null;
let currentUserId = null;
let uploadedAvatarUrl = null;
let uploadedBannerUrl = null;

const pageLoading = document.getElementById('pageLoading');
const profileContent = document.getElementById('profileContent');
const profileNotFound = document.getElementById('profileNotFound');
const profileNotFoundTitle = document.getElementById('profileNotFoundTitle');
const profileNotFoundHint = document.getElementById('profileNotFoundHint');
const profileAuthRequired = document.getElementById('profileAuthRequired');
const profileBannerFrame = document.getElementById('profileBannerFrame');
const profileBanner = document.getElementById('profileBanner');
const profileBannerNsfwOverlay = document.getElementById('profileBannerNsfwOverlay');
const profileAvatarFrame = document.getElementById('profileAvatarFrame');
const profileAvatar = document.getElementById('profileAvatar');
const profileAvatarNsfwOverlay = document.getElementById('profileAvatarNsfwOverlay');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileUsername = document.getElementById('profileUsername');
const profilePronouns = document.getElementById('profilePronouns');
const profileBio = document.getElementById('profileBio');
const profileGenderIdentity = document.getElementById('profileGenderIdentity');
const profileJoinedDate = document.getElementById('profileJoinedDate');
const profileEditButton = document.getElementById('profileEditButton');
const profileReportButton = document.getElementById('profileReportButton');
const profileModerateButton = document.getElementById('profileModerateButton');
const profileFriendsCount = document.getElementById('profileFriendsCount');
const profileFollowersCount = document.getElementById('profileFollowersCount');
const profileFollowingCount = document.getElementById('profileFollowingCount');
const followButtonGroup = document.getElementById('followButtonGroup');
const followButton = document.getElementById('followButton');

const profileTabs = document.getElementById('profileTabs');
const profilePostList = document.getElementById('profilePostList');
const profilePostEmpty = document.getElementById('profilePostEmpty');
const profileFab = document.getElementById('profileFab');

const profilePostModal = document.getElementById('profilePostModal');
const profileComposerInput = document.getElementById('profileComposerInput');
const profileCharCount = document.getElementById('profileCharCount');
const profileVisibilitySelect = document.getElementById('profileVisibilitySelect');
const profileReplySelect = document.getElementById('profileReplySelect');
const profileNsfwToggle = document.getElementById('profileNsfwToggle');
const profilePostButton = document.getElementById('profilePostButton');
const profileComposerError = document.getElementById('profileComposerError');
const profileAttachButton = document.getElementById('profileAttachButton');
const profileAttachInput = document.getElementById('profileAttachInput');
const profileComposerMedia = document.getElementById('profileComposerMedia');
const profileComposerMediaPreview = document.getElementById('profileComposerMediaPreview');
const profileComposerVideoPreview = document.getElementById('profileComposerVideoPreview');
const profileComposerMediaRemove = document.getElementById('profileComposerMediaRemove');
const profileSaveGifFavorite = document.getElementById('profileSaveGifFavorite');
const profileComposerMediaStatus = document.getElementById('profileComposerMediaStatus');
const profileGifButton = document.getElementById('profileGifButton');
const profileGifPicker = document.getElementById('profileGifPicker');
const profileGifPickerGrid = document.getElementById('profileGifPickerGrid');
const profileGifPickerEmpty = document.getElementById('profileGifPickerEmpty');
const profileUploadProgress = document.getElementById('profileUploadProgress');
const profileUploadProgressBar = document.getElementById('profileUploadProgressBar');
const profileComposerAvatar = document.getElementById('profileComposerAvatar');
const profileComposerAvatarPlaceholder = document.getElementById('profileComposerAvatarPlaceholder');

let postsController = null;
let activeProfileTab = 'posts';
let pendingProfileMediaUrl = null;
let pendingProfileMediaType = null;

const editProfileModal = document.getElementById('editProfileModal');
const editProfileForm = document.getElementById('editProfileForm');
const editProfileError = document.getElementById('editProfileError');
const editDisplayName = document.getElementById('editDisplayName');
const editAvatarDrop = document.getElementById('editAvatarDrop');
const editAvatarInput = document.getElementById('editAvatarInput');
const editAvatarPreview = document.getElementById('editAvatarPreview');
const editAvatarPlaceholder = document.getElementById('editAvatarPlaceholder');
const editAvatarStatus = document.getElementById('editAvatarStatus');
const editBannerDrop = document.getElementById('editBannerDrop');
const editBannerInput = document.getElementById('editBannerInput');
const editBannerPreview = document.getElementById('editBannerPreview');
const editBannerPlaceholder = document.getElementById('editBannerPlaceholder');
const editBannerStatus = document.getElementById('editBannerStatus');
const editBio = document.getElementById('editBio');
const editPronouns = document.getElementById('editPronouns');
const editGenderIdentity = document.getElementById('editGenderIdentity');

editAvatarDrop.addEventListener('click', () => editAvatarInput.click());
editBannerDrop.addEventListener('click', () => editBannerInput.click());
const colorSwatchRow = document.getElementById('colorSwatchRow');
const editCustomColorInput = document.getElementById('editCustomColorInput');
const editCustomGradientStart = document.getElementById('editCustomGradientStart');
const editCustomGradientEnd = document.getElementById('editCustomGradientEnd');
const colorCustomGradientPreview = document.getElementById('colorCustomGradientPreview');
const matchPhotoButton = document.getElementById('matchPhotoButton');
const matchPhotoStatus = document.getElementById('matchPhotoStatus');
const profileNameBadges = document.getElementById('profileNameBadges');

let pendingColor = null;
let pendingColorType = null;

function applyFrameColor(frameEl, color, colorType) {
  const background = colorType === 'gradient' ? (color ? buildProfileGradient(color, '135deg') : null) : color;
  if (background) {
    frameEl.style.background = background;
    frameEl.classList.add('has-color');
  } else {
    frameEl.style.background = '';
    frameEl.classList.remove('has-color');
  }
}

function applyPageColorWash(color, colorType) {
  if (!color) {
    profileContent.style.background = '';
    return;
  }
  if (colorType === 'gradient') {
    const parts = parseColorPair(color);
    if (!parts) {
      profileContent.style.background = '';
      return;
    }
    profileContent.style.background = `linear-gradient(180deg, color-mix(in srgb, ${parts[0]} 22%, transparent), color-mix(in srgb, ${parts[1]} 22%, transparent))`;
  } else {
    profileContent.style.background = `color-mix(in srgb, ${color} 18%, transparent)`;
  }
}

function applyProfileNsfwBlur(profile, isOwnProfile, nsfwPrefs) {
  const shouldBlur = !!profile.is_nsfw_account && !isOwnProfile && !nsfwPrefs.autoUnblurNsfw;

  [
    { frame: profileAvatarFrame, img: profileAvatar, overlay: profileAvatarNsfwOverlay },
    { frame: profileBannerFrame, img: profileBanner, overlay: profileBannerNsfwOverlay },
  ].forEach(({ frame, img, overlay }) => {
    if (!shouldBlur) {
      frame.classList.remove('post-nsfw-wrap', 'revealed');
      img.classList.remove('post-nsfw-blur');
      if (overlay) overlay.hidden = true;
      return;
    }

    frame.classList.add('post-nsfw-wrap');
    img.classList.add('post-nsfw-blur');
    if (overlay) overlay.hidden = false;

    if (!frame.dataset.nsfwWired) {
      frame.dataset.nsfwWired = 'true';
      frame.addEventListener('click', async (event) => {
        if (!frame.classList.contains('post-nsfw-wrap')) return;
        event.preventDefault();
        if (frame.classList.contains('revealed')) {
          frame.classList.remove('revealed');
          return;
        }
        if (!(await ensureAdultConfirmed(client, currentUserId, nsfwPrefs.adultConfirmCache))) return;
        frame.classList.add('revealed');
      });
    }
  });
}

function getUserIdFromUrl() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const profilesIndex = segments.indexOf('profiles');
  return profilesIndex !== -1 ? segments[profilesIndex + 1] : null;
}

function renderProfile(profile) {
  profileContent.hidden = false;
  profileNotFound.hidden = true;

  profileDisplayName.textContent = profile.display_name;
  applyNameColor(profileDisplayName, profile.profile_color, profile.profile_color_type);
  profileNameBadges.innerHTML = buildBadgesHtml(profile);
  profileUsername.textContent = `@${profile.username}`;

  profileAvatarFrame.hidden = !profile.avatar_url;
  if (profile.avatar_url) profileAvatar.src = profile.avatar_url;

  profileBannerFrame.hidden = !profile.banner_url;
  if (profile.banner_url) profileBanner.src = profile.banner_url;

  applyFrameColor(profileAvatarFrame, profile.profile_color, profile.profile_color_type);
  applyFrameColor(profileBannerFrame, profile.profile_color, profile.profile_color_type);
  applyPageColorWash(profile.profile_color, profile.profile_color_type);

  profilePronouns.textContent = profile.pronouns || '';
  profileBio.textContent = profile.bio || '';
  profileGenderIdentity.textContent = profile.gender_identity;

  profileJoinedDate.textContent = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';
}

async function loadProfile() {
  const { data: profile, error } = await client
    .from('profiles')
    .select('username, display_name, avatar_url, banner_url, bio, pronouns, gender_identity, created_at, is_deactivated, deletion_requested_at, terminated_at, is_verified, role, profile_color, profile_color_type, is_nsfw_account')
    .eq('id', viewedUserId)
    .single();

  if (error || !profile || profile.is_deactivated || profile.deletion_requested_at || profile.terminated_at) {
    if (profile && profile.terminated_at) {
      profileNotFoundTitle.textContent = 'Account Terminated';
      profileNotFoundHint.textContent = 'This account was terminated for violating FactureHub Terms Of Service.';
    } else {
      profileNotFoundTitle.textContent = 'Profile Not Found';
      profileNotFoundHint.textContent = 'This FactureHub profile doesn’t exist.';
    }
    profileNotFound.hidden = false;
    return null;
  }

  renderProfile(profile);
  return profile;
}

async function loadFollowStats() {
  const [{ data: followers }, { data: following }] = await Promise.all([
    client.from('follows').select('follower_id').eq('following_id', viewedUserId),
    client.from('follows').select('following_id').eq('follower_id', viewedUserId),
  ]);

  const followerIds = new Set((followers || []).map((f) => f.follower_id));
  const followingIds = new Set((following || []).map((f) => f.following_id));
  const friendsCount = [...followerIds].filter((id) => followingIds.has(id)).length;

  profileFriendsCount.textContent = friendsCount;
  profileFollowersCount.textContent = followerIds.size;
  profileFollowingCount.textContent = followingIds.size;

  return { followerIds, followingIds };
}

async function refreshFollowButton() {
  if (!currentUserId || currentUserId === viewedUserId) return;

  const { followerIds } = await loadFollowStats();
  const amFollowing = followerIds.has(currentUserId);

  followButtonGroup.hidden = false;
  followButton.textContent = amFollowing ? 'Unfollow' : 'Follow';
  followButton.dataset.following = amFollowing ? 'true' : 'false';
}

followButton.addEventListener('click', async () => {
  followButton.disabled = true;
  const amFollowing = followButton.dataset.following === 'true';

  if (amFollowing) {
    await client
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', viewedUserId);
  } else {
    await client
      .from('follows')
      .insert({ follower_id: currentUserId, following_id: viewedUserId });

    await client
      .from('notifications')
      .insert({ user_id: viewedUserId, type: 'follow', actor_id: currentUserId });
  }

  await refreshFollowButton();
  followButton.disabled = false;
});

async function loadProfilePosts(tab) {
  activeProfileTab = tab;
  profilePostList.innerHTML = '';
  profilePostEmpty.hidden = true;

  if (tab === 'posts') {
    await loadPostsTabWithReposts();
    return;
  }

  let query = client
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .eq('author_id', viewedUserId)
    .is('removed_at', null)
    .order('created_at', { ascending: false });

  if (tab === 'replies') {
    query = query.not('parent_post_id', 'is', null);
  } else if (tab === 'media') {
    query = query.not('media_url', 'is', null);
  }

  const { data: posts, error } = await query;

  if (error) {
    profilePostList.innerHTML = `<p class="hub-form-error">Failed to load posts: ${error.message}</p>`;
    return;
  }

  if (!posts || posts.length === 0) {
    profilePostEmpty.hidden = false;
    return;
  }

  await postsController.renderPostList(posts, profilePostList, {
    onDeleted: () => {
      if (!profilePostList.querySelector('.post-card')) profilePostEmpty.hidden = false;
    },
  });
}

async function loadPostsTabWithReposts() {
  const [{ data: ownPosts, error: ownError }, { data: repostRows }] = await Promise.all([
    client
      .from('posts')
      .select(POST_SELECT_COLUMNS)
      .eq('author_id', viewedUserId)
      .is('parent_post_id', null)
      .is('removed_at', null)
      .order('created_at', { ascending: false }),
    client
      .from('post_reposts')
      .select('post_id, created_at')
      .eq('user_id', viewedUserId)
      .order('created_at', { ascending: false }),
  ]);

  if (ownError) {
    profilePostList.innerHTML = `<p class="hub-form-error">Failed to load posts: ${ownError.message}</p>`;
    return;
  }

  const entries = (ownPosts || []).map((post) => ({ post, sortAt: post.created_at, repost: false }));

  if (repostRows && repostRows.length > 0) {
    const { data: repostedPosts, error: repostedError } = await client
      .from('posts')
      .select(POST_SELECT_COLUMNS)
      .in('id', repostRows.map((r) => r.post_id))
      .is('removed_at', null);

    if (repostedError) {
      profilePostList.innerHTML = `<p class="hub-form-error">Failed to load reposts: ${repostedError.message}</p>`;
      return;
    }

    const repostedMap = new Map((repostedPosts || []).map((p) => [p.id, p]));

    repostRows.forEach((row) => {
      const post = repostedMap.get(row.post_id);
      if (!post || post.author_id === viewedUserId) return;
      entries.push({ post, sortAt: row.created_at, repost: true });
    });
  }

  entries.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

  if (entries.length === 0) {
    profilePostEmpty.hidden = false;
    return;
  }

  const authorMap = await postsController.fetchProfilesById(entries.map((e) => e.post.author_id));
  const state = await postsController.fetchInteractionState(entries.map((e) => e.post.id));

  for (const entry of entries) {
    const card = postsController.buildCard(entry.post, authorMap.get(entry.post.author_id), state, {
      repostBadge: entry.repost,
      onDeleted: () => {
        if (!profilePostList.querySelector('.post-card')) profilePostEmpty.hidden = false;
      },
    });
    profilePostList.appendChild(card);
  }
}

profileTabs.querySelectorAll('.profile-tab').forEach((tabButton) => {
  tabButton.addEventListener('click', async () => {
    profileTabs.querySelectorAll('.profile-tab').forEach((btn) => btn.classList.remove('active'));
    tabButton.classList.add('active');
    await loadProfilePosts(tabButton.dataset.tab);
  });
});

function resetProfileComposerMedia() {
  pendingProfileMediaUrl = null;
  pendingProfileMediaType = null;
  profileComposerMedia.hidden = true;
  profileComposerMediaPreview.hidden = true;
  profileComposerVideoPreview.hidden = true;
  profileComposerMediaPreview.src = '';
  profileComposerVideoPreview.src = '';
  profileSaveGifFavorite.hidden = true;
  profileSaveGifFavorite.classList.remove('favorited');
  profileAttachInput.value = '';
  profileComposerMediaStatus.textContent = '';
  profileUploadProgress.hidden = true;
  profileUploadProgressBar.style.width = '0%';
}

function showProfileComposerMedia(url, mediaType, { fromFavorite } = {}) {
  pendingProfileMediaUrl = url;
  pendingProfileMediaType = mediaType;

  profileComposerMedia.hidden = false;
  if (mediaType === 'video') {
    profileComposerVideoPreview.src = url;
    profileComposerVideoPreview.hidden = false;
    profileComposerMediaPreview.hidden = true;
  } else {
    profileComposerMediaPreview.src = url;
    profileComposerMediaPreview.hidden = false;
    profileComposerVideoPreview.hidden = true;
  }

  profileSaveGifFavorite.hidden = !(mediaType === 'gif' && !fromFavorite);
  if (mediaType === 'gif') {
    postsController.wireGifFavoriteButton(profileSaveGifFavorite, url, url);
  }
}

profileFab.addEventListener('click', () => {
  profileComposerInput.value = '';
  profileCharCount.textContent = '0 / 500';
  profileVisibilitySelect.value = 'everyone';
  profileReplySelect.value = 'everyone';
  profileNsfwToggle.setAttribute('aria-pressed', 'false');
  profileComposerError.textContent = '';
  resetProfileComposerMedia();

  if (!profileAvatarFrame.hidden) {
    profileComposerAvatar.src = profileAvatar.src;
    profileComposerAvatar.hidden = false;
    profileComposerAvatarPlaceholder.hidden = true;
  } else {
    profileComposerAvatar.hidden = true;
    profileComposerAvatarPlaceholder.hidden = false;
  }

  profilePostModal.hidden = false;
});

profileComposerInput.addEventListener('input', () => {
  profileCharCount.textContent = `${profileComposerInput.value.length} / 500`;
});

profileNsfwToggle.addEventListener('click', () => {
  const nowActive = profileNsfwToggle.getAttribute('aria-pressed') !== 'true';
  profileNsfwToggle.setAttribute('aria-pressed', String(nowActive));
});

profileAttachButton.addEventListener('click', () => profileAttachInput.click());

profileAttachInput.addEventListener('change', async () => {
  const file = profileAttachInput.files[0];
  if (!file) return;

  profileComposerMedia.hidden = false;
  profileComposerMediaStatus.textContent = 'Uploading...';
  profileUploadProgress.hidden = false;
  profileUploadProgressBar.style.width = '0%';

  const { url, mediaType, error } = await postsController.uploadPostMedia(file, (percent) => {
    profileUploadProgressBar.style.width = `${percent}%`;
  });

  profileUploadProgress.hidden = true;

  if (error) {
    profileComposerMediaStatus.textContent = error.message;
    profileComposerMedia.hidden = true;
    profileAttachInput.value = '';
    return;
  }

  profileComposerMediaStatus.textContent = '';
  showProfileComposerMedia(url, mediaType);
});

profileComposerMediaRemove.addEventListener('click', resetProfileComposerMedia);

function closeProfileGifPicker() {
  profileGifPicker.hidden = true;
}

profileGifButton.addEventListener('click', async () => {
  const willOpen = profileGifPicker.hidden;
  closeProfileGifPicker();
  if (!willOpen) return;

  profileGifPicker.hidden = false;

  const favorites = await postsController.fetchFavoriteGifs();
  profileGifPickerGrid.querySelectorAll('.dm-gif-thumb').forEach((el) => el.remove());
  profileGifPickerEmpty.hidden = favorites.length > 0;

  favorites.forEach((fav) => {
    const img = document.createElement('img');
    img.className = 'dm-gif-thumb';
    img.src = fav.url;
    img.alt = 'Favorite GIF';
    img.addEventListener('click', () => {
      closeProfileGifPicker();
      showProfileComposerMedia(fav.url, 'gif', { fromFavorite: true });
    });
    profileGifPickerGrid.appendChild(img);
  });
});

document.querySelectorAll('[data-close-picker]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.closePicker).hidden = true;
  });
});

document.addEventListener('click', (event) => {
  if (!profileGifPicker.contains(event.target) && !profileGifButton.contains(event.target)) {
    profileGifPicker.hidden = true;
  }
});

profilePostButton.addEventListener('click', async () => {
  profileComposerError.textContent = '';
  const content = profileComposerInput.value.trim();

  if (!content) {
    profileComposerError.textContent = 'Write something before posting.';
    return;
  }

  profilePostButton.disabled = true;

  const { data: newPost, error } = await postsController.createPost({
    content,
    visibility: profileVisibilitySelect.value,
    replyPermission: profileReplySelect.value,
    mediaUrl: pendingProfileMediaUrl,
    mediaType: pendingProfileMediaType,
    isNsfw: profileNsfwToggle.getAttribute('aria-pressed') === 'true',
  });

  profilePostButton.disabled = false;

  if (error) {
    profileComposerError.textContent = `Error: ${error.message}`;
    return;
  }

  profilePostModal.hidden = true;
  resetProfileComposerMedia();

  if (activeProfileTab === 'posts' || (activeProfileTab === 'media' && newPost.media_url)) {
    profilePostEmpty.hidden = true;
    const authorMap = await postsController.fetchProfilesById([currentUserId]);
    const card = postsController.buildCard(newPost, authorMap.get(currentUserId), { liked: new Set(), reposted: new Set() }, {
      onDeleted: () => {
        if (!profilePostList.querySelector('.post-card')) profilePostEmpty.hidden = false;
      },
    });
    profilePostList.prepend(card);
  }
});

async function init() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    pageLoading.hidden = true;
    profileAuthRequired.hidden = false;
    return;
  }

  viewedUserId = getUserIdFromUrl();

  if (!viewedUserId) {
    pageLoading.hidden = true;
    profileNotFound.hidden = false;
    return;
  }

  const profile = await loadProfile();
  pageLoading.hidden = true;
  if (!profile) return;

  await loadFollowStats();

  currentUserId = session.user.id;

  const { data: viewerProfile } = await client
    .from('profiles')
    .select('role, auto_unblur_nsfw, confirmed_adult_content')
    .eq('id', session.user.id)
    .single();
  const currentUserRole = viewerProfile && viewerProfile.role;
  const viewerNsfwPrefs = {
    autoUnblurNsfw: !!(viewerProfile && viewerProfile.auto_unblur_nsfw),
    adultConfirmCache: { confirmed: !!(viewerProfile && viewerProfile.confirmed_adult_content) },
  };

  if (session.user.id === viewedUserId) {
    profileEditButton.hidden = false;
    profileFab.hidden = false;
  } else {
    await refreshFollowButton();
    profileReportButton.hidden = false;

    if (currentUserRole === 'moderator' || currentUserRole === 'owner') {
      profileModerateButton.hidden = false;
    }
  }

  applyProfileNsfwBlur(profile, currentUserId === viewedUserId, viewerNsfwPrefs);

  postsController = createPostsController(client, currentUserId, SUPABASE_URL, SUPABASE_ANON_KEY, currentUserRole, viewerNsfwPrefs);
  await loadProfilePosts('posts');
}

profileEditButton.addEventListener('click', async () => {
  const { data: profile } = await client
    .from('profiles')
    .select('display_name, avatar_url, banner_url, bio, pronouns, gender_identity, profile_color, profile_color_type')
    .eq('id', viewedUserId)
    .single();

  if (!profile) return;

  editDisplayName.value = profile.display_name || '';
  editBio.value = profile.bio || '';
  editPronouns.value = profile.pronouns || '';
  editGenderIdentity.value = profile.gender_identity || '';

  uploadedAvatarUrl = null;
  uploadedBannerUrl = null;
  editAvatarInput.value = '';
  editBannerInput.value = '';
  editAvatarStatus.textContent = '';
  editBannerStatus.textContent = '';
  editProfileError.textContent = '';

  if (profile.avatar_url) {
    editAvatarPreview.src = profile.avatar_url;
    editAvatarPreview.hidden = false;
    editAvatarPlaceholder.hidden = true;
  } else {
    editAvatarPreview.hidden = true;
    editAvatarPlaceholder.hidden = false;
  }

  if (profile.banner_url) {
    editBannerPreview.src = profile.banner_url;
    editBannerPreview.hidden = false;
    editBannerPlaceholder.hidden = true;
  } else {
    editBannerPreview.hidden = true;
    editBannerPlaceholder.hidden = false;
  }

  pendingColor = profile.profile_color || null;
  pendingColorType = profile.profile_color_type || null;

  const isPreset = pendingColor && Array.from(colorSwatchRow.querySelectorAll('.color-swatch')).some(
    (swatch) => swatch.dataset.color === pendingColor && swatch.dataset.type === pendingColorType
  );

  if (!isPreset && pendingColorType === 'solid' && pendingColor) {
    editCustomColorInput.value = pendingColor;
    setActiveSwatch('__custom__', '__custom__');
  } else if (!isPreset && pendingColorType === 'gradient' && pendingColor) {
    const [start, end] = pendingColor.split(',');
    if (start) editCustomGradientStart.value = start;
    if (end) editCustomGradientEnd.value = end;
    updateGradientPreview();
    setActiveSwatch('__custom__', '__custom__');
  } else {
    setActiveSwatch(pendingColor, pendingColorType);
  }

  editProfileModal.hidden = false;
});

document.querySelectorAll('[data-modal-close]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.modalClose).hidden = true;
  });
});

async function uploadProfileImage(file, filenamePrefix, previewEl, statusEl, bucket = 'avatars') {
  if (file.size > 5 * 1024 * 1024) {
    statusEl.textContent = 'Image must be under 5MB.';
    return null;
  }

  statusEl.textContent = 'Uploading...';

  const ext = file.name.split('.').pop();
  const path = `${viewedUserId}/${filenamePrefix}.${ext}`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (uploadError) {
    statusEl.textContent = `Upload failed: ${uploadError.message}`;
    return null;
  }

  const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  previewEl.src = url;
  previewEl.hidden = false;
  statusEl.textContent = 'Uploaded!';

  return url;
}

function setActiveSwatch(color, colorType) {
  colorSwatchRow.querySelectorAll('.color-swatch').forEach((swatch) => {
    const isDefault = swatch.classList.contains('color-swatch--default');
    const matches = isDefault
      ? (color === null && colorType === null)
      : (swatch.dataset.color === color && swatch.dataset.type === colorType);
    swatch.classList.toggle('active', matches);
  });
}

colorSwatchRow.querySelectorAll('.color-swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    pendingColor = swatch.dataset.color || null;
    pendingColorType = swatch.dataset.type || null;
    setActiveSwatch(pendingColor, pendingColorType);
  });
});

editCustomColorInput.addEventListener('input', () => {
  pendingColor = editCustomColorInput.value;
  pendingColorType = 'solid';
  setActiveSwatch('__custom__', '__custom__');
});

function updateGradientPreview() {
  colorCustomGradientPreview.style.background = `linear-gradient(90deg, ${editCustomGradientStart.value}, ${editCustomGradientEnd.value})`;
}

[editCustomGradientStart, editCustomGradientEnd].forEach((input) => {
  input.addEventListener('input', () => {
    pendingColor = `${editCustomGradientStart.value},${editCustomGradientEnd.value}`;
    pendingColorType = 'gradient';
    updateGradientPreview();
    setActiveSwatch('__custom__', '__custom__');
  });
});

updateGradientPreview();

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function extractGradientFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 60;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const candidates = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const [h, s, l] = rgbToHsl(r, g, b);
          if (l < 0.08 || l > 0.92) continue;
          candidates.push({ r, g, b, h, s, l });
        }

        if (candidates.length === 0) {
          reject(new Error('Could not pull a color from this image.'));
          return;
        }

        candidates.sort((a, b) => (b.s * (1 - Math.abs(b.l - 0.5))) - (a.s * (1 - Math.abs(a.l - 0.5))));
        const first = candidates[0];

        let second = candidates.find((c) => hueDistance(c.h, first.h) > 35);
        if (!second) {
          const shiftedL = first.l > 0.5 ? Math.max(0.15, first.l - 0.35) : Math.min(0.85, first.l + 0.35);
          const [r2, g2, b2] = hslToRgb(first.h, first.s, shiftedL);
          second = { r: r2, g: g2, b: b2 };
        }

        resolve([rgbToHex(first.r, first.g, first.b), rgbToHex(second.r, second.g, second.b)]);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not load this image.'));
    img.src = url;
  });
}

if (matchPhotoButton) {
  matchPhotoButton.addEventListener('click', async () => {
    const sourceUrl = (!editAvatarPreview.hidden && editAvatarPreview.src)
      ? editAvatarPreview.src
      : (!editBannerPreview.hidden && editBannerPreview.src) ? editBannerPreview.src : null;

    if (!sourceUrl) {
      matchPhotoStatus.textContent = 'Add a profile picture or banner first.';
      return;
    }

    matchPhotoStatus.textContent = 'Matching your photo…';
    matchPhotoButton.disabled = true;

    try {
      const [start, end] = await extractGradientFromUrl(sourceUrl);
      editCustomGradientStart.value = start;
      editCustomGradientEnd.value = end;
      pendingColor = `${start},${end}`;
      pendingColorType = 'gradient';
      updateGradientPreview();
      setActiveSwatch('__custom__', '__custom__');
      matchPhotoStatus.textContent = 'Matched!';
    } catch (err) {
      matchPhotoStatus.textContent = err.message || 'Could not match this image.';
    } finally {
      matchPhotoButton.disabled = false;
    }
  });
}

editAvatarInput.addEventListener('change', async () => {
  const file = editAvatarInput.files[0];
  editAvatarInput.value = '';
  if (!file) return;
  const croppedBlob = await window.openImageCropper(file, { aspect: 1, circle: true });
  if (!croppedBlob) return;
  const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
  const url = await uploadProfileImage(croppedFile, 'avatar', editAvatarPreview, editAvatarStatus);
  if (url) {
    uploadedAvatarUrl = url;
    editAvatarPlaceholder.hidden = true;
  }
});

editBannerInput.addEventListener('change', async () => {
  const file = editBannerInput.files[0];
  editBannerInput.value = '';
  if (!file) return;
  const croppedBlob = await window.openImageCropper(file, { aspect: 3, circle: false });
  if (!croppedBlob) return;
  const croppedFile = new File([croppedBlob], 'banner.jpg', { type: 'image/jpeg' });
  const url = await uploadProfileImage(croppedFile, 'banner', editBannerPreview, editBannerStatus);
  if (url) {
    uploadedBannerUrl = url;
    editBannerPlaceholder.hidden = true;
  }
});

editProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  editProfileError.textContent = '';

  const displayName = editDisplayName.value.trim();
  const genderIdentity = editGenderIdentity.value.trim();

  if (!displayName) {
    editProfileError.textContent = 'Please enter a display name.';
    return;
  }
  if (!genderIdentity) {
    editProfileError.textContent = 'Please enter your gender identity.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const updates = {
    display_name: displayName,
    bio: editBio.value.trim() || null,
    pronouns: editPronouns.value.trim() || null,
    gender_identity: genderIdentity,
  };

  if (uploadedAvatarUrl) updates.avatar_url = uploadedAvatarUrl;
  if (uploadedBannerUrl) updates.banner_url = uploadedBannerUrl;
  updates.profile_color = pendingColor;
  updates.profile_color_type = pendingColorType;

  const { error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', viewedUserId);

  if (error) {
    editProfileError.textContent = `Error: ${error.message}`;
    submitButton.disabled = false;
    return;
  }

  submitButton.disabled = false;
  editProfileModal.hidden = true;
  await loadProfile();
});

profileReportButton.addEventListener('click', () => {
  openReportModal(async (reason, customReason) => {
    return await client.from('reports').insert({
      reporter_id: currentUserId,
      target_type: 'profile',
      target_id: viewedUserId,
      reason,
      custom_reason: customReason,
    });
  });
});

profileModerateButton.addEventListener('click', async () => {
  const { data: targetProfile } = await client
    .from('profiles')
    .select('username, warning_count')
    .eq('id', viewedUserId)
    .single();

  if (!targetProfile) return;

  openModerationModal(
    `@${targetProfile.username}`,
    targetProfile.warning_count || 0,
    async (reason) => {
      const { data, error } = await client.rpc('warn_user', {
        _target_user_id: viewedUserId,
        _reason: reason,
        _delete_post_id: null,
        _delete_message_id: null,
        _content: null,
      });
      return { error, result: data };
    },
    async (reason) => {
      const { error } = await client.rpc('terminate_user', {
        _target_user_id: viewedUserId,
        _reason: reason,
        _delete_post_id: null,
        _delete_message_id: null,
        _content: null,
      });
      return { error };
    }
  );
});

init();
