/*
 * RF Receiving & Putaway - browser-only RF device simulator.
 * No login, no backend: demo data comes from data.js and
 * transactions are kept in this browser's localStorage.
 * All dynamic text is written with textContent (never innerHTML).
 */
(function () {
  'use strict';

  const D = window.RF_DATA;
  const $ = (sel) => document.querySelector(sel);
  const STEPS = ['Scan', 'Verify', 'Receive', 'Travel', 'Confirm', 'Done'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------------- helpers ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const ICONS = {
    camera: ['M3 8h4l2-3h6l2 3h4v11H3z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    pin: ['M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    box: ['M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z', 'M3 7.5L12 12l9-4.5', 'M12 12v9'],
    headset: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3v6H5a1 1 0 0 1-1-1z', 'M20 14h-3v6h2a1 1 0 0 0 1-1z'],
    gear: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
      'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z']
  };
  function icon(name, stroke) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(stroke || 2));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name]) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    return svg;
  }

  const mono = (t) => h('span', { class: 'mono' }, t);
  function kv(pairs) {
    const dl = h('dl', { class: 'kv' });
    for (const [k, v] of pairs) {
      if (v == null || v === '') continue;
      dl.append(h('dt', null, k), h('dd', null, v));
    }
    return dl;
  }

  /** Compare barcodes ignoring case, spaces and separators. */
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  /** Allow-list validation for any scanned / keyed barcode. */
  function validateScan(raw) {
    // GS1-128 scanners may prefix the symbology id "]C1" and use FNC1 (GS) separators
    const t = String(raw == null ? '' : raw).trim().toUpperCase().replace(/^\]C1/, '').replace(/\x1d/g, '');
    return /^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(t) ? t : null;
  }

  /** GS1-128 "(00)" + 18-digit SSCC -> plain SSCC; anything else unchanged. */
  const stripAi = (code) => (/^00\d{18}$/.test(code) ? code.slice(2) : code);
  /** Field label for a handling-unit id: the carton SSCC is the EWM HU ID (18 digits), else LPN. */
  const idKey = (v) => (/^\d{18}$/.test(String(v || '')) ? 'HU' : 'LPN');

  /** User name for display / stamping only - this is NOT authentication. */
  function validUser(raw) {
    const t = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
    return /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,29}$/.test(t) ? t : null;
  }

  function randomId(n) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function fmtDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
  }

  /* ---------------- storage (per browser, demo only) ---------------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('rf.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('rf.' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
    remove(key) {
      try { localStorage.removeItem('rf.' + key); } catch (e) { /* ignore */ }
    }
  };

  function loadTasks() {
    const t = store.get('tasks', []);
    return Array.isArray(t)
      ? t.filter((x) => x && typeof x.lpn === 'string' && (x.status === 'RECEIVED' || x.status === 'PUTAWAY'))
      : [];
  }

  function loadOverrides() {
    const o = store.get('overrides', []);
    return Array.isArray(o) ? o.filter((x) => x && typeof x.code === 'string').slice(-200) : [];
  }

  function nextDoc(prefix) {
    const key = 'seq.' + prefix;
    const n = (Number(store.get(key, 0)) || 0) + 1;
    store.set(key, n);
    return `${prefix}-${String(n).padStart(6, '0')}`;
  }

  /* ---------------- state ---------------- */
  const S = {
    screen: 'home',
    cur: null,          // task currently being worked
    pendingLpn: null,   // LPN that was not found on the ASN
    msg: null,
    ovr: null,          // override available for the current error message
    ovrOpen: false,     // exception-code panel is showing
    ovrErr: null,       // message inside the exception-code panel
    itCall: null,       // IT issue id behind the current RF error ("Call IT")
    ticket: null,       // IT ticket being worked on the it-ticket screen
    back: 'home',
    tasks: loadTasks(),
    overrides: loadOverrides(),
    itFixes: (() => { const f = store.get('itFixes', {}); return f && typeof f === 'object' && !Array.isArray(f) ? f : {}; })(),
    itTickets: (() => { const t = store.get('itTickets', []); return Array.isArray(t) ? t.filter((x) => x && typeof x.id === 'string').slice(-100) : []; })(),
    pick: null,         // active picking run: { so, tasks, idx, cur }
    picks: (() => { const p = store.get('picks', {}); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; })(),
    pack: (() => { const p = store.get('pack', {}); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; })(),
    operator: validUser(store.get('user', null))
  };
  store.remove('operator'); // legacy guest id from the first version
  if (!S.operator) S.screen = 'login';
  const save = () => store.set('tasks', S.tasks);
  const findTask = (lpn) => S.tasks.find((t) => norm(t.lpn) === norm(lpn));
  const openTasks = () => S.tasks.filter((t) => t.status === 'RECEIVED');

  /* ---------------- feedback (beep + vibrate) ---------------- */
  let audio = null;
  function tone(freq, ms, delay) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(audio.destination);
      const t0 = audio.currentTime + (delay || 0);
      o.start(t0);
      o.stop(t0 + ms / 1000);
    } catch (e) { /* audio not available */ }
  }
  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
  const okBeep = () => { tone(1500, 90); buzz(60); };
  const errBeep = () => { tone(330, 160); tone(250, 240, 0.2); buzz([120, 60, 160]); };

  /* ---------------- navigation ---------------- */
  function resetOverride() { S.ovr = null; S.ovrOpen = false; S.ovrErr = null; S.itCall = null; }
  function go(screen, msg) {
    if (screen !== S.screen) S.confirmClear = false;
    S.screen = screen;
    S.msg = msg || null;
    resetOverride();
    render();
  }
  /**
   * Show a message. Every error can be overridden with an exception code:
   * `ovr` = { kind, note, task?, run?(code) }. Without `ovr` an error is
   * GENERAL and a valid code simply clears it.
   */
  function flash(type, text, ovr) {
    S.msg = { type, text };
    resetOverride();
    if (type === 'error') {
      S.ovr = ovr || { kind: 'GENERAL', note: text };
      errBeep();
    }
    render();
  }

  /* ---------------- exception-code override (demo) ---------------- */
  const codesFor = (kind) => (D.exceptionCodes || []).filter((c) => c.applies.includes(kind) || c.applies.includes('*'));

  function applyOverride(ovr, raw) {
    const code = String(raw == null ? '' : raw).trim().toUpperCase();
    const allowed = codesFor(ovr.kind);
    const fail = (text) => { S.ovrErr = text; errBeep(); render(); };
    if (!/^[A-Z0-9]{2,8}$/.test(code)) return fail('Enter an exception code (letters and numbers).');
    const ec = (D.exceptionCodes || []).find((c) => c.code === code);
    if (!ec) return fail(`Unknown exception code ${code}.`);
    if (!allowed.includes(ec)) return fail(`${code} is not valid for this error. Use ${allowed.map((c) => c.code).join(' or ')}.`);

    S.overrides.push({ code, text: ec.text, kind: ovr.kind, error: ovr.note, lpn: ovr.task ? ovr.task.lpn : (ovr.lpn || null),
      user: S.operator, at: Date.now() });
    S.overrides = S.overrides.slice(-200);
    store.set('overrides', S.overrides);
    if (ovr.task) {
      ovr.task.exceptions.push(`${code}: ${ovr.note}`);
      if (S.tasks.includes(ovr.task)) save();
    }
    okBeep();
    if (ovr.run) ovr.run(code);
    else go(S.screen, { type: 'ok', text: `Exception ${code} (${ec.text}) applied – error overridden.` });
  }

  /** Button that opens the exception-code panel, or the panel itself. */
  function overrideBlock(ovr) {
    if (!ovr) return null;
    if (!S.ovrOpen) {
      return h('button', { class: 'btn btn-ovr', type: 'button', onclick: () => { S.ovrOpen = true; S.ovrErr = null; render(); } },
        'Override with exception code');
    }
    const input = h('input', {
      class: 'scan-input', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
      maxlength: '8', placeholder: 'Key exception code', 'aria-label': 'Exception code', 'data-autofocus': true
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyOverride(ovr, input.value); } });
    return h('div', { class: 'ovr-panel' },
      h('label', { class: 'field-label' }, 'Exception code'),
      h('div', { class: 'scan-row' },
        input,
        h('button', { class: 'btn btn-dark btn-go', type: 'button', onclick: () => applyOverride(ovr, input.value) }, 'OK')),
      S.ovrErr && h('div', { class: 'ovr-err', role: 'alert' }, S.ovrErr),
      h('p', { class: 'muted' }, 'Valid codes for this error:'),
      h('div', { class: 'ovr-codes' }, codesFor(ovr.kind).map((c) =>
        h('button', { class: 'ovr-chip', type: 'button', onclick: () => applyOverride(ovr, c.code) },
          h('b', null, c.code), h('span', null, c.text)))),
      h('button', { class: 'btn btn-link', type: 'button', onclick: () => { S.ovrOpen = false; S.ovrErr = null; render(); } }, 'Cancel override'));
  }

  /* ---------------- IT assistance (film "IT moments") ---------------- */
  const itIssue = (id, sku) => (D.itIssues || []).find((i) => i.id === id && (!sku || norm(i.sku) === norm(sku))) || null;
  const itFixed = (id) => S.itFixes[id] === true;

  /** Throw an RF error that only IT can fix: red message + "Call IT" button. */
  function rfError(issueId, text) {
    S.msg = { type: 'error', text };
    resetOverride();
    S.itCall = issueId;
    errBeep();
    render();
  }

  function itCallBlock(issueId) {
    return h('button', { class: 'btn btn-it btn-xl', type: 'button', onclick: () => callIt(issueId) },
      icon('headset'), 'Call IT – raise ticket');
  }

  function callIt(issueId) {
    const issue = (D.itIssues || []).find((i) => i.id === issueId);
    if (!issue) return;
    const inPick = S.screen.startsWith('pick-') || S.screen === 'pack';
    const forTask = !inPick && S.cur && norm(S.cur.sku) === norm(issue.sku) ? S.cur : null;
    const pickTask = inPick && S.pick && S.pick.cur && S.screen.startsWith('pick-') ? S.pick.cur : null;
    S.ticket = {
      id: nextDoc('INC'), issue: issue.id, title: issue.title, error: S.msg ? S.msg.text : issue.title,
      lpn: forTask ? forTask.lpn : (pickTask ? pickTask.id : (issue.hu || null)), sku: issue.sku || null, user: S.operator, raisedAt: Date.now(),
      status: 'OPEN', returnTo: S.screen, task: forTask, pickTask,
      refKey: pickTask ? 'Pick task' : (!forTask && issue.hu ? 'Carton' : null)
    };
    go('it-ticket');
  }

  function saveTicket(t) {
    const rec = { id: t.id, issue: t.issue, title: t.title, error: t.error, fix: t.fix || null, lpn: t.lpn, sku: t.sku,
      user: t.user, raisedAt: t.raisedAt, resolvedAt: t.resolvedAt || null, status: t.status };
    S.itTickets = S.itTickets.filter((x) => x.id !== t.id).concat(rec).slice(-100);
    store.set('itTickets', S.itTickets);
  }

  // IT taps "Apply fix": gear spins, then the fix is applied and RESOLVED shows.
  function itWork() {
    const t = S.ticket;
    if (!t || t.status !== 'OPEN') return;
    t.status = 'WORKING';
    render();
    setTimeout(() => {
      const issue = (D.itIssues || []).find((i) => i.id === t.issue);
      S.itFixes[t.issue] = true;
      store.set('itFixes', S.itFixes);
      t.fix = issue ? issue.fix : 'Fixed';
      if (t.task) {
        if (t.issue === 'NOBIN' && !t.task.bin) t.task.bin = issue.overflowBin;
        t.task.exceptions.push(`IT ${t.id}: ${t.fix}`);
        if (S.tasks.includes(t.task)) save();
      }
      if (t.pickTask) t.pickTask.exceptions.push(`IT ${t.id}: ${t.fix}`);
      if (t.issue === 'NOPACK' && issue) {
        S.pack[issue.hu] = Object.assign({}, S.pack[issue.hu], { note: `IT ${t.id}: ${t.fix}` });
        store.set('pack', S.pack);
      }
      t.status = 'RESOLVED';
      t.resolvedAt = Date.now();
      saveTicket(t);
      okBeep();
      if (S.screen === 'it-ticket') render();
    }, 1800);
  }

  function itContinue() {
    const t = S.ticket;
    S.ticket = null;
    if (!t) { go('home'); return; }
    if (t.issue === 'EAN' && t.returnTo === 'put-travel' && S.cur) {   // putaway: EAN now mapped -> UPC step done
      S.cur.upcOk = true;
      go('put-travel', { type: 'ok', text: `IT ${t.id} resolved: ${t.fix}. Product confirmed – confirm the quantity.` });
      return;
    }
    if (t.issue === 'EAN') {             // rescan the vendor EAN now that it is mapped
      const issue = (D.itIssues || []).find((i) => i.id === 'EAN');
      go('rcv-scan');
      if (issue) handleReceiveScan(issue.ean);
      return;
    }
    // Picking: the bin was already scanned, so carry on with the pick
    if (t.returnTo === 'pick-travel' && S.pick && S.pick.cur) {
      go('pick-item', { type: 'ok', text: `IT ${t.id} resolved: ${t.fix}. Carry on with the pick.` });
      return;
    }
    go(t.returnTo || 'home', { type: 'ok', text: `IT ${t.id} resolved: ${t.fix}.` });
  }

  // Shared override: a pallet that is already put away is reopened for putaway.
  function reopenOverride(t) {
    return {
      kind: 'ALREADY_PUT', task: t, note: `Reopened for putaway (was in ${t.bin})`,
      run: () => {
        t.status = 'RECEIVED';
        delete t.putawayAt;
        delete t.wtDoc;
        t.upcOk = !t.upc;
        t.qtyOk = false;
        save();
        S.cur = t;
        go('put-travel', { type: 'warn', text: `${t.lpn} reopened for putaway.` });
      }
    };
  }

  // First free alternate bin, optionally limited to one storage type.
  function freeAltBin(t, st) {
    const busy = new Set(openTasks().filter((x) => x !== t).map((x) => norm(x.bin)));
    // Segregated types (Hazmat) never mix with others, even by override
    const fromSeg = t ? !!(t.hazmat || (storageTypeOf(t.bin) || {}).segregated) : false;
    return D.altBins.find((b) => (!t || norm(b) !== norm(t.bin)) && !busy.has(norm(b)) &&
      (!st || storageTypeOf(b) === st) && (!t || !!(storageTypeOf(b) || {}).segregated === fromSeg)) || null;
  }
  function back() {
    if (S.screen === 'rcv-verify' || S.screen === 'rcv-unknown') { S.cur = null; S.pendingLpn = null; }
    go(S.back || 'home');
  }

  /* ---------------- sign in / out (user name only, no password) ---------------- */
  function signIn(raw) {
    const u = validUser(raw);
    if (!u) {
      flash('error', 'Enter a user name: 2–30 characters (letters, numbers, space, . _ -).');
      return;
    }
    S.operator = u;
    store.set('user', u);
    okBeep();
    go('home', { type: 'ok', text: `Signed in as ${u}.` });
  }

  function signOut() {
    S.operator = null;
    S.cur = null;
    S.pendingLpn = null;
    store.remove('user');
    go('login', { type: 'info', text: 'Signed out.' });
  }

  /* ---------------- camera scanner ---------------- */
  let qr = null;
  let scanCb = null;
  let scanning = false;

  async function openCamera(label, cb) {
    if (!window.isSecureContext) {
      flash('error', 'Camera scanning needs HTTPS. Open the app from its https:// link, or key the barcode in.');
      return;
    }
    if (!window.Html5Qrcode) {
      flash('error', 'Camera scanner could not load (check network). Key the barcode in instead.');
      return;
    }
    scanCb = cb;
    $('#cam-label').textContent = label;
    $('#cam-status').textContent = 'Starting camera…';
    $('#cam').hidden = false;
    try {
      const F = window.Html5QrcodeSupportedFormats;
      qr = new window.Html5Qrcode('reader', {
        verbose: false,
        formatsToSupport: [F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.QR_CODE, F.DATA_MATRIX],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      });
      scanning = true;
      await qr.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: (w, hgt) => ({
            width: Math.max(120, Math.floor(w * 0.9)),
            height: Math.max(80, Math.floor(Math.min(hgt * 0.6, w * 0.55)))
          })
        },
        onDecode,
        () => { /* no code in this frame */ }
      );
      $('#cam-status').textContent = 'Aim the camera at the barcode';
    } catch (err) {
      await closeCamera();
      flash('error', 'Could not start the camera. Allow camera access in the browser, or key the barcode in.');
    }
  }

  async function onDecode(text) {
    if (!scanning) return;
    scanning = false;
    const cb = scanCb;
    await closeCamera();
    const v = validateScan(text);
    if (!v) { flash('error', 'Barcode not recognised. Try again or key it in.'); return; }
    if (cb) cb(v);
  }

  async function closeCamera() {
    scanning = false;
    if (qr) {
      try { if (qr.isScanning) await qr.stop(); } catch (e) { /* ignore */ }
      try { qr.clear(); } catch (e) { /* ignore */ }
      qr = null;
    }
    $('#cam').hidden = true;
  }

  /* ---------------- reusable blocks ---------------- */
  function scanField(opts) {
    const input = h('input', {
      class: 'scan-input', type: 'text', inputmode: 'text', autocomplete: 'off',
      autocapitalize: 'characters', spellcheck: 'false', maxlength: '40',
      placeholder: opts.placeholder, 'aria-label': opts.label, 'data-autofocus': true
    });
    const submit = () => {
      const v = validateScan(input.value);
      if (!v) {
        flash('error', 'Invalid barcode. Use letters, numbers and - . / _ only (max 40).');
        return;
      }
      input.value = '';
      opts.onScan(v);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    return h('div', { class: 'scan-block' },
      h('label', { class: 'field-label' }, opts.label),
      h('div', { class: 'scan-row' },
        input,
        h('button', { class: 'btn btn-dark btn-go', type: 'button', onclick: submit }, 'GO')),
      h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => openCamera(opts.label, opts.onScan) },
        icon('camera'), 'Scan with camera'),
      opts.simulate && h('button', { class: 'btn btn-link', type: 'button', onclick: () => opts.onScan(opts.simulate()) },
        'No label handy? Simulate a scan')
    );
  }

  function itemCard(t, extra) {
    return h('div', { class: 'card' },
      h('div', { class: 'item-title' }, t.desc),
      kv([
        [idKey(t.lpn), mono(t.lpn)],
        ['SKU', mono(t.sku)],
        ['PO', mono(t.po)],
        ['Vendor', t.vendor],
        ['Batch', t.batch ? mono(t.batch) : null],
        ['Use by', t.useBy ? mono(t.useBy) : null],
        ['Handling', t.hazmat ? h('span', { class: 'pill exc' }, 'HAZMAT – segregate') : null],
        ...(extra || [])
      ]));
  }

  // Split a bin code into labelled parts for the big location display.
  // Zone-Aisle-Bay-Level (A-04-02-C) or EWM Aisle-Stack-LevelPosition (104-01-B01).
  function binParts(bin) {
    const p = bin.split('-');
    if (p.length === 4) return [['Zone', p[0]], ['Aisle', p[1]], ['Bay', p[2]], ['Level', p[3]]];
    const m = p.length === 3 ? /^([A-Z])(\d+)$/.exec(p[2]) : null;
    if (m) return [['Aisle', p[0]], ['Stack', p[1]], ['Level', m[1]], ['Position', m[2]]];
    return null;
  }

  function storageTypeOf(bin) {
    const aisle = String(bin || '').toUpperCase().split('-')[0];
    return (D.storageTypes || []).find((s) => String(s.aisle).toUpperCase() === aisle) || null;
  }

  function locPanel(bin, caption) {
    const parts = binParts(bin);
    const st = storageTypeOf(bin);
    return h('div', { class: 'location' },
      h('div', { class: 'loc-cap' }, caption || 'Destination bin'),
      h('div', { class: 'big' }, bin),
      st && h('div', { class: 'loc-type' }, `Storage type ${st.code} · ${st.name}`),
      parts && h('div', { class: 'loc-parts' },
        parts.map(([name, val]) => h('div', null, h('small', null, name), h('b', null, val)))));
  }

  function hero(title, sub) {
    return h('div', { class: 'done-hero' },
      h('div', { class: 'icon' }, icon('check', 3)),
      h('h2', null, title),
      sub && h('p', null, sub));
  }

  const qtyText = (t, q) => `${q} ${t.uom}`;

  /* ---------------- receiving logic ---------------- */
  const uomText = (product, qty, uom, issue) =>
    `QTY MISMATCH · ${product} · ASN ${qty} ${uom}, EWM expects ${qty * issue.eaPerCase} EA · no ${uom}→EA conversion in the product master.`;

  /** A receiving task for one ASN carton (the carton SSCC is the HU ID). */
  function taskFromLine(line) {
    return {
      id: randomId(8), lpn: line.lpn, po: line.po, asn: D.asnId, vendor: line.vendor, product: line.product,
      sku: line.sku, upc: line.upc || null, desc: line.desc, uom: line.uom, qtyExp: line.qty, qtyRcv: line.qty,
      batch: line.batch || null, useBy: line.useBy || null, hazmat: !!line.hazmat, pallet: line.pallet || null,
      plannedBin: line.bin, bin: line.bin, condition: 'GOOD', blind: false, exceptions: []
    };
  }
  const palletsOf = () => (D.shipment && D.shipment.pallets) || [];

  /* Pallet receipt: scanning a pallet SSCC receives every carton on it in one goods
   * receipt; there is no carton-by-carton scan. Each carton is then put away by HU. */
  function openPalletReceipt(pal) {
    const lines = D.asn.filter((a) => a.pallet === pal.no);
    const todo = lines.filter((a) => !findTask(a.lpn));
    S.palletFocus = pal.no;
    if (!todo.length) {
      okBeep();
      go('rcv-scan', { type: 'info', text: `Pallet ${pal.no} is already received. Go to Putaway and scan each carton's HU.` });
      return;
    }
    S.cur = null;
    S.rcvPallet = pal.no;
    // IT moment: ASN quantity in cases but no case-to-each conversion (blocks the pallet receipt)
    const uomLine = todo.find((a) => itIssue('UOM', a.sku) && !itFixed('UOM'));
    if (uomLine) {
      S.screen = 'rcv-pallet';
      rfError('UOM', uomText(uomLine.product, uomLine.qty, uomLine.uom, itIssue('UOM', uomLine.sku)));
      return;
    }
    okBeep();
    go('rcv-pallet', { type: 'ok', text: `Pallet ${pal.no} of ${palletsOf().length} found on ${D.asnId} · ${todo.length} cartons to receive.` });
  }

  function confirmPalletReceipt() {
    const pal = palletsOf().find((p) => p.no === S.rcvPallet);
    if (!pal) { go('rcv-scan'); return; }
    const todo = D.asn.filter((a) => a.pallet === pal.no && !findTask(a.lpn));
    const uomLine = todo.find((a) => itIssue('UOM', a.sku) && !itFixed('UOM'));
    if (uomLine) { rfError('UOM', uomText(uomLine.product, uomLine.qty, uomLine.uom, itIssue('UOM', uomLine.sku))); return; }
    const gr = nextDoc('GR');
    const at = Date.now();
    let noBin = null;
    const ids = todo.map((line) => {
      const t = taskFromLine(line);
      const nb = itIssue('NOBIN', t.sku);
      if (nb && !itFixed('NOBIN')) { t.bin = null; noBin = noBin || t; }
      Object.assign(t, { status: 'RECEIVED', receivedAt: at, grDoc: gr, operator: S.operator, palletSscc: pal.sscc });
      S.tasks.push(t);
      return t.lpn;
    });
    save();
    S.rcvDone = { pallet: pal.no, sscc: pal.sscc, gr, ids };
    S.rcvPallet = null;
    S.putHint = ids[0];
    okBeep();
    S.cur = noBin;        // so a "Call IT" for No bin attaches to that carton
    go('rcv-pallet-done');
    if (noBin) rfError('NOBIN', noBinText(noBin, itIssue('NOBIN', noBin.sku)));
  }

  function handleReceiveScan(code) {
    code = stripAi(code);
    // Pallet label scanned: receive the whole pallet (no carton scans)
    const pal = palletsOf().find((p) => norm(code) === norm(p.sscc));
    if (pal) { openPalletReceipt(pal); return; }
    // IT moment: vendor EAN-13 on the case is not mapped to any product yet
    const eanIssue = (D.itIssues || []).find((i) => i.id === 'EAN' && norm(i.ean) === norm(code));
    if (eanIssue) {
      if (!itFixed('EAN')) {
        S.cur = null;
        rfError('EAN', `BARCODE NOT RECOGNISED · ${code} is a vendor EAN-13 that is not mapped to any product.`);
        return;
      }
      code = eanIssue.sku;
    }
    const existing = findTask(code);
    if (existing) {
      if (existing.status === 'RECEIVED') {
        S.cur = existing;
        go('put-travel', { type: 'warn', text: `${existing.lpn} was already received. Continue with putaway.` });
      } else {
        flash('error', `${existing.lpn} is already put away in ${existing.bin}.`, reopenOverride(existing));
      }
      return;
    }
    let line = D.asn.find((a) => norm(a.lpn) === norm(code));
    let viaSku = false;
    if (!line) {
      // Product (SKU) barcode: match the next un-received pallet of that product
      const skuLines = D.asn.filter((a) => norm(a.sku) === norm(code) || (a.upc && norm(a.upc) === norm(code)));
      if (skuLines.length) {
        line = skuLines.find((a) => !findTask(a.lpn));
        if (!line) {
          const base = skuLines[0];
          flash('error', `All cartons of ${base.product || code} are already received.`, {
            kind: 'SKU_DONE', note: `Extra carton of ${base.sku} over ${D.asnId}`, lpn: base.lpn,
            run: (oc) => {
              S.cur = {
                id: randomId(8), lpn: `${base.lpn}-X${randomId(3)}`, po: base.po, asn: D.asnId, vendor: base.vendor,
                sku: base.sku, desc: base.desc, uom: base.uom, qtyExp: base.qty, qtyRcv: base.qty,
                plannedBin: base.bin, bin: base.bin, condition: 'GOOD', blind: false,
                exceptions: [`${oc}: Extra carton of ${base.sku} over ${D.asnId}`]
              };
              go('rcv-verify', { type: 'warn', text: `Override ${oc}: receiving an extra carton of ${base.product}.` });
            }
          });
          return;
        }
        viaSku = true;
      }
    }
    if (!line) {
      S.pendingLpn = code;
      errBeep();
      go('rcv-unknown');
      return;
    }
    S.cur = taskFromLine(line);
    // IT moment: ASN quantity is in cases but the product has no case-to-each conversion
    const uom = itIssue('UOM', line.sku);
    if (uom && !itFixed('UOM')) {
      S.screen = 'rcv-verify';
      rfError('UOM', uomText(line.product, line.qty, line.uom, uom));
      return;
    }
    okBeep();
    go('rcv-verify', {
      type: 'ok',
      text: viaSku
        ? `Product ${line.sku} matched to carton ${line.lpn} on ${D.asnId}.`
        : `Carton ${line.lpn} found on ${D.asnId} (PO ${line.po}, line ${line.line || '-'}).`
    });
  }

  function blindReceive() {
    const lpn = S.pendingLpn;
    S.pendingLpn = null;
    S.cur = {
      id: randomId(8), lpn, po: '-', asn: '-', vendor: 'Unknown - not on ASN',
      sku: 'UNKNOWN', desc: 'Unidentified carton - inspect at QA', uom: 'EA', qtyExp: 0, qtyRcv: 1,
      plannedBin: D.qaBin, bin: D.qaBin, condition: 'GOOD', blind: true, exceptions: ['Not on ASN']
    };
    go('rcv-verify', { type: 'warn', text: 'Blind receipt: count the carton and confirm. It will be directed to QA hold.' });
  }

  // Override for an LPN that is not on the ASN: receive it straight to a General bin.
  function unknownLpnOverride() {
    const lpn = S.pendingLpn;
    return {
      kind: 'NOT_ON_ASN', lpn, note: `${lpn} not on ${D.asnId}, received without QA hold`,
      run: (oc) => {
        const general = (D.storageTypes || []).find((s) => s.code === '1000') || null;
        const bin = freeAltBin(null, general) || freeAltBin(null, null) || D.qaBin;
        S.pendingLpn = null;
        S.cur = {
          id: randomId(8), lpn, po: '-', asn: '-', vendor: 'Unknown - not on ASN',
          sku: 'UNKNOWN', desc: 'Unplanned carton - received by exception', uom: 'EA', qtyExp: 0, qtyRcv: 1,
          plannedBin: bin, bin, condition: 'GOOD', blind: true,
          exceptions: [`${oc}: Not on ASN, received without QA hold`]
        };
        go('rcv-verify', { type: 'warn', text: `Override ${oc}: count the carton and confirm. It will go to ${bin}.` });
      }
    };
  }

  function confirmReceipt(rawQty) {
    const t = S.cur;
    const uom = itIssue('UOM', t.sku);
    if (uom && !itFixed('UOM')) { rfError('UOM', uomText(t.product || t.sku, t.qtyExp, t.uom, uom)); return; }
    const txt = String(rawQty).trim();
    const q = Number.parseInt(txt, 10);
    if (!/^\d{1,4}$/.test(txt) || q < 1) {
      flash('error', 'Enter a received quantity between 1 and 9999.');
      return;
    }
    t.qtyRcv = q;
    if (!t.blind && q !== t.qtyExp) {
      t.exceptions.push(q < t.qtyExp ? `Short ${t.qtyExp - q} ${t.uom}` : `Over ${q - t.qtyExp} ${t.uom}`);
    }
    if (t.condition === 'DAMAGED') {
      t.exceptions.push('Damaged');
      t.bin = D.qaBin;
    }
    // IT moment: no bin can be found for this product until IT activates the overflow bin
    const nb = itIssue('NOBIN', t.sku);
    if (nb && !itFixed('NOBIN') && t.bin !== D.qaBin) t.bin = null;
    t.status = 'RECEIVED';
    t.receivedAt = Date.now();
    t.grDoc = nextDoc('GR');
    t.operator = S.operator;
    S.tasks.push(t);
    save();
    okBeep();
    go('rcv-done');
    if (!t.bin) rfError('NOBIN', noBinText(t, nb));
  }

  function noBinText(t, nb) {
    const st = storageTypeOf(nb ? nb.overflowBin : '');
    const type = st ? `storage type ${st.code} ${st.name}` : 'the storage type';
    return `NO BIN FOUND · ${t.product || t.sku}: all bins in ${type} are full. Putaway can't be created.`;
  }

  /* ---------------- putaway logic ---------------- */
  function handlePutawayLpn(code) {
    code = stripAi(code);
    const t = findTask(code);
    if (!t) {
      flash('error', `No open putaway task for ${code}. Receive the carton first.`, {
        kind: 'NO_TASK', lpn: code, note: `No putaway task for ${code}, sent to receiving`,
        run: () => handleReceiveScan(code)
      });
      return;
    }
    if (t.status === 'PUTAWAY') { flash('error', `${t.lpn} is already put away in ${t.bin}.`, reopenOverride(t)); return; }
    // HU-based putaway flow: scan HU -> show destination -> scan UPC -> confirm qty -> scan destination bin -> confirm
    S.cur = t;
    t.upcOk = !t.upc;          // no UPC (e.g. unknown blind-received carton) -> skip the UPC step
    t.qtyOk = false;
    okBeep();
    go('put-travel', { type: 'ok', text: t.bin
      ? `HU ${t.lpn} · putaway task found. Destination ${t.bin}.`
      : `HU ${t.lpn} · putaway task found.` });
  }

  function handlePutUpc(code) {
    const t = S.cur;
    // IT moment (film IT 2): this product only carries the vendor's EAN-13, which isn't mapped yet
    const ean = (D.itIssues || []).find((i) => i.id === 'EAN' && norm(i.ean) === norm(code) && norm(i.sku) === norm(t.sku));
    if (ean) {
      if (!itFixed('EAN')) {
        rfError('EAN', `BARCODE NOT RECOGNISED · ${code} is a vendor EAN-13 that is not mapped to any product. HU ${t.lpn} can't be confirmed.`);
        return;
      }
      code = t.upc || code;            // mapped: treat the vendor EAN as this product's barcode
    }
    if (!t.upc || norm(code) !== norm(t.upc)) {
      const other = D.asn.find((a) => a.upc && norm(a.upc) === norm(code));
      flash('error', other
        ? `Wrong product! You scanned the UPC of ${other.product}. HU ${t.lpn} holds ${t.product || t.sku}.`
        : `UPC ${code} doesn't match HU ${t.lpn}. Scan the UPC of ${t.product || t.sku}.`,
      { kind: 'GENERAL', note: `Wrong UPC ${code} for HU ${t.lpn}` });
      return;
    }
    t.upcOk = true;
    okBeep();
    go('put-travel', { type: 'ok', text: `UPC ${t.upc} confirmed (${t.product || t.sku}). Confirm the quantity.` });
  }

  function confirmPutQty(raw) {
    const t = S.cur;
    const txt = String(raw == null ? '' : raw).trim();
    const q = Number.parseInt(txt, 10);
    if (!/^\d{1,4}$/.test(txt) || q !== Number(t.qtyRcv)) {
      flash('error', `Quantity doesn't match HU ${t.lpn}: it holds ${qtyText(t, t.qtyRcv)}. Count again and enter ${t.qtyRcv}.`,
        { kind: 'GENERAL', note: `Putaway qty ${txt || '-'} vs ${t.qtyRcv} for HU ${t.lpn}` });
      return;
    }
    t.qtyOk = true;
    okBeep();
    go('put-travel', { type: 'ok', text: `${qtyText(t, q)} confirmed. Scan the destination bin ${t.bin}.` });
  }

  function handleBinScan(code) {
    const t = S.cur;
    if ((t.upc && !t.upcOk) || !t.qtyOk) {
      flash('error', `Scan the product UPC and confirm the quantity before scanning the bin.`);
      return;
    }
    if (norm(code) !== norm(t.bin)) {
      const st = storageTypeOf(code), planned = storageTypeOf(t.bin);
      const seg = (x) => !!(x && x.segregated);
      if (st && (seg(st) !== (seg(planned) || !!t.hazmat))) {
        // Hazmat segregation: never put hazmat in a general bin or general stock in hazmat
        flash('error', `Not allowed: ${code} is ${st.name} (${st.code}). ${t.hazmat || seg(planned) ? 'Hazmat stock must stay in a hazmat bin.' : 'Only hazmat stock goes in a hazmat bin.'} Go to ${t.bin}.`,
          { kind: 'SEGREGATION', note: `Blocked ${code} for ${t.lpn} (hazmat segregation)` });
        return;
      }
      const typeNote = st && planned && st !== planned ? ` (storage type ${planned.code} → ${st.code})` : '';
      flash('error', `Wrong bin! You scanned ${code}. Go to ${t.bin}.`, {
        kind: 'WRONG_BIN', task: t, note: `Directed ${t.bin}, put to ${code}${typeNote}`,
        run: () => {
          t.bin = code;
          t.scannedBin = code;
          save();
          go('put-confirm');
        }
      });
      return;
    }
    t.scannedBin = t.bin;
    okBeep();
    go('put-confirm');
  }

  function alternateBin() {
    const t = S.cur;
    const busy = new Set(openTasks().filter((x) => x !== t).map((x) => norm(x.bin)));
    // Stay in the same storage type (e.g. never move general stock into hazmat).
    const st = storageTypeOf(t.bin);
    const options = D.altBins.filter((b) => norm(b) !== norm(t.bin) && !busy.has(norm(b)) &&
      (!st || storageTypeOf(b) === st));
    if (!options.length) {
      flash('error', 'No alternate bin available in this storage type. Contact your supervisor.', {
        kind: 'NO_ALT_BIN', note: `No alternate for ${t.bin} in its storage type`,
        run: (oc) => {
          const alt = freeAltBin(t, null);
          if (!alt) { go('put-travel', { type: 'warn', text: 'No free alternate bin anywhere. Use the directed bin or scan another bin and override.' }); return; }
          const old = t.bin;
          t.bin = alt;
          t.exceptions.push(`${oc}: Bin ${old} blocked, moved to ${alt} (outside storage type)`);
          save();
          go('put-travel', { type: 'warn', text: `Override ${oc}: storage type rule skipped. New destination: ${alt}.` });
        }
      });
      return;
    }
    const old = t.bin;
    t.bin = options[0];
    t.exceptions.push(`Bin ${old} blocked, moved to ${t.bin}`);
    save();
    flash('info', `${old} marked blocked. New destination: ${t.bin}.`);
  }

  function confirmPutaway(serialRaw) {
    const t = S.cur;
    // IT moment: serialised product - RF won't confirm without serial capture
    const si = itIssue('SERIAL', t.sku);
    if (si && !t.serial) {
      if (!itFixed('SERIAL')) {
        rfError('SERIAL', `SERIAL REQUIRED · ${t.product || t.sku} is serialised. The RF can't confirm putaway without a serial number.`);
        return;
      }
      const sn = String(serialRaw == null ? '' : serialRaw).trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{3,29}$/.test(sn)) {
        flash('error', `Scan or key the serial number from the product label (e.g. ${si.example}).`);
        return;
      }
      t.serial = sn;
    }
    t.status = 'PUTAWAY';
    t.putawayAt = Date.now();
    t.wtDoc = nextDoc('PT');
    save();
    okBeep();
    go('put-done');
  }

  /* ---------------- picking + pack (outbound, from the film) ---------------- */
  const OB = D.outbound || null;
  const WAVE = 'W-0901';

  /** Pick tasks for both orders (or one), in bin order like the printed pick list. */
  function pickTasks(so) {
    if (!OB) return [];
    const out = [];
    OB.orders.forEach((o) => o.lines.filter((l) => !l.service).forEach((l) => {
      const a = D.asn.find((x) => x.sku === l.sku) || {};
      const dest = l.vas ? { code: 'FAB-01', kind: 'FAB', what: `Fabrication ${l.vas} – ${l.desc || 'cut to order'}` }
        : l.hu ? { code: l.hu, kind: 'STAGE', what: 'Staging – ships in its own carton' }
          : { code: o.hu, kind: 'PACK', what: `Pack carton ${o.hu}` };
      out.push({ id: `${o.so}-${l.line}`, so: o.so, line: l.line, carrier: o.carrier, route: o.route, sku: l.sku,
        product: a.product || l.sku, desc: a.desc || l.sku, qty: l.qty, uom: l.uom, bin: a.bin || '-', hazmat: !!a.hazmat, dest });
    }));
    return out.filter((t) => !so || t.so === so).sort((x, y) => x.bin.localeCompare(y.bin));
  }
  const openPicks = (so) => pickTasks(so).filter((t) => !S.picks[t.id]);
  const pickCur = () => (S.pick ? S.pick.cur : null);

  function startPick(so) {
    const tasks = openPicks(so);
    if (!tasks.length) { flash('info', so ? `${so} is fully picked.` : `Wave ${WAVE} is fully picked.`); return; }
    S.cur = null;
    S.pick = { so: so || null, tasks, idx: 0, cur: Object.assign({}, tasks[0], { exceptions: [], productOk: false, picked: tasks[0].qty }) };
    okBeep();
    go('pick-travel');
  }

  function handlePickBin(code) {
    const t = pickCur();
    if (norm(code) !== norm(t.bin)) {
      flash('error', `Wrong bin! You scanned ${code}. Pick ${t.product} from ${t.bin}.`, { kind: 'GENERAL', note: `Wrong pick bin ${code} for ${t.id}` });
      return;
    }
    // IT moment (film): stock in cases but the order is in eaches, and no conversion yet
    const uom = itIssue('UOM', t.sku);
    if (uom && t.uom === 'EA' && !itFixed('UOM')) {
      rfError('UOM', `UNIT ERROR · ${t.product}: stock in ${t.bin} is in CS, ${t.so} needs ${t.qty} EA · no CS→EA conversion in the product master.`);
      return;
    }
    // IT moment (film IT 5): the battery bin is empty, IT triggers replenishment
    const rep = itIssue('REPLEN', t.sku);
    if (rep && !itFixed('REPLEN')) {
      rfError('REPLEN', `BIN EMPTY · ${t.bin} shows 0 ${t.uom} of ${t.product}. ${t.qty} ${t.uom} needed for ${t.so}. Pick can't continue.`);
      return;
    }
    okBeep();
    go('pick-item', { type: 'ok', text: `Bin ${t.bin} verified.` });
  }

  function handlePickProduct(code) {
    const t = pickCur();
    code = stripAi(code);
    const ok = norm(code) === norm(t.sku) || D.asn.some((a) => a.sku === t.sku && (norm(a.lpn) === norm(code) || (a.upc && norm(a.upc) === norm(code))));
    if (!ok) { flash('error', `Wrong product! You scanned ${code}. Pick ${t.product} (${t.sku}).`, { kind: 'GENERAL', note: `Wrong product ${code} for ${t.id}` }); return; }
    t.productOk = true;
    okBeep();
    go('pick-item', { type: 'ok', text: `${t.product} confirmed. Enter the quantity picked.` });
  }

  function confirmPickQty(raw) {
    const t = pickCur();
    const txt = String(raw == null ? '' : raw).trim();
    const q = Number.parseInt(txt, 10);
    if (!/^\d{1,4}$/.test(txt) || q > t.qty) { flash('error', `Enter the quantity picked: 0 to ${t.qty} ${t.uom}.`); return; }
    t.picked = q;
    if (q < t.qty) t.exceptions.push(`Short pick ${t.qty - q} ${t.uom}`);
    okBeep();
    if (q === 0) { recordPick(); return; }
    go('pick-drop');
  }

  function handlePickDrop(code) {
    const t = pickCur();
    if (norm(code) !== norm(t.dest.code)) {
      flash('error', `Wrong drop point! You scanned ${code}. Drop ${t.product} at ${t.dest.code}.`, { kind: 'GENERAL', note: `Wrong drop ${code} for ${t.id}` });
      return;
    }
    recordPick();
  }

  function recordPick() {
    const t = pickCur();
    S.picks[t.id] = { qty: t.picked, need: t.qty, uom: t.uom, short: t.picked < t.qty, bin: t.bin, dest: t.dest.code,
      exceptions: t.exceptions.slice(), user: S.operator, at: Date.now() };
    store.set('picks', S.picks);
    okBeep();
    S.pick.idx += 1;
    const next = S.pick.tasks[S.pick.idx];
    if (!next) { go('pick-done'); return; }
    S.pick.cur = Object.assign({}, next, { exceptions: [], productOk: false, picked: next.qty });
    go('pick-travel', { type: 'ok', text: `Picked ${t.picked} ${t.uom} ${t.product} → ${t.dest.code}. Next: ${next.product} from ${next.bin}.` });
  }

  /** Cartons to close at pack: each order's packed carton (own-carton items are already closed). */
  function packHus() {
    if (!OB) return [];
    return OB.orders.map((o) => {
      const lines = o.lines.filter((l) => !l.service && !l.hu);
      const ids = lines.map((l) => `${o.so}-${l.line}`);
      const vas = lines.filter((l) => l.vas).map((l) => l.vas);
      return { hu: o.hu, so: o.so, carrier: o.carrier, ids, vas, picked: ids.every((id) => S.picks[id]) };
    });
  }

  function confirmFab(vasId) {
    S.pack['FAB:' + vasId] = { done: true, user: S.operator, at: Date.now() };
    store.set('pack', S.pack);
    okBeep();
    go('pack', { type: 'ok', text: `${vasId} signed off: cardboard cut to 8 cm and placed in the carton.` });
  }

  function closeCarton(hu) {
    const x = packHus().find((p) => p.hu === hu);
    if (!x || !x.picked) { flash('error', `${hu} isn't fully picked yet.`); return; }
    const fabOpen = x.vas.find((v) => !(S.pack['FAB:' + v] && S.pack['FAB:' + v].done));
    if (fabOpen) { flash('error', `${hu} is waiting for fabrication ${fabOpen}. Confirm the cut first.`); return; }
    // IT moment (film IT 6): the carton won't close – no packaging specification
    const np = itIssue('NOPACK');
    if (np && np.hu === hu && !itFixed('NOPACK')) {
      rfError('NOPACK', `CAN'T CLOSE CARTON · ${hu} has no packaging specification, so EWM can't close the handling unit.`);
      return;
    }
    S.pack[hu] = Object.assign({}, S.pack[hu], { closed: true, user: S.operator, at: Date.now(), spec: np && np.hu === hu ? np.packSpec : 'PS-BOX-M' });
    store.set('pack', S.pack);
    okBeep();
    go('pack', { type: 'ok', text: `Carton ${hu} closed (${S.pack[hu].spec}). Ready for the ${x.carrier} label.` });
  }

  /* ---------------- screens ---------------- */
  const SCREENS = {
    login() {
      const input = h('input', {
        class: 'scan-input login-input', type: 'text', autocomplete: 'username', autocapitalize: 'none',
        spellcheck: 'false', maxlength: '30', placeholder: 'e.g. jsmith', 'aria-label': 'User name',
        id: 'login-user', 'data-autofocus': true
      });
      const submit = () => signIn(input.value);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      return {
        title: 'Sign In', step: null, back: 'login',
        body: [
          h('div', { class: 'login-hero' },
            h('div', { class: 'login-icon' }, icon('box')),
            h('h2', null, 'RF Receiving & Putaway'),
            h('p', null, D.site.name)),
          h('div', { class: 'scan-block' },
            h('label', { class: 'field-label', for: 'login-user' }, 'User name'),
            input),
          h('button', { class: 'btn btn-dark btn-xl', type: 'button', onclick: submit }, 'Sign in'),
          h('p', { class: 'muted' }, 'No password needed. Your name is shown on the device and stamped on the transactions you do on this phone.')
        ]
      };
    },

    home() {
      const open = openTasks().length;
      const items = [
        { n: '1', t: 'Inbound Receiving', s: 'Receive by pallet SSCC label', act: () => go('rcv-scan') },
        { n: '2', t: 'Putaway', s: open ? 'Directed putaway to bin' : 'No open putaway tasks', count: open, act: () => go('put-list') },
        { n: '3', t: 'Activity Log', s: `${S.tasks.length} transaction(s) on this device`, act: () => go('log') },
        { n: '4', t: 'Share this RF app', s: 'QR code & link for others', act: () => go('share') },
        { n: '5', t: 'Print test labels', s: 'ASN, pallet, carton & bin labels', act: () => { window.location.href = 'labels.html'; } },
        { n: '6', t: 'Outbound documents', s: 'Sales orders, Descartes routes, pick, VAS, labels', act: () => { window.location.href = 'outbound.html'; } },
        { n: '7', t: 'Picking & pack', s: OB ? `Wave ${WAVE} · ${OB.orders.map((o) => o.so).join(', ')}` : 'No outbound orders',
          count: openPicks().length, disabled: !OB, act: () => go('pick-list') },
        { n: '8', t: 'Cycle Count', s: 'Coming soon', disabled: true }
      ];
      SCREENS.home.items = items;
      return {
        title: 'Main Menu', step: null, back: 'home',
        body: [
          h('div', { class: 'card' },
            kv([
              ['Site', D.site.name],
              ['User', h('span', { class: 'user-row' },
                h('b', null, S.operator),
                h('button', { class: 'btn btn-link btn-inline', type: 'button', onclick: signOut }, 'Sign out'))],
              ['Inbound', `${D.asnId} at ${D.site.dock}`]
            ])),
          h('ul', { class: 'menu' }, items.map((it) =>
            h('li', null, h('button', { type: 'button', disabled: !!it.disabled, onclick: it.act },
              h('span', { class: 'num' }, it.n),
              h('span', null, h('span', { class: 't' }, it.t), h('span', { class: 's' }, it.s)),
              it.count ? h('span', { class: 'count' }, it.count) : h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))))),
          h('p', { class: 'muted' }, 'Tip: press the menu number on a keyboard / RF keypad. Demo app – data stays on this device.')
        ]
      };
    },

    'rcv-scan'() {
      const received = S.tasks.filter((t) => D.asn.some((a) => norm(a.lpn) === norm(t.lpn))).length;
      const sh = D.shipment || {};
      return {
        title: 'Receive Pallet', step: 0, back: 'home',
        body: [
          h('div', { class: 'card' },
            h('p', { class: 'card-title' }, 'Open inbound delivery'),
            kv([
              ['ASN', mono(D.asnId)],
              ['Vendor', sh.vendor ? sh.vendor.name : null],
              ['PO', sh.po ? mono(sh.po) : null],
              ['Truck', sh.truck ? `${sh.truck.trailer} · ${(sh.pallets || []).length} pallets` : null],
              ['Due', sh.deliveryDate || null],
              ['Dock', mono(D.site.dock)],
              ['Cartons', `${received} of ${D.asn.length} received`]
            ]),
            (sh.pallets || []).map((p) => {
              const lines = D.asn.filter((a) => a.pallet === p.no);
              const got = lines.filter((a) => findTask(a.lpn)).length;
              return h('div', { class: 'pallet-group' + (S.palletFocus === p.no ? ' focus' : '') },
                h('div', { class: 'pallet-head' },
                  h('b', null, `Pallet ${p.no}`), h('span', { class: 'mono small' }, `…${p.sscc.slice(-6)}`),
                  h('span', { class: 'small' }, `${got}/${lines.length}`)),
                h('ul', { class: 'carton-list' }, lines.map((a) => {
                  const done = !!findTask(a.lpn);
                  return h('li', { class: done ? 'done' : null },
                    h('span', { class: 'tick', 'aria-hidden': 'true' }, done ? '✓' : '○'),
                    h('span', null, `${a.product} · ${a.qty} ${a.uom}`),
                    h('span', { class: 'mono small' }, `…${a.lpn.slice(-6)}`));
                })));
            })),
          h('p', { class: 'hint' }, 'Scan the SSCC on the pallet label. The whole pallet is received in one goods receipt; each carton is then put away by its HU.'),
          scanField({
            label: 'Scan pallet SSCC',
            placeholder: 'Scan or key pallet SSCC',
            onScan: handleReceiveScan,
            simulate: () => {
              const nextPal = palletsOf().find((p) => D.asn.some((a) => a.pallet === p.no && !findTask(a.lpn)));
              if (nextPal) return nextPal.sscc;
              const next =
                D.asn.find((a) => !findTask(a.lpn));
              return next ? next.lpn : D.unknownLpn;
            }
          })
        ]
      };
    },

    'rcv-pallet'() {
      const pal = palletsOf().find((p) => p.no === S.rcvPallet);
      const lines = D.asn.filter((a) => a.pallet === pal.no);
      const todo = lines.filter((a) => !findTask(a.lpn));
      const sh = D.shipment || {};
      const expText = (a) => {
        const u = itIssue('UOM', a.sku);
        return u && itFixed('UOM') ? `${a.qty} ${a.uom} (= ${a.qty * u.eaPerCase} EA)` : `${a.qty} ${a.uom}`;
      };
      return {
        title: 'Receive Pallet', step: 1, back: 'rcv-scan',
        body: [
          h('div', { class: 'card' },
            h('p', { class: 'card-title' }, `Pallet ${pal.no} of ${palletsOf().length}`),
            kv([
              ['Pallet SSCC', mono(pal.sscc)],
              ['ASN / PO', `${D.asnId} · ${sh.po || '-'}`],
              ['Vendor', sh.vendor ? sh.vendor.name : null],
              ['Weight', pal.weight || null],
              ['Cartons', `${todo.length} to receive${todo.length < lines.length ? ` (${lines.length - todo.length} already received)` : ''}`]
            ]),
            h('ul', { class: 'carton-list' }, lines.map((a) => {
              const done = !!findTask(a.lpn);
              return h('li', { class: done ? 'done' : null },
                h('span', { class: 'tick', 'aria-hidden': 'true' }, done ? '✓' : '○'),
                h('span', null, `${a.product} · ${expText(a)}${a.hazmat ? ' · HAZMAT' : ''}`),
                h('span', { class: 'mono small' }, `HU …${a.lpn.slice(-6)}`));
            }))),
          h('p', { class: 'hint' }, 'Check the pallet against the ASN, then confirm. All cartons are received in one goods receipt; no carton scans are needed.'),
          h('button', { class: 'btn btn-dark btn-xl', type: 'button', onclick: confirmPalletReceipt },
            icon('check', 3), `Confirm pallet receipt (${todo.length} cartons)`)
        ]
      };
    },

    'rcv-pallet-done'() {
      const r = S.rcvDone;
      const ts = r.ids.map((id) => findTask(id)).filter(Boolean);
      const blocked = ts.filter((t) => !t.bin);
      return {
        title: 'Receiving Complete', step: 3, back: 'home',
        body: [
          hero('Pallet received', `Goods receipt ${r.gr} posted · pallet ${r.pallet} · ${ts.length} cartons`),
          h('div', { class: 'card' },
            h('p', { class: 'card-title' }, 'Putaway tasks created – one per carton HU'),
            h('ul', { class: 'carton-list' }, ts.map((t) => h('li', null,
              h('span', { class: 'tick', 'aria-hidden': 'true' }, '→'),
              h('span', null, `${t.product} · ${qtyText(t, t.qtyRcv)}`),
              h('span', { class: t.bin ? 'mono small' : 'mono small nobin-text' }, t.bin || 'NO BIN'))))),
          h('div', { class: 'next' },
            h('p', { class: 'card-title' }, 'Next step · Putaway'),
            h('p', { class: 'hint' }, blocked.length
              ? `Put away each carton by scanning its HU. ${blocked.map((t) => t.product).join(', ')} has no bin yet – call IT first.`
              : 'Put away each carton: scan its HU, then the product UPC, confirm the qty and scan the destination bin.')),
          h('button', { class: 'btn btn-primary btn-xl', type: 'button',
            onclick: () => go('put-list', { type: 'info', text: 'Scan the HU label on a carton to start its putaway.' }) },
          icon('pin'), 'Start putaway'),
          palletsOf().some((p) => D.asn.some((a) => a.pallet === p.no && !findTask(a.lpn))) &&
            h('button', { class: 'btn btn-outline btn-xl', type: 'button', onclick: () => go('rcv-scan') }, icon('box'), 'Receive next pallet')
        ]
      };
    },

    'rcv-unknown'() {
      return {
        title: 'Exception', step: 0, back: 'rcv-scan',
        body: [
          h('div', { class: 'msg error', role: 'alert' }, `${idKey(S.pendingLpn)} ${S.pendingLpn} is not on open ${D.asnId}.`),
          h('p', { class: 'hint' }, 'Check the label and rescan. If the carton is genuinely extra, blind-receive it to QA hold for investigation.'),
          h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('rcv-scan') }, 'Rescan carton'),
          h('button', { class: 'btn btn-outline btn-xl', type: 'button', onclick: blindReceive }, 'Blind receive to QA hold'),
          overrideBlock(unknownLpnOverride())
        ]
      };
    },

    'rcv-verify'() {
      const t = S.cur;
      const qtyInput = h('input', {
        class: 'qty-input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4',
        value: String(t.qtyRcv), 'aria-label': 'Received quantity'
      });
      qtyInput.addEventListener('input', () => {
        qtyInput.value = qtyInput.value.replace(/\D/g, '').slice(0, 4);
        t.qtyRcv = qtyInput.value;
      });
      qtyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmReceipt(qtyInput.value); } });
      const step = (d) => {
        const n = Math.min(9999, Math.max(0, (Number.parseInt(qtyInput.value, 10) || 0) + d));
        qtyInput.value = String(n);
        t.qtyRcv = n;
      };
      const setCond = (c) => { t.condition = c; render(); };
      return {
        title: 'Verify Receipt', step: 1, back: 'rcv-scan',
        body: [
          itemCard(t, [['Expected', t.blind ? 'Not on ASN'
            : (itIssue('UOM', t.sku) && itFixed('UOM')
              ? `${qtyText(t, t.qtyExp)} (= ${t.qtyExp * itIssue('UOM', t.sku).eaPerCase} EA)`
              : qtyText(t, t.qtyExp))]]),
          h('div', { class: 'scan-block' },
            h('label', { class: 'field-label' }, `Received quantity (${t.uom})`),
            h('div', { class: 'qty-row' },
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-label': 'Decrease', onclick: () => step(-1) }, '−'),
              qtyInput,
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-label': 'Increase', onclick: () => step(1) }, '+'))),
          h('div', { class: 'scan-block' },
            h('span', { class: 'field-label' }, 'Carton condition'),
            h('div', { class: 'seg', role: 'group', 'aria-label': 'Carton condition' },
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-pressed': String(t.condition === 'GOOD'), onclick: () => setCond('GOOD') }, 'Good'),
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-pressed': String(t.condition === 'DAMAGED'), onclick: () => setCond('DAMAGED') }, 'Damaged'))),
          t.condition === 'DAMAGED' && h('div', { class: 'msg warn' }, `Damaged cartons are directed to ${D.qaBin}.`),
          h('button', { class: 'btn btn-dark btn-xl', type: 'button', onclick: () => confirmReceipt(qtyInput.value) },
            icon('check', 3), 'Confirm receipt')
        ]
      };
    },

    'rcv-done'() {
      const t = S.cur;
      return {
        title: 'Receiving Complete', step: 3, back: 'home',
        body: [
          hero('Receiving complete', `Goods receipt ${t.grDoc} posted`),
          h('div', { class: 'card' },
            kv([
              [idKey(t.lpn), mono(t.lpn)],
              ['Item', t.desc],
              ['Received', qtyText(t, t.qtyRcv)],
              ['Condition', t.condition === 'GOOD' ? 'Good' : 'Damaged'],
              ['At', `${D.site.dock} · ${fmtTime(t.receivedAt)}`],
              t.exceptions.length ? ['Exceptions', h('span', { class: 'pill exc' }, t.exceptions.join(', '))] : null
            ].filter(Boolean))),
          t.bin
            ? h('div', { class: 'next' },
              h('p', { class: 'card-title' }, 'Next step · Putaway'),
              h('p', { class: 'hint' }, 'Move the carton to bin ', h('b', { class: 'mono' }, t.bin), '.'))
            : h('div', { class: 'next' },
              h('p', { class: 'card-title' }, 'Next step · Putaway blocked'),
              h('p', { class: 'hint' }, 'No destination bin yet. Call IT to find a bin, then start putaway.')),
          t.bin && h('button', { class: 'btn btn-primary btn-xl', type: 'button',
            onclick: () => { S.putHint = t.lpn; go('put-list', { type: 'info', text: `Scan HU ${t.lpn} to start putaway.` }); } },
          icon('pin'), 'Start putaway'),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => go('home') }, 'Put away later')
        ]
      };
    },

    'put-list'() {
      const open = openTasks();
      return {
        title: 'Putaway', step: null, back: 'home',
        body: [
          h('p', { class: 'hint' }, 'Scan the HU label on the carton to start putaway.'),
          scanField({ label: 'Scan HU', placeholder: 'Scan or key HU', onScan: handlePutawayLpn,
            simulate: open.length ? () => ((open.find((x) => x.lpn === S.putHint) || open[0]).lpn) : null }),
          h('p', { class: 'card-title' }, `Open tasks (${open.length})`),
          open.length
            ? h('ul', { class: 'list' }, open.map((t) =>
              h('li', null, h('button', { class: 'list-btn', type: 'button', onclick: () => handlePutawayLpn(t.lpn) },
                h('div', { class: 'row' }, h('span', { class: 'lpn' }, t.lpn), h('span', { class: t.bin ? 'bin' : 'bin nobin' }, t.bin || 'NO BIN')),
                h('div', { class: 'desc' }, `${t.desc} · ${qtyText(t, t.qtyRcv)}`)))))
            : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No cartons waiting for putaway. Receive a carton first.'),
              h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('rcv-scan') }, 'Go to receiving'))
        ]
      };
    },

    'put-travel'() {
      const t = S.cur;
      if (!t.bin) {
        const nb = itIssue('NOBIN', t.sku);
        return {
          title: 'Putaway', step: 3, back: 'put-list',
          body: [
            !S.itCall && h('div', { class: 'msg error', role: 'alert' }, noBinText(t, nb)),
            !S.itCall && itCallBlock('NOBIN'),
            h('div', { class: 'location nobin' },
              h('div', { class: 'loc-cap' }, 'Take carton to bin'),
              h('div', { class: 'big' }, 'NO BIN')),
            h('div', { class: 'card' },
              h('div', { class: 'item-title' }, t.desc),
              kv([[idKey(t.lpn), mono(t.lpn)], ['Qty', qtyText(t, t.qtyRcv)]]))
          ]
        };
      }
      // Steps from the HU-based putaway flow: 1 scan UPC, 2 confirm qty, 3 scan destination bin
      if (!t.upc) t.upcOk = true;
      const stepNo = !t.upcOk ? 1 : !t.qtyOk ? 2 : 3;
      const steps = h('ol', { class: 'put-steps' },
        [['Scan HU', true], ['Scan UPC', t.upcOk], ['Confirm qty', t.qtyOk], ['Scan bin', false]].map(([label, ok], i) =>
          h('li', { class: ok ? 'ok' : (i === stepNo ? 'cur' : null) }, label)));
      let action;
      if (!t.upcOk) {
        action = [
          h('p', { class: 'hint' }, `Scan the product UPC on the ${t.product || 'product'}.`),
          scanField({ label: 'Scan product UPC', placeholder: 'Scan or key UPC', onScan: handlePutUpc,
            // a product whose case carries only the vendor EAN "scans" that EAN
            simulate: () => { const e = (D.itIssues || []).find((i) => i.id === 'EAN' && norm(i.sku) === norm(t.sku)); return e ? e.ean : t.upc; } })
        ];
      } else if (!t.qtyOk) {
        const qtyInput = h('input', {
          class: 'qty-input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4',
          value: String(t.qtyRcv), 'aria-label': 'Putaway quantity', 'data-autofocus': true
        });
        qtyInput.addEventListener('input', () => { qtyInput.value = qtyInput.value.replace(/\D/g, '').slice(0, 4); });
        qtyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmPutQty(qtyInput.value); } });
        action = [
          h('div', { class: 'scan-block' },
            h('label', { class: 'field-label' }, `Quantity (${t.uom}) – HU holds ${t.qtyRcv}`),
            qtyInput),
          h('button', { class: 'btn btn-dark btn-xl', type: 'button', onclick: () => confirmPutQty(qtyInput.value) }, icon('check', 3), 'Confirm quantity')
        ];
      } else {
        action = [
          h('p', { class: 'hint' }, 'At the location, scan the destination bin label.'),
          scanField({ label: 'Scan destination bin', placeholder: 'Scan or key bin', onScan: handleBinScan, simulate: () => t.bin }),
          h('button', { class: 'btn btn-link', type: 'button', onclick: alternateBin }, 'Bin full or blocked? Get alternate bin')
        ];
      }
      return {
        title: 'Putaway', step: 3, back: 'put-list',
        body: [
          steps,
          locPanel(t.bin, 'Destination bin'),
          h('div', { class: 'route' }, h('span', null, D.site.dock), h('span', { class: 'arrow' }, '→'), h('span', null, t.bin)),
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, t.desc),
            kv([[idKey(t.lpn), mono(t.lpn)], ['UPC', t.upc ? mono(t.upc) : null], ['Qty', qtyText(t, t.qtyRcv)],
              ['Handling', t.hazmat ? h('span', { class: 'pill exc' }, 'HAZMAT – segregate') : null]])),
          action
        ]
      };
    },

    'put-confirm'() {
      const t = S.cur;
      const si = itIssue('SERIAL', t.sku);
      let serialInput = null;
      if (si && !t.serial && itFixed('SERIAL')) {
        serialInput = h('input', {
          class: 'scan-input', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
          maxlength: '30', placeholder: `e.g. ${si.example}`, 'aria-label': 'Serial number', 'data-autofocus': true
        });
        serialInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmPutaway(serialInput.value); } });
      }
      return {
        title: 'Confirm Putaway', step: 4, back: 'put-travel',
        body: [
          !S.msg && h('div', { class: 'msg ok' }, `Bin ${t.bin} verified.`),
          si && !t.serial && !serialInput && h('div', { class: 'msg warn' }, 'Serialised product: a serial number is needed to confirm.'),
          serialInput && h('div', { class: 'scan-block' },
            h('label', { class: 'field-label' }, 'Serial number (serial capture)'),
            serialInput,
            h('button', { class: 'btn btn-link', type: 'button', onclick: () => confirmPutaway(si.example) }, `No label handy? Use ${si.example}`)),
          locPanel(t.bin, 'Place carton in bin'),
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, t.desc),
            kv([
              [idKey(t.lpn), mono(t.lpn)],
              ['Qty', qtyText(t, t.qtyRcv)],
              ['From', mono(D.site.dock)],
              ['To', mono(t.bin)]
            ])),
          h('button', { class: 'btn btn-ok btn-xl', type: 'button', onclick: () => confirmPutaway(serialInput ? serialInput.value : null) },
            icon('check', 3), 'Confirm putaway complete')
        ]
      };
    },

    'put-done'() {
      const t = S.cur;
      const open = openTasks();
      return {
        title: 'Putaway Complete', step: 6, back: 'home',
        body: [
          hero('Putaway complete', `Putaway task ${t.wtDoc} confirmed`),
          h('div', { class: 'card' },
            kv([
              [idKey(t.lpn), mono(t.lpn)],
              ['Item', t.desc],
              ['Qty', qtyText(t, t.qtyRcv)],
              ['Bin', mono(t.bin)],
              ['Serial', t.serial ? mono(t.serial) : null],
              ['Dock-to-stock', fmtDuration(t.putawayAt - t.receivedAt)],
              t.exceptions.length ? ['Exceptions', h('span', { class: 'pill exc' }, t.exceptions.join(', '))] : null
            ].filter(Boolean))),
          open.length
            ? h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => { S.putHint = open[0].lpn; go('put-list', { type: 'info', text: 'Scan the HU label on the next carton.' }); } },
              icon('pin'), `Next putaway (${open.length} open)`)
            : null,
          h('button', { class: open.length ? 'btn btn-outline btn-xl' : 'btn btn-primary btn-xl', type: 'button', onclick: () => go('rcv-scan') },
            icon('box'), 'Receive next pallet'),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => go('home') }, 'Main menu')
        ]
      };
    },

    'pick-list'() {
      const all = pickTasks();
      const done = all.filter((t) => S.picks[t.id]).length;
      const resume = S.pick && S.pick.tasks[S.pick.idx];
      return {
        title: 'Picking', step: null, back: 'home',
        body: [
          h('div', { class: 'card' },
            h('p', { class: 'card-title' }, `Wave ${WAVE} · Descartes routes`),
            kv([['Orders', `${OB ? OB.orders.length : 0}`], ['Pick tasks', `${done} of ${all.length} picked`], ['Ship date', OB ? OB.orderDate : null]])),
          OB && OB.orders.map((o) => {
            const ts = pickTasks(o.so);
            const d = ts.filter((t) => S.picks[t.id]).length;
            return h('div', { class: 'card order-card ' + o.carrier.toLowerCase() },
              h('div', { class: 'row' }, h('b', null, o.so), h('span', { class: 'pill ' + (d === ts.length ? 'put' : 'rcv') }, `${d}/${ts.length} picked`)),
              h('div', { class: 'muted' }, `${o.customer.name} · ${o.service} · ${o.route} stop ${o.stop}/${o.stops}`),
              h('ul', { class: 'carton-list' }, ts.map((t) => h('li', { class: S.picks[t.id] ? 'done' : null },
                h('span', { class: 'tick', 'aria-hidden': 'true' }, S.picks[t.id] ? '✓' : '○'),
                h('span', null, `${t.product} · ${t.qty} ${t.uom} → ${t.dest.code}`),
                h('span', { class: 'mono small' }, t.bin)))),
              d < ts.length && h('button', { class: 'btn btn-outline', type: 'button', onclick: () => startPick(o.so) }, `Pick ${o.so} only`));
          }),
          resume && h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('pick-travel') }, icon('pin'), `Resume – ${resume.product} at ${resume.bin}`),
          done < all.length && h('button', { class: resume ? 'btn btn-outline btn-xl' : 'btn btn-primary btn-xl', type: 'button', onclick: () => startPick(null) },
            icon('box'), `Start wave ${WAVE} – both orders`),
          h('button', { class: done === all.length ? 'btn btn-primary btn-xl' : 'btn btn-outline btn-xl', type: 'button', onclick: () => go('pack') }, 'Go to pack station'),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => { window.location.href = 'outbound.html'; } }, 'Print pick list & labels')
        ]
      };
    },

    'pick-travel'() {
      const t = pickCur();
      return {
        title: 'Pick', step: null, back: 'pick-list',
        body: [
          h('p', { class: 'card-title' }, `Task ${S.pick.idx + 1} of ${S.pick.tasks.length} · ${t.so} / line ${t.line}`),
          locPanel(t.bin, 'Pick from bin'),
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, t.desc),
            kv([
              ['SKU', mono(t.sku)],
              ['Pick qty', h('b', null, `${t.qty} ${t.uom}`)],
              ['Order', `${t.so} · ${t.carrier} ${t.route}`],
              ['Drop at', `${t.dest.code} – ${t.dest.what}`],
              ['Handling', t.hazmat ? h('span', { class: 'pill exc' }, 'HAZMAT') : null]
            ])),
          h('p', { class: 'hint' }, 'Go to the bin and scan the bin label.'),
          scanField({ label: 'Scan pick bin', placeholder: 'Scan or key bin', onScan: handlePickBin, simulate: () => t.bin })
        ]
      };
    },

    'pick-item'() {
      const t = pickCur();
      const uomNote = itIssue('UOM', t.sku) && t.uom === 'EA'
        ? `Stock is in cases (1 CS = ${itIssue('UOM', t.sku).eaPerCase} EA). Open the case and take ${t.qty} EA.` : null;
      let body;
      if (!t.productOk) {
        body = [
          h('p', { class: 'hint' }, `Scan the ${t.product} product barcode (or its carton label).`),
          scanField({ label: 'Scan product', placeholder: 'Scan or key SKU', onScan: handlePickProduct, simulate: () => t.sku })
        ];
      } else {
        const qtyInput = h('input', {
          class: 'qty-input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4',
          value: String(t.picked), 'aria-label': 'Quantity picked', 'data-autofocus': true
        });
        qtyInput.addEventListener('input', () => { qtyInput.value = qtyInput.value.replace(/\D/g, '').slice(0, 4); });
        qtyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmPickQty(qtyInput.value); } });
        body = [
          h('div', { class: 'scan-block' },
            h('label', { class: 'field-label' }, `Quantity picked (${t.uom}) – need ${t.qty}`),
            qtyInput),
          h('button', { class: 'btn btn-dark btn-xl', type: 'button', onclick: () => confirmPickQty(qtyInput.value) }, icon('check', 3), 'Confirm pick')
        ];
      }
      return {
        title: 'Pick', step: null, back: 'pick-travel',
        body: [
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, `${t.product} · ${t.qty} ${t.uom}`),
            kv([['Bin', mono(t.bin)], ['SKU', mono(t.sku)], ['Order', `${t.so} / ${t.line}`]])),
          uomNote && h('div', { class: 'msg info' }, uomNote),
          body
        ]
      };
    },

    'pick-drop'() {
      const t = pickCur();
      return {
        title: 'Pick · Drop', step: null, back: 'pick-item',
        body: [
          h('div', { class: 'location' },
            h('div', { class: 'loc-cap' }, t.dest.kind === 'FAB' ? 'Take to fabrication' : t.dest.kind === 'STAGE' ? 'Take to staging' : 'Drop into carton'),
            h('div', { class: 'big' }, t.dest.code),
            h('div', { class: 'loc-type' }, t.dest.what)),
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, `${t.product} · ${t.picked} ${t.uom}`),
            kv([['From', mono(t.bin)], ['Order', `${t.so} / ${t.line}`], ['Carrier', `${t.carrier} · ${t.route}`]])),
          h('p', { class: 'hint' }, 'Scan the drop label to confirm.'),
          scanField({ label: 'Scan drop label', placeholder: 'Scan or key drop point', onScan: handlePickDrop, simulate: () => t.dest.code })
        ]
      };
    },

    'pick-done'() {
      const ts = S.pick ? S.pick.tasks : [];
      return {
        title: 'Picking Complete', step: null, back: 'pick-list',
        body: [
          hero('Picking complete', S.pick && S.pick.so ? `${S.pick.so} picked` : `Wave ${WAVE} picked`),
          h('div', { class: 'card' },
            h('ul', { class: 'ovr-log' }, ts.map((t) => {
              const p = S.picks[t.id] || {};
              return h('li', null,
                h('b', null, `${t.product} ${p.qty != null ? p.qty : '-'}/${t.qty} ${t.uom}`),
                h('span', null, ` → ${t.dest.code} · ${t.so}`),
                p.exceptions && p.exceptions.length ? h('div', { class: 'muted' }, p.exceptions.join(' · ')) : null);
            }))),
          h('div', { class: 'next' },
            h('p', { class: 'card-title' }, 'Next steps'),
            h('p', { class: 'hint' }, 'Cardboard at FAB-01 is cut to 8 cm (FAB-0001), then packed with the bulbs and batteries. Then close each carton at the pack station.')),
          h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('pack') }, icon('box'), 'Go to pack station'),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => go('pick-list') }, 'Back to pick list')
        ]
      };
    },

    pack() {
      const hus = packHus();
      return {
        title: 'Pack Station', step: null, back: 'pick-list',
        body: [
          h('p', { class: 'hint' }, 'Confirm fabrication, then close each carton so it can get its carrier label.'),
          hus.map((x) => {
            const closed = S.pack[x.hu] && S.pack[x.hu].closed;
            const fabs = x.vas.map((v) => {
              const vd = (OB.vas || []).find((w) => w.id === v);
              const ok = S.pack['FAB:' + v] && S.pack['FAB:' + v].done;
              return h('div', { class: 'fab-row' },
                h('span', null, ok ? `✓ ${v} cut to ${vd ? vd.requiredCm : '?'} cm` : `${v}: cut cardboard to ${vd ? vd.requiredCm : '?'} cm at ${vd ? vd.workCenter : 'FAB'}`),
                !ok && x.picked && h('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => confirmFab(v) }, 'Confirm cut'));
            });
            return h('div', { class: 'card order-card ' + x.carrier.toLowerCase() },
              h('div', { class: 'row' }, h('b', null, `${x.hu} · ${x.so}`),
                h('span', { class: 'pill ' + (closed ? 'put' : x.picked ? 'rcv' : 'exc') }, closed ? 'Closed' : x.picked ? 'Picked – open' : 'Not picked')),
              fabs,
              S.pack[x.hu] && S.pack[x.hu].note && h('div', { class: 'muted' }, S.pack[x.hu].note),
              !closed && x.picked && h('button', { class: 'btn btn-dark', type: 'button', onclick: () => closeCarton(x.hu) }, `Close carton ${x.hu}`));
          }),
          OB && OB.orders.some((o) => (o.extraHus || []).length) && h('p', { class: 'muted' },
            `Own-carton items (${OB.orders.flatMap((o) => (o.extraHus || []).map((e) => e.hu)).join(', ')}) are staged and need only their carrier label.`),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => { window.location.href = 'outbound.html'; } }, 'Print carrier labels')
        ]
      };
    },

    'it-ticket'() {
      const t = S.ticket;
      const pill = t.status === 'RESOLVED' ? ['pill put', 'Resolved'] : t.status === 'WORKING' ? ['pill rcv', 'IT working'] : ['pill exc', 'Open'];
      return {
        title: 'IT Ticket', step: null, back: t.status === 'WORKING' ? 'it-ticket' : (t.returnTo || 'home'),
        body: [
          h('div', { class: 'msg error', role: 'alert' }, t.error),
          h('div', { class: 'card ticket' },
            h('div', { class: 'ticket-head' }, h('span', { class: 'ticket-id' }, t.id), h('span', { class: pill[0] }, pill[1])),
            h('div', { class: 'item-title' }, t.title),
            kv([
              ['Raised by', t.user],
              ['At', fmtTime(t.raisedAt)],
              ['Site', D.site.whn ? `${D.site.name} · WH ${D.site.whn}` : D.site.name],
              [t.refKey || idKey(t.lpn), t.lpn ? mono(t.lpn) : null],
              ['SKU', mono(t.sku)],
              ['Assigned', 'EWM IT team (demo)']
            ])),
          t.status === 'OPEN' && h('p', { class: 'hint' }, 'Hand the RF device to the IT team. IT reviews the ticket and applies the fix.'),
          t.status === 'OPEN' && h('button', { class: 'btn btn-it btn-xl', type: 'button', onclick: itWork }, icon('gear'), 'IT · Apply fix'),
          t.status === 'WORKING' && h('div', { class: 'it-working', role: 'status' },
            h('div', { class: 'gear-spin' }, icon('gear', 1.6)), h('p', null, 'IT is applying the fix…')),
          t.status === 'RESOLVED' && h('div', { class: 'stamp', role: 'status' }, 'RESOLVED'),
          t.status === 'RESOLVED' && h('div', { class: 'msg ok' }, t.fix),
          t.status === 'RESOLVED' && h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: itContinue },
            icon('check', 3), 'Continue')
        ]
      };
    },

    log() {
      const list = S.tasks.slice().sort((a, b) => (b.putawayAt || b.receivedAt) - (a.putawayAt || a.receivedAt));
      // In-app confirmation: some browsers (embedded panes, in-app browsers on phones)
      // block window.confirm(), which silently cancelled the clear.
      const clear = () => {
        S.confirmClear = false;
        S.tasks = [];
        S.cur = null;
        S.overrides = [];
        S.itFixes = {};
        S.itTickets = [];
        S.ticket = null;
        S.picks = {};
        S.pack = {};
        S.pick = null;
        store.remove('picks');
        store.remove('pack');
        store.remove('tasks');
        store.remove('overrides');
        store.remove('itFixes');
        store.remove('itTickets');
        ['seq', 'seq.GR', 'seq.PT', 'seq.INC'].forEach((k) => store.remove(k));
        go('log', { type: 'info', text: 'Demo data cleared.' });
      };
      return {
        title: 'Activity Log', step: null, back: 'home',
        body: [
          Object.keys(S.picks).length
            ? h('div', { class: 'card' },
              h('p', { class: 'card-title' }, `Picks – wave ${WAVE} (${Object.keys(S.picks).length})`),
              h('ul', { class: 'ovr-log' }, Object.entries(S.picks).sort((a, b) => b[1].at - a[1].at).map(([id, p]) =>
                h('li', null,
                  h('span', { class: p.short ? 'pill exc' : 'pill put' }, id),
                  h('span', null, ` ${p.qty}/${p.need} ${p.uom} · ${p.bin} → ${p.dest} · ${fmtTime(p.at)}${p.user ? ' · ' + p.user : ''}`),
                  p.exceptions && p.exceptions.length ? h('div', { class: 'muted' }, p.exceptions.join(' · ')) : null))))
            : null,
          S.itTickets.length
            ? h('div', { class: 'card' },
              h('p', { class: 'card-title' }, `IT tickets (${S.itTickets.length})`),
              h('ul', { class: 'ovr-log' }, S.itTickets.slice().reverse().map((x) =>
                h('li', null,
                  h('span', { class: x.status === 'RESOLVED' ? 'pill put' : 'pill exc' }, x.id),
                  h('span', null, ` ${x.title} · ${fmtTime(x.raisedAt)}${x.user ? ' · ' + x.user : ''}`),
                  h('div', { class: 'muted' }, x.fix ? `Fix: ${x.fix}` : 'Not resolved yet')))))
            : null,
          S.overrides.length
            ? h('div', { class: 'card' },
              h('p', { class: 'card-title' }, `Exception-code overrides (${S.overrides.length})`),
              h('ul', { class: 'ovr-log' }, S.overrides.slice().reverse().map((o) =>
                h('li', null,
                  h('span', { class: 'pill exc' }, o.code),
                  h('span', null, ` ${o.text} · ${fmtTime(o.at)}${o.user ? ' · ' + o.user : ''}`),
                  h('div', { class: 'muted' }, o.error)))))
            : null,
          list.length
            ? h('ul', { class: 'list' }, list.map((t) =>
              h('li', { class: 'card' },
                h('div', { class: 'row', style: null },
                  h('span', { class: t.status === 'PUTAWAY' ? 'pill put' : 'pill rcv' }, t.status === 'PUTAWAY' ? 'Put away' : 'Received'),
                  ' ', t.exceptions && t.exceptions.length ? h('span', { class: 'pill exc' }, 'Exception') : null),
                h('div', { class: 'item-title', style: null }, t.desc),
                kv([
                  [idKey(t.lpn), mono(t.lpn)],
                  ['Qty', qtyText(t, t.qtyRcv)],
                  ['Bin', t.bin ? mono(t.bin) : 'No bin yet'],
                  ['Serial', t.serial ? mono(t.serial) : null],
                  ['GR', t.grDoc ? `${t.grDoc} · ${fmtTime(t.receivedAt)}` : null],
                  ['Task', t.wtDoc ? `${t.wtDoc} · ${fmtTime(t.putawayAt)}` : null],
                  ['Notes', t.exceptions && t.exceptions.length ? t.exceptions.join(', ') : null],
                  ['User', t.operator ? mono(t.operator) : null]
                ]))))
            : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No transactions yet.')),
          !(list.length || S.overrides.length || S.itTickets.length || Object.keys(S.itFixes).length || Object.keys(S.picks).length || Object.keys(S.pack).length)
            ? null
            : S.confirmClear
              ? h('div', { class: 'card confirm-clear', role: 'alertdialog', 'aria-label': 'Confirm clear demo data' },
                h('p', { class: 'card-title' }, 'Clear all demo data on this device?'),
                h('p', { class: 'muted' }, 'This removes receipts, putaways, picks, pack status, IT tickets and fixes, and exception-code overrides. Your sign-in stays.'),
                h('button', { class: 'btn btn-dark btn-xl', type: 'button', onclick: clear }, 'Yes, clear everything'),
                h('button', { class: 'btn btn-outline btn-xl', type: 'button', onclick: () => { S.confirmClear = false; render(); } }, 'Cancel'))
              : h('button', { class: 'btn btn-outline btn-xl', type: 'button', onclick: () => { S.confirmClear = true; render(); } }, 'Clear demo data')
        ]
      };
    },

    share() {
      const url = window.location.origin + window.location.pathname;
      const box = h('div', { class: 'qr-box', role: 'img', 'aria-label': 'QR code linking to this app' });
      if (window.QRCode) {
        // eslint-disable-next-line no-new
        new window.QRCode(box, { text: url, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
      } else {
        box.append(h('p', { class: 'muted' }, 'QR library could not load.'));
      }
      const copy = () => {
        if (!navigator.clipboard) { flash('error', 'Copy not supported here. Long-press the link to copy.'); return; }
        navigator.clipboard.writeText(url).then(() => flash('ok', 'Link copied.'), () => flash('error', 'Could not copy the link.'));
      };
      const share = () => {
        navigator.share({ title: 'RF Receiving & Putaway', url }).catch(() => { /* user cancelled */ });
      };
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) || window.location.protocol === 'file:';
      return {
        title: 'Share RF App', step: null, back: 'home',
        body: [
          h('p', { class: 'hint' }, 'Anyone can scan this QR with their phone camera to open the RF device. They just enter a user name – no password.'),
          local && h('div', { class: 'msg warn' }, 'This is a local address – other phones cannot reach it. Host the app on an HTTPS URL first (see README).'),
          box,
          h('p', { class: 'url' }, url),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn-outline', type: 'button', onclick: copy }, 'Copy link'),
            navigator.share ? h('button', { class: 'btn btn-primary', type: 'button', onclick: share }, 'Share…') : null)
        ]
      };
    }
  };

  /* ---------------- render ---------------- */
  function render() {
    if (!S.operator) S.screen = 'login';
    else if (S.screen === 'login') S.screen = 'home';
    if (S.screen === 'it-ticket' && !S.ticket) S.screen = 'home';
    if (['pick-travel', 'pick-item', 'pick-drop'].includes(S.screen) && !pickCur()) S.screen = 'pick-list';
    if (S.screen === 'pick-done' && !S.pick) S.screen = 'pick-list';
    if (S.screen === 'rcv-pallet' && !S.rcvPallet) S.screen = 'rcv-scan';
    if (S.screen === 'rcv-pallet-done' && !S.rcvDone) S.screen = 'rcv-scan';
    const noCurNeeded = S.screen.startsWith('pick-') || S.screen === 'pack' || S.screen === 'rcv-pallet' || S.screen === 'rcv-pallet-done';
    const fn = SCREENS[S.screen] || SCREENS.home;
    if (S.screen !== 'login' && S.screen !== 'home' && S.screen !== 'rcv-scan' && S.screen !== 'put-list' && S.screen !== 'log' &&
        S.screen !== 'share' && S.screen !== 'rcv-unknown' && S.screen !== 'it-ticket' && !noCurNeeded && !S.cur) {
      S.screen = 'home';
      return render();
    }
    const v = fn();
    $('#title').textContent = v.title;
    document.title = `${v.title} · RF Device`;
    $('#sb-op').textContent = S.operator || 'NOT SIGNED IN';
    $('.fkeys').hidden = S.screen === 'login';

    const st = $('#stepper');
    if (v.step == null) {
      st.hidden = true;
    } else {
      st.hidden = false;
      st.replaceChildren(...STEPS.map((s, i) =>
        h('li', { class: i < v.step ? 'done' : (i === v.step ? 'cur' : null), 'aria-current': i === v.step ? 'step' : null }, s)));
    }

    const root = $('#screen');
    const kids = [];
    if (S.msg) kids.push(h('div', { class: 'msg ' + S.msg.type, role: S.msg.type === 'error' ? 'alert' : 'status' }, S.msg.text));
    if (S.msg && S.msg.type === 'error' && S.itCall) kids.push(itCallBlock(S.itCall));
    else if (S.msg && S.msg.type === 'error' && S.ovr) kids.push(overrideBlock(S.ovr));
    root.replaceChildren(...kids, ...v.body.flat().filter(Boolean));
    root.scrollTop = 0;
    S.back = v.back;

    const af = root.querySelector('[data-autofocus]');
    if (af && window.matchMedia('(pointer: fine)').matches) af.focus();
  }

  /* ---------------- chrome: status bar, keys ---------------- */
  function tick() {
    $('#sb-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  $('#sb-site').textContent = D.site.name.toUpperCase();
  tick();
  setInterval(tick, 15000);

  // Keep every open copy of the app in step: when another tab or window changes or
  // clears the demo data, reload it here so stale data is never written back.
  window.addEventListener('storage', (e) => {
    if (e.key !== null && (!e.key.startsWith('rf.') || e.key === 'rf.user')) return;
    S.tasks = loadTasks();
    S.overrides = loadOverrides();
    const fx = store.get('itFixes', {}); S.itFixes = fx && typeof fx === 'object' && !Array.isArray(fx) ? fx : {};
    const tk = store.get('itTickets', []); S.itTickets = Array.isArray(tk) ? tk.filter((x) => x && typeof x.id === 'string') : [];
    const pk = store.get('picks', {}); S.picks = pk && typeof pk === 'object' && !Array.isArray(pk) ? pk : {};
    const pa = store.get('pack', {}); S.pack = pa && typeof pa === 'object' && !Array.isArray(pa) ? pa : {};
    if (S.cur && !S.tasks.some((t) => t.id === S.cur.id) && S.screen !== 'rcv-verify') S.cur = null;
    if (S.pick && S.pick.cur && !Object.keys(S.picks).length && S.pick.idx > 0) S.pick = null;
    if (S.screen !== 'it-ticket') render();
  });

  $('#fk-back').addEventListener('click', back);
  $('#fk-menu').addEventListener('click', () => { S.cur = null; go('home'); });
  $('#cam-close').addEventListener('click', () => { closeCamera(); });

  document.addEventListener('keydown', (e) => {
    if (!$('#cam').hidden) {
      if (e.key === 'Escape') closeCamera();
      return;
    }
    const typing = e.target instanceof HTMLInputElement;
    if (e.key === 'F3' || (e.key === 'Escape' && !typing)) { e.preventDefault(); back(); return; }
    if (e.key === 'F4') { e.preventDefault(); S.cur = null; go('home'); return; }
    if (S.screen === 'home' && !typing && /^[1-9]$/.test(e.key)) {
      const it = (SCREENS.home.items || []).find((x) => x.n === e.key);
      if (it && !it.disabled) { e.preventDefault(); it.act(); }
    }
  });

  render();
})();
