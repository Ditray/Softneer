(function (root) {
  'use strict';

  const G = 9.80665;
  const area = diameter => Math.PI / 4 * (diameter / 1000) ** 2;
  const flowSI = litres => litres / 60000;

  function check(condition, message) {
    if (!condition) throw new RangeError(message);
  }

  function number(value, label, min, max, integer = false) {
    check(Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)),
      `${label} — ${integer ? 'целое число' : 'число'} от ${min} до ${max}.`);
    return value;
  }

  function bisect(value, low, high, increasing = true, steps = 50) {
    for (let i = 0; i < steps; i++) {
      const center = (high + low) / 2;
      if ((value(center) < 0) === increasing) low = center;
      else high = center;
    }
    return (high + low) / 2;
  }

  function fluid(density, viscosity) {
    number(density, 'Плотность, кг/м³', 100, 5000);
    number(viscosity, 'Кинематическая вязкость, мм²/с', 0.001, 100000);
    return { density, nu: viscosity / 1e6 };
  }

  function darcy(re, roughness) {
    if (re === 0) return 0;
    if (re <= 2300) return 64 / re;
    const turbulent = reynolds => {
      // Solve the Colebrook equation for x = 1/√λ.
      let x = -2 * Math.log10(roughness / 3.7 + 5.74 / reynolds ** 0.9);
      for (let i = 0; i < 8; i++) x = -2 * Math.log10(roughness / 3.7 + 2.51 * x / reynolds);
      return 1 / (x * x);
    };
    if (re >= 4000) return turbulent(re);
    const blend = (re - 2300) / 1700;
    return 64 / re * (1 - blend) + turbulent(re) * blend;
  }

  function pipeSection(segment, medium, q) {
    const velocity = q / segment.area;
    const reynolds = velocity * segment.d / medium.nu;
    const lambda = darcy(reynolds, segment.relative);
    const velocityHead = velocity ** 2 / (2 * G);
    const distributed = lambda * segment.length / segment.d * velocityHead;
    const local = segment.local * velocityHead;
    return { flow: q * 60000, velocity, reynolds, lambda, distributed, local, loss: distributed + local,
      regime: reynolds === 0 ? 'Покой' : reynolds <= 2300 ? 'Ламинарный' : reynolds < 4000 ? 'Переходный' : 'Турбулентный' };
  }

  function prepareNetwork(density, viscosity, rows) {
    const medium = fluid(density, viscosity);
    check(Array.isArray(rows) && rows.length >= 1 && rows.length <= 24, 'Введите от 1 до 24 участков.');
    const groups = new Map();
    rows.forEach((row, i) => {
      const name = `Строка ${i + 1}`;
      const group = number(row.group, `${name}, группа`, 1, 24, true);
      const d = number(row.diameter, `${name}, диаметр`, 0.1, 5000) / 1000;
      const length = number(row.length, `${name}, длина`, 0.001, 1e6);
      const roughness = number(row.roughness, `${name}, шероховатость`, 0, 100) / 1000;
      check(roughness / d <= 0.05, `${name}: ε/D должно быть не больше 0,05.`);
      const local = number(row.local, `${name}, Σζ`, 0, 1e5);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ i, group, d, length, relative: roughness / d, area: Math.PI * d * d / 4, local });
    });
    return { medium, groups: [...groups].sort(([a], [b]) => a - b).map(([, segments]) => segments) };
  }

  function networkAt(network, q, detailed = false) {
    const { medium, groups } = network;
    let head = 0;
    let residual = 0;
    const sections = [];
    for (const segments of groups) {
      let flows = [q];
      if (segments.length > 1) {
        if (q === 0) flows = segments.map(() => 0);
        else {
          const losses = segments.map(segment => value => pipeSection(segment, medium, value).loss);
          const high = Math.min(...losses.map(loss => loss(q)));
          const rates = h => losses.map(loss => bisect(v => loss(v) - h, 0, q, true, 37));
          const common = bisect(h => rates(h).reduce((sum, amount) => sum + amount, -q), 0, high, true, 37);
          flows = rates(common);
        }
      }
      const data = segments.map((segment, i) => ({ ...pipeSection(segment, medium, flows[i]), index: segment.i + 1, group: segment.group }));
      head += data[0].loss;
      if (detailed) {
        sections.push(...data);
        residual = Math.max(residual, Math.abs(flows.reduce((sum, amount) => sum + amount, -q)) * 60000);
      }
    }
    return { head, sections, residual };
  }

  function pipeline({ density, viscosity, mode, flow, available, staticHead, rows }) {
    const network = prepareNetwork(density, viscosity, rows);
    number(staticHead, 'Статический напор, м', -100000, 100000);
    check(mode === 'flow' || mode === 'head', 'Выберите известную величину.');
    let q;
    if (mode === 'flow') {
      q = flowSI(number(flow, 'Расход, л/мин', 0, 1e6));
    } else {
      number(available, 'Заданный полный напор, м', -100000, 1e8);
      const balance = available - staticHead;
      check(balance >= 0, 'При данном напоре прямое течение невозможно. Проверьте направление и статический напор.');
      const high = flowSI(1e6);
      check(networkAt(network, high).head >= balance, 'Требуемый расход выходит за диапазон до 1 000 000 л/мин.');
      q = balance === 0 ? 0 : bisect(value => networkAt(network, value).head - balance, 0, high);
    }
    const result = networkAt(network, q, true);
    const head = staticHead + result.head;
    const warnings = [];
    if (result.sections.some(section => section.regime === 'Переходный')) {
      warnings.push('На части участков переходный режим. Коэффициент трения оценён интерполяцией между ламинарной и турбулентной моделями.');
    }
    return { ...result, loss: result.head, head, flow: q * 60000,
      pressure: density * G * head / 1e5, energyResidual: mode === 'head' ? head - available : 0, warnings };
  }

  function pumpDuty({ density, staticHead, resistance, inlet, vapour, suctionHeight, suctionLoss, rows, network: inputNetwork }) {
    fluid(density, 1);
    number(staticHead, 'Статический напор, м', -1e5, 1e5);
    number(resistance, 'Коэффициент сопротивления k', 0, 100000);
    number(inlet, 'Абсолютное давление над жидкостью, бар', 0.001, 1000);
    number(vapour, 'Давление насыщенных паров, бар (абс.)', 0, 1000);
    number(suctionHeight, 'Уровень источника минус ось насоса, м', -10000, 10000);
    number(suctionLoss, 'Потери во всасывающей линии, м', 0, 10000);
    check(Array.isArray(rows) && rows.length >= 2 && rows.length <= 24, 'Введите от 2 до 24 точек характеристики насоса.');
    const points = rows.map((row, i) => {
      const label = `Точка ${i + 1}`;
      return { flow: number(row.flow, `${label}, подача`, 0, 1e6), head: number(row.head, `${label}, напор`, 0, 1e6),
        efficiency: number(row.efficiency, `${label}, КПД`, 0, 100) / 100,
        npshr: number(row.npshr, `${label}, NPSHᵣ`, 0, 1e4) };
    }).sort((a, b) => a.flow - b.flow);
    check(points.every((point, i) => i === 0 || (point.flow > points[i - 1].flow && point.head <= points[i - 1].head)),
      'Подачи должны быть уникальными, напор на характеристике должен убывать или оставаться постоянным.');
    const prepared = inputNetwork ? prepareNetwork(density, inputNetwork.viscosity, inputNetwork.rows) : null;
    const system = q => staticHead + (prepared ? networkAt(prepared, flowSI(q)).head : resistance * q ** 2);
    const at = q => {
      const i = points.findIndex(point => point.flow >= q);
      if (i < 1) return points[i === 0 ? 0 : points.length - 1];
      const a = points[i - 1];
      const b = points[i];
      const s = (q - a.flow) / (b.flow - a.flow);
      return Object.fromEntries(Object.keys(a).map(key => [key, a[key] + (b[key] - a[key]) * s]));
    };
    const diff = q => at(q).head - system(q);
    const lo = points[0].flow;
    const hi = points[points.length - 1].flow;
    if (!prepared && resistance === 0) {
      check(!points.some((point, i) => i > 0 && point.head === staticHead && points[i - 1].head === staticHead),
        'На горизонтальном участке характеристики рабочая точка неоднозначна.');
    }
    check(diff(lo) >= 0 && diff(hi) <= 0, 'Пересечения характеристик в пределах заданных точек нет. Нужны данные для другого диапазона подачи.');
    check(diff(lo) !== 0 || diff(hi) !== 0, 'Характеристики совпадают в заданном диапазоне. Рабочая точка неоднозначна.');
    const q = diff(lo) === 0 ? lo : diff(hi) === 0 ? hi : bisect(diff, lo, hi, false);
    const duty = at(q);
    check(q > 0 && duty.efficiency > 0, 'Пересечение соответствует нулевой подаче или КПД. Выберите другой насос или режим.');
    const npsha = (inlet - vapour) * 1e5 / (density * G) + suctionHeight - suctionLoss;
    const hydraulic = density * G * flowSI(q) * duty.head / 1000;
    const warnings = npsha <= duty.npshr ? ['NPSHₐ ≤ NPSHᵣ. По введённым данным запас на всасывании отсутствует.'] : [];
    return { ...duty, flow: q, npsha, margin: npsha - duty.npshr, hydraulic, shaft: hydraulic / duty.efficiency,
      residual: diff(q), coupled: Boolean(prepared), warnings,
      curve: Array.from({ length: 37 }, (_, i) => {
        const flow = lo + (hi - lo) * i / 36;
        return { flow, pump: at(flow).head, system: system(flow) };
      }) };
  }

  function hydrostatic({ density, surfacePressure, depth, width, height, angle }) {
    fluid(density, 1);
    number(surfacePressure, 'Манометрическое давление на поверхности, бар', 0, 1000);
    number(depth, 'Глубина центра площадки, м', 0, 10000);
    number(width, 'Ширина, м', 0.001, 1000);
    number(height, 'Высота по плоскости, м', 0.001, 1000);
    number(angle, 'Угол к горизонту', 0, 90);
    const slope = Math.sin(angle * Math.PI / 180);
    check(depth >= height * slope / 2, 'Верхний край площадки находится выше уровня жидкости.');
    const pressure = surfacePressure * 1e5 + density * G * depth;
    check(pressure > 0, 'Среднее давление равно нулю. Центр давления не определён.');
    const force = pressure * width * height;
    const shift = density * G * slope * height ** 2 / (12 * pressure);
    return { pressure: pressure / 1e5, force: force / 1000, shift, centerDepth: depth + shift * slope };
  }

  function orifice({ density, diameter, coefficient, head, end, reservoir }) {
    fluid(density, 1);
    number(diameter, 'Диаметр отверстия, мм', 0.01, 5000);
    number(coefficient, 'Коэффициент расхода μ', 0.001, 1);
    number(head, 'Начальный напор, м', 0.0001, 1000);
    number(end, 'Конечный напор, м', 0, 1000);
    number(reservoir, 'Площадь зеркала, м²', 0.00001, 50000);
    const opening = area(diameter);
    check(end <= head, 'Конечный напор должен быть не больше начального.');
    check(reservoir >= 25 * opening, 'Для модели малого отверстия площадь зеркала должна быть не меньше 25 площадей отверстия.');
    const factor = coefficient * opening * Math.sqrt(2 * G);
    const time = 2 * reservoir * (Math.sqrt(head) - Math.sqrt(end)) / factor;
    return { start: factor * Math.sqrt(head) * 60000, end: factor * Math.sqrt(end) * 60000,
      time, volume: reservoir * (head - end) * 1000, idealVelocity: Math.sqrt(2 * G * head), pressure: density * G * head / 1e5 };
  }

  function bendForce({ density, flow, d1, d2, p1, p2, angle }) {
    fluid(density, 1);
    number(flow, 'Расход, л/мин', 0, 1e6);
    number(d1, 'Входной диаметр, мм', 0.1, 5000);
    number(d2, 'Выходной диаметр, мм', 0.1, 5000);
    number(p1, 'Давление на входе, бар (изб.)', -1, 1000);
    number(p2, 'Давление на выходе, бар (изб.)', -1, 1000);
    number(angle, 'Поворот потока, °', -180, 180);
    const q = flowSI(flow);
    const a1 = area(d1);
    const a2 = area(d2);
    const v1 = q / a1;
    const v2 = q / a2;
    const m = density * q;
    const th = angle * Math.PI / 180;
    const inlet = p1 * 1e5 * a1 + m * v1;
    const outlet = p2 * 1e5 * a2 + m * v2;
    const x = inlet - outlet * Math.cos(th);
    const y = -outlet * Math.sin(th);
    return { x, y, force: Math.hypot(x, y), v1, v2, massFlow: m };
  }

  function venturi({ density, viscosity, inlet, throat, pressure, elevation, discharge }) {
    const { nu } = fluid(density, viscosity);
    number(inlet, 'Входной диаметр, мм', 0.1, 5000);
    number(throat, 'Диаметр в горле, мм', 0.1, 5000);
    number(pressure, 'Разность статических давлений, кПа', -1e5, 1e5);
    number(elevation, 'Отметка входа минус отметка горла, м', -1000, 1000);
    number(discharge, 'Коэффициент расхода', 0.01, 1);
    check(throat < inlet, 'Диаметр горла должен быть меньше диаметра входа.');
    const beta = throat / inlet;
    const effective = pressure * 1000 + density * G * elevation;
    check(effective >= 0, 'Пьезометрическая разность отрицательна. Проверьте знак и направление потока.');
    const q = discharge * area(throat) * Math.sqrt(2 * effective / (density * (1 - beta ** 4)));
    const v1 = q / area(inlet);
    const v2 = q / area(throat);
    return { flow: q * 60000, v1, v2, beta, effective: effective / 1000, reynolds: v1 * inlet / (1000 * nu) };
  }

  function slit({ density, viscosity, width, gap, length, pressure }) {
    const { nu } = fluid(density, viscosity);
    number(width, 'Ширина щели, мм', 0.01, 5000);
    number(gap, 'Зазор щели, мм', 0.001, 1000);
    number(length, 'Длина щели, мм', 0.01, 5000);
    number(pressure, 'Перепад, бар', 0, 10000);
    check(width >= 20 * gap, 'Для оценки плоской щели требуется ширина не меньше 20 зазоров.');
    const mu = nu * density;
    const a = width * gap / 1e6;
    const q = width / 1000 * (gap / 1000) ** 3 * pressure * 1e5 / (12 * mu * length / 1000);
    const speed = q / a;
    const reynolds = 2 * width * gap / (width + gap) / 1000 * speed / nu;
    check(reynolds < 2300, 'Re ≥ 2300. Ламинарная формула плоской щели в этом режиме неприменима.');
    const warnings = length < .1 * reynolds * gap ? ['Входной участок может занимать значительную часть щели. Проверьте условие развитого течения.'] : [];
    return { flow: q * 60000, speed, reynolds, mu, loss: pressure * 1e5 * q, warnings };
  }

  function waterHammer({ density, liquidBulk, pipeYoung, diameter, thickness, restraint, length, change, closeTime, initial }) {
    fluid(density, 1);
    number(liquidBulk, 'Модуль объёмной упругости жидкости, ГПа', 0.001, 10000);
    number(pipeYoung, 'Модуль упругости трубы, ГПа', 0.001, 10000);
    number(diameter, 'Внутренний диаметр, мм', 0.1, 1e4);
    number(thickness, 'Толщина стенки, мм', 0.01, 1000);
    number(restraint, 'Коэффициент податливости стенки ψ', 0, 2);
    number(length, 'Длина, м', 0.1, 1e6);
    number(change, 'Уменьшение скорости, м/с', 0, 1000);
    number(closeTime, 'Длительность закрытия, с', 0, 1e6);
    number(initial, 'Исходное абсолютное давление, бар', 0.001, 1e4);
    const c = Math.sqrt(liquidBulk * 1e9 / density /
      (1 + restraint * liquidBulk / pipeYoung * diameter / thickness));
    const transit = 2 * length / c;
    const fast = closeTime <= transit;
    const dp = density * c * change * (fast ? 1 : transit / closeTime) / 1e5;
    const warnings = [];
    if (diameter / thickness < 10) warnings.push('D/e < 10. Формула волновой скорости опирается на тонкостенную модель.');
    if (initial - dp <= 0) warnings.push('Амплитуда превышает исходное абсолютное давление. Проверьте риск разрыва столба и кавитацию переходным расчётом.');
    return { c, transit, dp, peak: initial + dp, fast, warnings };
  }

  function volumetricDrive({ pumpVolume, pumpSpeed, pumpVol, pumpMech, motorVolume, motorVol, motorMech, loadTorque, circuitLoss }) {
    number(pumpVolume, 'Рабочий объём насоса, см³/об', 0.001, 1e5);
    number(pumpSpeed, 'Обороты насоса, об/мин', 0.01, 1e6);
    number(motorVolume, 'Рабочий объём гидромотора, см³/об', 0.001, 1e5);
    for (const [key, value] of [['ηv насоса', pumpVol], ['ηm насоса', pumpMech], ['ηv мотора', motorVol], ['ηm мотора', motorMech]]) {
      number(value, key, 0.001, 1);
    }
    number(loadTorque, 'Момент на гидромоторе, Н·м', 0, 1e7);
    number(circuitLoss, 'Перепад давления в линиях и аппаратах, бар', 0, 10000);
    const q = pumpVolume * pumpSpeed * pumpVol / 1000;
    const motorSpeed = q * 1000 / motorVolume * motorVol;
    const motorPressure = 20 * Math.PI * loadTorque / (motorVolume * motorMech);
    const pumpPressure = motorPressure + circuitLoss;
    const torque = pumpPressure * pumpVolume / (20 * Math.PI * pumpMech);
    const power = torque * pumpSpeed * Math.PI / 30000;
    const useful = loadTorque * motorSpeed * Math.PI / 30000;
    return { q, motorSpeed, motorPressure, pumpPressure, torque, power, useful, loss: power - useful,
      efficiency: power > 0 ? useful / power * 100 : 0 };
  }

  function turbine({ density, flow, head, efficiency, rpm }) {
    fluid(density, 1);
    number(flow, 'Расход, м³/с', 0, 1e5);
    number(head, 'Полезный напор, м', 0, 1e5);
    number(efficiency, 'КПД турбины', 0.001, 1);
    number(rpm, 'Частота вращения, об/мин', 0.01, 1e6);
    const hydraulic = density * G * flow * head / 1000;
    const power = hydraulic * efficiency;
    return { hydraulic, power, torque: power * 30000 / (Math.PI * rpm), loss: hydraulic - power };
  }

  function converter({ rpm, torque, speedRatio, rows }) {
    number(rpm, 'Обороты насосного колеса', 0.01, 1e6);
    number(torque, 'Момент на насосном колесе', 0.001, 1e7);
    number(speedRatio, 'Отношение оборотов i', 0, 1);
    check(Array.isArray(rows) && rows.length >= 2 && rows.length <= 24, 'Введите 2–24 точки характеристики.');
    const points = rows.map(({ ratio, torqueRatio }, i) => ({
      ratio: number(ratio, `i в строке ${i + 1}`, 0, 1),
      torqueRatio: number(torqueRatio, `K в строке ${i + 1}`, 0, 10)
    })).sort((a, b) => a.ratio - b.ratio);
    check(points.every((p, i) => p.ratio * p.torqueRatio <= 1 && (i === 0 || p.ratio > points[i - 1].ratio)),
      'Отношения оборотов должны быть уникальными. Введённые характеристики должны давать КПД не выше 100%.');
    const i = points.findIndex(point => point.ratio >= speedRatio);
    check(i >= 0 && speedRatio >= points[0].ratio, 'Режим находится вне диапазона экспериментальных точек.');
    const b = points[i];
    const a = points[Math.max(0, i - 1)];
    const k = speedRatio === b.ratio ? b.torqueRatio : a.torqueRatio +
      (b.torqueRatio - a.torqueRatio) * (speedRatio - a.ratio) / (b.ratio - a.ratio);
    const efficiency = k * speedRatio;
    check(efficiency <= 1, 'Интерполированная характеристика даёт КПД выше 100%. Уточните точки в рабочей области.');
    const input = Math.PI * rpm * torque / 30000;
    return { k, rpm: rpm * speedRatio, torque: torque * k, efficiency: efficiency * 100,
      input, power: input * efficiency, loss: input * (1 - efficiency) };
  }

  const api = { G, darcy, pipeline, pumpDuty, hydrostatic, orifice, bendForce, venturi, slit, waterHammer, volumetricDrive, turbine, converter };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoftneerHydro = api;
})(globalThis);
