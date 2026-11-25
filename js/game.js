/* =========================================================
   Newton's Tea Lab — Interactive Game & Physics Controller
   Exact Newton's Law of Cooling:
     dT/dt = -k * (T - T_room)
     T(t + dt) = T_room + (T(t) - T_room) * exp(-k * dt)
   ========================================================= */
(function (global) {
  'use strict';

  const AudioFX = global.NewtonAudio;
  const I18n = global.NewtonI18n;
  const {
    CoolingGraph,
    RUN_COLORS,
    stepThermalState,
    formatDurationShort,
    calcEquilibriumTimeMin,
  } = global.NewtonGraph;

  function t() {
    return I18n.dict();
  }

  const MISSION_IDS = ['first_brew', 'super_keeper', 'arctic_cool', 'compare_curves'];

  // Exponential mapping from Isolation Factor (0..100%) to k (min^-1)
  function isolationToK(iso) {
    const kMax = 0.08;   // 0% isolation: bare thin flask (~8.7 min half-life)
    const kMin = 0.0025; // 100% isolation: vacuum super-flask (~4.6 hr half-life)
    return kMax * Math.pow(kMin / kMax, iso / 100);
  }

  function isolationProfile(iso) {
    const d = t();
    if (iso <= 25) return { name: d.isoThinFull, shortName: d.isoThinShort, skin: 'skinBare' };
    if (iso <= 55) return { name: d.isoKnitFull, shortName: d.isoKnitShort, skin: 'skinKnit' };
    if (iso <= 85) return { name: d.isoJacketFull, shortName: d.isoJacketShort, skin: 'skinJacket' };
    return { name: d.isoVacuumFull, shortName: d.isoVacuumShort, skin: 'skinVacuum' };
  }

  // Smooth color interpolation for liquid & thermometer based on Celsius (-20..100)
  function tempToColor(tempC) {
    const stops = [
      { t: -20, r: 51,  g: 154, b: 240 },
      { t: 0,   r: 102, g: 217, b: 232 },
      { t: 15,  r: 116, g: 192, b: 252 },
      { t: 38,  r: 105, g: 219, b: 175 },
      { t: 62,  r: 255, g: 192, b: 72 },
      { t: 82,  r: 255, g: 135, b: 67 },
      { t: 100, r: 255, g: 82,  b: 88 },
    ];
    const clamped = Math.max(-20, Math.min(100, tempC));
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (clamped >= a.t && clamped <= b.t) {
        const u = (clamped - a.t) / (b.t - a.t);
        const r = Math.round(a.r + (b.r - a.r) * u);
        const g = Math.round(a.g + (b.g - a.g) * u);
        const bl = Math.round(a.b + (b.b - a.b) * u);
        return `rgb(${r}, ${g}, ${bl})`;
      }
    }
    return 'rgb(255, 82, 88)';
  }

  function formatElapsedClock(minutes) {
    const d = t();
    const totalSec = Math.floor(minutes * 60);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
    if (hrs > 0) return `${hrs}${d.unitHour} ${pad2(mins)}${d.unitMin}`;
    return `${mins}${d.unitMin} ${pad2(secs)}${d.unitSec}`;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ================= MAIN GAME STATE =================
  const state = {
    phase: 'idle', // 'idle' | 'boiling' | 'ready_to_pour' | 'pouring' | 'cooling'
    kettleTarget: 95,
    kettleTemp: 20,
    kettleFill: 0.85,

    roomTemp: 20,
    isolation: 45,
    k: isolationToK(45),

    thermosTemp: null,
    thermosStartTemp: null,
    thermosFill: 0,
    iceFraction: 0,

    elapsedMin: 0,
    timeSpeed: 60,
    paused: false,

    points: [],
    savedRuns: [],
    currentRunSaved: false,
    fixedMaxTimeMin: null,
    showTheory: true,

    // Animation progress timers
    boilProgress: 0,
    boilStartTemp: 20,
    boilDuration: 2.8,
    pourProgress: 0,
    pourDuration: 1.75,
    pourFromX: 0,
    pourFromY: 0,

    // Dragging state
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragCurX: 0,
    dragCurY: 0,
    dragStartClientX: 0,
    dragStartClientY: 0,

    // Missions & hints
    completedMissions: new Set(),
    lastHintKey: '',
    lastHintRender: () => t().tipIdle,
    lastTickSound: 0,
  };

  // ================= DOM REFERENCES =================
  const el = {};

  function cacheDom() {
    const ids = [
      'brandTitle', 'stepBoil', 'stepPour', 'stepCool',
      'stepBoilLabel', 'stepPourLabel', 'stepCoolLabel',
      'langToggle',
      'missionsBtn', 'missionsCount', 'guideBtn', 'soundBtn', 'newRunBtn',
      'newtonBubble', 'newtonText', 'kitchenSvg',
      'wallStopTop', 'wallStopBot', 'skyStopTop', 'skyStopBot',
      'hillBack', 'hillFront', 'windowSun', 'windowClouds', 'windowSnow',
      'clockHourHand', 'clockMinHand',
      'kettleThermoControl', 'kettleControlTitle', 'kettleThermoFill', 'kettleThermoBulb', 'kettleThermoKnob', 'kettleTargetBadge',
      'roomThermoControl', 'roomControlTitle', 'roomThermoFill', 'roomThermoBulb', 'roomThermoKnob', 'roomThermoText', 'roomWeatherIcon',
      'isoControl', 'isoControlTitle', 'isoTrackFill', 'isoKnob', 'isoBadge', 'isoName',
      'heaterGlow', 'baseLed', 'dragHint', 'dragHintText', 'pourStream', 'pourArcOuter',
      'heatWavesGroup', 'thermosSteam', 'skinBare', 'skinKnit', 'skinJacket', 'skinVacuum',
      'thermosLiquid', 'thermosSurface', 'thermosIceLayer', 'thermosMouth', 'thermosBlushL', 'thermosBlushR',
      'thermosCap', 'thermosTempText',
      'kettleWrapper', 'kettleGroup', 'kettleSteam', 'kettleLiquid', 'kettleSurface',
      'kettleBubbles', 'kettleMouth', 'kettleBlushL', 'kettleBlushR', 'kettleTempText',
      'stageActionBar', 'primaryActionBtn',
      'elapsedBadge', 'playPauseBtn', 'speedPills',
      'tempGraph', 'graphTitle', 'eqHorizonPill', 'saveCompareBtn', 'clearRunsBtn', 'runLegend',
      'starToast', 'starToastText',
      'missionsModal', 'missionsTitle', 'missionList', 'guideModal', 'guideTitle', 'guideSteps',
    ];
    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  let graph = null;
  let toastTimeout = null;

  // ================= NEWTON MASCOT HINTS =================
  function setNewtonMessage(key, renderOrHtml) {
    const renderFn = typeof renderOrHtml === 'function' ? renderOrHtml : () => renderOrHtml;
    if (state.lastHintKey === key) return;
    state.lastHintKey = key;
    state.lastHintRender = renderFn;
    el.newtonText.innerHTML = renderFn();
    el.newtonBubble.classList.remove('pop');
    void el.newtonBubble.offsetWidth;
    el.newtonBubble.classList.add('pop');
  }

  // ================= GUIDE & LANGUAGE =================
  function renderGuide() {
    const d = t();
    el.guideTitle.textContent = d.guideTitle;
    el.guideSteps.innerHTML = d.guideCards
      .map((card) => `<div class="guide-card"><h4>${card.h}</h4><p>${card.p}</p></div>`)
      .join('');
  }

  function applyLanguage() {
    const lang = I18n.getLang();
    const d = t();

    if (document.documentElement) {
      document.documentElement.lang = d.htmlLang;
    }
    document.title = d.pageTitle;

    el.brandTitle.textContent = d.brandTitle;
    el.stepBoilLabel.textContent = d.stepBoil;
    el.stepPourLabel.textContent = d.stepPour;
    el.stepCoolLabel.textContent = d.stepCool;
    el.newRunBtn.textContent = d.newRunBtn;
    el.newRunBtn.title = d.newRunTitle;
    el.missionsBtn.title = d.missionsBtnTitle;
    el.guideBtn.title = d.guideBtnTitle;
    el.guideBtn.setAttribute('aria-label', d.guideBtnTitle);
    el.soundBtn.title = d.soundBtnTitle;
    el.soundBtn.setAttribute('aria-label', d.soundBtnTitle);

    el.kettleControlTitle.textContent = d.kettleControlTitle;
    el.roomControlTitle.textContent = d.roomControlTitle;
    el.isoControlTitle.textContent = d.isoControlTitle;
    el.dragHintText.textContent = d.dragHintText;

    el.graphTitle.textContent = d.graphTitle;
    el.saveCompareBtn.textContent = d.btnCompare;
    el.saveCompareBtn.title = d.btnCompareTitle;
    el.clearRunsBtn.textContent = d.btnClear;
    el.clearRunsBtn.title = d.btnClearTitle;

    el.missionsTitle.textContent = d.missionsTitle;

    el.langToggle.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    renderGuide();
    renderMissions();
    renderLegend();
    syncActionBar();
    updateIsolationVisuals();
    updateEquilibriumHorizonUi();
    updateThermosVisuals();
    updateClockHands();

    if (state.lastHintRender) {
      el.newtonText.innerHTML = state.lastHintRender();
    }
    if (graph) {
      renderGraph();
    }
  }

  // ================= MISSIONS =================
  function renderMissions() {
    const d = t();
    el.missionsCount.textContent = `${state.completedMissions.size}/${MISSION_IDS.length}`;
    el.missionList.innerHTML = MISSION_IDS.map((id) => {
      const m = d.missions[id];
      const done = state.completedMissions.has(id);
      return `
        <div class="mission-item ${done ? 'completed' : ''}">
          <div class="mission-star">${done ? '⭐' : '☆'}</div>
          <div class="mission-info">
            <h4>${m.title}</h4>
            <p>${m.desc}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  function unlockMission(id) {
    if (state.completedMissions.has(id)) return;
    const d = t();
    const mission = d.missions[id];
    if (!mission) return;
    state.completedMissions.add(id);
    renderMissions();
    AudioFX.fanfare();

    el.starToastText.textContent = d.starEarned(mission.title);
    el.starToast.classList.add('show');
    if (toastTimeout) global.clearTimeout(toastTimeout);
    toastTimeout = global.setTimeout(() => {
      el.starToast.classList.remove('show');
    }, 3400);
  }

  function checkMissions() {
    if (state.phase === 'cooling') {
      unlockMission('first_brew');
      if (state.savedRuns.length >= 1 && state.elapsedMin >= 2) {
        unlockMission('compare_curves');
      }
      if (state.elapsedMin >= 120 && state.thermosTemp >= 65) {
        unlockMission('super_keeper');
      }
      if (
        state.thermosStartTemp >= 85 &&
        state.elapsedMin <= 30 &&
        state.thermosTemp <= 30
      ) {
        unlockMission('arctic_cool');
      }
    }
  }

  // ================= PHASE & ACTION BAR UPDATES =================
  function syncStepPills() {
    const p = state.phase;
    el.stepBoil.className = 'step-pill';
    el.stepPour.className = 'step-pill';
    el.stepCool.className = 'step-pill';

    if (p === 'idle' || p === 'boiling') {
      el.stepBoil.classList.add('active');
    } else if (p === 'ready_to_pour' || p === 'pouring') {
      el.stepBoil.classList.add('done');
      el.stepPour.classList.add('active');
    } else if (p === 'cooling') {
      el.stepBoil.classList.add('done');
      el.stepPour.classList.add('done');
      el.stepCool.classList.add('active');
    }
  }

  function syncActionBar() {
    const p = state.phase;
    const bar = el.stageActionBar;
    const d = t();

    if (p === 'idle') {
      bar.innerHTML = `
        <button class="pazu-btn btn-coral btn-big pulse-cta" id="primaryActionBtn">
          ${d.btnBoil(state.kettleTarget)}
        </button>
      `;
      document.getElementById('primaryActionBtn').addEventListener('click', startBoiling);
    } else if (p === 'boiling') {
      bar.innerHTML = `
        <div class="stage-status-pill" id="boilStatusPill">
          ${d.pillHeating(Math.round(state.kettleTemp), state.kettleTarget)}
        </div>
        <button class="pazu-btn btn-yellow" id="instantBoilBtn" title="${d.btnInstantTitle}">${d.btnInstant}</button>
      `;
      document.getElementById('instantBoilBtn').addEventListener('click', finishBoilingImmediately);
    } else if (p === 'ready_to_pour') {
      bar.innerHTML = `
        <button class="pazu-btn btn-sky btn-big pulse-cta" id="primaryActionBtn">
          ${d.btnPour(state.kettleTarget)}
        </button>
      `;
      document.getElementById('primaryActionBtn').addEventListener('click', () => startPouring(0, 0));
    } else if (p === 'pouring') {
      bar.innerHTML = `
        <div class="stage-status-pill">
          ${d.pillPouring}
        </div>
      `;
    } else if (p === 'cooling') {
      bar.innerHTML = `
        <button class="pazu-btn btn-mint" id="stageCompareBtn">${d.btnPinNew}</button>
        <button class="pazu-btn btn-cream" id="stageResetBtn">${d.btnReset}</button>
      `;
      document.getElementById('stageCompareBtn').addEventListener('click', () => {
        AudioFX.pop(620);
        saveCurrentRunForCompare();
        resetExperiment(false);
      });
      document.getElementById('stageResetBtn').addEventListener('click', () => {
        AudioFX.pop(460);
        resetExperiment(false);
      });
    }
  }

  // ================= GAMEPLAY ACTIONS =================
  function startBoiling() {
    if (state.phase !== 'idle') return;
    AudioFX.pop(540);
    state.phase = 'boiling';
    state.boilStartTemp = state.kettleTemp;
    state.boilProgress = 0;
    const tempRise = Math.max(10, state.kettleTarget - state.boilStartTemp);
    state.boilDuration = 1.6 + (tempRise / 80) * 1.6;

    AudioFX.startBoiling(() => state.boilProgress);
    setNewtonMessage('boiling', () => t().tipBoiling(state.kettleTarget));
    syncStepPills();
    syncActionBar();
  }

  function finishBoilingImmediately() {
    if (state.phase !== 'boiling') return;
    state.boilProgress = 1;
    completeBoiling();
  }

  function completeBoiling() {
    AudioFX.stopBoiling();
    AudioFX.kettleReady();
    state.kettleTemp = state.kettleTarget;
    state.phase = 'ready_to_pour';

    setNewtonMessage('ready_pour', () => t().tipReadyPour(state.kettleTarget));
    syncStepPills();
    syncActionBar();
  }

  function startPouring(fromX, fromY) {
    if (state.phase !== 'ready_to_pour') return;
    AudioFX.pop(600);
    AudioFX.startPouring();

    state.phase = 'pouring';
    state.pourProgress = 0;
    state.pourFromX = fromX || 0;
    state.pourFromY = fromY || 0;
    state.dragging = false;

    setNewtonMessage('pouring', () => t().tipPouring(state.kettleTarget, isolationProfile(state.isolation).name));
    syncStepPills();
    syncActionBar();
  }

  function completePouring() {
    AudioFX.stopPouring();
    AudioFX.lidClick();

    state.phase = 'cooling';
    state.kettleFill = 0.08;
    state.thermosFill = 0.88;
    state.thermosTemp = state.kettleTarget;
    state.thermosStartTemp = state.kettleTarget;
    state.iceFraction = 0;
    state.elapsedMin = 0;
    state.paused = false;
    state.currentRunSaved = false;
    // Lock the graph's X-axis upon pouring based on calculated time until equilibrium
    state.fixedMaxTimeMin = calcEquilibriumTimeMin(state.thermosStartTemp, state.roomTemp, state.k);
    state.points = [
      {
        t: 0,
        T: state.thermosTemp,
        roomTemp: state.roomTemp,
        iceFraction: 0,
      },
    ];

    updateEquilibriumHorizonUi();
    updatePlayPauseUi();
    syncStepPills();
    syncActionBar();

    const delta = state.thermosTemp - state.roomTemp;
    if (delta > 5) {
      const snapDelta = delta.toFixed(0);
      setNewtonMessage('cooling_start', () => t().tipCoolingStart(snapDelta));
    } else if (delta < -5) {
      setNewtonMessage('warming_start', () => t().tipWarmingStart);
    } else {
      setNewtonMessage('balanced_start', () => t().tipBalancedStart);
    }
    checkMissions();
  }

  function saveCurrentRunForCompare() {
    if (state.points.length < 2 || state.currentRunSaved) return;
    state.currentRunSaved = true;
    const color = RUN_COLORS[state.savedRuns.length % RUN_COLORS.length];
    const startT = Math.round(state.thermosStartTemp ?? state.kettleTarget);
    const label = `${startT}°→${state.roomTemp}° (${state.isolation}%)`;
    state.savedRuns.push({
      label,
      color,
      roomTemp: state.roomTemp,
      isolation: state.isolation,
      points: state.points.slice(),
    });
    if (state.savedRuns.length > 4) {
      state.savedRuns.shift();
    }
    renderLegend();
  }

  function resetExperiment(clearSaved) {
    AudioFX.stopBoiling();
    AudioFX.stopPouring();

    state.phase = 'idle';
    state.kettleTemp = Math.min(20, state.kettleTarget - 5);
    state.kettleFill = 0.85;
    state.thermosTemp = null;
    state.thermosStartTemp = null;
    state.thermosFill = 0;
    state.iceFraction = 0;
    state.elapsedMin = 0;
    state.points = [];
    state.currentRunSaved = false;
    state.fixedMaxTimeMin = null;
    state.paused = false;
    state.dragging = false;
    state.dragCurX = 0;
    state.dragCurY = 0;

    if (clearSaved) {
      state.savedRuns = [];
    }

    el.kettleWrapper.setAttribute('transform', 'translate(0, 0)');
    el.thermosCap.setAttribute('transform', 'translate(0, 0)');
    el.pourStream.setAttribute('opacity', '0');

    updateEquilibriumHorizonUi();
    updatePlayPauseUi();
    renderLegend();
    syncStepPills();
    syncActionBar();
    setNewtonMessage('idle', () => t().tipIdle);
  }

  function renderLegend() {
    const d = t();
    const items = [
      `<span class="legend-item"><span class="legend-swatch" style="background:#FF6B6B;"></span><span>${d.legendCurrent}</span></span>`,
      `<span class="legend-item"><span class="legend-swatch" style="background:#339AF0;"></span><span>${d.legendRoom(state.roomTemp)}</span></span>`,
    ];
    state.savedRuns.forEach((run, i) => {
      items.push(
        `<span class="legend-item"><span class="legend-swatch" style="background:${run.color};"></span><span>${d.legendRun(i + 1, run.label)}</span></span>`
      );
    });
    el.runLegend.innerHTML = items.join('');
    el.clearRunsBtn.style.display = state.savedRuns.length ? 'inline-block' : 'none';
  }

  // ================= VISUAL SCENE UPDATERS =================
  function getActiveMaxTimeMin() {
    if (state.fixedMaxTimeMin !== null) return state.fixedMaxTimeMin;
    return calcEquilibriumTimeMin(state.kettleTarget, state.roomTemp, state.k);
  }

  function updateEquilibriumHorizonUi() {
    const d = t();
    const horizon = getActiveMaxTimeMin();
    const label = formatDurationShort(horizon);
    el.eqHorizonPill.textContent = state.fixedMaxTimeMin !== null
      ? d.eqHorizonLocked(label)
      : d.eqHorizonApprox(label);
  }

  function updateKettleThermometerUi() {
    const t = state.kettleTarget;
    el.kettleTargetBadge.textContent = `${t}°C`;
    el.kettleThermoControl.setAttribute('aria-valuenow', String(t));

    // Tall vertical thermometer track inside #kettleThermoControl: y = 46 (100°C) .. 222 (25°C)
    const ratio = Math.max(0, Math.min(1, (t - 25) / 75));
    const knobY = 222 - ratio * 176;
    const fillH = 230 - knobY;
    const color = tempToColor(t);

    el.kettleThermoFill.setAttribute('y', knobY.toFixed(1));
    el.kettleThermoFill.setAttribute('height', fillH.toFixed(1));
    el.kettleThermoFill.setAttribute('fill', color);
    el.kettleThermoBulb.setAttribute('fill', color);
    el.kettleThermoKnob.setAttribute('transform', `translate(51, ${knobY.toFixed(1)})`);
  }

  function updateRoomAtmosphere() {
    const rt = state.roomTemp;
    el.roomThermoText.textContent = `${rt}°C`;
    el.roomThermoControl.setAttribute('aria-valuenow', String(rt));

    // Weather icon
    if (rt <= 0) el.roomWeatherIcon.textContent = '❄️';
    else if (rt <= 14) el.roomWeatherIcon.textContent = '🌬️';
    else if (rt <= 26) el.roomWeatherIcon.textContent = '🌤️';
    else el.roomWeatherIcon.textContent = '☀️';

    // Tall interactive room thermometer fill & knob (-20..40 -> knobY 222..46)
    const ratio = Math.max(0, Math.min(1, (rt + 20) / 60));
    const knobY = 222 - ratio * 176;
    const fillH = 230 - knobY;
    const thermoColor = tempToColor(rt);
    el.roomThermoFill.setAttribute('y', knobY.toFixed(1));
    el.roomThermoFill.setAttribute('height', fillH.toFixed(1));
    el.roomThermoFill.setAttribute('fill', thermoColor);
    el.roomThermoBulb.setAttribute('fill', thermoColor);
    el.roomThermoKnob.setAttribute('transform', `translate(47, ${knobY.toFixed(1)})`);

    // Kitchen wall & window sky shift smoothly with room temperature
    if (rt <= 8) {
      el.wallStopTop.setAttribute('stop-color', '#E8F4FF');
      el.wallStopBot.setAttribute('stop-color', '#D4E9FF');
      el.skyStopTop.setAttribute('stop-color', '#6CB8F6');
      el.skyStopBot.setAttribute('stop-color', '#DCEFFF');
      el.hillBack.setAttribute('fill', '#E6F4FF');
      el.hillFront.setAttribute('fill', '#F4FAFF');
      el.windowSnow.setAttribute('opacity', '1');
      el.windowSun.setAttribute('opacity', '0.18');
    } else if (rt >= 28) {
      el.wallStopTop.setAttribute('stop-color', '#FFF0D6');
      el.wallStopBot.setAttribute('stop-color', '#FFD8B5');
      el.skyStopTop.setAttribute('stop-color', '#FFB75E');
      el.skyStopBot.setAttribute('stop-color', '#FFF1C1');
      el.hillBack.setAttribute('fill', '#B2E08A');
      el.hillFront.setAttribute('fill', '#8CD172');
      el.windowSnow.setAttribute('opacity', '0');
      el.windowSun.setAttribute('opacity', '1');
    } else {
      el.wallStopTop.setAttribute('stop-color', '#FFF5E0');
      el.wallStopBot.setAttribute('stop-color', '#FFE8C8');
      el.skyStopTop.setAttribute('stop-color', '#87D4FF');
      el.skyStopBot.setAttribute('stop-color', '#DFF4FF');
      el.hillBack.setAttribute('fill', '#9CE5B4');
      el.hillFront.setAttribute('fill', '#6FD497');
      el.windowSnow.setAttribute('opacity', '0');
      el.windowSun.setAttribute('opacity', '0.9');
    }

    updateEquilibriumHorizonUi();
    renderLegend();
  }

  function updateIsolationVisuals() {
    state.k = isolationToK(state.isolation);
    const prof = isolationProfile(state.isolation);
    el.isoBadge.textContent = `${state.isolation}%`;
    el.isoName.textContent = prof.shortName;
    el.isoControl.setAttribute('aria-valuenow', String(state.isolation));

    // Tall interactive isolation track inside #isoControl: y = 48 (100%) .. 232 (0%)
    const ratio = Math.max(0, Math.min(1, state.isolation / 100));
    const knobY = 232 - ratio * 184;
    const fillH = 238 - knobY;
    el.isoTrackFill.setAttribute('y', knobY.toFixed(1));
    el.isoTrackFill.setAttribute('height', fillH.toFixed(1));
    el.isoKnob.setAttribute('transform', `translate(44, ${knobY.toFixed(1)})`);

    ['skinBare', 'skinKnit', 'skinJacket', 'skinVacuum'].forEach((id) => {
      el[id].setAttribute('opacity', id === prof.skin ? '1' : '0');
    });
    updateEquilibriumHorizonUi();
  }

  function updateKettleVisuals() {
    const t = state.kettleTemp;
    const color = tempToColor(t);

    // Liquid height inside window (y=232..306, height 74)
    const maxH = 66;
    const h = Math.max(0, maxH * state.kettleFill);
    const y = 306 - h;
    el.kettleLiquid.setAttribute('y', y.toFixed(1));
    el.kettleLiquid.setAttribute('height', h.toFixed(1));
    el.kettleLiquid.setAttribute('fill', color);
    el.kettleSurface.setAttribute('cy', y.toFixed(1));
    el.kettleSurface.setAttribute('fill', color);
    el.kettleSurface.setAttribute('opacity', state.kettleFill > 0.05 ? '0.75' : '0');

    el.kettleTempText.textContent = `${Math.round(t)}°C`;
    el.kettleTempText.setAttribute('fill', t >= 65 ? '#C92A2A' : '#1864AB');

    // Heating base glow & bubbles & steam
    const isBoiling = state.phase === 'boiling';
    const isReady = state.phase === 'ready_to_pour';
    el.heaterGlow.setAttribute('opacity', isBoiling ? (0.45 + state.boilProgress * 0.55).toFixed(2) : '0');
    el.baseLed.setAttribute('fill', isBoiling ? '#FF5A5F' : isReady ? '#FFD93D' : '#95D5B2');

    const bubbleOpacity = isBoiling ? Math.min(1, state.boilProgress * 1.25) : 0;
    el.kettleBubbles.setAttribute('opacity', bubbleOpacity.toFixed(2));

    const steamOpacity =
      (isBoiling && t > 50) || (isReady && t > 55)
        ? Math.min(0.95, Math.max(0, (t - 45) / 50))
        : 0;
    el.kettleSteam.setAttribute('opacity', steamOpacity.toFixed(2));

    // Wiggle when hot boiling, hop when ready
    el.kettleGroup.classList.toggle('boiling-wiggle', isBoiling && t > 55);
    el.kettleGroup.classList.toggle('ready-hop', isReady && !state.dragging);
    el.kettleGroup.classList.toggle('draggable', isReady);
    el.kettleGroup.classList.toggle('dragging', state.dragging);

    // Drag hint arrow visible when ready & not currently dragging
    el.dragHint.setAttribute('opacity', isReady && !state.dragging ? '1' : '0');

    // Expressive kettle face
    if (isBoiling) {
      el.kettleMouth.setAttribute('d', 'M-5 6 Q0 2 5 6'); // focused puffing mouth
      el.kettleBlushL.setAttribute('opacity', '0.9');
      el.kettleBlushR.setAttribute('opacity', '0.9');
    } else if (isReady) {
      el.kettleMouth.setAttribute('d', 'M-7 4 Q0 12 7 4'); // big happy smile
      el.kettleBlushL.setAttribute('opacity', '0.85');
      el.kettleBlushR.setAttribute('opacity', '0.85');
    } else {
      el.kettleMouth.setAttribute('d', 'M-5 5 Q0 9.5 5 5');
      el.kettleBlushL.setAttribute('opacity', '0.45');
      el.kettleBlushR.setAttribute('opacity', '0.45');
    }
  }

  function updateThermosVisuals() {
    const fillH = 92 * state.thermosFill;
    const fillY = 316 - fillH;
    const temp = state.thermosTemp !== null ? state.thermosTemp : state.kettleTarget;
    const color = tempToColor(temp);

    el.thermosLiquid.setAttribute('y', fillY.toFixed(1));
    el.thermosLiquid.setAttribute('height', fillH.toFixed(1));
    el.thermosLiquid.setAttribute('fill', color);
    el.thermosSurface.setAttribute('cy', fillY.toFixed(1));
    el.thermosSurface.setAttribute('fill', color);
    el.thermosSurface.setAttribute('opacity', state.thermosFill > 0.05 ? '0.8' : '0');

    if (state.thermosTemp === null) {
      const d = t();
      el.thermosTempText.textContent = state.phase === 'pouring' ? d.thermosFilling : d.thermosEmpty;
      el.thermosTempText.setAttribute('fill', '#7B6050');
      el.thermosIceLayer.setAttribute('opacity', '0');
      el.heatWavesGroup.setAttribute('opacity', '0');
      el.thermosSteam.setAttribute('opacity', state.phase === 'pouring' && state.kettleTarget > 55 ? '0.75' : '0');
      el.thermosMouth.setAttribute('d', 'M-4 6 Q0 8 4 6');
      el.thermosBlushL.setAttribute('fill', '#FF8787');
      el.thermosBlushR.setAttribute('fill', '#FF8787');
      return;
    }

    // Frosted ice crystal overlay scales smoothly with iceFraction (0..1)
    el.thermosIceLayer.setAttribute('opacity', (state.iceFraction * 0.92).toFixed(2));

    el.thermosTempText.textContent =
      state.iceFraction > 0
        ? `🧊 ${state.thermosTemp.toFixed(1)}°C`
        : `${state.thermosTemp.toFixed(1)}°C`;
    el.thermosTempText.setAttribute('fill', state.thermosTemp >= 55 ? '#C92A2A' : '#1864AB');

    // Instantaneous heat flow rate (still nonzero during 0°C freezing plateau because ΔT = 0 - T_room!)
    const delta = state.thermosTemp - state.roomTemp;
    const absRate = Math.abs(-state.k * delta);

    // Heat escape waves scale smoothly with |dT/dt|
    const waveOpacity = Math.min(1, absRate / 1.4);
    el.heatWavesGroup.setAttribute('opacity', waveOpacity.toFixed(2));
    // Color heat waves coral when cooling, icy-blue/gold when warming
    const waveColor = delta >= 0 ? '#FF6B6B' : '#339AF0';
    el.heatWavesGroup.querySelectorAll('path').forEach((p, idx) => {
      p.setAttribute('stroke', idx % 2 === 0 ? waveColor : delta >= 0 ? '#FF922B' : '#74C0FC');
    });

    // Subtle steam shimmer above thermos if very hot and low isolation
    const steamOp = state.thermosTemp > 60 ? Math.min(0.65, ((state.thermosTemp - 55) / 50) * (1 - state.isolation / 130)) : 0;
    el.thermosSteam.setAttribute('opacity', steamOp.toFixed(2));

    // Expressive thermos face reacts to water temperature
    if (state.thermosTemp >= 72) {
      // Piping hot blushing open "o" / happy
      el.thermosMouth.setAttribute('d', 'M-4 6 Q0 12 4 6');
      el.thermosBlushL.setAttribute('fill', '#FF6B6B');
      el.thermosBlushR.setAttribute('fill', '#FF6B6B');
      el.thermosBlushL.setAttribute('opacity', '0.9');
      el.thermosBlushR.setAttribute('opacity', '0.9');
    } else if (state.thermosTemp <= 15) {
      // Chilly cute wavy shiver mouth + blue blush
      el.thermosMouth.setAttribute('d', 'M-6 7 Q-3 4 0 7 Q3 10 6 7');
      el.thermosBlushL.setAttribute('fill', '#74C0FC');
      el.thermosBlushR.setAttribute('fill', '#74C0FC');
      el.thermosBlushL.setAttribute('opacity', '0.85');
      el.thermosBlushR.setAttribute('opacity', '0.85');
    } else {
      // Cozy happy smile
      el.thermosMouth.setAttribute('d', 'M-6 5 Q0 11 6 5');
      el.thermosBlushL.setAttribute('fill', '#FF9E9E');
      el.thermosBlushR.setAttribute('fill', '#FF9E9E');
      el.thermosBlushL.setAttribute('opacity', '0.7');
      el.thermosBlushR.setAttribute('opacity', '0.7');
    }
  }

  function updateClockHands() {
    const mins = state.elapsedMin;
    const minAngle = (mins % 60) * 6;
    const hrAngle = ((mins / 60) % 12) * 30;
    el.clockMinHand.setAttribute('transform', `rotate(${minAngle.toFixed(1)})`);
    el.clockHourHand.setAttribute('transform', `rotate(${hrAngle.toFixed(1)})`);
    el.elapsedBadge.textContent = `⏱️ ${formatElapsedClock(mins)}`;
  }

  function updateCoolingHints() {
    if (state.phase !== 'cooling' || state.thermosTemp === null) return;
    const startT = state.thermosStartTemp !== null ? state.thermosStartTemp : state.kettleTarget;
    const delta = state.thermosTemp - state.roomTemp;

    if (state.iceFraction > 0.01 && state.iceFraction < 0.99) {
      if (state.roomTemp < 0) {
        setNewtonMessage('freezing_plateau', () => t().tipFreezingPlateau);
      } else if (state.roomTemp > 0) {
        setNewtonMessage('melting_plateau', () => t().tipMeltingPlateau);
      }
      return;
    }

    if (state.iceFraction >= 1 && state.thermosTemp < -0.5 && Math.abs(delta) >= 1.2) {
      setNewtonMessage('solid_ice', () => t().tipSolidIce(state.roomTemp));
      return;
    }

    if (Math.abs(delta) < 1.2 && state.elapsedMin > 5) {
      setNewtonMessage('equilibrium', () => t().tipEquilibrium(state.iceFraction >= 1, state.roomTemp));
    } else if (Math.abs(delta) < Math.abs(startT - state.roomTemp) * 0.45 && state.elapsedMin > 3) {
      const snapGap = Math.abs(delta).toFixed(1);
      setNewtonMessage('slowing_down', () => t().tipSlowingDown(snapGap));
    }
  }

  function updatePlayPauseUi() {
    el.playPauseBtn.textContent = state.paused ? '▶' : '⏸';
    el.playPauseBtn.classList.toggle('btn-mint', state.paused);
    el.playPauseBtn.classList.toggle('btn-yellow', !state.paused);
  }

  function renderGraph() {
    graph.render({
      phase: state.phase,
      points: state.points,
      savedRuns: state.savedRuns,
      roomTemp: state.roomTemp,
      kettleTarget: state.kettleTarget,
      k: state.k,
      iceFraction: state.iceFraction,
      elapsedMin: state.elapsedMin,
      maxTimeMin: getActiveMaxTimeMin(),
      showTheory: state.showTheory,
    });
  }

  // ================= SVG DRAG-TO-POUR INTERACTION =================
  function clientToSvgPoint(clientX, clientY) {
    const svg = el.kitchenSvg;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
  }

  function setupKettleDrag() {
    const kettle = el.kettleGroup;

    kettle.addEventListener('pointerdown', (evt) => {
      if (state.phase !== 'ready_to_pour') return;
      evt.preventDefault();
      kettle.setPointerCapture(evt.pointerId);
      const svgPt = clientToSvgPoint(evt.clientX, evt.clientY);
      state.dragging = true;
      state.dragOffsetX = svgPt.x - state.dragCurX;
      state.dragOffsetY = svgPt.y - state.dragCurY;
      state.dragStartClientX = evt.clientX;
      state.dragStartClientY = evt.clientY;
      AudioFX.pop(480, 0.06);
      updateKettleVisuals();
    });

    kettle.addEventListener('pointermove', (evt) => {
      if (!state.dragging || state.phase !== 'ready_to_pour') return;
      const svgPt = clientToSvgPoint(evt.clientX, evt.clientY);
      const dx = Math.max(-50, Math.min(210, svgPt.x - state.dragOffsetX));
      const dy = Math.max(-140, Math.min(35, svgPt.y - state.dragOffsetY));
      state.dragCurX = dx;
      state.dragCurY = dy;
      const tilt = Math.max(0, Math.min(28, (dx - 50) * 0.2));
      el.kettleWrapper.setAttribute('transform', `translate(${dx.toFixed(1)}, ${dy.toFixed(1)}) rotate(${tilt.toFixed(1)}, 234, 269)`);

      // Auto-pour when kettle spout enters thermos zone!
      if (dx >= 120) {
        state.dragging = false;
        startPouring(dx, dy);
      }
    });

    const endDrag = (evt) => {
      if (!state.dragging) return;
      state.dragging = false;
      const movedPx = Math.hypot(evt.clientX - state.dragStartClientX, evt.clientY - state.dragStartClientY);
      if (state.dragCurX >= 95 || movedPx < 10) {
        // Released near thermos OR quick-tapped kettle -> pour!
        startPouring(state.dragCurX, state.dragCurY);
      } else {
        // Snap gently back to base
        state.dragCurX = 0;
        state.dragCurY = 0;
        el.kettleWrapper.setAttribute('transform', 'translate(0, 0)');
        updateKettleVisuals();
      }
    };

    kettle.addEventListener('pointerup', endDrag);
    kettle.addEventListener('pointercancel', endDrag);
  }

  // ================= IN-SCENE VERTICAL SVG SLIDER INTERACTION =================
  function bindVerticalSvgSlider(groupEl, opts) {
    let activePointerId = null;

    const applyFromClientY = (clientX, clientY) => {
      const svgPt = clientToSvgPoint(clientX, clientY);
      const localY = svgPt.y - opts.originY;
      const clampedY = Math.max(opts.topY, Math.min(opts.bottomY, localY));
      const ratio = (opts.bottomY - clampedY) / (opts.bottomY - opts.topY);
      const val = Math.round(opts.min + ratio * (opts.max - opts.min));
      if (val !== opts.getValue()) {
        playSliderTick(val, opts.min, opts.max);
        opts.onChange(val);
      }
    };

    groupEl.addEventListener('pointerdown', (evt) => {
      evt.preventDefault();
      activePointerId = evt.pointerId;
      if (groupEl.setPointerCapture) groupEl.setPointerCapture(evt.pointerId);
      groupEl.classList.add('dragging');
      applyFromClientY(evt.clientX, evt.clientY);
    });

    groupEl.addEventListener('pointermove', (evt) => {
      if (activePointerId !== evt.pointerId) return;
      applyFromClientY(evt.clientX, evt.clientY);
    });

    const stopSlide = (evt) => {
      if (activePointerId !== evt.pointerId) return;
      activePointerId = null;
      groupEl.classList.remove('dragging');
    };

    groupEl.addEventListener('pointerup', stopSlide);
    groupEl.addEventListener('pointercancel', stopSlide);

    // Full keyboard accessibility for vertical SVG sliders
    groupEl.addEventListener('keydown', (evt) => {
      const cur = opts.getValue();
      const step = opts.step || 1;
      const bigStep = opts.bigStep || 5;
      let next = null;
      if (evt.key === 'ArrowUp' || evt.key === 'ArrowRight') next = cur + step;
      else if (evt.key === 'ArrowDown' || evt.key === 'ArrowLeft') next = cur - step;
      else if (evt.key === 'PageUp') next = cur + bigStep;
      else if (evt.key === 'PageDown') next = cur - bigStep;
      else if (evt.key === 'Home') next = opts.min;
      else if (evt.key === 'End') next = opts.max;
      if (next !== null) {
        evt.preventDefault();
        const clamped = Math.max(opts.min, Math.min(opts.max, next));
        if (clamped !== cur) {
          playSliderTick(clamped, opts.min, opts.max);
          opts.onChange(clamped);
        }
      }
    });
  }

  // ================= MAIN ANIMATION & PHYSICS LOOP =================
  let lastFrameTs = null;

  function tick(ts) {
    if (lastFrameTs === null) lastFrameTs = ts;
    const realDt = Math.min(0.05, (ts - lastFrameTs) / 1000);
    lastFrameTs = ts;

    if (state.phase === 'boiling') {
      state.boilProgress = Math.min(1, state.boilProgress + realDt / state.boilDuration);
      const eased = easeInOutCubic(state.boilProgress);
      state.kettleTemp = lerp(state.boilStartTemp, state.kettleTarget, eased);

      const statusPill = document.getElementById('boilStatusPill');
      if (statusPill) {
        statusPill.textContent = t().pillHeating(Math.round(state.kettleTemp), state.kettleTarget);
      }

      if (state.boilProgress >= 1) {
        completeBoiling();
      }
    } else if (state.phase === 'pouring') {
      state.pourProgress = Math.min(1, state.pourProgress + realDt / state.pourDuration);
      const p = state.pourProgress;

      // Stage 1 (0..0.22): Move kettle into pour position & pop thermos lid open
      // Stage 2 (0.22..0.78): Pour stream flows, kettle empties, thermos fills
      // Stage 3 (0.78..1.0): Kettle glides back, lid snaps closed
      const pourX = 100;
      const pourY = -100;
      const pourTilt = 40;

      if (p < 0.22) {
        const u = easeInOutCubic(p / 0.22);
        const x = lerp(state.pourFromX, pourX, u);
        const y = lerp(state.pourFromY, pourY, u);
        const rot = lerp(0, pourTilt, u);
        el.kettleWrapper.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot.toFixed(1)}, 234, 269)`);
        el.thermosCap.setAttribute('transform', `translate(${(52 * u).toFixed(1)}, ${(-32 * u).toFixed(1)}) rotate(${(38 * u).toFixed(1)}, 502, 174)`);
        el.pourStream.setAttribute('opacity', '0');
      } else if (p < 0.78) {
        const u = (p - 0.22) / 0.56;
        el.kettleWrapper.setAttribute('transform', `translate(${pourX}, ${pourY}) rotate(${pourTilt}, 234, 269)`);
        el.thermosCap.setAttribute('transform', 'translate(52, -32) rotate(38, 502, 174)');
        el.pourArcOuter.setAttribute('fill', tempToColor(state.kettleTarget));
        el.pourStream.setAttribute('opacity', '0.95');

        state.kettleFill = lerp(0.85, 0.08, u);
        state.thermosFill = lerp(0.0, 0.88, u);
      } else {
        const u = easeInOutCubic((p - 0.78) / 0.22);
        const x = lerp(pourX, 0, u);
        const y = lerp(pourY, 0, u);
        const rot = lerp(pourTilt, 0, u);
        el.kettleWrapper.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${rot.toFixed(1)}, 234, 269)`);
        el.thermosCap.setAttribute('transform', `translate(${(52 * (1 - u)).toFixed(1)}, ${(-32 * (1 - u)).toFixed(1)}) rotate(${(38 * (1 - u)).toFixed(1)}, 502, 174)`);
        el.pourStream.setAttribute('opacity', '0');
      }

      if (state.pourProgress >= 1) {
        el.kettleWrapper.setAttribute('transform', 'translate(0, 0)');
        el.thermosCap.setAttribute('transform', 'translate(0, 0)');
        el.pourStream.setAttribute('opacity', '0');
        completePouring();
      }
    } else if (state.phase === 'cooling' && !state.paused) {
      const simDtMin = (realDt * state.timeSpeed) / 60;
      if (simDtMin > 0) {
        // Exact analytical Newton's Law + 0°C Enthalpy of Fusion phase-change integration
        const prevIce = state.iceFraction;
        const next = stepThermalState(state.thermosTemp, state.iceFraction, state.roomTemp, state.k, simDtMin);
        state.thermosTemp = next.T;
        state.iceFraction = next.iceFraction;
        state.elapsedMin += simDtMin;

        // Sample cleanly across the fixed equilibrium time axis without resizing it
        const horizon = state.fixedMaxTimeMin || 60;
        const lastPt = state.points[state.points.length - 1];
        const minGap = Math.max(0.05, horizon / 220);
        const phaseBoundaryCrossed =
          (prevIce === 0 && state.iceFraction > 0) ||
          (prevIce < 1 && state.iceFraction >= 1) ||
          (prevIce === 1 && state.iceFraction < 1) ||
          (prevIce > 0 && state.iceFraction <= 0);
        if (state.elapsedMin <= horizon) {
          if (
            !lastPt ||
            phaseBoundaryCrossed ||
            state.elapsedMin - lastPt.t >= minGap ||
            Math.abs(state.thermosTemp - lastPt.T) >= 0.45
          ) {
            state.points.push({
              t: state.elapsedMin,
              T: state.thermosTemp,
              roomTemp: state.roomTemp,
              iceFraction: state.iceFraction,
            });
          }
        } else if (lastPt && lastPt.t < horizon) {
          // Record exact final point right at the equilibrium right-edge
          state.points.push({
            t: horizon,
            T: state.thermosTemp,
            roomTemp: state.roomTemp,
            iceFraction: state.iceFraction,
          });
        }
        checkMissions();
      }
    }

    updateKettleVisuals();
    updateThermosVisuals();
    updateClockHands();
    updateCoolingHints();
    renderGraph();

    global.requestAnimationFrame(tick);
  }

  // ================= EVENT WIRING =================
  function playSliderTick(val, min, max) {
    const now = performance.now();
    if (now - state.lastTickSound > 55) {
      state.lastTickSound = now;
      const ratio = (val - min) / (max - min);
      AudioFX.tick(480 + ratio * 380);
    }
  }

  function setKettleTarget(val) {
    const clamped = Math.max(25, Math.min(100, Math.round(val)));
    state.kettleTarget = clamped;
    updateKettleThermometerUi();

    if (state.phase === 'idle') {
      state.kettleTemp = Math.min(20, clamped - 5);
      syncActionBar();
    } else if (state.phase === 'ready_to_pour') {
      // Allow re-boiling cleanly if target changed before pouring
      state.phase = 'idle';
      state.kettleTemp = Math.min(20, clamped - 5);
      syncStepPills();
      syncActionBar();
      setNewtonMessage('retarget', () => t().tipRetarget(clamped));
    }
    updateEquilibriumHorizonUi();
  }

  function setRoomTemp(val) {
    const clamped = Math.max(-20, Math.min(40, Math.round(val)));
    state.roomTemp = clamped;
    updateRoomAtmosphere();
    if (state.phase === 'cooling') {
      setNewtonMessage(
        'room_changed_' + (clamped < 0 ? 'subzero' : clamped <= 5 ? 'cold' : clamped >= 30 ? 'hot' : 'mid'),
        () =>
          clamped < 0
            ? t().tipRoomSubzero(clamped)
            : clamped <= 5
              ? t().tipRoomCold(clamped)
              : clamped >= 30
                ? t().tipRoomHot(clamped)
                : t().tipRoomMid(clamped)
      );
    }
  }

  function setIsolation(val) {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    state.isolation = clamped;
    updateIsolationVisuals();
    if (state.phase === 'cooling') {
      const prof = isolationProfile(clamped);
      const snapK = state.k;
      setNewtonMessage(
        'iso_' + prof.skin,
        () => {
          const curProf = isolationProfile(clamped);
          return clamped >= 80
            ? t().tipIsoHigh(curProf.name, snapK.toFixed(4))
            : clamped <= 20
              ? t().tipIsoLow(curProf.name, snapK.toFixed(3))
              : t().tipIsoMid(curProf.name, snapK.toFixed(3));
        }
      );
    }
  }

  function setSpeed(speed) {
    state.timeSpeed = speed;
    el.speedPills.querySelectorAll('.speed-pill').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.speed) === speed);
    });
  }

  function openModal(id) {
    AudioFX.pop(560);
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    AudioFX.pop(420);
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function bindEvents() {
    // Tall interactive in-scene SVG sliders (kettle temp, room temp, isolation)
    bindVerticalSvgSlider(el.kettleThermoControl, {
      originY: 26,
      topY: 46,
      bottomY: 222,
      min: 25,
      max: 100,
      step: 1,
      bigStep: 5,
      getValue: () => state.kettleTarget,
      onChange: setKettleTarget,
    });

    bindVerticalSvgSlider(el.roomThermoControl, {
      originY: 26,
      topY: 46,
      bottomY: 222,
      min: -20,
      max: 40,
      step: 1,
      bigStep: 5,
      getValue: () => state.roomTemp,
      onChange: setRoomTemp,
    });

    bindVerticalSvgSlider(el.isoControl, {
      originY: 26,
      topY: 48,
      bottomY: 232,
      min: 0,
      max: 100,
      step: 1,
      bigStep: 10,
      getValue: () => state.isolation,
      onChange: setIsolation,
    });

    // Speed pills & play/pause inside Graph Card
    el.speedPills.querySelectorAll('.speed-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        AudioFX.pop(600);
        setSpeed(Number(btn.dataset.speed));
      });
    });

    el.playPauseBtn.addEventListener('click', () => {
      AudioFX.pop(state.paused ? 580 : 440);
      state.paused = !state.paused;
      updatePlayPauseUi();
    });

    // Graph tools
    el.saveCompareBtn.addEventListener('click', () => {
      AudioFX.pop(640);
      if (state.points.length < 2) {
        setNewtonMessage('need_data_compare', () => t().tipNeedCompare);
        return;
      }
      if (state.currentRunSaved) {
        setNewtonMessage('already_pinned', () => t().tipAlreadyPinned);
        return;
      }
      saveCurrentRunForCompare();
      setNewtonMessage('pinned', () => t().tipPinned);
    });

    el.clearRunsBtn.addEventListener('click', () => {
      AudioFX.pop(420);
      state.savedRuns = [];
      renderLegend();
    });

    // Language toggle (EN / NL Vlaams)
    el.langToggle.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextLang = btn.dataset.lang;
        if (nextLang === I18n.getLang()) return;
        AudioFX.pop(580);
        I18n.setLang(nextLang);
        applyLanguage();
      });
    });

    // Top bar actions
    el.newRunBtn.addEventListener('click', () => {
      AudioFX.pop(500);
      if (state.points.length >= 6 && state.savedRuns.length < 4) {
        saveCurrentRunForCompare();
      }
      resetExperiment(false);
    });

    el.soundBtn.addEventListener('click', () => {
      const muted = AudioFX.toggleMute();
      el.soundBtn.textContent = muted ? '🔇' : '🔊';
    });

    el.missionsBtn.addEventListener('click', () => {
      renderMissions();
      openModal('missionsModal');
    });

    el.guideBtn.addEventListener('click', () => openModal('guideModal'));

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    [el.missionsModal, el.guideModal].forEach((modal) => {
      modal.addEventListener('click', (evt) => {
        if (evt.target === modal) closeModal(modal.id);
      });
    });

    setupKettleDrag();
  }

  // ================= BOOTSTRAP =================
  function init() {
    cacheDom();
    graph = new CoolingGraph(el.tempGraph);
    bindEvents();

    setKettleTarget(95);
    setRoomTemp(20);
    setIsolation(45);
    setSpeed(60);
    applyLanguage();
    syncStepPills();
    updatePlayPauseUi();

    global.requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
