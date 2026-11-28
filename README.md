# First Pass

Paste a public URL. The page shows scores, then every homepage check that ran: status, headings, contrast, navigation, buttons, menu items, and a booking walk that stops at checkout without entering guest or card details. A run stops at about 2 minutes. Download report writes those checks to a PDF.

Nothing is paid. Guest details and card details are not entered. Pay, submit payment, and delete are not used. Booking may be opened until the checkout page and stops there.

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

## Tests

Page objects for the homepage, navigation, and the booking walk live in `tests/pages`. The homepage spec covers the same checks as the auditor, and scans the submitted URL with axe-core. It does not fill checkout. `TARGET_URL` chooses the site. When it is unset, the spec uses https://www.seadwellers.com/. A Groq key is optional: without `GROQ_API_KEY`, the LangGraph reasoning node skips the model and `npx playwright test` still runs.

```bash
cd /agent/repos/qa-audit-site
npm install
npx playwright test
```

To list the homepage spec without running it: `npx playwright test tests/homepage.spec.ts --list`.
