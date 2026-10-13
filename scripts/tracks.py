"""Illustrative ground tracks for logbook flights.

The logbook records where a flight went, never the path flown, so these tracks are
plausible shapes built from the flight's type, duration and places: traffic-pattern
circuits for landing practice, a run out to a practice area and back for local hops,
orbits over artillery-spotting targets, and a dive circle over strike targets.
Each flight's id seeds the randomness, so the tracks are the same on every build.
"""
import math
import random

KM_PER_DEG_LAT = 110.57


def to_lonlat(origin, x_km, y_km):
    lon0, lat0 = origin
    return [round(lon0 + x_km / (111.32 * math.cos(math.radians(lat0))), 4),
            round(lat0 + y_km / KM_PER_DEG_LAT, 4)]


def to_km(origin, point):
    lon0, lat0 = origin
    return ((point[0] - lon0) * 111.32 * math.cos(math.radians(lat0)),
            (point[1] - lat0) * KM_PER_DEG_LAT)


def circle(cx, cy, r, start_deg, turns=1.0, clockwise=False, steps_per_turn=28):
    pts = []
    n = max(6, int(steps_per_turn * turns))
    for i in range(n + 1):
        a = math.radians(start_deg) + (-1 if clockwise else 1) * 2 * math.pi * turns * i / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def rotate(pts, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(x * c - y * s, x * s + y * c) for x, y in pts]


def leg(a, b, bend=0.0, steps=24):
    """Quadratic curve from a to b; bend is a fraction of the leg length, to the left."""
    (x1, y1), (x2, y2) = a, b
    mx, my = (x1 + x2) / 2 - (y2 - y1) * bend, (y1 + y2) / 2 + (x2 - x1) * bend
    return [((1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2,
             (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2)
            for t in (i / steps for i in range(steps + 1))]


def circuits(n, heading, length=3.2, width=1.4):
    """Rectangular traffic-pattern circuits with rounded corners, starting on the runway."""
    corner = 0.45
    box = [(-length / 2, 0), (length / 2, 0), (length / 2 + corner, corner), (length / 2 + corner, width - corner),
           (length / 2, width), (-length / 2, width), (-length / 2 - corner, width - corner),
           (-length / 2 - corner, corner), (-length / 2, 0)]
    pts = []
    for _ in range(n):
        for i in range(len(box) - 1):
            pts += leg(box[i], box[i + 1], 0, 4)[:-1]
    pts.append(box[-1])
    return rotate(pts, heading)


def practice_area(rng, hours, radius_scale=1.0):
    """Fly out to a practice area, work there (turns, eights, steep circles), return."""
    out = min(55, 12 + hours * 11) * radius_scale
    b = rng.uniform(0, 360)
    ax, ay = out * math.cos(math.radians(b)), out * math.sin(math.radians(b))
    pts = leg((0, 0), (ax, ay), rng.uniform(-0.15, 0.15))
    x, y = ax, ay
    for _ in range(max(2, int(hours * 2.5))):
        r = rng.uniform(2.5, 6) * radius_scale
        h = rng.uniform(0, 360)
        cx, cy = x + r * math.cos(math.radians(h)), y + r * math.sin(math.radians(h))
        pts += circle(cx, cy, r, h + 180, turns=rng.choice([1, 1, 2, 0.75]), clockwise=rng.random() < 0.5)
        x, y = pts[-1]
        step = rng.uniform(4, 10) * radius_scale
        x, y = x + step * math.cos(math.radians(rng.uniform(0, 360))), y + step * math.sin(math.radians(rng.uniform(0, 360)))
        pts += leg(pts[-1], (x, y), 0.2, 8)
    pts += leg((x, y), (0, 0), rng.uniform(-0.2, 0.2))
    return pts


def ellipse(rng, hours, scale=1.0):
    """A simple out-and-back loop: an ellipse with the base at one end, sized by flight time."""
    a = min(40, max(8, 6 + hours * 11)) * scale
    b = a * rng.uniform(0.35, 0.55)
    h = rng.uniform(0, 360)
    pts = [(a + a * math.cos(t), b * math.sin(t))
           for t in (math.pi + 2 * math.pi * i / 48 for i in range(49))]
    return rotate(pts, h)


def triangle(rng, hours):
    side = min(220, hours * 230 / 3 * 0.8)
    b = rng.uniform(0, 360)
    p1 = (side * math.cos(math.radians(b)), side * math.sin(math.radians(b)))
    p2 = (side * math.cos(math.radians(b + 60)), side * math.sin(math.radians(b + 60)))
    return leg((0, 0), p1, 0.03) + leg(p1, p2, 0.03)[1:] + leg(p2, (0, 0), 0.03)[1:]


def make_track(flight, base_coord):
    """Return (track, illustrative) where track is a list of [lon, lat]."""
    rng = random.Random(flight['id'])
    coords = flight['coords']
    kind, hours = flight['type'], flight['hours']
    remark, code = flight['remarks'].lower(), flight['code']
    if not coords:
        return [], False

    # Single place: a local flight around it
    if len(coords) == 1 or all(c == coords[0] for c in coords):
        origin = coords[0]
        # WWII "FCL" and Korea-log "1A3" are field carrier landing practice
        landings = 'FCL' in code or code == '1A3' or any(k in remark for k in ('gca', 'carrier'))
        # Training periods get the simplest shapes: an ellipse from the field (circuits for landing practice)
        training = flight['chapter'] in ('minneapolis', 'pensacola', 'miami', 'vmsb474', 'recall')
        familiarization = not training and ('fam' in remark or (flight['log'] == 'wwii' and 'E' in code))
        light = flight['aircraft'].startswith(('OE', 'L-19', 'OY'))
        navigation = 'nav' in remark or (flight['log'] == 'wwii' and code.endswith('L') and 'FCL' not in code)
        if landings or (flight['log'] == 'korea' and hours <= 0.8):
            pts = circuits(max(2, min(6, int(hours * 6))), rng.uniform(0, 180))
        elif navigation and not training:
            pts = triangle(rng, hours)
        elif kind in ('strike', 'spotting', 'tao') or 'sector' in remark:
            pts = practice_area(rng, hours, 0.6)
        elif familiarization:
            # Familiarization hops learn the local area by eye, so they wander farther
            pts = practice_area(rng, hours, 0.35 if light else 1.0)
        else:
            pts = ellipse(rng, hours, 0.4 if light else 1.0)
        return [to_lonlat(origin, x, y) for x, y in pts], True

    # Multiple places: legs between them, with work done over combat targets
    origin = coords[0]
    km = [to_km(origin, c) for c in coords]
    pts = [km[0]]
    for i in range(1, len(km)):
        a, b = pts[-1], km[i]
        if a == b:
            continue
        dist = math.dist(a, b)
        out_and_back = len(km) == 3 and km[0] == km[2]
        bend = (0.08 if i == 1 else -0.08) if out_and_back else 0.02
        pts += leg(a, b, bend, max(12, min(60, int(dist / 6))))[1:]
        is_target = i == 1 and len(km) == 3 and kind in ('strike', 'spotting', 'tao', 'photo')
        if is_target:
            if kind == 'strike':
                r = 3.5
                h = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) - 90
                pts += circle(b[0] + r * math.cos(math.radians(h + 90)), b[1] + r * math.sin(math.radians(h + 90)),
                              r, h - 90, turns=1.25)[1:]
            else:
                # Bird Dog spotting: slow orbits for most of the sortie
                turns = max(2, min(6, hours * 2))
                r = rng.uniform(1.6, 2.6)
                pts += [(b[0] + x, b[1] + y) for x, y in circle(0, 0, r, rng.uniform(0, 360), turns=turns)]
    # Point-to-point legs between known fields are a fair stand-in for the real path
    return [to_lonlat(origin, x, y) for x, y in pts], kind in ('strike', 'spotting', 'tao', 'photo')
