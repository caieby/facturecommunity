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
const profileBannerFrame = document.getElementById('profileBannerFrame');
const profileBanner = document.getElementById('profileBanner');
const profileAvatarFrame = document.getElementById('profileAvatarFrame');
const profileAvatar = document.getElementById('profileAvatar');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileUsername = document.getElementById('profileUsername');
const profilePronouns = document.getElementById('profilePronouns');
const profileBio = document.getElementById('profileBio');
const profileSexuality = document.getElementById('profileSexuality');
const profileGenderIdentity = document.getElementById('profileGenderIdentity');
const profileJoinedDate = document.getElementById('profileJoinedDate');
const profileEditButton = document.getElementById('profileEditButton');
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
const editUsername = document.getElementById('editUsername');
const editUsernameHint = document.getElementById('editUsernameHint');
const editUsernamePasswordRow = document.getElementById('editUsernamePasswordRow');
const editUsernamePassword = document.getElementById('editUsernamePassword');
let originalUsername = '';
let usernameChangedAt = null;
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
const editSexuality = document.getElementById('editSexuality');
const editGenderIdentity = document.getElementById('editGenderIdentity');

editAvatarDrop.addEventListener('click', () => editAvatarInput.click());
editBannerDrop.addEventListener('click', () => editBannerInput.click());
const colorSwatchRow = document.getElementById('colorSwatchRow');
const editCustomColorInput = document.getElementById('editCustomColorInput');
const profileNameBadges = document.getElementById('profileNameBadges');

let pendingColor = null;
let pendingColorType = null;

function applyFrameColor(frameEl, color) {
  if (color) {
    frameEl.style.background = color;
    frameEl.classList.add('has-color');
  } else {
    frameEl.style.background = '';
    frameEl.classList.remove('has-color');
  }
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

  applyFrameColor(profileAvatarFrame, profile.profile_color);
  applyFrameColor(profileBannerFrame, profile.profile_color);

  profilePronouns.textContent = profile.pronouns || '';
  profileBio.textContent = profile.bio || '';
  profileSexuality.textContent = profile.sexuality || 'Not shared';
  profileGenderIdentity.textContent = profile.gender_identity;

  profileJoinedDate.textContent = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';
}

async function loadProfile() {
  const { data: profile, error } = await client
    .from('profiles')
    .select('username, display_name, avatar_url, banner_url, bio, pronouns, sexuality, gender_identity, created_at, is_deactivated, deletion_requested_at, is_verified, profile_color, profile_color_type')
    .eq('id', viewedUserId)
    .single();

  if (error || !profile || profile.is_deactivated || profile.deletion_requested_at) {
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

// The Posts tab mixes this person's own posts with things they've reposted,
// each sorted by when that respective action happened (post time vs repost time).
async function loadPostsTabWithReposts() {
  const [{ data: ownPosts, error: ownError }, { data: repostRows }] = await Promise.all([
    client
      .from('posts')
      .select(POST_SELECT_COLUMNS)
      .eq('author_id', viewedUserId)
      .is('parent_post_id', null)
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
      .in('id', repostRows.map((r) => r.post_id));

    if (repostedError) {
      profilePostList.innerHTML = `<p class="hub-form-error">Failed to load reposts: ${repostedError.message}</p>`;
      return;
    }

    const repostedMap = new Map((repostedPosts || []).map((p) => [p.id, p]));

    repostRows.forEach((row) => {
      const post = repostedMap.get(row.post_id);
      // Skip if not visible to this viewer (RLS-filtered), deleted, or a self-repost
      // of a post already in ownPosts above.
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
}

profileFab.addEventListener('click', () => {
  profileComposerInput.value = '';
  profileCharCount.textContent = '0 / 500';
  profileVisibilitySelect.value = 'everyone';
  profileReplySelect.value = 'everyone';
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

profileSaveGifFavorite.addEventListener('click', async () => {
  profileSaveGifFavorite.disabled = true;
  const { error } = await postsController.saveFavoriteGifFromUrl(pendingProfileMediaUrl);
  profileSaveGifFavorite.disabled = false;

  if (error) {
    alert(`Could not save this GIF as a favorite: ${error.message}`);
    return;
  }

  profileSaveGifFavorite.classList.add('favorited');
});

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

  const { data: { session } } = await client.auth.getSession();
  if (session) {
    currentUserId = session.user.id;

    if (session.user.id === viewedUserId) {
      profileEditButton.hidden = false;
      profileFab.hidden = false;
    } else {
      await refreshFollowButton();
    }
  }

  postsController = createPostsController(client, currentUserId, SUPABASE_URL, SUPABASE_ANON_KEY);
  await loadProfilePosts('posts');
}

profileEditButton.addEventListener('click', async () => {
  const { data: profile } = await client
    .from('profiles')
    .select('username, display_name, avatar_url, banner_url, bio, pronouns, sexuality, gender_identity, profile_color, profile_color_type, username_changed_at')
    .eq('id', viewedUserId)
    .single();

  if (!profile) return;

  originalUsername = profile.username || '';
  usernameChangedAt = profile.username_changed_at;
  editUsername.value = originalUsername;
  editUsernameHint.textContent = '';
  editUsernamePasswordRow.hidden = true;
  editUsernamePassword.value = '';
  editDisplayName.value = profile.display_name || '';
  editBio.value = profile.bio || '';
  editPronouns.value = profile.pronouns || '';
  editSexuality.value = profile.sexuality || '';
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
  if (pendingColorType === 'solid' && !colorSwatchRow.querySelector(`[data-color="${pendingColor}"]`)) {
    editCustomColorInput.value = pendingColor;
    setActiveSwatch('__custom__', '__custom__');
  } else {
    setActiveSwatch(pendingColor, pendingColorType);
  }

  editProfileModal.hidden = false;
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

editUsername.addEventListener('input', () => {
  const changing = editUsername.value.trim() !== originalUsername;
  editUsernamePasswordRow.hidden = !changing;

  if (!changing) {
    editUsernameHint.textContent = '';
    return;
  }

  const daysLeft = getUsernameCooldownDaysLeft();
  editUsernameHint.textContent = daysLeft > 0
    ? `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
    : 'Changing your username requires your current password and can only be done once every 7 days.';
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

editAvatarInput.addEventListener('change', async () => {
  const file = editAvatarInput.files[0];
  if (!file) return;
  const url = await uploadProfileImage(file, 'avatar', editAvatarPreview, editAvatarStatus);
  if (url) {
    uploadedAvatarUrl = url;
    editAvatarPlaceholder.hidden = true;
  }
});

editBannerInput.addEventListener('change', async () => {
  const file = editBannerInput.files[0];
  if (!file) return;
  const url = await uploadProfileImage(file, 'banner', editBannerPreview, editBannerStatus);
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

  const newUsername = editUsername.value.trim();
  const usernameChanging = newUsername !== originalUsername;

  if (!newUsername) {
    editProfileError.textContent = 'Please enter a username.';
    return;
  }
  if (!isValidUsername(newUsername)) {
    editProfileError.textContent = 'Usernames must be 3-20 characters and can only contain letters, numbers, and underscores.';
    return;
  }

  if (usernameChanging) {
    const daysLeft = getUsernameCooldownDaysLeft();
    if (daysLeft > 0) {
      editProfileError.textContent = `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;
      return;
    }
    if (!editUsernamePassword.value) {
      editProfileError.textContent = 'Please enter your current password to change your username.';
      return;
    }
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  if (usernameChanging) {
    const { data: { session } } = await client.auth.getSession();
    const { error: verifyError } = await client.auth.signInWithPassword({
      email: session.user.email,
      password: editUsernamePassword.value,
    });

    if (verifyError) {
      editProfileError.textContent = 'Incorrect password.';
      submitButton.disabled = false;
      return;
    }
  }

  const updates = {
    display_name: displayName,
    bio: editBio.value.trim() || null,
    pronouns: editPronouns.value.trim() || null,
    sexuality: editSexuality.value.trim() || null,
    gender_identity: genderIdentity,
  };

  if (usernameChanging) {
    updates.username = newUsername;
    updates.username_changed_at = new Date().toISOString();
  }

  if (uploadedAvatarUrl) updates.avatar_url = uploadedAvatarUrl;
  if (uploadedBannerUrl) updates.banner_url = uploadedBannerUrl;
  updates.profile_color = pendingColor;
  updates.profile_color_type = pendingColorType;

  const { error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', viewedUserId);

  if (error) {
    editProfileError.textContent = error.message.includes('duplicate')
      ? 'That username is already taken.'
      : `Error: ${error.message}`;
    submitButton.disabled = false;
    return;
  }

  originalUsername = usernameChanging ? newUsername : originalUsername;
  if (usernameChanging) usernameChangedAt = updates.username_changed_at;

  submitButton.disabled = false;
  editProfileModal.hidden = true;
  await loadProfile();
});

init();
