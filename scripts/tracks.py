"""Illustrative ground tracks for logbook flights.

The logbook records where a flight went, never the path flown, so the tracks are kept
deliberately plain: a simple ellipse out from the field for local flights, an ellipse
out through the target and back for missions and round trips, and direct legs for
transfers between fields. Each flight's id seeds the randomness, so the tracks are
the same on every build.
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


def ellipse(rng, hours, scale=1.0):
    """A simple out-and-back loop: an ellipse with the base at one end, sized by flight time."""
    a = min(40, max(8, 6 + hours * 11)) * scale
    b = a * rng.uniform(0.35, 0.55)
    h = rng.uniform(0, 360)
    pts = [(a + a * math.cos(t), b * math.sin(t))
           for t in (math.pi + 2 * math.pi * i / 48 for i in range(49))]
    return rotate(pts, h)


def loop_through(a, b, ratio=0.32, steps=48):
    """An ellipse with a at one end of the long axis and b at the other: out to b and back."""
    (x1, y1), (x2, y2) = a, b
    half = math.dist(a, b) / 2
    cx, cy, ang = (x1 + x2) / 2, (y1 + y2) / 2, math.atan2(y2 - y1, x2 - x1)
    minor = max(half * ratio, 1.2)
    pts = []
    for i in range(steps + 1):
        t = math.pi + 2 * math.pi * i / steps
        x, y = half * math.cos(t), minor * math.sin(t)
        pts.append((cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)))
    return pts


def make_track(flight, base_coord):
    """Return (track, illustrative) where track is a list of [lon, lat]."""
    rng = random.Random(flight['id'])
    coords = flight['coords']
    kind, hours = flight['type'], flight['hours']
    if not coords:
        return [], False

    # Single place: a plain loop out from the field, sized by flight time
    if len(coords) == 1 or all(c == coords[0] for c in coords):
        light = flight['aircraft'].startswith(('OE', 'L-19', 'OY'))
        pts = ellipse(rng, hours, 0.4 if light else 1.0)
        return [to_lonlat(coords[0], x, y) for x, y in pts], True

    origin = coords[0]
    km = [to_km(origin, c) for c in coords]
    # Out to a target or another field and back home: one loop through it
    if len(km) == 3 and km[0] == km[2] and km[1] != km[0]:
        return [to_lonlat(origin, x, y) for x, y in loop_through(km[0], km[1])], True

    # Transfers between fields (and strikes that landed elsewhere): direct legs
    pts = [km[0]]
    for b in km[1:]:
        a = pts[-1]
        if a == b:
            continue
        pts += leg(a, b, 0.02, max(12, min(60, int(math.dist(a, b) / 6))))[1:]
    # Point-to-point legs between known fields are a fair stand-in for the real path
    return [to_lonlat(origin, x, y) for x, y in pts], kind in ('strike', 'spotting', 'tao', 'photo')
