/* Work page logic (same code as the tested design page) */
(function () {
'use strict';
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.keys = ['how', 'what', 'specs'];
    this.outer = {};
    this.track = {};
    this.refs2 = {};
    const st = { vh: 900, p: 1, verified: false, capOpen: false, capOk: false, slide: 0, holeX: 200, holeY: 50, msg: '', msgBad: false, shakeX: 0, fails: 0, lockedUntil: 0 };
    this.keys.forEach((k) => {
      st[k] = { dist: 0, prog: 0 };
      this.refs2[k] = {
        outer: (el) => { this.outer[k] = el; },
        track: (el) => { this.track[k] = el; }
      };
    });
    this.state = st;
    this.played = false;
    this.enc = [63, 63, 49, 62, 53, 63, 49, 55, 52, 63, 54, 63];
    this.MAXX = 260;
    this.TOL = 5;
    this.handleEl = null;
    this.handleRef = (el) => { this.handleEl = el; };
    Object.assign(this.state, { msgStep: 'write', msgText: '', msgEmail: '', msgErr: '' });
    this.emailEl = null;
    this.emailRef = (el) => { this.emailEl = el; };
    this.msgInput = (e) => this.setState({ msgText: e.target.value.slice(0, 1000), msgErr: '' });
    this.emailInput = (e) => this.setState({ msgEmail: e.target.value, msgErr: '' });
    this.msgNext = () => {
      if (!this.state.msgText.trim()) { this.setState({ msgErr: 'Please write a message first.' }); return; }
      this.setState({ msgStep: 'email', msgErr: '' }, () => setTimeout(() => { if (this.emailEl) this.emailEl.focus(); }, 30));
    };
    this.msgKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.msgNext(); } };
    this.msgSend = () => {
      const em = this.state.msgEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { this.setState({ msgErr: 'Please enter a valid email address.' }); return; }
      this.setState({ msgStep: 'sending', msgErr: '', msgEmail: em });
      this.deliverMessage(this.state.msgText.trim(), em).then(
        () => this.setState({ msgStep: 'done' }),
        () => this.setState({ msgStep: 'email', msgErr: 'Sorry, that did not go through. Please try again.' })
      );
    };
    this.emailKey = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.msgSend(); } };
    this.msgBack = () => this.setState({ msgStep: 'write', msgErr: '' });
    this.msgReset = () => this.setState({ msgStep: 'write', msgText: '', msgEmail: '', msgErr: '' });
    this.flowEl = null;
    this.flowRef = (el) => { this.flowEl = el; };
    this.onScroll = () => {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = null; this.measure(); });
    };
    this.openCaptcha = () => {
      this.setState(Object.assign({ capOpen: true, capOk: false }, this.newPuzzle()), () => {
        setTimeout(() => { if (this.handleEl) this.handleEl.focus(); }, 30);
      });
    };
    this.closeCaptcha = () => this.setState({ capOpen: false });
    this.refreshCaptcha = () => {
      if (this.isLocked()) return;
      this.setState(this.newPuzzle());
    };
    this.dialogKey = (e) => { if (e.key === 'Escape') this.setState({ capOpen: false }); };
    this.dragStart = (e) => {
      if (this.state.capOk || this.isLocked()) return;
      e.preventDefault();
      const startX = e.clientX - this.state.slide;
      const y0 = e.clientY;
      const t0 = performance.now();
      let moves = 0, yJit = 0;
      const move = (ev) => {
        moves++;
        yJit = Math.max(yJit, Math.abs(ev.clientY - y0));
        this.setState({ slide: Math.max(0, Math.min(this.MAXX, ev.clientX - startX)) });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        const took = performance.now() - t0;
        const human = took > 400 && moves > 6 && (yJit > 0 || moves > 25);
        this.judge(human);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };
    this.keyStep = (e) => {
      if (this.state.capOk || this.isLocked()) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!this.kStart) { this.kStart = performance.now(); this.kCount = 0; }
        this.kCount++;
        const step = (e.shiftKey ? 15 : 3) * (e.key === 'ArrowRight' ? 1 : -1);
        this.setState({ slide: Math.max(0, Math.min(this.MAXX, this.state.slide + step)) });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const human = this.kStart && performance.now() - this.kStart > 400 && this.kCount >= 4;
        this.kStart = null;
        this.judge(!!human);
      }
    };
  }
  startFlow(cv) {
    if (!cv || !cv.getContext) return () => {};
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
    const ctx = cv.getContext('2d');
    const VMAX = 10.5, ACC = 1.0, BTN_PD = 0.13, BTN_PP = 0.3;
    const S = { W: 0, H: 0, head: null, vel: { x: 0, y: 0 }, spd: 0, ang: -0.6, chase: true, rc: null, wp: null, gStart: null, gm: 1, genv: 0, target: null, pts: [], mode: 'linger', last: -1e9, lastScroll: 0, raf: 0, prev: 0 };
    const oc = document.createElement('canvas');
    const octx = oc.getContext('2d');
    const SS = [180, 220, 234], OB = [197, 174, 207];
    const now = () => performance.now();
    const resize = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      S.W = window.innerWidth;
      S.H = Math.min(window.innerHeight, 2000);
      cv.style.height = S.H + 'px';
      cv.width = Math.round(S.W * d);
      cv.height = Math.round(S.H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      oc.width = cv.width;
      oc.height = cv.height;
      octx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    S.head = { x: S.W * 0.5, y: S.H * 0.4 };
    S.target = { x: S.head.x, y: S.head.y };
    const pageY = () => (window.scrollY || document.documentElement.scrollTop || 0);
    S.lastScroll = pageY();
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (S.mode !== 'mouse') S.chase = true;
      S.mode = 'mouse'; S.target = { x: e.clientX, y: e.clientY }; S.last = now();
    };
    const onDown = (e) => {
      if (e.pointerType === 'mouse') return;
      S.mode = 'nudge'; S.target = { x: e.clientX, y: e.clientY }; S.last = now();
    };
    const onScroll = (e) => {
      const el = e && e.target;
      const y = el && el !== document && typeof el.scrollTop === 'number' ? el.scrollTop : pageY();
      const dir = y >= S.lastScroll ? 1 : -1;
      S.lastScroll = y;
      if (S.mode === 'mouse') return;
      S.mode = 'nudge';
      S.target = { x: S.head.x * 0.6 + S.W * 0.2, y: dir > 0 ? S.H * 0.8 : S.H * 0.2 };
      S.last = now();
    };
    const onLeave = () => { if (S.mode === 'mouse') S.mode = 'linger'; };
    const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    const frame = (ts) => {
      S.raf = requestAnimationFrame(frame);
      const dt = S.prev ? Math.min(3, Math.max(0.25, (ts - S.prev) / 16.667)) : 1;
      S.prev = ts;
      if (document.hidden) return;
      const t = ts / 1000, n = now();
      let tx, ty, vmax = VMAX, acc = ACC, wander = false;
      const roamR = Math.min(S.W, S.H) * 0.3;
      const pick = (cx, cy, R, screenWide) => {
        for (let k = 0; k < 14; k++) {
          let x, y;
          if (screenWide) {
            const goDown = S.head.y < S.H * 0.55;
            x = S.W * (0.12 + 0.76 * Math.random());
            y = goDown ? S.H * (0.62 + 0.26 * Math.random()) : S.H * (0.16 + 0.26 * Math.random());
          } else {
            const a = Math.random() * Math.PI * 2, r = R * (0.45 + 0.55 * Math.random());
            x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r;
          }
          x = Math.max(S.W * 0.06, Math.min(S.W * 0.94, x));
          y = Math.max(S.H * 0.08, Math.min(S.H * 0.92, y));
          if (Math.hypot(x - S.head.x, y - S.head.y) > Math.min(S.W, S.H) * 0.22) return { x: x, y: y, t0: t };
        }
        return { x: S.W * (0.3 + 0.4 * Math.random()), y: S.H * (0.3 + 0.4 * Math.random()), t0: t };
      };
      const buttons = () => {
        const out = [];
        const els = document.querySelectorAll ? document.querySelectorAll('a[href], button') : [];
        for (let k = 0; k < els.length; k++) {
          const r = els[k].getBoundingClientRect();
          if (r.width < 8 || r.height < 8 || r.width > S.W * 0.6 || r.height > S.H * 0.4) continue;
          if (r.bottom < 70 || r.top > S.H - 30 || r.right < 0 || r.left > S.W) continue;
          out.push(r);
        }
        return out;
      };
      const nextWander = (reached, timeout, cx, cy, R, screenWide) => {
        if (S.wp && !reached && !(t - S.wp.t0 > timeout)) return S.wp;
        if (S.bq && S.bq.length) { const w = S.bq.shift(); w.t0 = t; return w; }
        if (Math.random() < (screenWide ? BTN_PP : BTN_PD)) {
          const list = buttons();
          if (list.length) {
            const r = list[Math.floor(Math.random() * list.length)];
            const bx = r.left + r.width / 2, by = r.top + r.height / 2;
            const rx = r.width / 2 + 56, ry = r.height / 2 + 56;
            const a0 = Math.atan2(S.head.y - by, S.head.x - bx), dir = Math.random() < 0.5 ? -1 : 1;
            S.bq = [];
            for (let k = 1; k <= 6; k++) {
              const a = a0 + dir * k * (Math.PI * 2 / 5);
              S.bq.push({ x: Math.max(12, Math.min(S.W - 12, bx + Math.cos(a) * rx)), y: Math.max(12, Math.min(S.H - 12, by + Math.sin(a) * ry)), t0: t, btn: true, bx: bx, by: by });
            }
            const w = S.bq.shift(); w.t0 = t; return w;
          }
        }
        return pick(cx, cy, R, screenWide);
      };
      if (S.mode === 'mouse') {
        const dC = Math.hypot(S.target.x - S.head.x, S.target.y - S.head.y);
        if (!S.chase && (!S.rc || Math.hypot(S.target.x - S.rc.x, S.target.y - S.rc.y) > roamR * 0.5)) S.chase = true;
        if (S.chase && dC < 70) { S.chase = false; S.rc = { x: S.target.x, y: S.target.y }; S.wp = null; }
        if (S.chase) { tx = S.target.x; ty = S.target.y; S.bq = null; if (S.wp && S.wp.btn) S.wp = null; }
        else {
          wander = true; vmax = VMAX * 0.5;
          S.wp = nextWander(!S.wp || Math.hypot(S.wp.x - S.head.x, S.wp.y - S.head.y) < (S.wp.btn ? 45 : 90), S.wp && S.wp.btn ? 4 : 6, S.rc.x, S.rc.y, roamR, false);
          if (S.wp.btn) vmax = VMAX * 0.35;
          tx = S.wp.x; ty = S.wp.y;
        }
      } else if (S.mode === 'nudge' && n - S.last < 3600 && Math.hypot(S.target.x - S.head.x, S.target.y - S.head.y) > 70) {
        tx = S.target.x; ty = S.target.y;
        S.bq = null; if (S.wp && S.wp.btn) S.wp = null;
        vmax = VMAX * 0.5; acc = ACC * 0.5;
      } else {
        if (S.mode !== 'linger') { S.mode = 'linger'; S.wp = null; }
        wander = true; vmax = 1.5; acc = 0.06;
        S.wp = nextWander(!S.wp || Math.hypot(S.wp.x - S.head.x, S.wp.y - S.head.y) < (S.wp.btn ? 40 : 60), S.wp && S.wp.btn ? 7 : 14, 0, 0, 0, true);
        tx = S.wp.x; ty = S.wp.y;
      }
      const dx = tx - S.head.x, dy = ty - S.head.y;
      const dist = Math.hypot(dx, dy);
      let diff = Math.atan2(dy, dx) - S.ang;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      let rate = Math.min(0.22, 0.9 / (S.spd + 1), Math.max(S.spd / 90, Math.min(0.03, S.spd / 40))) + 0.002;
      if (wander && S.wp && S.wp.btn) rate = Math.max(rate, Math.min(0.12, S.spd / 50));
      S.onBtn = !!(wander && S.wp && S.wp.btn);
      const turn = rate * dt;
      S.ang += Math.max(-turn, Math.min(turn, diff));
      let want = vmax * (0.6 + 0.4 * Math.max(0, Math.cos(diff)));
      const radius = S.spd / rate;
      if (dist < radius * 1.2 && Math.abs(diff) > 1.0) {
        if (wander && !(S.wp && S.wp.btn)) S.wp = null;
        else want = Math.max(vmax * 0.4, Math.min(want, S.spd * 0.7));
      }
      const lim = acc * dt;
      S.spd += Math.max(-lim, Math.min(lim, want - S.spd));
      if (S.gNext === undefined) S.gNext = t + 3 + 3 * Math.random();
      if (S.gStart === null && t > S.gNext) S.gStart = t;
      let env = 0;
      if (S.gStart !== null) {
        const u = t - S.gStart;
        if (u < 1.2) env = ease(u / 1.2);
        else if (u < 2.0) env = 1;
        else if (u < 3.6) env = 1 - ease((u - 2.0) / 1.6);
        else { S.gStart = null; S.gNext = t + 5 + 4 * Math.random(); }
      }
      S.gm = 1 - 0.85 * env;
      S.genv = env;
      S.vel.x = Math.cos(S.ang) * S.spd;
      S.vel.y = Math.sin(S.ang) * S.spd;
      S.head.x += S.vel.x * dt;
      S.head.y += S.vel.y * dt;
      const p = S.pts;
      const lp = p[p.length - 1];
      if (!lp || Math.hypot(S.head.x - lp.x, S.head.y - lp.y) > 2) p.push({ x: S.head.x, y: S.head.y });
      const L = S.W * 0.42;
      let len = 0, cut = 0;
      for (let i = p.length - 1; i > 0; i--) {
        len += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
        if (len > L) { cut = i - 1; break; }
      }
      if (cut > 0) p.splice(0, cut);
      if (p.length > 600) p.splice(0, p.length - 600);
      ctx.clearRect(0, 0, S.W, S.H);
      if (p.length < 6) return;
      const q = [];
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
        const k = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 3));
        for (let j = 0; j < k; j++) {
          const u = j / k, u2 = u * u, u3 = u2 * u;
          q.push({
            x: 0.5 * (2 * p1.x + (p2.x - p0.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * u3),
            y: 0.5 * (2 * p1.y + (p2.y - p0.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * u3)
          });
        }
      }
      q.push(p[p.length - 1]);
      const pp = q;
      const m = pp.length;
      const nx = new Array(m), ny = new Array(m), arc = new Array(m);
      arc[0] = 0;
      for (let i = 0; i < m; i++) {
        const a = pp[Math.max(0, i - 4)], b = pp[Math.min(m - 1, i + 4)];
        const vx = b.x - a.x, vy = b.y - a.y, vl = Math.hypot(vx, vy) || 1;
        nx[i] = -vy / vl; ny[i] = vx / vl;
        if (i > 0) arc[i] = arc[i - 1] + Math.hypot(pp[i].x - pp[i - 1].x, pp[i].y - pp[i - 1].y);
      }
      const Wmax = Math.min(30, S.W * 0.02 + 8) * S.gm;
      const total = arc[m - 1];
      const Lx = new Array(m), Ly = new Array(m), Rx = new Array(m), Ry = new Array(m), tw = new Array(m);
      for (let i = 0; i < m; i++) {
        const f = i / (m - 1);
        const hd = Math.min(1, (1 - f) / 0.12);
        const taper = Math.pow(Math.min(1, f / 0.55), 0.9) * (0.12 + 0.88 * Math.sin(hd * Math.PI / 2));
        tw[i] = Math.abs(Math.cos((total - arc[i]) * 0.011 + t * 0.7));
        const hw = Math.max(0.35, Wmax * taper * (0.16 + 0.84 * tw[i]) / 2);
        Lx[i] = pp[i].x + nx[i] * hw; Ly[i] = pp[i].y + ny[i] * hw;
        Rx[i] = pp[i].x - nx[i] * hw; Ry[i] = pp[i].y - ny[i] * hw;
      }
      octx.clearRect(0, 0, S.W, S.H);
      octx.lineJoin = 'round';
      octx.lineWidth = 0.8;
      for (let i = 0; i < m - 1; i++) {
        const f = (i + 0.5) / (m - 1);
        const u = f * f * (3 - 2 * f);
        const shade = 0.86 + 0.14 * (tw[i] + tw[i + 1]) / 2;
        const hi = Math.max(0, ((tw[i] + tw[i + 1]) / 2 - 0.85) / 0.15) * 0.22;
        const c = [0, 1, 2].map((k) => Math.round(((SS[k] + (OB[k] - SS[k]) * u) * shade) * (1 - hi) + 255 * hi));
        const col = 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
        octx.beginPath();
        octx.moveTo(Lx[i], Ly[i]); octx.lineTo(Lx[i + 1], Ly[i + 1]);
        octx.lineTo(Rx[i + 1], Ry[i + 1]); octx.lineTo(Rx[i], Ry[i]);
        octx.closePath();
        octx.fillStyle = col; octx.strokeStyle = col;
        octx.fill(); octx.stroke();
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = 'rgba(160, 140, 200, 0.45)';
      ctx.shadowBlur = 14;
      ctx.drawImage(oc, 0, 0);
      ctx.restore();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    S.raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(S.raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', resize);
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }
  deliverMessage(text, email) {
    return new Promise((resolve) => setTimeout(resolve, 900));
  }
  isLocked() {
    return Date.now() < this.state.lockedUntil;
  }
  newPuzzle() {
    this.kStart = null;
    return {
      slide: 0,
      holeX: Math.round(120 + Math.random() * (this.MAXX - 120)),
      holeY: Math.round(8 + Math.random() * 90),
      msg: '', msgBad: false, shakeX: 0
    };
  }
  judge(human) {
    const fits = Math.abs(this.state.slide - this.state.holeX) <= this.TOL;
    if (fits && human) {
      this.setState({ capOk: true, msg: 'Thanks. Here is the number.', msgBad: false, slide: this.state.holeX });
      this.okT = setTimeout(() => this.setState({ verified: true, capOpen: false }), 900);
      return;
    }
    const fails = this.state.fails + 1;
    const msg = !fits ? 'Not quite. Try again.' : 'That was a little too quick. Try again.';
    [10, -10, 6, -6, 0].forEach((x, i) => {
      setTimeout(() => this.setState({ shakeX: x }), i * 70);
    });
    if (fails >= 3) {
      const until = Date.now() + 10000;
      this.setState({ fails: 0, lockedUntil: until, msg: 'Too many tries. Please wait 10 seconds.', msgBad: true });
      this.lockT = setTimeout(() => this.setState(Object.assign({ lockedUntil: 0 }, this.newPuzzle())), 10000);
      return;
    }
    this.setState({ fails: fails, msg: msg, msgBad: true });
    this.failT = setTimeout(() => this.setState(Object.assign(this.newPuzzle(), { msg: msg, msgBad: true })), 500);
  }
  measure() {
    const vh = Math.min(window.innerHeight || 900, 1000);
    const next = { vh: vh };
    let changed = vh !== this.state.vh;
    this.keys.forEach((k) => {
      const o = this.outer[k], t = this.track[k];
      if (!o || !t) { next[k] = this.state[k]; return; }
      const dist = Math.max(0, t.offsetWidth - t.parentElement.clientWidth);
      const r = o.getBoundingClientRect();
      const prog = dist > 0 ? Math.max(0, Math.min(1, (64 - r.top) / dist)) : 0;
      const cur = this.state[k];
      if (Math.abs(cur.dist - dist) > 1 || Math.abs(cur.prog - prog) > 0.001) changed = true;
      next[k] = { dist: dist, prog: prog };
    });
    if (changed) this.setState(next);
  }
  componentDidMount() {
    this.stopFlow = this.startFlow(this.flowEl);
    document.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this.onScroll);
    this.measure();
    this.t1 = setTimeout(() => this.measure(), 300);
    this.t2 = setTimeout(() => this.measure(), 1500);
    const whatEl = this.outer.what;
    if (whatEl && typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        if (this.played || !entries[0].isIntersecting) return;
        this.played = true;
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / 1400);
          this.setState({ p: 1 - Math.pow(1 - t, 3) });
          if (t < 1) this.craf = requestAnimationFrame(tick);
        };
        this.setState({ p: 0 });
        this.craf = requestAnimationFrame(tick);
      }, { threshold: 0, rootMargin: '0px 0px -40% 0px' });
      this.io.observe(whatEl);
    }
  }
  componentWillUnmount() {
    if (this.stopFlow) this.stopFlow();
    document.removeEventListener('scroll', this.onScroll, { capture: true });
    window.removeEventListener('resize', this.onScroll);
    clearTimeout(this.t1); clearTimeout(this.t2);
    if (this.io) this.io.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.craf) cancelAnimationFrame(this.craf);
    clearTimeout(this.okT); clearTimeout(this.lockT); clearTimeout(this.failT);
  }
  decode() {
    return this.enc.map((c) => String.fromCharCode(c ^ 7)).join('');
  }
  renderVals() {
    const vh = this.state.vh;
    const innerH = vh - 64;
    const cardH = Math.max(380, Math.min(620, innerH - 140));
    const sec = {};
    this.keys.forEach((k) => {
      const s = this.state[k];
      sec[k] = {
        outerRef: this.refs2[k].outer,
        trackRef: this.refs2[k].track,
        innerH: innerH,
        outerH: Math.round(innerH + s.dist),
        tx: Math.round(-s.prog * s.dist),
        bar: (s.prog * 100).toFixed(1)
      };
    });
    const p = this.state.p;
    const verified = this.state.verified;
    let phone = '', waHref = '#';
    if (verified) {
      const d = this.decode();
      phone = '+' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
      waHref = 'https://wa.me/' + d;
    }
    return {
      leaf: this.props.leaf ?? '#5FB37E',
      how: sec.how, what: sec.what, specs: sec.specs,
      cardH: cardH,
      n1: String(Math.round(1 * p)),
      n2: String(Math.round(5 * p)),
      n3: Math.round(10 * p) + '+',
      flowRef: this.flowRef,
      msgWrite: this.state.msgStep === 'write',
      msgAskEmail: this.state.msgStep === 'email',
      msgSending: this.state.msgStep === 'sending',
      msgDone: this.state.msgStep === 'done',
      msgText: this.state.msgText,
      msgEmail: this.state.msgEmail,
      msgErr: this.state.msgErr,
      msgCount: this.state.msgText.length + ' / 1000',
      msgInput: this.msgInput, msgKey: this.msgKey, msgNext: this.msgNext,
      emailInput: this.emailInput, emailKey: this.emailKey, msgSend: this.msgSend,
      msgBack: this.msgBack, msgReset: this.msgReset, emailRef: this.emailRef,
      openCaptcha: this.openCaptcha,
      closeCaptcha: this.closeCaptcha,
      refreshCaptcha: this.refreshCaptcha,
      dialogKey: this.dialogKey,
      dragStart: this.dragStart,
      keyStep: this.keyStep,
      handleRef: this.handleRef,
      captchaOpen: this.state.capOpen,
      capSuccess: this.state.capOk,
      pieceX: Math.round(this.state.slide),
      fillW: Math.round(this.state.slide + 30),
      holeX: this.state.holeX,
      holeY: this.state.holeY,
      negHoleX: -this.state.holeX,
      negHoleY: -this.state.holeY,
      shakeX: this.state.shakeX,
      capMsg: this.state.msg,
      msgColor: this.state.msgBad ? '#B3261E' : '#2E6B47',
      verified: verified,
      notVerified: !verified,
      phone: phone,
      waHref: waHref
    };
  }
}
document.addEventListener('DOMContentLoaded', function () { window.mountPage(Component, document.body, {}); });
})();
