import { weeklyBackup } from '../_lib/data.js';

// GET /api/cron/backup. Vercel supplies Authorization: Bearer $CRON_SECRET.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // An authenticated dry run checks routing/auth only; it never accesses Firebase.
  if (req.query?.dry === '1') return res.status(200).json({ ok: true, backup: 'skipped (dry run)' });

  try {
    const backup = await weeklyBackup();
    return res.status(200).json({ ok: true, backup });
  } catch (error) {
    // Log only a code, never SDK errors that could contain credentials or data.
    console.error('cron/backup failed', { code: error.code || 'backup-failed' });
    return res.status(500).json({ error: 'backup failed; check server configuration and backup size' });
  }
}
