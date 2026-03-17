/**
 * Herbahero Cloudflare Worker
 * - LP routing by slug and custom domain mapping
 * - Admin API (Bearer auth)
 * - KV + R2 storage
 */

import { generateLPShell } from './lp-shell.js';

const ROOT_DOMAIN = 'herbahero.my.id';

// ─── RajaOngkir V2 API (rajaongkir.komerce.id) ───────────────────────────────
const RAJAONGKIR_BASE = 'https://rajaongkir.komerce.id/api/v1';
const RAJAONGKIR_API_KEY = 'PvYG24wQa47b39d7217ef23f5SnIOefa';

function rajaongkirKey(env) {
  return (env && env.RAJAONGKIR_API_KEY) || RAJAONGKIR_API_KEY;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const host = url.hostname.toLowerCase();

    // 1) API routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, url);
    }

    // 2) Admin SPA routes
    if (path === '/admin' || path.startsWith('/admin/')) {
      return serveAdmin(env);
    }

    // 3) Custom domain routing: domain:{host} -> slug
    if (host !== ROOT_DOMAIN && !host.endsWith('.workers.dev')) {
      const mappedSlug = await env.KV.get(`domain:${host}`);
      if (mappedSlug) {
        return handleLP(mappedSlug, env);
      }
    }

    // 4) Root domain: / serves admin, /:slug serves LP
    if (path === '/') {
      return serveAdmin(env);
    }

    const slugMatch = path.match(/^\/([a-z0-9-]+)\/?$/i);
    if (slugMatch) {
      return handleLP(slugMatch[1].toLowerCase(), env);
    }

    return json({ error: 'Not Found' }, 404);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LP Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleLP(slug, env) {
  const cfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
  if (!cfg || cfg.status === 'archived') {
    return new Response('<h1>LP not found</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
  }

  const globalCfg = (await env.KV.get('config:global', 'json')) || {};
  const html = generateLPShell(cfg, globalCfg);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin SPA
// ─────────────────────────────────────────────────────────────────────────────

async function serveAdmin(env) {
  const adminHtml = await env.KV.get('static:admin.html');
  if (adminHtml) {
    return new Response(adminHtml, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
  }

  return new Response(`<!DOCTYPE html><html><head><title>Herbahero Admin</title></head>
<body style="font-family:sans-serif;padding:24px">
  <h2>Herbahero Admin belum di-upload</h2>
  <p>Upload dengan command berikut:</p>
  <pre>wrangler kv key put --binding HERBAHERO "static:admin.html" --path ./admin/index.html</pre>
</body></html>`, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function handleAPI(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  // Public endpoints (LP-side)
  const isShipping = path.startsWith('/api/shipping/');

  // Auth for admin endpoints
  if (!isShipping) {
    const authOk = await isAuthorized(request, env);
    if (!authOk) return json({ error: 'Unauthorized' }, 401);
  }

  // GET /api/health
  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true, now: new Date().toISOString() });
  }

  // GET /api/slugs
  if (path === '/api/slugs' && method === 'GET') {
    const index = ((await env.KV.get('slugs:index', 'json')) || []).filter(Boolean);
    return json({ ok: true, data: index.sort() });
  }

  // POST /api/slugs
  if (path === '/api/slugs' && method === 'POST') {
    const body = await safeJson(request);
    if (!body) return json({ error: 'Invalid JSON' }, 400);

    const slug = normalizeSlug(body.slug);
    if (!slug) return json({ error: 'Invalid slug' }, 400);
    if (!body.productName || String(body.productName).trim().length < 2) {
      return json({ error: 'productName required' }, 400);
    }

    const existing = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (existing) return json({ error: 'Slug already exists' }, 409);

    const now = new Date().toISOString();
    const cfg = {
      slug,
      productName: String(body.productName).trim(),
      status: body.status === 'draft' ? 'draft' : 'active',
      jpgUrl: sanitizeString(body.jpgUrl),
      customDomain: sanitizeDomain(body.customDomain) || '',
      packages: Array.isArray(body.packages) ? body.packages : [],
      payment: body.payment || { method: 'cod' },
      gasWebhookUrl: sanitizeString(body.gasWebhookUrl),
      waNumber: sanitizeString(body.waNumber),
      analytics: body.analytics || {},
      warehouseOrigin: body.warehouseOrigin || null,
      createdAt: now,
      updatedAt: now,
    };

    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(cfg));

    const index = ((await env.KV.get('slugs:index', 'json')) || []).filter(Boolean);
    if (!index.includes(slug)) {
      index.push(slug);
      await env.KV.put('slugs:index', JSON.stringify(index));
    }

    return json({ ok: true, slug }, 201);
  }

  // GET /api/slugs/:slug
  const slugGet = path.match(/^\/api\/slugs\/([a-z0-9-]+)$/i);
  if (slugGet && method === 'GET') {
    const slug = slugGet[1].toLowerCase();
    const cfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (!cfg) return json({ error: 'Not found' }, 404);
    return json({ ok: true, data: cfg });
  }

  // PUT /api/slugs/:slug
  const slugPut = path.match(/^\/api\/slugs\/([a-z0-9-]+)$/i);
  if (slugPut && method === 'PUT') {
    const slug = slugPut[1].toLowerCase();
    const existing = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (!existing) return json({ error: 'Not found' }, 404);

    const body = await safeJson(request);
    if (!body) return json({ error: 'Invalid JSON' }, 400);

    const updated = {
      ...existing,
      ...body,
      slug,
      customDomain: sanitizeDomain(body.customDomain ?? existing.customDomain) || '',
      updatedAt: new Date().toISOString(),
    };

    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(updated));
    return json({ ok: true, data: updated });
  }

  // DELETE /api/slugs/:slug
  const slugDel = path.match(/^\/api\/slugs\/([a-z0-9-]+)$/i);
  if (slugDel && method === 'DELETE') {
    const slug = slugDel[1].toLowerCase();

    const cfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (cfg?.customDomain) {
      await env.KV.delete(`domain:${cfg.customDomain.toLowerCase()}`);
    }

    await env.KV.delete(`lp:${slug}:cfg`);

    const index = ((await env.KV.get('slugs:index', 'json')) || []).filter((s) => s !== slug);
    await env.KV.put('slugs:index', JSON.stringify(index));

    // Best effort: delete media variants
    await Promise.allSettled([
      env.MEDIA.delete(`lp/${slug}.jpg`),
      env.MEDIA.delete(`lp/${slug}.png`),
      env.MEDIA.delete(`lp/${slug}.webp`),
    ]);

    return json({ ok: true });
  }

  // POST /api/slugs/:slug/upload
  const uploadMatch = path.match(/^\/api\/slugs\/([a-z0-9-]+)\/upload$/i);
  if (uploadMatch && method === 'POST') {
    const slug = uploadMatch[1].toLowerCase();
    const cfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (!cfg) return json({ error: 'Slug not found' }, 404);

    const formData = await request.formData();
    const file = formData.get('jpg') || formData.get('file');
    if (!file) return json({ error: 'No file uploaded (use field name "jpg")' }, 400);

    const contentType = file.type || 'image/jpeg';
    if (!contentType.startsWith('image/')) return json({ error: 'Only images allowed' }, 400);

    const bytes = file.size || 0;
    if (bytes > 6 * 1024 * 1024) {
      return json({ error: 'File too large (max 6MB)' }, 413);
    }

    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const key = `lp/${slug}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType } });

    const mediaBase = (env.MEDIA_BASE_URL || `https://${ROOT_DOMAIN}`).replace(/\/$/, '');
    const jpgUrl = `${mediaBase}/${key}`;

    cfg.jpgUrl = jpgUrl;
    cfg.updatedAt = new Date().toISOString();
    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(cfg));

    return json({ ok: true, jpgUrl });
  }

  // GET /api/global
  if (path === '/api/global' && method === 'GET') {
    const globalCfg = (await env.KV.get('config:global', 'json')) || {};
    const safe = stripSecrets(globalCfg);
    return json({ ok: true, data: safe });
  }

  // PUT /api/global
  if (path === '/api/global' && method === 'PUT') {
    const existing = (await env.KV.get('config:global', 'json')) || {};
    const body = await safeJson(request);
    if (!body) return json({ error: 'Invalid JSON' }, 400);

    // Never allow token overwrite from API body
    const updated = {
      ...existing,
      ...body,
      adminToken: existing.adminToken || null,
    };

    await env.KV.put('config:global', JSON.stringify(updated));
    return json({ ok: true, data: stripSecrets(updated) });
  }

  // GET /api/domains
  if (path === '/api/domains' && method === 'GET') {
    const list = await env.KV.list({ prefix: 'domain:' });
    const data = await Promise.all(
      list.keys.map(async (k) => ({
        domain: k.name.replace('domain:', ''),
        slug: await env.KV.get(k.name),
      })),
    );
    return json({ ok: true, data });
  }

  // POST /api/domains
  if (path === '/api/domains' && method === 'POST') {
    const body = await safeJson(request);
    if (!body) return json({ error: 'Invalid JSON' }, 400);

    const domain = sanitizeDomain(body.domain);
    const slug = normalizeSlug(body.slug);
    if (!domain || !slug) return json({ error: 'domain and slug required' }, 400);

    const slugCfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (!slugCfg) return json({ error: 'Slug not found' }, 404);

    await env.KV.put(`domain:${domain}`, slug);

    slugCfg.customDomain = domain;
    slugCfg.updatedAt = new Date().toISOString();
    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(slugCfg));

    return json({
      ok: true,
      instructions: `Set CNAME: ${domain} → ${ROOT_DOMAIN}`,
    });
  }

  // DELETE /api/domains/:domain
  const domainDel = path.match(/^\/api\/domains\/(.+)$/i);
  if (domainDel && method === 'DELETE') {
    const domain = sanitizeDomain(domainDel[1]);
    if (!domain) return json({ error: 'Invalid domain' }, 400);

    const mappedSlug = await env.KV.get(`domain:${domain}`);
    if (mappedSlug) {
      const slugCfg = await env.KV.get(`lp:${mappedSlug}:cfg`, 'json');
      if (slugCfg) {
        slugCfg.customDomain = '';
        slugCfg.updatedAt = new Date().toISOString();
        await env.KV.put(`lp:${mappedSlug}:cfg`, JSON.stringify(slugCfg));
      }
    }

    await env.KV.delete(`domain:${domain}`);
    return json({ ok: true });
  }

  // GET /api/shipping/search?q=...
  // Proxy → GET RajaOngkir V2 domestic-destination search
  if (path === '/api/shipping/search' && method === 'GET') {
    const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim();
    if (q.length < 3) return json({ success: true, data: [] });

    try {
      const limit = url.searchParams.get('limit') || '10';
      const offset = url.searchParams.get('offset') || '0';
      const r = await fetch(
        `${RAJAONGKIR_BASE}/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
        { headers: { key: rajaongkirKey(env) } }
      );

      if (!r.ok) return json({ success: false, data: [] });
      const result = await r.json();
      // Normalize to our format: {success, data: [{id, code, name, fullName, ...}]}
      const items = (result.data || []).map(d => ({
        id: d.id,
        code: String(d.id),
        name: d.subdistrict_name || d.district_name || '',
        district: d.district_name || '',
        city: d.city_name || '',
        province: d.province_name || '',
        zip: d.zip_code || '',
        fullName: d.label || '',
      }));
      return json({ success: true, data: items });
    } catch {
      return json({ success: false, data: [] });
    }
  }

  // POST /api/shipping/cost
  // Proxy → POST RajaOngkir V2 calculate/domestic-cost
  if (path === '/api/shipping/cost' && method === 'POST') {
    const body = await safeJson(request);
    if (!body) return json({ success: false, data: [] });

    // Accept origin/destination as RajaOngkir numeric IDs
    const origin = body.origin || body.originCode || '';
    const destination = body.destination || body.destCode || '';
    const weight = body.weight || 1000; // grams
    // Support multiple couriers or single
    const couriers = body.courier ? [body.courier]
      : (body.logistics || ['sap']).map(c => c.toLowerCase().replace(/\s+/g, ''));

    // Map common names to RajaOngkir courier codes
    const courierMap = {
      'saplogistic': 'sap', 'sap logistic': 'sap', 'sap': 'sap',
      'jne': 'jne', 'sicepat': 'sicepat', 'j&texpress': 'jnt', 'j&t express': 'jnt', 'jnt': 'jnt',
      'idexpress': 'ide', 'id express': 'ide', 'idx': 'ide', 'ide': 'ide',
      'ninjaxpress': 'ninja', 'ninja xpress': 'ninja', 'ninja': 'ninja',
      'paxel': 'paxel', 'pos': 'pos', 'tiki': 'tiki',
    };

    // Query each courier (RajaOngkir needs one courier per request)
    const allResults = [];
    for (const rawCourier of couriers) {
      const code = courierMap[rawCourier.toLowerCase()] || rawCourier.toLowerCase();
      try {
        const formBody = `origin=${origin}&destination=${destination}&weight=${weight}&courier=${code}`;
        const r = await fetch(`${RAJAONGKIR_BASE}/calculate/domestic-cost`, {
          method: 'POST',
          headers: {
            key: rajaongkirKey(env),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody,
        });

        if (r.ok) {
          const result = await r.json();
          if (result.data && Array.isArray(result.data)) {
            for (const item of result.data) {
              allResults.push({
                code: item.code || code,
                name: item.name || code,
                service: item.service || '',
                description: item.description || '',
                cost: item.cost || 0,
                etd: item.etd || '',
              });
            }
          }
        }
      } catch {
        // Skip failed courier
      }
    }

    // Normalize to Lincah-compatible format for backward compat with checkout.js
    // Group by courier code
    const grouped = {};
    for (const r of allResults) {
      if (!grouped[r.code]) {
        grouped[r.code] = { code: r.code, name: r.name, costs: [] };
      }
      grouped[r.code].costs.push({
        service: r.service,
        service_name: r.description || r.service,
        cost: { value: r.cost, etd: r.etd.replace(/ day/g, '') },
      });
    }

    return json({ success: true, data: Object.values(grouped) });
  }

  // GET /api/shipping/couriers
  // Static list of available couriers (RajaOngkir V2 codes)
  if (path === '/api/shipping/couriers' && method === 'GET') {
    return json({ success: true, data: [
      { code: 'sap', name: 'SAP Logistic', isMain: true },
      { code: 'jne', name: 'JNE', isMain: true },
      { code: 'sicepat', name: 'SiCepat', isMain: true },
      { code: 'jnt', name: 'J&T Express', isMain: true },
      { code: 'ide', name: 'ID Express', isMain: true },
      { code: 'ninja', name: 'Ninja Xpress', isMain: true },
      { code: 'pos', name: 'POS Indonesia', isMain: false },
      { code: 'tiki', name: 'TIKI', isMain: false },
      { code: 'paxel', name: 'Paxel', isMain: false },
    ]});
  }

  return json({ error: 'Not Found' }, 404);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function isAuthorized(request, env) {
  const fromEnv = (env.ADMIN_TOKEN || '').trim();
  const globalCfg = (await env.KV.get('config:global', 'json')) || {};
  const fromKV = (globalCfg.adminToken || '').trim();
  const token = fromEnv || fromKV;

  if (!token) return false;

  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;

  const incoming = auth.slice(7).trim();
  return safeEqual(incoming, token);
}

function stripSecrets(globalCfg) {
  const safe = { ...globalCfg };
  delete safe.adminToken;
  delete safe.lincahApiKey;
  delete safe.analytics?.capiToken;
  return safe;
}

function normalizeSlug(input) {
  if (!input) return '';
  const slug = String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug || slug.length < 2 || slug.length > 64) return '';
  return slug;
}

function sanitizeDomain(input) {
  if (!input) return '';
  const domain = String(input)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!/^[a-z0-9.-]+$/.test(domain)) return '';
  if (!domain.includes('.') || domain.length > 253) return '';
  return domain;
}

function sanitizeString(input) {
  if (input == null) return '';
  return String(input).trim();
}

function normalizeApiUrl(input) {
  const url = String(input || '').trim().replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function passThroughJson(response) {
  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
