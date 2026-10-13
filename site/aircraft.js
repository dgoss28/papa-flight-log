/* Aircraft he flew: real proportions for the map silhouettes, plus display names.
   span/length in metres; root/tip are wing chords; wingAt is the wing's position from the nose (0–1). */
const AIRCRAFT = {
  N2S:  { name: 'Boeing-Stearman N2S Kaydet', span: 9.8, length: 7.6, root: 1.6, tip: 1.4, wingAt: 0.3, tail: 3.2, biplane: true },
  SNV:  { name: 'Vultee SNV Valiant', span: 12.8, length: 8.8, root: 2.6, tip: 1.2, wingAt: 0.36, tail: 4.2 },
  SNJ:  { name: 'North American SNJ Texan', span: 12.8, length: 8.8, root: 2.6, tip: 1.0, wingAt: 0.36, tail: 4.4, sweepTip: 0.4 },
  SBD:  { name: 'Douglas SBD Dauntless', span: 12.7, length: 10.1, root: 3.0, tip: 1.2, wingAt: 0.34, tail: 4.8 },
  SB2C: { name: 'Curtiss SB2C Helldiver', span: 15.2, length: 11.2, root: 3.2, tip: 1.3, wingAt: 0.33, tail: 5.6 },
  F4U:  { name: 'Vought F4U Corsair', span: 12.5, length: 10.3, root: 3.0, tip: 1.1, wingAt: 0.38, tail: 4.6, roundTips: true },
  SNB:  { name: 'Beechcraft SNB Kansan', span: 14.5, length: 10.4, root: 2.3, tip: 1.1, wingAt: 0.34, tail: 4.8, twin: true },
  OE:   { name: 'Cessna OE-1 Bird Dog', span: 11.0, length: 7.9, root: 1.6, tip: 1.6, wingAt: 0.3, tail: 3.4, thin: true },
  'L-19': { name: 'Cessna L-19A Bird Dog (Army)', span: 11.0, length: 7.9, root: 1.6, tip: 1.6, wingAt: 0.3, tail: 3.4, thin: true },
  OY:   { name: 'Consolidated OY-2 Sentinel', span: 10.4, length: 7.0, root: 1.6, tip: 1.3, wingAt: 0.3, tail: 3.0, thin: true },
  AD:   { name: 'Douglas AD Skyraider', span: 15.3, length: 11.8, root: 3.4, tip: 1.6, wingAt: 0.36, tail: 5.6 },
  R4D:  { name: 'Douglas R4D Skytrain', span: 29.0, length: 19.6, root: 5.0, tip: 1.8, wingAt: 0.33, tail: 8.0, twin: true },
};

function aircraftFamily(model) {
  const m = model.toUpperCase();
  if (m.startsWith('L-19') || m.startsWith('L19')) return 'L-19';
  return Object.keys(AIRCRAFT).find(k => m.startsWith(k)) || 'SNJ';
}

/* Draw a top-down planform, nose up, into a square canvas. Returns ImageData for map.addImage. */
function drawAircraft(family, px = 72, ratio = devicePixelRatio || 1) {
  const a = AIRCRAFT[family];
  const size = Math.round(px * ratio);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const scale = (size * 0.86) / Math.max(a.span, a.length * 1.1);
  g.translate(size / 2, size / 2 - (a.length * scale) * 0.02);
  g.scale(scale, scale);
  const L = a.length, top = -L / 2, wingY = top + L * a.wingAt;
  const fuseW = a.thin ? 0.9 : a.twin ? 1.3 : 1.25;

  const shape = new Path2D();
  // fuselage
  shape.moveTo(0, top);
  shape.bezierCurveTo(fuseW * 0.7, top + 0.2, fuseW / 2, top + L * 0.25, fuseW / 2, wingY + a.root);
  shape.lineTo(0.18, top + L);
  shape.lineTo(-0.18, top + L);
  shape.lineTo(-fuseW / 2, wingY + a.root);
  shape.bezierCurveTo(-fuseW / 2, top + L * 0.25, -fuseW * 0.7, top + 0.2, 0, top);
  // wings (trapezoid, optional swept tip)
  const half = a.span / 2, tipLead = wingY + (a.root - a.tip) * (a.sweepTip ?? 0.25);
  for (const s of [1, -1]) {
    shape.moveTo(0, wingY);
    shape.lineTo(s * half, tipLead);
    if (a.roundTips) shape.quadraticCurveTo(s * (half + 0.35), tipLead + a.tip / 2, s * half, tipLead + a.tip);
    else shape.lineTo(s * half, tipLead + a.tip);
    shape.lineTo(0, wingY + a.root);
    shape.closePath();
  }
  // horizontal tail
  const tailY = top + L * 0.86, ht = a.tail / 2;
  for (const s of [1, -1]) {
    shape.moveTo(0, tailY);
    shape.lineTo(s * ht, tailY + 0.35);
    shape.lineTo(s * ht, tailY + 0.95);
    shape.lineTo(0, tailY + 1.2);
    shape.closePath();
  }
  // engines on twins
  if (a.twin) for (const s of [1, -1]) shape.ellipse(s * a.span * 0.2, wingY + 0.2, 0.55, 1.6, 0, 0, Math.PI * 2);

  g.lineJoin = 'round';
  g.strokeStyle = '#efe6cc';
  g.lineWidth = 3.2 / scale * ratio;
  g.stroke(shape);
  g.fillStyle = '#23314f';
  g.fill(shape, 'nonzero');
  if (a.biplane) { // upper wing outline, offset forward
    g.strokeStyle = '#efe6cc'; g.lineWidth = 1.2 / scale * ratio;
    g.strokeRect(-half, wingY - 0.5, a.span, a.root);
  }
  return { image: g.getImageData(0, 0, size, size), ratio };
}
