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
    box: ['M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z', 'M3 7.5L12 12l9-4.5', 'M12 12v9']
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
    const t = String(raw == null ? '' : raw).trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(t) ? t : null;
  }

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
    back: 'home',
    tasks: loadTasks(),
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
  function go(screen, msg) {
    S.screen = screen;
    S.msg = msg || null;
    render();
  }
  function flash(type, text) {
    S.msg = { type, text };
    if (type === 'error') errBeep();
    render();
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
        ['LPN', mono(t.lpn)],
        ['SKU', mono(t.sku)],
        ['PO', mono(t.po)],
        ['Vendor', t.vendor],
        ...(extra || [])
      ]));
  }

  function locPanel(bin, caption) {
    const parts = bin.split('-');
    const names = parts.length === 4 ? ['Zone', 'Aisle', 'Bay', 'Level'] : null;
    return h('div', { class: 'location' },
      h('div', { class: 'loc-cap' }, caption || 'Destination bin'),
      h('div', { class: 'big' }, bin),
      names && h('div', { class: 'loc-parts' },
        parts.map((p, i) => h('div', null, h('small', null, names[i]), h('b', null, p)))));
  }

  function hero(title, sub) {
    return h('div', { class: 'done-hero' },
      h('div', { class: 'icon' }, icon('check', 3)),
      h('h2', null, title),
      sub && h('p', null, sub));
  }

  const qtyText = (t, q) => `${q} ${t.uom}`;

  /* ---------------- receiving logic ---------------- */
  function handleReceiveScan(code) {
    const existing = findTask(code);
    if (existing) {
      if (existing.status === 'RECEIVED') {
        S.cur = existing;
        go('put-travel', { type: 'warn', text: `${existing.lpn} was already received. Continue with putaway.` });
      } else {
        flash('error', `${existing.lpn} is already put away in ${existing.bin}.`);
      }
      return;
    }
    let line = D.asn.find((a) => norm(a.lpn) === norm(code));
    let viaSku = false;
    if (!line) {
      // Product (SKU) barcode: match the next un-received pallet of that product
      const skuLines = D.asn.filter((a) => norm(a.sku) === norm(code));
      if (skuLines.length) {
        line = skuLines.find((a) => !findTask(a.lpn));
        if (!line) { flash('error', `All pallets of ${skuLines[0].product || code} are already received.`); return; }
        viaSku = true;
      }
    }
    if (!line) {
      S.pendingLpn = code;
      errBeep();
      go('rcv-unknown');
      return;
    }
    S.cur = {
      id: randomId(8), lpn: line.lpn, po: line.po, asn: D.asnId, vendor: line.vendor,
      sku: line.sku, desc: line.desc, uom: line.uom, qtyExp: line.qty, qtyRcv: line.qty,
      plannedBin: line.bin, bin: line.bin, condition: 'GOOD', blind: false, exceptions: []
    };
    okBeep();
    go('rcv-verify', {
      type: 'ok',
      text: viaSku
        ? `Product ${line.sku} matched to pallet ${line.lpn} on ${D.asnId}.`
        : `Pallet ${line.lpn} found on ${D.asnId}.`
    });
  }

  function blindReceive() {
    const lpn = S.pendingLpn;
    S.pendingLpn = null;
    S.cur = {
      id: randomId(8), lpn, po: '-', asn: '-', vendor: 'Unknown - not on ASN',
      sku: 'UNKNOWN', desc: 'Unidentified pallet - inspect at QA', uom: 'EA', qtyExp: 0, qtyRcv: 1,
      plannedBin: D.qaBin, bin: D.qaBin, condition: 'GOOD', blind: true, exceptions: ['Not on ASN']
    };
    go('rcv-verify', { type: 'warn', text: 'Blind receipt: count the pallet and confirm. It will be directed to QA hold.' });
  }

  function confirmReceipt(rawQty) {
    const t = S.cur;
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
    t.status = 'RECEIVED';
    t.receivedAt = Date.now();
    t.grDoc = nextDoc('GR');
    t.operator = S.operator;
    S.tasks.push(t);
    save();
    okBeep();
    go('rcv-done');
  }

  /* ---------------- putaway logic ---------------- */
  function handlePutawayLpn(code) {
    const t = findTask(code);
    if (!t) { flash('error', `No open putaway task for ${code}. Receive the pallet first.`); return; }
    if (t.status === 'PUTAWAY') { flash('error', `${t.lpn} is already put away in ${t.bin}.`); return; }
    S.cur = t;
    okBeep();
    go('put-travel');
  }

  function handleBinScan(code) {
    const t = S.cur;
    if (norm(code) !== norm(t.bin)) {
      flash('error', `Wrong bin! You scanned ${code}. Go to ${t.bin}.`);
      return;
    }
    t.scannedBin = t.bin;
    okBeep();
    go('put-confirm');
  }

  function alternateBin() {
    const t = S.cur;
    const busy = new Set(openTasks().filter((x) => x !== t).map((x) => norm(x.bin)));
    const options = D.altBins.filter((b) => norm(b) !== norm(t.bin) && !busy.has(norm(b)));
    if (!options.length) { flash('error', 'No alternate bin available. Contact your supervisor.'); return; }
    const old = t.bin;
    t.bin = options[0];
    t.exceptions.push(`Bin ${old} blocked, moved to ${t.bin}`);
    save();
    flash('info', `${old} marked blocked. New destination: ${t.bin}.`);
  }

  function confirmPutaway() {
    const t = S.cur;
    t.status = 'PUTAWAY';
    t.putawayAt = Date.now();
    t.wtDoc = nextDoc('PT');
    save();
    okBeep();
    go('put-done');
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
        { n: '1', t: 'Inbound Receiving', s: 'Receive a pallet by LPN', act: () => go('rcv-scan') },
        { n: '2', t: 'Putaway', s: open ? 'Directed putaway to bin' : 'No open putaway tasks', count: open, act: () => go('put-list') },
        { n: '3', t: 'Activity Log', s: `${S.tasks.length} transaction(s) on this device`, act: () => go('log') },
        { n: '4', t: 'Share this RF app', s: 'QR code & link for others', act: () => go('share') },
        { n: '5', t: 'Print test labels', s: 'Pallet & bin barcodes for the demo', act: () => { window.location.href = 'labels.html'; } },
        { n: '6', t: 'Picking', s: 'Coming soon', disabled: true },
        { n: '7', t: 'Cycle Count', s: 'Coming soon', disabled: true }
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
      return {
        title: 'Receive Pallet', step: 0, back: 'home',
        body: [
          h('div', { class: 'card' },
            h('p', { class: 'card-title' }, 'Open inbound delivery'),
            kv([
              ['ASN', mono(D.asnId)],
              ['Dock', mono(D.site.dock)],
              ['Pallets', `${received} of ${D.asn.length} received`]
            ])),
          h('p', { class: 'hint' }, 'Scan the LPN barcode on the pallet label, or the product barcode.'),
          scanField({
            label: 'Scan pallet LPN',
            placeholder: 'Scan or key LPN',
            onScan: handleReceiveScan,
            simulate: () => {
              const next = D.asn.find((a) => !findTask(a.lpn));
              return next ? next.lpn : D.unknownLpn;
            }
          })
        ]
      };
    },

    'rcv-unknown'() {
      return {
        title: 'Exception', step: 0, back: 'rcv-scan',
        body: [
          h('div', { class: 'msg error', role: 'alert' }, `LPN ${S.pendingLpn} is not on open ${D.asnId}.`),
          h('p', { class: 'hint' }, 'Check the label and rescan. If the pallet is genuinely extra, blind-receive it to QA hold for investigation.'),
          h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('rcv-scan') }, 'Rescan pallet'),
          h('button', { class: 'btn btn-outline btn-xl', type: 'button', onclick: blindReceive }, 'Blind receive to QA hold')
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
          itemCard(t, [['Expected', t.blind ? 'Not on ASN' : qtyText(t, t.qtyExp)]]),
          h('div', { class: 'scan-block' },
            h('label', { class: 'field-label' }, `Received quantity (${t.uom})`),
            h('div', { class: 'qty-row' },
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-label': 'Decrease', onclick: () => step(-1) }, '−'),
              qtyInput,
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-label': 'Increase', onclick: () => step(1) }, '+'))),
          h('div', { class: 'scan-block' },
            h('span', { class: 'field-label' }, 'Pallet condition'),
            h('div', { class: 'seg', role: 'group', 'aria-label': 'Pallet condition' },
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-pressed': String(t.condition === 'GOOD'), onclick: () => setCond('GOOD') }, 'Good'),
              h('button', { class: 'btn btn-outline', type: 'button', 'aria-pressed': String(t.condition === 'DAMAGED'), onclick: () => setCond('DAMAGED') }, 'Damaged'))),
          t.condition === 'DAMAGED' && h('div', { class: 'msg warn' }, `Damaged pallets are directed to ${D.qaBin}.`),
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
              ['LPN', mono(t.lpn)],
              ['Item', t.desc],
              ['Received', qtyText(t, t.qtyRcv)],
              ['Condition', t.condition === 'GOOD' ? 'Good' : 'Damaged'],
              ['At', `${D.site.dock} · ${fmtTime(t.receivedAt)}`],
              t.exceptions.length ? ['Exceptions', h('span', { class: 'pill exc' }, t.exceptions.join(', '))] : null
            ].filter(Boolean))),
          h('div', { class: 'next' },
            h('p', { class: 'card-title' }, 'Next step · Putaway'),
            h('p', { class: 'hint' }, 'Move the pallet to bin ', h('b', { class: 'mono' }, t.bin), '.')),
          h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('put-travel') },
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
          scanField({ label: 'Scan pallet LPN', placeholder: 'Scan or key LPN', onScan: handlePutawayLpn,
            simulate: open.length ? () => open[0].lpn : null }),
          h('p', { class: 'card-title' }, `Open tasks (${open.length})`),
          open.length
            ? h('ul', { class: 'list' }, open.map((t) =>
              h('li', null, h('button', { class: 'list-btn', type: 'button', onclick: () => { S.cur = t; go('put-travel'); } },
                h('div', { class: 'row' }, h('span', { class: 'lpn' }, t.lpn), h('span', { class: 'bin' }, t.bin)),
                h('div', { class: 'desc' }, `${t.desc} · ${qtyText(t, t.qtyRcv)}`)))))
            : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No pallets waiting for putaway. Receive a pallet first.'),
              h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => go('rcv-scan') }, 'Go to receiving'))
        ]
      };
    },

    'put-travel'() {
      const t = S.cur;
      return {
        title: 'Putaway', step: 3, back: 'put-list',
        body: [
          locPanel(t.bin, 'Take pallet to bin'),
          h('div', { class: 'route' }, h('span', null, D.site.dock), h('span', { class: 'arrow' }, '→'), h('span', null, t.bin)),
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, t.desc),
            kv([['LPN', mono(t.lpn)], ['Qty', qtyText(t, t.qtyRcv)]])),
          h('p', { class: 'hint' }, 'At the location, scan the bin label to verify.'),
          scanField({ label: 'Scan destination bin', placeholder: 'Scan or key bin', onScan: handleBinScan, simulate: () => t.bin }),
          h('button', { class: 'btn btn-link', type: 'button', onclick: alternateBin }, 'Bin full or blocked? Get alternate bin')
        ]
      };
    },

    'put-confirm'() {
      const t = S.cur;
      return {
        title: 'Confirm Putaway', step: 4, back: 'put-travel',
        body: [
          h('div', { class: 'msg ok' }, `Bin ${t.bin} verified.`),
          locPanel(t.bin, 'Place pallet in bin'),
          h('div', { class: 'card' },
            h('div', { class: 'item-title' }, t.desc),
            kv([
              ['LPN', mono(t.lpn)],
              ['Qty', qtyText(t, t.qtyRcv)],
              ['From', mono(D.site.dock)],
              ['To', mono(t.bin)]
            ])),
          h('button', { class: 'btn btn-ok btn-xl', type: 'button', onclick: confirmPutaway }, icon('check', 3), 'Confirm putaway complete')
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
              ['LPN', mono(t.lpn)],
              ['Item', t.desc],
              ['Qty', qtyText(t, t.qtyRcv)],
              ['Bin', mono(t.bin)],
              ['Dock-to-stock', fmtDuration(t.putawayAt - t.receivedAt)],
              t.exceptions.length ? ['Exceptions', h('span', { class: 'pill exc' }, t.exceptions.join(', '))] : null
            ].filter(Boolean))),
          open.length
            ? h('button', { class: 'btn btn-primary btn-xl', type: 'button', onclick: () => { S.cur = open[0]; go('put-travel'); } },
              icon('pin'), `Next putaway (${open.length} open)`)
            : null,
          h('button', { class: open.length ? 'btn btn-outline btn-xl' : 'btn btn-primary btn-xl', type: 'button', onclick: () => go('rcv-scan') },
            icon('box'), 'Receive next pallet'),
          h('button', { class: 'btn btn-link', type: 'button', onclick: () => go('home') }, 'Main menu')
        ]
      };
    },

    log() {
      const list = S.tasks.slice().sort((a, b) => (b.putawayAt || b.receivedAt) - (a.putawayAt || a.receivedAt));
      const clear = () => {
        if (!window.confirm('Clear all demo transactions on this device?')) return;
        S.tasks = [];
        S.cur = null;
        store.remove('tasks');
        ['seq', 'seq.GR', 'seq.PT'].forEach((k) => store.remove(k));
        go('log', { type: 'info', text: 'Demo data cleared.' });
      };
      return {
        title: 'Activity Log', step: null, back: 'home',
        body: [
          list.length
            ? h('ul', { class: 'list' }, list.map((t) =>
              h('li', { class: 'card' },
                h('div', { class: 'row', style: null },
                  h('span', { class: t.status === 'PUTAWAY' ? 'pill put' : 'pill rcv' }, t.status === 'PUTAWAY' ? 'Put away' : 'Received'),
                  ' ', t.exceptions && t.exceptions.length ? h('span', { class: 'pill exc' }, 'Exception') : null),
                h('div', { class: 'item-title', style: null }, t.desc),
                kv([
                  ['LPN', mono(t.lpn)],
                  ['Qty', qtyText(t, t.qtyRcv)],
                  ['Bin', mono(t.bin)],
                  ['GR', t.grDoc ? `${t.grDoc} · ${fmtTime(t.receivedAt)}` : null],
                  ['Task', t.wtDoc ? `${t.wtDoc} · ${fmtTime(t.putawayAt)}` : null],
                  ['Notes', t.exceptions && t.exceptions.length ? t.exceptions.join(', ') : null],
                  ['User', t.operator ? mono(t.operator) : null]
                ]))))
            : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No transactions yet.')),
          list.length ? h('button', { class: 'btn btn-outline btn-xl', type: 'button', onclick: clear }, 'Clear demo data') : null
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
    const fn = SCREENS[S.screen] || SCREENS.home;
    if (S.screen !== 'login' && S.screen !== 'home' && S.screen !== 'rcv-scan' && S.screen !== 'put-list' && S.screen !== 'log' &&
        S.screen !== 'share' && S.screen !== 'rcv-unknown' && !S.cur) {
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
    root.replaceChildren(...kids, ...v.body.filter(Boolean));
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
