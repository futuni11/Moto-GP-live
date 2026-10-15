// MotoGP live widgets server. No dependencies. Node 18+.
// Pulls from the unofficial MotoGP website API (may change without notice).
const http = require('http'), fs = require('fs'), path = require('path');
const BASES = ['https://api.motogp.pulselive.com/motogp/v1', 'https://api.pulselive.com/motogp/v1'];
let goodBase = null;
const HEAD = { Origin: 'https://www.motogp.com', Referer: 'https://www.motogp.com/', 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
const TTL = 5 * 60 * 1000;             // refresh at most every 5 minutes
const FAV = process.env.FAV_RIDER || 'Marquez';
let cache = { t: 0, data: null, error: null };

async function j(u) {
  const errs = [];
  for (const base of goodBase ? [goodBase] : BASES) {
    try {
      const r = await fetch(base + u, { headers: HEAD, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { errs.push(base + u + ' -> HTTP ' + r.status); continue; }
      goodBase = base;
      return await r.json();
    } catch (e) {
      errs.push(base + u + ' -> ' + (e.cause && (e.cause.code || e.cause.message) || e.message));
    }
  }
  goodBase = null;
  throw new Error(errs.join(' | '));
}
const label = s => {
  const t = (s.type || s.name || '').toString().toUpperCase();
  if (/SPR/.test(t)) return 'Sprint';
  if (/RAC/.test(t)) return 'Race';
  if (/^Q|QUAL/.test(t)) return 'Qualifying';
  if (/FP|PR|PRACTICE/.test(t)) return 'Practice ' + (s.number || '');
  return s.name || t;
};

async function build() {
  const year = new Date().getFullYear();
  const seasons = await j('/results/seasons');
  const season = seasons.find(s => s.year === year) || seasons[0];
  const cats = await j('/results/categories?seasonUuid=' + season.id);
  const cat = cats.find(c => /^MotoGP/i.test(c.name)) || cats[0];
  const st = await j(`/results/standings?seasonUuid=${season.id}&categoryUuid=${cat.id}`);
  const riders = (st.classification || []).map(c => ({
    pos: c.position, name: c.rider && c.rider.full_name, number: c.rider && c.rider.number,
    team: c.team && c.team.name, points: c.points,
    wins: c.race_wins ?? c.wins ?? null, podiums: c.podiums ?? null, poles: c.pole_positions ?? c.poles ?? null
  }));
  const events = await j('/events?seasonYear=' + year);
  const today = new Date().toISOString().slice(0, 10);
  const next = events.filter(e => (e.date_end || '').slice(0, 10) >= today && !/test/i.test(e.name || ''))
    .sort((a, b) => a.date_start.localeCompare(b.date_start))[0];
  let schedule = null;
  if (next) {
    const ses = await j(`/results/sessions?eventUuid=${next.id}&categoryUuid=${cat.id}`);
    schedule = {
      name: next.name, short: next.short_name || next.name, circuit: next.circuit && next.circuit.name,
      start: next.date_start, end: next.date_end,
      sessions: ses.filter(s => s.date).map(s => ({ name: label(s), start: s.date })).sort((a, b) => a.start.localeCompare(b.start))
    };
  }
  return { updated: new Date().toISOString(), favourite: FAV, riders, schedule };
}

async function getData() {
  if (cache.data && Date.now() - cache.t < TTL) return cache;
  try { cache = { t: Date.now(), data: await build(), error: null }; }
  catch (e) { cache = { t: cache.t, data: cache.data, error: String(e.message || e) }; console.error('fetch failed:', cache.error); }
  return cache;
}

const types = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/data') {
    const c = await getData();
    res.writeHead(c.data ? 200 : 502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(c.data ? { ...c.data, stale: !!c.error, error: c.error } : { error: c.error || 'no data' }));
  }
  if (url.pathname === '/api/fav') {   // flat JSON for Android widget apps like KWGT
    const c = await getData();
    if (!c.data) { res.writeHead(502, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: c.error })); }
    const q = (url.searchParams.get('rider') || FAV).toLowerCase();
    const r = c.data.riders.find(x => (x.name || '').toLowerCase().includes(q)) || c.data.riders[0];
    const sc = c.data.schedule, race = sc && sc.sessions[sc.sessions.length - 1];
    const flat = {};
    ((sc && sc.sessions) || []).slice(0, 8).forEach((x, i) => { flat['s' + i + 'name'] = x.name; flat['s' + i + 'time'] = new Date(x.start).toUTCString().slice(0, 22).replace(' GMT', ''); flat['s' + i + 'iso'] = x.start; });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ...flat, name: r.name, pos: r.pos, points: r.points, wins: r.wins ?? '-', podiums: r.podiums ?? '-', poles: r.poles ?? '-',
      raceName: sc ? sc.name : '', raceTime: race ? race.start : '', updated: c.data.updated }));
  }
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!['index.html', 'manifest.json'].includes(name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, name), (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'text/plain' }); res.end(buf);
  });
}).listen(process.env.PORT || 3000, () => console.log('Running on port ' + (process.env.PORT || 3000)));
