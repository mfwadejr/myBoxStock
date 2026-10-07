// TEST / scan-core — the pure scanning rules: MAC shape and normalizing, nearest-to-center choice, repeat-frame agreement, crop math (no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const sandbox = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/js/app/scan-core.js'), 'utf8'), { self: sandbox });
const C = sandbox.ScanCore, J = (x) => JSON.parse(JSON.stringify(x));   // (objects made inside the sandbox are compared as plain data)

test('a MAC is 12 hex digits in any common shape and comes out as XX:XX:XX:XX:XX:XX', () => {
  for (const v of ['a0bb3e19ce1a', 'A0BB3E19CE1A', 'A0:BB:3E:19:CE:1A', 'a0-bb-3e-19-ce-1a', 'a0bb.3e19.ce1a', 'A0BB-3E19-CE1A', ' A0:BB:3E:19:CE:1A ', 'MAC A0:BB:3E:19:CE:1A', 'MAC: a0bb3e19ce1a']) assert.equal(C.normalizeMac(v), 'A0:BB:3E:19:CE:1A', v);
  for (const v of ['', 'V6PLY5260919CE1A', 'A0:BB:3E:19:CE', 'A0:BB:3E:19:CE:1A:FF', 'A0:BB-3E:19:CE:1A', 'A0BB.3E19-CE1A', 'G0:BB:3E:19:CE:1A', '273D00000019CE1A', null, undefined]) assert.equal(C.normalizeMac(v), '', String(v));
});

test('a serial field takes whatever was scanned (trimmed); the MAC field only a MAC', () => {
  assert.equal(C.accept('text', '  AB-12 x  '), 'AB-12 x'); assert.equal(C.accept('text', ''), ''); assert.equal(C.accept('mac', 'AB-12'), ''); assert.equal(C.accept('mac', '00:11:22:33:44:55'), '00:11:22:33:44:55');
});

test('the code nearest the middle of the box wins; near-equal codes are offered as a choice; the MAC rule filters first', () => {
  const box = { w: 300, h: 150 };
  assert.equal(C.choose([{ value: 'TOP', x: 150, y: 10 }, { value: 'MID', x: 150, y: 80 }, { value: 'LOW', x: 150, y: 140 }], box).pick.value, 'MID');
  assert.deepEqual(J(C.choose([], box)), { pick: null, tied: [] });
  const t = C.choose([{ value: 'A', x: 150, y: 50 }, { value: 'B', x: 150, y: 100 }], box); assert.equal(t.pick, null); assert.equal(t.tied.map(c => c.value).sort().join(), 'A,B');
  assert.equal(C.choose([{ value: 'A', x: 150, y: 20 }, { value: 'B', x: 150, y: 100 }], box).pick.value, 'B', 'clearly nearer is not a tie');
  assert.equal(C.choose([{ value: 'SERIAL1', x: 150, y: 75 }, { value: 'a0bb3e19ce1a', x: 150, y: 140 }], box, 'mac').pick.value, 'A0:BB:3E:19:CE:1A', 'a MAC scan ignores a nearer non-MAC value');
  assert.equal(C.choose([{ value: 'SERIAL1', x: 150, y: 75 }], box, 'mac').pick, null);
  assert.equal(C.choose([{ value: 'X', x: 10, y: 10 }, { value: 'X', x: 150, y: 75 }], box).pick.d, 0, 'the same value seen twice counts once, at its nearest');
  assert.equal(C.ranked([{ value: 'F', x: 0, y: 0 }, { value: 'N', x: 150, y: 70 }], box)[0].value, 'N');
});

test('a read counts only after the same answer in several frames in a row', () => {
  const c = C.consensus(2);
  assert.equal(c.push('A'), false); assert.equal(c.push('A'), true);
  assert.equal(c.push('B'), false, 'a different value starts over'); assert.equal(c.push(null), false, 'a frame with nothing starts over'); assert.equal(c.push('B'), false); assert.equal(c.push('B'), true);
  const d = C.consensus(2); d.push('W'); assert.equal(d.push('W', 3), false, 'weak formats ask for three'); assert.equal(d.push('W', 3), true);
});

test('crop math: the box over an object-fit: cover video maps to the right pixels of the frame', () => {
  // the video is exactly the view size: a straight copy
  assert.deepEqual(J(C.cropRect({ w: 400, h: 300 }, { w: 400, h: 300 }, { x: 100, y: 50, w: 200, h: 100 })), { x: 100, y: 50, w: 200, h: 100 });
  // a 1920x1080 frame in a 375x812 portrait view: scale = 812/1080, the sides are cut off equally
  const s = 812 / 1080, ox = (375 - 1920 * s) / 2;
  const r = C.cropRect({ w: 375, h: 812 }, { w: 1920, h: 1080 }, { x: 30, y: 300, w: 315, h: 150 });
  assert.equal(r.x, Math.round((30 - ox) / s)); assert.equal(r.y, Math.round(300 / s)); assert.equal(r.w, Math.round((345 - ox) / s) - r.x); assert.equal(r.h, Math.round(450 / s) - r.y);
  // a wide frame in a short view: top and bottom are cut off equally
  const r2 = J(C.cropRect({ w: 800, h: 300 }, { w: 800, h: 600 }, { x: 0, y: 0, w: 800, h: 300 })); assert.deepEqual(r2, { x: 0, y: 150, w: 800, h: 300 });
  // never outside the frame
  const r3 = J(C.cropRect({ w: 100, h: 100 }, { w: 100, h: 100 }, { x: -20, y: -20, w: 300, h: 300 })); assert.deepEqual(r3, { x: 0, y: 0, w: 100, h: 100 });
});

test('tap to aim: the box is centered on the tap and clamped to the stage, keeping its size', () => {
  const area = { w: 375, h: 500 }, size = { w: 300, h: 64 };
  assert.deepEqual(J(C.placeBox({ x: 187.5, y: 250 }, size, area)), { x: 38, y: 218 }, 'centered on the tap');
  assert.deepEqual(J(C.placeBox({ x: 0, y: 0 }, size, area)), { x: 0, y: 0 }, 'clamped at the top left');
  assert.deepEqual(J(C.placeBox({ x: 999, y: 999 }, size, area)), { x: 75, y: 436 }, 'clamped at the bottom right');
  assert.deepEqual(J(C.placeBox({ x: 10, y: 10 }, { w: 400, h: 600 }, area)), { x: 0, y: 0 }, 'a box bigger than the stage stays at the corner');
});

test('the crop follows the moved box: tapping a lower point crops lower in the camera frame', () => {
  const view = { w: 375, h: 812 }, video = { w: 720, h: 1280 }, size = { w: 300, h: 64 };
  const mid = C.cropRect(view, video, { ...C.placeBox({ x: 187.5, y: 406 }, size, view), ...size });
  const low = C.cropRect(view, video, { ...C.placeBox({ x: 187.5, y: 600 }, size, view), ...size });
  assert.ok(low.y > mid.y + 250, `the crop moved down (${mid.y} to ${low.y})`); assert.ok(Math.abs(low.w - mid.w) <= 1 && Math.abs(low.h - mid.h) <= 1, 'same size');
  const centerY = (r) => r.y + r.h / 2, s = Math.max(view.w / video.w, view.h / video.h);
  assert.ok(Math.abs(centerY(low) - 600 / s) <= 2, 'the crop is centered on the tapped point');
  // the nearest-to-the-aim rule uses the box, so a code at the moved box's middle wins over one at the old middle
  const box = { w: 300, h: 64 };
  assert.equal(C.choose([{ value: 'OLD', x: 150, y: 5 }, { value: 'AIMED', x: 150, y: 32 }], box).pick.value, 'AIMED');
});

test('tapped points map to the camera frame (focus point)', () => {
  const view = { w: 375, h: 812 }, video = { w: 720, h: 1280 };
  const c = C.videoPoint(view, video, { x: 187.5, y: 406 }); assert.ok(Math.abs(c.x - 0.5) < 0.001 && Math.abs(c.y - 0.5) < 0.001);
  assert.deepEqual(J(C.videoPoint({ w: 400, h: 300 }, { w: 400, h: 300 }, { x: 100, y: 75 })), { x: 0.25, y: 0.25 });
  assert.deepEqual(J(C.videoPoint({ w: 100, h: 100 }, { w: 100, h: 100 }, { x: -5, y: 500 })), { x: 0, y: 1 }, 'clamped to the frame');
});

test('the stuck hint says to aim at the bars, and suggests Medium only on Small', () => {
  assert.match(C.stuckHint('medium'), /^Nothing read yet\. Put the red line across the bars, not the printed text\. Move closer and hold steady\.$/);
  assert.match(C.stuckHint('small'), /Medium/); assert.doesNotMatch(C.stuckHint('large'), /Medium/);
});
