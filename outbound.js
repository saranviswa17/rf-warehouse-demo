/* Outbound paperwork built from data.js (textContent only):
 * sales orders, Descartes route plan, pick list, VAS / fabrication work order,
 * packing slips, carrier shipping labels (10 x 6 cm) and the outbound pallet label. */
(function () {
  'use strict';
  const D = window.RF_DATA;
  const OB = D.outbound;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.getElementById('docs');

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const kids = (el, ...list) => { list.flat().filter(Boolean).forEach((k) => el.append(k)); return el; };

  function barcode(value, o) {
    const opt = o || {};
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) {
      window.JsBarcode(svg, value, {
        format: 'CODE128', ean128: !!opt.gs1, width: opt.width || 2, height: opt.height || 50, margin: 6,
        displayValue: opt.display !== false, text: opt.text || value, font: 'monospace', fontSize: opt.fontSize || 14,
        textMargin: 2, background: '#FFFFFF'
      });
    }
    return svg;
  }
  const ssccText = (s) => `(00) ${s.slice(0, 1)} ${s.slice(1, 8)} ${s.slice(8, 17)} ${s.slice(17)}`;
  const item = (sku) => D.asn.find((a) => a.sku === sku) || { product: sku, desc: sku, bin: '-' };
  const stType = (bin) => (D.storageTypes || []).find((s) => String(bin).split('-')[0] === s.aisle) || null;
  const addr = (a) => kids(h('div', 'addr'), h('b', null, a.name), a.attn && h('div', null, `Attn: ${a.attn}`),
    h('div', null, a.street), h('div', null, `${a.city} ${a.postal || ''}`));
  const routeOf = (o) => (OB.routes || []).find((r) => r.id === o.route);
  // Handling units of an order: the main packed carton plus any item that ships in its own carton
  const huList = (o) => [{ hu: o.hu, sscc: o.huSscc, tracking: o.tracking, lines: o.lines.filter((l) => !l.hu && !l.service) }]
    .concat((o.extraHus || []).map((x) => ({ hu: x.hu, sscc: x.sscc, tracking: x.tracking, lines: o.lines.filter((l) => l.hu === x.hu) })));
  const huNames = (o) => huList(o).map((x) => x.hu).join(' + ');

  function table(cols, rows, rowCls) {
    const t = h('table', 'tbl');
    const tr = h('tr');
    cols.forEach((c) => tr.append(h('th', null, c)));
    kids(t, kids(h('thead'), tr));
    const tb = h('tbody');
    rows.forEach((r, i) => {
      const row = h('tr', rowCls ? rowCls(i) : null);
      r.forEach((v) => row.append(v instanceof Node ? kids(h('td'), v) : h('td', null, v == null ? '' : String(v))));
      tb.append(row);
    });
    t.append(tb);
    return t;
  }

  function page(title, sub, refs) {
    const p = h('section', 'page');
    p.setAttribute('data-doc', title);
    kids(p, kids(h('div', 'doc-head'),
      kids(h('div', null), h('div', 'doc-title', title), sub && h('div', 'doc-sub', sub)),
      refs && kids(h('div', 'doc-ref'), refs.map(([k, v]) => kids(h('div', null), h('span', 'k', k), h('b', 'mono', v))))));
    root.append(p);
    return p;
  }

  /* ---------- 1 · Sales orders – laid out like the SAP "Display Standard Order: Overview" screen ---------- */
  const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  const usDate = (s) => { const m = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(String(s || '')); return m ? `${MON[m[2]]}/${m[1]}/${m[3]}` : (s || ''); };
  const lineDesc = (l) => {
    if (l.desc) return l.desc;
    const d = item(l.sku).desc.replace(/\s*\(cut to order at FAB\)/i, '');
    return l.vas ? `${d} – ${l.note || 'VAS'}` : d;
  };
  const field = (text, cls) => h('span', 'sap-f' + (cls ? ' ' + cls : ''), text);
  const partyText = (c) => `${c.name} / ${c.street} / ${c.city} ${c.postal || ''}`.trim();

  OB.orders.forEach((o) => {
    const r = routeOf(o);
    const net = o.lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
    const p = h('section', 'page so-page');
    const sap = h('div', 'sap');
    kids(sap,
      kids(h('div', 'sap-title'), h('span', 'sap-ico', '▦'), h('span', null, `Display Standard Order ${o.so}: Overview`)),
      kids(h('div', 'sap-tool'), ['⎘', '✔', '☰', '👤', '⧉'].map((g) => h('span', 'sap-btn', g)), h('span', 'sap-btn txt', '▥ Orders')),
      kids(h('div', 'sap-head'),
        h('span', 'sap-l', 'Standard Order'), field(o.so), h('span', 'sap-l right', 'Net value'), field(money(net), 'num wide'), field('USD', 'cur'),
        h('span', 'sap-l link', 'Sold-To Party'), field(o.customerNo), h('span', 'sap-link span3', partyText(o.customer)),
        h('span', 'sap-l link', 'Ship-To Party'), field(o.customerNo), h('span', 'sap-link span3', partyText(o.customer)),
        h('span', 'sap-l link', 'PO Number'), field(o.custPo, 'wide2'), h('span', 'sap-l link right', 'PO Date'), field(usDate(OB.orderDate), 'wide'), h('span', null)),
      kids(h('div', 'sap-tabs'), ['Sales', 'Item overview', 'Item detail', 'Ordering party', 'Procurement', 'Shipping', 'Reason for rejection', 'ATP', 'Order Status']
        .map((t) => h('span', 'sap-tab' + (t === 'Item overview' ? ' on' : ''), t))),
      kids(h('div', 'sap-panel'),
        kids(h('div', 'sap-row'),
          h('span', 'sap-l', 'Req. deliv.date'), field('D', 'tiny'), field(usDate(o.requested)),
          h('span', 'sap-l gap', 'Deliver.Plant'), field(D.site.whn || 'GA02', 'short')),
        kids(h('div', 'sap-grid'),
          h('div', 'sap-grid-title', 'All items'),
          (function () {
            const t = h('table', 'sap-tbl');
            const hr = h('tr');
            ['', 'Item', 'Plnt', 'Material', 'Order Q…', 'Description', 'Amount', 'Un', 'Net value'].forEach((c) => hr.append(h('th', null, c)));
            t.append(kids(h('thead'), hr));
            const tb = h('tbody');
            o.lines.forEach((l) => {
              const tr = h('tr');
              kids(tr, h('td', 'sel'), kids(h('td', 'num'), h('span', 'u', String(l.line))), h('td', null, D.site.whn || 'GA02'),
                h('td', null, l.material || l.sku), h('td', 'num', String(l.qty)), h('td', null, lineDesc(l)),
                h('td', 'num', money(l.price)), h('td', null, l.uom), h('td', 'num', money((l.price || 0) * l.qty)));
              tb.append(tr);
            });
            for (let i = o.lines.length; i < 6; i++) {           // empty rows, like the SAP table control
              const tr = h('tr', 'empty');
              for (let c = 0; c < 9; c++) tr.append(h('td', c === 0 ? 'sel' : null));
              tb.append(tr);
            }
            t.append(tb);
            return t;
          })())),
      kids(h('div', 'sap-status'),
        h('span', null, `Shipping: ${o.service} · Descartes route ${o.route}, stop ${o.stop} of ${o.stops}` +
          (r ? ` · ETA ${r.stops.find((s) => s.so === o.so).eta}` : '') + ` · Delivery ${o.delivery}`),
        h('span', null, 'DEMO DATA – demo printout, not an SAP document')));
    p.append(sap);
    root.append(p);
  });

  /* ---------- 2 · Descartes route plan ---------- */
  (function routePlan() {
    const p = page('ROUTE PLAN', 'Descartes → EWM', [['Line haul', OB.lineHaul.carrier], ['Trailer', OB.lineHaul.trailer], ['Depart GA02', OB.lineHaul.depart], ['To', OB.lineHaul.to]]);
    kids(p, h('p', 'lead', 'EWM sent both outbound deliveries to Descartes. Descartes returned one route per carrier: the HD Supply fleet takes both cartons overnight on pallet ' +
      `${OB.pallet.hu} to the local hub, where they split to the FedEx and UPS vans.`));
    OB.routes.forEach((r) => {
      kids(p, kids(h('div', 'route ' + r.carrier.toLowerCase()),
        kids(h('div', 'route-head'), h('b', null, `${r.id} · ${r.service}`), h('span', null, `Hub depart ${r.hubDepart} · ${r.vehicle}`)),
        table(['Stop', 'Customer / order', 'Delivery', 'HU', 'ETA'],
          r.stops.map((s) => {
            const o = s.so && OB.orders.find((x) => x.so === s.so);
            return o ? [`${s.no} of ${r.stops.length}`, `${o.customer.name} · ${o.so}`, o.delivery, huNames(o), s.eta]
              : [`${s.no} of ${r.stops.length}`, s.name, '–', '–', s.eta];
          }), (i) => (r.stops[i].so ? 'mine' : 'other'))));
    });
  })();

  /* ---------- 3 · Pick list (one wave, both orders) ---------- */
  (function pickList() {
    const p = page('PICK LIST', 'Wave W-0901 · both deliveries', [['Wave', 'W-0901'], ['Date', OB.orderDate], ['Orders', OB.orders.map((o) => o.so).join(', ')], ['Picker', '__________']]);
    const rows = [];
    OB.orders.forEach((o) => o.lines.filter((l) => !l.service).forEach((l) => rows.push({ o, l, it: item(l.sku) })));
    rows.sort((a, b) => a.it.bin.localeCompare(b.it.bin));
    kids(p, table(['#', 'From bin', 'Storage type', 'Item', 'Qty', 'Order / line', 'To', 'Done'],
      rows.map((x, i) => {
        const st = stType(x.it.bin);
        const to = x.l.vas ? `FAB-01 (${x.l.vas})` : x.l.hu ? `STAGE · ${x.l.hu} (own carton)` : `PACK · ${x.o.hu}`;
        return [i + 1, x.it.bin, st ? `${st.code} ${st.name}` : '–', `${x.it.product}${x.it.hazmat ? ' (HAZMAT)' : ''}`,
          `${x.l.qty} ${x.l.uom}`, `${x.o.so} / ${x.l.line}`, to, '☐'];
      }), (i) => (rows[i].it.hazmat ? 'haz' : null)),
    h('p', 'muted', 'Chemical bottle: received as 1 CS = 4 EA (IT added the conversion at receiving); pick 2 EA. Cardboard goes to fabrication before packing.'));
  })();

  /* ---------- 4 · VAS / fabrication work order ---------- */
  (OB.vas || []).forEach((v) => {
    const it = item(v.sku);
    const o = OB.orders.find((x) => x.so === v.so);
    const p = page('FABRICATION ORDER', 'Value-added service (VAS) work order',
      [['Work order', v.id], ['Order / line', `${v.so} / ${v.line}`], ['Work center', v.workCenter], ['Due', o ? o.requested : '-']]);
    kids(p,
      table(['Item', 'Description', 'Received', 'Customer wants', 'Tolerance', 'Off-cut'],
        [[it.sku, it.desc, `${v.receivedCm} cm`, `${v.requiredCm} cm`, v.tolerance, `${v.receivedCm - v.requiredCm} cm → scrap`]]),
      h('h3', null, 'Cutting guide – actual size (check: the ruler must measure 10 cm after printing)'),
      cutGuide(v.receivedCm, v.requiredCm),
      h('h3', null, 'Steps'),
      kids(h('ol', 'steps'), v.steps.map((s) => h('li', null, s))),
      kids(h('div', 'sign'),
        kids(h('div', null), h('span', 'k', 'Measured length'), h('div', 'line', '______ cm')),
        kids(h('div', null), h('span', 'k', 'Cut by'), h('div', 'line', '______________')),
        kids(h('div', null), h('span', 'k', 'Checked by'), h('div', 'line', '______________'))),
      kids(h('div', 'foot-row'), barcode(v.id, { height: 40 }), h('p', 'muted', 'After sign-off the cut sheet goes to PACK and joins the rest of the order in carton ' + (o ? o.hu : ''))));
  });

  // Actual-size bar: received length with the cut line at the required length.
  function cutGuide(fromCm, toCm) {
    const W = fromCm * 10 + 8, H = 30;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', `${W}mm`);
    svg.setAttribute('height', `${H}mm`);
    svg.setAttribute('class', 'cut');
    const add = (tag, attrs, text) => {
      const e = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, val]) => e.setAttribute(k, String(val)));
      if (text != null) e.textContent = text;
      svg.append(e);
      return e;
    };
    const x0 = 4, keep = toCm * 10, all = fromCm * 10;
    const defs = add('defs', {});
    const pat = document.createElementNS(SVG_NS, 'pattern');
    pat.setAttribute('id', 'hatch'); pat.setAttribute('width', '2'); pat.setAttribute('height', '2');
    pat.setAttribute('patternUnits', 'userSpaceOnUse'); pat.setAttribute('patternTransform', 'rotate(45)');
    const pr = document.createElementNS(SVG_NS, 'rect');
    pr.setAttribute('width', '0.6'); pr.setAttribute('height', '2'); pr.setAttribute('fill', '#D33');
    pat.append(pr); defs.append(pat);
    add('rect', { x: x0, y: 4, width: keep, height: 12, fill: '#E8D6B5', stroke: '#8A6A3A', 'stroke-width': 0.3 });
    add('rect', { x: x0 + keep, y: 4, width: all - keep, height: 12, fill: 'url(#hatch)', stroke: '#D33', 'stroke-width': 0.3, 'stroke-dasharray': '1 0.6' });
    add('line', { x1: x0 + keep, y1: 1.5, x2: x0 + keep, y2: 18.5, stroke: '#D33', 'stroke-width': 0.5, 'stroke-dasharray': '1.2 0.8' });
    add('text', { x: x0 + keep / 2, y: 11.5, 'font-size': 3.2, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-weight': 700 }, `KEEP ${toCm} cm`);
    add('text', { x: x0 + keep + (all - keep) / 2, y: 11.5, 'font-size': 2.6, 'text-anchor': 'middle', 'font-family': 'Arial', fill: '#B3261E', 'font-weight': 700 }, 'OFF-CUT');
    add('text', { x: x0 + keep + 1, y: 2.6, 'font-size': 2.2, 'text-anchor': 'start', 'font-family': 'Arial', fill: '#B3261E', 'font-weight': 700 }, 'CUT');
    for (let i = 0; i <= all; i++) {
      const len = i % 10 === 0 ? 3.5 : i % 5 === 0 ? 2.4 : 1.4;
      add('line', { x1: x0 + i, y1: 20, x2: x0 + i, y2: 20 + len, stroke: '#000', 'stroke-width': 0.15 });
      if (i % 10 === 0) add('text', { x: x0 + i, y: 28, 'font-size': 2.4, 'text-anchor': 'middle', 'font-family': 'Arial' }, String(i / 10));
    }
    add('line', { x1: x0, y1: 20, x2: x0 + all, y2: 20, stroke: '#000', 'stroke-width': 0.2 });
    return svg;
  }

  /* ---------- 5 · Packing slips ---------- */
  OB.orders.forEach((o) => {
    const p = page('PACKING SLIP', `For the packer and the customer · ${o.carrier}`,
      [['Order', o.so], ['Delivery', o.delivery], ['Cartons (HU)', huNames(o)], ['Route', `${o.route} · stop ${o.stop}/${o.stops}`]]);
    kids(p,
      kids(h('div', 'parties'),
        kids(h('div', null), h('span', 'k', 'Ship from'), addr(OB.shipFrom)),
        kids(h('div', null), h('span', 'k', 'Ship to'), addr(o.customer)),
        kids(h('div', null), h('span', 'k', 'Shipping'), h('div', null, o.service), huList(o).map((x) => h('div', 'mono', `${x.hu} tracking ${x.tracking}`)),
          h('div', null, `Pack spec ${o.pack}`), h('div', null, `Outbound pallet ${OB.pallet.hu}`))),
      table(['Line', 'Item', 'Description', 'Ordered', 'Shipped', 'Checked'],
        o.lines.filter((l) => !l.service).map((l) => [l.line, l.sku, lineDesc(l) + (l.hu ? ` · ships in own carton ${l.hu}` : '') + (l.note ? ` · ${l.note}` : ''), `${l.qty} ${l.uom}`, `${l.qty} ${l.uom}`, '☐'])),
      h('p', 'muted', 'Customer: please check the delivery against this slip and sign the proof of delivery.'));
  });

  /* ---------- 5b · Pick drop labels (scanned by the RF at the end of each pick) ---------- */
  (function dropLabels() {
    const p = page('PICK DROP LABELS', 'Stick on the pack cartons, the staging spot and the FAB bench', null);
    const drops = [];
    OB.orders.forEach((o) => {
      drops.push({ code: o.hu, what: `Pack carton · ${o.so} · ${o.carrier}`, where: 'PACK-01' });
      (o.extraHus || []).forEach((x) => drops.push({ code: x.hu, what: `${x.note} · ${o.so} · ${o.carrier}`, where: 'STAGING' }));
    });
    (OB.vas || []).forEach((v) => drops.push({ code: v.workCenter, what: `Fabrication bench · ${v.id} (cut to ${v.requiredCm} cm)`, where: 'FAB' }));
    const grid = h('div', 'lab-grid');
    drops.forEach((d) => kids(grid, kids(h('div', 'dlabel'),
      kids(h('div', 'sl-top'), h('span', 'sl-carrier', d.code), h('span', 'sl-route', d.where)),
      h('div', 'dl-what', d.what),
      kids(h('div', 'sl-codes one'), barcode(d.code, { height: 60, width: 2, fontSize: 14 })))));
    p.append(grid);
  })();

  /* ---------- 6 · Shipping labels (10 x 6 cm) + outbound pallet label ---------- */
  (function shipLabels() {
    const p = page('SHIPPING LABELS', 'Carrier labels 10 × 6 cm · stick on each packed carton', null);
    const grid = h('div', 'lab-grid');
    OB.orders.forEach((o) => {
      const hus = huList(o);
      hus.forEach((x, n) => {
        const haz = x.lines.some((l) => item(l.sku).hazmat);
        kids(grid, kids(h('div', 'slabel ' + o.carrier.toLowerCase()),
          kids(h('div', 'sl-top'), h('span', 'sl-carrier', o.service.toUpperCase()), h('span', 'sl-route', `${o.route} · STOP ${o.stop}/${o.stops}`)),
          kids(h('div', 'sl-parties'),
            kids(h('div', null), h('span', 'k', 'FROM'), h('b', null, OB.shipFrom.name), h('span', null, `${OB.shipFrom.city} ${OB.shipFrom.postal}`)),
            kids(h('div', null), h('span', 'k', 'SHIP TO'), h('b', null, o.customer.name), h('span', null, `${o.customer.street}, ${o.customer.city} ${o.customer.postal}`))),
          kids(h('div', 'sl-refs'), h('span', null, `Order ${o.so}`), h('span', null, `Del ${o.delivery}`), h('span', null, x.hu),
            h('span', null, `Carton ${n + 1} of ${hus.length}`), h('span', null, 'Descartes')),
          kids(h('div', 'sl-codes'),
            kids(h('div', null), h('span', 'k', 'TRACKING (DEMO)'), barcode(x.tracking, { height: 60, width: 1.4, fontSize: 12 })),
            kids(h('div', null), h('span', 'k', 'SSCC'), barcode('00' + x.sscc, { gs1: true, height: 60, width: 1.4, fontSize: 12, text: ssccText(x.sscc) }))),
          kids(h('div', 'sl-foot'), h('span', null, `${x.lines.map((l) => item(l.sku).product).join(', ')} · pallet ${OB.pallet.hu}`),
            haz ? h('span', 'sl-haz', 'HAZMAT · LTD QTY') : h('span', 'muted', 'DEMO DATA'))));
      });
    });
    // Outbound pallet (nested HUs) for the line haul
    kids(grid, kids(h('div', 'slabel pallet'),
      kids(h('div', 'sl-top'), h('span', 'sl-carrier', 'OUTBOUND PALLET'), h('span', 'sl-route', OB.pallet.hu)),
      kids(h('div', 'sl-parties'),
        kids(h('div', null), h('span', 'k', 'FROM'), h('b', null, OB.shipFrom.name), h('span', null, OB.lineHaul.depart)),
        kids(h('div', null), h('span', 'k', 'TO'), h('b', null, OB.lineHaul.to), h('span', null, `${OB.lineHaul.carrier} · ${OB.lineHaul.trailer}`))),
      kids(h('div', 'sl-refs'), h('span', null, `Nested: ${OB.pallet.contains.join(' + ')}`), h('span', null, OB.routes.map((r) => `${r.id} ${r.carrier}`).join(' · '))),
      kids(h('div', 'sl-codes one'), barcode('00' + OB.pallet.sscc, { gs1: true, height: 38, width: 1.6, fontSize: 12, text: ssccText(OB.pallet.sscc) })),
      kids(h('div', 'sl-foot'), h('span', null, 'Cross-dock at hub: split to FedEx and UPS'), h('span', 'sl-haz', 'CONTAINS HAZMAT'))));
    p.append(grid);
  })();

  // ?only=ROUTE%20PLAN (or any document title) keeps just that document, e.g. to print it as its own PDF
  const only = new URLSearchParams(window.location.search).get('only');
  if (only) document.querySelectorAll('#docs > .page').forEach((pg) => { if (pg.getAttribute('data-doc') !== only.toUpperCase()) pg.remove(); });

  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('print-so').addEventListener('click', () => {
    document.body.classList.add('only-so');
    window.print();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('only-so'));
})();
