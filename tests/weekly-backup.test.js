import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import test from 'node:test';
import { weeklyBackup } from '../api/_lib/data.js';
import { adminApp } from '../api/_lib/firebase.js';
import handler from '../api/cron/backup.js';

// Fictional in-memory store. Writes become visible only after a successful
// transaction, matching the Firestore atomic commit contract.
function store(initial = {}, { failCommit = false, failRead = false } = {}) {
  const records = new Map(Object.entries(structuredClone(initial)));
  return {
    records,
    doc: path => ({ path }),
    collection: path => ({ path, query: true }),
    async runTransaction(callback) {
      const writes = [];
      const result = await callback({
        async get(ref) {
          if (failRead) throw new Error('read failed');
          if (ref.query) return { docs: [...records].filter(([path]) => path.startsWith(`${ref.path}/`))
            .map(([path, value]) => ({ id: path.split('/').at(-1), data: () => structuredClone(value) })) };
          return { data: () => structuredClone(records.get(ref.path)) };
        },
        set(ref, value) { writes.push(() => records.set(ref.path, structuredClone(value))); },
        delete(ref) { writes.push(() => records.delete(ref.path)); },
      });
      if (failCommit) throw new Error('commit failed');
      writes.forEach(write => write());
      return result;
    },
  };
}
const now = new Date('2026-10-25T14:00:00Z');

test('backs up every application document, excluding prior backups and embedded file bytes', async () => {
  const firestore = store({
    'rentalData/properties': { properties: [{ id: 'fictional-property', name: 'Sample House' }] },
    'rentalData/expenses': { expenses: [{ id: 'fictional-expense', amount: 12 }] },
    'rentalData/reconciliations': { months: ['2026-09'] },
    'rentalData/documents': { documents: [
      { id: 'sample', fileData: 'private-bytes', storagePath: 'sample.pdf', fileUrl: 'https://example.invalid/sample.pdf' },
      { id: 'legacy', fileUrl: 'data:image/png;base64,fictional' },
    ], version: 1 },
    'rentalData/backup-2026-10-01': { json: '{}' },
    'rentalData/backupMeta': { lastAt: '2026-10-01T14:00:00Z', dates: ['2026-10-01'] },
  });
  const sourceBefore = structuredClone(firestore.records.get('rentalData/documents'));
  assert.equal(await weeklyBackup({ firestore, now }), '2026-10-25');
  const backup = firestore.records.get('rentalData/backup-2026-10-25');
  assert.equal(backup.at, now.toISOString());
  const data = JSON.parse(backup.json);
  assert.deepEqual(Object.keys(data).sort(), ['documents', 'expenses', 'properties', 'reconciliations']);
  assert.equal(data.expenses.expenses[0].amount, 12);
  assert.deepEqual(data.documents, { documents: [
    { id: 'sample', storagePath: 'sample.pdf', fileUrl: 'https://example.invalid/sample.pdf' },
    { id: 'legacy' },
  ], version: 1 });
  assert.deepEqual(firestore.records.get('rentalData/documents'), sourceBefore);
  assert.deepEqual(firestore.records.get('rentalData/backupMeta'), {
    lastAt: now.toISOString(), dates: ['2026-10-01', '2026-10-25'],
  });
});

test('skips within 6.5 days, runs at the boundary, and skips a duplicate delivery', async () => {
  const firestore = store({ 'rentalData/properties': { properties: [] } });
  await weeklyBackup({ firestore, now });
  const saved = structuredClone([...firestore.records]);
  assert.equal(await weeklyBackup({ firestore, now: new Date(now.getTime() + 6.5 * 86400000 - 1) }), null);
  assert.deepEqual([...firestore.records], saved);
  const due = new Date(now.getTime() + 6.5 * 86400000);
  assert.equal(await weeklyBackup({ firestore, now: due }), '2026-11-01');
  assert.equal(await weeklyBackup({ firestore, now: due }), null);
});

test('force can refresh a recent snapshot without duplicating its retained date', async () => {
  const firestore = store();
  await weeklyBackup({ firestore, now });
  firestore.records.set('rentalData/rent', { payments: [{ amount: 100 }] });
  assert.equal(await weeklyBackup({ firestore, now, force: true }), '2026-10-25');
  assert.deepEqual(firestore.records.get('rentalData/backupMeta').dates, ['2026-10-25']);
  assert.equal(JSON.parse(firestore.records.get('rentalData/backup-2026-10-25').json).rent.payments[0].amount, 100);
});

test('retains eight snapshots and never prunes a live document from malformed metadata', async () => {
  const dates = ['2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'];
  const initial = Object.fromEntries(dates.map(date => [`rentalData/backup-${date}`, { json: '{}' }]));
  initial['rentalData/backupMeta'] = { lastAt: '2026-10-18T14:00:00Z', dates: [...dates, dates[0], '../expenses', null] };
  initial['rentalData/expenses'] = { expenses: [] };
  const firestore = store(initial);
  await weeklyBackup({ firestore, now });
  assert.equal(firestore.records.has('rentalData/backup-2026-08-30'), false);
  assert.equal(firestore.records.has('rentalData/expenses'), true);
  assert.deepEqual(firestore.records.get('rentalData/backupMeta').dates, [...dates.slice(1), '2026-10-25']);
});

test('an invalid previous timestamp does not suppress backups', async () => {
  const firestore = store({ 'rentalData/backupMeta': { lastAt: 'invalid', dates: 'invalid' } });
  assert.equal(await weeklyBackup({ firestore, now }), '2026-10-25');
});

for (const failure of ['oversized', 'read', 'commit']) {
  test(`${failure} failure preserves source, metadata and all previous backups`, async () => {
    const initial = {
      'rentalData/backupMeta': { lastAt: '2026-10-01T14:00:00Z', dates: ['2026-10-01'] },
      'rentalData/backup-2026-10-01': { json: '{}' },
      'rentalData/expenses': { note: failure === 'oversized' ? 'é'.repeat(500000) : 'fictional' },
    };
    const firestore = store(initial, { failRead: failure === 'read', failCommit: failure === 'commit' });
    const before = structuredClone([...firestore.records]);
    await assert.rejects(weeklyBackup({ firestore, now }));
    assert.deepEqual([...firestore.records], before);
  });
}

function testEnv(t) {
  const saved = new Map();
  function set(key, value) {
    if (!saved.has(key)) saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return { set, delete: key => set(key, undefined) };
}

function response() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('cron refuses missing/wrong credentials and non-GET requests before Firebase access', async t => {
  const env = testEnv(t);
  env.set('CRON_SECRET', 'fictional-cron-secret');
  env.delete('FIREBASE_SERVICE_ACCOUNT');
  for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
    const res = response();
    await handler({ method: 'GET', headers }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
  const post = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer fictional-cron-secret' } }, post);
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.Allow, 'GET');
  env.delete('CRON_SECRET');
  const missing = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer undefined' } }, missing);
  assert.equal(missing.statusCode, 401);
});

test('authenticated dry run avoids Firebase; a real run without configuration fails visibly', async t => {
  const env = testEnv(t);
  env.set('CRON_SECRET', 'fictional-cron-secret');
  env.delete('FIREBASE_SERVICE_ACCOUNT');
  const req = { method: 'GET', headers: { authorization: 'Bearer fictional-cron-secret' } };
  const dry = response();
  await handler({ ...req, query: { dry: '1' } }, dry);
  assert.equal(dry.statusCode, 200);
  assert.equal(dry.body.backup, 'skipped (dry run)');
  const log = t.mock.method(console, 'error', () => {});
  const failed = response();
  await handler(req, failed);
  assert.equal(failed.statusCode, 500);
  assert.deepEqual(log.mock.calls[0].arguments, ['cron/backup failed', { code: 'backup-failed' }]);
  assert.equal(JSON.stringify(failed.body).includes('FIREBASE_SERVICE_ACCOUNT'), false);
});

test('Firebase Admin rejects missing, malformed and other-project credentials', async t => {
  const env = testEnv(t);
  env.delete('FIREBASE_SERVICE_ACCOUNT');
  assert.throws(() => adminApp(), /not set/);
  env.set('FIREBASE_SERVICE_ACCOUNT', '{invalid');
  assert.throws(() => adminApp());
  env.set('FIREBASE_SERVICE_ACCOUNT', JSON.stringify({ project_id: 'rainbow-rentals' }));
  assert.throws(() => adminApp(), /requires a dulinproperties/);
});

test('raw and base64 synthetic credentials initialize only the named Dulin app without network calls', async t => {
  const env = testEnv(t);
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const account = JSON.stringify({ project_id: 'dulinproperties', client_email: 'fictional@dulinproperties.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  for (const raw of [account, Buffer.from(account).toString('base64')]) {
    env.set('FIREBASE_SERVICE_ACCOUNT', raw);
    const app = adminApp();
    try {
      assert.equal(app.name, 'dulinproperties-backup');
      assert.equal(app.options.projectId, 'dulinproperties');
      assert.equal(adminApp(), app);
    } finally {
      await deleteApp(app);
    }
  }
});
