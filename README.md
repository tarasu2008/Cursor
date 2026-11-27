# First Pass

Paste a public homepage. The page opens that address and the links in its header, then shows only the pages that came back. Download report writes a PDF of those same scenarios.

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
