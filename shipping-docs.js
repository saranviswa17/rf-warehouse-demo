/* Shipping, delivery & return documents built from data.js (textContent only):
 * bill of lading, carrier manifest, IT tickets (HU not at hub, FedEx label),
 * proof of delivery (x2), return authorisation, return inspection, scrap / write-off.
 * ?only=KEY keeps one document so it can be printed as its own PDF. */
(function () {
  'use strict';
  const D = window.RF_DATA;
  const OB = D.outbound;
  const PS = OB.postShip;
  const WT = OB.wt || {};
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.getElementById('docs');

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const kids = (el, ...list) => { list.flat().filter(Boolean).forEach((k) => el.append(k)); return el; };
  const item = (sku) => D.asn.find((a) => a.sku === sku) || { product: sku, desc: sku };
  const order = (so) => OB.orders.find((o) => o.so === so);
  const routeOf = (o) => OB.routes.find((r) => r.id === o.route);
  const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const addr = (a) => kids(h('div', 'addr'), h('b', null, a.name), a.attn && h('div', null, `Attn: ${a.attn}`), a.street && h('div', null, a.street),
    a.city && h('div', null, `${a.city} ${a.postal || ''}`));

  function barcode(value, height) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) window.JsBarcode(svg, value, { format: 'CODE128', width: 1.3, height: height || 30, margin: 0, displayValue: false, background: '#FFFFFF' });
    return svg;
  }
  const bc = (value, label) => kids(h('div', 'bc'), barcode(value), h('div', 't', label || value));

  // Handling units with what is in them
  function husOf(o) {
    return [{ hu: o.hu, sscc: o.huSscc, tracking: o.tracking, lines: o.lines.filter((l) => !l.hu && !l.service) }]
      .concat((o.extraHus || []).map((x) => ({ hu: x.hu, sscc: x.sscc, tracking: x.tracking, lines: o.lines.filter((l) => l.hu === x.hu) })));
  }
  const allHus = () => OB.orders.flatMap((o) => husOf(o).map((x) => Object.assign({ o }, x)));
  const contentsText = (x) => x.lines.map((l) => `${item(l.sku).product} ${l.qty} ${l.uom}${l.vas ? ' (cut 8 cm)' : ''}`).join(', ');
  const isHaz = (x) => x.lines.some((l) => item(l.sku).hazmat);

  const FLOW = ['Line haul', 'Hub', 'Final leg', 'POD', 'Invoice', 'Return', 'Inspection', 'Scrap'];
  const flow = (on) => kids(h('div', 'flow'), FLOW.flatMap((s, i) => [i ? h('i', null, '→') : null, h('span', s === on ? 'on' : null, s)]));

  function page(key, title, sub, refs, stage) {
    const p = h('section', 'page');
    p.setAttribute('data-doc', key);
    kids(p,
      kids(h('div', 'doc-head'),
        kids(h('div', null), h('div', 'doc-title', title), sub && h('div', 'doc-sub', sub)),
        refs && kids(h('div', 'doc-ref'), refs.map(([k, v]) => kids(h('div', null), h('span', 'k', k), h('b', 'mono', v))))),
      stage && flow(stage));
    root.append(p);
    return p;
  }
  function table(cols, widths, rows, rowCls) {
    const t = h('table', 'tbl sd-tbl');
    const cg = h('colgroup');
    widths.forEach((w) => { const c = h('col'); c.style.width = w; cg.append(c); });
    t.append(cg);
    const hr = h('tr');
    cols.forEach((c) => hr.append(h('th', null, c)));
    t.append(kids(h('thead'), hr));
    const tb = h('tbody');
    rows.forEach((r, i) => {
      const tr = h('tr', rowCls ? rowCls(i) : null);
      r.forEach((v) => tr.append(v instanceof Node ? kids(h('td'), v) : h('td', null, v == null ? '' : String(v))));
      tb.append(tr);
    });
    t.append(tb);
    return t;
  }
  const signRow = (labels) => kids(h('div', 'sign'), labels.map((l) => kids(h('div', null), h('span', 'k', l), h('div', 'line', '______________________'))));
  const box = (title, ...content) => kids(h('div', 'box'), h('h4', null, title), ...content);
  const list = (tag, items) => kids(h(tag), items.map((s) => h('li', null, s)));
  const foot = (t) => h('p', 'demo-foot', t || 'DEMO DATA · fictional customers, numbers and tracking. Not an SAP EWM, carrier or Descartes printout.');

  /* ===================== Bill of lading (line haul) ===================== */
  (function bol() {
    const w = PS.weights;
    const hus = allHus();
    const total = hus.reduce((s, x) => s + (w[x.hu] || 0), 0) + (w.pallet || 0);
    const p = page('BOL', 'BILL OF LADING', 'Straight bill of lading · not negotiable · line haul', [
      ['BOL no', PS.bol], ['Ship date', OB.lineHaul.depart], ['Shipment / TU', `${WT.shipment || '-'} / ${WT.tu || '-'}`], ['Seal no', PS.sealNo]], 'Line haul');
    kids(p,
      kids(h('div', 'parties4'),
        kids(h('div', null), h('span', 'k', 'Shipper'), addr(OB.shipFrom)),
        kids(h('div', null), h('span', 'k', 'Consignee (deliver to)'), addr(PS.hub)),
        kids(h('div', null), h('span', 'k', 'Carrier'), h('b', null, OB.lineHaul.carrier), h('div', null, `Trailer ${OB.lineHaul.trailer}`), h('div', null, `Driver: ${PS.driver}`)),
        kids(h('div', null), h('span', 'k', 'Freight terms / bill to'), h('b', null, 'Prepaid · internal transfer'), h('div', null, 'HD Supply – GA02 DC'),
          h('div', null, `Deliveries ${OB.orders.map((o) => o.delivery).join(', ')}`))),
      table(['Handling unit / SSCC', 'Pieces', 'Description', 'Weight', 'HM', 'Onward carrier · route'],
        ['36mm', '14mm', '58mm', '16mm', '12mm', '50mm'],
        hus.map((x) => [bc('00' + x.sscc, x.hu), '1 ctn', `${contentsText(x)} · ${x.o.so}`, `${w[x.hu] || '-'} lb`, isHaz(x) ? 'X' : '',
          `${x.o.service} · ${x.o.route} stop ${x.o.stop}/${x.o.stops}`])
          .concat([[bc('00' + OB.pallet.sscc, OB.pallet.hu), '1 pallet', `Outbound pallet (tare) · nests ${OB.pallet.contains.join(' + ')}`, `${w.pallet} lb`, '', 'Cross-dock at hub'],
            ['TOTAL', `${hus.length} ctn / 1 plt`, '', `${total} lb`, '', '']]),
        (i) => (i === hus.length + 1 ? 'total' : (hus[i] && isHaz(hus[i]) ? 'haz' : null))),
      box('Hazardous material', h('p', null,
        'HM = X: carton HU-1002 contains 2 × chemical bottle (industrial cleaner, 1 L), shipped as limited quantity. ' +
        'Handle per the SDS; keep upright; do not stack heavy freight on it. (Demo wording – use the real SDS and shipping description in production.)')),
      box('Special instructions', list('ul', [
        `Cross-dock at the hub: ${OB.routes.map((r) => `${r.id} → ${r.carrier}`).join(', ')}.`,
        'Keep HU-1003 (fridge) upright. Do not break the pallet before the hub scans it in.',
        `Seal ${PS.sealNo} must be intact on arrival; note any exceptions below.`])),
      h('div', 'checks', ['☐ Seal intact on arrival', '☐ Count agrees (3 ctn / 1 plt)', '☐ Exceptions noted']
        .map((c) => h('div', null, c))),
      signRow(['Shipper – signature / date', 'Carrier driver – signature / date', 'Consignee (hub) – signature / date']),
      foot());
  })();

  /* ===================== Carrier manifest (hub → FedEx / UPS) ===================== */
  (function manifest() {
    const p = page('MANIFEST', 'CARRIER MANIFEST', 'For the hub lead and the FedEx and UPS drivers', [
      ['Hub', PS.hub.name], ['Date', OB.routes[0].hubDepart.split(' ')[0]], ['Inbound line haul', `${OB.lineHaul.trailer} · ${PS.bol}`], ['Pallet', OB.pallet.hu]], 'Hub');
    OB.routes.forEach((r) => {
      const rows = [];
      r.stops.filter((s) => s.so).forEach((s) => {
        const o = order(s.so);
        husOf(o).forEach((x) => rows.push({ o, x, s }));
      });
      const wt = rows.reduce((n, z) => n + (PS.weights[z.x.hu] || 0), 0);
      kids(p,
        kids(h('div', 'route ' + r.carrier.toLowerCase()),
          kids(h('div', 'route-head'), h('b', null, `${r.carrier} · ${r.service} · route ${r.id}`), h('span', null, `Departs hub ${r.hubDepart} · ${r.vehicle}`)),
          table(['Tracking (demo)', 'HU', 'Ship to', 'Stop', 'ETA', 'Weight', 'HM', 'Scanned'],
            ['37mm', '18mm', '47mm', '13mm', '12mm', '14mm', '9mm', '22mm'],
            rows.map((z) => [bc(z.x.tracking), z.x.hu, `${z.o.customer.name}, ${z.o.customer.city} · ${z.o.so}`, `${z.s.no}/${r.stops.length}`, z.s.eta,
              `${PS.weights[z.x.hu] || '-'} lb`, isHaz(z.x) ? 'X' : '', '☐ Out  ☐ Del']),
            (i) => (isHaz(rows[i].x) ? 'haz' : null)),
          h('p', 'muted', `${rows.length} carton(s) · ${wt} lb · driver signature on pickup: ______________________`)));
    });
    kids(p,
      h('div', 'note-strip', 'Before the FedEx cartons leave the hub, their labels must print. See IT ticket INC-000008 if the FedEx label fails.'),
      signRow(['Hub lead', 'FedEx driver', 'UPS driver']),
      foot());
  })();

  /* ===================== IT tickets (film IT 7 and IT 8) ===================== */
  PS.itTickets.forEach((t) => {
    const p = page(t.key, 'IT TICKET', t.title, [['Ticket', t.id], ['Priority', t.priority], ['Raised', t.raisedAt], ['Resolved', t.resolvedAt]], 'Hub');
    kids(p,
      kids(h('div', 'ticket-grid'),
        kids(h('div', null), h('span', 'k', 'Raised by'), h('b', null, t.raisedBy)),
        kids(h('div', null), h('span', 'k', 'Assigned to'), h('b', null, 'EWM IT team (demo)')),
        kids(h('div', null), h('span', 'k', 'Area'), h('b', null, t.area)),
        kids(h('div', null), h('span', 'k', 'Shipment'), h('b', null, `${WT.shipment || '-'} · ${PS.bol}`)),
        kids(h('div', null), h('span', 'k', 'Handling units'), h('b', null, t.key === 'IT-HUB' ? `${OB.pallet.hu} (${OB.pallet.contains.join(', ')})` : 'HU-1001, HU-1003')),
        kids(h('div', null), h('span', 'k', 'Deliveries'), h('b', null, t.key === 'IT-HUB' ? OB.orders.map((o) => o.delivery).join(', ') : order('SO-5001').delivery))),
      box('What happened (RF / system error)', h('p', null, t.symptom)),
      box('Root cause', h('p', null, t.cause)),
      box('Fix applied by IT', list('ol', t.fix)),
      box('Verified', h('p', null, t.key === 'IT-HUB'
        ? 'Hub rescan of HU-P01 succeeded; all 3 cartons received at the hub and released to cross-dock.'
        : 'FedEx accepted the label requests; HU-1001 and HU-1003 labelled and loaded on FedEx van FX-12.')),
      box('Prevent it next time', h('p', null, t.prevent)),
      kids(h('div', 'status-row'), h('span', 'stamp-print', 'RESOLVED'), h('span', 'muted', `Closed ${t.resolvedAt} · confirmed by ${t.raisedBy}`)),
      signRow(['Fixed by (IT)', 'Confirmed by (hub)', 'Date / time']),
      foot('DEMO DATA · mock IT ticket from the Mini Warehouse film. Not a real incident record.'));
  });

  /* ===================== Proof of delivery (one per customer) ===================== */
  PS.pods.forEach((pod) => {
    const o = order(pod.so);
    const r = routeOf(o);
    const stop = r.stops.find((s) => s.so === o.so);
    const p = page('POD', 'PROOF OF DELIVERY', `${o.service} · final leg`, [
      ['Order', o.so], ['Delivery', o.delivery], ['Route / stop', `${o.route} · ${stop.no} of ${r.stops.length}`], ['Delivered', pod.delivered]], 'POD');
    kids(p,
      kids(h('div', 'parties4'),
        kids(h('div', null), h('span', 'k', 'Delivered to'), addr(o.customer)),
        kids(h('div', null), h('span', 'k', 'Delivered by'), h('b', null, o.carrier), h('div', null, pod.vehicle),
          h('div', null, `Planned ETA ${stop.eta} · Descartes route ${o.route}`), h('div', null, `Customer PO ${o.custPo}`))),
      table(['Carton / tracking', 'Contents', 'Delivered', 'Condition'],
        ['46mm', '78mm', '26mm', '36mm'],
        husOf(o).map((x) => [bc(x.tracking, `${x.hu} · ${x.tracking}`), contentsText(x), `${x.lines.reduce((n, l) => n + l.qty, 0)} pcs`, '☐ Good  ☐ Damaged'])),
      h('div', 'note-strip', 'Signing confirms the cartons above were received. Note any damage or shortage now; signing the POD releases the invoice.'),
      kids(h('div', 'big-sign'),
        kids(h('div', null), h('span', 'k', 'Customer signature'), h('div', 'sigbox')),
        kids(h('div', null), h('span', 'k', 'Print name / date / time'), h('div', 'sigbox'))),
      h('p', 'muted', 'Exceptions noted at delivery: ________________________________________________'),
      signRow(['Driver', 'Driver ID', 'Delivered at (time)']),
      foot());
  });

  /* ===================== Invoice (one per customer, released by the POD) ===================== */
  (PS.invoices || []).forEach((inv) => {
    const o = order(inv.so);
    const pod = PS.pods.find((x) => x.so === inv.so) || {};
    const lines = o.lines.filter((l) => !l.service || l.price);
    const subtotal = lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
    const total = subtotal + (inv.freight || 0);
    const p = page('INVOICE', 'INVOICE', `Customer invoice · ${o.service}`, [
      ['Invoice no', inv.id], ['Invoice date', inv.date], ['Customer no', o.customerNo], ['Customer PO', o.custPo]], 'Invoice');
    kids(p,
      kids(h('div', 'parties4'),
        kids(h('div', null), h('span', 'k', 'Bill to'), addr(o.customer)),
        kids(h('div', null), h('span', 'k', 'Ship to'), addr(o.customer)),
        kids(h('div', null), h('span', 'k', 'Sold by / ship from'), addr(OB.shipFrom)),
        kids(h('div', null), h('span', 'k', 'Order & delivery'),
          h('div', null, `Sales order ${o.so} · delivery ${o.delivery}`),
          h('div', null, `Shipped via ${o.service} · ${o.route} stop ${o.stop}/${o.stops}`),
          h('div', null, `Delivered ${pod.delivered || '-'} · POD signed`))),
      table(['Item', 'Material', 'Description', 'Qty', 'Unit price', 'Amount'],
        ['14mm', '22mm', '84mm', '18mm', '24mm', '24mm'],
        lines.map((l) => [l.line, l.material || l.sku, l.desc || item(l.sku).desc, `${l.qty} ${l.uom}`, `${money(l.price)}`, `${money((l.price || 0) * l.qty)}`])
          .concat([
            ['', '', 'Subtotal', '', '', money(subtotal)],
            ['', '', 'Freight', '', '', inv.freight ? money(inv.freight) : 'Included'],
            ['', '', 'Sales tax', '', '', 'Not calculated (demo)'],
            ['', '', `TOTAL DUE (USD)`, '', '', money(total)]]),
        (i) => (i === lines.length + 3 ? 'total' : null)),
      kids(h('div', 'parties4'),
        kids(h('div', null), h('span', 'k', 'Payment terms'), h('b', null, inv.terms), h('div', null, `Due ${inv.due}`),
          h('div', null, `Please quote ${inv.id} with your payment.`)),
        kids(h('div', null), h('span', 'k', 'Remit to'), addr(PS.remitTo))),
      PS.rma && PS.rma.so === inv.so
        ? h('div', 'note-strip', `Return ${PS.rma.id} (${PS.rma.qty} ${PS.rma.uom} ${item(PS.rma.sku).product.toLowerCase()}) will be credited separately on credit memo request ${PS.scrap.creditMemo} after inspection.`)
        : null,
      kids(h('div', 'foot-row'), barcode(inv.id, 40), h('span', 'muted', `Released by POD · ${o.delivery} · ${pod.delivered || ''}`)),
      foot('DEMO DATA · fictional customer, prices and invoice numbers. No tax calculated. Not an SAP billing document.'));
  });

  /* ===================== Return authorisation (RMA) ===================== */
  const rma = PS.rma;
  const rmaOrder = order(rma.so);
  const rmaItem = item(rma.sku);
  const rmaLine = rmaOrder.lines.find((l) => l.sku === rma.sku);
  (function rmaDoc() {
    const p = page('RMA', 'RETURN AUTHORISATION', 'Customer return · RMA', [
      ['RMA', rma.id], ['Raised', rma.raised], ['Original order', `${rma.so} · ${rmaOrder.delivery}`], ['Return label', rma.returnLabel]], 'Return');
    kids(p,
      kids(h('div', 'parties4'),
        kids(h('div', null), h('span', 'k', 'Customer (return from)'), addr(rmaOrder.customer)),
        kids(h('div', null), h('span', 'k', 'Return to'), addr({ name: OB.shipFrom.name, street: rma.returnTo, city: OB.shipFrom.city, postal: OB.shipFrom.postal }))),
      table(['Item', 'Description', 'Qty', 'Unit price', 'Reason'],
        ['26mm', '62mm', '16mm', '22mm', '60mm'],
        [[rma.sku, `${rmaItem.desc} · UPC ${rmaItem.upc}`, `${rma.qty} ${rma.uom}`, `${money(rmaLine ? rmaLine.price : 0)} USD`, rma.reason]]),
      box('Return instructions', list('ol', [
        `Pack the item in its original carton and stick return label ${rma.returnLabel} (${rma.returnCarrier}).`,
        `Write ${rma.id} on the outside of the carton.`,
        `GA02 receives it to ${rma.returnTo.split('·').pop().trim()} for quality inspection.`,
        'Credit is decided after inspection.'])),
      kids(h('div', 'foot-row'), barcode(rma.id, 40), h('span', 'muted', `Authorised by ${rma.authorisedBy}`)),
      signRow(['Authorised by', 'Customer contact', 'Date']),
      foot());
  })();

  /* ===================== Return inspection (QI) ===================== */
  const qi = PS.qi;
  (function qiDoc() {
    const p = page('QI', 'RETURN INSPECTION', 'Quality inspection report', [
      ['Inspection lot', qi.id], ['Inspected', qi.inspected], ['RMA', rma.id], ['Location', qi.location]], 'Inspection');
    kids(p,
      table(['Item', 'Description', 'Qty', 'From'], ['26mm', '90mm', '16mm', '54mm'],
        [[rma.sku, rmaItem.desc, `${rma.qty} ${rma.uom}`, `${rmaOrder.customer.name} · ${rma.so}`]]),
      h('h3', null, 'Checks'),
      table(['Check', 'Finding', 'OK?'], ['50mm', '116mm', '20mm'],
        qi.checks.map(([c, f]) => [c, f, /no|crack|broken|fail/i.test(f) ? '✗' : '✓'])),
      box('Result', h('p', null, qi.result)),
      box('Usage decision', h('p', null, `${qi.decision.toUpperCase()} – not resaleable. Raise scrap document ${PS.scrap.id} and credit memo request ${PS.scrap.creditMemo} for the customer.`)),
      signRow(['Inspector', 'QA lead', 'Date']),
      foot());
  })();

  /* ===================== Scrap / write-off ===================== */
  (function scrapDoc() {
    const s = PS.scrap;
    const value = (rmaLine ? rmaLine.price : 0) * rma.qty;
    const p = page('SCRAP', 'SCRAP / WRITE-OFF', 'Stock written off · loop closed', [
      ['Scrap document', s.id], ['Posted', s.posted], ['Reference', `${rma.id} · ${qi.id}`], ['Plant', D.site.whn]], 'Scrap');
    kids(p,
      table(['Material', 'Description', 'Qty', 'Value', 'Movement type', 'From'],
        ['20mm', '58mm', '14mm', '22mm', '38mm', '34mm'],
        [[rmaLine ? rmaLine.material : rma.sku, rmaItem.desc, `${rma.qty} ${rma.uom}`, `${money(value)} USD`, s.movementType, qi.location]]),
      kids(h('div', 'parties4'),
        kids(h('div', null), h('span', 'k', 'Reason'), h('b', null, s.reasonCode), h('div', null, qi.result)),
        kids(h('div', null), h('span', 'k', 'Charged to'), h('b', null, s.costCenter), h('div', null, `Customer credit memo request ${s.creditMemo} · ${money(value)} USD`))),
      box('Disposal', list('ol', [
        `Remove the item from ${qi.location} and place it in the scrap bin.`,
        'Dispose of broken glass safely.',
        `Post ${s.id}: stock is written off and the inventory value is removed from the books.`,
        `${s.creditMemo} goes to billing so the customer is credited. The return loop is closed.`])),
      signRow(['Scrapped by', 'Approved by (finance)', 'Date']),
      foot());
  })();

  // ?only=KEY keeps just that document (e.g. for a single PDF)
  const only = new URLSearchParams(window.location.search).get('only');
  if (only) document.querySelectorAll('#docs > .page').forEach((pg) => { if (pg.getAttribute('data-doc') !== only.toUpperCase()) pg.remove(); });

  document.getElementById('print').addEventListener('click', () => window.print());
  document.body.setAttribute('data-ready', '1');
})();
