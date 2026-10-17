const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let postsController = null;

const pageLoading = document.getElementById('pageLoading');
const searchView = document.getElementById('searchView');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');

const trendingSection = document.getElementById('trendingSection');
const trendingList = document.getElementById('trendingList');
const trendingEmpty = document.getElementById('trendingEmpty');

const resultsSection = document.getElementById('resultsSection');
const peopleList = document.getElementById('peopleList');
const peopleEmpty = document.getElementById('peopleEmpty');
const tagsList = document.getElementById('tagsList');
const tagsEmpty = document.getElementById('tagsEmpty');
const postsList = document.getElementById('postsList');
const postsEmpty = document.getElementById('postsEmpty');

function tagPill(tag, suffix) {
  const pill = document.createElement('a');
  pill.className = 'search-tag-pill';
  pill.href = `/social/search.html?tag=${encodeURIComponent(tag)}`;
  pill.textContent = `#${tag}${suffix ? ` ${suffix}` : ''}`;
  return pill;
}

async function loadTrending() {
  const { data: tags, error } = await client
    .from('trending_tags')
    .select('tag, uses')
    .limit(15);

  trendingList.innerHTML = '';

  if (error || !tags || tags.length === 0) {
    trendingEmpty.hidden = false;
    return;
  }

  trendingEmpty.hidden = true;
  tags.forEach((row) => {
    trendingList.appendChild(tagPill(row.tag, `· ${row.uses}`));
  });
}

async function searchPeople(query) {
  const { data: people } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .is('terminated_at', null)
    .is('deletion_requested_at', null)
    .limit(20);

  peopleList.innerHTML = '';

  if (!people || people.length === 0) {
    peopleEmpty.hidden = false;
    return;
  }

  peopleEmpty.hidden = true;
  people.forEach((person) => {
    const avatarHtml = person.avatar_url
      ? `<img class="notif-avatar" src="${person.avatar_url}" alt="">`
      : '<div class="notif-avatar notif-avatar--placeholder"></div>';

    const row = document.createElement('a');
    row.className = 'search-person-row';
    row.href = `/social/profiles/${person.id}/`;
    row.innerHTML = `
      ${avatarHtml}
      <span class="search-person-names">
        <span class="search-person-display">${escapePostText(person.display_name || person.username)}${buildBadgesHtml(person)}</span>
        <span class="search-person-username">@${escapePostText(person.username)}</span>
      </span>
    `;
    peopleList.appendChild(row);
  });
}

async function searchTags(query) {
  const { data: rows } = await client
    .from('post_hashtags')
    .select('tag')
    .ilike('tag', `%${query}%`)
    .limit(100);

  tagsList.innerHTML = '';

  const uniqueTags = [...new Set((rows || []).map((r) => r.tag))].slice(0, 20);

  if (uniqueTags.length === 0) {
    tagsEmpty.hidden = false;
    return;
  }

  tagsEmpty.hidden = true;
  uniqueTags.forEach((tag) => {
    tagsList.appendChild(tagPill(tag));
  });
}

async function searchPosts(query) {
  const { data: posts } = await client
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .ilike('content', `%${query}%`)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  postsList.innerHTML = '';

  if (!posts || posts.length === 0) {
    postsEmpty.hidden = false;
    return;
  }

  postsEmpty.hidden = true;
  await postsController.renderPostList(posts, postsList, {});
}

async function searchByTag(tag) {
  peopleList.innerHTML = '';
  peopleEmpty.hidden = false;

  tagsList.innerHTML = '';
  tagsList.appendChild(tagPill(tag));
  tagsEmpty.hidden = true;

  const { data: tagRows } = await client
    .from('post_hashtags')
    .select('post_id')
    .eq('tag', tag.toLowerCase())
    .limit(50);

  const postIds = [...new Set((tagRows || []).map((r) => r.post_id))];
  postsList.innerHTML = '';

  if (postIds.length === 0) {
    postsEmpty.hidden = false;
    return;
  }

  const { data: posts } = await client
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .in('id', postIds)
    .is('removed_at', null)
    .order('created_at', { ascending: false });

  if (!posts || posts.length === 0) {
    postsEmpty.hidden = false;
    return;
  }

  postsEmpty.hidden = true;
  await postsController.renderPostList(posts, postsList, {});
}

let searchDebounce = null;

function runSearch(rawQuery) {
  const query = rawQuery.trim();

  if (!query) {
    resultsSection.hidden = true;
    trendingSection.hidden = false;
    return;
  }

  trendingSection.hidden = true;
  resultsSection.hidden = false;

  if (query.startsWith('#') && query.length > 1) {
    searchByTag(query.slice(1));
    return;
  }

  searchPeople(query);
  searchTags(query);
  searchPosts(query);
}

searchForm.addEventListener('submit', (event) => event.preventDefault());

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(searchInput.value), 300);
});

async function init() {
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    window.location.href = '/social/index.html';
    return;
  }

  const { data: profile } = await client
    .from('profiles')
    .select('role, auto_unblur_nsfw, confirmed_adult_content')
    .eq('id', session.user.id)
    .single();

  const viewerNsfwPrefs = {
    autoUnblurNsfw: !!(profile && profile.auto_unblur_nsfw),
    adultConfirmCache: { confirmed: !!(profile && profile.confirmed_adult_content) },
  };

  postsController = createPostsController(client, session.user.id, SUPABASE_URL, SUPABASE_ANON_KEY, profile && profile.role, viewerNsfwPrefs);

  pageLoading.hidden = true;
  searchView.hidden = false;

  await loadTrending();

  const tagParam = new URLSearchParams(window.location.search).get('tag');
  if (tagParam) {
    searchInput.value = `#${tagParam}`;
    runSearch(searchInput.value);
  }
}

init();
