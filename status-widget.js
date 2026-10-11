(function () {
  const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';
  const BAR_COUNT = 40;

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const services = ['facturehub', 'facturecommunity'];

  async function loadService(service) {
    const dot = document.getElementById(`statusDot-${service}`);
    const state = document.getElementById(`statusState-${service}`);
    const bars = document.getElementById(`statusBars-${service}`);
    if (!dot || !state || !bars) return;

    const { data, error } = await client
      .from('uptime_checks')
      .select('is_up, checked_at')
      .eq('service', service)
      .order('checked_at', { ascending: false })
      .limit(BAR_COUNT);

    if (error || !data || data.length === 0) {
      dot.className = 'status-dot status-dot--unknown';
      state.textContent = 'No data yet';
      bars.innerHTML = '';
      for (let i = 0; i < BAR_COUNT; i++) {
        bars.appendChild(makeBar('unknown'));
      }
      return;
    }

    const chronological = [...data].reverse();
    const latest = data[0];

    dot.className = `status-dot status-dot--${latest.is_up ? 'up' : 'down'}`;
    state.textContent = latest.is_up ? 'Operational' : 'Down';

    bars.innerHTML = '';
    const padding = BAR_COUNT - chronological.length;
    for (let i = 0; i < padding; i++) {
      bars.appendChild(makeBar('unknown'));
    }
    chronological.forEach((row) => {
      bars.appendChild(makeBar(row.is_up ? 'up' : 'down'));
    });
  }

  function makeBar(state) {
    const bar = document.createElement('span');
    bar.className = `status-bar status-bar--${state}`;
    return bar;
  }

  services.forEach(loadService);
  setInterval(() => services.forEach(loadService), 60 * 1000);
})();
