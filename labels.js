/* Builds the printable demo paperwork from data.js (textContent only):
 * ASN document, pallet label, carton shipping labels (GS1-128 SSCC),
 * product, bin and exception labels. */
(function () {
  'use strict';
  const D = window.RF_DATA;
  const SH = D.shipment || {};
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const kids = (el, ...list) => { list.flat().filter(Boolean).forEach((k) => el.append(k)); return el; };

  /** Code 128 barcode; gs1 = GS1-128 (FNC1) with a custom human-readable line. */
  function barcode(value, opts) {
    const o = opts || {};
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) {
      window.JsBarcode(svg, value, {
        format: 'CODE128', ean128: !!o.gs1, width: o.width || 2, height: o.height || 70,
        fontSize: o.fontSize || 16, margin: 8, font: 'monospace', textMargin: 4,
        background: '#FFFFFF', text: o.text || value, displayValue: o.display !== false
      });
    }
    return svg;
  }

  // (00) 0 0614141 000000101 9 - readable SSCC grouping
  const ssccText = (s) => `(00) ${s.slice(0, 1)} ${s.slice(1, 8)} ${s.slice(8, 17)} ${s.slice(17)}`;
  const ssccBar = (s, o) => barcode('00' + s, Object.assign({ gs1: true, text: ssccText(s) }, o));

  function label(kind, value, title, meta, cls, product) {
    const box = h('div', 'label' + (cls ? ' ' + cls : ''));
    const head = h('div', 'head');
    head.append(h('span', 'kind', kind), h('span', 'meta', D.site.name));
    box.append(head);
    if (product) box.append(h('div', 'product', product));
    if (cls === 'bin') box.append(h('div', 'big', value));
    if (title) box.append(h('div', 'title', title));
    if (meta) box.append(h('p', 'meta', meta));
    box.append(barcode(value));
    return box;
  }

  const addr = (a) => kids(h('div', 'addr'), h('b', null, a.name), h('div', null, a.street), h('div', null, a.city + (a.postal ? ' ' + a.postal : '')));

  /* ---------- 2 · ASN document ---------- */
  (function asnDoc() {
    const doc = h('div', 'doc');
    kids(doc,
      kids(h('div', 'doc-head'),
        kids(h('div', null), h('div', 'doc-title', 'ASN'), h('div', 'doc-sub', 'Advanced Shipping Notice')),
        kids(h('div', 'doc-ref'),
          kids(h('div', null), h('span', 'k', 'ASN no'), h('b', 'mono', D.asnId)),
          kids(h('div', null), h('span', 'k', 'PO no'), h('b', 'mono', SH.po || '-')),
          kids(h('div', null), h('span', 'k', 'Ship date'), h('b', null, SH.shipDate || '-')),
          kids(h('div', null), h('span', 'k', 'Delivery'), h('b', null, SH.deliveryDate || '-')))),
      kids(h('div', 'doc-parties'),
        kids(h('div', null), h('span', 'k', 'Sender (vendor)'), SH.vendor && addr(SH.vendor)),
        kids(h('div', null), h('span', 'k', 'Receiver (ship to)'), SH.shipTo && addr(SH.shipTo)),
        kids(h('div', null), h('span', 'k', 'Truck / pallets'),
          SH.truck && h('div', null, `${SH.truck.carrier} · trailer ${SH.truck.trailer} · seal ${SH.truck.seal}`),
          (SH.pallets || []).map((p) => h('div', 'mono',
            `P${p.no}: ${p.sscc} · ${D.asn.filter((a) => a.pallet === p.no).length} cartons · ${p.weight}`)))));
    const table = h('table', 'doc-table');
    const thead = h('thead');
    const hr = h('tr');
    ['Line', 'Pallet', 'Item no', 'Description', 'Qty', 'UoM', 'Batch', 'Use by', 'Carton SSCC'].forEach((c) => hr.append(h('th', null, c)));
    thead.append(hr);
    const tbody = h('tbody');
    D.asn.forEach((a) => {
      const tr = h('tr', a.hazmat ? 'haz' : null);
      [String(a.line || ''), a.pallet ? `P${a.pallet}` : '–', a.sku, a.desc, String(a.qty), a.uom, a.batch || '–', a.useBy || '–', a.lpn]
        .forEach((v, i) => tr.append(h('td', i === 2 || i === 8 ? 'mono' : null, v)));
      tbody.append(tr);
    });
    table.append(thead, tbody);
    doc.append(table,
      h('p', 'doc-foot', 'DEMO DATA · fictional vendor and numbers. Hazmat lines are shaded. Vendor ships the ASN to EWM before the truck arrives.'));
    document.getElementById('asn-doc').append(doc);
  })();

  /* ---------- 3 · Pallet label ---------- */
  (function palletLabels() {
    const all = SH.pallets || [];
    all.forEach((p) => {
      const lines = D.asn.filter((a) => a.pallet === p.no);
      const units = lines.reduce((n, a) => n + a.qty, 0);
      const box = h('div', 'label pallet-label');
      kids(box,
        h('div', 'pl-title', 'PALLET LABEL'),
        h('div', 'pl-sscc', `Pallet ${p.no} of ${all.length} · SSCC: ${p.sscc}`),
        ssccBar(p.sscc, { height: 90 }),
        kids(h('dl', 'pl-kv'),
          h('dt', null, 'Contents'), h('dd', null, `${lines.length} cartons · ${units} units: ${lines.map((a) => a.product).join(', ')}`),
          h('dt', null, 'PO / ASN'), h('dd', 'mono', `${SH.po} / ${D.asnId}`),
          h('dt', null, 'Ship date'), h('dd', null, SH.shipDate || '-'),
          h('dt', null, 'Weight'), h('dd', null, p.weight || '-'),
          h('dt', null, 'Sender'), h('dd', null, SH.vendor ? SH.vendor.name : '-'),
          h('dt', null, 'Receiver'), h('dd', null, SH.shipTo ? SH.shipTo.name : '-')),
        lines.some((a) => a.hazmat) && h('div', 'pl-haz', 'CONTAINS HAZMAT – see carton labels'));
      document.getElementById('pallet').append(box);
    });
  })();

  /* ---------- 4 · Compact carton labels (45 x 45 mm, see carton-label.js) ----------
   * Ship-from / ship-to are on the pallet label, so the carton label only
   * identifies the carton: SSCC (QR + GS1-128), product, qty, PO, batch. */
  (function cartonLabels() {
    const grid = document.getElementById('cartons');
    if (!grid || !window.renderCartonLabel) return;
    D.asn.forEach((a, i) => grid.append(window.renderCartonLabel(a, i, D)));
  })();

  /* ---------- 5 · Product barcodes ---------- */
  const products = document.getElementById('products');
  // Product UPC labels (scanned at putaway and picking); fall back to the SKU if a product has no UPC
  products.classList.add('clabel-grid');
  products.classList.remove('grid');
  D.asn.forEach((a) => products.append(a.upc && window.renderUpcLabel
    ? window.renderUpcLabel(a)
    : label('Product', a.sku, a.desc, `${a.vendor} · ${a.uom}`, null, a.product)));

  /* ---------- 6 · Bin labels ---------- */
  const bins = document.getElementById('bins');
  D.asn.forEach((a) => bins.append(label('Bin', a.bin, null, `Putaway for ${a.product} (${a.sku})`, 'bin')));

  /* ---------- 7 · Exception scenarios ---------- */
  const exc = document.getElementById('exceptions');
  exc.append(label('Carton LPN', D.unknownLpn, 'Carton NOT on ASN', 'Scan at receiving to see the blind-receipt exception'));
  exc.append(label('Bin', D.qaBin, null, 'QA hold – damaged / unknown cartons', 'bin'));
  (D.itIssues || []).filter((i) => i.id === 'EAN').forEach((i) => {
    const line = D.asn.find((a) => a.sku === i.sku);
    exc.append(label('Vendor EAN-13', i.ean, `${line ? line.product : i.sku} case – vendor label only`,
      'IT moment: scan at receiving – not recognised until IT maps the EAN'));
  });
  D.altBins.forEach((b) => exc.append(label('Bin', b, null, 'Alternate bin (when directed bin is blocked)', 'bin')));

  // QR code that opens the RF app
  const appUrl = new URL('index.html', window.location.href).href;
  document.getElementById('app-url').textContent = appUrl;
  if (window.QRCode) {
    // eslint-disable-next-line no-new
    new window.QRCode(document.getElementById('app-qr'), {
      text: appUrl, width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M
    });
  }

  document.getElementById('print').addEventListener('click', () => window.print());
})();
