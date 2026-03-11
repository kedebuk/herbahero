/**
 * index.js — Herbahero Cloudflare Worker
 * Central router: LP pages, admin SPA, CRUD API
 */

import { generateLPShell } from './lp-shell.js';

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

    // API routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, url);
    }

    // Admin SPA
    if (path === '/' || path === '/admin' || path.startsWith('/admin/')) {
      return serveAdmin(env);
    }

    // LP route: /:slug
    const slugMatch = path.match(/^\/([a-z0-9-]+)\/?$/i);
    if (slugMatch) {
      return handleLP(slugMatch[1], env);
    }

    return json({ error: 'Not Found' }, 404);
  }
};

// ─── LP Handler ───────────────────────────────────────────────────────────────

async function handleLP(slug, env) {
  const cfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
  if (!cfg) {
    return new Response('<h1>LP not found</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    });
  }
  const global = await env.KV.get('config:global', 'json') || {};
  const html = generateLPShell(cfg, global);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' }
  });
}

// ─── Admin SPA ────────────────────────────────────────────────────────────────

async function serveAdmin(env) {
  // Try to load admin HTML from KV (so it can be updated without redeploying)
  const adminHtml = await env.KV.get('static:admin.html');
  if (adminHtml) {
    return new Response(adminHtml, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
  }
  // Fallback stub
  return new Response(`<!DOCTYPE html><html><head><title>Herbahero Admin</title></head>
<body><p>Admin UI not loaded. Upload admin HTML via: <code>wrangler kv:key put "static:admin.html" --path admin/index.html</code></p></body></html>`, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' }
  });
}

// ─── API Handler ──────────────────────────────────────────────────────────────

async function handleAPI(request, env, url) {
  const path = url.pathname;

  // Auth check (skip shipping proxy — it's called by LP page)
  const isShipping = path.startsWith('/api/shipping/');
  if (!isShipping) {
    const global = await env.KV.get('config:global', 'json') || {};
    const token = global.adminToken || env.ADMIN_TOKEN || '';
    const auth = request.headers.get('Authorization') || '';
    if (token && auth !== `Bearer ${token}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  // GET /api/slugs
  if (path === '/api/slugs' && request.method === 'GET') {
    const index = await env.KV.get('slugs:index', 'json') || [];
    return json({ ok: true, data: index });
  }

  // POST /api/slugs
  if (path === '/api/slugs' && request.method === 'POST') {
    const body = await request.json();
    if (!body.slug || !body.productName) {
      return json({ error: 'slug and productName required' }, 400);
    }
    const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const now = new Date().toISOString();
    const cfg = {
      slug,
      productName: body.productName,
      status: body.status || 'active',
      jpgUrl: body.jpgUrl || '',
      customDomain: body.customDomain || '',
      packages: body.packages || [],
      payment: body.payment || { method: 'cod' },
      gasWebhookUrl: body.gasWebhookUrl || '',
      waNumber: body.waNumber || '',
      analytics: body.analytics || {},
      warehouseOrigin: body.warehouseOrigin || null,
      createdAt: now,
      updatedAt: now,
    };
    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(cfg));
    const index = await env.KV.get('slugs:index', 'json') || [];
    if (!index.includes(slug)) { index.push(slug); await env.KV.put('slugs:index', JSON.stringify(index)); }
    return json({ ok: true, slug }, 201);
  }

  // GET /api/slugs/:slug
  const slugGet = path.match(/^\/api\/slugs\/([a-z0-9-]+)$/i);
  if (slugGet && request.method === 'GET') {
    const cfg = await env.KV.get(`lp:${slugGet[1]}:cfg`, 'json');
    if (!cfg) return json({ error: 'Not found' }, 404);
    return json({ ok: true, data: cfg });
  }

  // PUT /api/slugs/:slug
  const slugPut = path.match(/^\/api\/slugs\/([a-z0-9-]+)$/i);
  if (slugPut && request.method === 'PUT') {
    const slug = slugPut[1];
    const existing = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (!existing) return json({ error: 'Not found' }, 404);
    const body = await request.json();
    const updated = { ...existing, ...body, slug, updatedAt: new Date().toISOString() };
    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(updated));
    return json({ ok: true, data: updated });
  }

  // DELETE /api/slugs/:slug
  const slugDel = path.match(/^\/api\/slugs\/([a-z0-9-]+)$/i);
  if (slugDel && request.method === 'DELETE') {
    const slug = slugDel[1];
    await env.KV.delete(`lp:${slug}:cfg`);
    const index = (await env.KV.get('slugs:index', 'json') || []).filter(s => s !== slug);
    await env.KV.put('slugs:index', JSON.stringify(index));
    return json({ ok: true });
  }

  // POST /api/slugs/:slug/upload
  const uploadMatch = path.match(/^\/api\/slugs\/([a-z0-9-]+)\/upload$/i);
  if (uploadMatch && request.method === 'POST') {
    const slug = uploadMatch[1];
    const cfg = await env.KV.get(`lp:${slug}:cfg`, 'json');
    if (!cfg) return json({ error: 'Slug not found' }, 404);

    const formData = await request.formData();
    const file = formData.get('jpg') || formData.get('file');
    if (!file) return json({ error: 'No file uploaded (use field name "jpg")' }, 400);

    const contentType = file.type || 'image/jpeg';
    if (!contentType.startsWith('image/')) return json({ error: 'Only images allowed' }, 400);

    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const key = `lp/${slug}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType } });

    const mediaBase = env.MEDIA_BASE_URL || 'https://media.herbahero.my.id';
    const jpgUrl = `${mediaBase}/${key}`;
    cfg.jpgUrl = jpgUrl;
    cfg.updatedAt = new Date().toISOString();
    await env.KV.put(`lp:${slug}:cfg`, JSON.stringify(cfg));

    return json({ ok: true, jpgUrl });
  }

  // GET /api/global
  if (path === '/api/global' && request.method === 'GET') {
    const global = await env.KV.get('config:global', 'json') || {};
    const safe = { ...global };
    delete safe.adminToken; // never expose token
    return json({ ok: true, data: safe });
  }

  // PUT /api/global
  if (path === '/api/global' && request.method === 'PUT') {
    const existing = await env.KV.get('config:global', 'json') || {};
    const body = await request.json();
    const updated = { ...existing, ...body };
    await env.KV.put('config:global', JSON.stringify(updated));
    const safe = { ...updated };
    delete safe.adminToken;
    return json({ ok: true, data: safe });
  }

  // GET /api/domains
  if (path === '/api/domains' && request.method === 'GET') {
    const list = await env.KV.list({ prefix: 'domain:' });
    const domains = await Promise.all(
      list.keys.map(async k => ({
        domain: k.name.replace('domain:', ''),
        slug: await env.KV.get(k.name),
      }))
    );
    return json({ ok: true, data: domains });
  }

  // POST /api/domains
  if (path === '/api/domains' && request.method === 'POST') {
    const body = await request.json();
    if (!body.domain || !body.slug) return json({ error: 'domain and slug required' }, 400);
    await env.KV.put(`domain:${body.domain}`, body.slug);
    return json({
      ok: true,
      instructions: `Set CNAME: ${body.domain} → herbahero.my.id at your DNS provider.`
    });
  }

  // DELETE /api/domains/:domain
  const domainDel = path.match(/^\/api\/domains\/(.+)$/);
  if (domainDel && request.method === 'DELETE') {
    await env.KV.delete(`domain:${domainDel[1]}`);
    return json({ ok: true });
  }

  // GET /api/shipping/search?search=...
  // Uses API Lincah (courier aggregator). Env: LINCAH_API_KEY, LINCAH_API_URL
  if (path === '/api/shipping/search' && request.method === 'GET') {
    const q = url.searchParams.get('search') || '';
    if (q.length < 2) return json({ data: [] });
    const global = await env.KV.get('config:global', 'json') || {};
    const apiKey = global.lincahApiKey || env.LINCAH_API_KEY || '';
    const apiUrl = global.lincahApiUrl || env.LINCAH_API_URL || '';
    if (!apiKey || !apiUrl) return json({ data: [] }); // not configured yet
    try {
      const r = await fetch(
        `${apiUrl}/destination?search=${encodeURIComponent(q)}`,
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
      );
      if (!r.ok) return json({ data: [] });
      return r; // proxy response as-is
    } catch {
      return json({ data: [] });
    }
  }

  // POST /api/shipping/cost
  // Uses API Lincah. Falls back silently so LP uses static rates.
  if (path === '/api/shipping/cost' && request.method === 'POST') {
    const body = await request.json();
    const global = await env.KV.get('config:global', 'json') || {};
    const apiKey = global.lincahApiKey || env.LINCAH_API_KEY || '';
    const apiUrl = global.lincahApiUrl || env.LINCAH_API_URL || '';
    if (!apiKey || !apiUrl) return json({ data: [] });
    const origin = body.origin || global.warehouseOrigin?.cityId || '';
    try {
      const r = await fetch(`${apiUrl}/cost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          origin,
          destination: body.destId,
          weight: body.weight || 1000,
        }),
      });
      if (!r.ok) return json({ data: [] });
      return r;
    } catch {
      return json({ data: [] });
    }
  }

  return json({ error: 'Not Found' }, 404);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
