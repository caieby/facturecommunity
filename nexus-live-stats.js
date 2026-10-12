(function () {
  const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';
  const POLL_INTERVAL_MS = 30 * 1000;

  const serverCountEl = document.getElementById('nexusServerCount');
  const recordCountEl = document.getElementById('nexusRecordCount');
  if (!serverCountEl || !recordCountEl) return;

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function formatCount(value) {
    if (value === null || value === undefined) return '—';
    return Number(value).toLocaleString();
  }

  async function loadStats() {
    const { data, error } = await client
      .from('bot_status')
      .select('server_count, record_count')
      .eq('id', 'nexus')
      .single();

    if (error || !data) return;

    serverCountEl.textContent = formatCount(data.server_count);
    recordCountEl.textContent = formatCount(data.record_count);
  }

  loadStats();
  setInterval(loadStats, POLL_INTERVAL_MS);
})();
