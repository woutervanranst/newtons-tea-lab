/* High-DPI Pazu-styled Temperature vs. Time Graph Engine */
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

  function formatAxisTick(minutes, maxMinutes) {
    if (maxMinutes <= 2) {
      return Math.round(minutes * 60) + 's';
    }
    if (maxMinutes <= 120) {
      return Math.round(minutes) + 'm';
    }
    const hrs = minutes / 60;
    return Number.isInteger(hrs) ? hrs + 'h' : hrs.toFixed(1) + 'h';
  }

  function pickNiceMaxTime(elapsedMin) {
    const stops = [5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880];
    const needed = Math.max(elapsedMin * 1.15, 15);
    for (let i = 0; i < stops.length; i++) {
      if (stops[i] >= needed) return stops[i];
    }
    return Math.ceil(needed / 600) * 600;
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

      const pad = { top: 20, right: 20, bottom: 40, left: 48 };
      const plotW = Math.max(60, w - pad.left - pad.right);
      const plotH = Math.max(60, h - pad.top - pad.bottom);

      ctx.clearRect(0, 0, w, h);

      // Soft cream notebook chart background
      ctx.fillStyle = '#FFFDF7';
      this._roundRect(ctx, pad.left, pad.top, plotW, plotH, 14);
      ctx.fill();

      // Compute Y range dynamically yet stably (-10..105 or 0..105)
      let minTemp = Math.min(0, state.roomTemp - 5);
      if (state.savedRuns) {
        state.savedRuns.forEach((run) => {
          minTemp = Math.min(minTemp, run.roomTemp - 5);
        });
      }
      minTemp = Math.floor(minTemp / 10) * 10;
      const maxTemp = 105;

      // Compute X max time in minutes
      let maxSeenMin = state.elapsedMin || 0;
      if (state.savedRuns) {
        state.savedRuns.forEach((run) => {
          if (run.points.length) {
            maxSeenMin = Math.max(maxSeenMin, run.points[run.points.length - 1].t);
          }
        });
      }
      const maxTimeMin = pickNiceMaxTime(maxSeenMin);

      const xOf = (tMin) => pad.left + (tMin / maxTimeMin) * plotW;
      const yOf = (tempC) => pad.top + ((maxTemp - tempC) / (maxTemp - minTemp)) * plotH;

      // Horizontal temperature grid lines (every 20°C)
      ctx.save();
      ctx.strokeStyle = '#EFE6D8';
      ctx.lineWidth = 1.25;
      ctx.font = '700 11px "Fredoka", "Nunito", ui-rounded, sans-serif';
      ctx.fillStyle = '#8B7364';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const yStep = maxTemp - minTemp > 110 ? 20 : 20;
      const firstTick = Math.ceil(minTemp / yStep) * yStep;
      for (let t = firstTick; t <= 100; t += yStep) {
        const y = yOf(t);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();
        ctx.fillText(t + '°', pad.left - 8, y);
      }

      // Vertical time grid lines (5 segments)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xTicks = 5;
      for (let i = 0; i <= xTicks; i++) {
        const tVal = (maxTimeMin / xTicks) * i;
        const x = xOf(tVal);
        if (i > 0 && i < xTicks) {
          ctx.beginPath();
          ctx.moveTo(x, pad.top);
          ctx.lineTo(x, pad.top + plotH);
          ctx.stroke();
        }
        ctx.fillText(formatAxisTick(tVal, maxTimeMin), x, pad.top + plotH + 8);
      }
      ctx.restore();

      // Axis titles
      ctx.save();
      ctx.font = '700 11px "Fredoka", "Nunito", ui-rounded, sans-serif';
      ctx.fillStyle = '#7A6254';
      ctx.textAlign = 'center';
      ctx.fillText('Time →', pad.left + plotW / 2, h - 12);
      ctx.translate(14, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Temp (°C)', 0, 0);
      ctx.restore();

      // Clip plotting interior
      ctx.save();
      this._roundRect(ctx, pad.left, pad.top, plotW, plotH, 14);
      ctx.clip();

      // Room temperature asymptote band + dashed line
      const roomY = yOf(state.roomTemp);
      ctx.save();
      ctx.fillStyle = 'rgba(77, 171, 247, 0.08)';
      ctx.fillRect(pad.left, roomY, plotW, pad.top + plotH - roomY);

      ctx.strokeStyle = '#339AF0';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(pad.left, roomY);
      ctx.lineTo(pad.left + plotW, roomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Room temp pill tag inside chart
      const roomLabel = 'Room ' + state.roomTemp.toFixed(0) + '°C';
      ctx.font = '700 11px "Fredoka", "Nunito", ui-rounded, sans-serif';
      const tagW = ctx.measureText(roomLabel).width + 14;
      const tagH = 20;
      const tagX = pad.left + plotW - tagW - 8;
      const tagY = Math.max(pad.top + 6, Math.min(pad.top + plotH - tagH - 6, roomY - tagH - 5));
      ctx.fillStyle = '#E7F5FF';
      ctx.strokeStyle = '#339AF0';
      ctx.lineWidth = 1.6;
      this._roundRect(ctx, tagX, tagY, tagW, tagH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1971C2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roomLabel, tagX + tagW / 2, tagY + tagH / 2 + 0.5);
      ctx.restore();

      // Theoretical ideal Newton exponential curve preview (when enabled)
      if (state.showTheory) {
        const T0 = state.phase === 'cooling' && state.points.length ? state.points[0].T : state.kettleTarget;
        const Tr = state.roomTemp;
        const k = state.k;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 135, 67, 0.45)';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        const samples = 90;
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
          ctx.globalAlpha = 0.65;
          ctx.lineWidth = 2.8;
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
          // Soft gradient under live curve toward room temp
          const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
          grad.addColorStop(0, 'rgba(255, 107, 107, 0.28)');
          grad.addColorStop(0.55, 'rgba(255, 169, 77, 0.14)');
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

          // Thick warm outline glow + vivid coral-orange curve
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 7.5;
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
          ctx.lineWidth = 4.2;
          ctx.stroke();
          ctx.restore();
        }

        // Live glowing marker dot at latest point
        const last = pts[pts.length - 1];
        const lx = xOf(last.t);
        const ly = yOf(last.T);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 90, 95, 0.22)';
        ctx.beginPath();
        ctx.arc(lx, ly, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF5A5F';
        ctx.strokeStyle = '#4A3528';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(lx, ly, 5.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(lx - 1.8, ly - 1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Friendly empty state hint inside graph
        ctx.save();
        ctx.font = '700 13px "Fredoka", "Nunito", ui-rounded, sans-serif';
        ctx.fillStyle = '#B09887';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const msg =
          state.phase === 'ready_to_pour'
            ? 'Pour hot water into the thermos to start plotting!'
            : 'Boil water & pour into thermos to watch Newton’s curve!';
        ctx.fillText(msg, pad.left + plotW / 2, pad.top + plotH * 0.42);
        ctx.restore();
      }

      // Hover / touch inspector tooltip on live points
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

        // Crosshair line
        ctx.save();
        ctx.strokeStyle = 'rgba(74, 53, 40, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, pad.top);
        ctx.lineTo(cx, pad.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Highlight dot
        ctx.fillStyle = '#FFD43B';
        ctx.strokeStyle = '#4A3528';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tooltip bubble
        const line1 = 't = ' + formatDurationShort(closest.t) + '  •  ' + closest.T.toFixed(1) + '°C';
        const delta = closest.T - closest.roomTemp;
        const line2 = 'ΔT = ' + (delta >= 0 ? '+' : '') + delta.toFixed(1) + '°C from room';
        ctx.font = '700 11px "Fredoka", "Nunito", ui-rounded, sans-serif';
        const boxW = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 20;
        const boxH = 40;
        let bx = cx + 10;
        if (bx + boxW > pad.left + plotW - 6) bx = cx - boxW - 10;
        let by = cy - boxH - 10;
        if (by < pad.top + 6) by = cy + 12;

        ctx.fillStyle = '#4A3528';
        this._roundRect(ctx, bx, by, boxW, boxH, 10);
        ctx.fill();

        ctx.fillStyle = '#FFFDF7';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(line1, bx + 10, by + 7);
        ctx.fillStyle = '#FFE066';
        ctx.fillText(line2, bx + 10, by + 22);
        ctx.restore();
      }

      ctx.restore(); // end clip

      // Chunky Pazu frame around plot area
      ctx.save();
      ctx.strokeStyle = '#4A3528';
      ctx.lineWidth = 2.8;
      this._roundRect(ctx, pad.left, pad.top, plotW, plotH, 14);
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
  };
})(window);
