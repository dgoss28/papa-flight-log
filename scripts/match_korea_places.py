"""Fuzzy-match Korean place names from the logbook against GeoNames dumps.

Usage: python3 -I match_korea_places.py <korea.csv> <KP.txt> <KR.txt>
"""
import csv, re, sys, unicodedata
from difflib import SequenceMatcher

# 1st MarDiv western front, 1952: Han estuary to Samichon, Kaesong to Munsan
LAT, LON = (37.65, 38.25), (126.35, 127.15)

def target_names(path):
    names = {}
    for r in csv.DictReader(open(path)):
        if r['station'] != 'VMO-6':
            continue
        m = re.match(r'^(?:A/S|TAO|Recon:?|Fam)\s*-?\s*(.+)$', r['remarks'], re.I)
        raw = (m.group(1) if m else r['remarks']).strip()
        raw = re.sub(r'^Songuch-on - Photo Mission LS$', 'Songuch-on', raw)
        if re.search(r'K-1|Taxi|Mail|Test|Sector|Checkout|ASCOM', raw, re.I):
            continue
        names.setdefault(raw.rstrip('?'), []).append(r['date'])
    return names

SUFFIX = r'(myon|myeon|dong|tong|ni|ri|li|gok|kok|san|ol|mal)$'

def key(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z]', '', s)
    for a, b in [('eo', 'o'), ('eu', 'u'), ('ae', 'e'), ('wo', 'o'), ('d', 't'), ('g', 'k'),
                 ('b', 'p'), ('j', 'ch'), ('r', 'l'), ('ni', 'li'), ('ng', 'n'), ('h', '')]:
        s = s.replace(a, b)
    return s

def stem(s):
    return re.sub(SUFFIX, '', key(s).replace('lil', 'li'))

def load(path):
    out = []
    for line in open(path, encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        lat, lon = float(f[4]), float(f[5])
        if not (LAT[0] <= lat <= LAT[1] and LON[0] <= lon <= LON[1]):
            continue
        variants = {f[1], f[2]} | {a for a in f[3].split(',') if a and re.match(r'^[\x00-\x7fÀ-ɏʼʻ’-]+$', a)}
        out.append((f[0], f[1], lat, lon, f[7], variants))
    return out

def main(korea, kp, kr):
    places = load(kp) + load(kr)
    w = csv.writer(sys.stdout)
    w.writerow(['logbook_name', 'dates', 'rank', 'score', 'geonames_id', 'geonames_name', 'matched_variant', 'feature', 'lat', 'lon'])
    for name, dates in sorted(target_names(korea).items()):
        k, st = key(name), stem(name)
        scored = []
        for gid, gname, lat, lon, fcode, variants in places:
            best = max(((max(SequenceMatcher(None, k, key(v)).ratio(),
                             SequenceMatcher(None, st, stem(v)).ratio() if st and stem(v) else 0), v)
                        for v in variants), default=(0, ''))
            scored.append((best[0], gid, gname, best[1], fcode, lat, lon))
        scored.sort(reverse=True)
        for i, (sc, gid, gname, v, fcode, lat, lon) in enumerate(scored[:3], 1):
            w.writerow([name, ';'.join(dates), i, f'{sc:.2f}', gid, gname, v, fcode, lat, lon])

if __name__ == '__main__':
    main(*sys.argv[1:])
