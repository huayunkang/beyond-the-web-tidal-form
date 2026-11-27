/*!
 * Tile reassembly: Codrops ImageTilesMenu, MIT, copyright (c) 2009–2022 Codrops.
 * Upstream js/index.js at ed861a855e5efa6ba68eb3153b2692ce8a6ec9e8.
 * Original click-to-content tile timeline retained; native FLIP bridge, full frame and scene hand-off adapted.
 * See licenses/Codrops-ImageTilesMenu-MIT.txt.
 */
(() => {
  'use strict';

  function task(promise, milliseconds, signal) {
    return new Promise(resolve => {
      const aborted = () => finish({ ok: false, status: 'aborted' });
      const time = setTimeout(() => finish({ ok: false, status: 'timeout' }), milliseconds);
      let done = false;
      function finish(result) {
        if (done) return;
        done = true;
        clearTimeout(time);
        signal.removeEventListener('abort', aborted);
        resolve(result);
      }
      signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();
      Promise.resolve(promise).then(value => finish({ ok: true, value }), () => finish({ ok: false, status: 'failed' }));
    });
  }

  const exposed = node => node.getBoundingClientRect();
  const finite = (x, fallback) => Number.isFinite(x) ? x : fallback;
  const div = cls => Object.assign(document.createElement('div'), { className: cls });
  const bound = (x, a, b) => Math.max(a, Math.min(b, x));

  // CSS piecewise linear timing reproduces the original power4.inOut (quintic) curve.
  const quint = t => t < .5 ? 16 * t ** 5 : 1 - 16 * (1 - t) ** 5;
  const nativeQuint = 'linear(' + Array.from({ length: 41 }, (_, i) => quint(i / 40).toFixed(5)).join(',') + ')';
  const curves = {
    'power4.inOut': window.CSS?.supports('animation-timing-function', nativeQuint) ? nativeQuint : 'cubic-bezier(.83,0,.17,1)',
    expo: 'cubic-bezier(.16,1,.30,1)'
  };

  function runAnimation(job, node, keyframes, settings) {
    const a = node.animate(keyframes, { fill: 'both', ...settings });
    job.animations.push(a);
    const finished = a.finished;
    finished.catch(() => {}); // Cancellation during partial construction is still handled.
    return finished;
  }

  // Local platform bridge for the API shape used in the original timeline, not the GSAP plug-in.
  const Flip = {
    getState(items) {
      return [...items].map(el => ({ el, from: exposed(el) }));
    },
    from(job, state, { duration, ease, scale, stagger }) {
      return Promise.all(state.map(({ el, from }, i) => {
        const to = exposed(el);
        const x = from.left - to.left, y = from.top - to.top;
        const sx = scale && to.width ? from.width / to.width : 1;
        const sy = scale && to.height ? from.height / to.height : 1;
        const delay = (stagger.from === 'end' ? state.length - 1 - i : i) * Number(stagger.each) * 1000;
        const corner = i % 2 ? 1 : -1;
        return runAnimation(job, el, [
          { transform: `translate3d(${x}px,${y}px,0) scale(${sx},${sy}) rotate(${corner * 2.2}deg)` },
          { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)' }
        ], { duration: duration * 1000, easing: curves[ease], delay });
      }));
    }
  };

  function placedOrigin(rect, bounds) {
    const workingWidth = bounds.width || innerWidth, workingHeight = bounds.height || innerHeight;
    const fallbackW = Math.min(workingWidth * .54, workingHeight * .62);
    const fallbackH = fallbackW * .75;
    const measured = rect && rect.width > 12 && rect.height > 12;
    const width = measured ? Math.min(rect.width, workingWidth) : fallbackW;
    const height = measured ? Math.min(rect.height, workingHeight) : fallbackH;
    const left = measured ? finite(rect.left, 0) - bounds.left : (workingWidth - width) / 2;
    const top = measured ? finite(rect.top, 0) - bounds.top : (workingHeight - height) / 2;
    return { left: bound(left, 0, workingWidth - width), top: bound(top, 0, workingHeight - height), width, height };
  }

  window.OrbitTiles = (host, { reduced } = {}) => {
    if (!host) throw new TypeError('OrbitTiles needs the #entryTiles host');
    let current = null;
    host.classList.add('orbit-host');
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');

    function reset(job) {
      if (current !== job) return;
      job.controller.abort();
      for (const animation of job.animations) animation.cancel();
      host.hidden = true;
      host.replaceChildren();
      host.style.removeProperty('--orbit-source');
      delete host.dataset.orbitPhase;
      current = null;
    }

    function clear() { if (current) reset(current); }

    async function play({ image, origin, enter, ready } = {}) {
      clear();
      const job = { controller: new AbortController(), animations: [], entered: false };
      current = job;
      const { signal } = job.controller;
      const deadline = performance.now() + 6500;
      const remain = () => Math.max(1, deadline - performance.now());

      async function switchScene() {
        if (signal.aborted) return { ok: false, status: 'aborted' };
        if (job.entered) return { ok: false, status: 'failed' };
        const entry = await task(Promise.resolve().then(() => {
          if (signal.aborted) return false;
          job.entered = true;
          return enter?.();
        }), remain(), signal);
        if (!entry.ok) return entry;
        if (entry.value === false) return { ok: false, status: 'failed' };
        const settled = await task(Promise.resolve().then(() => signal.aborted ? false : ready?.()), remain(), signal);
        return settled.ok && settled.value === false ? { ok: false, status: 'failed' } : settled;
      }

      async function direct(reason) {
        const s = await switchScene();
        return { status: s.ok ? reason : s.status, entered: job.entered };
      }

      try {
        const less = (typeof reduced === 'function' ? reduced() : reduced)
          || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (less || !image || typeof host.animate !== 'function') return await direct('skipped');
        const asset = new Image();
        asset.src = image;
        const load = await task(asset.decode ? asset.decode() : new Promise((ok, no) => {
          if (asset.complete) { asset.naturalWidth ? ok() : no(); return; }
          asset.onload = ok;
          asset.onerror = no;
        }), 850, signal);
        if (!load.ok) return signal.aborted ? { status: 'aborted', entered: false } : await direct('image-unavailable');

        host.hidden = false;
        host.dataset.orbitPhase = 'gather';
        host.style.setProperty('--orbit-source', 'url(' + JSON.stringify(asset.currentSrc || asset.src) + ')');
        const veil = div('orbit-veil');
        const start = div('orbit-origin');
        const contentGrid = div('orbit-grid');
        host.append(veil, start, contentGrid);
        const first = placedOrigin(origin, exposed(host));
        const gap = bound(Math.min(first.width, first.height) * .037, 3, 11);
        const items = Array.from({ length: 4 }, (_, i) => {
          const tile = div('orbit-tile');
          tile.append(div('orbit-fragment'));
          const x = i % 2, y = i >> 1;
          Object.assign(tile.style, {
            left: first.left + x * first.width / 2 + (x ? gap : -gap) + 'px',
            top: first.top + y * first.height / 2 + (y ? gap : -gap) + 'px',
            width: first.width / 2 + 'px', height: first.height / 2 + 'px'
          });
          start.append(tile);
          return tile;
        });

        // Codrops click timeline: first state, reparent the four tiles, inverse FLIP,
        // stagger from the end, and replace the patches with a continuous image.
        const DURATION = 0.75;
        const EASE = 'expo';
        const THUMBDELAY = '0.02';
        const flipstate = Flip.getState(items, { props: 'transform,opacity' });
        [...items].forEach(item => {
          contentGrid.appendChild(item);
          item.removeAttribute('style');
        });
        host.dataset.orbitPhase = 'assemble';
        const flight = Flip.from(job, flipstate, {
          duration: DURATION,
          ease: 'power4.inOut',
          scale: true,
          simple: true,
          prune: true,
          stagger: { each: THUMBDELAY, from: 'end' }
        });
        const shade = runAnimation(job, veil, [{ opacity: 0 }, { opacity: 1 }], {
          duration: 390, easing: curves[EASE]
        });
        const assembled = await task(Promise.all([flight, shade]), 1100, signal);
        if (signal.aborted) return { status: 'aborted', entered: false };
        if (!assembled.ok) {
          // If the compositor paused, use the full opaque plate rather than waiting forever.
          for (const an of job.animations) an.cancel();
          veil.style.opacity = '1';
        }
        contentGrid.classList.add('orbit-grid--content');
        host.dataset.orbitPhase = 'cover';
        const prepared = await switchScene();
        if (signal.aborted) return { status: 'aborted', entered: job.entered };
        if (!prepared.ok) return { status: prepared.status, entered: job.entered };

        host.dataset.orbitPhase = 'reveal';
        const revealed = await task(runAnimation(job, host, [
          { clipPath: 'inset(0 0 0% 0)' },
          { clipPath: 'inset(0 0 100% 0)' }
        ], { duration: 445, easing: 'cubic-bezier(.55,.05,.24,1)' }), 700, signal);
        return { status: revealed.ok ? 'finished' : revealed.status, entered: job.entered };
      } catch {
        if (signal.aborted) return { status: 'aborted', entered: job.entered };
        if (!job.entered) return await direct('skipped');
        return { status: 'failed', entered: true };
      } finally {
        reset(job);
      }
    }

    return { play, clear };
  };
})();

