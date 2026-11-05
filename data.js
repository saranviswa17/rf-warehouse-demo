/*
 * Demo master data for the RF Receiving & Putaway web app.
 * Edit this file to change the site, the expected pallets (ASN lines)
 * and the putaway bins used in the warehouse-experience demo.
 * All values are fictional demo data - no live system is called.
 *
 * lpn = pallet license plate barcode, sku = product barcode, bin = putaway bin.
 */
window.RF_DATA = Object.freeze({
  site: { name: 'Atlanta DC', dock: 'DOCK-01' },
  asnId: 'ASN-DEMO-01',

  // Pallets expected on the open inbound delivery (ASN) - one per demo product
  asn: [
    { lpn: 'LPN-D0001', po: 'PO-D1001', vendor: 'Demo Vendor A - Appliances',
      sku: 'SKU-FRIDGE', product: 'Fridge', desc: 'Fridge - Top-Freezer Refrigerator, 18 cu. ft., White',
      qty: 4, uom: 'EA', bin: 'D-01-01-A' },
    { lpn: 'LPN-D0002', po: 'PO-D1002', vendor: 'Demo Vendor B - Packaging',
      sku: 'SKU-BOTTLE', product: 'Glass bottle', desc: 'Glass Bottle - 16 oz, Clear, Case of 24',
      qty: 60, uom: 'CS', bin: 'A-03-02-B' },
    { lpn: 'LPN-D0003', po: 'PO-D1003', vendor: 'Demo Vendor C - Janitorial',
      sku: 'SKU-TPROLL', product: 'Toilet paper rolls', desc: 'Toilet Paper Rolls - 2-Ply, 96 Rolls per Case',
      qty: 40, uom: 'CS', bin: 'B-08-01-A' },
    { lpn: 'LPN-D0004', po: 'PO-D1004', vendor: 'Demo Vendor D - Electrical',
      sku: 'SKU-BULB', product: 'Bulb', desc: 'Bulb - 9W A19 LED, 60W Equivalent, 4-Pack',
      qty: 200, uom: 'PK', bin: 'C-02-04-D' },
    { lpn: 'LPN-D0005', po: 'PO-D1004', vendor: 'Demo Vendor D - Electrical',
      sku: 'SKU-BATTERY', product: 'Battery', desc: 'Battery - AA Alkaline, 24-Pack',
      qty: 150, uom: 'PK', bin: 'C-04-03-C' },
    { lpn: 'LPN-D0006', po: 'PO-D1001', vendor: 'Demo Vendor A - Appliances',
      sku: 'SKU-WASHER', product: 'Washing machine', desc: 'Washing Machine - Top-Load, 4.5 cu. ft., White',
      qty: 4, uom: 'EA', bin: 'D-02-01-A' },
    { lpn: 'LPN-D0007', po: 'PO-D1005', vendor: 'Demo Vendor E - HVAC',
      sku: 'SKU-THERMO', product: 'Thermostat', desc: 'Thermostat - 7-Day Programmable, Digital',
      qty: 48, uom: 'EA', bin: 'A-07-03-B' },
    { lpn: 'LPN-D0008', po: 'PO-D1005', vendor: 'Demo Vendor E - HVAC',
      sku: 'SKU-HEATX', product: 'Heat exchanger', desc: 'Heat Exchanger - Furnace, 80,000 BTU',
      qty: 10, uom: 'EA', bin: 'B-12-01-A' },
    { lpn: 'LPN-D0009', po: 'PO-D1005', vendor: 'Demo Vendor E - HVAC',
      sku: 'SKU-COMPR', product: 'Compressor', desc: 'Compressor - HVAC Scroll, 3 Ton',
      qty: 8, uom: 'EA', bin: 'B-14-02-A' },
    { lpn: 'LPN-D0010', po: 'PO-D1006', vendor: 'Demo Vendor E - HVAC',
      sku: 'SKU-FILTER', product: 'Filter', desc: 'Filter - Pleated Air Filter, 20x25x1, MERV 8, 12-Pack',
      qty: 80, uom: 'CS', bin: 'A-04-02-C' }
  ],

  // Used when the directed bin is full / blocked
  altBins: ['A-04-05-A', 'A-09-01-C', 'C-06-02-B'],

  // Damaged or not-on-ASN pallets are directed here
  qaBin: 'QA-HOLD-01',

  // An LPN that is NOT on the ASN - prints on the test sheet to demo the exception
  unknownLpn: 'LPN-X9999'
});
