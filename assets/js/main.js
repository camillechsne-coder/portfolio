/* =========================================================
   Portfolio Camille Chesneau — animations
   Bibliothèques chargées depuis un CDN (facultatives) :
   - Lenis : défilement fluide
   - GSAP + SplitText : titres, écran de chargement, transitions
   Sans connexion, le site fonctionne quand même, avec des effets plus simples.
   ========================================================= */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const G = window.gsap || null;
  const Split = window.SplitText || null;
  if (G && Split) G.registerPlugin(Split);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const isMobile = () => innerWidth <= 760;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const store = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(1500)]);
  // « gate » s'ouvre quand l'écran de chargement / la transition laisse voir la page
  let openGate; const gate = new Promise(r => { openGate = r; });

  /* ---------- 0. Calques révélés par la bulle (copies inversées) ---------- */
  const fluid = () => { const f = document.createElement('div'); f.className = 'fluid'; f.setAttribute('aria-hidden', 'true'); return f; };
  if (!reduce) {
    [$('.intro .scene')].forEach(src => {
      if (!src) return;
      const c = src.cloneNode(true);
      c.classList.add('reveal-layer', src.classList.contains('scene') ? 'scene-reveal' : 'title-reveal');
      c.setAttribute('aria-hidden', 'true');
      $$('.halo', c).forEach(n => n.remove());
      $$('img', c).forEach(n => { n.alt = ''; });
      $$('[data-cursor]', c).forEach(n => n.removeAttribute('data-cursor'));
      c.prepend(fluid());
      src.after(c);
    });
  }

  /* ---------- 1. Effets sonores (synthétisés, désactivés : plus de bouton son dans le menu) ---------- */
  const Sound = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx = null, master = null, noise = null, on = false, last = 0;
    function ensure() {
      if (!AC) return null;
      // le navigateur n'autorise le son qu'après un premier clic ou une touche
      if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
      if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f1, f2, dur, vol, type = 'sine', delay = 0) {
      const c = ensure(); if (!c) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
    }
    function whoosh(dur = .75, vol = .07) {
      const c = ensure(); if (!c) return;
      if (!noise) {
        noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(280, t); f.frequency.exponentialRampToValueAtTime(2400, t + dur * .6); f.frequency.exponentialRampToValueAtTime(800, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
    }
    const buttons = [];
    const sync = () => buttons.forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (on) ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, ensure, { once: true, passive: true }));
    return {
      get on() { return on; },
      hover() { if (!on) return; const n = performance.now(); if (n - last < 70) return; last = n; tone(2300, 1500, .05, .016); },
      click() { if (on) { tone(620, 520, .12, .045, 'triangle'); tone(930, 880, .16, .03, 'sine', .05); } },
      whoosh() { if (on) whoosh(); },
      toggle() {
        on = !on; sync();
        try { localStorage.setItem('cc-sound', on ? '1' : '0'); } catch (e) {}
        if (on) { tone(523, 523, .3, .04); tone(784, 784, .4, .03, 'sine', .08); tone(1047, 1047, .5, .022, 'sine', .16); }
      },
      bind(b) { buttons.push(b); sync(); b.addEventListener('click', () => this.toggle()); }
    };
  })();
  const nav = $('.nav');
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('a, button, .skill, [data-lightbox] figure');
    if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) Sound.hover();
  });
  document.addEventListener('click', e => {
    if (e.target.closest('button:not(.sound), a[href^="mailto"]')) Sound.click();
  });

  /* ---------- 2. Défilement fluide (Lenis) ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: .085, autoRaf: !G });
    if (G) { G.ticker.add(t => lenis.raf(t * 1000)); G.ticker.lagSmoothing(0); }
  }
  const stopScroll = () => lenis && lenis.stop();
  const startScroll = () => lenis && lenis.start();

  /* ---------- 3. Arrivée sur la page ---------- */
  // a) première visite : écran de chargement avec compteur
  function bootLoader() {
    store.set('cc-visited', '1');
    const el = document.createElement('div');
    el.className = 'loader'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="loader-panel loader-rose"></div>
      <div class="loader-panel loader-main">
        <div class="loader-top"><span>Camille Chesneau</span><span>Portfolio 2026</span></div>
        <div class="loader-bottom">
          <p class="loader-words"><span>Communication</span><span>Événementiel</span><span>Création</span><span>Bienvenue</span></p>
          <p class="loader-count"><span>0</span><em>%</em></p>
        </div>
        <div class="loader-bar"><i></i></div>
      </div>`;
    document.body.prepend(el);
    root.classList.remove('boot');
    stopScroll();
    // on attend les polices du chargement pour éviter que les textes changent de forme
    Promise.race([Promise.all(['600 1em Unbounded', '800 1em Unbounded', 'italic 1em "Instrument Serif"'].map(f => document.fonts ? document.fonts.load(f) : 0)), wait(1200)])
      .catch(() => {}).then(() => el.classList.add('fonts-ok'));
    const count = $('.loader-count span', el), line = $('.loader-bar i', el), words = $$('.loader-words span', el);
    let w = 0; words[0].classList.add('on');
    const cycle = setInterval(() => {
      if (w >= words.length - 1) return;
      words[w].classList.replace('on', 'out'); words[++w].classList.add('on');
    }, 520);
    // progression réelle : polices + images visibles au chargement
    const imgs = $$('img').filter(i => i.loading !== 'lazy' && !i.closest('.reveal-layer'));
    let done = 0; const total = imgs.length + 1, tick = () => { done++; };
    imgs.forEach(i => { if (i.complete) done++; else { i.addEventListener('load', tick, { once: true }); i.addEventListener('error', tick, { once: true }); } });
    fontsReady.then(tick);
    const t0 = performance.now(), MIN = 2100, MAX = 6000;
    let shown = 0, prev = t0;
    return new Promise(resolve => {
      (function frame(now) {
        const el2 = now - t0, target = el2 > MAX ? 1 : Math.min(done / total, el2 / MIN);
        shown += (target - shown) * (1 - Math.exp(-(now - prev) / 160)); prev = now;
        if (target === 1 && shown > .99) shown = 1;
        count.textContent = Math.round(shown * 100);
        line.style.transform = `scaleX(${shown.toFixed(4)})`;
        if (shown < 1) { requestAnimationFrame(frame); return; }
        clearInterval(cycle);
        if (words[w].textContent !== 'Bienvenue') { words[w].classList.replace('on', 'out'); words[words.length - 1].classList.add('on'); }
        G.timeline({ delay: .35, onComplete: () => el.remove() })
          .to($$('.loader-top span, .loader-words, .loader-count', el), { yPercent: -120, opacity: 0, duration: .55, ease: 'power3.in', stagger: .05 })
          .add(() => { root.classList.add('loaded'); root.classList.remove('first'); startScroll(); resolve(); }, '-=.05')
          .to($('.loader-main', el), { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '<')
          .to($('.loader-rose', el), { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '<.12');
      })(t0);
    });
  }
  // b) on arrive depuis une carte : l'image s'est agrandie, elle se pose sur la couverture
  function arriveFromCard() {
    const src = store.get('cc-vt'); store.del('cc-vt');
    const cover = $('.cover'), img = cover && $('img', cover);
    root.classList.add('loaded');
    if (!G || !img || !src) { root.classList.remove('boot', 'vt'); return Promise.resolve(); }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0); if (lenis) lenis.scrollTo(0, { immediate: true });
    stopScroll();
    const ov = document.createElement('div');
    ov.className = 'vt-overlay';
    ov.innerHTML = `<img src="${img.currentSrc || img.src}" alt="">`;
    document.body.append(ov);
    root.classList.remove('boot');
    return new Promise(resolve => {
      Promise.race([Promise.all([img.decode ? img.decode().catch(() => {}) : 0, fontsReady]), wait(1200)]).then(() => {
        update();
        const r = cover.getBoundingClientRect(), k = r.width / (cover.offsetWidth || 1);
        const rad = (parseFloat(getComputedStyle(cover).borderTopLeftRadius) || 0) * k;
        G.timeline({ delay: .1, onComplete: () => { root.classList.remove('vt'); ov.remove(); startScroll(); } })
          .to(ov, { top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: rad, duration: 1.25, ease: 'expo.inOut' })
          .add(resolve, .45);
      });
    });
  }
  let entry;
  if (reduce) {
    root.classList.remove('boot', 'first', 'vt'); root.classList.add('loaded'); store.set('cc-visited', '1');
    entry = Promise.resolve();
  } else if (root.classList.contains('first') && G) {
    entry = bootLoader();
  } else if (root.classList.contains('vt')) {
    entry = arriveFromCard();
  } else {
    store.set('cc-visited', '1');
    root.classList.remove('boot', 'first');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('loaded')));
    entry = wait(380);
  }
  entry.then(openGate);

  /* ---------- 4. Départ vers une autre page ---------- */
  // une image s'agrandit jusqu'à remplir l'écran, puis la page suivante s'ouvre (elle s'y pose en couverture)
  function morph(href, src, r, radius, rot = 0) {
    const ov = document.createElement('div');
    ov.className = 'vt-overlay';
    Object.assign(ov.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: radius + 'px' });
    ov.innerHTML = `<img src="${src}" alt="">`;
    document.body.append(ov);
    stopScroll(); Sound.whoosh();
    store.set('cc-vt', src);
    G.to('.nav', { autoAlpha: 0, y: -24, duration: .5, ease: 'power2.in' });
    G.fromTo(ov, { rotation: rot }, { top: 0, left: 0, width: innerWidth, height: innerHeight, borderRadius: 0, rotation: 0, duration: 1, ease: 'expo.inOut', onComplete: () => { location.href = href; } });
    return true;
  }
  // carte de l'accueil
  function leaveViaCard(card) {
    const media = $('.media', card), img = media && $('img', media);
    if (!G || !img || !img.naturalWidth) return false;
    return morph(card.href, img.currentSrc || img.src, media.getBoundingClientRect(), 18);
  }
  // lien « catégorie suivante » : la carte d'aperçu (à droite du titre) s'agrandit
  function leaveViaNext(a) {
    const pv = $('.next-preview', a), img = pv && $('img', pv);
    if (!G || !img || !img.complete || !img.naturalWidth) return false;
    return morph(a.href, img.currentSrc || img.src, pv.getBoundingClientRect(), 14);
  }
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    root.classList.remove('leaving', 'vt', 'boot'); root.classList.add('loaded');
    $$('.vt-overlay').forEach(n => n.remove());
    if (G) G.set('.nav', { clearProps: 'opacity,visibility,transform' });
    startScroll();
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.protocol !== location.protocol || url.host !== location.host) return;
    const page = p => p.replace(/index\.html$/, '');
    if (page(url.pathname) === page(location.pathname)) {
      // même page : défilement fluide vers l'ancre (ou vers le haut)
      const t = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : 0;
      if (lenis && t !== null) { e.preventDefault(); Sound.click(); lenis.scrollTo(t, { duration: 1.6 }); }
      return;
    }
    if (reduce) return;
    if (a.matches('.card') && leaveViaCard(a)) { e.preventDefault(); return; }
    if (a.matches('.next') && leaveViaNext(a)) { e.preventDefault(); return; }
    e.preventDefault();
    Sound.whoosh(); stopScroll();
    root.classList.add('leaving');
    setTimeout(() => { location.href = a.href; }, 700);
  });

  /* ---------- 5. Texte mot par mot, couleur de fond, apparitions ---------- */
  const wordBlocks = $$('[data-words]').map(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    return { el, words: $$('.w', el), lit: -1 };
  });
  const themeIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) document.body.dataset.theme = e.target.dataset.theme; });
  }, { rootMargin: '-50% 0px -50% 0px' });
  $$('[data-theme]:not(body)').forEach(s => themeIO.observe(s));
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { const t = e.target; revealIO.unobserve(t); gate.then(() => t.classList.add('in')); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal]').forEach(el => revealIO.observe(el));

  /* ---------- 6. Titres révélés lettre par lettre (SplitText) ---------- */
  const titles = $$('.t-title, .t-big, .p-hero h1, .proj-title');
  if (G && Split && !reduce) {
    fontsReady.then(() => {
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const chars = en.target._chars;
        gate.then(() => G.to(chars, { yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', stagger: .024 }));
      }), { rootMargin: '0px 0px -8% 0px' });
      titles.forEach(el => {
        el.removeAttribute('data-reveal');
        const s = Split.create(el, { type: 'words,chars', mask: 'words', wordsClass: 'sw', charsClass: 'sc' });
        el._chars = s.chars;
        G.set(s.chars, { yPercent: 118, rotate: 7, transformOrigin: '0% 100%' });
        el.classList.add('split-ready');
        io.observe(el);
      });
    });
  } else {
    titles.forEach(el => el.classList.add('split-ready'));
  }

  /* ---------- 7. Éléments pilotés par le scroll ---------- */
  const hs = $$('.hscroll').map(sec => ({ sec, track: $('.track', sec), items: $$('.card', sec), count: $('[data-count]', sec), max: 0 }));
  hs.forEach(h => { const t = $('[data-total]', h.sec); if (t) t.textContent = h.items.length; });
  // mobile : carrousel au doigt, le compteur suit
  hs.forEach(h => h.track.addEventListener('scroll', () => {
    if (!isMobile() || !h.count || !h.items[0]) return;
    const step = h.items[0].offsetWidth + (parseFloat(getComputedStyle(h.track).columnGap) || 0);
    h.count.textContent = clamp(Math.round(h.track.scrollLeft / step) + 1, 1, h.items.length);
  }, { passive: true }));
  function coverLayout() {
    if (!I) return;
    const st = $('.intro-sticky'), w = st.clientWidth, h = st.clientHeight;
    $$('.cover-svg', intro).forEach(svg => svg.setAttribute('viewBox', `0 0 ${w} ${h}`));
    $$('.cover-rect', intro).forEach(rc => { rc.setAttribute('width', w); rc.setAttribute('height', h); });
    const texts = $$('.cover-text', intro);
    let fs = Math.min(w * .11, h * .3);
    texts.forEach(t => { t.setAttribute('font-size', fs); t.setAttribute('x', w / 2); t.setAttribute('y', h / 2 + fs * .36); });
    const len = texts[0].getComputedTextLength();
    if (len) { fs = fs * (w * .86) / len; fs = Math.min(fs, h * .3); }
    texts.forEach(t => { t.setAttribute('font-size', fs); t.setAttribute('y', h / 2 + fs * .36); });
    // point de zoom : dans le trait gauche du « C » de Chesneau
    try { const b = texts[0].getExtentOfChar(8); I.o.x = b.x + b.width * .17; } catch (err) { I.o.x = w / 2; }
    I.o.y = h / 2;
    $$('.cover-kicker', intro).forEach(k => { k.style.top = `${h / 2 - fs * .62 - 40}px`; });
  }
  function layout() {
    coverLayout();
    hs.forEach(h => {
      if (isMobile() || reduce) { h.sec.style.height = ''; h.track.style.transform = ''; h.max = 0; if (reduce) h.track.style.overflowX = 'auto'; return; }
      h.max = Math.max(0, h.track.scrollWidth - innerWidth);
      h.sec.style.height = (h.max + innerHeight) + 'px';
    });
  }

  const bar = $('.progress');
  const intro = $('.intro');
  const I = intro && {
    cover: $$('.intro-cover, .cover-reveal', intro), zooms: $$('.zoom', intro), kick: $$('.cover-kicker, .intro-hint', intro),
    scene: $$('.scene', intro), text: $$('.scene-text', intro), photo: $$('.portrait-wrap', intro), o: { x: 0, y: 0 }
  };
  const timelines = $$('.timeline').map(t => ({ t, fill: $('.timeline-fill', t), steps: $$('.step', t) }));
  const parallax = $$('[data-parallax]');
  const covers = $$('[data-cover]');
  const vfulls = $$('.vfull').map(sec => ({ sec, media: $('.vfull-media', sec), video: $('video', sec), head: $('.vfull-head', sec), cap: $('.vfull-cap', sec), sound: $('.vfull-sound', sec) }));

  const css = (els, prop, v) => els.forEach(el => { el.style[prop] = v; });
  let ticking = false;
  function update() {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    if (bar) bar.style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh || 1), 0, 1)})`;

    // Écran d'entrée : zoom à travers les lettres du nom
    if (I && !reduce) {
      const r = intro.getBoundingClientRect();
      const p = clamp(-r.top / (intro.offsetHeight - vh), 0, 1);
      const e = ease(clamp(p / .7, 0, 1));
      const s = Math.pow(90, e);
      const tr = `translate(${I.o.x} ${I.o.y}) scale(${s.toFixed(4)}) translate(${-I.o.x} ${-I.o.y})`;
      I.zooms.forEach(g => g.setAttribute('transform', tr));
      const fade = 1 - clamp((e - .55) / .35, 0, 1);
      css(I.cover, 'opacity', fade.toFixed(3));
      css(I.cover, 'visibility', fade > 0 ? 'visible' : 'hidden');
      css(I.kick, 'opacity', (1 - clamp(p / .12, 0, 1)).toFixed(3));
      css(I.scene, 'transform', `scale(${(1.25 - e * .25).toFixed(4)})`);
      // les éléments arrivent par les côtés
      const e2 = ease(clamp((p - .35) / .4, 0, 1));
      css(I.text, 'transform', `translate3d(${(1 - e2) * -45}vw,0,0)`);
      css(I.text, 'opacity', e2.toFixed(3));
      css(I.photo, 'transform', `translate3d(${(1 - e2) * 45}vw,0,0) rotate(${(1 - e2) * 8}deg)`);
      css(I.photo, 'opacity', e2.toFixed(3));
    }

    if (!reduce) {
      wordBlocks.forEach(b => {
        const r = b.el.getBoundingClientRect();
        const n = Math.floor(clamp((vh * .85 - r.top) / (r.height + vh * .3), 0, 1) * b.words.length);
        if (n !== b.lit) { b.words.forEach((w, k) => w.classList.toggle('on', k < n)); b.lit = n; }
      });
      timelines.forEach(({ t, fill, steps }) => {
        const r = t.getBoundingClientRect();
        fill.style.transform = `scaleY(${clamp((vh * .6 - r.top) / r.height, 0, 1)})`;
        steps.forEach(s => s.classList.toggle('passed', s.getBoundingClientRect().top < vh * .6));
      });
      parallax.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const s = parseFloat(el.dataset.parallax) || .1;
        el.style.translate = `0 ${((r.top + r.height / 2 - vh / 2) * -s).toFixed(1)}px`;
      });
      covers.forEach(el => {
        const p = clamp((vh - el.getBoundingClientRect().top) / (vh * .9), 0, 1);
        el.style.transform = `scale(${.86 + p * .14})`;
        el.style.borderRadius = `${40 - p * 28}px`;
      });
      // Vidéo qui s'agrandit jusqu'au plein écran
      vfulls.forEach(v => {
        const r = v.sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const p = clamp(-r.top / (v.sec.offsetHeight - vh || 1), 0, 1);
        const e = ease(clamp(p / .55, 0, 1)), k = 1 - e, m = isMobile();
        v.media.style.clipPath = `inset(${(k * (m ? 34 : 30)).toFixed(2)}% ${(k * (m ? 6 : 22)).toFixed(2)}% ${(k * (m ? 22 : 10)).toFixed(2)}% round ${(k * 28).toFixed(1)}px)`;
        if (v.video) v.video.style.transform = `scale(${(1.18 - e * .18).toFixed(4)})`;
        if (v.head) { v.head.style.opacity = clamp(1 - e * 1.6, 0, 1).toFixed(3); v.head.style.transform = `translate3d(0,${(-e * 12).toFixed(2)}vh,0)`; }
        if (v.cap) v.cap.style.opacity = clamp((p - .62) / .18, 0, 1).toFixed(3);
        if (v.sound) { const o = clamp((e - .6) / .3, 0, 1); v.sound.style.opacity = o.toFixed(3); v.sound.style.visibility = o > 0 ? 'visible' : 'hidden'; }
      });
    }

    hs.forEach(h => {
      if (!h.max) return;
      const r = h.sec.getBoundingClientRect();
      const p = clamp(-r.top / (h.sec.offsetHeight - vh), 0, 1);
      h.track.style.transform = `translate3d(${-p * h.max}px,0,0)`;
      if (h.count) h.count.textContent = Math.round(p * (h.items.length - 1)) + 1;
    });
  }
  // avec Lenis, on recalcule dans la même image que le défilement (pas de décalage)
  if (lenis) lenis.on('scroll', update);
  else addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', () => { layout(); update(); });
  addEventListener('load', () => { layout(); update(); });
  if (document.fonts) document.fonts.ready.then(() => { layout(); update(); });
  layout(); update();

  /* ---------- 8. Curseur + liens magnétiques ---------- */
  if (fine && !reduce) {
    document.body.classList.add('has-cursor');
    const cur = $('.cursor'), label = $('span', cur);
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    (function loop() { cx += (mx - cx) * .2; cy += (my - cy) * .2; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); })();
    $$('[data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => { label.textContent = el.dataset.cursor || 'Voir'; cur.classList.add('big'); });
      el.addEventListener('mouseleave', () => cur.classList.remove('big'));
    });
    $$('.nav ul a, .nav .brand, .nav .cta, .sound, .btn, .mail, .back, .contact-links a, .foot a').forEach(el => {
      el.classList.add('is-magnetic');
      const k = el.matches('.mail') ? .4 : .32;
      const move = G
        ? (() => { const xTo = G.quickTo(el, 'x', { duration: .7, ease: 'elastic.out(1,.45)' }), yTo = G.quickTo(el, 'y', { duration: .7, ease: 'elastic.out(1,.45)' }); return (x, y) => { xTo(x); yTo(y); }; })()
        : (x, y) => { el.style.transform = `translate(${x}px,${y}px)`; };
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        move((e.clientX - r.left - r.width / 2) * k, (e.clientY - r.top - r.height / 2) * k);
      });
      el.addEventListener('mouseleave', () => move(0, 0));
    });
  }

  /* ---------- 9. Bulle liquide qui suit la souris et révèle les calques inversés ---------- */
  const stage = $('.intro-sticky'), baseScene = $('.intro .scene:not(.reveal-layer)'), halo = $('.halo');
  const layers = $$('.reveal-layer');
  if (stage && layers.length && !reduce) {
    let mx = 0, my = 0, active = false, hx = 0, hy = 0, R = 0, t = 0, vx = 0, vy = 0, ax = 0, ay = 0;
    const hist = [];
    const set = (cx, cy) => { mx = cx; my = cy; if (!active) { hx = cx; hy = cy; hist.length = 0; } active = true; };
    stage.addEventListener('mousemove', e => set(e.clientX, e.clientY));
    stage.addEventListener('mouseleave', () => { active = false; });
    stage.addEventListener('touchstart', e => set(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    stage.addEventListener('touchmove', e => set(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    stage.addEventListener('touchend', () => { active = false; });

    // le survol de la photo et du nom est recopié sur le calque inversé
    const sync = (sel) => {
      const base = $(sel, baseScene), copy = $('.scene-reveal ' + sel);
      if (!base || !copy) return;
      base.addEventListener('mouseenter', () => copy.classList.add('is-hover'));
      base.addEventListener('mouseleave', () => copy.classList.remove('is-hover'));
    };
    sync('.portrait'); sync('h1');

    const circle = (x, y, r) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(-2 * r).toFixed(1)} 0Z`;
    (function loop() {
      t += .016;
      const px = hx, py = hy;
      hx += (mx - hx) * .18; hy += (my - hy) * .18;
      vx = hx - px; vy = hy - py;
      ax += (vx - ax) * .2; ay += (vy - ay) * .2;
      const speed = Math.hypot(ax, ay), ang = Math.atan2(ay, ax);
      const base = clamp(innerWidth * .085, 70, 140);
      R += ((active ? base + Math.min(speed, 30) * .8 : 0) - R) * .12;
      hist.unshift({ x: hx, y: hy }); if (hist.length > 26) hist.pop();

      const visible = R > .5;
      layers.forEach(L => {
        if (!visible) { L.style.clipPath = 'circle(0px at 50% 50%)'; return; }
        const r = L.getBoundingClientRect(), s = (r.width / L.offsetWidth) || 1;
        const lx = x => (x - r.left) / s, ly = y => (y - r.top) / s, rr = R / s;
        // tête : forme molle qui s'étire dans le sens du mouvement
        const stretch = Math.min(speed / 25, 1) * .35;
        let d = '';
        for (let k = 0; k <= 48; k++) {
          const th = k / 48 * Math.PI * 2;
          const wob = 1 + .07 * Math.sin(3 * th + t * 1.6) + .05 * Math.sin(5 * th - t * 2.1) + .03 * Math.sin(7 * th + t);
          const st = 1 + stretch * Math.cos(th - ang) * Math.cos(th - ang) - stretch * .4;
          const x = lx(hx) + Math.cos(th) * rr * wob * st, y = ly(hy) + Math.sin(th) * rr * wob * st;
          d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        }
        d += 'Z';
        // queue : gouttes de plus en plus petites
        [[3, .62], [6, .46], [9, .34], [13, .24], [17, .16], [22, .1]].forEach(([i, f]) => {
          const p = hist[Math.min(i, hist.length - 1)];
          if (p) d += circle(lx(p.x), ly(p.y), rr * f * (.6 + Math.min(speed, 20) / 50));
        });
        L.style.clipPath = `path('${d}')`;
      });

      if (halo && baseScene && active) {
        const sr = baseScene.getBoundingClientRect();
        halo.style.transform = `translate3d(${mx - sr.left}px,${my - sr.top}px,0)`;
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- 10. Cartes réalisations : image liquide au survol (WebGL) ---------- */
  // Une bulle suit la souris sur l'image : ondulations, décalage des couleurs
  // et version marine/pervenche/rose à l'intérieur, comme la bulle de l'accueil.
  // Le WebGL a besoin que le site soit servi (en ligne ou aperçu local) :
  // ouvert en double-clic, on garde le simple zoom en CSS.
  if (fine && !reduce) {
    const VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
    const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D uTex;
uniform vec2 uRes,uImg,uMouse,uVel;
uniform float uHover,uTime;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
vec2 cov(vec2 uv){float rs=uRes.x/uRes.y,ri=uImg.x/uImg.y;vec2 s=rs<ri?vec2(rs/ri,1.):vec2(1.,ri/rs);return (uv-.5)*s+.5;}
void main(){
  vec2 asp=vec2(uRes.x/uRes.y,1.);
  vec2 d=(v-uMouse)*asp;
  float dist=length(d);
  float wob=(n(v*3.5+uTime*.35)-.5)+(n(v*7.-uTime*.5)-.5)*.5;
  float r=(.24+min(length(uVel),.05)*2.)*uHover;
  float edge=dist+wob*.16;
  float blob=smoothstep(r+.02,r-.02,edge);
  float rim=smoothstep(r+.022,r+.006,edge)-blob;
  float ripple=sin(dist*34.-uTime*5.)*.005*uHover*smoothstep(.8,0.,dist);
  vec2 flow=vec2(n(v*5.+uTime*.5),n(v*5.+7.3-uTime*.45))-.5;
  vec2 uv=(v-.5)*(1.-.06*uHover)+.5;
  uv+=normalize(d+.0001)*ripple/asp+flow*.04*blob-uVel*.6*blob;
  float sh=.003*uHover+.01*blob;
  vec3 c=vec3(texture2D(uTex,cov(uv+vec2(sh,0.))).r,texture2D(uTex,cov(uv)).g,texture2D(uTex,cov(uv-vec2(sh,0.))).b);
  float l=dot(c,vec3(.299,.587,.114));
  vec3 duo=mix(vec3(.059,.102,.29),vec3(.604,.651,.949),smoothstep(.08,.85,l));
  duo=mix(duo,vec3(1.,.561,.694),smoothstep(.6,1.,l)*.9);
  c=mix(c,duo,blob);
  c=mix(c,vec3(1.,.561,.694),clamp(rim,0.,1.)*.9);
  gl_FragColor=vec4(c,1.);
}`;
    $$('.card .media').forEach(media => {
      const img = $('img', media), anim = /\.gif($|\?)/i.test(img.getAttribute('src'));
      let st = null, ok = null, hover = 0, target = 0, mx = .5, my = .5, sx = .5, sy = .5, vx = 0, vy = 0, raf = 0, t = 0;
      function init() {
        const canvas = document.createElement('canvas');
        canvas.className = 'gl'; canvas.setAttribute('aria-hidden', 'true');
        const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
        if (!gl) return false;
        try {
          const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
          const pr = gl.createProgram();
          gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
          gl.linkProgram(pr); gl.useProgram(pr);
          gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          const loc = gl.getAttribLocation(pr, 'p');
          gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); // refusé en double-clic (file://)
          const u = {};
          ['uRes', 'uImg', 'uMouse', 'uVel', 'uHover', 'uTime'].forEach(k => { u[k] = gl.getUniformLocation(pr, k); });
          media.append(canvas); media.classList.add('has-gl');
          st = { canvas, gl, u };
          return true;
        } catch (err) { return false; }
      }
      function size() {
        const r = media.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
        st.canvas.width = Math.round(r.width * dpr); st.canvas.height = Math.round(r.height * dpr);
      }
      function render() {
        raf = 0;
        hover += (target - hover) * .07;
        const px = sx, py = sy;
        sx += (mx - sx) * .14; sy += (my - sy) * .14;
        vx += ((sx - px) - vx) * .2; vy += ((sy - py) - vy) * .2;
        t += .016;
        const { gl, u, canvas } = st;
        // image animée (GIF) : on recopie l'image à chaque fois pour que l'animation continue sous la bulle
        if (anim) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform2f(u.uImg, img.naturalWidth, img.naturalHeight);
        gl.uniform2f(u.uMouse, sx, sy); gl.uniform2f(u.uVel, vx, vy);
        gl.uniform1f(u.uHover, hover); gl.uniform1f(u.uTime, t);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (target === 0 && hover < .003) { media.classList.remove('gl-on'); return; }
        raf = requestAnimationFrame(render);
      }
      const point = e => { const r = media.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height; };
      media.addEventListener('mouseenter', e => {
        if (ok === null) { if (!img.complete || !img.naturalWidth) return; ok = init(); }
        if (!ok) return;
        size(); point(e);
        if (hover < .01) { sx = mx; sy = my; }
        target = 1; media.classList.add('gl-on');
        if (!raf) raf = requestAnimationFrame(render);
      });
      media.addEventListener('mousemove', point);
      media.addEventListener('mouseleave', () => { target = 0; });
    });
  }

  /* ---------- 11. Galeries qu'on fait glisser (page passions) ---------- */
  $$('.drag').forEach(d => {
    const track = $('.drag-track', d), figs = $$('figure', track), line = $('.drag-bar i', d.parentNode);
    $$('img', track).forEach(i => { i.draggable = false; });
    if (!fine || reduce) {
      // au doigt : défilement natif avec aimantation
      d.classList.add('native');
      if (line) d.addEventListener('scroll', () => { const m = d.scrollWidth - d.clientWidth; line.style.transform = `scaleX(${m ? (d.scrollLeft / m).toFixed(3) : 1})`; }, { passive: true });
      return;
    }
    let x = 0, tx = 0, max = 0, down = false, sx = 0, st = 0, moved = 0, lastX = 0, v = 0, raf = 0;
    const measure = () => { max = Math.max(0, track.offsetWidth - d.clientWidth); tx = clamp(tx, -max, 0); kick(); };
    function loop() {
      raf = 0;
      x += (tx - x) * .09;
      const vel = tx - x;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      const sk = clamp(vel * .01, -3.5, 3.5).toFixed(3);
      figs.forEach(f => {
        f.style.transform = `skewX(${sk}deg)`;
        const r = f.getBoundingClientRect(), c = (r.left + r.width / 2) / innerWidth - .5;
        f.firstElementChild.style.transform = `translate3d(${(-c * 3.5).toFixed(2)}%,0,0) scale(1.08)`;
      });
      if (line) line.style.transform = `scaleX(${max ? clamp(-x / max, 0, 1).toFixed(3) : 1})`;
      if (down || Math.abs(tx - x) > .1) raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    d.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      down = true; moved = 0; sx = lastX = e.clientX; st = tx; v = 0;
      d.classList.add('grabbing'); kick();
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      let n = st + dx;
      if (n > 0) n *= .35;                       // élastique aux extrémités
      if (n < -max) n = -max + (n + max) * .35;
      tx = n; v = e.clientX - lastX; lastX = e.clientX; kick();
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false; d.classList.remove('grabbing');
      tx = clamp(tx + v * 14, -max, 0); kick();  // lancer avec inertie
    });
    // un glisser n'ouvre pas la visionneuse
    d.addEventListener('click', e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    d.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); tx = clamp(tx - e.deltaX, -max, 0); kick();
    }, { passive: false });
    // au clavier : la photo qui reçoit le focus revient dans le cadre
    d.addEventListener('focusin', e => {
      const f = e.target.closest('figure'); if (!f) return;
      d.scrollLeft = 0;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      tx = clamp(-(f.offsetLeft - pad), -max, 0); kick();
    });
    addEventListener('resize', measure);
    addEventListener('load', measure);
    measure();
  });

  /* ---------- 12. Visionneuse d'images ---------- */
  const lb = $('.lightbox');
  if (lb) {
    const big = $('img', lb), count = $('.lb-count', lb);
    let list = [], idx = 0, back = null;
    const show = i => {
      idx = (i + list.length) % list.length;
      const im = list[idx];
      big.src = im.currentSrc || im.src; big.alt = im.alt;
      if (count) count.textContent = `${idx + 1} / ${list.length}`;
    };
    const open = im => {
      list = $$('img', im.closest('[data-lightbox]'));
      back = document.activeElement; show(list.indexOf(im));
      lb.classList.add('open'); stopScroll();
      const c = $('.lb-close', lb); if (c) c.focus({ preventScroll: true });
    };
    const close = () => {
      if (!lb.classList.contains('open')) return;
      lb.classList.remove('open'); startScroll();
      if (back && back.focus) back.focus({ preventScroll: true });
    };
    $$('[data-lightbox] img').forEach(im => {
      const f = im.closest('figure');
      f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', `Agrandir : ${im.alt}`);
      f.addEventListener('click', () => open(im));
      f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(im); } });
    });
    lb.addEventListener('click', e => {
      if (e.target.closest('.lb-prev')) show(idx - 1);
      else if (e.target.closest('.lb-next')) show(idx + 1);
      else if (e.target !== big) close();
    });
    addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- 13. Vidéos : lecture quand elles sont visibles ---------- */
  const vIO = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target; if (e.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
  }), { threshold: .25 });
  $$('video[data-autoplay]').forEach(v => { v.muted = true; vIO.observe(v); });
  $$('.vfull-sound').forEach(b => {
    const v = $('video', b.closest('.vfull'));
    b.addEventListener('click', () => {
      v.muted = !v.muted;
      b.setAttribute('aria-pressed', !v.muted);
      b.textContent = v.muted ? 'Activer le son' : 'Couper le son';
      if (!v.muted) { const p = v.play(); if (p) p.catch(() => {}); }
    });
  });

  /* ---------- 13 bis. Bande des outils : bloquée pendant le scroll, défilement continu, à glisser ---------- */
  $$('.marquee').forEach(m => {
    const track = $('.marquee-track', m), set = [...track.children], pin = m.closest('.marquee-pin');
    let setW = 0;
    // on recopie la liste autant de fois que nécessaire pour que la boucle soit invisible
    const build = () => {
      $$('[data-clone]', track).forEach(n => n.remove());
      setW = track.scrollWidth;
      for (let w = setW; setW && w < setW + m.clientWidth + 200; w += setW) {
        set.forEach(n => { const c = n.cloneNode(true); c.dataset.clone = ''; c.setAttribute('aria-hidden', 'true'); track.append(c); });
      }
    };
    build();
    addEventListener('resize', build);
    fontsReady.then(build);
    if (reduce) { m.style.overflowX = 'auto'; return; }
    const BASE = -60;                  // vitesse de croisière (px/s, vers la gauche)
    let x = 0, speed = BASE, dir = 1, down = false, sx = 0, x0 = 0, lastX = 0, lastT = 0, dragV = 0, visible = true, prev = performance.now(), pPrev = null, sv = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(m);
    m.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      down = true; sx = lastX = e.clientX; x0 = x; lastT = performance.now(); dragV = 0;
      m.classList.add('grabbing');
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const now = performance.now(), dt = Math.max(8, now - lastT);
      dragV = dragV * .5 + (e.clientX - lastX) / dt * 1000 * .5;
      lastX = e.clientX; lastT = now;
      x = x0 + (e.clientX - sx);
    });
    const release = throwIt => {
      if (!down) return;
      down = false; m.classList.remove('grabbing');
      if (!throwIt) return;
      speed = clamp(dragV, -5000, 5000);      // on lance la bande, elle garde ce sens
      if (Math.abs(dragV) > 40) dir = dragV < 0 ? 1 : -1;
    };
    addEventListener('pointerup', () => release(true));
    addEventListener('pointercancel', () => release(false));
    (function loop(now) {
      const dt = Math.min(.05, (now - prev) / 1000); prev = now;
      if (!down) {
        speed += (BASE * dir - speed) * (1 - Math.exp(-dt * 3));   // revient en douceur à sa vitesse de croisière
        x += speed * dt;
        if (setW) x = ((x % setW) + setW) % setW - setW;
      }
      if (visible && setW) {
        // pendant que la section est bloquée, le scroll fait avancer la bande (un tour complet de logos)
        let p = 0;
        if (pin) { const r = pin.getBoundingClientRect(); p = clamp(-r.top / ((pin.offsetHeight - innerHeight) || 1), 0, 1); }
        const rx = (((x - p * setW) % setW) + setW) % setW - setW;
        // les logos s'inclinent selon la vitesse (glisser, élan ou scroll)
        sv += ((dt && pPrev !== null ? -(p - pPrev) * setW / dt : 0) - sv) * .15; pPrev = p;
        const sk = clamp(((down ? dragV : speed) + sv) * -.0025, -10, 10);
        track.style.transform = `translate3d(${rx.toFixed(2)}px,0,0) skewX(${sk.toFixed(2)}deg)`;
      }
      requestAnimationFrame(loop);
    })(prev);
  });

  /* ---------- 14. Pages catégories ---------- */
  // nombre de projets affiché en haut de page
  $$('[data-proj-count]').forEach(el => { el.textContent = $$('.proj').length; });
  // lecteur vidéo : lecture automatique (sans le son, règle des navigateurs) quand la vidéo est à l'écran,
  // pause dès qu'on passe à une autre ; boutons « son » et « plein écran »
  const players = $$('.player');
  const playerIO = new IntersectionObserver(entries => entries.forEach(e => {
    const v = $('video', e.target);
    if (e.isIntersecting) {
      players.forEach(o => { if (o !== e.target) $('video', o).pause(); });
      const pr = v.play(); if (pr) pr.catch(() => {});
    } else v.pause();
  }), { threshold: .6 });
  players.forEach(p => {
    const v = $('video', p), snd = $('.pl-sound', p), full = $('.pl-full', p);
    if (!full) return;
    v.addEventListener('error', () => p.classList.add('missing'), true);
    const syncSound = () => {
      if (!snd) return;   // vidéo sans son : pas de bouton son
      snd.setAttribute('aria-pressed', !v.muted);
      $('.pl-txt', snd).textContent = v.muted ? 'Activer le son' : 'Couper le son';
      p.classList.toggle('sound-on', !v.muted);
    };
    const toggleSound = () => {
      v.muted = !v.muted;
      if (!v.muted) players.forEach(o => { if (o !== p) { const ov = $('video', o); ov.muted = true; o.classList.remove('sound-on'); } });
      syncSound();
      const pr = v.play(); if (pr) pr.catch(() => {});
    };
    if (snd) {
      snd.addEventListener('click', e => { e.stopPropagation(); toggleSound(); });
      v.addEventListener('click', toggleSound);   // un clic sur la vidéo active ou coupe le son
    } else {
      v.addEventListener('click', () => { if (v.paused) { const pr = v.play(); if (pr) pr.catch(() => {}); } else v.pause(); });   // sans son : un clic met en pause ou relance
    }
    v.addEventListener('volumechange', syncSound);
    full.addEventListener('click', e => {
      e.stopPropagation();
      if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
      else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();   // iPhone
      const pr = v.play(); if (pr) pr.catch(() => {});
    });
    // en plein écran : les commandes habituelles (pause, avance, volume) apparaissent
    const onFs = () => { const fs = (document.fullscreenElement || document.webkitFullscreenElement) === v; v.controls = fs; };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    v.addEventListener('webkitendfullscreen', () => { v.controls = false; });
    // barre de temps : lecture/pause, minutage et curseur pour avancer ou reculer
    const playBtn = $('.pl-play', p), seek = $('.pl-seek', p), tCur = $('.pl-time', p), tDur = $('.pl-dur', p);
    if (seek) {
      const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
      let dragging = false, raf = 0;
      const paint = () => {
        const d = v.duration;
        if (d && isFinite(d)) {
          if (!dragging) seek.value = Math.round(v.currentTime / d * 1000);
          tCur.textContent = fmt(dragging ? seek.value / 1000 * d : v.currentTime);
          tDur.textContent = fmt(d);
        }
        seek.style.setProperty('--p', seek.value / 10 + '%');
      };
      const loop = () => { paint(); raf = v.paused ? 0 : requestAnimationFrame(loop); };
      v.addEventListener('loadedmetadata', paint);
      v.addEventListener('timeupdate', paint);
      v.addEventListener('play', () => { p.classList.add('is-playing'); playBtn.setAttribute('aria-label', 'Mettre en pause'); if (!raf) raf = requestAnimationFrame(loop); });
      v.addEventListener('pause', () => { p.classList.remove('is-playing'); playBtn.setAttribute('aria-label', 'Lire la vidéo'); });
      const jump = () => { const d = v.duration; if (d && isFinite(d)) v.currentTime = seek.value / 1000 * d; paint(); };
      seek.addEventListener('pointerdown', () => { dragging = true; });
      seek.addEventListener('input', () => { dragging = true; jump(); });
      seek.addEventListener('change', () => { dragging = false; jump(); });
      seek.addEventListener('pointerup', () => { dragging = false; });
      if (!v.duration) { v.preload = 'metadata'; }   // pour connaître la durée avant la lecture
      playBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (v.paused) { players.forEach(o => { if (o !== p) $('video', o).pause(); }); const pr = v.play(); if (pr) pr.catch(() => {}); }
        else v.pause();
      });
      paint();
    }
    syncSound();
    playerIO.observe(p);
  });
  // motion design : un clic active ou coupe le son de l'animation
  $$('.loop:not(.silent)').forEach(l => {
    const v = $('video', l), tag = $('.loop-tag', l);
    l.addEventListener('click', () => {
      v.muted = !v.muted;
      if (tag) tag.lastChild.textContent = v.muted ? 'En boucle · son coupé' : 'En boucle · son activé';
      const pr = v.play(); if (pr) pr.catch(() => {});
    });
  });
  // affiches : inclinaison 3D et reflet qui suivent la souris
  if (fine && !reduce) {
    $$('.poster, .gal-item').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.transform = `rotateX(${((.5 - y) * 12).toFixed(2)}deg) rotateY(${((x - .5) * 14).toFixed(2)}deg) scale(1.03)`;
        el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`); el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
      el.addEventListener('mouseleave', () => { el.classList.remove('tilting'); el.style.transform = ''; });
    });
  }

  /* ---------- 14 bis. Lien « suivant » en bas de page : les lettres du titre montent une à une ---------- */
  $$('.next').forEach(n => {
    const t = $('.next-title', n);
    if (!t) return;
    const text = t.textContent.trim();
    let i = 0;
    t.setAttribute('aria-label', text);
    t.innerHTML = text.split(/\s+/).map(w => `<span class="nw" aria-hidden="true">${[...w].map(ch =>
      `<span class="nc" style="--i:${i++}"><span class="nc-e">${ch}</span></span>`).join('')}</span>`).join(' ');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); gate.then(() => n.classList.add('in')); } }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(n);
  });

  /* ---------- 15. Menu plein écran (mobile) ---------- */
  if (nav) {
    const links = [['À propos', 'index.html#apropos'], ['Parcours', 'index.html#parcours'], ['Réalisations', 'index.html#realisations'],
      ['Compétences', 'index.html#competences'], ['Passions', 'passions.html'], ['Contact', 'index.html#contact']];
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'burger';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'mmenu');
    btn.innerHTML = '<span class="burger-label">Menu</span><span class="burger-icon" aria-hidden="true"><i></i><i></i></span>';
    nav.append(btn); nav.classList.add('has-burger');
    const m = document.createElement('div');
    m.id = 'mmenu'; m.className = 'mmenu'; m.hidden = true; m.setAttribute('data-lenis-prevent', '');
    m.innerHTML = `<ul>${links.map(([t, h], i) => `<li style="--i:${i}"><a href="${h}"><span class="mm-in"><span class="mm-n">0${i + 1}</span>${t}</span></a></li>`).join('')}</ul>
      <p class="mmenu-foot"><span>Nantes, Loire-Atlantique</span><span class="serif">Communication et événementiel</span></p>`;
    nav.after(m);
    let opened = false;
    const set = v => {
      opened = v;
      btn.setAttribute('aria-expanded', v);
      $('.burger-label', btn).textContent = v ? 'Fermer' : 'Menu';
      root.classList.toggle('menu-open', v);
      if (v) {
        m.hidden = false; stopScroll();
        requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
      } else {
        m.classList.remove('open'); startScroll();
        setTimeout(() => { if (!opened) m.hidden = true; }, 800);
      }
    };
    btn.addEventListener('click', () => set(!opened));
    m.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && opened) { set(false); btn.focus(); } });
    addEventListener('resize', () => { if (opened && !isMobile()) set(false); });
  }
})();
