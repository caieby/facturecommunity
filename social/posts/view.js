const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const pageLoading = document.getElementById('pageLoading');
const postView = document.getElementById('postView');
const postContainer = document.getElementById('postContainer');
const postNotFound = document.getElementById('postNotFound');

function getPostIdFromUrl() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const postsIndex = segments.indexOf('posts');
  return postsIndex !== -1 ? segments[postsIndex + 1] : null;
}

async function init() {
  const postId = getPostIdFromUrl();

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

  const currentUserId = session.user.id;

  if (!postId) {
    pageLoading.hidden = true;
    postNotFound.hidden = false;
    return;
  }

  const { data: post, error } = await client
    .from('posts')
    .select(POST_SELECT_COLUMNS)
    .eq('id', postId)
    .single();

  pageLoading.hidden = true;

  if (error || !post) {
    postNotFound.hidden = false;
    return;
  }

  const postsController = createPostsController(client, currentUserId, SUPABASE_URL, SUPABASE_ANON_KEY);

  const authorMap = await postsController.fetchProfilesById([post.author_id]);
  const state = await postsController.fetchInteractionState([post.id]);

  const card = postsController.buildCard(post, authorMap.get(post.author_id), state, {
    detailView: true,
    onDeleted: () => {
      window.location.href = '/social/feed.html';
    },
  });

  postContainer.appendChild(card);
  postView.hidden = false;
}

init();
