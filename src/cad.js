(function (root) {
  'use strict';

  const sources = {
    washer: ['ISO 7089:2000', 'https://www.iso.org/standard/13666.html'],
    key: ['DIN 6885-1:2021-11', 'https://www.dinmedia.de/en/standard/din-6885-1/346315269'],
    pin: ['ISO 2338:1997', 'https://www.iso.org/standard/20001.html'],
    bearing: ['Каталог SKF · серия 62', 'https://www.emarketplace.in.skf.com/industrial/bearings?search=6204-Z']
  };

  const groups = {
    washer: { label: 'Шайбы', title: 'Шайба плоская', note: 'Номинальные габариты нормального ряда. Круглые поверхности аппроксимированы гранями.' },
    key: { label: 'Шпонки', title: 'Шпонка призматическая', note: 'Прямоугольный габарит, форма B. Фаски и допуски отсутствуют.' },
    pin: { label: 'Штифты', title: 'Штифт цилиндрический', note: 'Номинальный цилиндрический габарит. Фаски и допуски отсутствуют.' },
    bearing: { label: 'Подшипники', title: 'Подшипник шариковый', note: 'Монтажный габарит d × D × B. Тела качения и внутренняя геометрия отсутствуют.' }
  };

  function item(group, size, dims) {
    const [standard, url] = sources[group];
    const id = size.replaceAll('×', 'x');
    return { group, size, dims, standard, url, ...groups[group], id: `${group}-${id}` };
  }

  const catalog = [
    ...[
      [3, 3.2, 7, 0.5], [4, 4.3, 9, 0.8], [5, 5.3, 10, 1], [6, 6.4, 12, 1.6],
      [8, 8.4, 16, 1.6], [10, 10.5, 20, 2], [12, 13, 24, 2.5], [14, 15, 28, 2.5],
      [16, 17, 30, 3], [18, 19, 34, 3], [20, 21, 37, 3], [22, 23, 39, 3],
      [24, 25, 44, 4], [27, 28, 50, 4], [30, 31, 56, 4], [36, 37, 66, 5]
    ].map(([m, d, D, h]) => item('washer', `M${m}`, { d, D, h })),
    ...[
      [4, 4, 12], [5, 5, 16], [6, 6, 20], [6, 6, 25], [8, 7, 25],
      [8, 7, 32], [10, 8, 32], [10, 8, 40], [12, 8, 45], [14, 9, 50]
    ].map(([b, h, L]) => item('key', `${b}×${h}×${L}`, { b, h, L })),
    ...[
      [3, 8], [3, 12], [4, 10], [4, 16], [5, 16], [5, 20],
      [6, 20], [6, 25], [8, 25], [8, 32]
    ].map(([d, L]) => item('pin', `${d}×${L}`, { d, L })),
    ...[
      [6200, 10, 30, 9], [6201, 12, 32, 10], [6202, 15, 35, 11],
      [6203, 17, 40, 12], [6204, 20, 47, 14], [6205, 25, 52, 15]
    ].map(([size, d, D, B]) => item('bearing', String(size), { d, D, B }))
  ];

  function prism(perimeter, height, hole = []) {
    const n = perimeter.length;
    const shell = [];
    const add = (ring, z) => ring.map(([x, y]) => [x, y, z]);
    const vertices = [...add(perimeter, 0), ...add(perimeter, height), ...add(hole, 0), ...add(hole, height)];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      shell.push([i, j, j + n, i + n]);
      if (hole.length) {
        shell.push([i + n * 2, i + n * 3, j + n * 3, j + n * 2]);
        shell.push([i + n, j + n, j + n * 3, i + n * 3]);
        shell.push([j, i, i + n * 2, j + n * 2]);
      }
    }
    if (!hole.length) {
      shell.push(Array.from({ length: n }, (_, i) => n - 1 - i));
      shell.push(Array.from({ length: n }, (_, i) => n + i));
    }
    return { vertices, shell };
  }

  function ring(radius) {
    return Array.from({ length: 96 }, (_, i) => {
      const angle = 2 * Math.PI * i / 96;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    });
  }

  function partMesh(part) {
    const { b, h, L, d, D, B } = part.dims;
    switch (part.group) {
      case 'washer':
      case 'bearing':
        return prism(ring(D / 2), h ?? B, ring(d / 2));
      case 'pin':
        return prism(ring(d / 2), L);
      case 'key':
        return prism([[-L / 2, -b / 2], [L / 2, -b / 2], [L / 2, b / 2], [-L / 2, b / 2]], h);
      default:
        throw new RangeError('Неизвестный тип изделия.');
    }
  }

  function subtract(a, b) { return a.map((value, i) => value - b[i]); }

  function cross([ax, ay, az], [bx, by, bz]) {
    return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  }

  function unit(v) {
    const length = Math.hypot(...v);
    if (!(length > 0)) throw new Error('Вырожденная грань STEP.');
    return v.map(value => value / length);
  }

  function real(value) {
    const rounded = Number(value.toFixed(10));
    return (Number.isInteger(rounded) ? `${rounded}.` : rounded.toFixed(10)).replace(/(\.\d*?[1-9])0+$/, '$1');
  }

  function partStep(part) {
    const { vertices, shell } = partMesh(part);
    const entities = [];
    const add = value => {
      entities.push(value);
      return `#${entities.length}`;
    };
    const tuple = coordinates => `(${coordinates.map(real).join(',')})`;
    const point = xyz => add(`CARTESIAN_POINT('',${tuple(xyz)})`);
    const direction = xyz => add(`DIRECTION('',${tuple(xyz)})`);
    const itemRefs = ids => `(${ids.join(',')})`;
    const place = (p, axis, reference) => add(`AXIS2_PLACEMENT_3D('',${p},${axis},${reference})`);
    const partId = part.id.replace(/[^a-zA-Z0-9_-]/g, '_');

    const application = add("APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies')");
    add(`APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,${application})`);
    const productContext = add(`PRODUCT_CONTEXT('',${application},'mechanical')`);
    const product = add(`PRODUCT('${partId}','${partId}','Softneer nominal envelope',(${productContext}))`);
    const formation = add(`PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('','',${product},.NOT_KNOWN.)`);
    const definitionContext = add(`PRODUCT_DEFINITION_CONTEXT('part definition',${application},'design')`);
    const definition = add(`PRODUCT_DEFINITION('design','',${formation},${definitionContext})`);
    const productShape = add(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);
    const mm = add('(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))');
    const radians = add('(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))');
    const steradians = add('(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())');
    const tolerance = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.00001),${mm},'distance_accuracy_value','')`);
    const context = add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${tolerance})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${radians},${steradians})) REPRESENTATION_CONTEXT('','3D'))`);
    const origin = place(point([0, 0, 0]), direction([0, 0, 1]), direction([1, 0, 0]));

    const points = vertices.map(point);
    const faces = shell.map(indices => {
      const [a, b, c] = indices.map(index => vertices[index]);
      const v1 = subtract(b, a);
      const v2 = subtract(c, a);
      const axis = direction(unit(cross(v1, v2)));
      const tangent = direction(unit(v1));
      const frame = place(points[indices[0]], axis, tangent);
      const plane = add(`PLANE('',${frame})`);
      const loop = add(`POLY_LOOP('',${itemRefs(indices.map(index => points[index]))})`);
      const border = add(`FACE_OUTER_BOUND('',${loop},.T.)`);
      return add(`FACE_SURFACE('',(${border}),${plane},.T.)`);
    });
    const closed = add(`CLOSED_SHELL('',${itemRefs(faces)})`);
    const solid = add(`FACETED_BREP('${partId}',${closed})`);
    const shape = add(`FACETED_BREP_SHAPE_REPRESENTATION('',(${origin},${solid}),${context})`);
    add(`SHAPE_DEFINITION_REPRESENTATION(${productShape},${shape})`);
    return [
      'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('Faceted BREP; nominal envelopes, mm'),'2;1');",
      `FILE_NAME('${partId}.step','${new Date().toISOString().slice(0, 19)}',('Softneer'),(''),'Softneer','Softneer','');`,
      "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));", 'ENDSEC;', 'DATA;',
      ...entities.map((statement, index) => `#${index + 1}=${statement};`),
      'ENDSEC;', 'END-ISO-10303-21;', ''
    ].join('\n');
  }

  const api = { catalog, groups, partStep, partMesh };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoftneerCAD = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
