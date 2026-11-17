'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const E = require('../src/engine');

function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
}

test('reference spur pair and nominal diameters', () => {
  const r = E.spurPair({ module: 2.5, z1: 24, z2: 48, angle: 20, torque: 75, rpm: 1400 });
  near(r.center, 90);
  near(r.ratio, 2);
  near(r.pinion.tip * 2, 65);
  near(r.wheel.root * 2, 113.75);
  near(r.ft, 2500);
  near(r.fr, 909.9255857, 1e-6);
  const tipAngle = teeth => Math.acos(teeth * Math.cos(Math.PI / 9) / (teeth + 2));
  const contact = (24 * Math.tan(tipAngle(24)) + 48 * Math.tan(tipAngle(48)) - 72 * Math.tan(Math.PI / 9)) / (2 * Math.PI);
  near(r.contact, contact);
  assert.equal(r.outputRpm, 700);
  assert.deepEqual(r.warnings, []);
  assert.throws(() => E.spurPair({ module: 0, z1: 24, z2: 48, angle: 20, torque: 0, rpm: 0 }));
});

test('gear profile retains root and tip radii, DXF contains closed metric polylines', () => {
  const { pinion, wheel, alpha } = E.spurPair({ module: 2, z1: 24, z2: 36, angle: 20, torque: 0, rpm: 0 });
  const one = E.gearOutline(pinion, alpha);
  const two = E.gearOutline(wheel, alpha);
  const radii = one.map(p => Math.hypot(...p));
  near(Math.min(...radii), pinion.root);
  near(Math.max(...radii), pinion.tip);
  const lines = E.gearDxf(one, 'reference', two).trimEnd().split('\r\n');
  const codes = [];
  for (let i = 0; i < lines.length; i += 2) codes.push([Number(lines[i]), lines[i + 1]]);
  assert.equal(codes[codes.findIndex(([, value]) => value === '$INSUNITS') + 1][1], '4');
  const starts = codes.map(([, value], index) => value === 'LWPOLYLINE' ? index : -1).filter(index => index >= 0);
  assert.equal(starts.length, 2);
  starts.forEach((start, index) => {
    const section = codes.slice(start, starts[index + 1]);
    assert.equal(section.find(([code]) => code === 70)[1], '1');
    const expected = [one, two][index].length;
    assert.equal(Number(section.find(([code]) => code === 90)[1]), expected);
    assert.equal(section.filter(([code]) => code === 10).length, expected);
    assert.equal(section.filter(([code]) => code === 20).length, expected);
  });
  const small = E.spurPair({ module: 2, z1: 10, z2: 36, angle: 20, torque: 0, rpm: 0 });
  assert.ok(small.warnings.some(warning => warning.includes('подрезания')));
});

test('fit table uses inclusive upper ends and signed clearance', () => {
  const fit = E.fitLimits({ diameter: 40, hole: 'H7', shaft: 'g6' });
  assert.deepEqual(fit.hole, [0, 25]);
  assert.deepEqual(fit.shaft, [-25, -9]);
  assert.deepEqual([fit.min, fit.max, fit.type], [9, 50, 'С зазором']);
  assert.equal(E.fitLimits({ diameter: 50, hole: 'H7', shaft: 'h6' }).max, 41);
  assert.equal(E.fitLimits({ diameter: 50.001, hole: 'H7', shaft: 'h6' }).max, 49);
  assert.equal(E.fitLimits({ diameter: 500, hole: 'H8', shaft: 'k6' }).shaft[1], 45);
  assert.throws(() => E.fitLimits({ diameter: 501, hole: 'H7', shaft: 'h6' }));
  const manual = E.fitFromDeviations({ diameter: 60, eiHole: 0, esHole: 20, eiShaft: 21, esShaft: 35 });
  assert.deepEqual([manual.min, manual.max, manual.type], [-35, -1, 'С натягом']);
});

test('bearing life and inverse dynamic load rating agree', () => {
  const input = { type: 'ball', dynamic: 25, load: 5, rpm: 1500, target: 20000 };
  const ball = E.bearingLife(input);
  near(ball.revolutions, 125e6);
  near(ball.hours, 125e6 / 90000);
  near(E.bearingLife({ ...input, dynamic: ball.required }).hours, input.target);
  const roller = E.bearingLife({ ...input, type: 'roller', dynamic: 16, load: 2 });
  near(roller.revolutions, 1024e6, 1e-5);
  assert.throws(() => E.bearingLife({ ...input, rpm: 0 }));
});

test('spline pressure and torque limit use consistent dimensions', () => {
  const input = { torque: 100, diameter: 40, length: 20, height: 2, teeth: 10, sharing: 0.5, allowed: 50 };
  const r = E.splineLoad(input);
  near(r.area, 200);
  near(r.force, 5000);
  near(r.pressure, 25);
  near(r.margin, 2);
  near(r.torqueLimit, 200);
  assert.equal(E.splineLoad({ ...input, torque: 0 }).margin, Infinity);
});

test('Miner damage sums step fractions and scales hours per block', () => {
  const r = E.minerDamage({ blockHours: 10, rows: [{ cycles: 1000, capacity: 1e6 }, { cycles: 500, capacity: 1e5 }] });
  near(r.damage, 0.006);
  near(r.hours, 10 / 0.006);
  assert.throws(() => E.minerDamage({ blockHours: 10, rows: [{ cycles: 0, capacity: 1e6 }] }));
});

test('tolerance stack inverts asymmetric bounds for a subtractive link', () => {
  const r = E.toleranceStack([{ sign: 1, nominal: 40, lower: 0, upper: 0.2 },
    { sign: -1, nominal: 30, lower: -0.1, upper: 0.3 }]);
  near(r.nominal, 10);
  near(r.min, 9.7);
  near(r.max, 10.3);
  near(r.width, 0.6);
});

test('slider crank extrema and analytical derivatives', () => {
  const input = { radius: 30, rod: 100, rpm: 60 };
  near(E.sliderCrank({ ...input, theta: 0 }).x, 130);
  near(E.sliderCrank({ ...input, theta: 180 }).x, 70);
  const t = 42;
  const dt = 1e-5;
  const dAngle = dt * input.rpm * 6;
  const lo = E.sliderCrank({ ...input, theta: t - dAngle });
  const hi = E.sliderCrank({ ...input, theta: t + dAngle });
  const mid = E.sliderCrank({ ...input, theta: t });
  near(mid.velocity, (hi.x - lo.x) / (2 * dt), 1e-5);
  near(mid.acceleration, (hi.velocity - lo.velocity) / (2 * dt), 1e-5);
  assert.throws(() => E.sliderCrank({ ...input, rod: 30, theta: 0 }));
});

test('hydraulic cylinder force and speed change with active area', () => {
  const input = { bore: 63, rod: 36, pressure: 12, flow: 18, efficiency: 0.9 };
  const extension = E.hydraulics({ ...input, direction: 'out' });
  const retraction = E.hydraulics({ ...input, direction: 'in' });
  near(extension.area - retraction.area, Math.PI * 36 ** 2 / 4);
  near(extension.power, 3.6);
  near(extension.force * extension.speed / 1e6, extension.power * 0.9);
  assert.ok(retraction.speed > extension.speed && retraction.force < extension.force);
});
