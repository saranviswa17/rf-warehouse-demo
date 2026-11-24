/* Compact carton label, 45 x 45 mm (fits a 5 x 5 cm carton face).
 * Ship-from / ship-to live on the pallet label; the carton label only needs
 * to identify the carton: SSCC (QR + GS1-128), product, qty, PO, batch,
 * carton n of N, pallet, hazmat. Uses textContent only.
 * Exposes window.renderCartonLabel(line, index, data). */
(function () {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const kids = (el, ...list) => { list.flat().filter(Boolean).forEach((k) => el.append(k)); return el; };

  function gs1Bar(sscc) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) {
      window.JsBarcode(svg, '00' + sscc, {
        format: 'CODE128', ean128: true, width: 2, height: 40, margin: 10, displayValue: false, background: '#FFFFFF'
      });
    }
    return svg;
  }

  function qr(sscc) {
    const box = h('div', 'cl-qr');
    if (window.QRCode) {
      // eslint-disable-next-line no-new
      new window.QRCode(box, { text: '00' + sscc, width: 160, height: 160, correctLevel: window.QRCode.CorrectLevel.M });
    }
    return box;
  }

  window.renderCartonLabel = function (a, i, D) {
    const SH = D.shipment || {};
    const total = D.asn.length;
    const pallets = (SH.pallets || []).length;
    const s = a.lpn;
    const lab = h('div', 'clabel' + (a.hazmat ? ' haz' : ''));
    kids(lab,
      kids(h('div', 'cl-top'),
        h('span', 'cl-n', `CARTON ${i + 1}/${total}`),
        a.pallet ? h('span', 'cl-p', `PALLET ${a.pallet}/${pallets}`) : null),
      h('div', 'cl-prod', a.product.toUpperCase()),
      h('div', 'cl-qty', `${a.qty} ${a.uom}${a.hazmat && /case of (\d+)/i.test(a.desc) ? ` (${a.desc.match(/case of (\d+)/i)[1]} bottles)` : ''} · ${a.sku}`),
      kids(h('div', 'cl-mid'),
        qr(s),
        kids(h('div', 'cl-info'),
          h('span', 'k', 'HU ID (SSCC)'),
          h('span', 'mono', `${s.slice(0, 9)}`),
          h('span', 'mono', `${s.slice(9)}`),
          h('span', 'k', 'PO'),
          h('span', 'mono', a.po),
          (a.batch || a.useBy) && h('span', 'k', a.batch ? 'BATCH / USE BY' : 'USE BY'),
          (a.batch || a.useBy) && h('span', 'mono', [a.batch, a.useBy].filter(Boolean).join(' · ')))),
      kids(h('div', 'cl-bar'), gs1Bar(s)),
      kids(h('div', 'cl-foot'),
        h('span', 'mono', `(00) ${s}`),
        a.hazmat ? h('span', 'cl-haz', 'HAZMAT') : h('span', null, `DC ${SH.dc || ''}`)));
    return lab;
  };

  /* Product UPC label, 45 x 25 mm: the product barcode scanned at putaway and picking. */
  window.renderUpcLabel = function (a) {
    const lab = h('div', 'ulabel');
    const svg = document.createElementNS(SVG_NS, 'svg');
    // IT moment: a product whose case carries only the vendor's EAN-13 gets that barcode instead of a UPC
    const D = window.RF_DATA || {};
    const ean = (D.itIssues || []).find((i) => i.id === 'EAN' && i.sku === a.sku);
    if (window.JsBarcode && (ean || a.upc)) {
      window.JsBarcode(svg, ean ? ean.ean : a.upc, { format: ean ? 'EAN13' : 'UPC', width: 2, height: 46, margin: 8,
        fontSize: 15, font: 'monospace', textMargin: 1, background: '#FFFFFF' });
    }
    kids(lab,
      kids(h('div', 'ul-top'), h('span', 'ul-prod', a.product.toUpperCase()), h('span', 'ul-k', ean ? 'VENDOR EAN-13' : 'UPC')),
      kids(h('div', 'ul-bar'), svg),
      h('div', 'ul-sku', `${a.sku} · ${a.uom}`));
    return lab;
  };
})();
