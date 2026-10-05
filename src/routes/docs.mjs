// ROUTES / docs — GET / (contents), /search?q=, /:slug for one documentation set. Mounted under /api/app/docs and /api/host/docs.
import express from 'express';
import { toc, search, page } from '../services/docs/index.mjs';

export function docsRoutes(realm) {
  const r = express.Router();
  r.get('/', (req, res) => res.json({ pages: toc(realm) }));
  r.get('/search', (req, res) => res.json({ results: search(realm, String(req.query.q || '').slice(0, 100)) }));
  r.get('/:slug', (req, res) => { const p = page(realm, String(req.params.slug)); if (!p) return res.status(404).json({ error: 'That page does not exist.' }); res.json(p); });
  return r;
}
