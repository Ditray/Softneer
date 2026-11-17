'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const E = require('../src/engine');
const H = require('../src/hydro');
const D = require('../src/drivetrain');

function near(actual, target, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - target) <= tolerance, `${actual} ≠ ${target}`);
}

test('laminar pipe pressure drop agrees with Poiseuille and inverts to the input flow', () => {
  const input = { density: 1000, viscosity: 10, flow: .2, mode: 'flow', staticHead: 0,
    rows: [{ group: 1, diameter: 10, length: 5, roughness: .04, local: 0 }] };
  const result = H.pipeline(input);
  const p = 128 * .01 * 5 * (.2 / 60000) / (Math.PI * .01 ** 4);
  near(result.pressure * 1e5, p);
  assert.equal(result.sections[0].regime, 'Ламинарный');
  near(H.pipeline({ ...input, mode: 'head', available: result.head }).flow, .2);
  assert.equal(H.pipeline({ ...input, flow: 0 }).loss, 0);
  assert.throws(() => H.pipeline({ ...input, mode: 'head', available: -1 }));
});

test('parallel pipe branches balance common loss and total flow', () => {
  const segment = { group: 2, diameter: 35, length: 12, roughness: .045, local: 2 };
  const input = { density: 998, viscosity: 1, flow: 120, mode: 'flow', staticHead: 5,
    rows: [{ ...segment, group: 1 }, segment, { ...segment, diameter: 50 }] };
  const { sections, loss, residual, head } = H.pipeline(input);
  near(sections[1].flow + sections[2].flow, 120);
  near(sections[1].loss, sections[2].loss);
  near(loss, sections[0].loss + sections[1].loss);
  near(head, 5 + loss);
  near(residual, 0);
  assert.ok(sections[2].flow > sections[1].flow);
  const { reynolds, lambda } = sections[1];
  near(1 / Math.sqrt(lambda) + 2 * Math.log10(.045 / (35 * 3.7) + 2.51 / (reynolds * Math.sqrt(lambda))), 0, 5e-8);
});

const pumpInput = {
  density: 1000, staticHead: 5, resistance: 0.0005, inlet: 1.01325, vapour: .0234,
  suctionHeight: -2, suctionLoss: 1, rows: [
    { flow: 0, head: 20, efficiency: 0, npshr: 1 },
    { flow: 100, head: 10, efficiency: 70, npshr: 3 },
    { flow: 200, head: 0, efficiency: 60, npshr: 6 }
  ]
};

test('pump curve intersection, hydraulic power and NPSH', () => {
  const result = H.pumpDuty(pumpInput);
  near(result.flow, 100);
  near(result.head, 10);
  near(result.shaft, 1000 * H.G * (.1 / 60) * 10 / .7 / 1000);
  near(result.margin, (1.01325 - .0234) * 1e5 / (1000 * H.G) - 6);
  assert.throws(() => H.pumpDuty({ ...pumpInput, staticHead: 25 }));
});

test('linked pump duty evaluates the same pipeline at its computed flow', () => {
  const network = { viscosity: 1, rows: [
    { group: 1, length: 16, diameter: 30, roughness: .045, local: 5 },
    { group: 1, length: 18, diameter: 25, roughness: .045, local: 3 }
  ] };
  const duty = H.pumpDuty({ ...pumpInput, network });
  assert.equal(duty.coupled, true);
  const series = H.pipeline({ ...network, density: 1000, mode: 'flow', staticHead: 5, flow: duty.flow });
  near(duty.head, series.head, 2e-8);
});

test('hydrostatic rectangular pressure center from sectional second moment', () => {
  const r = H.hydrostatic({ density: 1000, surfacePressure: 0, depth: 2, width: 1, height: 2, angle: 90 });
  near(r.force, 4 * H.G);
  near(r.centerDepth, 2 + 1 / 6);
  assert.throws(() => H.hydrostatic({ density: 1000, surfacePressure: 0, depth: .5, width: 1, height: 2, angle: 90 }));
});

test('reservoir drains to zero head with correct initial rate and integral', () => {
  const r = H.orifice({ density: 1000, diameter: 10, coefficient: .6, head: 1, end: 0, reservoir: .5 });
  const q = .6 * Math.PI * .01 ** 2 / 4 * Math.sqrt(2 * H.G);
  near(r.time, 1 / q);
  near(r.start, q * 60000);
  near(r.end, 0);
  assert.equal(r.volume, 500);
});

test('right-angle bend reaction includes static pressure and momentum in both axes', () => {
  const r = H.bendForce({ density: 1000, flow: 60, d1: 30, d2: 30, p1: 1, p2: 1, angle: 90 });
  const a = Math.PI * .03 ** 2 / 4;
  near(r.x, 1e5 * a + .001 / a);
  near(r.y, -r.x);
  near(r.force, r.x * Math.SQRT2);
});

test('water hammer changes from Joukowsky peak to the slow-closure estimate', () => {
  const input = { density: 1000, liquidBulk: 2.2, pipeYoung: 210, diameter: 60, thickness: 2, restraint: 1,
    length: 50, change: 2, closeTime: 1, initial: 5 };
  const slow = H.waterHammer(input);
  near(slow.dp, 2);
  assert.equal(slow.fast, false);
  const fast = H.waterHammer({ ...input, closeTime: 0 });
  near(fast.dp, .02 * fast.c);
  near(fast.transit, 100 / fast.c);
});

test('ideal volume drive conserves power and produces the displacement ratio', () => {
  const r = H.volumetricDrive({ pumpVolume: 20, pumpSpeed: 1500, pumpVol: 1, pumpMech: 1,
    motorVolume: 50, motorVol: 1, motorMech: 1, loadTorque: 80, circuitLoss: 0 });
  near(r.motorSpeed, 600);
  near(r.torque, 32);
  near(r.efficiency, 100);
  near(r.loss, 0);
});

test('turbine and hydrokinetic converter close their power balances', () => {
  const r = H.turbine({ density: 1000, flow: 1, head: 20, efficiency: .8, rpm: 500 });
  near(r.power, 16 * H.G);
  near(r.power + r.loss, r.hydraulic);
  const t = H.converter({ rpm: 1500, torque: 250, speedRatio: .45,
    rows: [{ ratio: 0, torqueRatio: 2 }, { ratio: .9, torqueRatio: 1 }] });
  near(t.k, 1.5);
  near(t.torque, 375);
  near(t.power + t.loss, t.input);
  near(t.efficiency, 67.5);
});

test('two-stage transmission closes power, ratio, torque and loss balances', () => {
  const result = D.gearbox({ rpm: 1500, power: 12, ambient: 16, ua: 100,
    rows: [{ module: 2, z1: 24, z2: 72, angle: 20, efficiency: .95 },
      { module: 3, z1: 24, z2: 48, angle: 20, efficiency: .9 }] });
  near(result.ratio, 6);
  near(result.rpm, 250);
  near(result.power, 12 * .95 * .9);
  near(result.loss, result.stages.reduce((sum, stage) => sum + stage.loss, 0));
  near(result.torque * Math.PI * result.rpm / 30000, result.power);
  near(result.temperature, 16 + result.loss * 10);
  assert.deepEqual(result.stages.map(stage => stage.speedSign), [-1, 1]);
});

test('helical formula reduces to the spur pair and axial thrust reverses with helix', () => {
  const input = { module: 3, z1: 24, z2: 60, angle: 20, helix: 0, x1: 0, x2: 0, width: 30, torque: 150, rpm: 1200 };
  const straight = E.spurPair(input);
  const zeroHelix = D.helicalPair(input);
  for (const key of ['center', 'contact', 'ft', 'fr', 'outputRpm']) near(zeroHelix[key], straight[key]);
  assert.equal(zeroHelix.fa, 0);
  const right = D.helicalPair({ ...input, helix: 20, x1: .3 });
  const left = D.helicalPair({ ...input, helix: -20, x1: .3 });
  near(right.fa, -left.fa);
  near(right.center, left.center);
  near(right.ft * right.pinion.working / 1000, 150);
  assert.ok(right.center > right.referenceCenter && right.faceContact > 1);
});

test('shaft central and overhung forces satisfy reactions and the closed-form central deflection', () => {
  const data = { span: 120, diameter: 30, young: 210, torque: 40, rpm: 500, cA: 25, cB: 25, bearingType: 'ball' };
  const result = D.shaft({ ...data, rows: [{ x: 60, fy: -1000, fz: -500 }] });
  near(result.ay, 500);
  near(result.bz, 250);
  near(result.bending, Math.hypot(1000, 500) * 120 / 4000);
  const i = Math.PI * 30 ** 4 / 64;
  near(result.deflection, Math.hypot(1000, 500) * 120 ** 3 / (48 * 210000 * i));
  near(result.peak, 60);
  const overhang = D.shaft({ ...data, rows: [{ x: -40, fy: -1200, fz: 0 }] });
  near(overhang.ay, 1600);
  near(overhang.by, -400);
  near(overhang.bending, 48);
  assert.ok(overhang.deflection > 0);
});

test('tooth capacity separates contact and root load factors and per-member safety', () => {
  const member = { zsingle: 1, yf: 2, ys: 1.5, yb: 1, ydt: 1, contactLimit: 1000, rootLimit: 360 };
  const result = D.toothStrength({
    ft: 2500, diameter: 60, width: 25, module: 2, ratio: 2,
    ka: 2, kv: 1, khb: 1, kha: 1, kfb: 1, kfa: 1,
    zh: 2, ze: 190, zeps: .9, zbeta: 1, ybeta: 1, sh: 1.1, sf: 1.3,
    rows: [member, { ...member, zsingle: 1.1, rootLimit: 300 }]
  });
  near(result.gears[0].contact, 342 * Math.sqrt(5));
  near(result.gears[0].root, 300);
  near(result.rootSafety, 1);
  assert.ok(result.warnings.length > 0);
});

test('Venturi satisfies Bernoulli and continuity for an ideal coefficient', () => {
  const input = { density: 1000, viscosity: 1, inlet: 80, throat: 40,
    pressure: 10, elevation: 0, discharge: 1 };
  const r = H.venturi(input);
  near(r.v2, 4 * r.v1);
  near((r.v2 ** 2 - r.v1 ** 2) / 2 * 1000, 10000);
  near(r.flow, r.v2 * Math.PI * .04 ** 2 / 4 * 60000);
  assert.throws(() => H.venturi({ ...input, throat: 80 }));
});

test('laminar slit flow scales with the cube of clearance and heat equals pressure loss times flow', () => {
  const input = { density: 870, viscosity: 46, width: 30, gap: .08, length: 15, pressure: 20 };
  const r = H.slit(input);
  near(H.slit({ ...input, gap: .16 }).flow, 8 * r.flow);
  near(r.loss, r.flow / 60000 * 2e6);
  assert.throws(() => H.slit({ ...input, width: .1 }));
});
