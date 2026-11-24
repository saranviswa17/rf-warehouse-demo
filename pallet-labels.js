/* Vendor pallet labels, 100 x 60 mm, one per pallet (textContent only). */
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

  const ssccText = (s) => `(00) ${s.slice(0, 1)} ${s.slice(1, 8)} ${s.slice(8, 17)} ${s.slice(17)}`;
  function ssccBarcode(s) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) {
      window.JsBarcode(svg, '00' + s, {
        format: 'CODE128', ean128: true, width: 2, height: 52, margin: 10,
        displayValue: true, text: ssccText(s), font: 'monospace', fontSize: 15, textMargin: 2, background: '#FFFFFF'
      });
    }
    return svg;
  }

  const pallets = SH.pallets || [];
  const total = pallets.length;
  const sheet = document.getElementById('sheet');

  pallets.forEach((p) => {
    const lines = D.asn.filter((a) => a.pallet === p.no);
    const units = lines.reduce((n, a) => n + a.qty, 0);
    const haz = lines.some((a) => a.hazmat);
    const v = SH.vendor || {}, t = SH.shipTo || {};

    const lab = h('div', 'plabel' + (haz ? ' haz' : ''));
    kids(lab,
      kids(h('div', 'pl-top'),
        h('span', 'pl-title', 'PALLET LABEL'),
        h('span', 'pl-count', `PALLET ${p.no} OF ${total}`)),
      kids(h('div', 'pl-parties'),
        kids(h('div', null), h('span', 'k', 'FROM'), h('b', null, v.name), h('span', null, `${v.street}, ${v.city}`)),
        kids(h('div', null), h('span', 'k', 'SHIP TO'), h('b', null, t.name), h('span', null, `${t.street}, ${t.city} ${t.postal || ''}`))),
      kids(h('div', 'pl-refs'),
        kids(h('div', null), h('span', 'k', 'PO'), h('b', null, SH.po)),
        kids(h('div', null), h('span', 'k', 'ASN'), h('b', null, D.asnId)),
        kids(h('div', null), h('span', 'k', 'SHIP'), h('b', null, SH.shipDate)),
        kids(h('div', null), h('span', 'k', 'WEIGHT'), h('b', null, p.weight || '-'))),
      kids(h('div', 'pl-contents'),
        h('span', 'k', `CONTENTS · ${lines.length} CARTONS · ${units} UNITS`),
        h('span', null, lines.map((a) => `${a.product} ${a.qty} ${a.uom}`).join(' · '))),
      kids(h('div', 'pl-code'), ssccBarcode(p.sscc)),
      kids(h('div', 'pl-foot'),
        h('span', null, SH.truck ? `Truck ${SH.truck.trailer} · Seal ${SH.truck.seal} · DC ${SH.dc}` : `DC ${SH.dc}`),
        haz ? h('span', 'pl-haz', 'CONTAINS HAZMAT') : h('span', 'pl-demo', 'DEMO DATA')));
    sheet.append(lab);
  });

  // Compact carton labels (ship-from / ship-to stay on the pallet label)
  const cartons = document.getElementById('cartons');
  if (cartons && window.renderCartonLabel) {
    D.asn.forEach((a, i) => cartons.append(window.renderCartonLabel(a, i, D)));
  }
  // Product UPC labels (the vendor's product barcode, scanned at putaway)
  const upcs = document.getElementById('upcs');
  if (upcs && window.renderUpcLabel) {
    D.asn.filter((a) => a.upc).forEach((a) => upcs.append(window.renderUpcLabel(a)));
  }

  document.getElementById('print').addEventListener('click', () => window.print());
})();
