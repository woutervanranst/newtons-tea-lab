/* High-DPI Pazu-styled Temperature vs. Time Graph Engine
   Uses a fixed equilibrium-based time axis locked upon pouring. */
(function (global) {
  'use strict';

  const RUN_COLORS = ['#7C6CF6', '#22B8CF', '#F59F00', '#E64980'];

  function formatDurationShort(minutes) {
    if (minutes < 1) {
      return Math.round(minutes * 60) + 's';
    }
    if (minutes < 60) {
      const m = Math.floor(minutes);
      const s = Math.round((minutes - m) * 60);
      if (s === 0 || minutes >= 10) return Math.round(minutes) + 'm';
      return m + 'm ' + s + 's';
    }
    const hrs = Math.floor(minutes / 60);
    const remM = Math.round(minutes - hrs * 60);
    if (remM === 0) return hrs + 'h';
    if (remM === 60) return (hrs + 1) + 'h';
    return hrs + 'h ' + remM + 'm';
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

  /* Calculate time until practical thermal equilibrium (|T - T_room| <= 0.5°C) */
  function calcEquilibriumTimeMin(startTemp, roomTemp, k) {
    const delta = Math.abs(startTemp - roomTemp);
    const eps = 0.5;
    const safeK = Math.max(0.001, k);
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
    if (minutes === 0) return '0';
    if (maxMinutes <= 120) {
      return Math.round(minutes) + 'm';
    }
    const hrs = minutes / 60;
    return Number.isInteger(hrs) ? hrs + 'h' : hrs.toFixed(1) + 'h';
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

      // Compute Y range stably (-10..105 when cold room, else 0..105)
      let minTemp = Math.min(0, state.roomTemp - 5);
      if (state.savedRuns) {
        state.savedRuns.forEach((run) => {
          minTemp = Math.min(minTemp, run.roomTemp - 5);
        });
      }
      minTemp = Math.floor(minTemp / 10) * 10;
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
      ctx.save();
      ctx.font = '700 12.5px "Fredoka", "Nunito", ui-rounded, sans-serif';
      ctx.fillStyle = '#6E5547';
      ctx.textAlign = 'center';
      ctx.fillText('Time →', pad.left + plotW / 2, h - 14);
      ctx.translate(16, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Temperature (°C)', 0, 0);
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
      const roomLabel = 'Room ' + state.roomTemp.toFixed(0) + '°C';
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

      // Subtle dashed expected Newton curve preview
      if (state.showTheory) {
        const T0 = state.phase === 'cooling' && state.points.length ? state.points[0].T : state.kettleTarget;
        const Tr = state.roomTemp;
        const k = state.k;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 135, 67, 0.36)';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        const samples = 100;
        for (let i = 0; i <= samples; i++) {
          const t = (maxTimeMin * i) / samples;
          const T = Tr + (T0 - Tr) * Math.exp(-k * t);
          const x = xOf(t);
          const y = yOf(T);
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
          const liveLabel = last.T.toFixed(1) + '°C';
          ctx.font = '700 12.5px "Fredoka", "Nunito", ui-rounded, sans-serif';
          const lw = ctx.measureText(liveLabel).width + 16;
          const lh = 24;
          let bx = lx + 12;
          if (bx + lw > pad.left + plotW - 6) bx = lx - lw - 12;
          let by = ly - lh / 2;
          by = Math.max(pad.top + 8, Math.min(pad.top + plotH - lh - 8, by));

          ctx.fillStyle = '#FFFDF7';
          ctx.strokeStyle = '#4A3528';
          ctx.lineWidth = 2.2;
          this._roundRect(ctx, bx, by, lw, lh, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#C92A2A';
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
            ? 'Pour hot water into the thermos to start plotting!'
            : 'Boil & pour water to watch Newton’s cooling curve!';
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

        const line1 = formatDurationShort(closest.t) + '  •  ' + closest.T.toFixed(1) + '°C';
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
    formatDurationShort,
    calcEquilibriumTimeMin,
  };
})(window);
