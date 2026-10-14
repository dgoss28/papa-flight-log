const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WWII_CHAPTERS = new Set(['minneapolis', 'pensacola', 'miami', 'vmsb474', 'solomons', 'luzon', 'mindanao', 'home1945']);
const COMBAT = new Set(['strike', 'spotting', 'tao', 'photo']);
const SOLID = new Set(['confirmed', 'likely']);
const TYPE_LABEL = { strike: 'Strike', spotting: 'Artillery spotting', tao: 'Air strike control', photo: 'Photo mission',
  route: 'Cross-country', local: 'Local flight', utility: 'Utility flight' };
const SPEEDS = [1, 4, 16];

// What his shorthand in the remarks column means. First match wins; remarks that are
// already plain English, place names and routes are left alone.
const GLOSSARY = [
  [/incomplete/i, 'A strike that didn\'t drop its bombs: the target was clouded over, couldn\'t be found, or the flight was recalled. He kept these in a separate tally from completed strikes.'],
  [/^strike\b/i, 'Combat dive-bombing strike: the squadron dove on the target named here, usually enemy positions supporting the ground troops.'],
  [/^patrol/i, 'Armed patrol over the area, looking for enemy boats, troops or other targets of opportunity.'],
  [/\bfam/i, 'Familiarization flight: getting to know a new aircraft, airfield or area before flying it for real.'],
  [/glide bomb/i, 'Glide-bombing practice: a shallower bombing run than a full dive.'],
  [/dive bomb/i, 'Dive-bombing practice, the Dauntless\'s specialty: rolling into a near-vertical dive of about 70°, releasing the bomb low and pulling out hard.'],
  [/dive tact/i, 'Dive-bombing tactics: practicing coordinated dive attacks with the rest of the flight.'],
  [/strafing/i, 'Strafing practice: firing the forward guns at targets on the ground.'],
  [/rockets/i, 'Rocket and gunnery practice against targets on a range.'],
  [/^gunnery/i, 'Aerial gunnery practice, typically shooting at a cloth sleeve towed behind another plane.'],
  [/^b\. ?& ?r/i, 'Probably "bombing and rockets": weapons practice on a target range.'],
  [/\bdiv(ision)?\.? ?tac/i, 'Division tactics: maneuvering and attacking as a division, a formation of two or more two-plane sections.'],
  [/\bsec(t|tion)?\.? ?tac/i, 'Section tactics: flying and fighting as a two-plane section, a leader and his wingman.'],
  [/sqdn\.? ?tac/i, 'Squadron tactics: the whole squadron practicing attacks together.'],
  [/battle prob/i, 'Battle problem: a full-scale mock combat exercise against a simulated enemy.'],
  [/parade/i, 'Formation flyover for a parade or review.'],
  [/oxygen/i, 'Oxygen hop: a high-altitude flight to practice breathing from the oxygen mask.'],
  [/engine time/i, 'Engine time: flying to put hours on an engine, usually breaking in a newly installed or overhauled one.'],
  [/radar & zb/i, 'Testing the radar and the ZB receiver, the homing set that picked up a carrier\'s or airfield\'s beacon to find the way back.'],
  [/^navigation/i, 'Navigation training: finding the way between checkpoints with chart, compass and clock.'],
  [/ni(gh)?te? flying/i, 'Night flying practice.'],
  [/instrument/i, 'Instrument flying: flying by the gauges alone, often under a hood with a safety pilot watching.'],
  [/link trainer/i, 'The Link Trainer was a ground flight simulator used to practice instrument flying.'],
  [/^a\/s\b/i, 'Artillery spotting: circling over enemy positions in a light observation plane and radioing corrections to Marine artillery until the shells landed on target.'],
  [/^recon/i, 'Reconnaissance over the right and left sectors of the Marine line, watching for enemy movement and positions.'],
  [/\bTAO\b/, 'Tactical air observer: from a light plane over the front, he found targets and directed fighter-bomber strikes onto them.'],
  [/photo mission/i, 'Photo mission: photographing enemy positions for intelligence.'],
  [/taxi/i, 'Air taxi: flying a passenger, often an officer or courier, between airstrips.'],
  [/mail/i, 'Mail run between the squadron\'s airstrips.'],
  [/ferry/i, 'Ferry flight: delivering an aircraft to another field.'],
  [/^test\b/i, 'Test flight, checking out an aircraft after maintenance.'],
  [/^([A-DFIV])[-.] ?(\d|I+)$/i, (f, _, stage, n) => `Numbered syllabus flight (stage ${stage.toUpperCase()}, no. ${/^\d$/.test(n) ? n : n.length}) ${f.date < '1951-12'
    ? 'in his summer 1951 refresher training, getting current again after six years out of the cockpit.'
    : 'in the twin-engine SNB-5 course he flew at Cherry Point in the winter of 1951–52.'}`],
  [/^solo$/i, 'Solo: alone in the aircraft, with no instructor aboard.'],
  [/^aero/i, 'Aerobatics: loops, rolls and spins to build confidence handling the plane.'],
  [/slow flight/i, 'Slow flight: handling the plane just above stalling speed, as on a landing approach.'],
  [/gca/i, 'GCA (ground-controlled approach): a radar operator on the ground talks the pilot down to the runway by voice, the way to land in bad weather.'],
  [/^(hunter|killer)$/i, 'Probably hunter-killer practice: antisubmarine teamwork in which a radar plane (the hunter) finds the submarine and an attack plane (the killer) goes after it.'],
  [/carrier qual/i, 'Carrier qualification: the arrested landings aboard USS Bennington that qualified him to fly from a carrier.'],
  [/radar checkout/i, 'Checking out the AD-4W\'s search radar, carried in the big radome under the belly.'],
  [/^passenger$/i, 'He rode as a passenger, not the pilot.'],
  [/^local$/i, 'Local flight around the home field.'],
];
const FCL = 'Field carrier landing practice: touch-and-go landings on a runway marked out like a carrier deck, following a landing signal officer\'s paddle signals.';

function explain(f) {
  const r = (f.remarks || '').replace(/\?$/, '').trim();
  for (const [re, text] of GLOSSARY) {
    const m = r.match(re);
    if (m) return typeof text === 'function' ? text(f, ...m) : text;
  }
  return /FCL/.test(`${f.code} ${f.notes}`) ? FCL : '';
}

const $ = (s, el = document) => el.querySelector(s);
const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

let J, map, popup;
const state = { min: 0, max: -1, era: 'wwii', anim: null, chapter: null, playing: false, speed: 0, flight: null, fly: null };

Promise.all(['data/journey.json', 'data/events.json', 'data/aircraft-photos.json'].map(u => fetch(u).then(r => (r.ok ? r.json() : {}))))
  .then(([journey, events, photos]) => { J = journey; J.events = events; J.photos = photos; init(); });

function init() {
  J.flights.forEach(f => { f.combat = COMBAT.has(f.type); f.gloss = explain(f); });
  J.byChapter = {};
  J.flights.forEach(f => (J.byChapter[f.chapter] ??= []).push(f));
  renderChapters();
  renderPhotoCredits();
  renderTotals();
  initMap();
  initTimeline();
  initSheet();
}

/* ---------- Logbook panel ---------- */
function renderChapters() {
  const root = $('#chapters');
  for (const c of J.chapters) {
    const fl = J.byChapter[c.id] || [];
    const hours = fl.reduce((s, f) => s + f.logged, 0);
    const combat = fl.filter(f => f.combat).length;
    const sec = document.createElement('section');
    sec.className = 'chapter';
    sec.dataset.id = c.id;
    const sq = J.squadrons?.[c.squadron];
    sec.innerHTML = `
      ${sq?.insignia ? `<img class="patch" src="${esc(sq.insignia)}" alt="${esc(c.squadron)} squadron insignia: ${esc(sq.alt)}">` : ''}
      <h2><button type="button" class="chapter-title" data-id="${esc(c.id)}">${esc(c.title)}</button></h2>
      <p class="when">${esc(c.subtitle)}</p>
      ${c.rank ? `<p class="rank">${esc(c.rank)} <span>(${esc(c.rank_basis)})</span></p>` : ''}
      ${sq ? `<p class="unit">${esc(sq.name)} (${esc(c.squadron)})${sq.nickname ? `, “${esc(sq.nickname)}”` : ''}</p>` : ''}
      <p class="story">${esc(c.text)}</p>
      ${fl.length ? `<p class="summary">${fl.length} ${fl.length === 1 ? 'entry' : 'flights'}, ${hours.toFixed(1)} hours${combat ? `, ${combat} combat missions` : ''}</p>
      <table class="entries">
        <thead><tr><th>Date</th><th>Aircraft</th><th>Hrs</th><th>Remarks</th></tr></thead>
        <tbody>${fl.map(f => `
          <tr class="flight${f.combat ? ' combat' : ''}" tabindex="0" data-id="${f.id}">
            <td class="date">${f.date_from ? `${esc(f.date_from.slice(5).replace('-', '/'))}–<br>` : ''}${esc(f.date.slice(5).replace('-', '/'))}</td>
            <td class="ac">${esc(f.aircraft)}</td>
            <td class="hrs">${f.hours.toFixed(1)}</td>
            <td class="rem${f.gloss && f.remarks ? ' glossed' : ''}"${f.gloss ? ` title="${esc(f.gloss)}"` : ''}>${esc(f.remarks) || '<span class="q">local</span>'}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<p class="summary">Logged as a single summary page, not flight by flight.</p>'}`;
    root.append(sec);
  }
  root.addEventListener('click', e => {
    const title = e.target.closest('.chapter-title');
    if (title) {
      stopPlay();
      panelScroll(title.closest('.chapter'), 'start', !REDUCED);
      activateChapter(title.dataset.id);
      return;
    }
    const row = e.target.closest('tr.flight');
    if (row) { stopPlay(); selectFlight(+row.dataset.id); }
  });
  root.addEventListener('keydown', e => {
    const row = e.target.closest('tr.flight');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); stopPlay(); selectFlight(+row.dataset.id); }
  });
}

function renderTotals() {
  const t = J.stats.totals, n = x => x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const c = t.combat;
  const rows = [
    ['Hours logged', `${n(t.hours)}`, `${n(t.hours_wwii)} in 1943–45, ${n(t.hours_korea)} in 1951–53`],
    ['Logbook entries', `${t.entries}`, `${t.entries_wwii} in the WWII book, ${t.entries_korea} in the Korea-era book`],
    ['Combat missions', `${t.combat_total}`, `${c.strike || 0} dive-bombing strikes (he counted 31 completed, 6 incomplete), ${c.spotting || 0} artillery spotting, ${c.tao || 0} air strike control, ${c.photo || 0} photo`],
    ['Aircraft types', `${t.types.length}`, t.types.map(x => x.family).join(', ')],
    ['Individual aircraft', `${t.airframes}`, 'distinct bureau numbers'],
    ['Instrument', n(t.instrument), 'hours'],
    ['Night', n(t.night), 'hours'],
    ['Carrier landings', `${t.carrier_landings}`, 'USS Bennington, 13 April 1953'],
    ['Dual received', n(t.dual_received), `hours with an instructor: 34.2 in primary, the rest on ${t.dual_received_flights} flights at Pensacola and Miami`],
    ['Dual given', '–', 'none recorded'],
    ['Places', `${t.places}`, 'airfields, ships and targets on the map'],
  ];
  $('#totals-section').innerHTML = `
    <h2 id="totals-h">Totals</h2>
    <p>Added up from the transcribed entries. His own logbook closes at 1,027.3 hours; most of the difference is
      the two 1944 pages missing from the scans.</p>
    <table class="totals">
      <tbody>${rows.map(([k, v, d]) => `<tr><th scope="row">${esc(k)}</th><td class="num">${esc(v)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody>
    </table>
    <h3>By aircraft</h3>
    <table class="totals by-type">
      <thead><tr><th>Aircraft</th><th class="num">Hrs</th><th class="num">Flights</th><th class="num">Airframes</th></tr></thead>
      <tbody>${t.types.map(x => `<tr>
        <th scope="row">${esc(x.name)}<small>${esc(x.variants.join(', '))}${x.most_flown_n >= 3 ? `. Most flown: no. ${esc(x.most_flown)}, ${x.most_flown_n} times` : ''}</small></th>
        <td class="num">${n(x.hours)}</td><td class="num">${x.entries}</td><td class="num">${x.airframes}</td></tr>`).join('')}</tbody>
    </table>`;
}

function renderPhotoCredits() {
  const seen = new Set();
  const items = Object.values(J.photos || {}).filter(p => !seen.has(p.src) && seen.add(p.src))
    .map(p => `<li>${esc(p.caption.replace(/^photographed/, 'Skyraider 126935, photographed'))}. <a href="${esc(p.page)}">${esc(p.credit)}</a>, via Wikimedia Commons.</li>`);
  for (const [id, sq] of Object.entries(J.squadrons || {}).filter(([, sq]) => sq.insignia)) {
    items.push(`<li>${esc(id)}${sq.nickname ? ` "${esc(sq.nickname)}"` : ''} insignia. <a href="${esc(sq.page)}">${esc(sq.credit)}</a>.</li>`);
  }
  $('#photo-credits').insertAdjacentHTML('beforeend', items.join(''));
}

function watchChapters() {
  const io = new IntersectionObserver(entries => {
    // On small screens an open flight card covers the logbook, so the log isn't what the reader is looking at
    if (state.playing || autoScrolling() || (mobile() && !$('#card').hidden)) return;
    const hit = entries.filter(e => e.isIntersecting).map(e => e.target.dataset.id)[0];
    if (hit && hit !== state.chapter) activateChapter(hit);
  }, { root: $('#log'), rootMargin: '-30% 0px -65% 0px' });
  document.querySelectorAll('.chapter').forEach(s => io.observe(s));
}

function markChapter(id) {
  document.querySelectorAll('.chapter').forEach(s => s.classList.toggle('active', s.dataset.id === id));
  const c = J.chapters.find(x => x.id === id);
  if (c) { $('#sheet-title').textContent = c.title; $('#sheet-sub').textContent = c.subtitle; }
}

/* ---------- Bottom sheet (small screens) ---------- */
const mobile = () => innerWidth <= 760;

function sheetSnaps() {
  const full = $('#sheet').offsetHeight;
  return { peek: $('#sheet-head').offsetHeight, half: Math.round((innerHeight - $('#timeline').offsetHeight) * 0.5), full };
}

// How much of the sheet is showing, so the map can frame flights in the part left visible
function sheetVisible() {
  return mobile() ? sheetSnaps()[state.sheet] : 0;
}

function setSheet(snap) {
  state.sheet = snap;
  const s = sheetSnaps();
  $('#sheet').style.setProperty('--sheet-y', `${s.full - s[snap]}px`);
}

function initSheet() {
  const sheet = $('#sheet'), head = $('#sheet-head');
  setSheet('half');
  addEventListener('resize', () => setSheet(state.sheet));
  const toggle = () => setSheet(state.sheet === 'full' ? 'half' : 'full');
  head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (!mobile()) return;
    const s = sheetSnaps();
    drag = { y0: e.clientY, t0: e.timeStamp, start: s.full - s[state.sheet], last: e.clientY, lastT: e.timeStamp, v: 0, s };
    head.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return;
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = (e.clientY - drag.last) / dt;
    drag.last = e.clientY; drag.lastT = e.timeStamp;
    const y = Math.min(drag.s.full - drag.s.peek, Math.max(0, drag.start + e.clientY - drag.y0));
    sheet.style.setProperty('--sheet-y', `${y}px`);
  });
  const end = e => {
    if (!drag) return;
    sheet.classList.remove('dragging');
    const moved = e.clientY - drag.y0, s = drag.s;
    if (Math.abs(moved) < 6) { drag = null; return toggle(); }
    // Snap to whichever stop the flick would carry it nearest to
    const aim = drag.start + moved + drag.v * 180;
    const snap = ['peek', 'half', 'full'].reduce((a, b) => (Math.abs(s.full - s[b] - aim) < Math.abs(s.full - s[a] - aim) ? b : a));
    drag = null;
    setSheet(snap);
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

// Make sure the map is showing before moving it to something the reader asked for
function revealMap(snap = 'half') {
  if (!mobile()) return;
  if (snap === 'peek' || state.sheet === 'full') setSheet(snap);
}

/* ---------- Map ---------- */
function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    attributionControl: { compact: true },
    center: [-30, 25], zoom: 1.6, minZoom: 1.2, maxZoom: 13,
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        relief: {
          type: 'raster', tileSize: 256, maxzoom: 13,
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'],
          attribution: 'Relief © Esri · Borders: historical-basemaps · Aircraft photos: Wikimedia Commons',
        },
        b1938: { type: 'geojson', data: 'data/borders-1938.geojson' },
        b1960: { type: 'geojson', data: 'data/borders-1960.geojson' },
        l1938: { type: 'geojson', data: 'data/labels-1938.geojson' },
        l1960: { type: 'geojson', data: 'data/labels-1960.geojson' },
        overlays: { type: 'geojson', data: 'data/overlays.geojson' },
        flights: { type: 'geojson', data: trackLines() },
        places: { type: 'geojson', data: emptyFC() },
        events: { type: 'geojson', data: eventPoints() },
        flown: { type: 'geojson', data: emptyFC() },
        plane: { type: 'geojson', data: emptyFC() },
      },
      layers: [
        { id: 'sea', type: 'background', paint: { 'background-color': '#b9cfcc' } },
        { id: 'relief', type: 'raster', source: 'relief',
          paint: { 'raster-saturation': -0.55, 'raster-contrast': 0.08, 'raster-brightness-min': 0.08 } },
        ...borderLayers('b1938', 'wwii'),
        ...borderLayers('b1960', 'korea'),
        { id: 'front', type: 'line', source: 'overlays', filter: ['==', ['get', 'id'], 'jamestown'],
          layout: { visibility: 'none' },
          paint: { 'line-color': '#23314f', 'line-width': 2.5, 'line-dasharray': [1, 1.2] } },
        { id: 'front-label', type: 'symbol', source: 'overlays', filter: ['==', ['get', 'id'], 'jamestown'],
          layout: { visibility: 'none', 'symbol-placement': 'line', 'text-field': ['get', 'label'],
            'text-font': ['Open Sans Semibold'], 'text-size': 11, 'text-offset': [0, -0.9] },
          paint: { 'text-color': '#23314f', 'text-halo-color': '#efe6cc', 'text-halo-width': 1.5 } },
        { id: 'parallel', type: 'line', source: 'overlays', filter: ['==', ['get', 'id'], '38th'],
          layout: { visibility: 'none' }, minzoom: 5,
          paint: { 'line-color': '#5d5a4c', 'line-width': 1, 'line-dasharray': [4, 3] } },
        ...['flights', 'flights-est'].map(id => ({ id, type: 'line', source: 'flights',
          filter: ['==', ['get', 'solid'], id === 'flights'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['case', ['get', 'combat'], '#b5382a', '#2f6db5'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['get', 'local'], 0.5, 1.2], 10, ['case', ['get', 'local'], 1, 2.2]],
            'line-opacity': ['case', ['get', 'local'], 0.16, 0.6],
            ...(id === 'flights' ? {} : { 'line-dasharray': [2, 2] }),
          } })),
        { id: 'flown-halo', type: 'line', source: 'flown', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#efe6cc', 'line-width': 6, 'line-opacity': 0.8 } },
        { id: 'flown', type: 'line', source: 'flown', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#23314f', 'line-width': 2.6 } },
        { id: 'events', type: 'symbol', source: 'events', layout: { visibility: 'none',
            'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 11,
            'text-anchor': 'left', 'text-justify': 'left', 'text-line-height': 1.15, 'text-offset': [0.9, 0], 'text-optional': true,
            'icon-image': 'event', 'icon-allow-overlap': true },
          paint: { 'text-color': '#5d5a4c', 'text-halo-color': '#efe6cc', 'text-halo-width': 1.5 } },
        { id: 'places', type: 'circle', source: 'places',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 0, 5, 1, 4, 40, 9],
            'circle-color': ['case', ['get', 'solid'], '#23314f', 'rgba(0,0,0,0)'],
            'circle-stroke-color': '#23314f', 'circle-stroke-width': ['case', ['get', 'solid'], 1, 2],
          } },
        { id: 'place-labels', type: 'symbol', source: 'places', minzoom: 4.5,
          layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 11.5,
            'text-anchor': 'top', 'text-offset': [0, 0.8], 'text-optional': true },
          paint: { 'text-color': '#23314f', 'text-halo-color': '#efe6cc', 'text-halo-width': 1.6 } },
        { id: 'plane', type: 'symbol', source: 'plane',
          layout: { 'icon-image': ['get', 'icon'], 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true, 'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 8, 0.7, 12, 0.9] } },
      ],
    },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  popup = new maplibregl.Popup({ maxWidth: '330px', closeOnClick: true });

  map.on('load', () => {
    document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    map.addImage('event', eventIcon());
    for (const fam of Object.keys(AIRCRAFT)) {
      const { image, ratio } = drawAircraft(fam);
      map.addImage(`ac-${fam}`, image, { pixelRatio: ratio });
    }
    setRange(0, -1);
    watchChapters();
  });
  map.on('click', ['flights', 'flights-est'], e => { stopPlay(); selectFlight(e.features[0].properties.id); });
  map.on('click', 'places', e => showPlace(e.features[0].properties.code, e.lngLat));
  map.on('click', 'events', e => {
    const p = e.features[0].properties;
    revealMap('peek');
    popup.setLngLat(e.lngLat).setHTML(`<div class="pop"><h3>${esc(p.title)}</h3>
      <p class="rec">${esc(fmtDate(p.date))}</p><p class="note">${esc(p.text)}${p.approximate ? ' Position approximate.' : ''}</p></div>`).addTo(map);
  });
  for (const l of ['flights', 'flights-est', 'places', 'events']) {
    map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
  }
}

function borderLayers(src, era) {
  const vis = era === 'wwii' ? 'visible' : 'none';
  return [
    { id: `${src}-land`, type: 'fill', source: src, layout: { visibility: vis },
      paint: { 'fill-color': '#e4dab4', 'fill-opacity': 0.55 } },
    { id: `${src}-line`, type: 'line', source: src, layout: { visibility: vis },
      paint: { 'line-color': '#7b6a4f', 'line-width': 0.8, 'line-opacity': 0.8 } },
    { id: `${src}-name`, type: 'symbol', source: src.replace('b', 'l'), maxzoom: 7,
      filter: ['>', ['get', 'area'], 0.05],
      layout: { visibility: vis,
        'text-field': ['get', 'NAME'], 'text-font': ['Open Sans Semibold'], 'text-size': 11,
        'text-transform': 'uppercase', 'text-letter-spacing': 0.15, 'text-max-width': 8,
        'symbol-sort-key': ['-', 0, ['get', 'area']] },
      paint: { 'text-color': '#7b6a4f', 'text-halo-color': '#e4dab4', 'text-halo-width': 1 } },
  ];
}

function setEra(era) {
  if (era === state.era) return;
  state.era = era;
  const show = (ids, on) => ids.forEach(id => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));
  show(['b1938-land', 'b1938-line', 'b1938-name'], era === 'wwii');
  show(['b1960-land', 'b1960-line', 'b1960-name', 'parallel'], era === 'korea');
}

function setChapterLayers(id) {
  setEra(WWII_CHAPTERS.has(id) ? 'wwii' : 'korea');
}

function trackLines() {
  return {
    type: 'FeatureCollection',
    features: J.flights.filter(f => f.track.length > 1).map(f => ({
      type: 'Feature',
      properties: { id: f.id, combat: f.combat, solid: SOLID.has(f.confidence), local: f.coords.length < 2 },
      geometry: { type: 'LineString', coordinates: f.track },
    })),
  };
}

function eventPoints() {
  return { type: 'FeatureCollection', features: J.events.map(e => ({
    type: 'Feature', properties: { ...e, label: `${e.title}\n${fmtDate(e.date)}` },
    geometry: { type: 'Point', coordinates: e.coord } })) };
}

function eventIcon() {
  const s = 18, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.strokeStyle = '#b5382a'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(4, 4); g.lineTo(14, 14); g.moveTo(14, 4); g.lineTo(4, 14); g.stroke();
  return g.getImageData(0, 0, s, s);
}

/* ---------- Range: which flights are drawn ---------- */
function setRange(min, max) {
  state.min = min; state.max = max;
  const inRange = ['all', ['>=', ['get', 'id'], min], ['<=', ['get', 'id'], max]];
  map.setFilter('flights', [...inRange, ['==', ['get', 'solid'], true]]);
  map.setFilter('flights-est', [...inRange, ['==', ['get', 'solid'], false]]);

  // Places stay on the map once he has been there: every place from the first flight up to now,
  // plus the home base of each chapter reached so far
  const counts = {};
  const reached = J.chapters.findIndex(c => c.id === state.chapter);
  J.chapters.slice(0, reached + 1).forEach(c => { if (c.base && J.places[c.base]) counts[c.base] ??= 0; });
  for (let i = 0; i <= max; i++) for (const p of new Set(J.flights[i].places)) counts[p] = (counts[p] || 0) + 1;
  map.getSource('places').setData({ type: 'FeatureCollection', features: Object.entries(counts)
    .filter(([code]) => J.places[code]?.coord)
    .map(([code, count]) => {
      const p = J.places[code];
      return { type: 'Feature', geometry: { type: 'Point', coordinates: p.coord },
        properties: { code, count, solid: SOLID.has(p.confidence), label: shortName(p) } };
    }) });

  const upto = max >= 0 ? J.flights[max].date : '0000';
  const [from, to] = upto < '1946' ? ['1939', '1946'] : ['1950', '1954'];
  map.setLayoutProperty('events', 'visibility', max >= 0 ? 'visible' : 'none');
  map.setFilter('events', ['all', ['<=', ['get', 'date'], upto], ['>=', ['get', 'date'], from], ['<', ['get', 'date'], to]]);
  // The autumn-1952 Marine line only appears once the story reaches the Marines' arrival on the western front
  const front = state.chapter === 'korea' && upto >= '1952-03-25' ? 'visible' : 'none';
  ['front', 'front-label'].forEach(l => map.setLayoutProperty(l, 'visibility', front));

  const done = J.flights.slice(0, max + 1);
  $('#t-hours').textContent = done.reduce((s, f) => s + f.logged, 0).toFixed(1);
  $('#t-flights').textContent = done.length;
  $('#t-combat').textContent = done.filter(f => f.combat).length;
  $('#scrub').value = Math.max(max, 0);
  $('#when').textContent = max >= 0 ? fmtDate(upto) : 'Aug 1943';
}

function shortName(p) {
  if (p.kind === 'airfield' || p.kind === 'ship') return p.name.split(' (')[0];
  return p.name.replace(/ \(.*\)$/, '').replace(/^unresolved.*/, p.code);
}

/* ---------- Chapters (story mode) ---------- */
function activateChapter(id) {
  state.chapter = id;
  state.panelChapter = id;
  markChapter(id);
  const c = J.chapters.find(x => x.id === id);
  const fl = J.byChapter[id] || [];
  setChapterLayers(id);
  frame(c, fl);
  if (!fl.length) return setRange(0, -1);
  animateRange(fl[0].id, fl[fl.length - 1].id);
}

function frame(c, fl) {
  const pts = fl.flatMap(f => f.coords);
  const opts = { duration: REDUCED ? 0 : 2200, essential: false };
  if (pts.length > 1 && c.id !== 'vmsb474') {
    map.fitBounds(bounds(pts), { ...opts, padding: mobile() ? mobilePadding() : 70, maxZoom: Math.max(c.zoom, 6) });
  } else {
    map.flyTo({ ...opts, center: c.center, zoom: c.zoom });
  }
}

function bounds(pts) {
  return pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
}

function animateRange(first, last) {
  cancelAnimationFrame(state.anim);
  if (REDUCED) return setRange(first, last);
  const total = last - first, dur = Math.min(4500, 400 + total * 45), t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    setRange(first, first + Math.round(total * k));
    if (k < 1) state.anim = requestAnimationFrame(step);
  };
  state.anim = requestAnimationFrame(step);
}

/* ---------- Flying a track ---------- */
function measure(track) {
  const d = [0];
  for (let i = 1; i < track.length; i++) {
    const [x1, y1] = track[i - 1], [x2, y2] = track[i];
    const kx = Math.cos((y1 * Math.PI) / 180);
    d.push(d[i - 1] + Math.hypot((x2 - x1) * kx, y2 - y1));
  }
  return d;
}

function bearing([x1, y1], [x2, y2]) {
  const r = Math.PI / 180;
  const y = Math.sin((x2 - x1) * r) * Math.cos(y2 * r);
  const x = Math.cos(y1 * r) * Math.sin(y2 * r) - Math.sin(y1 * r) * Math.cos(y2 * r) * Math.cos((x2 - x1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

function flyFlight(f, { duration, onDone } = {}) {
  cancelAnimationFrame(state.fly);
  const track = f.track;
  const icon = `ac-${aircraftFamily(f.aircraft)}`;
  if (track.length < 2) {
    const at = f.coords[0];
    map.getSource('flown').setData(emptyFC());
    map.getSource('plane').setData(at ? point(at, icon, 0) : emptyFC());
    if (onDone) state.fly = requestAnimationFrame(() => setTimeout(onDone, 150));
    return;
  }
  const dist = measure(track), total = dist[dist.length - 1];
  const dur = REDUCED ? 0 : (duration ?? Math.min(9000, Math.max(3000, f.hours * 2600)));
  const t0 = performance.now();
  let i = 1;
  const step = now => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1;
    const target = k * total;
    while (i < dist.length - 1 && dist[i] < target) i++;
    const seg = dist[i] - dist[i - 1] || 1, u = Math.min(1, Math.max(0, (target - dist[i - 1]) / seg));
    const a = track[i - 1], b = track[i];
    const pos = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    map.getSource('flown').setData({ type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: [...track.slice(0, i), pos] } });
    map.getSource('plane').setData(point(pos, icon, bearing(a, b)));
    if (k < 1) state.fly = requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  state.fly = requestAnimationFrame(step);
}

const point = (c, icon, brg) => ({ type: 'Feature', properties: { icon, bearing: brg }, geometry: { type: 'Point', coordinates: c } });

/* ---------- Timeline (free exploration) ---------- */
function initTimeline() {
  const scrub = $('#scrub');
  scrub.max = J.flights.length - 1;
  scrub.addEventListener('input', () => {
    stopPlay();
    cancelAnimationFrame(state.anim);
    const f = J.flights[+scrub.value];
    showThrough(f.id);
    highlightRow(f);
    if (!$('#card').hidden) showCard(f);
  });
  $('#play').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));
  $('#speed').addEventListener('click', () => {
    state.speed = (state.speed + 1) % SPEEDS.length;
    $('#speed').textContent = `${SPEEDS[state.speed]}×`;
  });
}

function showThrough(i) {
  const f = J.flights[i];
  setChapterLayers(f.chapter);
  if (f.chapter !== state.chapter) {
    state.chapter = f.chapter;
    markChapter(f.chapter);
    frame(J.chapters.find(c => c.id === f.chapter), J.byChapter[f.chapter]);
  }
  setRange(0, i);
}

function startPlay() {
  cancelAnimationFrame(state.anim);
  state.playing = true;
  revealMap();
  $('#play').textContent = 'Pause';
  let i = state.flight ? state.flight.id + 1 : Math.max(0, state.max + 1);
  if (i >= J.flights.length) i = 0;
  const next = () => {
    if (!state.playing) return;
    if (i >= J.flights.length) return stopPlay();
    const f = J.flights[i++];
    const speed = SPEEDS[state.speed];
    showThrough(f.id);
    showCard(f);
    const dur = Math.min(12000, Math.max(3000, f.hours * 4000)) / speed;
    const fly = () => flyFlight(f, { duration: dur, onDone: () => setTimeout(next, 1400 / speed) });
    // At normal speed, follow along: frame each flight before flying it
    if (speed === 1 && f.track.length > 1 && !REDUCED) {
      map.fitBounds(bounds(f.track), { padding: cardPadding(), maxZoom: 10, duration: 900 });
      map.once('moveend', fly);
    } else {
      fly();
    }
  };
  next();
}

function stopPlay() {
  if (!state.playing) return;
  state.playing = false;
  $('#play').textContent = 'Play';
}

/* ---------- Selection and the flight card ---------- */
function selectFlight(id) {
  const f = J.flights[id];
  popup.remove();
  revealMap();
  if (f.chapter !== state.chapter) { state.chapter = f.chapter; markChapter(f.chapter); }
  setChapterLayers(f.chapter);
  cancelAnimationFrame(state.anim);
  setRange(J.byChapter[f.chapter][0].id, id);
  if (f.track.length) {
    const pts = f.track.length > 1 ? f.track : f.coords;
    map.fitBounds(bounds(pts), { padding: cardPadding(), maxZoom: 11, duration: REDUCED ? 0 : 1000 });
    map.once('moveend', () => flyFlight(f));
  } else {
    flyFlight(f);
  }
  showCard(f);
}

function cardPadding() {
  if (mobile()) return mobilePadding();
  return { top: 60, left: 60, bottom: 60, right: Math.min(380, innerWidth * 0.3) + 40 };
}

function mobilePadding() {
  const room = $('#map').offsetHeight;
  return { top: 30, left: 30, right: 30, bottom: Math.min(sheetVisible(), room * 0.6) + 30 };
}

function highlightRow(f) {
  document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
  const row = document.querySelector(`tr.flight[data-id="${f.id}"]`);
  if (!row) return;
  row.classList.add('selected');
  // Keep the logbook on the flight being shown: anchor to the chapter heading when the chapter
  // changes, then scroll only when the entry would otherwise leave view
  const smooth = state.playing && !REDUCED;
  if (state.panelChapter !== f.chapter) {
    state.panelChapter = f.chapter;
    panelScroll(row.closest('.chapter'), 'start', smooth);
    if (!inPanel(row)) panelScroll(row, 'center', smooth);
  } else if (!inPanel(row)) {
    panelScroll(row, 'center', smooth);
  }
}

function inPanel(el) {
  const box = $('#log').getBoundingClientRect(), r = el.getBoundingClientRect();
  // On small screens part of the sheet can be pushed below the timeline bar
  const bottom = Math.min(box.bottom, $('#timeline').getBoundingClientRect().top);
  return r.top >= box.top + 8 && r.bottom <= bottom - 8;
}

// Programmatic scrolls shouldn't count as the reader choosing a chapter
function panelScroll(el, block, smooth) {
  state.autoScrollUntil = performance.now() + (smooth ? 1200 : 800);
  const log = $('#log'), box = log.getBoundingClientRect(), r = el.getBoundingClientRect();
  // Center within the part of the sheet that's on screen, not the whole (partly hidden) panel
  const visible = Math.min(box.bottom, $('#timeline').getBoundingClientRect().top) - box.top;
  const top = log.scrollTop + r.top - box.top - (block === 'center' ? (visible - r.height) / 2 : 0);
  log.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
}

const autoScrolling = () => performance.now() < (state.autoScrollUntil || 0);

function showCard(f) {
  state.flight = f;
  highlightRow(f);
  const card = $('#card');
  const where = f.places.map(p => J.places[p]).filter(Boolean);
  const est = [...new Set(where)].filter(p => !SOLID.has(p.confidence));
  const fam = aircraftFamily(f.aircraft);
  const photo = J.photos?.[`bureau:${f.bureau}`] || J.photos?.[f.aircraft] || J.photos?.[fam];
  const exact = photo && J.photos[`bureau:${f.bureau}`] === photo;
  const route = where.length > 1 ? where.map(shortName).filter((v, i, a) => v !== a[i - 1]).join(' to ')
    : where.length ? `Around ${shortName(where[0])}` : 'Base not recorded, so this flight is not on the map.';
  const [log, page] = f.page.split('/');
  // Early WWII pages: the pilot column names the instructor and the passenger column reads "inst." or "train"
  const instructed = /^inst/i.test(f.passenger);
  const rec = [
    `${f.aircraft}${f.bureau ? `, bureau no. ${f.bureau}` : ''}`,
    `${f.hours.toFixed(1)} hours${Math.abs(f.logged - f.hours) > 0.05 ? ` (${f.logged.toFixed(1)} credited)` : ''}${f.code ? `. Character ${f.code}${f.code_meaning ? ` (${f.code_meaning})` : ''}` : ''}`,
    instructed ? `Instructor ${f.pilot}` : '',
    !instructed && f.pilot && !/^(self|goss)/i.test(f.pilot) ? `Pilot ${f.pilot}` : '',
    f.passenger && !/^(self|inst\.?|train)$/i.test(f.passenger) && !/matson/i.test(f.passenger) ? `With ${f.passenger}` : '',
  ].filter(Boolean);

  card.innerHTML = `
    ${mobile() ? '<button type="button" class="card-close">← Logbook</button>'
      : '<button type="button" class="card-close" aria-label="Close flight card">Close</button>'}
    ${photo ? `<figure>
      <img src="${esc(photo.src)}" alt="${esc(photo.alt || AIRCRAFT[fam].name)}">
      <figcaption>${exact ? `<strong>His aircraft, bureau no. ${esc(f.bureau)}</strong>, ${esc(photo.caption)}` : esc(photo.caption)}
        <a href="${esc(photo.page)}" target="_blank" rel="noopener">${esc(photo.credit)}</a></figcaption>
    </figure>` : ''}
    <div class="card-body">
      ${J.squadrons?.[f.squadron]?.insignia ? `<img class="card-patch" src="${esc(J.squadrons[f.squadron].insignia)}" alt="${esc(f.squadron)} insignia">` : ''}
      <p class="card-date">${f.date_from ? `${esc(fmtDate(f.date_from))} to ` : ''}${esc(fmtDate(f.date))}${f.squadron ? `, ${esc(f.squadron)}${J.squadrons[f.squadron]?.nickname ? ` "${esc(J.squadrons[f.squadron].nickname)}"` : ''}` : ''}</p>
      <h3>${esc(f.remarks || TYPE_LABEL[f.type])}</h3>
      ${f.gloss ? `<p class="gloss">${esc(f.gloss)}</p>` : ''}
      <p class="card-type">${esc(AIRCRAFT[fam].name)}${J.squadrons?.[f.squadron] ? `<br>${esc(J.squadrons[f.squadron].name)}` : ''}</p>
      <p class="rec">${rec.map(esc).join('<br>')}</p>
      <p class="note">${esc(route)}</p>
      ${f.date_from ? `<p class="note">Logged as one summary page, not flight by flight, so the map shows these ${f.hours.toFixed(1)} hours as a single loop from the field.</p>`
        : f.illustrative ? '<p class="note">The log records where, not the path, so this track is an illustration of the kind of flight it was.</p>' : ''}
      ${est.map(p => `<p class="note">${esc(shortName(p))} is ${esc(p.confidence)}: ${esc(p.evidence)}</p>`).join('')}
      ${f.notes ? `<p class="note">Transcription note: ${esc(f.notes)}</p>` : ''}
      ${peopleHTML(f)}
      <div class="card-actions">
        <button type="button" class="replay">Replay track</button>
        <button type="button" class="page">View ${log === 'wwii' ? 'WWII' : 'Korea-era'} logbook ${esc(page.replace('p-', 'page '))}</button>
      </div>
    </div>`;
  if (card.hidden || state.cardFor !== f.id) card.scrollTop = 0;
  state.cardFor = f.id;
  card.hidden = false;
  $('.card-close', card).onclick = () => { card.hidden = true; state.flight = null; map.getSource('plane').setData(emptyFC()); map.getSource('flown').setData(emptyFC()); };
  $('.replay', card).onclick = () => { stopPlay(); flyFlight(f); };
  $('.page', card).onclick = () => openScan(f);
}

function peopleHTML(f) {
  if (!f.people?.length) return '';
  return `<ul class="people">${f.people.map(id => {
    const p = J.people[id];
    const initials = p.name.replace(/\(.*\)/, '').split(/[\s.]+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('');
    const face = p.photo
      ? `<img src="${esc(p.photo)}" alt="Portrait of ${esc(p.name)}">`
      : `<span class="initials" aria-hidden="true">${esc(initials)}</span>`;
    const why = id === 'matson' ? 'In the rear seat' : id === 'wasson' ? 'Signed his carrier qualification' : 'Signed this page';
    return `<li>${face}<span><strong>${esc(p.name)}</strong><br>${esc(p.role)}, ${esc(p.unit)}<br><em>${why}.</em>
      ${p.photo_credit ? `<small>${esc(p.photo_credit)}</small>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

function showPlace(code, lngLat) {
  const p = J.places[code];
  revealMap('peek');
  const fl = J.flights.slice(Math.max(state.min, 0), state.max + 1).filter(f => f.places.includes(code));
  popup.setLngLat(lngLat).setHTML(`<div class="pop">
      <h3>${esc(shortName(p))}</h3>
      <p class="note">${esc(p.name)}${p.today ? `; today ${esc(p.today)}` : ''}</p>
      ${SOLID.has(p.confidence) ? '' : `<p class="note">Location ${esc(p.confidence)}: ${esc(p.evidence)}</p>`}
      <ul>${fl.slice(-40).reverse().map(f => `<li data-id="${f.id}">${esc(f.date)} ${esc(f.remarks || TYPE_LABEL[f.type])}</li>`).join('')}</ul>
    </div>`).addTo(map);
  popup.getElement().querySelectorAll('li').forEach(li => li.addEventListener('click', () => {
    selectFlight(+li.dataset.id);
    document.querySelector(`tr.flight[data-id="${li.dataset.id}"]`)?.scrollIntoView({ block: 'center' });
  }));
}

function openScan(f) {
  const dlg = $('#scan'), frameEl = $('.scan-frame', dlg), img = $('img', dlg);
  const [log, page] = f.page.split('/');
  img.src = `scans/${f.page}.jpg`;
  img.alt = `Logbook page with the entry for ${fmtDate(f.date)}`;
  $('.scan-caption', dlg).textContent = `${log === 'wwii' ? 'WWII logbook' : 'Korea-era logbook'}, ${page.replace('p-', 'page ')}: entry of ${fmtDate(f.date)}`;
  frameEl.classList.remove('zoomed');
  img.onclick = () => frameEl.classList.toggle('zoomed');
  dlg.showModal();
}
