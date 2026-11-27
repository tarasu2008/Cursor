# First Pass

Paste a public URL. The page shows scores, then every homepage check that ran: status, headings, contrast, navigation, buttons, menu items, and a booking walk that stops at checkout without entering guest or card details. A run stops at about 2 minutes. Download report writes those checks to a PDF.

Nothing is submitted. Checkout, payment, sign-in, and delete addresses are not opened.

## Run

```bash
cd /agent/repos/qa-audit-site
npm install
npm run dev
```

The dev server prints the local URL, usually http://127.0.0.1:3000.

`npm run build` and `npm start` serve the production build.

## Requests

`POST /api/audit` with `{ "url": "https://example.com/" }` opens the homepage.

`POST /api/report` with that JSON response returns `application/pdf`. The PDF is built in this process. No external document API is called.
