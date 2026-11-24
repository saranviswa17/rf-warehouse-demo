# RF Receiving & Putaway – Warehouse Experience Demo

This is a browser-only web app that makes any phone act like a warehouse RF gun. It uses a yellow, black and charcoal theme.
There's no password, no install and no backend. Someone scans a QR code, enters a user name on the sign-in screen, and can run the flow. The app shows that name in the status bar and on the main menu, and stamps it on each transaction.

> The sign-in screen only identifies the user for the demo. It is **not** authentication: there's no password, and the name is kept only in that phone's browser.

## The inbound shipment

One sample vendor ships **one truck (trailer TRL-4471) with two mixed pallets** to **HD Supply GA02 DC** on **ASN-560001** (PO 4500098761). The paperwork is on the **Print test labels** page: the ASN document, a label per pallet, and a carton shipping label for each carton (FROM / SHIP TO, ship-to postal code, PO, delivery date, DC, case contents, SSCC). **`pallet-labels.html`** prints the two vendor pallet labels at exactly **10 × 6 cm**.

| Line | Pallet | Carton SSCC | Product | Qty | Storage type → bin | IT moment |
|---|---|---|---|---|---|---|
| 10 | 1 | `006141410000001019` | Fridge | 1 EA | 2000 Appliance → `105-01-A01` | – |
| 50 | 1 | `006141410000001057` | Washing machine | 1 EA | 2000 Appliance → `105-02-A01` | Vendor EAN |
| 60 | 1 | `006141410000001064` | HVAC air purifier | 1 EA | 2000 Appliance → `105-03-A01` | Serial |
| 20 | 2 | `006141410000001026` | Bulb | 2 EA | 1000 General → `104-01-A01` | – |
| 30 | 2 | `006141410000001033` | Battery (batch B2611A) | 2 EA | 1000 General → `104-01-B01` | – |
| 40 | 2 | `006141410000001040` | Chemical bottle, HAZMAT (case of 4, batch C4417) | 1 CS | 3000 Hazmat → `110-03-B01` | UoM, then No bin |
| 70 | 2 | `006141410000001071` | Cardboard sheet, received **10 cm** (cut to order) | 1 EA | 1000 General → `104-02-A01` | – |

Pallet SSCCs: pallet 1 `106141410000001009` (appliances, 520 lb), pallet 2 `106141410000001108` (small parts + hazmat, 45 lb). Scanning a pallet label on the RF lists that pallet's cartons. SSCCs are 18 digits with a valid GS1 check digit, using GS1's example company prefix `0614141` (demo only). The RF accepts the plain SSCC or the GS1-128 scan `00` + SSCC.

## Outbound: customer orders, Descartes routes, VAS (`outbound.html`)

Two customers mean **two sales orders**, so two outbound deliveries. EWM sends both deliveries to Descartes, which returns **one route per carrier**. Both packed cartons ride the HD Supply line haul on nested pallet **HU-P01** to the local hub, where they split to the FedEx and UPS vans, as in the film. The data is in `outbound` in `data.js`.

| Sales order | Customer (fictional) | Delivery | Carrier · route | Carton | Lines |
|---|---|---|---|---|---|
| SO-5001 | Riverside Apartments | OBD-8001 | FedEx Ground · RT-0425 · stop 2 of 3 | HU-1001 + HU-1003 (fridge, own carton) | Bulb 2 EA, Battery 2 EA, Cardboard 1 EA **8 cm** (cut by FAB-0001), Fridge 1 EA |
| SO-5002 | Oakwood Senior Living | OBD-8002 | UPS Ground · RT-0426 · stop 1 of 2 | HU-1002 | HVAC air purifier 1 EA, Chemical bottle 2 EA (hazmat, limited quantity) |

`outbound.html` prints one document per page: the 2 sales orders, the Descartes route plan, the wave pick list (in bin order), the **fabrication work order FAB-0001** with an actual-size 10 cm cutting guide (cut at 8 cm, 2 cm off-cut to scrap), 2 packing slips, and 10 × 6 cm labels: a FedEx label, a UPS label and the outbound pallet HU-P01. The sales order states only the customer requirement (cardboard 8 cm). The 10 cm received size appears only on the internal fabrication order. The washing machine stays in stock. Tracking numbers are marked DEMO.

## Scenario 2: RF picking and pack (menu 7 · Picking & pack)

Wave **W-0901** covers both orders. Pick the whole wave or one order. Tasks run in bin order, the same as the printed pick list.

| Step | Screen | What the user does |
|---|---|---|
| 1 | **Pick list** | Sees both orders with their routes and progress, then starts the wave (or one order) |
| 2 | **Pick · bin** | Goes to the bin and scans the bin label. A wrong bin is rejected |
| 3 | **Pick · item** | Scans the product (SKU or the inbound carton label) and confirms the qty. Less than required = short pick |
| 4 | **Pick · drop** | Scans the drop label: pack carton `HU-1001` / `HU-1002`, `FAB-01` for the cardboard, or staging `HU-1003` for the fridge |
| 5 | **Picking complete** | Summary with any IT tickets and short picks |
| 6 | **Pack station** | Confirms FAB-0001 (cardboard cut to 8 cm), then closes each carton so it can get its carrier label |

IT moments during outbound, as in the film:

| IT moment | Where | RF error | IT fix |
|---|---|---|---|
| **Replenishment** (film IT 5) | Battery bin `104-01-B01` scan | *BIN EMPTY · shows 0 EA* | Creates replenishment task RPL-0001 and refills the bin; the pick carries on |
| **Pack spec** (film IT 6) | Close carton HU-1001 | *CAN'T CLOSE CARTON · no packaging specification* | Adds pack spec PS-BOX-M (max 10 lb; 6 lb OK) |
| UoM (only if not already fixed at receiving) | Chemical bin `110-03-B01` scan | *UNIT ERROR · stock in CS, order needs EA* | Adds 1 CS = 4 EA |

Print the drop labels from `outbound.html` (page "Pick drop labels", 10 × 4 cm). Picks are listed in the Activity Log, and **Clear demo data** resets picks, pack status and IT fixes.

## Scenario 1: inbound receiving, then putaway

| Step | Screen | What the user does |
|---|---|---|
| 0 | **Sign In** | Enters a user name (2–30 characters), with no password. **Sign out** is on the main menu |
| 1 | **Receive Pallet** | Scans the **pallet SSCC** on the pallet label (camera, keyed, or a hardware/wedge scanner) |
| 2 | **Receive Pallet (verify)** | Sees every carton on that pallet with its expected qty, then taps **Confirm pallet receipt**. **No carton scans**: the whole pallet is received in one goods receipt |
| 3 | **Pallet received** | Sees the GR posted and one putaway task per carton HU, each with its destination bin. **Start putaway** asks for the HU scan. Repeat 1–3 for the second pallet |
| 4 | **Putaway: Scan HU** | Scans the HU label on a carton (the carton SSCC, which EWM uses as the HU ID). EWM finds the putaway task |
| 5 | **Putaway: destination → UPC → qty → bin** | The RF shows the destination bin (storage type, Aisle / Stack / Level / Position). The associate scans the **product UPC**, **confirms the quantity** (it must match the HU), then **scans the destination bin**. A wrong UPC, qty or bin is rejected |
| 6 | **Confirm Putaway** | Bin verified, taps **Confirm putaway complete** |
| 7 | **Putaway Complete** | Sees the putaway task confirmed and the dock-to-stock time. **Next putaway** goes back to *Scan HU* for the next carton |

Receiving is pallet-level, and putaway follows an HU-based RF flow: *scan HU → display destination → scan UPC → enter/confirm qty → scan destination bin → confirm*. Scanning a single carton's SSCC at receiving still works, as a fallback for an unknown carton or a blind receipt. A carton with no UPC (an unknown blind-received carton) skips the UPC step. Each product has a demo **UPC-A** barcode with a valid check digit, using GS1's example prefix 614141 (`614141001002` fridge … `614141001064` cardboard). The washing machine's case carries only the vendor's **EAN-13** (`5012345678900`), which is the vendor-EAN IT moment. The product labels (4.5 × 2.5 cm) print on `pallet-labels.html` and in section 5 of `labels.html`, and the RF also accepts the UPC at receiving and picking.

Built-in exceptions for the demo:
- **Carton not on the ASN:** the user can blind-receive it, and it goes to `QA-HOLD-01`.
- **Short or over quantity:** the app flags it.
- **Damaged:** the carton goes to QA hold.
- **Wrong bin scanned:** the app shows an error and beeps.
- **Bin full or blocked:** the app assigns an alternate bin in the same storage type.
- **Hazmat segregation:** hazmat can't go in a non-hazmat bin (or the other way round), even with an exception code.

## IT assistance (from the Mini Warehouse film)

The RF throws the film's inbound "IT moments" at the point in the flow where they happen. The RF error turns red with **Call IT – raise ticket**. That raises a mock ticket (`INC-000001`, …), the IT team member taps **IT · Apply fix** (a gear spins), **RESOLVED** stamps on, and **Continue** goes back into the flow.

| IT moment | Product | Where the RF error appears | IT fix |
|---|---|---|---|
| UoM | Chemical bottle (ASN 1 CS) | Pallet 2 receipt: *QTY MISMATCH · ASN 1 CS, EWM expects 4 EA* (blocks the pallet receipt) | Adds 1 CS = 4 EA, then the pallet shows 1 CS (= 4 EA) |
| Vendor EAN | Washing machine | Putaway UPC step: the case's vendor EAN `5012345678900` gives *BARCODE NOT RECOGNISED* | Maps the EAN to SKU-WASHER; the product is confirmed and putaway carries on |
| No bin | Chemical bottle | Straight after pallet 2's goods receipt: *NO BIN FOUND · storage type 3000 Hazmat full* | Activates overflow hazmat bin `110-03-B01` (never a general bin) |
| Serial | HVAC air purifier | Confirm Putaway: *SERIAL REQUIRED* | Enables serial capture; key the serial (e.g. `SN-AP-000123`) |

The issues are set in `itIssues` in `data.js`, where you can change the product, EAN, overflow bin or wording. A fix stays applied on that device, so the error comes back only after **Activity Log → Clear demo data**, which asks for confirmation on screen. Tickets are listed in the Activity Log. The vendor EAN label prints with the product labels. If the app is open in more than one tab or window, a change or clear in one updates the others straight away.

## Exception-code override (demo)

Every red error message shows **Override with exception code**. The user keys a code (or taps one from the list), and the app checks it against `exceptionCodes` in `data.js`:

| Code | Meaning | Valid for | What the override does |
|---|---|---|---|
| `CHBD` | Change destination bin | Wrong bin scanned; no alternate in the storage type | Accepts the scanned bin / uses any free alternate bin |
| `REOP` | Reopen putaway task | Pallet already put away | Reopens the pallet for putaway |
| `OVRC` | Over-receipt / extra pallet | All pallets of a product received; LPN not on ASN | Receives an extra pallet / receives the unknown LPN to a General bin (no QA hold) |
| `RCVN` | Receive now | No putaway task for the LPN | Sends the LPN to receiving |
| `DEMO` | Demo override | Any error | Does the action above, or just clears the message (format, camera and other errors) |

A wrong or unlisted code is refused. Every override is stamped with the code, user and time, added to the pallet's exceptions, and listed under **Activity Log → Exception-code overrides**. **Clear demo data** resets them.

> This is a demo convenience, not a control: anyone on the device can use the codes. Don't copy it into a real RF flow without supervisor authorisation.

## Demo bins (warehouse GA02)

Bins follow the EWM pattern `Aisle-Stack-LevelPosition`: `104-01-B01` = aisle 104, stack 01, level B (upper), position 01; level A is the lower bin. Each storage type has 3 stacks × 2 bins, matching the printed bin labels.

| Storage type | Aisle | Bins in use | Free / alternate bins |
|---|---|---|---|
| 3000 Hazmat | 110 | Chemical bottle `110-03-B01` (overflow bin – IT activates it) | None on purpose: the other hazmat bins are treated as full |
| 2000 Appliance | 105 | Fridge `105-01-A01`, Washing machine `105-02-A01`, HVAC air purifier `105-03-A01` | `105-02-B01`, `105-03-B01` (alternates), `105-01-B01` |
| 1000 General | 104 | Bulb `104-01-A01`, Battery `104-01-B01` | `104-03-A01` (alternate), `104-02-A01`, `104-02-B01`, `104-03-B01` |

Other features: beep and vibrate feedback, F3 = Back and F4 = Menu, numeric menu keys, an activity log, a **Share** screen with a QR code, and a **Print test labels** page (`labels.html`) with the ASN, pallet label, carton shipping labels (GS1-128 SSCC barcodes), product, bin and exception labels.

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.css`, `app.js` | The RF app |
| `data.js` | **Demo master data.** Edit the site, ASN pallets, SKUs and bins here |
| `labels.html`, `labels.css`, `labels.js` | Printable test barcodes plus the app QR code |
| `pallet-labels.html`, `pallet-labels.css`, `pallet-labels.js` | Vendor labels to print: the two pallet labels (10 × 6 cm) and the six carton labels (4.5 × 4.5 cm) |
| `warehouse-tasks.html`, `warehouse-tasks.css`, `warehouse-tasks.js` | Warehouse task (WT) printouts for wave W-0901: picking WT for kitting (2 kits of 1 bulb + 1 battery), fabrication WT (cut cardboard to 8 cm, actual-size guide), packing & line-haul WT (both orders on HU-P01, shipment SHP-7001) |
| `shipping-docs.html`, `shipping-docs.css`, `shipping-docs.js` | Bill of lading, carrier manifest, IT tickets (HU not at hub, FedEx label), POD and invoice for both customers (INV-D7781, INV-D7782), and the return of 1 bulb: RMA-D3310, inspection QI-0001, scrap SCR-0001. `?only=BOL`, `MANIFEST`, `IT-HUB`, `IT-LABEL`, `POD`, `INVOICE`, `RMA`, `QI` or `SCRAP` shows one document |
| `docs/` | PDF printouts made from these pages: warehouse tasks, Descartes route plan, packing slips, bill of lading, carrier manifest, the two IT tickets, PODs, invoices, RMA, return inspection and scrap. `outbound.html?only=ROUTE%20PLAN` (or `PACKING%20SLIP`) shows one outbound document alone |
| `outbound.html`, `outbound.css`, `outbound.js` | Outbound paperwork: sales orders, Descartes route plan, pick list, fabrication (VAS) order, packing slips, carrier and outbound pallet labels |
| `carton-label.js`, `carton-label.css` | The compact carton label, shared by both label pages. Ship-from / ship-to are on the pallet label; the carton label carries the SSCC (QR + GS1-128), product, qty, PO, batch, carton n/6, pallet and hazmat |
| `manifest.webmanifest`, `icon.svg` | "Add to Home Screen" support |
| `staticwebapp.config.json` | Security headers for Azure Static Web Apps |

## Sharing it with anyone by QR code

The phone camera only works on **HTTPS**, so the app has to be hosted on an HTTPS URL. Any static host works, because it's just files:

- **Azure Static Web Apps** (recommended if you're on Azure): upload this folder. `staticwebapp.config.json` applies the security headers.
- **GitHub Pages**, **AWS S3 + CloudFront**, **Netlify**, or an internal IIS/NGINX site with TLS.

Once it's hosted, open the URL and go to **Menu → 4 Share this RF app**, or open `labels.html`. Both show a QR code for the live URL. Put that QR on a poster or a slide, and anyone who scans it gets the RF device.

> The app has no real authentication by design (the user name is for display only). Only put **mock data** in `data.js`, and never real customer, vendor or employee data.
> If you host it inside the corporate network, external visitors won't be able to reach it.

## Running it locally

```bash
python -m http.server 8642 --bind 127.0.0.1 --directory rf-warehouse-app
```

Then open http://localhost:8642. The camera works on `localhost`, but other phones can't reach that address.

## Notes

- Scanning uses [html5-qrcode 2.3.8](https://github.com/mebjas/html5-qrcode) from cdnjs. It reads Code 128/39/93, EAN, UPC, ITF, QR and DataMatrix, and it uses the native BarcodeDetector where the browser supports it. If the camera isn't available, the user can always key the code in or tap *Simulate a scan*.
- Transactions are stored only in that phone's `localStorage`. Every user has their own demo session, and **Activity Log → Clear demo data** resets it.
- Security: there's a strict CSP with no inline scripts. All dynamic text is written with `textContent`, and scanned input is checked against an allow-list (`A-Z 0-9 - . / _`, max 40).
