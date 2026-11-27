# First Pass

A first QA audit for a public URL. Paste the address, get a report in the same reading order as PageSpeed: a score row, then the checks.

This demo fetches the page. It does not run Lighthouse, call a paid API, submit a form, or generate a Playwright project.

## Run

```bash
cd /agent/repos/qa-audit-site
npm install
npm run dev
```

Open http://localhost:3000

`npm run build` then `npm start` serves the production build.

## What Analyze does

`POST /api/audit` with `{ "url": "https://example.com/" }`.

The same handler is at `POST /api/webhook/run-qa-agent`.

1. Refuse non-public hosts, private addresses, and checkout, payment, login, or account-delete URLs.
2. GET the document, follow up to five same-host redirects, and record status and time.
3. Read title, meta description, canonical, robots, viewport, H1, forms, and nav from the HTML.
4. GET `/robots.txt` and a sitemap URL. Sitemap entries are counted, not crawled.
5. GET up to eight same-host links, nav links first. Bodies are discarded.
6. GET one nonsense path and record whether it returns 404.
7. Validate the report with zod before it is returned.

`POST /api/audit` with `{ "sample": true }` returns a labeled sample for https://www.seadwellers.com/. If a live crawl of that host fails, the API returns that sample and says why.

No API keys. No form posts.
