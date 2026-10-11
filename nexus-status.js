(function () {
  const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';
  // The bot heartbeats roughly once a minute; two minutes of silence means
  // it's genuinely down, not just between beats.
  const STALE_AFTER_MS = 2 * 60 * 1000;
  const POLL_INTERVAL_MS = 30 * 1000;

  const dot = document.getElementById('nexusStatusDot');
  const text = document.getElementById('nexusStatusText');
  if (!dot || !text) return;

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function setStatus(state, label) {
    dot.className = `nexus-status-dot nexus-status-dot--${state}`;
    text.textContent = label;
  }

  async function checkStatus() {
    const { data, error } = await client
      .from('bot_status')
      .select('last_heartbeat')
      .eq('id', 'nexus')
      .single();

    if (error || !data) {
      setStatus('offline', 'Offline');
      return;
    }

    const age = Date.now() - new Date(data.last_heartbeat).getTime();
    setStatus(age < STALE_AFTER_MS ? 'online' : 'offline', age < STALE_AFTER_MS ? 'Online' : 'Offline');
  }

  checkStatus();
  setInterval(checkStatus, POLL_INTERVAL_MS);
})();
