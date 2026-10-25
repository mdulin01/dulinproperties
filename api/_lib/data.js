import { db } from './firebase.js';

/**
 * Adapted from rainbow-rentals/api/_lib/data.js weeklyBackup().
 * Snapshot rentalData into backup-YYYY-MM-DD, retaining eight snapshots.
 * Daily cron checks for a backup older than 6.5 days. UTC dates label snapshots;
 * they do not change the local business dates stored in the source records.
 * Embedded fileData and legacy fileUrl data URLs are omitted; Storage URLs stay.
 */
export async function weeklyBackup({ force = false, firestore, now = new Date() } = {}) {
  const d = firestore || db();
  const at = now.toISOString();
  const dateStr = at.slice(0, 10);
  const metaRef = d.doc('rentalData/backupMeta');

  // Snapshot, retention, and metadata commit together. Concurrent cron deliveries
  // retry against the updated metadata and cannot overwrite a completed backup.
  return d.runTransaction(async tx => {
    const meta = (await tx.get(metaRef)).data() || {};
    if (!force && meta.lastAt && now.getTime() - new Date(meta.lastAt).getTime() < 6.5 * 86400000) return null;

    const snap = await tx.get(d.collection('rentalData'));
    const data = Object.create(null);
    for (const docSnap of snap.docs) {
      if (docSnap.id.startsWith('backup')) continue;
      const value = docSnap.data();
      data[docSnap.id] = docSnap.id === 'documents' && Array.isArray(value.documents)
        ? { ...value, documents: value.documents.map(document => {
          const index = { ...document };
          delete index.fileData;
          if (typeof index.fileUrl === 'string' && index.fileUrl.startsWith('data:')) delete index.fileUrl;
          return index;
        }) }
        : value;
    }

    const json = JSON.stringify(data);
    // Firestore documents are limited to 1 MiB; leave room for field/path overhead.
    // Refuse oversized backups without advancing metadata or pruning good copies.
    if (Buffer.byteLength(json, 'utf8') > 950 * 1024) {
      throw new Error('Backup exceeds 950 KiB; use a managed Firestore export');
    }
    const priorDates = (Array.isArray(meta.dates) ? meta.dates : [])
      .filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date));
    const dates = [...new Set([...priorDates, dateStr])].sort();
    tx.set(d.doc(`rentalData/backup-${dateStr}`), { json, at, by: 'cron' });
    for (const old of dates.slice(0, Math.max(0, dates.length - 8))) {
      tx.delete(d.doc(`rentalData/backup-${old}`));
    }
    tx.set(metaRef, { lastAt: at, dates: dates.slice(-8) });
    return dateStr;
  });
}
