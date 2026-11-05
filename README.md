# RF Receiving & Putaway – Warehouse Experience Demo

This is a browser-only web app that makes any phone act like a warehouse RF gun. It uses a yellow, black and charcoal theme.
There's no password, no install and no backend. Someone scans a QR code, enters a user name on the sign-in screen, and can run the flow. The app shows that name in the status bar and on the main menu, and stamps it on each transaction.

> The sign-in screen only identifies the user for the demo. It is **not** authentication: there's no password, and the name is kept only in that phone's browser.

## Scenario 1: inbound receiving, then putaway

| Step | Screen | What the user does |
|---|---|---|
| 0 | **Sign In** | Enters a user name (2–30 characters), with no password. **Sign out** is on the main menu |
| 1 | **Receive Pallet** | Scans the pallet LPN with the phone camera (or keys it in, or uses a hardware/wedge scanner) |
| 2 | **Verify Receipt** | Checks the PO, SKU and expected qty, confirms the received qty and condition, then taps **Confirm receipt** |
| 3 | **Receiving Complete** | Sees the GR posted, and the app points to the next step: *Putaway to bin A-04-02-C* |
| 4 | **Putaway (Travel)** | Big bin display (Zone / Aisle / Bay / Level). At the bin they scan the bin label, and a wrong bin is rejected |
| 5 | **Confirm Putaway** | Bin verified, taps **Confirm putaway complete** |
| 6 | **Putaway Complete** | Sees the putaway task confirmed and the dock-to-stock time, then goes to the next pallet |

Built-in exceptions for the demo:
- **LPN not on the ASN:** the user can blind-receive it, and it goes to `QA-HOLD-01`.
- **Short or over quantity:** the app flags it.
- **Damaged:** the pallet goes to QA hold.
- **Wrong bin scanned:** the app shows an error and beeps.
- **Bin full or blocked:** the app assigns an alternate bin.

Other features: beep and vibrate feedback, F3 = Back and F4 = Menu, numeric menu keys, an activity log, a **Share** screen with a QR code, and a **Print test labels** page (`labels.html`) that has real Code 128 barcodes for every pallet and bin.

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.css`, `app.js` | The RF app |
| `data.js` | **Demo master data.** Edit the site, ASN pallets, SKUs and bins here |
| `labels.html`, `labels.css`, `labels.js` | Printable test barcodes plus the app QR code |
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
