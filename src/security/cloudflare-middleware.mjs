// SECURITY / cloudflare-middleware — replaces req.ip with the visitor's real address when the Host turned on the Cloudflare option.
import { config } from '../core/config.mjs';
import { visitorViaCloudflare } from './cloudflare.mjs';

export function cloudflareAddress(req, res, next) {
  if (config.cloudflareIp) {
    const real = visitorViaCloudflare(req.headers, req.ip);
    if (real) { Object.defineProperty(req, 'ip', { value: real, configurable: true }); req.ipSource = 'cloudflare'; }
  }
  next();
}
