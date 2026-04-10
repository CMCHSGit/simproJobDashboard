/**
 * simPRO API Proxy — Cloudflare Worker
 *
 * Keeps your simPRO API credentials server-side and adds CORS headers
 * so the dashboard (hosted on GitHub Pages) can call this worker safely.
 *
 * SETUP
 * ─────
 * 1. Install Wrangler:   npm install -g wrangler
 * 2. Login:              wrangler login
 * 3. Add secrets:
 *      wrangler secret put SIMPRO_API_KEY
 *      wrangler secret put SIMPRO_BASE_URL     ← e.g. https://yourcompany.simprosuite.com
 * 4. Deploy:             wrangler deploy
 *
 * The worker URL (e.g. https://simpro-proxy.your-user.workers.dev/jobs)
 * is what you paste into the dashboard's "Proxy endpoint URL" field.
 *
 * ENDPOINTS PROXIED
 * ─────────────────
 * GET /jobs          → simPRO GET /api/v1.0/companies/0/jobs/
 *                       Returns today's scheduled jobs filtered by date.
 * GET /technicians   → simPRO GET /api/v1.0/companies/0/staff/
 *
 * All responses are normalised to the same shape the dashboard expects:
 * { jobs: [ { num, title, cat, tech, time, date, addr, status, priority } ] }
 */

const ALLOWED_ORIGIN = '*'; // Restrict to your GitHub Pages URL in production
                             // e.g. 'https://your-org.github.io'

export default {
  async fetch(request, env) {
    // ── CORS preflight ──────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url     = new URL(request.url);
    const path    = url.pathname.replace(/^\//, '');
    const baseUrl = env.SIMPRO_BASE_URL;
    const apiKey  = env.SIMPRO_API_KEY;

    if (!baseUrl || !apiKey) {
      return jsonError(500, 'Worker secrets SIMPRO_BASE_URL and SIMPRO_API_KEY are not set.');
    }

    // ── Route: /jobs ────────────────────────────────────────────────────
    if (path === 'jobs' || path === '') {
      const today = todayISO();
      const apiUrl = `${baseUrl}/api/v1.0/companies/0/jobs/?` +
        new URLSearchParams({
          scheduledStartDate: today,
          scheduledEndDate:   today,
          pageSize: '200',
          columns: 'ID,Name,Type,Technician,ScheduledStartTime,ScheduledEndTime,SiteAddress,Status,Priority',
        });

      const upstream = await fetchSimPRO(apiUrl, apiKey);
      if (!upstream.ok) return jsonError(upstream.status, `simPRO API error: ${upstream.status}`);

      const data = await upstream.json();
      const jobs = (data.Items || data || []).map(normaliseJob);

      return jsonResponse({ jobs, fetchedAt: new Date().toISOString() });
    }

    // ── Route: /technicians ─────────────────────────────────────────────
    if (path === 'technicians') {
      const apiUrl = `${baseUrl}/api/v1.0/companies/0/staff/?pageSize=200&columns=ID,Name,Mobile,Email`;
      const upstream = await fetchSimPRO(apiUrl, apiKey);
      if (!upstream.ok) return jsonError(upstream.status, `simPRO API error: ${upstream.status}`);

      const data = await upstream.json();
      const technicians = (data.Items || data || []).map(t => ({
        id:    t.ID,
        name:  `${t.FirstName || ''} ${t.LastName || ''}`.trim() || t.Name || '—',
        email: t.Email || '',
        phone: t.Mobile || '',
      }));

      return jsonResponse({ technicians });
    }

    return jsonError(404, `Unknown route: /${path}. Available: /jobs, /technicians`);
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fetchSimPRO(url, apiKey) {
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'application/json',
    },
  });
}

/**
 * Normalise a simPRO job object to the dashboard's expected shape.
 * Adjust field names here if your simPRO instance uses different keys.
 */
function normaliseJob(item) {
  const scheduled = item.ScheduledStartTime || '';
  const [date, time] = scheduled.split('T');

  return {
    num:      String(item.ID || item.JobNo || ''),
    title:    item.Name || item.Title || 'Untitled',
    cat:      normCat(item.Type || item.Category || ''),
    tech:     (item.Technician && item.Technician.Name) || item.AssignedStaff || 'Unassigned',
    time:     time ? time.slice(0, 5) : '',
    date:     date || '',
    addr:     (item.SiteAddress && item.SiteAddress.FullAddress) || '',
    status:   normStatus(item.Status || item.StatusLabel || ''),
    priority: normPriority(item.Priority || ''),
  };
}

function normCat(raw) {
  const r = raw.toLowerCase();
  if (r.includes('repair') || r.includes('fault') || r.includes('breakdown')) return 'Repair';
  if (r.includes('test'))  return 'Testing';
  if (r.includes('prev') || r.includes('pm') || r.includes('maintenance'))    return 'PM';
  return raw;
}

function normStatus(raw) {
  const r = raw.toLowerCase();
  if (r.includes('progress') || r.includes('active'))  return 'In progress';
  if (r.includes('complet')  || r.includes('closed'))  return 'Completed';
  if (r.includes('cancel'))                             return 'Cancelled';
  return 'Scheduled';
}

function normPriority(raw) {
  const r = String(raw).toLowerCase();
  if (r === '1' || r.includes('high') || r.includes('urgent'))  return 'High';
  if (r === '3' || r.includes('low'))                            return 'Low';
  return 'Medium';
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    },
  });
}

function jsonError(status, message) {
  return jsonResponse({ error: message }, status);
}
