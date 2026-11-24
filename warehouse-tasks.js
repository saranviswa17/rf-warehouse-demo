/* Warehouse task (WT) documents for wave W-0901, built from data.js (textContent only):
 * 1. Picking WT for kitting (bulb + battery)
 * 2. Fabrication (VAS) WT – cut the cardboard as per the customer order
 * 3. Packing & line-haul WT – both customer orders packed into one line-haul shipment */
(function () {
  'use strict';
  const D = window.RF_DATA;
  const OB = D.outbound;
  const WT = OB.wt;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.getElementById('docs');

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const kids = (el, ...list) => { list.flat().filter(Boolean).forEach((k) => el.append(k)); return el; };
  const item = (sku) => D.asn.find((a) => a.sku === sku) || { product: sku, desc: sku, bin: '-' };
  const order = (so) => OB.orders.find((o) => o.so === so);
  const line = (so, ln) => order(so).lines.find((l) => l.line === ln);
  const stType = (bin) => (D.storageTypes || []).find((s) => String(bin).split('-')[0] === s.aisle) || null;

  function barcode(value, height) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) {
      window.JsBarcode(svg, value, { format: 'CODE128', width: 1.3, height: height || 30, margin: 0, displayValue: false, background: '#FFFFFF' });
    }
    return svg;
  }
  const bc = (value, label) => kids(h('div', 'bc'), barcode(value), h('div', 't', label || value));

  // Sequential demo WT numbers, in the order the tasks are created
  let seq = 1000;
  const wtNo = () => `1000000${String(++seq).padStart(5, '0')}`;

  function page(title, sub, meta) {
    const p = h('section', 'page');
    kids(p,
      kids(h('div', 'doc-head'),
        kids(h('div', null), h('div', 'doc-title', title), sub && h('div', 'doc-sub', sub)),
        kids(h('div', 'doc-ref'),
          kids(h('div', null), h('span', 'k', 'Warehouse'), h('b', 'mono', `${D.site.whn} · ${D.site.name}`)),
          kids(h('div', null), h('span', 'k', 'Wave'), h('b', 'mono', 'W-0901')),
          kids(h('div', null), h('span', 'k', 'Date'), h('b', 'mono', OB.orderDate)),
          kids(h('div', null), h('span', 'k', 'Printed by'), h('b', 'mono', '__________')))),
      meta && kids(h('div', 'wt-meta'), meta.map(([k, v]) => kids(h('div', null), h('span', 'k', k), h('b', null, v)))));
    root.append(p);
    return p;
  }

  /** WT table. Each task: { no, type, product, desc, upc, qty, from, to, toLabel, ref, haz } */
  function wtTable(tasks) {
    const t = h('table', 'tbl wt-tbl tasks');
    const hr = h('tr');
    ['WT', 'Process', 'Product', 'Qty', 'From', 'To', 'Order / line', 'Confirm'].forEach((c) => hr.append(h('th', null, c)));
    t.append(kids(h('thead'), hr));
    const tb = h('tbody');
    tasks.forEach((x) => {
      const tr = h('tr', x.haz ? 'haz' : null);
      kids(tr,
        kids(h('td'), bc(x.no)),
        h('td', null, x.type),
        kids(h('td', 'prod'), h('b', null, x.product), h('span', null, [x.desc, x.upc ? `UPC ${x.upc}` : null].filter(Boolean).join(' · ')),
          x.haz ? kids(h('div'), h('span', 'pill-haz', 'HAZMAT')) : null),
        h('td', 'qty', x.qty),
        kids(h('td'), bc(x.from)),
        kids(h('td'), bc(x.to, x.toLabel || x.to)),
        h('td', 'mono', x.ref),
        h('td', 'conf', '☐ Qty ___' + String.fromCharCode(10) + 'Init ___'));
      tb.append(tr);
    });
    t.append(tb);
    return t;
  }
  const signRow = (labels) => kids(h('div', 'sign'), labels.map((l) => kids(h('div', null), h('span', 'k', l), h('div', 'line', '______________________'))));
  const box = (title, ...content) => kids(h('div', 'box'), h('h4', null, title), ...content);
  const list = (tag, items) => kids(h(tag), items.map((s) => h('li', null, s)));

  /* ===================== 1 · Picking WT – kitting ===================== */
  const kit = OB.kits[0];
  const kitSo = order(kit.so);
  const kitTasks = kit.components.map((c) => {
    const it = item(c.sku);
    const l = line(kit.so, c.line);
    return { no: wtNo(), type: 'Pick for kitting', product: it.product, desc: it.desc, upc: it.upc, qty: `${l.qty} ${l.uom}`,
      from: it.bin, to: kit.workCenter, ref: `${kit.so} / ${c.line}` };
  });
  const kitMove = { no: wtNo(), type: 'Move kits to pack', product: `${kit.kit} ${kit.name}`, desc: `${kit.qty} kits · each ${kit.components.map((c) => `${c.perKit} ${item(c.sku).product.toLowerCase()}`).join(' + ')}`,
    qty: `${kit.qty} EA`, from: kit.workCenter, to: WT.packStation, toLabel: `${WT.packStation} → ${kitSo.hu}`, ref: `${kit.so} / ${kit.id}` };

  (function kittingPage() {
    const p = page('PICKING WT', 'Pick for kitting · warehouse order ' + WT.orders.kitting, [
      ['Warehouse order', WT.orders.kitting], ['Kit order', `${kit.id} · ${kit.kit}`], ['Customer order', `${kit.so} · ${kitSo.customer.name}`],
      ['Kit station', kit.workCenter], ['Kits to build', `${kit.qty}`], ['Kit contents', kit.components.map((c) => `${c.perKit} × ${item(c.sku).product}`).join(' + ')],
      ['Ship', `${kitSo.service} · ${kitSo.route} stop ${kitSo.stop}/${kitSo.stops}`], ['Pack into', `${kitSo.hu} at ${WT.packStation}`]]);
    kids(p,
      h('h3', null, 'Pick tasks (in bin order)'),
      wtTable(kitTasks),
      box('Kit build at ' + kit.workCenter,
        kids(h('div', 'kit-visual'),
          Array.from({ length: kit.qty }, (_, i) => kids(h('div', 'kit'), `KIT ${i + 1} of ${kit.qty}`,
            h('small', null, kit.components.map((c) => `${c.perKit} ${item(c.sku).product}`).join(' + '))))),
        list('ol', kit.steps)),
      h('h3', null, 'Move task after kitting'),
      wtTable([kitMove]),
      box('Exceptions', list('ul', [
        `Battery bin ${item('SKU-BATTERY').bin} shows empty → do not short-pick: Call IT (replenishment task RPL-0001), then pick.`,
        'Wrong product or UPC → stop and rescan. Short pick → record the quantity and tell the supervisor.'])),
      signRow(['Picked by', 'Kits built by', 'Checked by']),
      h('p', 'demo-foot', 'DEMO DATA · warehouse task and order numbers are fictional; printed from the RF demo, not from SAP EWM.'));
  })();

  /* ===================== 2 · Fabrication (VAS) WT ===================== */
  const vas = OB.vas[0];
  const vasSo = order(vas.so);
  const vasLine = line(vas.so, vas.line);
  const card = item(vas.sku);
  const vasTasks = [
    { no: wtNo(), type: 'Pick for VAS', product: card.product, desc: `As received · ${card.desc.replace(/\s*\(cut to order at FAB\)/i, '')}`, upc: card.upc,
      qty: `${vasLine.qty} ${vasLine.uom}`, from: card.bin, to: vas.workCenter, ref: `${vas.so} / ${vas.line}` },
    { no: wtNo(), type: 'Move after VAS', product: `${card.product} – cut ${vas.requiredCm} cm`, desc: vasLine.desc, qty: `${vasLine.qty} ${vasLine.uom}`,
      from: vas.workCenter, to: WT.packStation, toLabel: `${WT.packStation} → ${vasSo.hu}`, ref: `${vas.so} / ${vas.line}` }
  ];

  (function fabricationPage() {
    const p = page('FABRICATION WT', 'Value-added service · warehouse order ' + WT.orders.vas, [
      ['Warehouse order', WT.orders.vas], ['VAS order', vas.id], ['Customer order', `${vas.so} / line ${vas.line}`], ['Work center', vas.workCenter],
      ['Customer requirement', `${vas.requiredCm} cm (${vasLine.desc})`], ['As received', `${vas.receivedCm} cm`], ['Tolerance', vas.tolerance],
      ['Off-cut', `${vas.receivedCm - vas.requiredCm} cm → scrap`]]);
    kids(p,
      h('h3', null, 'Warehouse tasks'),
      wtTable(vasTasks),
      h('h3', null, `Cutting guide – actual size (check: the ruler must measure ${vas.receivedCm} cm after printing)`),
      cutGuide(vas.receivedCm, vas.requiredCm),
      box('VAS steps at ' + vas.workCenter, list('ol', vas.steps)),
      kids(h('div', 'sign'),
        kids(h('div', null), h('span', 'k', 'Measured length'), h('div', 'line', '______ cm')),
        kids(h('div', null), h('span', 'k', 'Cut by'), h('div', 'line', '______________________')),
        kids(h('div', null), h('span', 'k', 'Checked by (QC)'), h('div', 'line', '______________________'))),
      h('p', 'demo-foot', `The customer order only states the requirement (${vas.requiredCm} cm). The received length is shown here for the cutter. DEMO DATA.`));
  })();

  // Actual-size bar: received length with the cut line at the required length (1 SVG unit = 1 mm)
  function cutGuide(fromCm, toCm) {
    const all = fromCm * 10, keep = toCm * 10, x0 = 4, W = all + 8, H = 30;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', `${W}mm`);
    svg.setAttribute('height', `${H}mm`);
    const add = (tag, attrs, text) => {
      const e = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
      if (text != null) e.textContent = text;
      svg.append(e);
    };
    add('rect', { x: x0, y: 4, width: keep, height: 12, fill: '#E8D6B5', stroke: '#8A6A3A', 'stroke-width': 0.3 });
    add('rect', { x: x0 + keep, y: 4, width: all - keep, height: 12, fill: '#FCE8E6', stroke: '#D33', 'stroke-width': 0.3, 'stroke-dasharray': '1 0.6' });
    add('line', { x1: x0 + keep, y1: 1.5, x2: x0 + keep, y2: 18.5, stroke: '#D33', 'stroke-width': 0.5, 'stroke-dasharray': '1.2 0.8' });
    add('text', { x: x0 + keep / 2, y: 11.5, 'font-size': 3.2, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-weight': 700 }, `KEEP ${toCm} cm`);
    add('text', { x: x0 + keep + (all - keep) / 2, y: 11.5, 'font-size': 2.6, 'text-anchor': 'middle', 'font-family': 'Arial', fill: '#B3261E', 'font-weight': 700 }, 'OFF-CUT');
    add('text', { x: x0 + keep + 1, y: 2.8, 'font-size': 2.2, 'font-family': 'Arial', fill: '#B3261E', 'font-weight': 700 }, 'CUT');
    for (let i = 0; i <= all; i++) {
      const len = i % 10 === 0 ? 3.5 : i % 5 === 0 ? 2.4 : 1.4;
      add('line', { x1: x0 + i, y1: 20, x2: x0 + i, y2: 20 + len, stroke: '#000', 'stroke-width': 0.15 });
      if (i % 10 === 0) add('text', { x: x0 + i, y: 28, 'font-size': 2.4, 'text-anchor': 'middle', 'font-family': 'Arial' }, String(i / 10));
    }
    add('line', { x1: x0, y1: 20, x2: x0 + all, y2: 20, stroke: '#000', 'stroke-width': 0.2 });
    const wrap = h('div', 'cut');
    wrap.append(svg);
    return wrap;
  }

  /* ===================== 3 · Packing & line-haul WT ===================== */
  const pickTasks = [];
  OB.orders.forEach((o) => o.lines.forEach((l) => {
    const usedElsewhere = (OB.kits || []).some((k) => k.so === o.so && k.components.some((c) => c.line === l.line)) ||
      (OB.vas || []).some((v) => v.so === o.so && v.line === l.line) || l.service;
    if (usedElsewhere) return;
    const it = item(l.sku);
    pickTasks.push({ no: wtNo(), type: l.hu ? 'Pick to staging' : 'Pick to pack', product: it.product, desc: it.desc, upc: it.upc,
      qty: `${l.qty} ${l.uom}`, from: it.bin, to: l.hu ? WT.stageOut : WT.packStation,
      toLabel: l.hu ? `${WT.stageOut} (${l.hu}, own carton)` : `${WT.packStation} → ${o.hu}`, ref: `${o.so} / ${l.line}`, haz: !!it.hazmat });
  }));
  const loadTasks = [
    { no: wtNo(), type: 'Move HU to staging', product: `${OB.pallet.hu} outbound pallet`, desc: `Nested ${OB.pallet.contains.join(' + ')}`,
      qty: '1 HU', from: WT.packStation, to: WT.stageOut, ref: `${WT.shipment}` },
    { no: wtNo(), type: 'Load HU', product: `${OB.pallet.hu} outbound pallet`, desc: `Load ${WT.tu} · trailer ${OB.lineHaul.trailer}`,
      qty: '1 HU', from: WT.stageOut, to: WT.door, ref: `${WT.shipment}` }
  ];

  (function packingPage() {
    const p = page('PACKING & LINE-HAUL WT', 'Pack both customer orders into one line-haul shipment · warehouse orders ' +
      `${WT.orders.pick} / ${WT.orders.load}`, [
      ['Shipment / TU', `${WT.shipment} / ${WT.tu}`], ['Line haul', `${OB.lineHaul.carrier} · ${OB.lineHaul.trailer}`],
      ['Departs', OB.lineHaul.depart], ['To', OB.lineHaul.to],
      ['Pack station', WT.packStation], ['Staging / door', `${WT.stageOut} / ${WT.door}`],
      ['Outbound pallet', `${OB.pallet.hu} · SSCC ${OB.pallet.sscc}`], ['Seal no', '__________']]);

    // Packing summary: what goes into each handling unit
    const packRows = [];
    OB.orders.forEach((o) => {
      const hus = [{ hu: o.hu, sscc: o.huSscc, tracking: o.tracking, lines: o.lines.filter((l) => !l.hu && !l.service) }]
        .concat((o.extraHus || []).map((x) => ({ hu: x.hu, sscc: x.sscc, tracking: x.tracking, lines: o.lines.filter((l) => l.hu === x.hu) })));
      hus.forEach((x, i) => {
        const contents = x.lines.map((l) => {
          const k = (OB.kits || []).find((kk) => kk.so === o.so && kk.components.some((c) => c.line === l.line));
          if (k) return null;
          return `${item(l.sku).product} ${l.qty} ${l.uom}${l.vas ? ` (cut ${OB.vas[0].requiredCm} cm)` : ''}`;
        }).filter(Boolean);
        const k = (OB.kits || []).find((kk) => kk.so === o.so && x.lines.some((l) => kk.components.some((c) => c.line === l.line)));
        if (k) contents.unshift(`${k.qty} × ${k.kit} kit (bulb + battery)`);
        packRows.push({ o, x, n: i + 1, of: hus.length, contents, haz: x.lines.some((l) => item(l.sku).hazmat) });
      });
    });
    const t = h('table', 'tbl wt-tbl pack');
    const hr = h('tr');
    ['HU', 'Order', 'Contents', 'Pack spec', 'Carrier · Descartes route', 'Done'].forEach((c) => hr.append(h('th', null, c)));
    t.append(kids(h('thead'), hr));
    const tb = h('tbody');
    packRows.forEach((r) => tb.append(kids(h('tr', r.haz ? 'haz' : null),
      kids(h('td'), bc('00' + r.x.sscc, r.x.hu)),
      h('td', 'mono', `${r.o.so} · ${r.o.delivery}\ncarton ${r.n}/${r.of}`),
      kids(h('td', 'prod'), h('b', null, r.contents.join(' · ')), r.haz ? kids(h('div'), h('span', 'pill-haz', 'HAZMAT · LTD QTY')) : null),
      h('td', 'mono', r.x.lines.some((l) => l.hu) ? 'Own carton' : r.o.pack),
      h('td', null, `${r.o.service} · ${r.o.route} stop ${r.o.stop}/${r.o.stops} · ${r.x.tracking}`),
      h('td', 'conf', '☐ Closed' + String.fromCharCode(10) + '☐ Labelled'))));
    t.append(tb);

    const tree = [`${OB.pallet.hu}  (SSCC ${OB.pallet.sscc}) – outbound pallet, line haul ${WT.shipment}`]
      .concat(OB.orders.flatMap((o) => [o.hu].concat((o.extraHus || []).map((x) => x.hu)).map((hu) => `  └─ ${hu}  ${o.so} · ${o.carrier} ${o.route}`)))
      .join('\n');

    kids(p,
      h('h3', null, 'Pick tasks for the rest of both orders'),
      wtTable(pickTasks),
      h('h3', null, 'Packing – one handling unit per carton'),
      t,
      box('Nest on the line-haul pallet', h('pre', 'hu-tree', tree)),
      h('h3', null, 'Move & load tasks'),
      wtTable(loadTasks),
      box('Pack & ship checklist', list('ol', [
        `Kits (${OB.kits[0].kit}) and the cut cardboard arrive at ${WT.packStation}; pack them into ${order('SO-5001').hu}.`,
        `Close each carton. If ${order('SO-5001').hu} won't close (no packaging spec) → Call IT to add ${order('SO-5001').pack}.`,
        'Stick the carrier label on each carton: FedEx on the SO-5001 cartons, UPS on the SO-5002 carton.',
        `Nest all cartons on ${OB.pallet.hu}, wrap, and stick the outbound pallet label.`,
        `Move ${OB.pallet.hu} to ${WT.stageOut}, load it at ${WT.door} into ${OB.lineHaul.trailer}, write the seal number above.`,
        `Post goods issue for ${OB.orders.map((o) => o.delivery).join(' and ')}. At the hub, the cartons split to FedEx and UPS.`])),
      signRow(['Packed by', 'Loaded by', 'Goods issue posted by']),
      h('p', 'demo-foot', 'DEMO DATA · fictional customers, SSCCs (GS1 example prefix), tracking and WT numbers. Not an SAP EWM printout.'));
  })();

  document.getElementById('print').addEventListener('click', () => window.print());
  document.body.setAttribute('data-ready', '1');
})();
