# First Pass

Paste a public URL. The page crawls up to 12 same-host pages, two links deep, and shows circular scores for load, title and headings, meta, links, and automation. A score counts passes, failures, and checks that did not run. Download report writes the executed page list to a PDF.

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
