/* High-DPI Pazu-styled Temperature vs. Time Graph Engine
   Uses a fixed equilibrium-based time axis locked upon pouring. */
(function (global) {
  'use strict';

  const RUN_COLORS = ['#7C6CF6', '#22B8CF', '#F59F00', '#E64980'];

  // Water phase-change thermodynamics:
  // Enthalpy of fusion L_f = 334 kJ/kg, c_water = 4.186 kJ/(kg·K) -> L_f / c_water ≈ 79.8°C
  // Specific heat of ice c_ice ≈ 2.09 kJ/(kg·K) ≈ 0.5 * c_water -> ice cools ~2x faster (k_ice = 2*k)
  const FREEZE_TEMP = 0;
  const LATENT_EQ_C = 79.8;
  const ICE_K_MULT = 2.0;

  /* Exact analytical step combining Newton's Law of Cooling + 0°C Enthalpy of Fusion plateau.
     Handles liquid cooling/warming, freezing plateau (0 -> 1 iceFraction),
     ice cooling/warming (2x faster), and reverse melting plateau (1 -> 0 iceFraction). */
  function stepThermalState(startT, startIce, roomTemp, k, dtMin) {
    let T = startT;
    let ice = Math.max(0, Math.min(1, startIce || 0));
    let rem = Math.max(0, dtMin);
    const safeK = Math.max(1e-6, k);

    for (let iter = 0; iter < 5 && rem > 1e-9; iter++) {
      // 1. Liquid water regime (T > 0, or T == 0 warming/steady with no ice)
      if (ice <= 0 && (T > FREEZE_TEMP || (T === FREEZE_TEMP && roomTemp >= FREEZE_TEMP))) {
        ice = 0;
        if (roomTemp < FREEZE_TEMP && T > FREEZE_TEMP) {
          const tHitZero = Math.log((T - roomTemp) / (FREEZE_TEMP - roomTemp)) / safeK;
          if (rem < tHitZero) {
            T = roomTemp + (T - roomTemp) * Math.exp(-safeK * rem);
            rem = 0;
          } else {
            T = FREEZE_TEMP;
            rem -= tHitZero;
          }
        } else {
          T = roomTemp + (T - roomTemp) * Math.exp(-safeK * rem);
          rem = 0;
        }
      }
      // 2. Solid ice regime (T < 0, or T == 0 cooling/steady when 100% ice)
      else if (ice >= 1 && (T < FREEZE_TEMP || (T === FREEZE_TEMP && roomTemp <= FREEZE_TEMP))) {
        ice = 1;
        const kIce = safeK * ICE_K_MULT;
        if (roomTemp > FREEZE_TEMP && T < FREEZE_TEMP) {
          const tHitZero = Math.log((roomTemp - T) / (roomTemp - FREEZE_TEMP)) / kIce;
          if (rem < tHitZero) {
            T = roomTemp + (T - roomTemp) * Math.exp(-kIce * rem);
            rem = 0;
          } else {
            T = FREEZE_TEMP;
            rem -= tHitZero;
          }
        } else {
          T = roomTemp + (T - roomTemp) * Math.exp(-kIce * rem);
          rem = 0;
        }
      }
      // 3. Phase-change plateau at 0°C (enthalpy of fusion: freezing or melting)
      else {
        T = FREEZE_TEMP;
        if (roomTemp < FREEZE_TEMP && ice < 1) {
          const dfPerMin = (safeK * (FREEZE_TEMP - roomTemp)) / LATENT_EQ_C;
          const tFinish = (1 - ice) / dfPerMin;
          if (rem < tFinish) {
            ice = Math.min(1, ice + dfPerMin * rem);
            rem = 0;
          } else {
            ice = 1;
            rem -= tFinish;
          }
        } else if (roomTemp > FREEZE_TEMP && ice > 0) {
          const dfPerMin = (safeK * (roomTemp - FREEZE_TEMP)) / LATENT_EQ_C;
          const tFinish = ice / dfPerMin;
          if (rem < tFinish) {
            ice = Math.max(0, ice - dfPerMin * rem);
            rem = 0;
          } else {
            ice = 0;
            rem -= tFinish;
          }
        } else {
          rem = 0;
        }
      }
    }

    return { T, iceFraction: ice };
  }

  function i18n() {
    return (global.NewtonI18n && global.NewtonI18n.dict()) || {
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
    };
  }

  function formatDurationShort(minutes) {
    const t = i18n();
    if (minutes < 1) {
      return Math.round(minutes * 60) + t.unitSec;
    }
    if (minutes < 60) {
      const m = Math.floor(minutes);
      const s = Math.round((minutes - m) * 60);
      if (s === 0 || minutes >= 10) return Math.round(minutes) + t.unitMin;
      return m + t.unitMin + ' ' + s + t.unitSec;
    }
    const hrs = Math.floor(minutes / 60);
    const remM = Math.round(minutes - hrs * 60);
    if (remM === 0) return hrs + t.unitHour;
    if (remM === 60) return (hrs + 1) + t.unitHour;
    return hrs + t.unitHour + ' ' + remM + t.unitMin;
  }

  /* Round raw equilibrium minutes up to an evenly divisible, readable axis max */
  function pickNiceEquilibriumAxis(rawMin) {
    const safe = Math.max(10, rawMin);
    if (safe <= 20) return Math.ceil(safe / 5) * 5;        // 10, 15, 20m
    if (safe <= 60) return Math.ceil(safe / 15) * 15;      // 30, 45, 60m
    if (safe <= 120) return Math.ceil(safe / 20) * 20;     // 80, 100, 120m
    if (safe <= 360) return Math.ceil(safe / 60) * 60;     // 3h..6h
    if (safe <= 720) return Math.ceil(safe / 120) * 120;   // 8h, 10h, 12h
    if (safe <= 1440) return Math.ceil(safe / 240) * 240;  // 16h, 20h, 24h
    return Math.ceil(safe / 360) * 360;                    // 30h, 36h, 42h...
  }

  /* Calculate time until practical thermal equilibrium (|T - T_room| <= 0.5°C),
     including the 0°C freezing enthalpy plateau and faster ice cooling when T_room < 0°C */
  function calcEquilibriumTimeMin(startTemp, roomTemp, k) {
    const eps = 0.5;
    const safeK = Math.max(0.001, k);

    if (startTemp > FREEZE_TEMP && roomTemp < FREEZE_TEMP) {
      const tLiquid = Math.log((startTemp - roomTemp) / (FREEZE_TEMP - roomTemp)) / safeK;
      const tFreeze = LATENT_EQ_C / (safeK * (FREEZE_TEMP - roomTemp));
      const iceGap = Math.abs(roomTemp - FREEZE_TEMP);
      const tIce = iceGap > eps ? Math.log(iceGap / eps) / (safeK * ICE_K_MULT) : 0;
      return pickNiceEquilibriumAxis(tLiquid + tFreeze + tIce);
    }

    const delta = Math.abs(startTemp - roomTemp);
    const rawMin = delta > eps * 2
      ? Math.log(delta / eps) / safeK
      : 4.5 / safeK;
    return pickNiceEquilibriumAxis(rawMin);
  }

  function pickTickCount(maxMinutes) {
    if (maxMinutes <= 20) return Math.max(2, maxMinutes / 5);
    if (maxMinutes <= 60) return Math.max(2, maxMinutes / 15);
    if (maxMinutes <= 120) return Math.max(4, maxMinutes / 20);
    if (maxMinutes <= 360) return Math.max(3, maxMinutes / 60);
    if (maxMinutes <= 720) return Math.max(4, maxMinutes / 120);
    if (maxMinutes <= 1440) return Math.max(4, maxMinutes / 240);
    const stepMin = Math.ceil(maxMinutes / 60 / 6) * 60;
    return Math.max(4, Math.round(maxMinutes / stepMin));
  }

  function formatAxisTick(minutes, maxMinutes) {
    const t = i18n();
    if (minutes === 0) return '0';
    if (maxMinutes <= 120) {
      return Math.round(minutes) + t.unitMin;
    }
    const hrs = minutes / 60;
    return Number.isInteger(hrs) ? hrs + t.unitHour : hrs.toFixed(1) + t.unitHour;
  }

  class CoolingGraph {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hoverX = null;
      this.hoverY = null;
      this.lastState = null;

      this._bindPointer();
      this._resizeObserver = null;
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          if (this.lastState) this.render(this.lastState);
        });
        this._resizeObserver.observe(canvas.parentElement || canvas);
      }
      global.addEventListener('resize', () => {
        if (this.lastState) this.render(this.lastState);
      });
    }

    _bindPointer() {
      const updatePointer = (evt) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        this.hoverX = clientX - rect.left;
        this.hoverY = clientY - rect.top;
        if (this.lastState) this.render(this.lastState);
      };
      const clearPointer = () => {
        this.hoverX = null;
        this.hoverY = null;
        if (this.lastState) this.render(this.lastState);
      };

      this.canvas.addEventListener('mousemove', updatePointer);
      this.canvas.addEventListener('mouseleave', clearPointer);
      this.canvas.addEventListener('touchstart', updatePointer, { passive: true });
      this.canvas.addEventListener('touchmove', updatePointer, { passive: true });
      this.canvas.addEventListener('touchend', clearPointer);
    }

    _syncSize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
      const w = Math.max(260, Math.round(rect.width));
      const h = Math.max(190, Math.round(rect.height));
      if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    render(state) {
      this.lastState = state;
      const { w, h } = this._syncSize();
      const ctx = this.ctx;

      const pad = { top: 22, right: 22, bottom: 48, left: 54 };
      const plotW = Math.max(80, w - pad.left - pad.right);
      const plotH = Math.max(100, h - pad.top - pad.bottom);

      ctx.clearRect(0, 0, w, h);

      // Soft cream notebook chart background
      ctx.fillStyle = '#FFFDF7';
      this._roundRect(ctx, pad.left, pad.top, plotW, plotH, 16);
      ctx.fill();

      // Compute Y range stably (down to -25°C when sub-zero room, else 0..105)
      let minTemp = state.roomTemp < 0 ? Math.min(-24, state.roomTemp - 4) : 0;
      if (state.savedRuns) {
        state.savedRuns.forEach((run) => {
          if (run.roomTemp < 0) minTemp = Math.min(minTemp, run.roomTemp - 4);
        });
      }
      if (minTemp < 0) {
        minTemp = Math.min(-24, Math.floor(minTemp / 5) * 5);
      }
      const maxTemp = 105;

      // Fixed equilibrium-based X axis (locked as of pouring — never resizes)
      const maxTimeMin = Math.max(
        10,
        state.maxTimeMin || calcEquilibriumTimeMin(state.kettleTarget, state.roomTemp, state.k)
      );

      const xOf = (tMin) => pad.left + (tMin / maxTimeMin) * plotW;
      const yOf = (tempC) => pad.top + ((maxTemp - tempC) / (maxTemp - minTemp)) * plotH;

      // Horizontal temperature grid lines (every 20°C)
      ctx.save();
      ctx.strokeStyle = '#EFE6D8';
      ctx.lineWidth = 1.4;
      ctx.font = '700 12.5px "Fredoka", "Nunito", ui-rounded, sans-serif';
      ctx.fillStyle = '#7A6254';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const yStep = 20;
      const firstTick = Math.ceil(minTemp / yStep) * yStep;
      for (let t = firstTick; t <= 100; t += yStep) {
        const y = yOf(t);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();
        ctx.fillText(t + '°', pad.left - 10, y);
      }

      // Vertical time grid lines
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xTicks = pickTickCount(maxTimeMin);
      for (let i = 0; i <= xTicks; i++) {
        const tVal = (maxTimeMin / xTicks) * i;
        const x = xOf(tVal);
        if (i > 0 && i < xTicks) {
          ctx.beginPath();
          ctx.moveTo(x, pad.top);
          ctx.lineTo(x, pad.top + plotH);
          ctx.stroke();
        }
        ctx.fillText(formatAxisTick(tVal, maxTimeMin), x, pad.top + plotH + 10);
      }
      ctx.restore();

      // Axis titles
      const tDict = i18n();
      ctx.save();
      ctx.font = '700 12.5px "Fredoka", "Nunito", ui-rounded, sans-serif';
      ctx.fillStyle = '#6E5547';
      ctx.textAlign = 'center';
      ctx.fillText(tDict.axisTime, pad.left + plotW / 2, h - 14);
      ctx.translate(16, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(tDict.axisTemp, 0, 0);
      ctx.restore();

      // Clip plotting interior
      ctx.save();
      this._roundRect(ctx, pad.left, pad.top, plotW, plotH, 16);
      ctx.clip();

      // Room temperature asymptote band + dashed line
      const roomY = yOf(state.roomTemp);
      ctx.save();
      ctx.fillStyle = 'rgba(77, 171, 247, 0.08)';
      ctx.fillRect(pad.left, roomY, plotW, pad.top + plotH - roomY);

      ctx.strokeStyle = '#339AF0';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(pad.left, roomY);
      ctx.lineTo(pad.left + plotW, roomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Room temp pill tag inside chart
      const roomLabel = tDict.graphRoomTag(state.roomTemp.toFixed(0));
      ctx.font = '700 12px "Fredoka", "Nunito", ui-rounded, sans-serif';
      const tagW = ctx.measureText(roomLabel).width + 16;
      const tagH = 22;
      const tagX = pad.left + plotW - tagW - 10;
      const tagY = Math.max(pad.top + 8, Math.min(pad.top + plotH - tagH - 8, roomY - tagH - 6));
      ctx.fillStyle = '#E7F5FF';
      ctx.strokeStyle = '#339AF0';
      ctx.lineWidth = 1.8;
      this._roundRect(ctx, tagX, tagY, tagW, tagH, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1971C2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roomLabel, tagX + tagW / 2, tagY + tagH / 2 + 0.5);
      ctx.restore();

      // Highlight 0°C freezing line when sub-zero temperatures are shown
      if (minTemp < 0) {
        const freezeY = yOf(FREEZE_TEMP);
        ctx.save();
        ctx.strokeStyle = 'rgba(21, 170, 191, 0.55)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(pad.left, freezeY);
        ctx.lineTo(pad.left + plotW, freezeY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '700 11px "Fredoka", "Nunito", ui-rounded, sans-serif';
        ctx.fillStyle = '#0C8599';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(tDict.graphFreezeLine, pad.left + 10, freezeY - 4);
        ctx.restore();
      }

      // Subtle dashed expected Newton + freezing enthalpy curve preview
      if (state.showTheory) {
        const T0 = state.phase === 'cooling' && state.points.length ? state.points[0].T : state.kettleTarget;
        const Tr = state.roomTemp;
        const k = state.k;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 135, 67, 0.42)';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        const samples = 140;
        const stepDt = maxTimeMin / samples;
        let simT = T0;
        let simIce = 0;
        for (let i = 0; i <= samples; i++) {
          const t = stepDt * i;
          if (i > 0) {
            const next = stepThermalState(simT, simIce, Tr, k, stepDt);
            simT = next.T;
            simIce = next.iceFraction;
          }
          const x = xOf(t);
          const y = yOf(simT);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Saved previous runs (for side-by-side comparison)
      if (state.savedRuns && state.savedRuns.length) {
        state.savedRuns.forEach((run, idx) => {
          if (!run.points || run.points.length < 2) return;
          const color = run.color || RUN_COLORS[idx % RUN_COLORS.length];
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = 3.2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          run.points.forEach((pt, i) => {
            const x = xOf(pt.t);
            const y = yOf(pt.T);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.restore();
        });
      }

      // Current active run curve + soft pastel area fill
      const pts = state.points || [];
      if (pts.length >= 1) {
        if (pts.length >= 2) {
          const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
          grad.addColorStop(0, 'rgba(255, 107, 107, 0.26)');
          grad.addColorStop(0.55, 'rgba(255, 169, 77, 0.13)');
          grad.addColorStop(1, 'rgba(116, 192, 252, 0.04)');

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(xOf(pts[0].t), roomY);
          pts.forEach((pt) => {
            ctx.lineTo(xOf(pt.t), yOf(pt.T));
          });
          ctx.lineTo(xOf(pts[pts.length - 1].t), roomY);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 8.5;
          ctx.beginPath();
          pts.forEach((pt, i) => {
            const x = xOf(pt.t);
            const y = yOf(pt.T);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          const lineGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
          lineGrad.addColorStop(0, '#FF5A5F');
          lineGrad.addColorStop(0.5, '#FF922B');
          lineGrad.addColorStop(1, '#339AF0');
          ctx.strokeStyle = lineGrad;
          ctx.lineWidth = 4.6;
          ctx.stroke();
          ctx.restore();
        }

        // Live glowing marker dot + clean floating temperature pill
        const last = pts[pts.length - 1];
        const lx = Math.min(pad.left + plotW - 4, xOf(last.t));
        const ly = yOf(last.T);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 90, 95, 0.22)';
        ctx.beginPath();
        ctx.arc(lx, ly, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF5A5F';
        ctx.strokeStyle = '#4A3528';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(lx, ly, 6.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(lx - 2, ly - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        if (this.hoverX === null) {
          const icePct = Math.round((state.iceFraction || last.iceFraction || 0) * 100);
          const liveLabel =
            icePct > 0 && icePct < 100
              ? tDict.graphLiveIce(icePct)
              : icePct >= 100
                ? `🧊 ${last.T.toFixed(1)}°C`
                : `${last.T.toFixed(1)}°C`;
          ctx.font = '700 12.5px "Fredoka", "Nunito", ui-rounded, sans-serif';
          const lw = ctx.measureText(liveLabel).width + 16;
          const lh = 24;
          let bx = lx + 12;
          if (bx + lw > pad.left + plotW - 6) bx = lx - lw - 12;
          let by = ly - lh / 2;
          by = Math.max(pad.top + 8, Math.min(pad.top + plotH - lh - 8, by));

          ctx.fillStyle = icePct > 0 ? '#E7F5FF' : '#FFFDF7';
          ctx.strokeStyle = '#4A3528';
          ctx.lineWidth = 2.2;
          this._roundRect(ctx, bx, by, lw, lh, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = icePct > 0 ? '#1864AB' : '#C92A2A';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(liveLabel, bx + lw / 2, by + lh / 2 + 0.5);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = '700 14px "Fredoka", "Nunito", ui-rounded, sans-serif';
        ctx.fillStyle = '#9C8372';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const msg =
          state.phase === 'ready_to_pour'
            ? tDict.graphEmptyReady
            : tDict.graphEmptyIdle;
        ctx.fillText(msg, pad.left + plotW / 2, pad.top + plotH * 0.4);
        ctx.restore();
      }

      // Hover / touch inspector tooltip
      if (
        this.hoverX !== null &&
        pts.length >= 2 &&
        this.hoverX >= pad.left &&
        this.hoverX <= pad.left + plotW &&
        this.hoverY >= pad.top &&
        this.hoverY <= pad.top + plotH
      ) {
        const hoverT = ((this.hoverX - pad.left) / plotW) * maxTimeMin;
        let closest = pts[0];
        let bestDist = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const d = Math.abs(pts[i].t - hoverT);
          if (d < bestDist) {
            bestDist = d;
            closest = pts[i];
          }
        }
        const cx = xOf(closest.t);
        const cy = yOf(closest.T);

        ctx.save();
        ctx.strokeStyle = 'rgba(74, 53, 40, 0.25)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, pad.top);
        ctx.lineTo(cx, pad.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#FFD43B';
        ctx.strokeStyle = '#4A3528';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const ptIce = Math.round((closest.iceFraction || 0) * 100);
        const phaseTag = ptIce > 0 && ptIce < 100 ? `  •  🧊 ${ptIce}%` : ptIce >= 100 ? `  •  🧊 ${tDict.graphTooltipIce}` : '';
        const line1 = formatDurationShort(closest.t) + '  •  ' + closest.T.toFixed(1) + '°C' + phaseTag;
        ctx.font = '700 12.5px "Fredoka", "Nunito", ui-rounded, sans-serif';
        const boxW = ctx.measureText(line1).width + 22;
        const boxH = 30;
        let bx = cx + 12;
        if (bx + boxW > pad.left + plotW - 6) bx = cx - boxW - 12;
        let by = cy - boxH - 10;
        if (by < pad.top + 8) by = cy + 12;

        ctx.fillStyle = '#4A3528';
        this._roundRect(ctx, bx, by, boxW, boxH, 12);
        ctx.fill();

        ctx.fillStyle = '#FFFDF7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line1, bx + boxW / 2, by + boxH / 2 + 0.5);
        ctx.restore();
      }

      ctx.restore(); // end clip

      // Chunky Pazu frame around plot area
      ctx.save();
      ctx.strokeStyle = '#4A3528';
      ctx.lineWidth = 3;
      this._roundRect(ctx, pad.left, pad.top, plotW, plotH, 16);
      ctx.stroke();
      ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }
  }

  global.NewtonGraph = {
    CoolingGraph,
    RUN_COLORS,
    FREEZE_TEMP,
    LATENT_EQ_C,
    ICE_K_MULT,
    stepThermalState,
    formatDurationShort,
    calcEquilibriumTimeMin,
  };
})(window);
