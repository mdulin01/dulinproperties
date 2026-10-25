import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { weeklyBackup } from '../api/_lib/data.js';

test('real Firestore transactions retain eight backups and serialize duplicate cron deliveries', async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8180', 'Run only through the local backup emulator command');
  const app = initializeApp({ projectId: 'demo-dulin-backup' }, 'backup-emulator');
  const firestore = getFirestore(app);
  try {
    await firestore.doc('rentalData/properties').set({ properties: [{ id: 'fictional', name: 'Sample House' }] });
    await firestore.doc('rentalData/expenses').set({ expenses: [{ id: 'fictional', amount: 12 }] });
    const start = new Date('2026-08-23T14:00:00Z');
    for (let week = 0; week < 9; week++) {
      const now = new Date(start.getTime() + week * 7 * 86400000);
      assert.equal(await weeklyBackup({ firestore, now }), now.toISOString().slice(0, 10));
    }
    const next = new Date('2026-10-25T14:00:00Z');
    const results = await Promise.all(Array.from({ length: 4 }, () => weeklyBackup({ firestore, now: next })));
    assert.deepEqual(results.filter(Boolean), ['2026-10-25']);
    const snapshot = await firestore.collection('rentalData').get();
    assert.equal(snapshot.docs.filter(doc => doc.id.startsWith('backup-')).length, 8);
    const meta = (await firestore.doc('rentalData/backupMeta').get()).data();
    assert.equal(meta.dates.length, 8);
    assert.equal(meta.lastAt, next.toISOString());
    const backup = (await firestore.doc('rentalData/backup-2026-10-25').get()).data();
    assert.equal(JSON.parse(backup.json).expenses.expenses[0].amount, 12);

    await firestore.doc('rentalData/expenses').set({ note: 'é'.repeat(500000) });
    await assert.rejects(weeklyBackup({ firestore, now: new Date('2026-11-01T14:00:00Z') }), /950 KiB/);
    assert.deepEqual((await firestore.doc('rentalData/backupMeta').get()).data(), meta);
    assert.equal((await firestore.doc('rentalData/backup-2026-11-01').get()).exists, false);
  } finally {
    await firestore.terminate();
    await deleteApp(app);
  }
});
