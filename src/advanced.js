(function (root) {
  'use strict';

  const H = root.SoftneerHydro;
  const D = root.SoftneerDrivetrain;
  const hydroBook = ['Никитин, Яроц · учебник, 2019', 'https://library.bmstu.ru/Catalog/Details/548589'];
  const epanet = ['EPA · EPANET 2.2, формулы сопротивления', 'https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P10113EM.txt'];
  const pumpRef = ['KSB · рабочая точка', 'https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/operating-point-1117036'];
  const iso6336 = ['ISO 6336-1:2019', 'https://www.iso.org/standard/63819.html'];
  const iso2 = ['ISO 6336-2:2019', 'https://www.iso.org/standard/63821.html'];
  const iso3 = ['ISO 6336-3:2019', 'https://www.iso.org/standard/63822.html'];
  const beam = ['MIT · прогиб балки', 'https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/13534abb67b86d2fb8ee11a1f4f2b8c4_MIT3_11F99_bdisp.pdf'];
  const iso281 = ['ISO 281:2007', 'https://www.iso.org/standard/38102.html'];
  const gearRef = ['KHK · геометрия зубчатых передач', 'https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html'];

  const n = (key, label, value, unit = '', wide = false) => ({ key, label, value, unit, wide });
  const s = (key, label, value, options, wide = true) => ({ key, label, value, options, wide });
  const m = (label, value, unit = '', digits = 2, icon = 'chart') => ({ label, value, unit, digits, icon });
  const rows = (columns, examples, limits = {}) => ({
    labels: columns.map(column => column[1]),
    fields: columns.map(([key, , fallback]) => n(key, '', fallback)),
    defaults: examples.map(values => Object.fromEntries(columns.map(([key], i) => [key, values[i]]))),
    ...limits
  });
  const values = entries => ({ headings: ['Параметр', 'Значение'], rows: entries });
  const details = (headings, data) => ({ headings, rows: data });
  const group = 'Системы передач';
  const hydraulic = 'Гидравлика';
  const density = n('density', 'Плотность ρ', 998, 'кг/м³');
  const viscosity = n('viscosity', 'Кин. вязкость ν', 1.004, 'мм²/с');
  const tools = {
    gearbox: {
      nav: 'Система редуктора', name: 'Система редуктора', group, icon: 'branch',
      subtitle: 'Поток мощности, кинематика, силы и тепловой баланс последовательных ступеней.',
      fields: [n('power', 'Мощность на входе P₁', 15, 'кВт'), n('rpm', 'Обороты входа n₁', 1450, 'об/мин'),
        n('ambient', 'Температура среды', 25, '°C'), n('ua', 'Теплопроводность к среде UA', 28, 'Вт/К')],
      rows: rows([['module','m, мм',3], ['z1','z₁',24], ['z2','z₂',60], ['angle','α, °',20], ['efficiency','КПД',0.97]],
        [[3, 24, 60, 20, .97], [4, 22, 66, 20, .96]], { max: 12 }),
      actions: [['shaft-transfer', 'Нагрузки вала колеса', 'branch'], ['strength-transfer', 'Прочность ступени', 'gear']],
      note: 'Введите ступени в порядке передачи мощности. КПД каждой ступени — доля от 0 до 1. Соседние ступени имеют общий вал.',
      method: 'n₂ = n₁/u, P₂ = ηP₁, T = 30 000P/(πn). Потери равны разности мощностей. Для установившейся температуры используется заданное UA: T = Tср + ΣPпотерь/UA. Это модель с последовательными внешними прямозубыми ступенями и постоянным КПД.',
      sources: [iso6336], calc: D.gearbox, wide: true,
      plot: ['Мощность по валам', 'ПЕРЕДАЧА МОЩНОСТИ · КВТ'],
      metrics: r => [m('Общее отношение', r.ratio, '', 3, 'branch'), m('Выходной момент', r.torque, 'Н·м', 1, 'gear'),
        m('Общий КПД', r.efficiency, '%', 2, 'activity'), m('Температура', r.temperature, '°C', 1, 'drop')],
      detail: r => details(['Ступень', 'i', 'a, мм', 'n₁', 'n₂', 'P₁, кВт', 'P₂, кВт', 'T₁, Н·м', 'T₂, Н·м', 'Fₜ, Н', 'Fᵣ, Н', 'Потери, кВт', 'Вращ.'],
        r.stages.map(t => [t.index, t.ratio, t.center, t.nIn, t.nOut, t.powerIn, t.powerOut, t.torqueIn, t.torqueOut, t.ft, t.fr, t.loss, t.speedSign > 0 ? '+' : '−'])),
      chart: r => ({ x: 'Вал', y: 'кВт', series: [['Мощность', [[0, r.stages[0].powerIn], ...r.stages.map(t => [t.index, t.powerOut])]]], minY: 0, integerX: true })
    },
    helical: {
      nav: 'Косозубая передача', name: 'Косозубая передача со смещением', group, icon: 'gear',
      subtitle: 'Рабочая геометрия, торцовое и осевое перекрытие, усилия по трём осям.',
      fields: [n('module','Нормальный модуль mₙ',3,'мм'),n('angle','Нормальный угол αₙ',20,'°'),n('z1','Зубья шестерни z₁',21),n('z2','Зубья колеса z₂',58),
        n('helix','Наклон шестерни β',18,'°'),n('width','Рабочая ширина b',32,'мм'),n('x1','Смещение шестерни x₁',0.32),n('x2','Смещение колеса x₂',0.04),
        n('torque','Входной момент',120,'Н·м'),n('rpm','Обороты шестерни',1450,'об/мин')],
      actions: [['strength-transfer','Прочность зубьев','gear']],
      note: 'Внешняя пара, параллельные оси, противоположное направление винтовых линий, исходный контур 1/1,25mₙ. Знак осевой составляющей относится к заданному знаку винтовой линии.',
      method: 'mₜ=mₙ/cos β, tan αₜ=tan αₙ/cos β, inv αw=inv αₜ+2tan αₙ(x₁+x₂)/(z₁+z₂). Силы определены по рабочему диаметру и углам. В расчёт прочности переносится номинальная сила по делительному диаметру. Проверьте коэффициенты и условия изготовления по стандарту.',
      sources: [gearRef, iso6336], calc: D.helicalPair,
      plot: ['Силы в зацеплении','РАБОЧИЕ КОМПОНЕНТЫ · Н'],
      metrics: r => [m('Рабочее межосевое',r.center,'мм',3,'ruler'),m('Рабочий угол αw',r.workingAngle,'°',3,'gear'),
        m('Суммарное перекрытие',r.contact+r.faceContact,'',3,'layers'),m('Осевая сила',r.fa,'Н',1,'activity')],
      detail: r => details(['Параметр','Шестерня','Колесо'],[
        ...[['Делительный диаметр, мм','radius'],['Рабочий диаметр, мм','working'],['Диаметр вершин, мм','tip'],['Диаметр впадин, мм','root'],['Основной диаметр, мм','base']]
          .map(([label,key])=>[label,2*r.pinion[key],2*r.wheel[key]]),
        ['Толщина вершины, мм',r.pinion.tipThickness,r.wheel.tipThickness],['Торцовое / осевое перекрытие',r.contact,r.faceContact],
        ['Рабочая окружная сила Fₜ, Н',r.ft,r.ft],['Радиальная сила Fᵣ, Н',r.fr,r.fr],['Выходные обороты, об/мин','—',r.outputRpm]
      ]),
      chart: r => ({ y:'Н',bars:[{label:'Fₜ',value:r.ft},{label:'Fᵣ',value:r.fr},{label:'Fₐ',value:r.fa}] })
    },
    shaft: {
      nav: 'Валы и опоры', name: 'Вал на двух опорах', group, icon: 'bearing',
      subtitle: 'Изгиб в двух плоскостях, кручение, реакции и базовый ресурс подшипников.',
      fields: [n('span', 'Пролёт между опорами L', 180, 'мм'), n('diameter', 'Диаметр сплошного вала', 40, 'мм'),
        n('young', 'Модуль упругости E', 210, 'ГПа'), n('torque', 'Макс. момент кручения', 300, 'Н·м'),
        n('rpm', 'Обороты вала', 250, 'об/мин'), s('bearingType', 'Тип обеих опор', 'ball', [['ball','Шариковые'], ['roller','Роликовые']], false),
        n('cA', 'Грузоподъёмность C опоры A', 30, 'кН'), n('cB', 'Грузоподъёмность C опоры B', 30, 'кН')],
      rows: rows([['x','x, мм',90], ['fy','Fᵧ, Н',0], ['fz','F_z, Н',0]], [[80, -2600, 1000], [135, 1250, -300]]),
      note: 'A в x = 0, B в x = L. Силы задаются со знаками в поперечных направлениях. x < 0 или x > L означает консольную нагрузку.',
      method: 'Реакции из равновесия, прогиб — интегрированием EI·v″ = M в двух плоскостях. σ = 32M/(πd³), τ = 16T/(πd³), σэкв = √(σ² + 3τ²). Максимальный прогиб оценивается по дискретной сетке. Ресурс L₁₀ принят при P = √(Rᵧ²+Rᶻ²), без осевых сил. Концентраторы, усталость и критические скорости требуют отдельных моделей.',
      sources: [beam, iso281], calc: D.shaft, wide: true,
      plot: ['Эпюра изгибающего момента', 'РЕЗУЛЬТИРУЮЩИЙ МОМЕНТ · Н·М'],
      metrics: r => [m('Максимальный момент',r.bending,'Н·м',2,'activity'), m('Модуль прогиба',r.deflection,'мм',4,'ruler'),
        m('Экв. напряжение',r.stress,'МПа',2,'layers'), m('Меньший ресурс L₁₀h',Math.min(r.lifeA,r.lifeB),'ч',1,'time')],
      detail: r => details(['Опора','Rᵧ, Н','Rᶻ, Н','Радиальная, Н','L₁₀h, ч'], [['A',r.ay,r.az,r.fa,r.lifeA],['B',r.by,r.bz,r.fb,r.lifeB]]),
      chart: r => ({ x: 'x, мм', y: 'Н·м', series: [['M', r.curve.map(p => [p.x,p.moment])]], minY: 0 })
    },
    tooth: {
      nav: 'Прочность зубьев ISO 6336', name: 'Прочность зубьев ISO 6336', group, icon: 'gear',
      subtitle: 'Контактное напряжение и изгиб зуба по заданным нормативным коэффициентам.',
      fields: [
        n('ft','Окружная сила Fₜ',2500,'Н'), n('ratio','Отношение u',2), n('diameter','Диаметр шестерни d₁',60,'мм'),
        n('width','Рабочая ширина b',25,'мм'), n('module','Нормальный модуль mₙ',2.5,'мм'),
        n('ka','K_A · режим работы',1.25), n('kv','K_V · динамика',1.1), n('khb','K_Hβ · по ширине',1.15), n('kha','K_Hα · по профилю',1.05),
        n('kfb','K_Fβ · по ширине',1.1), n('kfa','K_Fα · по профилю',1.05),
        n('zh','Z_H · зона контакта',2.5), n('ze','Z_E · упругость',189.8,'√МПа'), n('zeps','Z_ε · перекрытие',0.9),
        n('zbeta','Z_β · наклон',1), n('ybeta','Y_β · наклон',1), n('sh','Требуемый S_H',1.15), n('sf','Требуемый S_F',1.4)
      ],
      rows: rows([['zsingle','Z_B / Z_D',1],['yf','Y_F',2.7],['ys','Y_S',1.6],['yb','Y_B',1],['ydt','Y_DT',1],
        ['contactLimit','σ_HG, МПа',1150],['rootLimit','σ_FG, МПа',420]],
        [[1,2.7,1.6,1,1,1150,420],[1,2.45,1.7,1,1,1050,390]], { fixed: true, names: ['Шестерня', 'Колесо'] }),
      note: 'Числа в примере иллюстративные. Подставьте коэффициенты для конкретной геометрии, материалов и режима. σ_HG и σ_FG — предельные напряжения с поправками ресурса и условий работы до деления на требуемые запасы.',
      method: 'σ_H0 = Z_H Z_E Z_ε Z_β √[Fₜ(u+1)/(bd₁u)]. Фактическое σ_H получают с Z_B или Z_D и √(K_A K_V K_Hβ K_Hα). σ_F = Fₜ/(bmₙ) · Y_F Y_S Y_β Y_B Y_DT · K_A K_V K_Fβ K_Fα. Коэффициенты определяются вне этого расчёта по применимой редакции ISO 6336.',
      sources: [iso6336, iso2, iso3], calc: D.toothStrength, wide: true,
      plot: ['Напряжения шестерни и колеса', 'КОНТАКТ И ИЗГИБ · МПА'],
      metrics: r => [m('Контактный запас S_H',r.contactSafety,'',3,'layers'), m('Запас по изгибу S_F',r.rootSafety,'',3,'layers'),
        m('Номинал σ_H0',r.contactBase,'МПа',1,'activity'), m('Нагрузка K_A·K_V·K_Hβ·K_Hα',r.kh,'',3)],
      detail: r => details(['Элемент','σ_H, МПа','S_H','σ_F, МПа','S_F'],
        r.gears.map(g => [g.gear,g.contact,g.contactSafety,g.root,g.rootSafety])),
      chart: r => ({ y: 'МПа', bars: r.gears.flatMap(g => [
        { label: `${g.gear} σH`, value: g.contact }, { label: `${g.gear} σF`, value: g.root }
      ]) })
    },
    pipeline: {
      nav: 'Сеть трубопроводов', name: 'Сеть трубопроводов', group: hydraulic, icon: 'branch',
      subtitle: 'Потери напора и распределение расхода по последовательным и параллельным участкам.',
      fields: [density, viscosity, s('mode', 'Режим расчёта', 'flow', [['flow','По заданному расходу'],['head','По заданному напору']]),
        { ...n('flow','Общий расход Q',120,'л/мин'), mode: 'flow' },
        { ...n('available','Доступный полный напор',12,'м'), mode: 'head' },
        n('staticHead','Статический напор Hст',5,'м')],
      rows: rows([['group','Группа',1], ['length','L, м',12], ['diameter','D, мм',32], ['roughness','ε, мм',0.045], ['local','Σζ',2]],
        [[1,18,50,0.045,2.5],[2,12,32,0.045,2],[2,16,40,0.045,3]]),
      actions: [['pump-transfer','Связать с насосом','drop']],
      note: 'Одинаковый номер группы означает параллельные ветви с общим перепадом. Группы соединены последовательно по возрастанию номера. Hст задаёт разность геодезического и пьезометрического напоров на границах.',
      method: 'h = (λL/D + Σζ)v²/(2g). В ламинарном режиме λ = 64/Re, в турбулентном используется уравнение Кольбрука. В переходной зоне используется интерполяция и отображается предупреждение. В каждой параллельной группе решается ΣQᵢ = Q при одинаковом hᵢ. Скачки кинетического напора на внешних границах модели учитывайте в Hст при необходимости.',
      sources: [hydroBook, epanet], calc: H.pipeline, wide: true,
      plot: ['Потери напора по участкам', 'ИНДЕКСЫ СТРОК · М'],
      metrics: r => [m('Общий расход',r.flow,'л/мин',3,'drop'),m('Полный напор',r.head,'м',3,'ruler'),
        m('Потери',r.loss,'м',3,'activity'),m('Эквивалентный перепад',r.pressure,'бар',3)],
      detail: r => details(['Строка','Группа','Q, л/мин','v, м/с','Re','λ','h_тр, м','h_мест, м','h, м','Режим'],
        r.sections.map(x => [x.index,x.group,x.flow,x.velocity,x.reynolds,x.lambda,x.distributed,x.local,x.loss,x.regime])),
      chart: r => ({ y: 'м', bars: r.sections.map(x => ({ label: String(x.index), value: x.loss })) })
    },
    pump: {
      nav: 'Насос и рабочая точка', name: 'Рабочая точка насоса', group: hydraulic, icon: 'drop',
      subtitle: 'Пересечение характеристик Q–H, требуемая мощность и запас NPSH.',
      fields: [
        density, n('staticHead','Статический напор',5,'м'),
        s('system','Кривая системы','quadratic',[['quadratic','Hст + k·Q²'],['network','Модель трубопроводов из проекта']]),
        { ...n('resistance','Коэффициент k',0.0018,'м/(л/мин)²',true), mode:'quadratic', modeKey:'system' },
        n('inlet','Давление над жидкостью',1.01325,'бар абс.'), n('vapour','Давление паров',0.0234,'бар абс.'),
        n('suctionHeight','Уровень минус ось насоса',1.2,'м'), n('suctionLoss','Потери на всасывании',0.9,'м')
      ],
      rows: rows([['flow','Q, л/мин',200],['head','H, м',14],['efficiency','η, %',65],['npshr','NPSHᵣ, м',3]],
        [[0,31,0,1.4],[50,28,51,1.7],[100,22,71,2.2],[150,14,64,3.1],[200,5,45,5]], { min: 2 }),
      note: 'Кривая примера иллюстративная. Для выбора насоса введите паспортные точки при одинаковых оборотах. Для варианта с трубопроводами нажмите «Связать с насосом» в разделе сети.',
      method: 'Характеристики пересекаются внутри паспортного диапазона. NPSHₐ = (pист − pпаров)/(ρg) + zист − zнас − hвс. Потери на всасывании задаются для рабочей точки. Мощность на валу P = ρgQH/η. Предел допустимого запаса выбирается по документации изготовителя.',
      sources: [hydroBook, pumpRef, epanet], wide: true,
      calc: input => {
        if (input.system === 'network' && !input.network) throw new RangeError('Сначала свяжите насос с рассчитанной сетью трубопроводов.');
        return H.pumpDuty({ ...input, resistance: input.resistance ?? 0, network: input.system === 'network' ? input.network : undefined });
      },
      plot: ['Характеристики Q–H', 'РАБОЧАЯ ТОЧКА · НАПОР, М'],
      metrics: r => [m('Рабочая подача',r.flow,'л/мин',2,'drop'),m('Напор',r.head,'м',2,'ruler'),
        m('Мощность на валу',r.shaft,'кВт',3,'activity'),m('Запас NPSH',r.margin,'м',3)],
      detail: r => values([['КПД',100*r.efficiency],['NPSHₐ, м',r.npsha],['NPSHᵣ, м',r.npshr],['Гидравлическая мощность, кВт',r.hydraulic],
        ['Невязка кривых, м', r.residual],['Модель сети', r.coupled ? 'Группы участков' : 'Квадратичная кривая']]),
      chart: r => ({ x:'Q, л/мин', y:'H, м', minY:0, point:[r.flow,r.head], series:[
        ['Насос',r.curve.map(p=>[p.flow,p.pump])], ['Система',r.curve.map(p=>[p.flow,p.system])]
      ] })
    },
    hydrostat: {
      nav: 'Гидростатика', name: 'Давление на плоскую стенку', group: hydraulic, icon: 'ruler',
      subtitle: 'Равнодействующая и центр давления на полностью смоченной прямоугольной площадке.',
      fields: [density,n('surfacePressure','Давление на поверхности',0,'бар изб.'),n('depth','Глубина центра',2,'м'),
        n('angle','Угол к горизонту',90,'°'),n('width','Ширина площадки',1.2,'м'),n('height','Длина по уклону',1.5,'м')],
      note: 'Давление газа над жидкостью задайте относительно давления с обратной стороны площадки. Жидкость покоится.',
      method: 'R = (p₀ + ρghc)A. Смещение вниз по площадке от центра тяжести: Δs = ρg sin(α) I_G/R, для прямоугольника I_G = bh³/12.',
      sources: [hydroBook], calc:H.hydrostatic,
      plot:['Эпюра давления','ВЕРХНЯЯ И НИЖНЯЯ КРОМКИ'],
      metrics:r=>[m('Сила',r.force,'кН',3,'activity'),m('Среднее давление',r.pressure,'бар',4,'drop'),
        m('Смещение центра',r.shift,'м',4,'ruler'),m('Глубина центра давления',r.centerDepth,'м',4,'ruler')],
      detail:(r,i)=>values([['Площадь, м²',i.width*i.height],['Центр давления от верхнего края, м',i.height/2+r.shift]]),
      chart:(r,i)=>({x:'Координата вдоль стенки, м',y:'p, бар',minY:0,series:[['Давление',[
        [0,r.pressure-i.density*H.G*Math.sin(i.angle*Math.PI/180)*i.height/2e5],
        [i.height,r.pressure+i.density*H.G*Math.sin(i.angle*Math.PI/180)*i.height/2e5]
      ]]]})
    },
    orifice: {
      nav:'Истечение жидкости', name:'Истечение через отверстие',group:hydraulic,icon:'drop',
      subtitle:'Расход и время опорожнения сосуда постоянного сечения.',
      fields:[density,n('diameter','Диаметр отверстия',12,'мм'),n('coefficient','Коэффициент расхода μ',0.62),
        n('reservoir','Площадь зеркала',0.5,'м²'),n('head','Начальный напор',1.2,'м'),n('end','Конечный напор',0.1,'м')],
      note:'Свободное истечение в атмосферу через малое отверстие. Коэффициент расхода задаётся по конкретному отверстию или насадке.',
      method:'Q = μA√(2gh). Из баланса S·dh/dt = −Q следует t = 2S(√h₁ − √h₂)/(μA√(2g)). Площадь зеркала и μ постоянны.',
      sources:[hydroBook],calc:H.orifice,
      plot:['Расход в зависимости от напора','ИСТЕЧЕНИЕ · Л/МИН'],
      metrics:r=>[m('Начальный расход',r.start,'л/мин',3,'drop'),m('Конечный расход',r.end,'л/мин',3,'drop'),
        m('Время истечения',r.time,'с',2,'time'),m('Вышедший объём',r.volume,'л',2,'layers')],
      detail:r=>values([['Идеальная начальная скорость, м/с',r.idealVelocity],['Начальное избыточное давление, бар',r.pressure]]),
      chart:(r,i)=>({x:'h, м',y:'Q, л/мин',minY:0,series:[['Расход',Array.from({length:33},(_,j)=>{
        const h=i.head*j/32;
        return [h,r.start*Math.sqrt(h/i.head)];
      })]],point:[i.end,r.end]})
    },
    bend: {
      nav:'Сила потока на отвод',name:'Сила потока на отвод',group:hydraulic,icon:'branch',
      subtitle:'Реакция жидкости на отвод в плоскости по балансу импульса и давления.',
      fields:[density,n('flow','Расход Q',300,'л/мин'),n('d1','Диаметр на входе',50,'мм'),n('d2','Диаметр на выходе',50,'мм'),
        n('p1','Давление на входе',3,'бар изб.'),n('p2','Давление на выходе',2.8,'бар изб.'),n('angle','Поворот потока',90,'°',true)],
      note:'Ось X направлена по входному потоку, угол отсчитывается от неё против часовой стрелки. Силы приведены к пустому снаружи корпусу с атмосферным давлением.',
      method:'F⃗ = (p₁A₁ + ṁv₁)e⃗₁ − (p₂A₂ + ṁv₂)e⃗₂. Установившееся течение, равномерные профили скоростей в сечениях. Масса жидкости и корпуса в результате не учитывается.',
      sources:[hydroBook],calc:H.bendForce,
      plot:['Компоненты нагрузки','ПРОЕКЦИИ СИЛЫ · Н'],
      metrics:r=>[m('Равнодействующая',r.force,'Н',2,'activity'),m('Fₓ',r.x,'Н',2),m('Fᵧ',r.y,'Н',2),m('Массовый расход',r.massFlow,'кг/с',3,'drop')],
      detail:r=>values([['Скорость на входе, м/с',r.v1],['Скорость на выходе, м/с',r.v2]]),
      chart:r=>({y:'Н',bars:[{label:'Fₓ',value:r.x},{label:'Fᵧ',value:r.y},{label:'|F|',value:r.force}]})
    },
    venturi: {
      nav:'Расходомер Вентури',name:'Расходомер Вентури',group:hydraulic,icon:'ruler',
      subtitle:'Расход и скорости в двух сечениях по измеренному перепаду давления.',
      fields:[density,viscosity,n('inlet','Входной диаметр D',80,'мм'),n('throat','Диаметр горла d',45,'мм'),
        n('pressure','Разность p₁ − p₂',12,'кПа'),n('elevation','Разность отметок z₁ − z₂',0,'м'),n('discharge','Коэффициент расхода μ',0.98,'',true)],
      note:'Полностью заполненная труба, однофазное несжимаемое течение. Коэффициент расхода берётся из калибровки либо применимой методики по диапазону Re и β.',
      method:'Из уравнений Бернулли и неразрывности Q = μA₂√[2(Δp + ρgΔz)/(ρ(1 − β⁴))]. β = d/D. Приборный коэффициент вводится отдельно.',
      sources:[hydroBook,['ISO 5167-4:2022','https://www.iso.org/standard/79181.html']],calc:H.venturi,
      plot:['Скорости в сечениях','СКОРОСТЬ · М/С'],
      metrics:r=>[m('Расход',r.flow,'л/мин',2,'drop'),m('Скорость в горле',r.v2,'м/с',3,'activity'),m('Число Рейнольдса',r.reynolds,'',0),m('Отношение β',r.beta,'',4,'ruler')],
      detail:r=>values([['Скорость перед сужением, м/с',r.v1],['Эффективный перепад, кПа',r.effective]]),
      chart:r=>({y:'м/с',bars:[{label:'Вход',value:r.v1},{label:'Горло',value:r.v2}]})
    },
    slit: {
      nav:'Утечка через щель',name:'Утечка через плоскую щель',group:hydraulic,icon:'drop',
      subtitle:'Ламинарная утечка, число Рейнольдса и тепловые потери в зазоре.',
      fields:[{...density,value:870},{...viscosity,value:46},n('width','Ширина щели b',30,'мм'),n('gap','Зазор h',0.08,'мм'),
        n('length','Длина щели L',15,'мм'),n('pressure','Перепад давления',50,'бар')],
      note:'Неподвижные параллельные стенки, постоянные вязкость и зазор. При относительном движении поверхностей требуется добавить перенос жидкости движущейся стенкой.',
      method:'Q = b h³ Δp/(12μL), μ = ρν. Для контроля режима используется гидравлический диаметр 2bh/(b+h). Потери P = Q·Δp.',
      sources:[hydroBook],calc:H.slit,
      plot:['Влияние зазора на утечку','Q ПРОПОРЦИОНАЛЕН h³'],
      metrics:r=>[m('Утечка',r.flow,'л/мин',4,'drop'),m('Скорость',r.speed,'м/с',3,'activity'),m('Число Рейнольдса',r.reynolds,'',2),m('Мощность потерь',r.loss,'Вт',2)],
      detail:r=>values([['Динамическая вязкость, Па·с',r.mu]]),
      chart:(r,i)=>({x:'Зазор, мм',y:'Q, л/мин',minY:0,point:[i.gap,r.flow],series:[['Утечка',Array.from({length:21},(_,j)=>[i.gap*j/20,r.flow*(j/20)**3])]]})
    },
    hammer: {
      nav:'Гидравлический удар',name:'Гидравлический удар',group:hydraulic,icon:'activity',
      subtitle:'Скорость волны, фаза удара и подъём давления при закрытии затвора.',
      fields:[density,n('liquidBulk','Модуль жидкости K',2.2,'ГПа'),n('pipeYoung','Модуль трубы E',210,'ГПа'),
        n('diameter','Внутренний диаметр D',60,'мм'),n('thickness','Толщина стенки e',3,'мм'),n('restraint','Коэффициент стенки ψ',1),
        n('length','Длина трубы L',100,'м'),n('change','Снижение скорости Δv',1.8,'м/с'),n('closeTime','Время закрытия',0.12,'с'),
        n('initial','Исходное давление',6,'бар абс.')],
      note:'Одна упругая труба между резервуаром постоянного напора и концевым затвором. Для замедленного закрытия используется линейное снижение скорости.',
      method:'c = √[(K/ρ)/(1 + ψKD/(Ee))]. Фаза 2L/c. При быстром закрытии Δp = ρcΔv, при медленном Δp ≈ 2ρLΔv/tзакр. Модель оценивает амплитуду и не строит временную диаграмму отражений.',
      sources:[hydroBook],calc:H.waterHammer,
      plot:['Давление при закрытии','ОЦЕНКА АМПЛИТУДЫ · БАР'],
      metrics:r=>[m('Скорость волны',r.c,'м/с',1,'branch'),m('Фаза удара',r.transit,'с',4,'time'),
        m('Подъём давления',r.dp,'бар',3,'drop'),m('Пиковое давление',r.peak,'бар абс.',3,'activity')],
      detail:r=>values([['Характер закрытия',r.fast?'Быстрое':'Медленное']]),
      chart:(r,i)=>({ y:'бар абс.',bars:[{label:'Исходное',value:i.initial},{label:'Пиковое',value:r.peak}] })
    },
    hydrodrive: {
      nav:'Объёмный гидропривод',name:'Объёмный гидропривод',group:hydraulic,icon:'gear',
      subtitle:'Стационарный режим пары насос–гидромотор, давление, момент и тепловые потери.',
      fields:[n('pumpVolume','Объём насоса',23,'см³/об'),n('pumpSpeed','Обороты насоса',1450,'об/мин'),
        n('pumpVol','Объёмный КПД насоса',0.92),n('pumpMech','Механический КПД насоса',0.9),
        n('motorVolume','Объём гидромотора',40,'см³/об'),n('loadTorque','Момент гидромотора',95,'Н·м'),
        n('motorVol','Объёмный КПД мотора',0.91),n('motorMech','Механический КПД мотора',0.88),
        n('circuitLoss','Потери в линии и аппаратах',8,'бар',true)],
      note:'Коэффициенты берутся при рабочей температуре и ожидаемом давлении. Введите суммарный перепад в обеих линиях и аппаратах для данного расхода.',
      method:'Q = Vн nн ηvн, nм = Qηvм/Vм, Δpм = 2πTм/(Vмηmм). Насос развивает Δpм плюс потери контура. Баланс мощностей даёт суммарное выделение тепла.',
      sources:[hydroBook],calc:H.volumetricDrive,
      plot:['Баланс мощности привода','МОЩНОСТЬ · КВТ'],
      metrics:r=>[m('Подача насоса',r.q,'л/мин',2,'drop'),m('Давление насоса',r.pumpPressure,'бар',2,'activity'),
        m('Обороты мотора',r.motorSpeed,'об/мин',1,'gear'),m('КПД привода',r.efficiency,'%',1,'layers')],
      detail:r=>values([['Перепад на моторе, бар',r.motorPressure],['Момент на насосе, Н·м',r.torque],['Мощность насоса, кВт',r.power],
        ['Мощность мотора, кВт',r.useful],['Тепловые потери, кВт',r.loss]]),
      chart:r=>({y:'кВт',bars:[{label:'Вход',value:r.power},{label:'Выход',value:r.useful},{label:'Потери',value:r.loss}]})
    },
    turbine: {
      nav:'Гидротурбина',name:'Мощность гидротурбины',group:hydraulic,icon:'bearing',
      subtitle:'Полезный момент и мощность по рабочему напору, расходу и КПД.',
      fields:[density,n('flow','Расход Q',0.25,'м³/с'),n('head','Полезный напор H',18,'м'),
        n('efficiency','КПД η',0.83),n('rpm','Обороты n',600,'об/мин',true)],
      note:'Напор берётся на турбине с учётом сетевых потерь. КПД задаётся для рабочей точки по характеристике турбины.',
      method:'Pгидр = ρgQH, Pвал = ηPгидр, T = Pвал/ω. Подбор рабочего колеса и кавитационную проверку выполняют по характеристикам конкретной машины.',
      sources:[hydroBook],calc:H.turbine,
      plot:['Баланс мощности турбины','МОЩНОСТЬ · КВТ'],
      metrics:r=>[m('Гидравлическая',r.hydraulic,'кВт',2,'drop'),m('На валу',r.power,'кВт',2,'activity'),
        m('Момент',r.torque,'Н·м',1,'gear'),m('Потери',r.loss,'кВт',2,'layers')],
      detail:(r,i)=>values([['Удельная гидравлическая энергия, Дж/кг',H.G*i.head],['Угловая скорость, рад/с',i.rpm*Math.PI/30]]),
      chart:r=>({y:'кВт',bars:[{label:'Вход',value:r.hydraulic},{label:'Выход',value:r.power},{label:'Потери',value:r.loss}]})
    },
    converter: {
      nav:'Гидротрансформатор',name:'Гидротрансформатор',group:hydraulic,icon:'branch',
      subtitle:'Момент, скорость и потери по экспериментальной безразмерной характеристике.',
      fields:[n('rpm','Обороты насосного колеса',1500,'об/мин'),n('torque','Момент насосного колеса',180,'Н·м'),
        n('speedRatio','Скоростное отношение i',0.55,'',true)],
      rows:rows([['ratio','i = nт/nн',0.95],['torqueRatio','K = Tт/Tн',1]],[[0,2.15],[0.3,1.7],[0.6,1.35],[0.9,1.03]],{min:2}),
      note:'Точки примера иллюстративные. Для реального агрегата нужны экспериментальная кривая K(i) и входной момент в рабочей точке.',
      method:'По линейной интерполяции K(i) определяются Tт = K·Tн, nт = i·nн и η = iK. Экстраполяция за пределы точек отключена.',
      sources:[hydroBook],calc:H.converter,
      plot:['Характеристика трансформации','K ОТ ОТНОШЕНИЯ СКОРОСТЕЙ'],
      metrics:r=>[m('Обороты турбины',r.rpm,'об/мин',1,'gear'),m('Момент турбины',r.torque,'Н·м',1,'activity'),
        m('КПД',r.efficiency,'%',2,'layers'),m('Потери',r.loss,'кВт',2,'drop')],
      detail:r=>values([['Коэффициент трансформации',r.k],['Мощность входа, кВт',r.input],['Мощность выхода, кВт',r.power]]),
      chart:(r,i)=>({x:'i',y:'K',minY:0,point:[i.speedRatio,r.k],
        series:[['K(i)',i.rows.map(p=>[p.ratio,p.torqueRatio]).sort((a,b)=>a[0]-b[0])]]})
    }
  };

  root.SoftneerAdvanced = { tools, hydroBook };
})(globalThis);
