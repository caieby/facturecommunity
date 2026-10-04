const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSession = null;
let postsController = null;
let feedPosts = [];
let feedRenderedCount = 0;
const FEED_PAGE_SIZE = 20;
const FEED_FETCH_LIMIT = 200;

const pageLoading = document.getElementById('pageLoading');
const feedView = document.getElementById('feedView');
const feedList = document.getElementById('feedList');
const feedEmpty = document.getElementById('feedEmpty');
const feedLoadMore = document.getElementById('feedLoadMore');
const feedFab = document.getElementById('feedFab');
const feedComposer = document.getElementById('feedComposer');
const feedComposerInput = document.getElementById('feedComposerInput');
const feedCharCount = document.getElementById('feedCharCount');
const feedVisibilitySelect = document.getElementById('feedVisibilitySelect');
const feedReplySelect = document.getElementById('feedReplySelect');
const feedNsfwToggle = document.getElementById('feedNsfwToggle');
const feedPostButton = document.getElementById('feedPostButton');
const feedComposerError = document.getElementById('feedComposerError');
const feedAttachButton = document.getElementById('feedAttachButton');
const feedAttachInput = document.getElementById('feedAttachInput');
const feedComposerMedia = document.getElementById('feedComposerMedia');
const feedComposerMediaPreview = document.getElementById('feedComposerMediaPreview');
const feedComposerVideoPreview = document.getElementById('feedComposerVideoPreview');
const feedComposerMediaRemove = document.getElementById('feedComposerMediaRemove');
const feedSaveGifFavorite = document.getElementById('feedSaveGifFavorite');
const feedComposerMediaStatus = document.getElementById('feedComposerMediaStatus');
const feedGifButton = document.getElementById('feedGifButton');
const feedGifPicker = document.getElementById('feedGifPicker');
const feedGifPickerGrid = document.getElementById('feedGifPickerGrid');
const feedGifPickerEmpty = document.getElementById('feedGifPickerEmpty');
const feedUploadProgress = document.getElementById('feedUploadProgress');
const feedUploadProgressBar = document.getElementById('feedUploadProgressBar');
const feedComposerAvatar = document.getElementById('feedComposerAvatar');
const feedComposerAvatarPlaceholder = document.getElementById('feedComposerAvatarPlaceholder');
const feedComposerAvatarLink = document.getElementById('feedComposerAvatarLink');

let pendingMediaUrl = null;
let pendingMediaType = null;

feedComposerInput.addEventListener('input', () => {
  feedCharCount.textContent = `${feedComposerInput.value.length} / 500`;
});

function resetComposerMedia() {
  pendingMediaUrl = null;
  pendingMediaType = null;
  feedComposerMedia.hidden = true;
  feedComposerMediaPreview.hidden = true;
  feedComposerVideoPreview.hidden = true;
  feedComposerMediaPreview.src = '';
  feedComposerVideoPreview.src = '';
  feedSaveGifFavorite.hidden = true;
  feedSaveGifFavorite.classList.remove('favorited');
  feedAttachInput.value = '';
  feedComposerMediaStatus.textContent = '';
  feedUploadProgress.hidden = true;
  feedUploadProgressBar.style.width = '0%';
}

function showComposerMedia(url, mediaType, { fromFavorite } = {}) {
  pendingMediaUrl = url;
  pendingMediaType = mediaType;

  feedComposerMedia.hidden = false;
  if (mediaType === 'video') {
    feedComposerVideoPreview.src = url;
    feedComposerVideoPreview.hidden = false;
    feedComposerMediaPreview.hidden = true;
  } else {
    feedComposerMediaPreview.src = url;
    feedComposerMediaPreview.hidden = false;
    feedComposerVideoPreview.hidden = true;
  }

  feedSaveGifFavorite.hidden = !(mediaType === 'gif' && !fromFavorite);
  if (mediaType === 'gif') {
    postsController.wireGifFavoriteButton(feedSaveGifFavorite, url, url);
  }
}

feedAttachButton.addEventListener('click', () => feedAttachInput.click());

feedAttachInput.addEventListener('change', async () => {
  const file = feedAttachInput.files[0];
  if (!file) return;

  feedComposerMedia.hidden = false;
  feedComposerMediaStatus.textContent = 'Uploading...';
  feedUploadProgress.hidden = false;
  feedUploadProgressBar.style.width = '0%';

  const { url, mediaType, error } = await postsController.uploadPostMedia(file, (percent) => {
    feedUploadProgressBar.style.width = `${percent}%`;
  });

  feedUploadProgress.hidden = true;

  if (error) {
    feedComposerMediaStatus.textContent = error.message;
    feedComposerMedia.hidden = true;
    feedAttachInput.value = '';
    return;
  }

  feedComposerMediaStatus.textContent = '';
  showComposerMedia(url, mediaType);
});

feedComposerMediaRemove.addEventListener('click', resetComposerMedia);

function closeFeedGifPicker() {
  feedGifPicker.hidden = true;
}

feedGifButton.addEventListener('click', async () => {
  const willOpen = feedGifPicker.hidden;
  closeFeedGifPicker();
  if (!willOpen) return;

  feedGifPicker.hidden = false;

  const favorites = await postsController.fetchFavoriteGifs();
  feedGifPickerGrid.querySelectorAll('.dm-gif-thumb').forEach((el) => el.remove());
  feedGifPickerEmpty.hidden = favorites.length > 0;

  favorites.forEach((fav) => {
    const img = document.createElement('img');
    img.className = 'dm-gif-thumb';
    img.src = fav.url;
    img.alt = 'Favorite GIF';
    img.addEventListener('click', () => {
      closeFeedGifPicker();
      showComposerMedia(fav.url, 'gif', { fromFavorite: true });
    });
    feedGifPickerGrid.appendChild(img);
  });
});

document.querySelectorAll('[data-close-picker]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.closePicker).hidden = true;
  });
});

document.addEventListener('click', (event) => {
  if (!feedGifPicker.contains(event.target) && !feedGifButton.contains(event.target)) {
    feedGifPicker.hidden = true;
  }
});

feedFab.addEventListener('click', () => {
  feedComposer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  feedComposerInput.focus();
});

feedNsfwToggle.addEventListener('click', () => {
  const nowActive = feedNsfwToggle.getAttribute('aria-pressed') !== 'true';
  feedNsfwToggle.setAttribute('aria-pressed', String(nowActive));
});

feedPostButton.addEventListener('click', async () => {
  feedComposerError.textContent = '';
  const content = feedComposerInput.value.trim();

  if (!content) {
    feedComposerError.textContent = 'Write something before posting.';
    return;
  }

  feedPostButton.disabled = true;

  const { data: newPost, error } = await postsController.createPost({
    content,
    visibility: feedVisibilitySelect.value,
    replyPermission: feedReplySelect.value,
    mediaUrl: pendingMediaUrl,
    mediaType: pendingMediaType,
    isNsfw: feedNsfwToggle.getAttribute('aria-pressed') === 'true',
  });

  feedPostButton.disabled = false;

  if (error) {
    feedComposerError.textContent = `Error: ${error.message}`;
    return;
  }

  feedComposerInput.value = '';
  feedCharCount.textContent = '0 / 500';
  feedVisibilitySelect.value = 'everyone';
  feedReplySelect.value = 'everyone';
  feedNsfwToggle.setAttribute('aria-pressed', 'false');
  resetComposerMedia();

  feedPosts.unshift(newPost);
  feedEmpty.hidden = true;
  const card = await buildAndAppendPost(newPost);
  feedList.prepend(card);
  feedRenderedCount += 1;
});

async function buildAndAppendPost(post) {
  const authorMap = await postsController.fetchProfilesById([post.author_id]);
  const state = await postsController.fetchInteractionState([post.id]);
  return postsController.buildCard(post, authorMap.get(post.author_id), state, {
    onDeleted: (postId) => {
      feedPosts = feedPosts.filter((p) => p.id !== postId);
    },
  });
}

async function loadFeed() {
  const { data: posts, error } = await client
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .is('parent_post_id', null)
    .order('created_at', { ascending: false })
    .limit(FEED_FETCH_LIMIT);

  if (error) {
    feedList.innerHTML = `<p class="hub-form-error">Failed to load feed: ${error.message}</p>`;
    return;
  }

  feedPosts = rankPosts(posts || []);
  feedRenderedCount = 0;
  feedList.innerHTML = '';
  feedEmpty.hidden = feedPosts.length > 0;
  await renderNextBatch();
}

async function renderNextBatch() {
  const batch = feedPosts.slice(feedRenderedCount, feedRenderedCount + FEED_PAGE_SIZE);
  if (batch.length === 0) {
    feedLoadMore.hidden = true;
    return;
  }

  await postsController.renderPostList(batch, feedList, {
    onDeleted: (postId) => {
      feedPosts = feedPosts.filter((p) => p.id !== postId);
    },
  });

  feedRenderedCount += batch.length;
  feedLoadMore.hidden = feedRenderedCount >= feedPosts.length;
}

feedLoadMore.addEventListener('click', renderNextBatch);

async function init() {
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    window.location.href = '/social/index.html';
    return;
  }

  const { error: userError } = await client.auth.getUser();
  if (userError) {
    await client.auth.signOut();
    window.location.href = '/social/index.html';
    return;
  }

  currentSession = session;
  postsController = createPostsController(client, session.user.id, SUPABASE_URL, SUPABASE_ANON_KEY);
  feedComposerAvatarLink.href = `/social/profiles/${session.user.id}/`;

  const { data: profile } = await client
    .from('profiles')
    .select('avatar_url')
    .eq('id', session.user.id)
    .single();

  if (profile && profile.avatar_url) {
    feedComposerAvatar.src = profile.avatar_url;
    feedComposerAvatar.hidden = false;
  } else {
    feedComposerAvatarPlaceholder.hidden = false;
  }

  pageLoading.hidden = true;
  feedView.hidden = false;
  feedFab.hidden = false;

  await loadFeed();
}

init();
