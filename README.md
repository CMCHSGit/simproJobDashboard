# simPRO Daily Job Dashboard

A lightweight, self-hosted management dashboard for daily job visibility. Runs entirely in the browser — no server required for CSV mode.

Live demo: `https://your-org.github.io/simpro-dashboard`

---

## Features

- Filter by technician, job category, and status
- Sort by priority, scheduled time, job number, or technician
- Colour-coded priority indicators (high / medium / low)
- Summary stats bar (total, high priority, in progress, completed)
- CSV upload with drag-and-drop (works offline)
- Auto-detects simPRO column names; manual mapping modal as fallback
- Dark mode support
- Mobile-responsive

---

## Getting started — CSV mode (no setup required)

1. **Fork or clone this repo**
2. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Source: `Deploy from a branch` → `main` → `/ (root)`
   - Save — your dashboard will be live at `https://your-org.github.io/simpro-dashboard`
3. **Export from simPRO each morning**
   - Jobs → list view → filter by today's date → Export (CSV)
4. **Load the file** — drag it onto the upload zone or click "Load CSV"

That's it.

---

## CSV column mapping

The dashboard auto-detects the following column names from a simPRO export. Matching is case-insensitive and partial, so variations like "Job No", "Job Number", "Job #" all work.

| Dashboard field  | Accepted column names                                             |
|------------------|-------------------------------------------------------------------|
| Job number       | Job No, Job Number, Job #, ID, Job ID                            |
| Job title        | Title, Job Title, Description, Subject, Summary                  |
| Category         | Category, Job Category, Type, Job Type, Work Type                |
| Technician       | Technician, Assigned To, Tech, Engineer, Staff, Contractor       |
| Scheduled time   | Scheduled Time, Schedule Time, Start Time, Time, Scheduled Start |
| Scheduled date   | Scheduled Date, Schedule Date, Date, Job Date, Start Date        |
| Site address     | Site Address, Address, Location, Site, Customer Address          |
| Status           | Status, Job Status, Stage                                        |
| Priority         | Priority, Urgency, Importance                                    |

If your export uses different names, a mapping dialog appears automatically on first load.

### Category normalisation

The dashboard maps raw category values to three buckets:

| Dashboard category    | Matches if value contains…                          |
|-----------------------|-----------------------------------------------------|
| Repair                | repair, fault, breakdown                            |
| Testing               | test                                                |
| Prev. maintenance     | prev, pm, maintenance, service                      |
| (kept as-is)          | anything else                                       |

### Priority normalisation

| Dashboard priority | Matches if value is…                         |
|--------------------|----------------------------------------------|
| High               | High, Urgent, Critical, 1                    |
| Medium             | Medium, 2, or anything not matched           |
| Low                | Low, 3                                       |

---

## Repo structure

```
simpro-dashboard/
├── index.html          ← the entire dashboard (single file, no build step)
├── sample-export.csv   ← sample data for testing
├── README.md
└── api-proxy/
    ├── worker.js       ← Cloudflare Worker (for future live API mode)
    └── wrangler.toml   ← Worker config
```

---

## Connecting to the simPRO API (future)

When you're ready to move from CSV to live data, deploy the included Cloudflare Worker as a proxy. It keeps your API credentials server-side and adds the CORS headers the dashboard needs.

### Steps

1. Install Wrangler (Cloudflare's CLI):
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Navigate to the proxy folder:
   ```bash
   cd api-proxy
   ```

3. Add your simPRO credentials as secrets (these are never stored in code):
   ```bash
   wrangler secret put SIMPRO_BASE_URL
   # Enter: https://yourcompany.simprosuite.com

   wrangler secret put SIMPRO_API_KEY
   # Enter: your simPRO API bearer token
   ```

4. Deploy:
   ```bash
   wrangler deploy
   ```

5. In the dashboard, click "simPRO API" mode and paste your Worker URL:
   ```
   https://simpro-proxy.your-user.workers.dev/jobs
   ```

Cloudflare Workers free tier supports 100,000 requests/day — more than enough for a team dashboard.

### Getting a simPRO API key

1. Log into simPRO as an admin
2. Go to Setup → API → Manage API Keys
3. Create a new key with read access to Jobs and Staff
4. Copy the bearer token — you only see it once

### API endpoints the worker proxies

| Worker route     | simPRO endpoint                                      |
|------------------|------------------------------------------------------|
| `/jobs`          | `GET /api/v1.0/companies/0/jobs/` (filtered to today)|
| `/technicians`   | `GET /api/v1.0/companies/0/staff/`                   |

---

## Customising

### Add a new category

In `index.html`, find the `normCat()` function and the category pill buttons, then add your new category to both.

### Change the date filter

The CSV mode shows all jobs from the loaded file. The API Worker filters to today automatically via `scheduledStartDate` / `scheduledEndDate` query params in `worker.js`.

### Restrict the CORS origin

In `worker.js`, change:
```js
const ALLOWED_ORIGIN = '*';
```
to your GitHub Pages URL:
```js
const ALLOWED_ORIGIN = 'https://your-org.github.io';
```

---

## License

MIT — free to use and modify.
