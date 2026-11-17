(function (root) {
  'use strict';

  const E = root.SoftneerEngine;
  const dark = '#102338';
  const ink = '#b9d3ec';
  const muted = '#8eaecb';
  const orange = '#ffb36e';
  const blue = '#70c2fa';
  const fmt = (n, digits = 2) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n);

  function line(ctx, points, color, width = 1, dash = []) {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function circle(ctx, x, y, radius, color, dash = [], fill) {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.lineWidth = 1;
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function label(ctx, text, x, y, color = ink, align = 'left', size = 11) {
    ctx.font = `${size}px "IBM Plex Mono", SFMono-Regular, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function polygon(ctx, points, stroke, fill) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  function background(ctx, width, height, spacing = 20) {
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, width, height);
    for (let x = width / 2 % spacing, i = 0; x < width; x += spacing, i++) {
      line(ctx, [[x, 0], [x, height]], i % 5 === 0 ? '#263f58' : '#1b3149', 0.65);
    }
    for (let y = height / 2 % spacing, i = 0; y < height; y += spacing, i++) {
      line(ctx, [[0, y], [width, y]], i % 5 === 0 ? '#263f58' : '#1b3149', 0.65);
    }
  }

  function drawCanvas(canvas, paint) {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(box.width * dpr);
    const pixelHeight = Math.round(box.height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    background(ctx, box.width, box.height);
    paint(ctx, box.width, box.height);
  }

  function dimension(ctx, x1, x2, y, toY, text) {
    const shade = '#a6c6e2';
    line(ctx, [[x1, toY], [x1, y + 4]], '#6787a6');
    line(ctx, [[x2, toY], [x2, y + 4]], '#6787a6');
    line(ctx, [[x1, y], [x2, y]], shade);
    line(ctx, [[x1 + 6, y - 3], [x1, y], [x1 + 6, y + 3]], shade);
    line(ctx, [[x2 - 6, y - 3], [x2, y], [x2 - 6, y + 3]], shade);
    label(ctx, text, (x1 + x2) / 2, y - 7, shade, 'center');
  }

  function gearPlot(ctx, width, height, r, view, profiles) {
    const { pinion, wheel, center } = r;
    const single = view !== 'pair';
    const gear = view === 'wheel' ? wheel : pinion;
    const left = single ? -gear.tip : -pinion.tip;
    const right = single ? gear.tip : center + wheel.tip;
    const maxRadius = single ? gear.tip : Math.max(pinion.tip, wheel.tip);
    const scale = Math.min((width - 50) / (right - left), (height - 78) / (2 * maxRadius));
    const offset = width / 2 - (left + right) * scale / 2;
    const y = height / 2 - 4;
    line(ctx, [[21, y], [width - 21, y]], '#698cac', 0.8, [11, 4, 2, 4]);

    function drawGear(data, points, x, rotation, color) {
      line(ctx, [[x, 26], [x, height - 37]], '#517190', 0.8, [11, 4, 2, 4]);
      if (points) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        polygon(ctx, points.map(([px, py]) => [x + scale * (px * cos - py * sin), y - scale * (px * sin + py * cos)]),
          color, color === orange ? '#553c39bb' : '#244a69bb');
      }
      circle(ctx, x, y, data.radius * scale, color, [6, 4]);
      circle(ctx, x, y, data.base * scale, '#7999b7', [2, 4]);
      circle(ctx, x, y, Math.max(5, data.radius * scale * .24), '#577c9b', [], '#11263b');
      line(ctx, [[x - 6, y], [x + 6, y]], '#abc3d8');
      line(ctx, [[x, y - 6], [x, y + 6]], '#abc3d8');
    }
    if (single) {
      drawGear(gear, profiles[view], offset, 0, view === 'wheel' ? blue : orange);
      dimension(ctx, offset - gear.radius * scale, offset + gear.radius * scale, height - 19, y + maxRadius * scale + 5, `d = ${fmt(gear.radius * 2)} мм`);
      return;
    }
    const x1 = offset;
    const x2 = offset + center * scale;
    drawGear(pinion, profiles.pinion, x1, 0, orange);
    drawGear(wheel, profiles.wheel, x2, Math.PI - Math.PI / wheel.z, blue);
    const pitchX = x1 + pinion.radius * scale;
    circle(ctx, pitchX, y, 3, orange, [], orange);
    dimension(ctx, x1, x2, height - 19, y + maxRadius * scale + 4, `a = ${fmt(center)} мм`);
    label(ctx, `z₁ = ${pinion.z}`, x1, 31, orange, 'center');
    label(ctx, `z₂ = ${wheel.z}`, x2, 31, blue, 'center');
  }

  function intervalPlot(ctx, w, h, rows, unit) {
    const endpoints = rows.flatMap(row => [row.lo, row.hi]);
    const span = Math.max(1e-8, Math.max(...endpoints) - Math.min(...endpoints));
    const min = Math.min(...endpoints) - span * .18;
    const max = Math.max(...endpoints) + span * .18;
    const left = w < 360 ? 35 : 55;
    const x = value => left + (value - min) / (max - min) * (w - left - 22);
    const axis = h - 40;
    line(ctx, [[left, axis], [w - 22, axis]], '#92b0c9');
    for (let i = 0; i <= 4; i++) {
      const value = min + (max - min) * i / 4;
      line(ctx, [[x(value), axis - 5], [x(value), axis + 5]], '#92b0c9');
      label(ctx, fmt(value, 2), x(value), axis + 20, muted, 'center', 10);
    }
    if (min < 0 && max > 0) line(ctx, [[x(0), 37], [x(0), axis]], '#89a9c7', 0.85, [4, 4]);
    rows.forEach(({ name, lo, hi, color }, i) => {
      const y = 55 + ((h - 119) / rows.length) * (i + .5);
      label(ctx, name, left, y - 13, ink);
      line(ctx, [[x(lo), y], [x(hi), y]], color, 10);
      circle(ctx, x(lo), y, 4.5, color, [], dark);
      circle(ctx, x(hi), y, 4.5, color, [], dark);
      const close = Math.abs(x(hi) - x(lo)) < 68;
      label(ctx, fmt(lo, 4), x(lo) - (close ? 8 : 0), y + 24, color, close ? 'right' : 'center');
      if (hi !== lo) label(ctx, fmt(hi, 4), x(hi) + (close ? 8 : 0), y + 24, color, close ? 'left' : 'center');
    });
    label(ctx, unit, w - 17, h - 7, muted, 'right', 10);
  }

  function motionPlot(ctx, w, h, r, input) {
    const scale = Math.min((w - 90) / (2 * input.radius + input.rod), (h - 100) / (2 * input.radius));
    const x = w / 2 - input.rod * scale / 2;
    const y = h / 2;
    const pin = [x + r.pinX * scale, y - r.pinY * scale];
    const slider = [x + r.x * scale, y];
    const railStart = x + (input.rod - input.radius) * scale - 21;
    const railEnd = x + (input.rod + input.radius) * scale + 21;
    line(ctx, [[16, y], [w - 16, y]], '#6587a6', 1, [9, 4, 2, 4]);
    line(ctx, [[railStart, y - 15], [railEnd, y - 15]], blue);
    line(ctx, [[railStart, y + 15], [railEnd, y + 15]], blue);
    circle(ctx, x, y, input.radius * scale, '#6688a7', [4, 4]);
    line(ctx, [[x, y], pin], orange, 5);
    line(ctx, [pin, slider], blue, 5);
    ctx.fillStyle = '#315b7d';
    ctx.fillRect(slider[0] - 13, y - 12, 26, 24);
    ctx.strokeStyle = blue;
    ctx.strokeRect(slider[0] - 13, y - 12, 26, 24);
    circle(ctx, x, y, 5, orange, [], dark);
    circle(ctx, ...pin, 5, orange, [], dark);
    circle(ctx, ...slider, 4, blue, [], dark);
    dimension(ctx, x, slider[0], h - 19, y + 21, `x = ${fmt(r.x)} мм`);
  }

  function bearingPlot(ctx, w, h, r, input) {
    const pad = { left: 53, top: 54, right: 31, bottom: 47 };
    const exponent = r.exponent;
    const range = [.6, 1.6];
    const high = r.hours / range[0] ** exponent;
    const px = v => pad.left + (v - range[0]) / (range[1] - range[0]) * (w - pad.left - pad.right);
    const py = v => h - pad.bottom - v / high * (h - pad.top - pad.bottom);
    line(ctx, [[pad.left, pad.top], [pad.left, py(0)], [w - pad.right, py(0)]], '#8ca9c4');
    for (let i = 0; i <= 4; i++) {
      const factor = range[0] + i / 4;
      label(ctx, fmt(factor * input.load, 2), px(factor), h - 24, muted, 'center', 10);
    }
    label(ctx, 'P, кН', w - 14, h - 7, muted, 'right', 10);
    label(ctx, 'L₁₀h, ч', pad.left, pad.top - 12, muted, 'left', 10);
    line(ctx, Array.from({ length: 51 }, (_, i) => {
      const f = range[0] + i / 50;
      return [px(f), py(r.hours / f ** exponent)];
    }), blue, 2);
    line(ctx, [[px(1), py(0)], [px(1), py(r.hours)]], '#7095b5', 1, [4, 3]);
    circle(ctx, px(1), py(r.hours), 4, orange, [], orange);
    label(ctx, `${fmt(r.hours, 1)} ч`, px(1) + 8, py(r.hours) - 9, orange);
  }

  function damagePlot(ctx, w, h, r) {
    const base = h - 39;
    const barArea = w - 74;
    const gap = barArea / r.contributions.length;
    const bar = Math.min(39, gap * .67);
    const max = Math.max(...r.contributions);
    line(ctx, [[37, base], [w - 37, base]], '#8ca9c4');
    r.contributions.forEach((n, i) => {
      const x = 37 + gap * (i + .5);
      const height = (h - 103) * n / max;
      ctx.fillStyle = n === max ? orange : blue;
      ctx.fillRect(x - bar / 2, base - height, bar, height);
      if (gap >= 17) label(ctx, String(i + 1), x, base + 16, muted, 'center', 10);
      if (gap >= 60) label(ctx, fmt(n, 5), x, base - height - 7, ink, 'center', 10);
    });
    label(ctx, 'Ступень nᵢ/Nᵢ', w - 15, h - 7, muted, 'right', 10);
  }

  function splinePlot(ctx, w, h, r, input) {
    const x = w / 2;
    const y = h / 2 - 3;
    const radius = Math.min(w, h) * .29;
    const pitch = 2 * Math.PI / input.teeth;
    const points = [];
    for (let i = 0; i < input.teeth; i++) {
      for (const [offset, f] of [[-.5, .81], [-.27, .81], [-.22, 1], [.22, 1], [.27, .81]]) {
        const [px, py] = E.polar(radius * f, pitch * (i + offset));
        points.push([x + px, y + py]);
      }
    }
    polygon(ctx, points, blue, '#284968');
    circle(ctx, x, y, radius * .9, orange, [6, 4]);
    circle(ctx, x, y, radius * .55, '#6183a6', [], dark);
    label(ctx, `p = ${fmt(r.pressure)} МПа`, x, y + 4, orange, 'center');
    label(ctx, `z = ${input.teeth} · ψ = ${fmt(input.sharing)}`, x, h - 20, ink, 'center');
  }

  function cylinderPlot(ctx, w, h, r, input) {
    const y = h / 2;
    const x1 = w * .13;
    const x2 = w * .74;
    const piston = w * .43;
    const half = Math.min(52, h * .18);
    const rod = Math.max(3, half * input.rod / input.bore);
    const push = input.direction === 'out';
    ctx.fillStyle = '#2a526f';
    ctx.fillRect(push ? x1 : piston, y - half, push ? piston - x1 : x2 - piston, half * 2);
    ctx.strokeStyle = blue;
    ctx.strokeRect(x1, y - half, x2 - x1, half * 2);
    ctx.fillStyle = '#8fb4d2';
    ctx.fillRect(piston - 4, y - half, 8, half * 2);
    ctx.fillRect(piston, y - rod, w * .17 + x2 - piston, rod * 2);
    const dimA = push ? x2 : w - 18;
    const dimB = push ? w - 18 : x2;
    line(ctx, [[dimA, y - half - 16], [dimB, y - half - 16]], orange, 2);
    line(ctx, [[dimB - (push ? 7 : -7), y - half - 21], [dimB, y - half - 16], [dimB - (push ? 7 : -7), y - half - 11]], orange, 2);
    label(ctx, `F = ${fmt(r.force / 1000)} кН`, (dimA + dimB) / 2, y - half - 30, orange, 'right');
    label(ctx, `D = ${fmt(input.bore)} мм`, x1, y + half + 20, ink);
    label(ctx, `d = ${fmt(input.rod)} мм`, x2, y + half + 20, ink, 'right');
  }

  function plot(canvas, id, result, input, options = {}) {
    drawCanvas(canvas, (ctx, w, h) => {
      if (!result) {
        label(ctx, 'Проверьте входные параметры', w / 2, h / 2, ink, 'center');
        return;
      }
      switch (id) {
        case 'gear': gearPlot(ctx, w, h, result, options.view, options.profiles); break;
        case 'fits': intervalPlot(ctx, w, h, [
          { name: 'Отверстие', lo: result.hole[0], hi: result.hole[1], color: blue },
          { name: 'Вал', lo: result.shaft[0], hi: result.shaft[1], color: orange }
        ], 'мкм'); break;
        case 'stack': intervalPlot(ctx, w, h, [
          { name: 'Замыкающее звено', lo: result.min, hi: result.max, color: blue },
          { name: 'Номинал', lo: result.nominal, hi: result.nominal, color: orange }
        ], 'мм'); break;
        case 'motion': motionPlot(ctx, w, h, result, input); break;
        case 'bearing': bearingPlot(ctx, w, h, result, input); break;
        case 'fatigue': damagePlot(ctx, w, h, result); break;
        case 'spline': splinePlot(ctx, w, h, result, input); break;
        case 'hydraulic': cylinderPlot(ctx, w, h, result, input); break;
      }
    });
  }

  function catalogPreview(canvas, part) {
    drawCanvas(canvas, (ctx, w, h) => {
      const { vertices, shell } = root.SoftneerCAD.partMesh(part);
      const project = ([x, y, z]) => [x * .86 - y * .5, (x * .5 + y * .86) * .43 - z * .88, (x * .5 + y * .86) * .88 + z * .43];
      const positions = vertices.map(project);
      const xs = positions.map(p => p[0]);
      const ys = positions.map(p => p[1]);
      const mid = array => (Math.max(...array) + Math.min(...array)) / 2;
      const span = array => Math.max(...array) - Math.min(...array);
      const scale = Math.min((w - 30) / span(xs), (h - 24) / span(ys));
      const center = [mid(xs), mid(ys)];
      const projected = positions.map(([x, y]) => [w / 2 + (x - center[0]) * scale, h / 2 + (y - center[1]) * scale]);
      const depth = face => face.reduce((sum, k) => sum + positions[k][2], 0) / face.length;
      const sorted = [...shell].sort((a, b) => depth(a) - depth(b));
      for (const points of sorted) {
        const flat = points.every(i => vertices[i][2] === vertices[points[0]][2]);
        const fill = flat ? '#386385' : '#294962';
        polygon(ctx, points.map(i => projected[i]), fill, fill);
      }
      const { group, dims } = part;
      const n = group === 'key' ? 4 : 96;
      const drawRing = start => {
        const points = projected.slice(start, start + n);
        line(ctx, [...points, points[0]], blue, 1);
      };
      drawRing(n);
      if (dims.D) drawRing(3 * n);
      if (group === 'key') {
        drawRing(0);
        for (let i = 0; i < 4; i++) line(ctx, [projected[i], projected[i + 4]], '#548bb6');
      }
    });
  }

  function chart(canvas, spec) {
    drawCanvas(canvas, (ctx, w, h) => {
      const { bars, series = [], point, integerX } = spec;
      const coordinates = bars ? bars.map((bar, i) => [i, bar.value]) : series.flatMap(([, points]) => points);
      const lo = bars ? -.5 : Math.min(...coordinates.map(([x]) => x));
      const hi = bars ? bars.length - .5 : Math.max(...coordinates.map(([x]) => x));
      const values = [...coordinates.map(([, y]) => y), ...(bars ? [0] : []), ...(spec.minY !== undefined ? [spec.minY] : [])];
      const low = Math.min(...values);
      const high = Math.max(...values);
      const bottom = h - 42;
      const left = w < 360 ? 50 : 61;
      const right = w - 25;
      const top = 49;
      const height = high > low ? (high - low) * 1.09 : Math.max(1e-7, Math.abs(high) * .15);
      const px = value => left + (value - lo) / Math.max(1e-9, hi - lo) * (right - left);
      const py = value => bottom - (value - low) / height * (bottom - top);
      const shades = [blue, orange, '#95deb5', '#c8a6f0'];
      const formatTick = value => Math.abs(value) >= 1e4 || (value !== 0 && Math.abs(value) < .01)
        ? value.toExponential(1).replace('.', ',') : fmt(value, 2);

      for (let i = 0; i <= 4; i++) {
        const value = low + (high - low) * i / 4;
        if (high === low && i > 0) break;
        line(ctx, [[left, py(value)], [right, py(value)]], '#42617b', .75, [4, 4]);
        label(ctx, formatTick(value), left - 6, py(value) + 3, muted, 'right', 9);
      }
      line(ctx, [[left, top], [left, bottom], [right, bottom]], '#7b9cba', .9);
      label(ctx, spec.y, left, top - 9, ink);

      if (bars) {
        const spacing = (right - left) / bars.length;
        const width = Math.max(3, Math.min(spacing * .63, 53));
        const axis = py(0);
        if (low < 0) line(ctx, [[left, axis], [right, axis]], '#7b9cba', .85);
        bars.forEach(({ label: name, value }, i) => {
          const color = shades[i % shades.length];
          const y = py(value);
          ctx.fillStyle = color;
          ctx.fillRect(px(i) - width / 2, Math.min(y, axis), width, Math.max(1, Math.abs(axis - y)));
          if (spacing >= 19) {
            const limit = Math.max(2, Math.floor(spacing / 6.1));
            label(ctx, name.length > limit ? name.slice(0, limit - 1) + '…' : name, px(i), bottom + 16, ink, 'center', 9);
          }
          if (spacing >= 44) label(ctx, formatTick(value), px(i), value >= 0 ? y - 5 : y + 12, color, 'center', 9);
        });
      } else {
        const ticks = integerX ? Math.max(1, hi - lo) : w < 350 ? 3 : 4;
        for (let i = 0; i <= ticks; i++) {
          if (integerX && ticks > 6 && i % 2 && i !== ticks) continue;
          const value = lo + (hi - lo) * i / ticks;
          line(ctx, [[px(value), bottom], [px(value), bottom + 4]], '#7b9cba');
          label(ctx, formatTick(value), px(value), bottom + 16, muted, 'center', 9);
        }
        let legend = left + 62;
        series.forEach(([name, points], index) => {
          const color = shades[index % shades.length];
          const plotted = points.map(([x, y]) => [px(x), py(y)]);
          line(ctx, plotted, color, 2);
          if (integerX) plotted.forEach(([x, y]) => circle(ctx, x, y, 3, color, [], dark));
          if (series.length > 1) {
            label(ctx, name, legend, top - 9, color, 'left', 10);
            legend += name.length * 6.8 + 12;
          }
        });
        if (point) circle(ctx, px(point[0]), py(point[1]), 4, '#fff2df', [], orange);
        label(ctx, spec.x, right, h - 10, ink, 'right', 9);
      }
    });
  }

  root.SoftneerDraw = { plot, catalogPreview, chart };
})(globalThis);
