(function (root) {
  'use strict';

  const E = typeof module === 'object' && module.exports ? require('./engine') : root.SoftneerEngine;
  const powerToTorque = (power, rpm) => power * 30000 / (Math.PI * rpm);

  function check(condition, message) {
    if (!condition) throw new RangeError(message);
  }

  function number(value, label, min, max) {
    check(Number.isFinite(value) && value >= min && value <= max, `${label} — число от ${min} до ${max}.`);
    return value;
  }

  function helicalPair({ module: mn, z1, z2, angle, helix, x1, x2, width, torque, rpm }) {
    number(mn, 'Нормальный модуль, мм', 0.1, 100);
    for (const z of [z1, z2]) {
      number(z, 'Число зубьев', 8, 1000);
      check(Number.isInteger(z), 'Числа зубьев должны быть целыми.');
    }
    number(angle, 'Нормальный угол профиля, °', 15, 30);
    number(helix, 'Угол винтовой линии, °', -45, 45);
    number(x1, 'Смещение шестерни', -1, 1.5);
    number(x2, 'Смещение колеса', -1, 1.5);
    number(width, 'Ширина венца, мм', 0.1, 5000);
    number(torque, 'Момент на шестерне, Н·м', 0, 1e7);
    number(rpm, 'Обороты шестерни', 0, 1e6);
    const aN = angle * Math.PI / 180;
    const beta = helix * Math.PI / 180;
    const mt = mn / Math.cos(beta);
    const at = Math.atan(Math.tan(aN) / Math.cos(beta));
    const involute = alpha => Math.tan(alpha) - alpha;
    const awInv = involute(at) + 2 * Math.tan(aN) * (x1 + x2) / (z1 + z2);
    check(awInv > 0, 'При заданной сумме смещений рабочий угол зацепления не существует.');
    let lo = 0;
    let hi = Math.PI / 2 - 1e-8;
    for (let i = 0; i < 52; i++) {
      const mid = (lo + hi) / 2;
      if (involute(mid) < awInv) lo = mid;
      else hi = mid;
    }
    const working = (lo + hi) / 2;
    const referenceCenter = mt * (z1 + z2) / 2;
    const center = referenceCenter * Math.cos(at) / Math.cos(working);
    const y = (center - referenceCenter) / mn;
    const shortening = x1 + x2 - y;
    function gear(z, shift) {
      const radius = mt * z / 2;
      const base = radius * Math.cos(at);
      const tip = radius + mn * (1 + shift - shortening);
      const root = radius + mn * (shift - 1.25);
      check(root > 0 && tip > Math.max(root, base), 'Проверьте смещение и рабочую высоту зуба.');
      const halfTip = (Math.PI / 2 + 2 * shift * Math.tan(aN)) / z + involute(at) - involute(Math.acos(base / tip));
      check(halfTip > 0, 'Вершина одного из зубьев заострена. Измените смещения.');
      return { z, radius, base, tip, root, tipThickness: 2 * tip * halfTip, working: center * z / (z1 + z2) };
    }
    const pinion = gear(z1, x1);
    const wheel = gear(z2, x2);
    const length1 = Math.sqrt(pinion.tip ** 2 - pinion.base ** 2);
    const length2 = Math.sqrt(wheel.tip ** 2 - wheel.base ** 2);
    const contact = (length1 + length2 - center * Math.sin(working)) / (Math.PI * mt * Math.cos(at));
    const faceContact = width * Math.abs(Math.sin(beta)) / (Math.PI * mn);
    const ratio = z2 / z1;
    const ft = torque * 1000 / pinion.working;
    const workingBeta = Math.atan(Math.tan(beta) * center / referenceCenter);
    const warnings = [];
    if (length1 > center * Math.sin(working) || length2 > center * Math.sin(working)) warnings.push('Линия контакта выходит ниже основной окружности. Проверьте интерференцию.');
    if (contact + faceContact < 1) warnings.push('Суммарное перекрытие меньше 1.');
    if ([pinion, wheel].some(g => g.tipThickness < .25 * mn)) warnings.push('Торцовая толщина вершины меньше 0,25mₙ. Проверьте требование к технологической толщине.');
    return { pinion, wheel, mt, referenceCenter, center, ratio, contact, faceContact,
      transverseAngle: at * 180 / Math.PI, workingAngle: working * 180 / Math.PI,
      workingHelix: workingBeta * 180 / Math.PI,
      ft, ftReference: torque * 1000 / pinion.radius, fr: ft * Math.tan(working), fa: ft * Math.tan(workingBeta),
      outputRpm: rpm / ratio, y, shortening, warnings };
  }

  function gearbox({ rpm, power, ambient, ua, rows }) {
    number(rpm, 'Обороты входного вала', 1, 100000);
    number(power, 'Мощность на входе, кВт', 0.001, 100000);
    number(ambient, 'Температура среды', -80, 150);
    number(ua, 'Теплопередача в окружающую среду, Вт/К', 0.1, 1e7);
    check(Array.isArray(rows) && rows.length >= 1 && rows.length <= 12, 'Введите от 1 до 12 последовательных ступеней.');
    let n = rpm;
    let p = power;
    let overallRatio = 1;
    const warnings = [];
    const stages = rows.map((row, i) => {
      const efficiency = number(row.efficiency, `КПД ступени ${i + 1}`, 0.01, 1);
      const torqueIn = powerToTorque(p, n);
      let mesh;
      try { mesh = E.spurPair({ ...row, torque: torqueIn, rpm: n }); }
      catch (error) { throw new RangeError(`Ступень ${i + 1}. ${error.message}`); }
      mesh.warnings.forEach(message => warnings.push(`Ступень ${i + 1}. ${message}`));
      const powerOut = p * efficiency;
      const nOut = mesh.outputRpm;
      const torqueOut = powerToTorque(powerOut, nOut);
      overallRatio *= mesh.ratio;
      const stage = { index: i + 1, nIn: n, nOut, powerIn: p, powerOut, torqueIn, torqueOut,
        ratio: mesh.ratio, center: mesh.center, ft: mesh.ft, fr: mesh.fr, loss: p - powerOut,
        speedSign: (-1) ** (i + 1), d1: mesh.pinion.radius * 2, d2: mesh.wheel.radius * 2 };
      n = nOut;
      p = powerOut;
      return stage;
    });
    const loss = power - p;
    const temperature = ambient + 1000 * loss / ua;
    if (temperature > 100) warnings.push('Оценка установившейся температуры выше 100 °C. Проверьте охлаждение и температурный диапазон смазки.');
    return { stages, ratio: overallRatio, rpm: n, power: p, torque: powerToTorque(p, n),
      efficiency: 100 * p / power, loss, temperature, warnings };
  }

  function shaft({ span, diameter, young, torque, rpm, cA, cB, bearingType, rows }) {
    number(span, 'Расстояние между опорами, мм', 0.1, 100000);
    number(diameter, 'Диаметр вала, мм', 0.1, 10000);
    number(young, 'Модуль упругости, ГПа', 0.1, 10000);
    number(torque, 'Максимальный крутящий момент, Н·м', 0, 1e7);
    number(rpm, 'Частота вращения, об/мин', 0.01, 100000);
    number(cA, 'Грузоподъёмность опоры A, кН', 0.001, 1e6);
    number(cB, 'Грузоподъёмность опоры B, кН', 0.001, 1e6);
    check(bearingType === 'ball' || bearingType === 'roller', 'Выберите тип подшипников.');
    check(Array.isArray(rows) && rows.length >= 1 && rows.length <= 24, 'Введите от 1 до 24 сосредоточенных нагрузок.');
    const loads = rows.map(({ x, fy, fz }, i) => ({
      x: number(x, `Координата x в строке ${i + 1}`, -100000, 100000),
      fy: number(fy, `Fᵧ в строке ${i + 1}`, -1e9, 1e9),
      fz: number(fz, `F_z в строке ${i + 1}`, -1e9, 1e9)
    }));
    const inertia = Math.PI * diameter ** 4 / 64;
    const ei = 1000 * young * inertia;
    function plane(key) {
      const b = -loads.reduce((sum, load) => sum + load[key] * load.x, 0) / span;
      const a = -loads.reduce((sum, load) => sum + load[key], b);
      const points = [...loads.map(load => [load.x, load[key]]), [0, a], [span, b]];
      const response = (x, exponent) => points.reduce((sum, [pos, force]) => sum + force * Math.max(0, x - pos) ** exponent, 0);
      const y0 = response(0, 3) / 6;
      const y1 = response(span, 3) / 6;
      return { a, b, moment: x => response(x, 1),
        displacement: x => (response(x, 3) / 6 - y0 - (y1 - y0) * x / span) / ei };
    }
    const y = plane('fy');
    const z = plane('fz');
    const points = [0, span, ...loads.map(load => load.x)].sort((a, b) => a - b);
    const bendingAt = x => Math.hypot(y.moment(x), z.moment(x));
    const displacementAt = x => Math.hypot(y.displacement(x), z.displacement(x));
    const maxMoment = Math.max(...points.map(bendingAt));
    const first = points[0];
    const last = points[points.length - 1];
    const samples = [...new Set([...points, ...Array.from({ length: 161 }, (_, i) => first + (last - first) * i / 160)])].sort((a, b) => a - b);
    const curve = samples.map(x => ({ x, moment: bendingAt(x) / 1000, dy: y.displacement(x), dz: z.displacement(x) }));
    const peak = samples.reduce((best, x) => displacementAt(x) > displacementAt(best) ? x : best, 0);
    const bendingStress = 32 * maxMoment / (Math.PI * diameter ** 3);
    const shear = 16000 * torque / (Math.PI * diameter ** 3);
    const fa = Math.hypot(y.a, z.a);
    const fb = Math.hypot(y.b, z.b);
    const exponent = bearingType === 'ball' ? 3 : 10 / 3;
    const life = (c, f) => f > 0 ? (c * 1000 / f) ** exponent * 1e6 / (60 * rpm) : Infinity;
    const warnings = [];
    if (fa > cA * 500 || fb > cB * 500) warnings.push('На одной из опор P > C/2. Проверьте статическую нагрузку и диапазон модели изготовителя.');
    return { ay: y.a, az: z.a, by: y.b, bz: z.b, fa, fb, bending: maxMoment / 1000,
      deflection: displacementAt(peak), peak, bendingStress, shear, stress: Math.hypot(bendingStress, Math.sqrt(3) * shear),
      lifeA: life(cA, fa), lifeB: life(cB, fb), curve, warnings };
  }

  function toothStrength(input) {
    const {
      ft, diameter, width, module, ratio, ka, kv, khb, kha, kfb, kfa, zh, ze, zeps, zbeta, ybeta, sh, sf, rows
    } = input;
    for (const [label, value, min, max] of [
      ['Fₜ, Н', ft, 0.001, 1e9], ['d₁, мм', diameter, 0.1, 1e4],
      ['b, мм', width, 0.1, 1e4], ['mₙ, мм', module, 0.1, 1000], ['u = z₂/z₁', ratio, 0.01, 100],
      ['K_A', ka, 0.01, 100], ['K_V', kv, 0.01, 100], ['K_Hβ', khb, 0.01, 100], ['K_Hα', kha, 0.01, 100],
      ['K_Fβ', kfb, 0.01, 100], ['K_Fα', kfa, 0.01, 100], ['Z_H', zh, 0.01, 100], ['Z_E', ze, 0.01, 1000],
      ['Z_ε', zeps, 0.01, 10], ['Z_β', zbeta, 0.01, 10], ['Y_β', ybeta, 0.01, 10],
      ['Требуемый S_H', sh, 0.1, 100], ['Требуемый S_F', sf, 0.1, 100]
    ]) number(value, label, min, max);
    check(Array.isArray(rows) && rows.length === 2, 'Задайте коэффициенты отдельно для шестерни и колеса.');
    const kh = ka * kv * khb * kha;
    const kf = ka * kv * kfb * kfa;
    const contactBase = zh * ze * zeps * zbeta * Math.sqrt(ft / (diameter * width) * (ratio + 1) / ratio);
    const rootBase = ft / (width * module) * ybeta;
    const gears = rows.map(({ zsingle, yf, ys, yb, ydt, contactLimit, rootLimit }, i) => {
      const gear = i === 0 ? 'Шестерня' : 'Колесо';
      for (const [key, value] of [['Z_B / Z_D', zsingle], ['Y_F', yf], ['Y_S', ys], ['Y_B', yb], ['Y_DT', ydt]]) {
        number(value, `${gear}, ${key}`, 0.01, 100);
      }
      number(contactLimit, `${gear}, σ_HG`, 1, 10000);
      number(rootLimit, `${gear}, σ_FG`, 1, 10000);
      const contact = contactBase * Math.sqrt(kh) * zsingle;
      const root = rootBase * yf * ys * yb * ydt * kf;
      return { gear, contact, root, contactSafety: contactLimit / contact, rootSafety: rootLimit / root };
    });
    const contactSafety = Math.min(...gears.map(gear => gear.contactSafety));
    const rootSafety = Math.min(...gears.map(gear => gear.rootSafety));
    const warnings = [];
    if (contactSafety < sh) warnings.push('Минимальный запас по контактной выносливости ниже требуемого.');
    if (rootSafety < sf) warnings.push('Минимальный запас по изгибу ниже требуемого.');
    return { gears, contactSafety, rootSafety, kh, kf, contactBase, rootBase, warnings };
  }

  const api = { helicalPair, gearbox, shaft, toothStrength };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoftneerDrivetrain = api;
})(globalThis);
