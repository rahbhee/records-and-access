import { getDb } from '../lib/db';
import { ensureSeedUsers, generatePublicId } from '../lib/auth';

console.log('--- Initializing SQLite Database for Assessment 4 ---');
const db = getDb();
ensureSeedUsers();

// Clean existing data for clean demo
db.exec(`
  DELETE FROM audit_logs;
  DELETE FROM records;
`);

const alice = db.prepare('SELECT id, public_id, email FROM users WHERE email = ?').get('alice@company.com') as { id: number; public_id: string; email: string };
const bob = db.prepare('SELECT id, public_id, email FROM users WHERE email = ?').get('bob@company.com') as { id: number; public_id: string; email: string };

const insertRecord = db.prepare(`
  INSERT INTO records (public_id, user_id, title, category, content, amount_cents, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
`);

const now = new Date();
const formatIso = (offsetMinutes = 0) => new Date(now.getTime() - offsetMinutes * 60000).toISOString();

// Seed Alice's Records
const aliceRec1 = generatePublicId('rec');
const aliceRec2 = generatePublicId('rec');
const aliceRec3 = generatePublicId('rec');

insertRecord.run(
  aliceRec1,
  alice.id,
  'Project Hyperion NDA & Security Architecture Spec',
  'Technical Architecture',
  'Proprietary multi-tenant encryption spec with zero-trust key rotation and hardware security module access logs.',
  450000,
  formatIso(120),
  formatIso(120)
);

insertRecord.run(
  aliceRec2,
  alice.id,
  'Q3 Enterprise Enterprise SaaS License - Alpha Corp',
  'Commercial Contract',
  '500 seat enterprise license agreement with bespoke SLA, 99.99% uptime guarantee, and quarterly billing terms.',
  1280000,
  formatIso(60),
  formatIso(60)
);

insertRecord.run(
  aliceRec3,
  alice.id,
  'Confidential M&A Valuation Matrix',
  'Financial Advisory',
  'Internal discounted cash flow model and valuation comparables for pending acquisition target.',
  3200000,
  formatIso(15),
  formatIso(15)
);

// Seed Bob's Records
const bobRec1 = generatePublicId('rec');
const bobRec2 = generatePublicId('rec');

insertRecord.run(
  bobRec1,
  bob.id,
  'Cloud Infrastructure Migration Plan - Phase 2',
  'DevOps & Infrastructure',
  'Multi-region Kubernetes cluster deployment blueprint with automated failover and egress cost limits.',
  890000,
  formatIso(90),
  formatIso(90)
);

insertRecord.run(
  bobRec2,
  bob.id,
  'Cybersecurity Penetration Test Report - Q3',
  'Compliance & Audit',
  'Third-party external gray-box penetration test findings, remediation timelines, and risk rating summaries.',
  670000,
  formatIso(30),
  formatIso(30)
);

console.log('✓ Database initialized successfully with strictly isolated seed data:');
console.log(`  - Alice (${alice.email}): 3 confidential records created.`);
console.log(`  - Bob (${bob.email}): 2 confidential records created.`);
console.log(`  - Database file: ./data/records_access.db`);
