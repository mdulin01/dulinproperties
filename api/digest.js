import { timingSafeEqual } from 'node:crypto';
import { buildDigest, loadDigestData } from './_lib/digest.js';

export function createDigestHandler({ load = loadDigestData, now = () => new Date(), secret = () => process.env.DIGEST_SECRET } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const configured = secret();
    const header = req.headers?.authorization;
    // The owner's file spec takes precedence: non-GET also returns empty 401.
    if (req.method !== 'GET' || !configured || typeof header !== 'string') return res.status(401).end();
    const expected = Buffer.from(`Bearer ${configured}`);
    const actual = Buffer.from(header);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).end();
    try {
      const at = now();
      return res.status(200).json(buildDigest(await load(), at));
    } catch {
      console.error('digest read failed');
      return res.status(500).end();
    }
  };
}

export default createDigestHandler();
