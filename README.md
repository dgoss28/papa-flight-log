# Papa's Flight Log

Thomas Edward Goss, USMCR (File No. 036705): transcriptions of his two pilot logbooks, to be used for an interactive map of where he flew.

## Layout

- `source/`: the original PDF scans (`wwii.pdf`, `korea.pdf`)
- `pages/{wwii,korea}/p-NN.png`: pages rendered at 220 dpi and rotated upright. Each image is a two-page spread.
- `data/wwii.csv`: 1943–1945 entries (266 flights)
- `data/korea.csv`: 1951–1953 entries (236 flights)
- `data/character_codes.csv`: the "character of flight" legend printed in the Korea logbook

The `page` column in each CSV points to the matching `pages/.../p-NN.png`, so any row can be checked against the scan. `notes` marks uncertain readings with `?`, red-ink entries, and the monthly certification stamps.

## Timeline at a glance

| Period | Where | Unit / aircraft |
|---|---|---|
| Aug–Oct 1943 | NAS Minneapolis | Primary flight training, N2S |
| Nov 1943–Mar 1944 | NAS Pensacola | Intermediate training, SNV/SNJ |
| Apr–May 1944 | NAS Miami | Operational training, SBD-5 Dauntless |
| Aug–Oct 1944 | Stateside, probably MCAS El Toro, CA (estimated) | VMSB-474, SBD |
| Nov 1944 | Green Island / Piva (Bougainville), Solomons | VMSB-341 "Torrid Turtles", SBD-6 |
| Feb 1945 | Luzon, from Mangaldan: Corregidor, Wawa-Lobac, Fort McKinley, Marikina, Calamba | VMSB-341, SBD-6 strikes |
| Apr–Jul 1945 | Moret Field, Zamboanga, Mindanao: strikes on Jolo, Malabang, Davao, Libby A/D | SBD-6. His tally: 31 completed / 6 incomplete strikes |
| Oct–Nov 1945 | MCAS Cherry Point area | VMSB-932, SB2C Helldiver |
| Jul 1951–Mar 1952 | MCAS Cherry Point (NKT) | Refresher training, F4U-4 Corsair, SNB-5 |
| May–Nov 1952 | Korea: K-16 (Seoul), ASCOM City, western front | VMO-6, OE-1 Bird Dog artillery spotting (A/S) and TAO missions |
| Jan–Jun 1953 | MCAS Cherry Point | VMC-2, AD-3W/4W/4N Skyraider. Carrier qualified on USS Bennington (CVA-20), 13 Apr 1953 |
| 27 Apr 1953 | USS Bennington, off Guantánamo | Boiler explosion kills 11 of the ship's crew; per family, this is why the squadron returned to Cherry Point |
| 24 Jun 1953 | Edenton, NC | Last entry: "CRASH!" Per family: after touch-and-goes (10 FCL) he dropped off his crew, took off alone, lost the engine right after takeoff and crashed in a pond; a Catholic chaplain out hiking rescued him. He lost both legs |

## Known gaps and discrepancies

Each month was checked against the totals he stamped or wrote in the logbook.

- **March 1944 (WWII):** the stamp says 28.1 hrs, but only about 4.2 hrs (from Mar 20 on) are in the scan. A page is probably missing between scan pages 8 and 9.
- **September 1944 (WWII):** the stamp says 48.5 hrs, but only about 8.9 hrs (Sep 23–29) are in the scan. A page is probably missing between scan pages 17 and 18.
- **July 1951 (Korea, page 3):** his pilot column totals 21.4, but the rows add up to 22.4. One duration may be misread, or his addition may be off.
- **October 1951 (Korea, page 7):** he totals 4.6, but the rows add up to 4.1.
- **Dec 1944–Jan 1945, Mar 1945, Feb 1952:** there are no flights in these months, and the logbook confirms it.

## Airfield / route codes

`data/places.csv` lists every code with its name at the time, coordinates, a confidence level (confirmed / likely / approximate / unknown), and the evidence behind it. Several 1950s codes have since been reassigned or retired. No 1951–53 CAA *Location Identifiers* list is available online, so the uncertain codes were worked out by checking whether the logged flight times fit the distances.

- **NAW → Guantánamo Bay (likely):** USS Bennington was doing shakedown at Guantánamo in spring 1953. The flight home, NAW → MMN → SAV → NKT (3.0 / 2.5 / 1.7 hr), works out to a steady ~155 kt only if it ran Guantánamo → Miami → Savannah → Cherry Point.
- **MMN → MCAS Miami, Opa-locka (likely):** a Marine air station from 1952 to 1958.
- **CHW → Charleston WV, Kanawha Airport (likely):** both legs fit the distances (Glenview → Charleston → Cherry Point). The modern code is CRW.
- **NBV → NAS Glenview (likely):** half an hour from Milwaukee, so probably NBU written with a V. The family was in Wisconsin, so the Aug and Dec 1951 trips (Madison, Milwaukee, Glenview) were probably visits home.
- **A-9 → VMO-6 home strip, about 6 mi SE of Munsan-ni:** from *U.S. Marine Operations in Korea, Vol. V* (Project Gutenberg #65011).
- **NHU → unresolved:** an outlying field within roughly 100 nm of Cherry Point.

## Mission locations

`data/places.csv` also covers the WWII Pacific strike targets (`kind=pacific_place`), the training bases, and the Korean artillery-spotting and TAO targets (`kind=korea_target`). Each entry's `code` matches the name as written in the logbook.

Korean names were matched against GeoNames (North + South Korea) within the 1st Marine Division's 1952 sector using `scripts/match_korea_places.py`. Nearly every confident match falls within about 15 km of Panmunjŏm, on the enemy side of the line, which supports the readings. A few highlights:

- "Paektongum-ni" is an old name for **Panmunjŏm**.
- "Taedoksan" is **Taedŏk-san**, a hill just north of it and his most frequent target.
- "Changdo-myon", "Chand-myon" and "Taegang-myon" are **Changdan County townships** (장도면, 대강면) that went to North Korea in 1953 and no longer appear on maps. Their positions are approximate.

Confidence breakdown for the Korean targets: 14 likely, 12 possible, 3 approximate, 9 unresolved. Placing the rest properly needs the 1950s U.S. Army 1:50,000 maps (AMS L751 series) that the Marines used, which are scanned online.

## Story map site

`site/` is a static single page (HTML/CSS/JS plus MapLibre GL from a CDN). There is no build step.

```
python3 scripts/build_site_data.py        # regenerate site/data/journey.json after editing any CSV
cd site && python3 -m http.server 8000     # then open http://localhost:8000
```

- Scroll the logbook panel to move through 11 chapters. Each one flies the map and replays that period's flights.
- Click a row or an arc to see its route, how sure each place is, and a link to the scanned page.
- The bar at the bottom steps flight by flight (or with the ← → keys) and jumps to the next chapter.

Borders come from [historical-basemaps](https://github.com/aourednik/historical-basemaps) (1938 for WWII, 1960 for Korea). The Marine front line in `site/data/overlays.geojson` is hand-drawn and approximate. Battles and events are in `site/data/events.json`.

The `site/` folder can be uploaded as-is to GitHub Pages or Netlify.

### Flight tracks, aircraft and people

- **Tracks** (`scripts/tracks.py`): the log records where each flight went, not the path flown, so the tracks are kept deliberately plain and labeled "illustrative" on the site:
  - a simple ellipse out from the field for local flights, sized by flight time
  - an ellipse out through the target and back for strikes, spotting and TAO missions, and round trips

  Transfers between known fields (and strikes that landed somewhere else) are drawn as direct legs. Every track is seeded by the flight's id, so it's the same on every build.
- **Map icons** (`site/aircraft.js`): top-down silhouettes drawn from each type's real span and length.
- **Photos** (`site/aircraft/`, credits in `site/data/aircraft-photos.json`): mostly public-domain period U.S. Navy photos from Wikimedia Commons, one per type. There's one exact airframe: **AD-4N bureau no. 126935**, which he flew in Jan–Jun 1953, survived as warbird NX2088G until a 2011 crash. Searching Commons for his other 235 bureau numbers was cut short by rate limiting.
- **People** (`data/people.csv`): the officers who signed each page, plus Matson, his rear-seat gunner. To add a portrait, put the image in `site/people/`, fill in the `photo` (e.g. `people/rasmus.jpg`) and `photo_credit` columns, then rerun `scripts/build_site_data.py`.
