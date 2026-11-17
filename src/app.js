(function () {
  'use strict';

  const E = window.SoftneerEngine;
  const CAD = window.SoftneerCAD;
  const { tools: baseTools, articles } = window.SoftneerContent;
  const advanced = window.SoftneerAdvanced.tools;
  const tools = { ...baseTools, ...advanced };
  const Draw = window.SoftneerDraw;
  const main = document.getElementById('main');
  const nav = document.getElementById('navigation');
  const sidebar = document.getElementById('sidebar');
  const breadcrumb = document.getElementById('breadcrumb');
  const menuToggle = document.getElementById('menu-toggle');
  const searchDialog = document.getElementById('search-dialog');
  const searchInput = document.getElementById('search-input');
  const toast = document.getElementById('toast');
  const storagePrefix = 'softneer.v1.';
  const storageFallback = new Map();
  const extras = {
    handbook: { nav: 'Инженерный справочник', name: 'Инженерный справочник', group: 'База знаний', icon: 'book' },
    catalog: { nav: 'Каталог STEP', name: 'Библиотека STEP', group: 'База знаний', icon: 'cube' }
  };
  const pages = { ...tools, ...extras };
  const icons = {
    gear: '<path d="M10 2h4l.6 2.6 2 .9 2.4-1.1 2 3.5-1.8 1.9.3 2.2 2.1 1.6-1 3.9-2.7-.1-1.6 1.5-.4 2.7h-4l-.9-2.6-2.1-.7-2.4 1.2-2.2-3.3 1.7-2.1-.5-2.2L2 10.5l.8-3.9h2.8L7 5l.3-2.7L10 2Z"/><circle cx="12" cy="12" r="3.4"/>',
    ruler: '<path d="m4 16 12-12 4 4L8 20l-4-4Zm4-4 2 2m1-5 2 2m1-5 2 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    bearing: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5m0 8v5m-9-9h5m8 0h5"/>',
    spline: '<path d="M3 7h5V4h8v3h5v10h-5v3H8v-3H3V7Z"/><path d="M8 10h8m-8 4h8"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l3 2"/>',
    branch: '<circle cx="5" cy="16" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="20" cy="13" r="2"/><path d="m6.5 14.5 4-5m3.3-.3 4.4 2.6"/>',
    drop: '<path d="M12 3c2 3.5 7 8 7 12a7 7 0 0 1-14 0c0-4 5-8.5 7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
    cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm-8 4.5 8 4.5 8-4.5M12 12v9"/>',
    search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
    input: '<path d="M5 4v16m7-16v16m7-16v16M3 8h4m3 7h4m3-6h4"/>',
    chart: '<path d="M4 4v16h16M8 15l4-4 3 1 5-6"/>',
    activity: '<path d="M3 12h4l3-6 4 12 3-6h4"/>',
    refresh: '<path d="M19 9a7 7 0 1 0 0 6m0-10v4h-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12m0-12L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    pause: '<path d="M9 5v14m6-14v14"/>',
    trash: '<path d="M4 6h16m-14 0 1 14h10l1-14M9 6V3h6v3m-5 4v6m4-6v6"/>'
  };
  const svg = icon => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon] || icons.chart}</svg>`;
  const mark = icon => `<span data-icon="${icon}">${svg(icon)}</span>`;
  const text = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const normalize = value => String(value).toLowerCase().replaceAll('ё', 'е').replace(/[×х]/g, 'x').trim();
  const matches = (haystack, query) => normalize(query).split(/\s+/).every(word => normalize(haystack).includes(word));
  const link = ([label, url]) => `<a href="${text(url)}" target="_blank" rel="noopener noreferrer">${text(label)}</a>`;
  const links = sources => sources.map(link).join(' · ');
  const button = (name, label, icon, className = '') => `<button type="button" class="button ${className}" data-action="${name}">${icon ? mark(icon) : ''}${label}</button>`;
  const format = (value, digits = 2) => {
    if (typeof value !== 'number') return String(value ?? '—');
    if (!Number.isFinite(value)) return value === Infinity ? '∞' : '—';
    if ((value !== 0 && Math.abs(value) < 10 ** -digits && digits > 0) || Math.abs(value) >= 1e9) {
      return new Intl.NumberFormat('ru-RU', { notation: 'scientific', maximumFractionDigits: 3 }).format(value);
    }
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);
  };

  const groups = [
    ['Системы передач', ['gearbox', 'gear', 'helical', 'tooth', 'shaft', 'bearing', 'spline', 'fatigue']],
    ['Допуски и посадки', ['fits', 'stack']],
    ['Гидравлика', ['pipeline', 'pump', 'hydrostat', 'orifice', 'venturi', 'slit', 'bend', 'hammer', 'hydrodrive', 'hydraulic', 'turbine', 'converter']],
    ['Моделирование', ['motion']],
    ['База знаний', ['handbook', 'catalog']]
  ];
  const captions = {
    gear: ['Геометрия зацепления', 'ЭСКИЗ · ММ'],
    fits: ['Поля допусков', 'ОТКЛОНЕНИЯ · МКМ'],
    stack: ['Предельные значения', 'ЗАМЫКАЮЩЕЕ ЗВЕНО · ММ'],
    bearing: ['Зависимость ресурса от нагрузки', 'C И n ПОСТОЯННЫ'],
    spline: ['Схема сечения', 'УСЛОВНЫЙ ПРОФИЛЬ'],
    fatigue: ['Вклад ступеней в повреждение', 'ПОВРЕЖДЕНИЕ nᵢ/Nᵢ'],
    motion: ['Кинематическая схема', 'ПОЛОЖЕНИЕ · ММ'],
    hydraulic: ['Схема цилиндра', 'АКТИВНАЯ ПОЛОСТЬ']
  };

  let state = {};
  let resizeObserver;
  let toastTimer;
  let motionFrame;
  let imported = [];
  let catalogDatabase;
  let catalogReady;

  document.querySelectorAll('[data-icon]').forEach(item => { item.innerHTML = svg(item.dataset.icon); });
  const searchShortcut = document.querySelector('.search-button kbd');
  searchShortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  document.getElementById('global-search').setAttribute('aria-label', 'Поиск по разделам');

  function read(key) {
    if (storageFallback.has(key)) return storageFallback.get(key);
    try { return JSON.parse(localStorage.getItem(storagePrefix + key)); } catch { return null; }
  }

  function write(key, payload) {
    try {
      localStorage.setItem(storagePrefix + key, JSON.stringify(payload));
      storageFallback.delete(key);
    } catch { storageFallback.set(key, structuredClone(payload)); }
  }

  function announce(message) {
    clearTimeout(toastTimer);
    toast.hidden = false;
    toast.textContent = message;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function closeNav() {
    sidebar.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  function navMarkup(active) {
    return groups.map(([label, ids]) => `<div class="nav-group"><p class="nav-title">${label}</p>${ids.map(id =>
      `<a class="nav-link" href="#${id}"${id === active ? ' aria-current="page"' : ''}>${mark(pages[id].icon)}${pages[id].nav}</a>`).join('')}</div>`).join('');
  }

  function pageHeader(page, subtitle, action = '') {
    return `<div class="page-head"><div><p class="eyebrow">${page.group}</p><h1>${page.name}</h1><p>${subtitle}</p></div>${action}</div>`;
  }

  function defaultInput(tool) {
    const data = Object.fromEntries(tool.fields.map(item => [item.key, item.value]));
    if (tool.rows) data.rows = tool.rows.defaults.map(row => ({ ...row }));
    return data;
  }

  function validRowCount(data, definition) {
    if (!Array.isArray(data) || !data.every(row => row && typeof row === 'object' && !Array.isArray(row))) return false;
    if (definition.fixed) return data.length === definition.defaults.length;
    return data.length >= (definition.min ?? 1) && data.length <= (definition.max ?? 24);
  }

  function field(def, value, rowIndex, rowLabel) {
    const id = rowIndex === undefined ? `field-${def.key}` : `field-${rowIndex}-${def.key}`;
    const label = rowIndex === undefined ? def.label : `${rowLabel}, строка ${rowIndex + 1}`;
    const prop = `id="${id}" name="${text(def.key)}"${rowIndex === undefined ? '' : ` aria-label="${text(label)}" data-row="${rowIndex}"`}`;
    const input = def.options
      ? `<select ${prop}>${def.options.map(([key, name]) => `<option value="${text(key)}"${String(key) === String(value) ? ' selected' : ''}>${text(name)}</option>`).join('')}</select>`
      : `<input ${prop} type="text" inputmode="decimal" value="${text(value)}" autocomplete="off" spellcheck="false">`;
    const shell = `<div class="field-shell">${input}${def.unit ? `<span>${text(def.unit)}</span>` : ''}</div>`;
    return rowIndex === undefined
      ? `<div class="field${def.wide ? ' form-wide' : ''}"${def.mode ? ` data-mode="${def.mode}" data-mode-key="${def.modeKey || 'mode'}"` : ''}><label for="${id}">${text(label)}</label>${shell}</div>`
      : shell;
  }

  function rowMarkup() {
    const { labels, fields, names, fixed, min = 1, max = 24 } = state.tool.rows;
    const data = state.raw.rows;
    const actions = (i) => `<td><button type="button" class="icon-button" data-action="delete-row" data-index="${i}" aria-label="Удалить строку ${i + 1}"${data.length <= min ? ' disabled' : ''}>${svg('trash')}</button></td>`;
    return `<div class="table-wrap"><table class="edit-table${fixed ? ' fixed' : ''}${fields.length >= 5 ? ' wide-table' : ''}"><thead><tr>${names ? '<th scope="col">Элемент</th>' : ''}${labels.map(label => `<th scope="col">${label}</th>`).join('')}${fixed ? '' : '<th scope="col" aria-label="Действия"></th>'}</tr></thead>
      <tbody>${data.map((row, i) => `<tr>${names ? `<th scope="row">${names[i]}</th>` : ''}${fields.map((def, j) => `<td>${field(def, row[def.key], i, labels[j])}</td>`).join('')}${fixed ? '' : actions(i)}</tr>`).join('')}</tbody></table></div>
      ${fixed ? '' : `<div class="form-actions"><button type="button" class="button" data-action="add-row"${data.length >= max ? ' disabled' : ''}>${mark('plus')}Добавить строку</button></div>`}`;
  }

  function tabButtons(pairs, current, action) {
    return `<div class="tabs">${pairs.map(([id, label]) => `<button type="button" class="tab-button" data-action="${action}" data-value="${text(id)}" aria-pressed="${id === current}">${text(label)}</button>`).join('')}</div>`;
  }

  function plotControls(id) {
    if (id === 'gear') {
      return {
        top: tabButtons([['pair', 'Пара'], ['pinion', 'Шестерня'], ['wheel', 'Колесо']], 'pair', 'gear-view'),
        bottom: `<div class="legend"><span><i></i>Шестерня</span><span><i></i>Колесо</span><span><i></i>Основные окружности</span></div>
          ${button('dxf', 'Экспорт DXF', 'download')}`
      };
    }
    if (id === 'motion') {
      return { top: '', bottom: `<div class="motion-controls">
        <button type="button" class="button" data-action="motion-play" aria-pressed="false">${mark('play')}Пуск</button>
        <input type="range" id="motion-angle" min="0" max="360" step="1" value="45" aria-label="Угол кривошипа">
        <output id="motion-degrees" for="motion-angle">45°</output></div>` };
    }
    return { top: '', bottom: '' };
  }

  function sectionHeading(icon, title) { return `<h2>${mark(icon)}${title}</h2>`; }

  function renderTool(id) {
    const tool = tools[id];
    const defaults = defaultInput(tool);
    const saved = read(id);
    const raw = { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
    if (tool.rows && !validRowCount(raw.rows, tool.rows)) raw.rows = defaults.rows;
    const [plotTitle, plotCaption] = tool.plot || captions[id];
    const controls = plotControls(id);
    const actions = tool.actions || (id === 'gear' ? [['strength-transfer', 'Прочность зубьев', 'gear']] : []);
    state = { id, tool, raw, view: 'pair', theta: 45, playing: false };
    main.innerHTML = `<div class="page">
      ${pageHeader(tool, tool.subtitle, button('report', 'Скачать отчёт', 'download'))}
      <div class="metrics" id="metrics" aria-label="Основные результаты"></div>
      <div class="workspace${tool.wide ? ' wide-form' : ''}">
        <section class="panel">
          <div class="panel-head">${sectionHeading('input', 'Исходные данные')}
            ${button('reset', 'Сброс', 'refresh')}</div>
          <div class="panel-body">
            <form id="parameters" novalidate>
              <div class="form-grid">${tool.fields.map(def => field(def, raw[def.key])).join('')}</div>
              ${id === 'pump' ? '<div class="linked-note" id="linked-note" hidden></div>' : ''}
              ${tool.rows ? `<div id="row-editor">${rowMarkup()}</div>` : ''}
              <p class="form-note">${tool.note}</p>
              <div class="form-actions"><button class="button primary" type="submit">${mark('activity')}Рассчитать</button>
                ${id === 'gearbox' ? '<select class="button" id="transfer-stage" aria-label="Ступень для передачи данных"></select>' : ''}
                ${actions.map(([action, label, icon]) => button(action, label, icon, 'transfer-button')).join('')}</div>
            </form>
            <div class="notice" id="calc-notice" role="status"></div>
          </div>
        </section>
        <section class="panel plot-panel"><div class="panel-head plot-head">${sectionHeading(tool.icon, plotTitle)}${controls.top}</div>
          <div class="plot"><div class="plot-tag">${plotCaption}</div><canvas id="plot" role="img" aria-label="${plotTitle}"></canvas></div>
          ${controls.bottom ? `<div class="plot-footer">${controls.bottom}</div>` : ''}
        </section>
      </div>
      <section class="panel detail">
        <div class="panel-head">${sectionHeading('layers', 'Подробности расчёта')}</div>
        <div class="panel-body">
          <div class="table-wrap" id="details"></div>
          <p class="method">${tool.method}${tool.sources.length ? ' ' + links(tool.sources) : ''}</p>
        </div>
      </section>
    </div>`;
    main.querySelector('#parameters').addEventListener('submit', event => {
      event.preventDefault();
      if (evaluate()) announce('Расчёт обновлён');
    });
    evaluate();
    const canvas = main.querySelector('#plot');
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(redrawPlot);
      resizeObserver.observe(canvas);
    }
  }

  function parseField(value, def) {
    if (def.options) return def.options.find(([option]) => String(option) === String(value))?.[0];
    const str = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    if (!str || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(str)) return NaN;
    return Number(str);
  }

  function parseInput() {
    const { raw, tool, id } = state;
    const input = Object.fromEntries(tool.fields.filter(def => !def.mode || def.mode === raw[def.modeKey || 'mode'])
      .map(def => [def.key, parseField(raw[def.key], def)]));
    if (tool.rows) input.rows = raw.rows.map(row => Object.fromEntries(tool.rows.fields.map(def => [def.key, parseField(row[def.key], def)])));
    if (id === 'motion') input.theta = state.theta;
    if (id === 'pump' && input.system === 'network' && raw.linkedNetwork) input.network = raw.linkedNetwork;
    return input;
  }

  function updateModes() {
    main.querySelectorAll('[data-mode]').forEach(field => {
      field.hidden = field.dataset.mode !== state.raw[field.dataset.modeKey];
    });
    const note = main.querySelector('#linked-note');
    if (note) {
      const network = state.raw.linkedNetwork;
      note.hidden = state.raw.system !== 'network' || !network;
      if (!note.hidden) note.textContent = `Зафиксировано участков: ${network.rows.length}. ν = ${format(network.viscosity, 4)} мм²/с. Для обновления повторно передайте сеть.`;
    }
  }

  function evaluate({ frame = false } = {}) {
    const { tool, id } = state;
    if (!tool) return false;
    const input = parseInput();
    let result = null;
    let error = '';
    const profiles = {};
    if (!frame) updateModes();
    try {
      result = tool.calc(input);
    } catch (failure) {
      error = failure.message || 'Проверьте параметры.';
    }
    const warnings = [...(result?.warnings || [])];
    if (result && id === 'gear') {
      for (const key of ['pinion', 'wheel']) {
        try {
          profiles[key] = E.gearOutline(result[key], result.alpha);
        } catch {
          warnings.push(`Профиль ${key === 'pinion' ? 'шестерни' : 'колеса'} недоступен для выбранных параметров.`);
        }
      }
    }
    if (result && id === 'spline' && result.margin < 1) warnings.push('Среднее давление превышает указанное допускаемое значение.');
    state.input = input;
    state.result = result;
    state.profiles = profiles;
    state.metrics = result ? tool.metrics(result) : [];
    const notice = main.querySelector('#calc-notice');
    if (!frame || notice.textContent !== (error || warnings.join(' '))) {
      notice.classList.toggle('error', Boolean(error));
      notice.textContent = error || warnings.join(' ');
    }
    renderMetrics(result ? state.metrics : emptyMetrics());
    if (!frame) {
      main.querySelector('#details').innerHTML = result ? detailsMarkup(id, result, input) : '<p class="empty">Исправьте входные параметры, чтобы получить результаты.</p>';
    }
    updateButtons();
    redrawPlot();
    return Boolean(result);
  }

  function emptyMetrics() {
    try {
      const raw = defaultInput(state.tool);
      const example = state.tool.calc({ ...raw, theta: 45 });
      return state.tool.metrics(example).map(item => ({ ...item, value: '—' }));
    } catch { return []; }
  }

  function renderMetrics(metrics) {
    const host = document.getElementById('metrics');
    if (host.children.length !== metrics.length) {
      host.innerHTML = metrics.map(item => `<div class="metric">
        <span class="metric-icon" data-icon="${item.icon}">${svg(item.icon)}</span>
        <span class="metric-label">${text(item.label)}</span>
        <span class="metric-value"></span><span class="metric-unit">${text(item.unit)}</span></div>`).join('');
    }
    metrics.forEach((item, index) => {
      host.children[index].querySelector('.metric-value').textContent = format(item.value, item.digits);
    });
  }

  function table(headings, rows) {
    return `<table class="data-table"><thead><tr>${headings.map((name, i) => `<th scope="col"${i ? ' class="num"' : ''}>${text(name)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map((value, i) => `<td${i ? ' class="num"' : ''}>${text(typeof value === 'number' ? format(value, 5) : value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function detailsMarkup(id, r, input) {
    if (state.tool.detail) {
      const grid = state.tool.detail(r, input);
      return table(grid.headings, grid.rows);
    }
    switch (id) {
      case 'gear': {
        const pairRows = [
          ['Делительный диаметр d, мм', 'radius'], ['Основной диаметр dᵦ, мм', 'base'],
          ['Диаметр вершин dₐ, мм', 'tip'], ['Диаметр впадин d_f, мм', 'root']
        ].map(([name, key]) => [name, 2 * r.pinion[key], 2 * r.wheel[key]]);
        return table(['Параметр', 'Шестерня', 'Колесо'], [...pairRows,
          ['Частота вращения, об/мин', input.rpm, r.outputRpm],
          ['Радиальная сила, Н', r.fr, r.fr], ['Окружная скорость, м/с', r.pitchSpeed, r.pitchSpeed]]);
      }
      case 'fits':
        return table(['Параметр', 'Отверстие', 'Вал'], [
          ['Нижнее отклонение, мкм', r.hole[0], r.shaft[0]], ['Верхнее отклонение, мкм', r.hole[1], r.shaft[1]],
          ['Наименьший размер, мм', r.holeLimits[0], r.shaftLimits[0]], ['Наибольший размер, мм', r.holeLimits[1], r.shaftLimits[1]]
        ]);
      case 'fatigue':
        return table(['Ступень', 'Циклы nᵢ', 'Ресурс Nᵢ', 'nᵢ/Nᵢ'],
          input.rows.map((row, i) => [i + 1, row.cycles, row.capacity, format(r.contributions[i], 8)]));
      case 'stack':
        return table(['Звено', 'Знак', 'Мин., мм', 'Макс., мм'],
          input.rows.map((row, i) => [i + 1, row.sign > 0 ? '+' : '−', row.nominal + row.lower, row.nominal + row.upper]));
      case 'spline':
        return table(['Параметр', 'Значение'], [['Окружная нагрузка, Н', r.force], ['Рабочая площадь, мм²', r.area],
          ['Допускаемое давление, МПа', input.allowed], ['Среднее давление, МПа', r.pressure]]);
      case 'bearing':
        return table(['Параметр', 'Значение'], [['Базовая надёжность', '90%'], ['Превышение требуемого ресурса, раз', r.hours / input.target],
          ['Отношение C/P', input.dynamic / input.load]]);
      case 'hydraulic':
        return table(['Параметр', 'Значение'], [['Полная площадь поршня, мм²', Math.PI * input.bore ** 2 / 4],
          ['Площадь штока, мм²', Math.PI * input.rod ** 2 / 4], ['Активная площадь, мм²', r.area]]);
      case 'motion':
        return table(['Параметр', 'Значение'], [['Минимум x, мм', input.rod - input.radius], ['Максимум x, мм', input.rod + input.radius]]);
      default: return '';
    }
  }

  function redrawPlot() {
    const canvas = document.getElementById('plot');
    if (!canvas || !state.tool) return;
    if (state.result && state.tool.chart) Draw.chart(canvas, state.tool.chart(state.result, state.input));
    else Draw.plot(canvas, state.id, state.result, state.input, state);
  }

  function updateButtons() {
    const report = main.querySelector('[data-action=report]');
    if (report) report.disabled = !state.result;
    main.querySelectorAll('.transfer-button').forEach(button => { button.disabled = !state.result; });
    const stage = main.querySelector('#transfer-stage');
    if (stage) {
      const count = state.result?.stages.length ?? 0;
      stage.disabled = count === 0;
      if (stage.options.length !== count) {
        const prior = Number(stage.value);
        stage.replaceChildren(...Array.from({ length: count }, (_, i) => new Option(`Ступень ${i + 1}`, i + 1)));
        if (count > 0) stage.value = Math.min(prior || count, count);
      }
    }
    const dxf = main.querySelector('[data-action=dxf]');
    if (dxf) dxf.disabled = state.view === 'pair' ? !state.profiles.pinion || !state.profiles.wheel : !state.profiles[state.view];
  }

  function download(payload, name, mime) {
    const blob = payload instanceof Blob ? payload : new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function exportProject() {
    const data = Object.fromEntries(Object.entries(tools).map(([id, tool]) => [id, { ...defaultInput(tool), ...read(id) }]));
    const current = Object.hasOwn(tools, state.id) ? state.id : 'gearbox';
    download(JSON.stringify({ format: 'softneer-project', version: 1, current, calculations: data }, null, 2), 'project.softneer.json', 'application/json');
  }

  function projectFields(definitions, data, defaults) {
    return Object.fromEntries(definitions.map(def => {
      const raw = data[def.key];
      const allowed = (typeof raw === 'string' && raw.length <= 120) || Number.isFinite(raw);
      return [def.key, allowed ? raw : defaults[def.key]];
    }));
  }

  async function importProject(file) {
    try {
      if (file.size > 256 * 1024) throw new Error('Файл проекта превышает 256 КБ.');
      const data = JSON.parse(await file.text());
      if (!data || data.format !== 'softneer-project' || data.version !== 1 || !data.calculations || typeof data.calculations !== 'object') {
        throw new Error('Выберите файл расчётов Softneer формата 1.');
      }
      const drafts = Object.entries(tools).flatMap(([id, tool]) => {
        const source = data.calculations[id];
        if (!source || typeof source !== 'object') return [];
        const defaults = defaultInput(tool);
        const draft = projectFields(tool.fields, source, defaults);
        if (tool.rows) draft.rows = validRowCount(source.rows, tool.rows)
          ? source.rows.map((row, i) => projectFields(tool.rows.fields, row, defaults.rows[i] || defaults.rows[0]))
          : defaults.rows;
        if (id === 'pump' && source.linkedNetwork && validRowCount(source.linkedNetwork.rows, tools.pipeline.rows)) {
          const network = source.linkedNetwork;
          const rows = network.rows.map(row => Object.fromEntries(tools.pipeline.rows.fields.map(def => [def.key, parseField(row[def.key], def)])));
          const viscosity = parseField(network.viscosity, { key: 'viscosity' });
          if (Number.isFinite(viscosity) && rows.every(row => Object.values(row).every(Number.isFinite))) draft.linkedNetwork = { rows, viscosity };
        }
        return [[id, draft]];
      });
      if (!drafts.length) throw new Error('В файле нет поддерживаемых модулей расчёта.');
      drafts.forEach(([id, draft]) => write(id, draft));
      const current = Object.hasOwn(tools, data.current) ? data.current : drafts[0][0];
      if (location.hash === '#' + current) route();
      else location.hash = current;
      announce(`Загружены исходные данные разделов: ${drafts.length}.`);
    } catch (error) {
      announce(error instanceof SyntaxError ? 'Файл проекта не содержит корректный JSON.' : error.message);
    }
  }

  function report() {
    if (!state.result) return;
    const { input, metrics, result, tool, id } = state;
    const clean = Object.fromEntries(Object.entries(result).filter(([key]) => !['warnings'].includes(key)));
    const report = {
      version: '0.2.0', versionMethod: 1, module: id, name: tool.name,
      createdAt: new Date().toISOString(),
      input,
      inputUnits: Object.fromEntries(tool.fields.filter(item => item.unit && item.key in input).map(item => [item.key, item.unit])),
      metrics: metrics.map(({ label, value, unit }) => ({ label, value, unit })), details: clean,
      messages: document.getElementById('calc-notice').textContent,
      method: tool.method, sources: tool.sources.map(([name, url]) => ({ name, url }))
    };
    const json = JSON.stringify(report, (key, value) => value === Infinity ? 'Infinity' : value, 2);
    download(json, `softneer-${id}.json`, 'application/json');
    announce('Отчёт подготовлен');
  }

  function exportDxf() {
    if (!state.result) return;
    const { view, profiles, result } = state;
    const filename = `softneer-${view}-z${result.pinion.z}-${result.wheel.z}.dxf`;
    const outlineName = 'Softneer reference involute, simplified transition';
    if (view === 'pair') {
      if (!profiles.pinion || !profiles.wheel) return;
      const angle = Math.PI - Math.PI / result.wheel.z;
      const wheel = profiles.wheel.map(([x, y]) => [
        result.center + x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)
      ]);
      download(E.gearDxf(profiles.pinion, outlineName, wheel), filename, 'application/dxf');
    } else if (profiles[view]) {
      download(E.gearDxf(profiles[view], outlineName), filename, 'application/dxf');
    }
  }

  function setMotionAngle(angle) {
    state.theta = angle;
    const slider = main.querySelector('#motion-angle');
    const degrees = main.querySelector('#motion-degrees');
    if (slider) slider.value = Math.round(angle);
    if (degrees) degrees.value = `${Math.round(angle)}°`;
    evaluate({ frame: true });
  }

  function stopMotion() {
    if (motionFrame !== undefined) cancelAnimationFrame(motionFrame);
    motionFrame = undefined;
    state.playing = false;
    const control = main.querySelector('[data-action=motion-play]');
    if (control) {
      control.innerHTML = mark('play') + 'Пуск';
      control.setAttribute('aria-pressed', 'false');
    }
  }

  function playMotion() {
    if (state.playing) { stopMotion(); return; }
    if (!state.result || state.input.rpm <= 0) {
      announce('Задайте положительные обороты для анимации');
      return;
    }
    state.playing = true;
    let last = performance.now();
    const control = main.querySelector('[data-action=motion-play]');
    control.innerHTML = mark('pause') + 'Пауза';
    control.setAttribute('aria-pressed', 'true');
    function move(now) {
      if (state.id !== 'motion' || !state.playing || !state.result || state.input.rpm <= 0) { stopMotion(); return; }
      if (now - last >= 20) {
        setMotionAngle((state.theta + (now - last) * state.input.rpm * 0.006) % 360);
        last = now;
      }
      motionFrame = requestAnimationFrame(move);
    }
    motionFrame = requestAnimationFrame(move);
  }

  function renderHandbook(target) {
    const topics = [...new Set(articles.map(article => article.subject))];
    const selected = articles.find(article => article.id === target);
    state = { id: 'handbook', category: 'all', query: '', focusArticle: selected?.id };
    main.innerHTML = `<div class="page">
      ${pageHeader(extras.handbook, 'Методики, формулы и ссылки на ГОСТ, ISO и DIN.')}
      <div class="filterbar"><input class="inline-search" id="filter-input" aria-label="Поиск по справочнику" placeholder="Тема, термин или стандарт">
        ${tabButtons([['all', 'Все темы'], ...topics.map(topic => [topic, topic])], 'all', 'filter')}</div>
      <div class="card-grid" id="listing"></div>
    </div>`;
    renderArticles();
    if (selected) requestAnimationFrame(() => document.getElementById(`article-${selected.id}`)?.scrollIntoView({ block: 'center' }));
  }

  function renderArticles() {
    const entries = articles.filter(article => (state.category === 'all' || state.category === article.subject)
      && matches([article.title, article.subject, article.intro, ...article.steps, ...article.refs.map(ref => ref[0])].join(' '), state.query));
    main.querySelector('#listing').innerHTML = entries.length ? entries.map(article => `<article class="panel ref-card" id="article-${article.id}">
      <span class="standard-badge">${article.subject}</span><h2>${article.title}</h2><p>${article.intro}</p>
      <details${article.id === state.focusArticle ? ' open' : ''}><summary>Открыть статью</summary>
        <ul>${article.steps.map(step => `<li>${step}</li>`).join('')}</ul>
        <p>${links(article.refs)}</p>
        ${article.route ? `<p><a href="#${article.route}">Перейти к расчёту</a></p>` : ''}
      </details></article>`).join('') : '<p class="empty">Статьи по этим условиям не найдены.</p>';
  }

  function openCatalogDatabase() {
    if (!catalogDatabase) {
      catalogDatabase = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('Нет IndexedDB')); return; }
        const request = indexedDB.open('softneer.step', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('parts', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Хранилище заблокировано другой копией приложения.'));
      });
    }
    return catalogDatabase;
  }

  async function catalogOperation(mode, callback) {
    const database = await openCatalogDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('parts', mode);
      const request = callback(transaction.objectStore('parts'));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(transaction.error || new Error('Операция прервана'));
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function renderCatalog(target) {
    const specific = CAD.catalog.find(item => item.id === target);
    state = { id: 'catalog', category: specific?.group || 'all', query: specific?.size || '' };
    const categories = [
      ['all', `Все (${CAD.catalog.length})`],
      ...Object.entries(CAD.groups).map(([id, group]) => [id, group.label]), ['own', 'Мои файлы']
    ];
    main.innerHTML = `<div class="page">
      ${pageHeader(extras.catalog, 'Номинальные модели для компоновки и собственные STEP-файлы.', button('import', 'Добавить STEP', 'upload', 'primary'))}
      <input type="file" id="step-input" accept=".step,.stp" multiple hidden>
      <div class="filterbar"><input class="inline-search" id="filter-input" aria-label="Поиск изделия" placeholder="Размер, обозначение или стандарт" value="${text(state.query)}">
        ${tabButtons(categories, state.category, 'filter')}</div>
      <div class="card-grid" id="listing"></div>
    </div>`;
    renderParts();
    if (!catalogReady) {
      catalogReady = catalogOperation('readonly', store => store.getAll()).then(records => {
        imported = records;
        if (state.id === 'catalog') renderParts();
      }).catch(() => { /* An unavailable IndexedDB can be replaced by session memory. */ });
    }
  }

  function renderParts() {
    const parts = state.category === 'own' ? [] : CAD.catalog.filter(part => (state.category === 'all' || part.group === state.category)
      && matches(`${part.title} ${part.size} ${part.standard}`, state.query));
    const own = state.category === 'all' || state.category === 'own'
      ? imported.filter(item => matches(item.name, state.query)) : [];
    const listing = main.querySelector('#listing');
    listing.innerHTML = parts.map(part => `<article class="panel catalog-card">
      <canvas data-part="${part.id}" role="img" aria-label="Модель ${text(part.title)} ${text(part.size)}"></canvas>
      <div class="panel-body"><span class="standard-badge">${text(part.standard)}</span>
        <h2>${text(part.title)} ${text(part.size)}</h2>
        <p class="dims">${Object.entries(part.dims).map(([key, value]) => `${key} ${format(value)}`).join(' · ')} мм</p>
        <p>${text(part.note)}</p>
        <div class="form-actions"><button type="button" class="button primary" data-action="part-download" data-value="${part.id}">${mark('download')}STEP</button>
          <a class="standard-badge" href="${text(part.url)}" target="_blank" rel="noopener noreferrer">Источник</a></div>
      </div></article>`).join('') + own.map(part => `<article class="panel catalog-card"><div class="panel-body">
      <span class="standard-badge">Мой файл</span><h2>${text(part.name)}</h2><p>${format(part.file.size / 1024, 1)} КБ</p>
      <div class="form-actions"><button type="button" class="button primary" data-action="own-download" data-value="${text(part.id)}">${mark('download')}STEP</button>
        <button type="button" class="icon-button" aria-label="Удалить ${text(part.name)} из каталога" data-action="own-delete" data-value="${text(part.id)}">${svg('trash')}</button></div>
      </div></article>`).join('');
    if (!parts.length && !own.length) listing.innerHTML = '<p class="empty">Для этих условий файлов нет.</p>';
    listing.querySelectorAll('canvas').forEach(canvas => Draw.catalogPreview(canvas, CAD.catalog.find(part => part.id === canvas.dataset.part)));
  }

  async function importSteps(files) {
    await catalogReady;
    let added = 0;
    let temporary = 0;
    let rejected = 0;
    for (const file of files) {
      try {
        const start = await file.slice(0, 1024).text();
        const end = await file.slice(Math.max(0, file.size - 1024)).text();
        if (!/\.st(e)?p$/i.test(file.name) || !/^\s*ISO-10303-21;/i.test(start) || !/END-ISO-10303-21;\s*$/i.test(end)) {
          rejected++;
          continue;
        }
        const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const item = { id, name: file.name, file };
        try { await catalogOperation('readwrite', store => store.add(item)); }
        catch { item.temporary = true; temporary++; }
        imported.push(item);
        added++;
      } catch { rejected++; }
    }
    if (state.id === 'catalog' && added) {
      state.category = 'own';
      state.query = '';
      main.querySelector('#filter-input').value = '';
      main.querySelectorAll('[data-action=filter]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.value === 'own')));
      renderParts();
    }
    announce([`Добавлено: ${added}.`, temporary ? `До закрытия вкладки: ${temporary}.` : '', rejected ? `Не распознано: ${rejected}.` : ''].filter(Boolean).join(' '));
  }

  async function deletePart(id) {
    const item = imported.find(record => record.id === id);
    if (!item) return;
    if (!item.temporary) {
      try { await catalogOperation('readwrite', store => store.delete(id)); }
      catch { announce('Не удалось удалить файл из хранилища'); return; }
    }
    imported = imported.filter(record => record.id !== id);
    if (state.id === 'catalog') renderParts();
    announce('Запись удалена из каталога');
  }

  function renderSearch() {
    const query = searchInput.value;
    const attachments = articles.map(article => ({
      title: article.title, group: article.subject, route: `handbook/${article.id}`,
      haystack: [article.title, article.subject, article.intro, ...article.steps, ...article.refs.map(ref => ref[0])].join(' ')
    }));
    const catalog = query.trim() ? CAD.catalog.map(part => ({
      title: `${part.title} ${part.size}`, group: part.standard, route: `catalog/${part.id}`,
      haystack: `${part.title} ${part.size} ${part.standard}`
    })) : [];
    const entries = [...Object.entries(pages).map(([id, page]) => ({
      title: page.name, group: page.group, route: id, haystack: `${page.name} ${page.nav} ${page.subtitle || ''}`
    })), ...attachments, ...catalog].filter(item => matches(item.haystack, query)).slice(0, 14);
    document.getElementById('search-results').innerHTML = entries.length ? entries.map(item =>
      `<a class="search-hit" href="#${item.route}"><span>${text(item.title)}</span><small>${text(item.group)}</small></a>`).join('')
      : '<p class="empty">По этому запросу ничего не найдено.</p>';
  }

  function openSearch() {
    if (searchDialog.open) return;
    closeNav();
    searchInput.value = '';
    renderSearch();
    searchDialog.showModal();
    searchInput.focus();
  }

  function route() {
    const [path, target] = location.hash.slice(1).split('/');
    const id = Object.hasOwn(pages, path) ? path : location.protocol === 'softneer:' ? 'gearbox' : 'gear';
    const page = pages[id];
    stopMotion();
    if (resizeObserver) resizeObserver.disconnect();
    closeNav();
    nav.innerHTML = navMarkup(id);
    breadcrumb.innerHTML = `<span>${page.group}</span><span>${svg('chevron')}</span><strong>${page.nav}</strong>`;
    document.title = `${page.name} | Softneer`;
    window.scrollTo(0, 0);
    if (id === 'handbook') renderHandbook(target);
    else if (id === 'catalog') renderCatalog(target);
    else renderTool(id);
  }

  function handleAction(control) {
    const { action, value, index } = control.dataset;
    switch (action) {
      case 'reset': {
        const id = state.id;
        write(id, defaultInput(state.tool));
        stopMotion();
        resizeObserver?.disconnect();
        renderTool(id);
        main.querySelector('[data-action=reset]').focus();
        break;
      }
      case 'report': report(); break;
      case 'dxf': exportDxf(); break;
      case 'strength-transfer':
      case 'shaft-transfer':
      case 'pump-transfer': transfer(action); break;
      case 'gear-view':
        state.view = value;
        main.querySelectorAll('[data-action=gear-view]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === control)));
        updateButtons();
        redrawPlot();
        break;
      case 'add-row':
      case 'delete-row': {
        if (action === 'add-row') {
          state.raw.rows.push(Object.fromEntries(state.tool.rows.fields.map(item => [item.key, item.value])));
        } else {
          state.raw.rows.splice(Number(index), 1);
        }
        write(state.id, state.raw);
        main.querySelector('#row-editor').innerHTML = rowMarkup();
        evaluate();
        const rowIndex = action === 'add-row' ? state.raw.rows.length - 1 : Math.min(Number(index), state.raw.rows.length - 1);
        main.querySelector(`[data-row="${rowIndex}"]`)?.focus();
        break;
      }
      case 'motion-play': playMotion(); break;
      case 'filter':
        state.category = value;
        main.querySelectorAll('[data-action=filter]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === control)));
        if (state.id === 'handbook') renderArticles();
        else renderParts();
        break;
      case 'part-download': {
        const part = CAD.catalog.find(item => item.id === value);
        if (part) download(CAD.partStep(part), `${part.id}.step`, 'model/step');
        break;
      }
      case 'own-download': {
        const part = imported.find(item => item.id === value);
        if (part) download(part.file, part.name, 'model/step');
        break;
      }
      case 'own-delete': deletePart(value); break;
      case 'import': main.querySelector('#step-input').click(); break;
    }
  }

  function transfer(action) {
    if (!state.result) return;
    if (action === 'pump-transfer') {
      const { density, viscosity, staticHead, rows } = state.input;
      write('pump', { ...defaultInput(tools.pump), ...read('pump'), density, staticHead,
        system: 'network', linkedNetwork: { viscosity, rows } });
      location.hash = 'pump';
      announce('Геометрия трубопроводов передана в расчёт насоса');
      return;
    }
    const selected = main.querySelector('#transfer-stage');
    const index = selected ? Number(selected.value) - 1 : -1;
    const stage = state.result.stages?.at(index);
    if (action === 'strength-transfer') {
      const ft = stage?.ft ?? state.result.ftReference ?? state.result.ft;
      if (ft <= 0) { announce('Для расчёта прочности задайте ненулевую нагрузку'); return; }
      const patch = { ft, ratio: stage?.ratio ?? state.result.ratio,
        diameter: stage?.d1 ?? state.result.pinion.radius * 2,
        module: stage ? state.input.rows[index].module : state.input.module };
      if (state.id === 'helical') patch.width = state.input.width;
      write('tooth', { ...defaultInput(tools.tooth), ...read('tooth'), ...patch });
      location.hash = 'tooth';
      announce('Геометрия и окружная сила переданы. Проверьте коэффициенты прочности.');
      return;
    }
    const shaft = { ...defaultInput(tools.shaft), ...read('shaft') };
    const span = parseField(shaft.span, tools.shaft.fields[0]);
    shaft.rows = [{ x: (span > 0 ? span : 180) / 2, fy: -stage.ft, fz: -stage.fr }];
    shaft.torque = stage.torqueOut;
    shaft.rpm = stage.nOut;
    write('shaft', shaft);
    location.hash = 'shaft';
    announce('Нагрузка приложена в середине вала. Уточните координату и знаки сил.');
  }

  main.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (control) handleAction(control);
  });

  main.addEventListener('input', event => {
    const control = event.target;
    if (control.id === 'motion-angle') {
      stopMotion();
      setMotionAngle(Number(control.value));
    } else if (control.id === 'filter-input') {
      state.query = control.value;
      if (state.id === 'handbook') renderArticles();
      else renderParts();
    } else if (control.closest('#parameters') && control.name) {
      if (control.dataset.row !== undefined) state.raw.rows[Number(control.dataset.row)][control.name] = control.value;
      else state.raw[control.name] = control.value;
      write(state.id, state.raw);
      evaluate();
    }
  });

  main.addEventListener('change', event => {
    if (event.target.id === 'step-input') {
      const files = [...event.target.files];
      event.target.value = '';
      if (files.length) importSteps(files);
    }
  });
  menuToggle.addEventListener('click', () => {
    menuToggle.setAttribute('aria-expanded', String(sidebar.classList.toggle('open')));
  });
  document.addEventListener('click', event => {
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !menuToggle.contains(event.target)) closeNav();
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeNav();
  });
  document.getElementById('global-search').addEventListener('click', openSearch);
  const projectMenu = document.getElementById('project-menu');
  const projectInput = document.getElementById('project-input');
  document.getElementById('project-open').addEventListener('click', () => {
    projectMenu.open = false;
    projectInput.click();
  });
  document.getElementById('project-save').addEventListener('click', () => {
    projectMenu.open = false;
    exportProject();
  });
  projectInput.addEventListener('change', () => {
    const file = projectInput.files[0];
    projectInput.value = '';
    if (file) importProject(file);
  });
  document.addEventListener('click', event => {
    if (projectMenu.open && !projectMenu.contains(event.target)) projectMenu.open = false;
  });
  document.getElementById('search-close').addEventListener('click', () => searchDialog.close());
  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchDialog.querySelector('.search-hit')?.click();
  });
  searchDialog.addEventListener('click', event => {
    const target = event.target.closest('.search-hit');
    if (target) {
      searchDialog.close();
      if (target.hash === location.hash) route();
    }
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') closeNav();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => {
    if (state.id === 'catalog') renderParts();
    else if (!('ResizeObserver' in window)) redrawPlot();
  });
  route();
})();
