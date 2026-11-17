(function (root) {
  'use strict';

  const TAU = 2 * Math.PI;
  const rad = degrees => degrees * Math.PI / 180;
  const inv = angle => Math.tan(angle) - angle;
  const polar = (radius, angle) => [radius * Math.cos(angle), radius * Math.sin(angle)];

  function requireValue(condition, message) {
    if (!condition) throw new RangeError(message);
  }

  function bounded(value, min, max, name, integer = false) {
    requireValue(Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)),
      `${name}: ${integer ? 'целое число' : 'число'} от ${min} до ${max}.`);
    return value;
  }

  function gearDimensions(m, z, alpha) {
    const radius = m * z / 2;
    return {
      z, radius, base: radius * Math.cos(alpha),
      tip: radius + m, root: radius - 1.25 * m
    };
  }

  function spurPair({ module: m, z1, z2, angle, torque, rpm }) {
    bounded(m, 0.1, 100, 'Модуль');
    bounded(z1, 8, 200, 'Число зубьев шестерни', true);
    bounded(z2, 8, 200, 'Число зубьев колеса', true);
    bounded(angle, 15, 30, 'Угол профиля');
    bounded(torque, 0, 1e7, 'Крутящий момент');
    bounded(rpm, 0, 1e6, 'Частота вращения');
    const alpha = rad(angle);
    const pinion = gearDimensions(m, z1, alpha);
    const wheel = gearDimensions(m, z2, alpha);
    const center = pinion.radius + wheel.radius;
    const approach = Math.sqrt(wheel.tip ** 2 - wheel.base ** 2) - wheel.radius * Math.sin(alpha);
    const recess = Math.sqrt(pinion.tip ** 2 - pinion.base ** 2) - pinion.radius * Math.sin(alpha);
    const ratio = z2 / z1;
    const ft = torque * 1000 / pinion.radius;
    const undercutLimit = 2 / Math.sin(alpha) ** 2;
    const warnings = [];
    if (Math.min(z1, z2) < undercutLimit) warnings.push(
      `Есть риск подрезания при нарезании рейкой. Теоретическое условие при x = 0 — z ≥ ${Math.ceil(undercutLimit)}.`);
    if (approach > pinion.radius * Math.sin(alpha) || recess > wheel.radius * Math.sin(alpha)) {
      warnings.push('Расчётная линия контакта выходит за пределы одной из основных окружностей. Проверьте интерференцию.');
    }
    const contact = (approach + recess) / (Math.PI * m * Math.cos(alpha));
    if (contact < 1) warnings.push('Расчётный коэффициент перекрытия меньше 1.');
    return { m, alpha, pinion, wheel, center, ratio, contact, ft, fr: ft * Math.tan(alpha),
      outputRpm: rpm / ratio, pitchSpeed: TAU * pinion.radius * rpm / 60000, warnings };
  }

  function gearOutline({ z, base, tip, root: rootRadius }, alpha) {
    const pitch = TAU / z;
    const halfAtPitch = pitch / 4;
    const flankAngle = radius => {
      const pressure = Math.acos(Math.min(1, base / radius));
      return halfAtPitch + inv(alpha) - inv(pressure);
    };
    const startRadius = Math.max(base, rootRadius);
    const startAngle = flankAngle(startRadius);
    const tipAngle = flankAngle(tip);
    requireValue(tipAngle > 0 && startAngle < pitch / 2, 'Для этих параметров невозможно построить зуб с положительной толщиной вершины и впадины.');
    const points = [];
    const flankSegments = 18;
    for (let tooth = 0; tooth < z; tooth++) {
      const center = tooth * pitch;
      if (startRadius > rootRadius) points.push(polar(rootRadius, center - startAngle));
      for (let i = 0; i <= flankSegments; i++) {
        const radius = startRadius + (tip - startRadius) * i / flankSegments;
        points.push(polar(radius, center - flankAngle(radius)));
      }
      for (let i = 1; i < 6; i++) points.push(polar(tip, center - tipAngle + 2 * tipAngle * i / 6));
      for (let i = flankSegments; i >= 0; i--) {
        const radius = startRadius + (tip - startRadius) * i / flankSegments;
        points.push(polar(radius, center + flankAngle(radius)));
      }
      if (startRadius > rootRadius) points.push(polar(rootRadius, center + startAngle));
      for (let i = 1; i < 6; i++) {
        points.push(polar(rootRadius, center + startAngle + (pitch - 2 * startAngle) * i / 6));
      }
    }
    return points;
  }

  function gearDxf(points, label, secondOutline) {
    const pairs = [0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1015', 9, '$INSUNITS', 70, 4,
      9, '$MEASUREMENT', 70, 1, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES'];
    for (const outline of secondOutline ? [points, secondOutline] : [points]) {
      requireValue(outline.length >= 3, 'Для экспорта нужен замкнутый контур.');
      pairs.push(0, 'LWPOLYLINE', 100, 'AcDbEntity', 8, '0', 100, 'AcDbPolyline', 90, outline.length, 70, 1);
      for (const [x, y] of outline) pairs.push(10, x.toFixed(7), 20, y.toFixed(7));
    }
    pairs.push(999, label, 0, 'ENDSEC', 0, 'EOF');
    return pairs.join('\r\n') + '\r\n';
  }

  // Upper ends of the size steps are inclusive. Deviations and IT widths are in µm.
  const sizeSteps = [
    [3, 6, 10, 14, -2, 0], [6, 8, 12, 18, -4, 1], [10, 9, 15, 22, -5, 1],
    [18, 11, 18, 27, -6, 1], [30, 13, 21, 33, -7, 2], [50, 16, 25, 39, -9, 2],
    [80, 19, 30, 46, -10, 2], [120, 22, 35, 54, -12, 3],
    [180, 25, 40, 63, -14, 3], [250, 29, 46, 72, -15, 4],
    [315, 32, 52, 81, -17, 4], [400, 36, 57, 89, -18, 4], [500, 40, 63, 97, -20, 5]
  ];

  function fitLimits({ diameter, hole, shaft }) {
    bounded(diameter, 1, 500, 'Номинальный размер');
    const [limit, it6, it7, it8, g, k] = sizeSteps.find(([end]) => diameter <= end);
    const holeWidth = { H6: it6, H7: it7, H8: it8 }[hole];
    const shaftRange = { h6: [-it6, 0], h7: [-it7, 0], g6: [g - it6, g],
      js6: [-it6 / 2, it6 / 2], k6: [k, k + it6] }[shaft];
    requireValue(typeof holeWidth === 'number' && Array.isArray(shaftRange), 'Выберите поддерживаемые поля допуска.');
    return { ...fitFromDeviations({ diameter, eiHole: 0, esHole: holeWidth, eiShaft: shaftRange[0], esShaft: shaftRange[1] }),
      from: sizeSteps[sizeSteps.findIndex(([end]) => limit === end) - 1]?.[0] ?? 1, to: limit };
  }

  function fitFromDeviations({ diameter, eiHole, esHole, eiShaft, esShaft }) {
    bounded(diameter, 0.001, 100000, 'Номинальный размер');
    for (const deviation of [eiHole, esHole, eiShaft, esShaft]) bounded(deviation, -1e6, 1e6, 'Отклонение');
    requireValue(esHole >= eiHole && esShaft >= eiShaft, 'Верхние отклонения должны быть не меньше нижних.');
    requireValue(diameter + Math.min(eiHole, eiShaft) / 1000 > 0, 'Предельные размеры должны быть больше нуля.');
    const min = eiHole - esShaft;
    const max = esHole - eiShaft;
    const type = min >= 0 && max > 0 ? 'С зазором' : max <= 0 && min < 0 ? 'С натягом' :
      min === 0 && max === 0 ? 'Нулевой зазор' : 'Переходная';
    return {
      diameter, min, max, type, hole: [eiHole, esHole], shaft: [eiShaft, esShaft],
      holeLimits: [diameter + eiHole / 1000, diameter + esHole / 1000],
      shaftLimits: [diameter + eiShaft / 1000, diameter + esShaft / 1000]
    };
  }

  function bearingLife({ type, dynamic, load, rpm, target }) {
    requireValue(type === 'ball' || type === 'roller', 'Выберите тип подшипника.');
    bounded(dynamic, 0.001, 1e7, 'Грузоподъёмность C');
    bounded(load, 0.001, 1e7, 'Нагрузка P');
    bounded(rpm, 0.01, 1e6, 'Частота вращения');
    bounded(target, 1, 1e8, 'Требуемый ресурс');
    const exponent = type === 'ball' ? 3 : 10 / 3;
    const revolutions = (dynamic / load) ** exponent * 1e6;
    return { revolutions, hours: revolutions / (60 * rpm), exponent,
      required: load * (target * 60 * rpm / 1e6) ** (1 / exponent),
      warnings: load > dynamic / 2 ? ['P > C/2. Проверьте у изготовителя область применимости расчёта и статическую грузоподъёмность.'] : [] };
  }

  function splineLoad({ torque, diameter, length, height, teeth, sharing, allowed }) {
    bounded(torque, 0, 1e7, 'Крутящий момент');
    bounded(diameter, 1, 5000, 'Расчётный диаметр');
    bounded(length, 0.1, 5000, 'Рабочая длина');
    bounded(height, 0.01, 500, 'Рабочая высота');
    bounded(teeth, 2, 200, 'Число зубьев', true);
    bounded(sharing, 0.05, 1, 'Коэффициент участия зубьев');
    bounded(allowed, 0.1, 5000, 'Допускаемое давление');
    requireValue(height < diameter / 2, 'Рабочая высота должна быть меньше расчётного радиуса.');
    const force = 2000 * torque / diameter;
    const area = length * height * teeth * sharing;
    const pressure = force / area;
    return { force, area, pressure, margin: pressure === 0 ? Infinity : allowed / pressure,
      torqueLimit: allowed * area * diameter / 2000 };
  }

  function minerDamage({ blockHours, rows }) {
    bounded(blockHours, 0.001, 1e8, 'Продолжительность блока');
    requireValue(Array.isArray(rows) && rows.length > 0 && rows.length <= 24, 'Введите от 1 до 24 ступеней нагружения.');
    const contributions = rows.map(({ cycles, capacity }, i) => {
      bounded(cycles, 0, 1e15, `Циклы nᵢ в строке ${i + 1}`);
      bounded(capacity, 1, 1e15, `Циклы Nᵢ в строке ${i + 1}`);
      return cycles / capacity;
    });
    const damage = contributions.reduce((sum, item) => sum + item, 0);
    requireValue(damage > 0, 'Задайте ненулевое число циклов хотя бы в одной ступени.');
    return { damage, blocks: 1 / damage, hours: blockHours / damage, contributions,
      warnings: damage >= 1 ? ['Расчётное повреждение достигает 1 в пределах первого блока.'] : [] };
  }

  function toleranceStack(rows) {
    requireValue(Array.isArray(rows) && rows.length > 0 && rows.length <= 24, 'Задайте от 1 до 24 звеньев цепи.');
    const result = { nominal: 0, min: 0, max: 0 };
    rows.forEach(({ sign, nominal, lower, upper }, i) => {
      requireValue(sign === 1 || sign === -1, `Выберите направление звена ${i + 1}.`);
      bounded(nominal, 0, 1e6, `Номинал звена ${i + 1}`);
      bounded(lower, -1e5, 1e5, `Нижнее отклонение звена ${i + 1}`);
      bounded(upper, -1e5, 1e5, `Верхнее отклонение звена ${i + 1}`);
      requireValue(lower <= upper && nominal + lower >= 0, `Проверьте предельные размеры звена ${i + 1}.`);
      result.nominal += sign * nominal;
      result.min += sign * (nominal + (sign === 1 ? lower : upper));
      result.max += sign * (nominal + (sign === 1 ? upper : lower));
    });
    result.width = result.max - result.min;
    return result;
  }

  function sliderCrank({ radius, rod, rpm, theta }) {
    bounded(radius, 0.1, 5000, 'Радиус кривошипа');
    bounded(rod, 0.1, 50000, 'Длина шатуна');
    bounded(rpm, 0, 1e5, 'Частота вращения');
    bounded(theta, 0, 360, 'Угол кривошипа');
    requireValue(rod > radius, 'Длина шатуна должна быть больше радиуса кривошипа.');
    const t = rad(theta);
    const w = rpm * TAU / 60;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const q = Math.sqrt(rod ** 2 - (radius * s) ** 2);
    const x = radius * c + q;
    const dx = -radius * s - radius ** 2 * s * c / q;
    const ddx = -radius * c - radius ** 2 * (c ** 2 - s ** 2) / q - radius ** 4 * (s * c) ** 2 / q ** 3;
    return { x, velocity: dx * w, acceleration: ddx * w ** 2, stroke: radius * 2, pinX: radius * c, pinY: radius * s };
  }

  function hydraulics({ bore, rod, pressure, flow, efficiency, direction }) {
    bounded(bore, 1, 5000, 'Диаметр поршня');
    bounded(rod, 0.01, 4999, 'Диаметр штока');
    bounded(pressure, 0, 1000, 'Перепад давления');
    bounded(flow, 0, 1e6, 'Расход');
    bounded(efficiency, 0.01, 1, 'Механический КПД');
    requireValue(rod < bore, 'Диаметр штока должен быть меньше диаметра поршня.');
    requireValue(direction === 'out' || direction === 'in', 'Выберите направление хода.');
    const area = Math.PI / 4 * (bore ** 2 - (direction === 'in' ? rod ** 2 : 0));
    return { area, force: pressure * area * efficiency, speed: flow * 1e6 / (60 * area), power: pressure * flow / 60 };
  }

  const api = { spurPair, gearOutline, gearDxf, fitLimits, fitFromDeviations, bearingLife, splineLoad,
    minerDamage, toleranceStack, sliderCrank, hydraulics, polar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoftneerEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
