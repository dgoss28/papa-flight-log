"""Build site/data/journey.json from the transcribed logbooks and the places table.

Usage: python3 scripts/build_site_data.py
"""
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from tracks import make_track

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
OUT = ROOT / 'site' / 'data' / 'journey.json'

# Letters from the "character of flight" legend that read consistently in his WWII log.
# A/B/C are skipped: the legend printed in the later logbook doesn't match his 1943 usage.
CHARACTER = {
    'E': 'familiarization & practice', 'F': 'gunnery', 'G': 'bombing', 'K': 'tactical',
    'L': 'navigation', 'R': 'tests', 'T': 'administrative', 'V': 'instrument', 'Y': 'night',
    'Z': 'special',
}

CHAPTERS = [
    dict(id='minneapolis', title='First Wings', subtitle='NAS Minneapolis, Aug–Oct 1943',
         start='1943-08-01', end='1943-10-31', base='NAS Minneapolis', center=[-93.22, 44.88], zoom=5.5,
         text='On 17 August 1943 Thomas Edward Goss signed into naval aviation. His first logbook page records '
              'primary training in the N2S "Yellow Peril" biplane: 34.2 hours with an instructor and 59.5 solo, '
              'finished on 23 October 1943.'),
    dict(id='pensacola', title='Pensacola', subtitle='NAS Pensacola, Nov 1943–Mar 1944',
         start='1943-11-01', end='1944-03-31', base='NAS Pensacola', center=[-87.32, 30.35], zoom=6,
         text='Intermediate training at the "Annapolis of the Air": instrument hops in the SNV Valiant, then '
              'formation and gunnery in the SNJ Texan. On 21 March 1944 he was rated an instrument pilot. '
              'Part of March is missing from the scanned pages.'),
    dict(id='miami', title='Dive Bombers', subtitle='NAS Miami, Apr–May 1944',
         start='1944-04-01', end='1944-05-31', base='NAS Miami', center=[-80.28, 25.9], zoom=6,
         text='Operational training in the SBD-5 Dauntless with radioman-gunners in the rear seat: '
              'bombing runs, tactics, field carrier landing practice, and long navigation flights over the Florida Straits.'),
    dict(id='vmsb474', title='Stateside', subtitle='VMSB-474, likely El Toro, Aug–Oct 1944',
         start='1944-06-01', end='1944-10-31', base='El Toro', center=[-117.73, 33.68], zoom=8,
         text='Now a Marine second lieutenant, he joined scout-bomber squadron VMSB-474: dive and glide bombing, '
              'strafing, radar and homing-beacon hops, oxygen flights, battle problems. The log never names the base; '
              'the map places these flights at MCAS El Toro, California, the Marines\' West Coast dive-bomber training '
              'center that year, as an estimate. Most of September is missing from the scan.'),
    dict(id='solomons', title='The Solomons', subtitle='Green Island & Piva, Nov 1944',
         start='1944-11-01', end='1945-01-31', base='Green Is.', center=[154.7, -5.4], zoom=6.3,
         text='By late November 1944 he had joined VMSB-341, the "Torrid Turtles," flying the SBD-6 from Green '
              'Island and over to Piva on Bougainville. From here on his rear-seat gunner on every combat mission is '
              'Matson. December and January read "NO FLIGHTS": Marine Aircraft Group 24 was moving its squadrons by sea '
              'from the Solomons, by way of New Guinea and Leyte, to Lingayen Gulf on Luzon.'),
    dict(id='luzon', title='Luzon', subtitle='Battle of Manila, Feb 1945',
         start='1945-02-01', end='1945-03-31', base='Mangaldan', center=[120.9, 15.2], zoom=6.6,
         text='Ten strikes in eleven days as the Battle of Manila raged: Rosario, Corregidor, Wawa, '
              'Fort McKinley, Marikina Field, Calamba. VMSB-341 flew from Mangaldan, a strip it '
              'helped build a few miles inland from Lingayen Gulf, not from a carrier; he would not qualify aboard a '
              'carrier until 1953. Its close support for the 1st Cavalry and 11th Airborne near Wawa-Lobac is his '
              'entry for 14 February.'),
    dict(id='mindanao', title='Mindanao', subtitle='Zamboanga, Apr–Jul 1945',
         start='1945-04-01', end='1945-07-31', base='Zamboanga', center=[123.6, 7.3], zoom=6.2,
         text='In late March VMSB-341 moved south to Moret Field at Zamboanga. From there he flew strikes on Jolo, '
              'Malabang, Davao and the Bukidnon highlands, sometimes '
              'landing at Malabang to refuel before the run home. On his final combat page he totaled it himself: '
              '31 completed strikes, 6 incomplete.'),
    dict(id='home1945', title='Home', subtitle='VMSB-932, Oct–Nov 1945',
         start='1945-08-01', end='1945-12-31', base='NKT', center=[-77, 35], zoom=6,
         text='Back in North Carolina with VMSB-932, flying the SB2C Helldiver in the war\'s last weeks of '
              'peacetime flying: dive bombing practice, division tactics and parade rehearsals over Cherry Point.'),
    dict(id='recall', title='Recalled', subtitle='Cherry Point, 1951–52',
         start='1946-01-01', end='1952-04-30', base='NKT', center=[-82, 38.5], zoom=4.3,
         text='Six years later the Korean War brought him back. Refresher flying in the SNJ, then the F4U-4 Corsair, '
              'and twin-engine SNB instrument training at MCAS Cherry Point. Two cross-country trips went home to '
              'family in Wisconsin, including one over Christmas 1951.'),
    dict(id='korea', title='Korea', subtitle='VMO-6, Sep–Nov 1952',
         start='1952-05-01', end='1952-12-31', base='A-9', center=[126.76, 37.95], zoom=9.6,
         text='With observation squadron VMO-6 he flew the OE-1 Bird Dog from strip A-9, spotting artillery (A/S) '
              'and directing air strikes (TAO) over the hills north of the line. His most frequent target was '
              'Taedŏk-san, a hill just north of Panmunjŏm, where the truce talks dragged on below him.'),
    dict(id='vmc2', title='Skyraiders', subtitle='VMC-2, Jan–Jun 1953',
         start='1953-01-01', end='1953-12-31', base='NKT', center=[-77.5, 28.5], zoom=4,
         text='Home again, flying AD Skyraiders with VMC-2: night flights, hunter-killer exercises, and on '
              '13 April 1953 carrier qualification aboard USS Bennington off Guantánamo. The final entry, '
              '24 June 1953 at Edenton, reads simply: "CRASH!"'),
]

SQUADRONS = {
    'VMSB-341': dict(name='Marine Scout Bombing Squadron 341', nickname='Torrid Turtles', insignia='insignia/VMSB-341.jpg',
                     page='https://commons.wikimedia.org/wiki/File:Vmsb341_insig.jpg',
                     credit='Squadron insignia, public domain, via Wikimedia Commons',
                     alt='a turtle in a flight helmet riding a bomb'),
    'VMSB-932': dict(name='Marine Scout Bombing Squadron 932', nickname='Teufelhund', insignia='insignia/VMSB-932.jpg',
                     page='https://commons.wikimedia.org/wiki/File:VMSB-932_WWII_Logo.jpg',
                     credit='WWII squadron insignia, scanned from Millstein, U.S. Marine Corps Aviation Squadron Unit Insignia 1941-1946 (1995); public domain, via Wikimedia Commons',
                     alt='a winged bulldog in a campaign hat diving, with the word Teufelhund'),
    'VMO-6': dict(name='Marine Observation Squadron 6', nickname='', insignia='insignia/VMO-6.jpg',
                  page='https://commons.wikimedia.org/wiki/File:Vmo6_insig.jpg',
                  credit='Squadron insignia (design date not recorded), public domain, via Wikimedia Commons',
                  alt='a black cat holding binoculars, riding a rocket above the clouds'),
}
SQUADRONS.update({
    'VMSB-474': dict(name='Marine Scout Bombing Squadron 474', nickname='', insignia=''),
    'VMC-2': dict(name='Marine Composite Squadron 2', nickname='', insignia=''),
})
# His rank through the story: only what the logbooks show, plus what's flagged as inferred
CHAPTER_RANK = {
    'minneapolis': ('Naval aviation cadet', 'likely: Marine pilots trained as Navy cadets until they earned their wings'),
    'pensacola': ('Naval aviation cadet', 'likely: Marine pilots trained as Navy cadets until they earned their wings'),
    'miami': ('2nd Lieutenant, USMCR', 'likely newly commissioned; the log does not record the date'),
    'vmsb474': ('2nd Lieutenant, USMCR', 'as he signed his logbook on 1 September 1944'),
    'solomons': ('Lieutenant, USMCR', 'still a 2nd Lt or newly a 1st Lt; the log does not say'),
    'luzon': ('Lieutenant, USMCR', 'still a 2nd Lt or newly a 1st Lt; the log does not say'),
    'mindanao': ('Lieutenant, USMCR', 'still a 2nd Lt or newly a 1st Lt; the log does not say'),
    'home1945': ('Lieutenant, USMCR', 'still a 2nd Lt or newly a 1st Lt; the log does not say'),
    'recall': ('USMCR officer, recalled', 'rank not recorded in the log'),
    'korea': ('USMCR officer', 'rank not recorded in the log'),
    'vmc2': ('USMCR officer', 'rank not recorded in the log; he finished his service as a Captain'),
}
for _c in CHAPTERS:
    _c['rank'], _c['rank_basis'] = CHAPTER_RANK.get(_c['id'], ('', ''))

CHAPTER_SQUADRON = {'vmsb474': 'VMSB-474', 'vmc2': 'VMC-2', 'solomons': 'VMSB-341', 'luzon': 'VMSB-341', 'mindanao': 'VMSB-341',
                    'home1945': 'VMSB-932', 'korea': 'VMO-6'}
for _c in CHAPTERS:
    if _c['id'] in CHAPTER_SQUADRON:
        _c['squadron'] = CHAPTER_SQUADRON[_c['id']]

# Remark keyword → place code (searched longest-first, case-insensitive)
ALIASES = {
    'Green Is': 'Green Is.', 'Green': 'Green Is.', 'Piva': 'Piva', 'Rosario': 'Rosario', 'Corregidor': 'Corregidor',
    'Wawa': 'Wawa', "O'Donnell": "Area south of O'Donnell", 'McKinley': 'Fort McKinley', 'Marikina': 'Marikina Field',
    'Putlan': 'Putlan Bridge', 'Calamba': 'Calamba', 'Jolo': 'Jolo', 'Tomalabang': 'Tomalabang', 'Malabang': 'Malabang',
    'Zamboanga': 'Zamboanga', 'Santa Cruz': 'Santa Cruz', 'Santa Ana': 'Santa Ana', 'Davao': 'Davao',
    'Oyster Bay': 'Oyster Bay', 'Dalirig': 'Dalirig', 'Libby': 'Libby A/D', 'Dalwangan': 'Dalwangan',
    'Malaybalay': 'Malaybalay', 'Salak': 'Salak', 'Cherry Point': 'NKT', 'Ch. Pt': 'NKT',
    'Miami': 'MIAMI', 'Shaw AFB': 'SHAW', 'Edenton': 'EDENTON', 'K16': 'K-16', 'K13': 'K-13', 'A9': 'A-9',
    'ASCOM': 'ASCOM', 'CVA20': 'CVA-20', 'Munsan-ni': 'Munsan-ni',
}
CONFIDENCE = ['confirmed', 'likely', 'approximate', 'possible', 'unknown']
OFFSETS = {'N.W.': (0.12, -0.12), 'NW': (0.12, -0.12), 'N.E.': (0.12, 0.12), 'N.': (0.15, 0), 'E.': (0, 0.15),
           'SE': (-0.12, 0.12), 'south': (-0.15, 0)}


def load_places():
    places = {}
    for r in csv.DictReader(open(DATA / 'places.csv', encoding='utf-8')):
        lat, lon = r['lat'], r['lon']
        places[r['code']] = dict(code=r['code'], kind=r['kind'], name=r['name_then'], today=r['today'],
                                 confidence=r['confidence'], evidence=r['evidence'],
                                 coord=[float(lon), float(lat)] if lat and lon else None)
    return places


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def chapter_for(date):
    for c in CHAPTERS:
        if c['start'] <= date[:10] <= c['end']:
            return c
    return None


def tokens(remark, places):
    """Return place codes mentioned in a remark, in order of appearance."""
    text = re.sub(r'\b([AK])-(\d+)\b', r'\1\2', remark).replace('CVA-20', 'CVA20')
    codes = {c: c for c, p in places.items() if p['kind'] in ('airfield', 'korea_target') and re.fullmatch(r'[A-Z]{3}', c)}
    targets = {c: c for c, p in places.items() if p['kind'] == 'korea_target'}
    lookup = {**ALIASES, **targets}
    found = []
    for key in sorted(lookup, key=len, reverse=True):
        for m in re.finditer(re.escape(key), text, re.I):
            if not any(a <= m.start() < b for a, b, _ in found):
                found.append((m.start(), m.end(), lookup[key]))
    for m in re.finditer(r'\b[A-Z]{3}\b', text):
        if m.group() in codes and not any(a <= m.start() < b for a, b, _ in found):
            found.append((m.start(), m.end(), m.group()))
    return [c for _, _, c in sorted(found)]


def offset(remark, coord):
    for k, (dlat, dlon) in OFFSETS.items():
        if re.search(rf'(^|\W){re.escape(k)}\s*(of|\b)', remark):
            return [round(coord[0] + dlon, 4), round(coord[1] + dlat, 4)], True
    return coord, False


def flight_rows():
    for log in ('wwii', 'korea'):
        for r in csv.DictReader(open(DATA / f'{log}.csv', encoding='utf-8')):
            span = re.fullmatch(r'(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2})', r['date'])
            if span and r['aircraft_type']:
                # Primary training is logged as one summary page: show it as a single entry dated at its finish
                r = dict(r, date=span.group(2), date_from=span.group(1),
                         remarks='Primary training, all stages: 34.2 hrs dual, 59.5 solo, 7.1 check flights')
            elif not re.fullmatch(r'\d{4}-\d{2}-\d{2}', r['date']):
                continue  # month summaries and "no flights" notes
            dur = num(r.get('duration_hr') or r.get('flight_time'))
            if r['aircraft_type'].startswith('Link') or dur is None:
                continue
            yield log, r, dur


AIRCRAFT_NAMES = {
    'N2S': 'Boeing-Stearman N2S Kaydet', 'SNV': 'Vultee SNV Valiant', 'SNJ': 'North American SNJ Texan',
    'SBD': 'Douglas SBD Dauntless', 'SB2C': 'Curtiss SB2C Helldiver', 'F4U': 'Vought F4U Corsair',
    'SNB': 'Beechcraft SNB Kansan', 'OE': 'Cessna OE-1 Bird Dog', 'L-19': 'Cessna L-19A Bird Dog (Army)',
    'OY': 'Consolidated OY-2 Sentinel', 'AD': 'Douglas AD Skyraider',
}


def totals(flights):
    """Career totals from the transcribed entries (what's in the scans, not his running totals)."""
    def hrs(fl):
        return round(sum(f['logged'] for f in fl), 1)

    def family(model):
        return 'L-19' if model.startswith('L-19') else model.split('-')[0]

    by_type = defaultdict(list)
    for f in flights:
        by_type[family(f['aircraft'])].append(f)
    types = []
    for fam, fl in by_type.items():
        airframes = Counter(f['bureau'] for f in fl if re.fullmatch(r'[\d-]+', f['bureau'] or ''))
        top, top_n = airframes.most_common(1)[0] if airframes else ('', 0)
        types.append(dict(family=fam, name=AIRCRAFT_NAMES.get(fam, fam), first=min(f['date_from'] or f['date'] for f in fl),
                          variants=sorted({f['aircraft'] for f in fl}), entries=len(fl), hours=hrs(fl),
                          airframes=len(airframes), most_flown=top, most_flown_n=top_n))
    types.sort(key=lambda t: t['first'])

    wwii = [f for f in flights if f['log'] == 'wwii']
    # Dual received: the primary-training summary's dual time, plus later flights flown with an instructor
    primary = next((f for f in flights if f['date_from']), None)
    instructed = [f for f in wwii if not f['date_from'] and re.match(r'inst|self$', f['passenger'] or '', re.I)
                  and not re.match(r'self|goss', f['pilot'] or '', re.I)]
    dual_received = round((34.2 if primary else 0) + sum(f['logged'] for f in instructed), 1)
    night = sum(f['hours'] for f in wwii if 'Y' in f['code']) + sum(f['night'] for f in flights if f['log'] == 'korea')
    instrument = sum(f['hours'] for f in wwii if 'V' in f['code']) + sum(f['instrument'] for f in flights if f['log'] == 'korea')
    combat = Counter(f['type'] for f in flights if f['type'] in ('strike', 'spotting', 'tao', 'photo'))
    return dict(
        hours=hrs(flights), entries=len(flights), aloft=round(sum(f['hours'] for f in flights), 1),
        hours_wwii=hrs(wwii), hours_korea=hrs([f for f in flights if f['log'] == 'korea']),
        entries_wwii=len(wwii), entries_korea=len(flights) - len(wwii),
        airframes=len({(f['aircraft'], f['bureau']) for f in flights if f['bureau']}),
        types=types, dual_received=dual_received, dual_received_flights=len(instructed),
        night=round(night, 1), instrument=round(instrument, 1),
        carrier_landings=sum(f['carrier_landings'] for f in flights),
        combat=dict(combat), combat_total=sum(combat.values()),
        places=len({p for f in flights for p in f['places']}),
    )


def build():
    places = load_places()
    flights, unresolved = [], Counter()
    current = {}
    for log, r, dur in sorted(flight_rows(), key=lambda x: (x[1]['date'], x[0])):
        ch = chapter_for(r['date'])
        base = ch['base']
        if r.get('station') in places:
            base = r['station']
        remark = r['remarks'].strip()
        code = r['character'].strip()
        kind = 'local'
        legs = []
        here = current.get(ch['id'], base)
        toks = [t for t in tokens(remark, places) if t in places]
        is_combat = ch['id'] in ('solomons', 'luzon', 'mindanao', 'korea') and re.match(r'^(Strike|Incomplete|Mission incomplete|Patrol|A/S|TAO|Recon|.*Photo Mission)', remark, re.I)
        landed = re.search(r'landed at (\w+)', remark, re.I)
        if is_combat:
            kind = 'tao' if remark.upper().startswith('TAO') else 'spotting' if re.match(r'A/S|Recon', remark, re.I) else 'strike'
            if ch['id'] == 'korea' and 'Photo' in remark:
                kind = 'photo'
            target = next((t for t in toks if places[t]['kind'] in ('korea_target', 'pacific_place') and t != base), None)
            end = landed and tokens(landed.group(1), places)
            end = end[0] if end else base
            if target:
                legs = [base, target, end]
            elif re.search(r'incomplete|Sector', remark, re.I) or not remark:
                legs = [base]
            else:
                unresolved[remark] += 1
                legs = [base]
            here = end
        elif re.search(r'&\s*ret|and return|& return', remark, re.I) and toks:
            kind = 'route'
            legs = [base, toks[-1] if toks[-1] != base else toks[0], base]
            here = base
        elif len(toks) >= 2 or (len(toks) == 1 and re.search(r'\bto\b|-', remark) and toks[0] != here and ch['id'] != 'korea'):
            kind = 'route'
            legs = toks if len(toks) >= 2 else [here, toks[0]]
            here = legs[-1]
        elif len(toks) == 1:
            kind = 'local' if ch['id'] != 'korea' else 'utility'
            if ch['id'] == 'korea':
                legs = [base, toks[0], base]
            else:
                legs = [toks[0]]
                here = toks[0]
        else:
            legs = [here] if here else []
        if ch['id'] == 'korea':
            here = base
        current[ch['id']] = here

        coords, approx = [], False
        for i, p in enumerate(legs):
            pl = places.get(p)
            if not pl or not pl['coord']:
                continue
            c = pl['coord']
            if i == 1 and len(legs) == 3 and kind == 'strike':
                c, moved = offset(remark, c)
                approx = approx or moved
            coords.append(c)
        # weakest place on the route decides, except the chapter's own base
        ranks = [CONFIDENCE.index(places[p]['confidence']) for p in legs if p in places and p != ch['base']]
        conf = 'unknown' if not coords else CONFIDENCE[max(ranks, default=0)]
        if approx and conf in ('confirmed', 'likely'):
            conf = 'approximate'
        letters = [] if log == 'korea' else [CHARACTER[ch_] for ch_ in code if ch_ in CHARACTER]
        flights.append(dict(
            id=len(flights), log=log, date=r['date'], date_from=r.get('date_from', ''),
            chapter=ch['id'], aircraft=r['aircraft_type'],
            bureau=r['aircraft_no'], hours=dur, code=code, code_meaning=', '.join(letters),
            pilot=r.get('pilot', ''), passenger=r.get('passengers', ''), remarks=remark, notes=r['notes'],
            page=f"{log}/p-{int(r['page']):02d}", type=kind, places=[p for p in legs if p in places],
            coords=coords, confidence=conf,
        ))
        f = flights[-1]
        f['squadron'] = ch.get('squadron', '')
        # Time he credited himself: in the Korea-era book, pilot + passenger/co-pilot columns
        # (shared instrument hops and the last column don't count toward his page totals)
        credited = (num(r.get('pilot_time')) or 0) + (num(r.get('passenger_time')) or 0)
        f['logged'] = round(credited, 1) if log == 'korea' and credited else dur
        # Time written only in the 1953 form's last ("SC") column isn't carried into his page totals
        if log == 'korea' and not credited and re.search(r'SC column|in last column', r['notes']):
            f['logged'] = 0.0
        f['night'] = num(r.get('night')) or 0
        f['instrument'] = num(r.get('instrument')) or 0
        f['carrier_landings'] = int(num(r.get('carrier_landings')) or 0)
        f['track'], f['illustrative'] = make_track(f, places.get(base, {}).get('coord'))

    people = list(csv.DictReader(open(DATA / 'people.csv', encoding='utf-8')))
    for f in flights:
        f['people'] = [p['id'] for p in people
                       if f['page'] in p['pages'].split(';')
                       or (p['passenger_match'] and p['passenger_match'].lower() in f['passenger'].lower())
                       or (p['id'] == 'wasson' and 'carrier qualification' in f['remarks'].lower())]

    used = {p for f in flights for p in f['places']} | {c['base'] for c in CHAPTERS if c['base']}
    stats = dict(
        flights=len(flights), hours=round(sum(f['hours'] for f in flights), 1),
        combat=sum(f['type'] in ('strike', 'spotting', 'tao', 'photo') for f in flights),
        aircraft=sorted({re.sub(r'-\d.*', '', f['aircraft']) for f in flights}),
    )
    stats['totals'] = totals(flights)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    json.dump(dict(chapters=CHAPTERS, flights=flights, stats=stats, squadrons=SQUADRONS,
                   people={p['id']: {k: v for k, v in p.items() if k not in ('pages', 'passenger_match')} for p in people},
                   places={k: v for k, v in places.items() if k in used}),
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    by_log = Counter(f['log'] for f in flights)
    print(f'wrote {OUT.relative_to(ROOT)}: {by_log} stats={stats}')
    print('types:', Counter(f['type'] for f in flights))
    print('confidence:', Counter(f['confidence'] for f in flights))
    months = defaultdict(float)
    for f in flights:
        months[f['date'][:7]] += f['hours']
    print('hours/month:', ' '.join(f'{k}:{v:.1f}' for k, v in sorted(months.items())))
    if unresolved:
        print('unresolved combat remarks:', dict(unresolved))


if __name__ == '__main__':
    build()
