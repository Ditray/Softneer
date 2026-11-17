'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { catalog, partMesh, partStep } = require('../src/cad');

test('all catalog meshes are closed, outward-oriented solids at nominal dimensions', () => {
  assert.equal(new Set(catalog.map(part => part.id)).size, catalog.length);
  for (const part of catalog) {
    const { vertices, shell } = partMesh(part);
    const edges = new Map();
    let sixVolume = 0;
    for (const face of shell) {
      for (let i = 0; i < face.length; i++) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        assert.notEqual(a, b, part.id);
        const key = [Math.min(a, b), Math.max(a, b)].join('/');
        const data = edges.get(key) || [0, 0];
        edges.set(key, [data[0] + 1, data[1] + Math.sign(b - a)]);
      }
      const [ax, ay, az] = vertices[face[0]];
      for (let i = 1; i < face.length - 1; i++) {
        const [bx, by, bz] = vertices[face[i]];
        const [cx, cy, cz] = vertices[face[i + 1]];
        sixVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
      }
    }
    for (const data of edges.values()) assert.deepEqual(data, [2, 0], part.id);
    const { b, h, L, d, D, B } = part.dims;
    const extent = dimension => Math.max(...vertices.map(v => v[dimension])) - Math.min(...vertices.map(v => v[dimension]));
    assert.ok(Math.abs(extent(0) - (part.group === 'key' ? L : D ?? d)) < 1e-8, part.id);
    assert.ok(Math.abs(extent(1) - (part.group === 'key' ? b : D ?? d)) < 1e-8, part.id);
    assert.ok(Math.abs(extent(2) - (h ?? B ?? L)) < 1e-8, part.id);
    const polygonFactor = 96 * Math.sin(2 * Math.PI / 96) / 2;
    const area = part.group === 'key' ? b * L : polygonFactor * ((D ?? d) ** 2 - (D ? d ** 2 : 0)) / 4;
    assert.ok(Math.abs(sixVolume / 6 - area * extent(2)) < 1e-7, part.id);
  }
});

test('generated STEP has resolvable entity references and one closed faceted BREP per model', () => {
  for (const part of catalog) {
    const data = partStep(part);
    assert.ok(data.startsWith('ISO-10303-21;\nHEADER;'), part.id);
    assert.ok(data.trimEnd().endsWith('END-ISO-10303-21;'), part.id);
    const entries = Array.from(data.matchAll(/^#(\d+)=(.+);$/gm), ([, key, value]) => [key, value]);
    const refs = new Map(entries);
    assert.equal(refs.size, entries.length, part.id);
    for (const value of refs.values()) {
      for (const [, reference] of value.matchAll(/#(\d+)/g)) assert.ok(refs.has(reference), part.id);
    }
    const entities = [...refs.values()];
    assert.equal(entities.filter(item => item.startsWith('FACETED_BREP(')).length, 1, part.id);
    assert.equal(entities.filter(item => item.startsWith('CLOSED_SHELL(')).length, 1, part.id);
    assert.equal(entities.filter(item => item.startsWith('FACE_SURFACE(')).length, partMesh(part).shell.length, part.id);
    assert.ok(entities.some(item => item.includes('SI_UNIT(.MILLI.,.METRE.)')), part.id);
  }
});
