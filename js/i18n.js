/* =========================================================
   Newton's Tea Lab — Internationalization (EN / NL-BE Vlaams)
   ========================================================= */
(function (global) {
  'use strict';

  const STRINGS = {
    en: {
      htmlLang: 'en',
      pageTitle: "Newton's Tea Lab — Law of Cooling Game",
      brandTitle: 'Newton’s Tea Lab',
      stepBoil: 'Boil',
      stepPour: 'Pour',
      stepCool: 'Cool',
      newRunBtn: '↻ New',
      newRunTitle: 'Start a New Experiment',
      missionsBtnTitle: 'Discovery Missions',
      guideBtnTitle: "How Newton's Law Works",
      soundBtnTitle: 'Toggle Sound',

      kettleControlTitle: '🔥 KETTLE',
      roomControlTitle: 'ROOM',
      isoControlTitle: '🧥 ISOLATE',
      dragHintText: 'Drag or Tap Pour!',
      thermosEmpty: 'Empty',
      thermosFilling: 'Filling...',

      isoThinFull: 'Thin Tin Flask',
      isoThinShort: 'Thin Tin',
      isoKnitFull: 'Cozy Knit Sleeve',
      isoKnitShort: 'Knit Sleeve',
      isoJacketFull: 'Thermo Jacket',
      isoJacketShort: 'Thermo Coat',
      isoVacuumFull: 'Vacuum Shield',
      isoVacuumShort: 'Vacuum',

      btnBoil: (t) => `🔥 Boil Water to ${t}°C`,
      pillHeating: (cur, target) => `🫧 Heating... ${cur}°C / ${target}°C`,
      btnInstant: '⚡ Instant',
      btnInstantTitle: 'Skip to target temperature',
      btnPour: (t) => `💧 Pour ${t}°C into Thermos!`,
      pillPouring: '🫖 Pouring into thermos flask...',
      btnPinNew: '📌 Pin & New Run',
      btnReset: '↻ Reset',

      graphTitle: '📈 Temperature vs. Time',
      eqHorizonApprox: (d) => `Equilibrium ≈ ${d}`,
      eqHorizonLocked: (d) => `Equilibrium: ${d}`,
      btnCompare: '📌 Compare',
      btnCompareTitle: 'Pin current curve to compare with next run',
      btnClear: 'Clear',
      btnClearTitle: 'Clear pinned curves',
      legendCurrent: 'Current Run',
      legendRoom: (r) => `Room (${r}°C)`,
      legendRun: (i, label) => `Run ${i}: ${label}`,

      axisTime: 'Time →',
      axisTemp: 'Temperature (°C)',
      graphRoomTag: (r) => `Room ${r}°C`,
      graphFreezeLine: '❄️ 0°C Freezing Point',
      graphLiveIce: (pct) => `🧊 0.0°C (${pct}% ice)`,
      graphTooltipIce: 'Ice',
      graphEmptyReady: 'Pour hot water into the thermos to start plotting!',
      graphEmptyIdle: 'Boil & pour water to watch Newton’s cooling curve!',
      unitHour: 'h',
      unitMin: 'm',
      unitSec: 's',

      tipIdle: 'Drag the thermometers & isolation slider, then tap <strong>Boil!</strong>',
      tipBoiling: (t) => `Heating the kettle to <strong>${t}°C</strong>! Watch the bubbles grow faster!`,
      tipReadyPour: (t) => `Ding! Water is <strong>${t}°C</strong>! Drag the kettle or tap <strong>Pour!</strong>`,
      tipPouring: (t, isoName) => `Pouring <strong>${t}°C</strong> water into the <strong>${isoName}</strong>!`,
      tipCoolingStart: (d) => `Huge gap (<strong>ΔT = ${d}°C</strong>)! Notice how steeply the curve drops at first!`,
      tipWarmingStart: 'Whoa! The room is warmer than the water, so Newton’s Law <strong>warms it up</strong> instead!',
      tipBalancedStart: 'Water &amp; room are almost the same temp — barely any heat flows!',
      tipRetarget: (t) => `Target changed to <strong>${t}°C</strong>! Tap <strong>Boil!</strong>`,
      tipFreezingPlateau: '🧊 <strong>Freezing enthalpy!</strong> Water stays flat at <strong>0°C</strong> while releasing latent heat to turn into ice!',
      tipMeltingPlateau: '☀️ <strong>Melting enthalpy!</strong> Ice stays flat at <strong>0°C</strong> while absorbing heat to melt back into water!',
      tipSolidIce: (r) => `Frozen solid! Freezing enthalpy is gone — solid ice now cools <strong>2× faster</strong> toward <strong>${r}°C</strong>!`,
      tipEquilibrium: (isIce, r) => `Equilibrium reached! ${isIce ? 'Ice' : 'Water'} matched the room (<strong>${r}°C</strong>), so the curve flattened out!`,
      tipSlowingDown: (d) => `Watch the curve bend flatter! Smaller gap (<strong>${d}°C</strong>) means slower cooling!`,
      tipRoomSubzero: (r) => `Sub-zero <strong>${r}°C</strong> room! Water will freeze at <strong>0°C</strong> with a flat enthalpy plateau!`,
      tipRoomCold: (r) => `Brrr! Cold <strong>${r}°C</strong> room widens ΔT — watch the curve plunge faster!`,
      tipRoomHot: (r) => `Sunny <strong>${r}°C</strong> room raises the target asymptote!`,
      tipRoomMid: (r) => `Room set to <strong>${r}°C</strong> — the water will now aim toward the new dashed blue line!`,
      tipIsoHigh: (name, k) => `<strong>${name}!</strong> Tiny <strong>k = ${k}</strong> traps heat for hours!`,
      tipIsoLow: (name, k) => `<strong>${name}!</strong> Large <strong>k = ${k}</strong> lets heat rush right out!`,
      tipIsoMid: (name, k) => `Switched to <strong>${name}</strong> (k = ${k} /min)!`,
      tipNeedCompare: 'Pour hot water and let it cool a bit first, then tap <strong>📌 Compare</strong>!',
      tipAlreadyPinned: 'This curve is already pinned! Tap <strong>↻ New</strong> to test new settings side-by-side!',
      tipPinned: 'Curve pinned! Tap <strong>↻ New</strong>, change isolation or room temp, and compare!',

      missionsTitle: '⭐ Discovery Missions',
      starEarned: (title) => `Star Earned: ${title}!`,
      missions: {
        first_brew: {
          title: 'First Brew Scientist',
          desc: 'Boil water in the kettle and pour it into the thermos flask.',
        },
        super_keeper: {
          title: 'Cozy Tea Keeper',
          desc: 'Keep water above 65°C after 2 hours (120 min) in the thermos! (Hint: High isolation!)',
        },
        arctic_cool: {
          title: 'Arctic Speed-Cool',
          desc: 'Start at 85°C+ and cool below 30°C within 30 minutes! (Hint: Cold room + low isolation!)',
        },
        compare_curves: {
          title: 'Curve Comparator',
          desc: 'Pin a run with 📌 Compare and pour a second experiment to compare two curves!',
        },
      },

      guideTitle: '🍎 How Newton’s Law of Cooling Works',
      guideCards: [
        {
          h: '1. Big Temperature Gap = Fast Cooling!',
          p: 'When boiling 95°C water meets a cool 20°C room, the gap (ΔT = 75°C) is huge, so heat escapes super quickly and the graph drops steeply.',
        },
        {
          h: '2. Small Gap = Slow Cooling (The Curved Tail!)',
          p: 'As the water gets closer to room temperature, ΔT shrinks, so heat escapes slower and slower. That creates Newton’s famous exponential curve that flattens toward the dashed blue Room Temp line!',
        },
        {
          h: '3. Isolation Factor Controls “k”',
          p: 'Better insulation traps heat inside the thermos (smaller <strong>k</strong>), stretching the curve out so your tea stays cozy for hours. Try pinning a run with <strong>📌 Compare</strong> and testing 10% vs 90% isolation!',
        },
        {
          h: '4. Freezing Enthalpy (The Flat 0°C Plateau!)',
          p: 'Set Room Temp below 0°C (down to -20°C)! When water hits 0°C, its temperature pauses completely flat while releasing its <strong>enthalpy of fusion</strong> (334 kJ/kg) to form ice. Once 100% frozen, solid ice cools about 2× faster!',
        },
        {
          h: '5. Even Cold Water in a Hot Room Obeys It!',
          p: 'Set Kettle Temp to 25°C and Room Temp to 40°C — the curve flips upward and warms toward room temperature using the exact same equation!',
        },
      ],
    },

    nl: {
      htmlLang: 'nl-BE',
      pageTitle: 'Newtons Theelab — Spel over de Afkoelingswet',
      brandTitle: 'Newtons Theelab',
      stepBoil: 'Koken',
      stepPour: 'Gieten',
      stepCool: 'Afkoelen',
      newRunBtn: '↻ Nieuw',
      newRunTitle: 'Start een nieuw experiment',
      missionsBtnTitle: 'Ontdekkingsmissies',
      guideBtnTitle: 'Hoe werkt de wet van Newton?',
      soundBtnTitle: 'Geluid aan of uit',

      kettleControlTitle: '🔥 KOKER',
      roomControlTitle: 'KAMER',
      isoControlTitle: '🧥 ISOLATIE',
      dragHintText: 'Sleep of tik om te gieten!',
      thermosEmpty: 'Leeg',
      thermosFilling: 'Vullen...',

      isoThinFull: 'Blikken Fles',
      isoThinShort: 'Blikje',
      isoKnitFull: 'Gebreide Hoes',
      isoKnitShort: 'Breihoes',
      isoJacketFull: 'Thermojas',
      isoJacketShort: 'Thermojas',
      isoVacuumFull: 'Vacuümschild',
      isoVacuumShort: 'Vacuüm',

      btnBoil: (t) => `🔥 Water koken tot ${t}°C`,
      pillHeating: (cur, target) => `🫧 Opwarmen... ${cur}°C / ${target}°C`,
      btnInstant: '⚡ Meteen',
      btnInstantTitle: 'Spring meteen naar de gewenste temperatuur',
      btnPour: (t) => `💧 Giet ${t}°C in de thermos!`,
      pillPouring: '🫖 Aan het gieten in de thermosfles...',
      btnPinNew: '📌 Vastpinnen & Nieuw',
      btnReset: '↻ Opnieuw',

      graphTitle: '📈 Temperatuur in de tijd',
      eqHorizonApprox: (d) => `Evenwicht ≈ ${d}`,
      eqHorizonLocked: (d) => `Evenwicht: ${d}`,
      btnCompare: '📌 Vergelijk',
      btnCompareTitle: 'Pin deze kromme vast om met een volgende proef te vergelijken',
      btnClear: 'Wis',
      btnClearTitle: 'Wis vastgepinde krommes',
      legendCurrent: 'Huidige proef',
      legendRoom: (r) => `Kamer (${r}°C)`,
      legendRun: (i, label) => `Proef ${i}: ${label}`,

      axisTime: 'Tijd →',
      axisTemp: 'Temperatuur (°C)',
      graphRoomTag: (r) => `Kamer ${r}°C`,
      graphFreezeLine: '❄️ 0°C Vriespunt',
      graphLiveIce: (pct) => `🧊 0.0°C (${pct}% ijs)`,
      graphTooltipIce: 'IJs',
      graphEmptyReady: 'Giet het warme water in de thermos om de grafiek te starten!',
      graphEmptyIdle: 'Kook en giet water om de afkoelingskromme van Newton te zien!',
      unitHour: 'u',
      unitMin: 'm',
      unitSec: 's',

      tipIdle: 'Sleep de thermometers &amp; isolatieschuiver en tik op <strong>Koken!</strong>',
      tipBoiling: (t) => `De waterkoker warmt op tot <strong>${t}°C</strong>! Kijk hoe de belletjes steeds sneller gaan!`,
      tipReadyPour: (t) => `Ping! Het water is <strong>${t}°C</strong>! Sleep de koker naar de thermos of tik op <strong>Gieten!</strong>`,
      tipPouring: (t, isoName) => `We gieten water van <strong>${t}°C</strong> in de <strong>${isoName}</strong>!`,
      tipCoolingStart: (d) => `Groot verschil (<strong>ΔT = ${d}°C</strong>)! Zie je hoe steil de grafiek in het begin zakt?`,
      tipWarmingStart: 'Amai! De kamer is warmer dan het water, dus de wet van Newton <strong>warmt het juist op!</strong>',
      tipBalancedStart: 'Het water en de kamer zijn bijna even warm — er stroomt nauwelijks warmte!',
      tipRetarget: (t) => `Temperatuur aangepast naar <strong>${t}°C</strong>! Tik op <strong>Koken!</strong>`,
      tipFreezingPlateau: '🧊 <strong>Stolwarmte (vriesenthalpie)!</strong> Het water blijft vlak op <strong>0°C</strong> terwijl het warmte afgeeft om ijs te vormen!',
      tipMeltingPlateau: '☀️ <strong>Smeltwarmte!</strong> Het ijs blijft vlak op <strong>0°C</strong> terwijl het warmte opneemt om weer te smelten!',
      tipSolidIce: (r) => `Helemaal bevroren! Alle stolwarmte is weg — vast ijs koelt nu <strong>2× sneller</strong> af richting <strong>${r}°C</strong>!`,
      tipEquilibrium: (isIce, r) => `Evenwicht bereikt! Het ${isIce ? 'ijs' : 'water'} is nu even warm als de kamer (<strong>${r}°C</strong>), dus de kromme is vlak!`,
      tipSlowingDown: (d) => `Kijk hoe de kromme vlakker wordt! Kleiner verschil (<strong>${d}°C</strong>) betekent trager afkoelen!`,
      tipRoomSubzero: (r) => `Kamer onder nul (<strong>${r}°C</strong>)! Het water bevriest bij <strong>0°C</strong> met een vlak vriesplateau!`,
      tipRoomCold: (r) => `Brrr! Een koude kamer van <strong>${r}°C</strong> vergroot ΔT — kijk hoe snel de kromme duikt!`,
      tipRoomHot: (r) => `Een zonnige kamer van <strong>${r}°C</strong> legt de blauwe doellijn hoger!`,
      tipRoomMid: (r) => `Kamer op <strong>${r}°C</strong> — het water beweegt nu richting de nieuwe blauwe stippellijn!`,
      tipIsoHigh: (name, k) => `<strong>${name}!</strong> Een heel kleine <strong>k = ${k}</strong> houdt je thee urenlang warm!`,
      tipIsoLow: (name, k) => `<strong>${name}!</strong> Een grote <strong>k = ${k}</strong> laat de warmte snel ontsnappen!`,
      tipIsoMid: (name, k) => `Gewisseld naar <strong>${name}</strong> (k = ${k} /min)!`,
      tipNeedCompare: 'Giet eerst warm water en laat het even afkoelen, tik dan op <strong>📌 Vergelijk</strong>!',
      tipAlreadyPinned: 'Deze kromme hangt al vast! Tik op <strong>↻ Nieuw</strong> om een tweede proef te vergelijken!',
      tipPinned: 'Kromme vastgepind! Tik op <strong>↻ Nieuw</strong>, pas isolatie of kamertemperatuur aan en vergelijk!',

      missionsTitle: '⭐ Ontdekkingsmissies',
      starEarned: (title) => `Ster verdiend: ${title}!`,
      missions: {
        first_brew: {
          title: 'Eerste Thee-onderzoeker',
          desc: 'Kook water in de waterkoker en giet het in de thermosfles.',
        },
        super_keeper: {
          title: 'Warme Theebewaarder',
          desc: 'Houd het water na 2 uur (120 min) nog boven 65°C in de thermos! (Tip: hoge isolatie!)',
        },
        arctic_cool: {
          title: 'Arctische Snelkoeler',
          desc: 'Start op 85°C+ en koel binnen 30 minuten af tot onder 30°C! (Tip: koude kamer + lage isolatie!)',
        },
        compare_curves: {
          title: 'Kromme-vergelijker',
          desc: 'Pin een proef vast met 📌 Vergelijk en giet een tweede proef om twee krommes te vergelijken!',
        },
      },

      guideTitle: '🍎 Hoe werkt de Afkoelingswet van Newton?',
      guideCards: [
        {
          h: '1. Groot temperatuurverschil = Snel afkoelen!',
          p: 'Als kokend water van 95°C in een frisse kamer van 20°C staat, is het verschil (ΔT = 75°C) enorm. De warmte ontsnapt razendsnel en de grafiek zakt steil naar beneden.',
        },
        {
          h: '2. Klein verschil = Traag afkoelen (De gebogen staart!)',
          p: 'Hoe dichter het water bij de kamertemperatuur komt, hoe kleiner ΔT wordt en hoe trager het afkoelt. Zo ontstaat de typische exponentiële kromme richting de blauwe stippellijn!',
        },
        {
          h: '3. Isolatie bepaalt de factor “k”',
          p: 'Betere isolatie houdt de warmte langer vast (kleinere <strong>k</strong>), waardoor de kromme veel trager zakt. Pin een proef vast met <strong>📌 Vergelijk</strong> en test 10% tegenover 90% isolatie!',
        },
        {
          h: '4. Stolwarmte / Vriesenthalpie (Het vlakke 0°C-plateau!)',
          p: 'Zet de kamer onder 0°C (tot -20°C)! Zodra het water 0°C bereikt, blijft de temperatuur helemaal vlak terwijl het zijn <strong>stolwarmte</strong> (334 kJ/kg) afgeeft om ijs te vormen. Eens 100% bevroren, koelt vast ijs ongeveer 2× sneller af!',
        },
        {
          h: '5. Zelfs fris water in een warme kamer volgt de wet!',
          p: 'Zet de waterkoker op 25°C en de kamer op 40°C — de kromme buigt omhoog en warmt op naar kamertemperatuur volgens precies dezelfde formule!',
        },
      ],
    },
  };

  let currentLang = 'en';
  try {
    const saved = global.localStorage && global.localStorage.getItem('newtonsTeaLabLang');
    if (saved && STRINGS[saved]) currentLang = saved;
  } catch (_) {}

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return currentLang;
    currentLang = lang;
    try {
      if (global.localStorage) global.localStorage.setItem('newtonsTeaLabLang', lang);
    } catch (_) {}
    return currentLang;
  }

  function dict() {
    return STRINGS[currentLang] || STRINGS.en;
  }

  global.NewtonI18n = {
    STRINGS,
    getLang,
    setLang,
    dict,
  };
})(window);
