/* Builds printable Code 128 test labels from data.js (textContent only). */
(function () {
  'use strict';
  const D = window.RF_DATA;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function barcode(value) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (window.JsBarcode) {
      window.JsBarcode(svg, value, {
        format: 'CODE128', width: 2, height: 70, fontSize: 16, margin: 8,
        font: 'monospace', textMargin: 4, background: '#FFFFFF'
      });
    }
    return svg;
  }

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

  const pallets = document.getElementById('pallets');
  D.asn.forEach((a) => pallets.append(
    label('Pallet LPN', a.lpn, a.desc, `${a.po} · ${a.qty} ${a.uom} · ${D.asnId}`, null, a.product)));

  const products = document.getElementById('products');
  D.asn.forEach((a) => products.append(
    label('Product', a.sku, a.desc, `${a.vendor} · ${a.uom}`, null, a.product)));

  const bins = document.getElementById('bins');
  D.asn.forEach((a) => bins.append(label('Bin', a.bin, null, `Putaway for ${a.product} (${a.sku})`, 'bin')));

  const exc = document.getElementById('exceptions');
  exc.append(label('Pallet LPN', D.unknownLpn, 'Pallet NOT on ASN', 'Scan at receiving to see the blind-receipt exception'));
  exc.append(label('Bin', D.qaBin, null, 'QA hold – damaged / unknown pallets', 'bin'));
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
