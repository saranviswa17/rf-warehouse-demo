/*
 * Demo master data for the RF Receiving & Putaway web app.
 * Edit this file to change the site, the expected pallets (ASN lines)
 * and the putaway bins used in the warehouse-experience demo.
 * All values are fictional demo data - no live system is called.
 *
 * One sample vendor ships one truck with two mixed pallets to HD Supply GA02 DC. Each pallet
 * carries a vendor pallet label (SSCC); each carton on it carries a carton shipping
 * label with its own SSCC. Receiving is per carton: lpn = the carton SSCC.
 * SSCCs are 18 digits with a GS1 check digit, using the GS1 example company
 * prefix 0614141 (demo only). A GS1-128 scan "(00)+SSCC" is also accepted.
 *
 * Bins follow the EWM pattern Aisle-Stack-LevelPosition, e.g. 104-01-B01 =
 * aisle 104, stack 01, level B (upper), position 01. Level A = lower bin.
 * Each storage type has 3 stacks x 2 bins, matching the printed bin labels.
 */
window.RF_DATA = Object.freeze({
  site: { name: 'GA02 DC', whn: 'GA02', dock: 'DOCK-01' },
  asnId: 'ASN-560001',

  // Paperwork header shared by the ASN, the pallet label and the carton labels
  shipment: {
    vendor: { name: 'Sample Vendor Inc.', street: '1234 Industrial Way', city: 'Sample City, ST 00000' },
    shipTo: { name: 'HD Supply – GA02 DC', street: 'Receiving · Dock 01', city: 'Atlanta, GA', postal: '30000' },
    po: '4500098761',
    shipDate: '23-NOV-2026',
    deliveryDate: '24-NOV-2026',
    dc: 'GA02',
    // One truck, two pallets. Each pallet has its own vendor pallet label (SSCC).
    truck: { carrier: 'Sample Freight Lines', trailer: 'TRL-4471', seal: 'SL-90215' },
    pallets: [
      { no: 1, sscc: '106141410000001009', weight: '520 lb', note: 'Appliances' },
      { no: 2, sscc: '106141410000001108', weight: '45 lb', note: 'Small parts + hazmat' }
    ]
  },

  // Storage types on the demo rack. A bin belongs to the type whose aisle it starts with.
  // segregated: stock never moves into or out of this type by alternate / override.
  storageTypes: [
    { code: '3000', name: 'Hazmat', aisle: '110', segregated: true },
    { code: '2000', name: 'Appliance', aisle: '105' },
    { code: '1000', name: 'General', aisle: '104' }
  ],

  // ASN lines: one carton per product. lpn = the carton SSCC, which EWM uses as the HU ID.
  // upc = demo UPC-A product barcode (GS1 example prefix 614141), scanned at putaway.
  // pallet = which of the two pallets the carton is on.
  asn: [
    { lpn: '006141410000001019', po: '4500098761', line: 10, pallet: 1, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-FRIDGE', upc: '614141001002', product: 'Fridge', desc: 'Fridge - Top-Freezer Refrigerator, 18 cu. ft., White',
      qty: 1, uom: 'EA', bin: '105-01-A01' },
    { lpn: '006141410000001026', po: '4500098761', line: 20, pallet: 2, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-BULB', upc: '614141001019', product: 'Bulb', desc: 'Bulb - 9W A19 LED, 60W Equivalent',
      qty: 2, uom: 'EA', bin: '104-01-A01' },
    { lpn: '006141410000001033', po: '4500098761', line: 30, pallet: 2, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-BATTERY', upc: '614141001026', product: 'Battery', desc: 'Battery - AA Alkaline, 24-Pack',
      qty: 2, uom: 'EA', bin: '104-01-B01', batch: 'B2611A', useBy: '2031-11-30' },
    { lpn: '006141410000001040', po: '4500098761', line: 40, pallet: 2, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-CHEM', upc: '614141001033', product: 'Chemical bottle', desc: 'Chemical Bottle - Industrial Cleaner, 1 L, HAZMAT, Case of 4',
      qty: 1, uom: 'CS', bin: '110-03-B01', batch: 'C4417', useBy: '2027-11-30', hazmat: true },
    { lpn: '006141410000001057', po: '4500098761', line: 50, pallet: 1, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-WASHER', upc: '614141001040', product: 'Washing machine', desc: 'Washing Machine - Front-Load, 4.5 cu. ft., Purple',
      qty: 1, uom: 'EA', bin: '105-02-A01' },
    { lpn: '006141410000001064', po: '4500098761', line: 60, pallet: 1, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-PURIFIER', upc: '614141001057', product: 'HVAC air purifier', desc: 'HVAC Air Purifier - Whole-Home, In-Duct, MERV 16',
      qty: 1, uom: 'EA', bin: '105-03-A01' },
    { lpn: '006141410000001071', po: '4500098761', line: 70, pallet: 2, vendor: 'Sample Vendor Inc.',
      sku: 'SKU-CARDBD', upc: '614141001064', product: 'Cardboard sheet', desc: 'Cardboard Sheet - Corrugated, 10 cm length (cut to order at FAB)',
      qty: 1, uom: 'EA', bin: '104-02-A01' }
  ],

  /* ---------------- Outbound (from the Mini Warehouse film) ----------------
   * Two customers -> two sales orders -> two outbound deliveries. EWM sends both
   * deliveries to Descartes, which returns a FedEx route and a UPS route.
   * Each order is packed into its own carton (HU-1001, HU-1002); both are
   * nested on outbound pallet HU-P01 for the HD Supply line haul to the local
   * hub, where they split to the FedEx and UPS vans. All data is fictional. */
  outbound: {
    shipFrom: { name: 'HD Supply – GA02 DC', street: 'Outbound · Dock 04', city: 'Atlanta, GA', postal: '30000' },
    orderDate: '25-NOV-2026',
    lineHaul: { carrier: 'HD Supply fleet', trailer: 'HDS-TRL-208', depart: '25-NOV-2026 22:00', to: 'Local cross-dock hub' },
    pallet: { hu: 'HU-P01', sscc: '106141410000002105', contains: ['HU-1001', 'HU-1003', 'HU-1002'] },
    orders: [
      { so: 'SO-5001', delivery: 'OBD-8001', customerNo: 'C-10442', custPo: 'RA-7781',
        customer: { name: 'Riverside Apartments', attn: 'Maintenance Shop', street: '100 Riverside Way (demo)', city: 'Atlanta, GA', postal: '30000' },
        requested: '26-NOV-2026', carrier: 'FedEx', service: 'FedEx Ground', route: 'RT-0425', stop: 2, stops: 3,
        hu: 'HU-1001', huSscc: '006141410000002016', tracking: 'DEMO-FX-000425-02', pack: 'PS-BOX-M',
        // The fridge ships in its own carton, so this order has two handling units
        extraHus: [{ hu: 'HU-1003', sscc: '006141410000002030', tracking: 'DEMO-FX-000425-03', note: 'Fridge – ships in own carton' }],
        lines: [
          { line: 10, sku: 'SKU-BULB', material: '990101', qty: 2, uom: 'EA', price: 4.98 },
          { line: 20, sku: 'SKU-BATTERY', material: '990102', qty: 2, uom: 'EA', price: 12.47 },
          // Customer requirement only: 8 cm. Fabrication order FAB-0001 does the cut.
          { line: 30, sku: 'SKU-CARDBD', material: '990106', qty: 1, uom: 'EA', price: 1.25, vas: 'FAB-0001',
            desc: 'Cardboard Sheet - Corrugated, 8 cm' },
          { line: 40, sku: 'SKU-FRIDGE', material: '990100', qty: 1, uom: 'EA', price: 549.00, hu: 'HU-1003' }
        ] },
      { so: 'SO-5002', delivery: 'OBD-8002', customerNo: 'C-20917', custPo: 'OSL-3310',
        customer: { name: 'Oakwood Senior Living', attn: 'Facilities', street: '55 Oakwood Lane (demo)', city: 'Marietta, GA', postal: '30000' },
        requested: '26-NOV-2026', carrier: 'UPS', service: 'UPS Ground', route: 'RT-0426', stop: 1, stops: 2,
        hu: 'HU-1002', huSscc: '006141410000002023', tracking: 'DEMO-UP-000426-01', pack: 'PS-BOX-M',
        lines: [
          { line: 10, sku: 'SKU-PURIFIER', material: '990105', qty: 1, uom: 'EA', price: 389.00 },
          { line: 20, sku: 'SKU-CHEM', material: '990103', qty: 2, uom: 'EA', price: 18.75, note: 'Hazmat – limited quantity, ground only',
            desc: 'Chemical Bottle - Industrial Cleaner, 1 L, HAZMAT (each)' }
        ] }
    ],
    // Descartes route plan returned to EWM (other stops are not part of the demo)
    routes: [
      { id: 'RT-0425', carrier: 'FedEx', service: 'FedEx Ground', hubDepart: '26-NOV-2026 07:30', vehicle: 'FedEx van FX-12',
        stops: [
          { no: 1, name: 'Other delivery (not in demo)', eta: '08:40' },
          { no: 2, so: 'SO-5001', eta: '09:25' },
          { no: 3, name: 'Other delivery (not in demo)', eta: '10:10' }
        ] },
      { id: 'RT-0426', carrier: 'UPS', service: 'UPS Ground', hubDepart: '26-NOV-2026 07:45', vehicle: 'UPS van UP-07',
        stops: [
          { no: 1, so: 'SO-5002', eta: '08:55' },
          { no: 2, name: 'Other delivery (not in demo)', eta: '09:50' }
        ] }
    ],
    // Kitting: SO-5001's bulbs and batteries are built into kits at KIT-01 (1 bulb + 1 battery per kit)
    kits: [
      { id: 'KIT-0001', so: 'SO-5001', kit: 'KIT-BB01', name: 'Bulb + battery kit', workCenter: 'KIT-01', qty: 2,
        components: [{ sku: 'SKU-BULB', line: 10, perKit: 1 }, { sku: 'SKU-BATTERY', line: 20, perKit: 1 }],
        steps: ['Pick the bulbs and batteries to kitting station KIT-01', 'Build each kit: 1 bulb + 1 battery in one bag',
          'Seal the bag and stick the KIT-BB01 kit label', 'Send the 2 kits to PACK-01 for carton HU-1001'] }
    ],
    // Warehouse tasks (WT) printed by warehouse-tasks.html. Numbers are demo values.
    wt: {
      packStation: 'PACK-01', stageOut: 'STG-OUT-01', door: 'DOOR-04', shipment: 'SHP-7001', tu: 'TU-7001',
      orders: { kitting: '2000000101', vas: '2000000102', pick: '2000000103', load: '2000000104' }
    },
    // After packing: line haul, hub, final leg, POD and the return (film S05–S06). Demo values only.
    postShip: {
      bol: 'BOL-0701-001', sealNo: 'SL-30871', driver: 'HDS fleet driver (demo)',
      hub: { name: 'Local cross-dock hub', street: 'Hub dock 3 (demo)', city: 'Atlanta, GA', postal: '30000' },
      weights: { 'HU-1001': 6, 'HU-1003': 220, 'HU-1002': 34, pallet: 40 },
      itTickets: [
        { key: 'IT-HUB', id: 'INC-000007', title: 'HU not found at hub – HU message never transmitted', priority: 'P2 – shipment held',
          raisedBy: 'Hub lead (demo)', raisedAt: '26-NOV-2026 05:40', resolvedAt: '26-NOV-2026 06:05', area: 'Outbound interface – despatch message to hub',
          symptom: 'Hub scans pallet SSCC 106141410000002105 (HU-P01): "HU not found". The hub system has no record of the pallet or its 3 cartons.',
          cause: "EWM posted goods issue for SHP-7001, but the HU / despatch message to the hub failed and stayed in error in the outbound message queue, so it was never sent.",
          fix: ['Found the message for SHP-7001 in error in the outbound message monitor', 'Corrected the failed message and resent it to the hub',
            'Hub system confirmed receipt: HU-P01 with HU-1001, HU-1003 and HU-1002', 'Hub lead rescanned HU-P01: found, and the pallet was received and cross-docked'],
          prevent: 'Alert IT automatically when an outbound hub message fails.' },
        { key: 'IT-LABEL', id: 'INC-000008', title: 'FedEx shipping label fails to print – carrier certificate expired', priority: 'P2 – carton held at hub',
          raisedBy: 'Hub lead (demo)', raisedAt: '26-NOV-2026 06:20', resolvedAt: '26-NOV-2026 06:50', area: 'Carrier integration – FedEx',
          symptom: 'Printing the FedEx label for HU-1001 and HU-1003 fails with "carrier authentication failed". The UPS label for HU-1002 prints normally.',
          cause: 'The security certificate used for the FedEx carrier connection had expired, so FedEx rejected the label requests.',
          fix: ['Confirmed the FedEx connection was rejected because the certificate had expired', 'Renewed the FedEx carrier certificate and activated it',
            'Printed a test label: accepted', 'Reprinted the labels for HU-1001 and HU-1003 with tracking DEMO-FX-000425-02 / -03'],
          prevent: 'Track carrier certificate expiry dates and renew 30 days before they expire.' }
      ],
      pods: [
        { so: 'SO-5001', delivered: '26-NOV-2026 09:31', vehicle: 'FedEx van FX-12', receivedBy: '' },
        { so: 'SO-5002', delivered: '26-NOV-2026 08:58', vehicle: 'UPS van UP-07', receivedBy: '' }
      ],
      // The signed POD releases the invoice (film S06). No tax is calculated in the demo.
      invoices: [
        { so: 'SO-5001', id: 'INV-D7781', date: '26-NOV-2026', terms: 'Net 30', due: '26-DEC-2026', freight: 0 },
        { so: 'SO-5002', id: 'INV-D7782', date: '26-NOV-2026', terms: 'Net 30', due: '26-DEC-2026', freight: 0 }
      ],
      remitTo: { name: 'HD Supply – Accounts Receivable (demo)', street: 'Remittance address (demo)', city: 'Atlanta, GA', postal: '30000' },
      // Return scenario: one bulb from SO-5001 comes back broken and is scrapped
      rma: { id: 'RMA-D3310', so: 'SO-5001', sku: 'SKU-BULB', qty: 1, uom: 'EA', raised: '27-NOV-2026',
        reason: 'Arrived broken – glass cracked',
        returnLabel: 'DEMO-FX-RET-0001', returnCarrier: 'FedEx Ground', returnTo: 'GA02 returns dock · QA-HOLD-01', authorisedBy: 'Customer service (demo)' },
      qi: { id: 'QI-0001', inspected: '30-NOV-2026', location: 'QA-HOLD-01', result: 'Damaged – glass cracked, not resaleable', decision: 'Scrap',
        checks: [['Outer packaging', 'Intact – return carton OK'], ['Product', 'Glass bulb cracked'], ['Function test', 'Not tested – glass broken (unsafe)'],
          ['Resaleable?', 'No'], ['Vendor claim?', 'No – damaged in transit to the customer']] },
      scrap: { id: 'SCR-0001', posted: '30-NOV-2026', movementType: '551 – withdrawal for scrapping', costCenter: 'CC-GA02-OPS (demo)',
        reasonCode: 'Damaged – customer return', creditMemo: 'CMR-0001' }
    },
    // Value-added service / fabrication work order
    vas: [
      { id: 'FAB-0001', so: 'SO-5001', line: 30, sku: 'SKU-CARDBD', workCenter: 'FAB-01',
        task: 'Cut cardboard sheet to length', receivedCm: 10, requiredCm: 8, tolerance: '± 1 mm',
        steps: ['Pick the sheet from 104-02-A01 and bring it to FAB-01', 'Measure 8 cm from the left edge and mark the cut line',
          'Cut square to the edge; keep the 2 cm off-cut for scrap', 'Measure: 8 cm ± 1 mm, then sign off and send to PACK'] }
    ]
  },

  // Used when the directed bin is full / blocked. The app only offers an
  // alternate in the same storage type. Hazmat has none on purpose: its racking
  // is full, which is the "No bin" IT moment.
  altBins: ['104-03-A01', '105-02-B01', '105-03-B01'],

  // Damaged or not-on-ASN pallets are directed here
  qaBin: 'QA-HOLD-01',

  // IT moments from the Mini Warehouse film. The RF throws the error at the
  // point in the flow where it happens; the team taps "Call IT", a mock ticket
  // is raised, and IT applies the fix on the device. Fixes stay applied on that
  // device until Activity Log -> Clear demo data, so the demo can be re-run.
  //   UOM    at Verify Receipt: ASN in cases, no case->each conversion
  //   EAN    at Receive Pallet: vendor EAN-13 on the case is not mapped
  //   NOBIN  after receipt: hazmat racking full, IT activates an overflow HAZMAT bin
  //   SERIAL at Confirm Putaway: serialised product, serial capture needed
  //   REPLEN at Picking (bin scan): pick bin shows empty, IT triggers replenishment
  //   NOPACK at Pack (close carton): no packaging spec for the carton, IT adds it
  itIssues: [
    { id: 'REPLEN', sku: 'SKU-BATTERY', bin: '104-01-B01', replenTask: 'RPL-0001', from: 'Reserve 104-03-B01',
      title: 'Bin empty – no stock to pick',
      fix: 'Created replenishment task RPL-0001 and refilled bin 104-01-B01 from reserve' },
    { id: 'NOPACK', hu: 'HU-1001', packSpec: 'PS-BOX-M',
      title: "Can't close carton – no packaging specification",
      fix: 'Added packaging spec PS-BOX-M (medium box, max 10 lb; carton weighs 6 lb – OK)' },
    { id: 'UOM', sku: 'SKU-CHEM', eaPerCase: 4,
      title: 'Qty mismatch – no case-to-each conversion',
      fix: 'Added unit conversion 1 CS = 4 EA to the product master' },
    { id: 'EAN', sku: 'SKU-WASHER', ean: '5012345678900',
      title: 'Vendor EAN-13 not recognised',
      fix: 'Mapped EAN 5012345678900 to SKU-WASHER' },
    { id: 'NOBIN', sku: 'SKU-CHEM', overflowBin: '110-03-B01',
      title: 'No bin found – hazmat racking full',
      fix: 'Activated overflow hazmat bin 110-03-B01 (never a general bin)' },
    { id: 'SERIAL', sku: 'SKU-PURIFIER', example: 'SN-AP-000123',
      title: 'Serial number required – serialised product',
      fix: 'Checked the serial profile and enabled serial capture on the RF' }
  ],

  // Exception codes for the demo override. Every red error message on the RF
  // device offers "Override with exception code". A code is accepted only for
  // the error kinds listed in `applies` ('*' = any error). Kinds:
  //   WRONG_BIN   scanned a bin other than the directed one -> accept scanned bin
  //   NO_ALT_BIN  no alternate bin in the same storage type -> use any free alternate
  //   ALREADY_PUT pallet already put away -> reopen it for putaway
  //   SKU_DONE    all pallets of a product already received -> receive an extra pallet
  //   NOT_ON_ASN  LPN not on the ASN -> receive it to a General bin (skip QA hold)
  //   NO_TASK     no putaway task for the LPN -> start receiving it now
  //   SEGREGATION scanned bin crosses the hazmat boundary -> DEMO only clears the message
  //   GENERAL     any other error (format, camera, ...) -> clear the message
  exceptionCodes: [
    { code: 'CHBD', text: 'Change destination bin', applies: ['WRONG_BIN', 'NO_ALT_BIN'] },
    { code: 'REOP', text: 'Reopen putaway task', applies: ['ALREADY_PUT'] },
    { code: 'OVRC', text: 'Over-receipt / extra pallet', applies: ['SKU_DONE', 'NOT_ON_ASN'] },
    { code: 'RCVN', text: 'Receive now (no task yet)', applies: ['NO_TASK'] },
    { code: 'DEMO', text: 'Demo override – any error', applies: ['*'] }
  ],

  // A carton label that is NOT on the ASN - prints on the test sheet to demo the exception
  unknownLpn: 'LPN-X9999'
});
