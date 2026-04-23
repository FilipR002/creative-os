#!/usr/bin/env ts-node
// ─── User Migration Script: Prisma → Supabase Auth ───────────────────────────
// Reads all users from Railway PostgreSQL (Prisma) and creates matching
// Supabase Auth accounts. Safe to rerun — skips existing users.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_KEY=service_role_key \
//   DATABASE_URL=postgresql://... \
//   npx ts-node scripts/migrate-users-to-supabase.ts

import { PrismaClient }    from '@prisma/client';
import { createClient }    from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!; // service_role key, NOT anon key
const TEMP_PASSWORD        = process.env.MIGRATION_TEMP_PASSWORD ?? 'ChangeMe2024!';
const SEND_RESET_EMAIL     = process.env.SEND_RESET_EMAIL === 'true'; // set to trigger password reset emails

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const prisma    = new PrismaClient();
const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface MigrationResult {
  email:   string;
  status:  'created' | 'skipped' | 'failed';
  reason?: string;
}

async function migrateUsers(): Promise<void> {
  console.log('🚀 Starting user migration: Prisma → Supabase Auth\n');

  // Fetch all users from Prisma
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    where:  { email: { not: null } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 Found ${users.length} users to migrate\n`);

  const results: MigrationResult[] = [];
  let created = 0, skipped = 0, failed = 0;

  for (const user of users) {
    if (!user.email) continue;

    process.stdout.write(`Processing ${user.email}... `);

    try {
      // Check if user already exists in Supabase
      const { data: existing } = await supabase.auth.admin.listUsers();
      const alreadyExists = existing?.users?.some(u => u.email === user.email);

      if (alreadyExists) {
        console.log('⏭  skipped (already exists)');
        results.push({ email: user.email, status: 'skipped', reason: 'already exists' });
        skipped++;
        continue;
      }

      // Create user in Supabase with temporary password
      const { data, error } = await supabase.auth.admin.createUser({
        email:              user.email,
        password:           TEMP_PASSWORD,
        email_confirm:      true, // skip email confirmation for migrated users
        user_metadata: {
          full_name: user.name ?? '',
          migrated:  true,
          legacy_id: user.id,
        },
      });

      if (error) throw new Error(error.message);

      console.log(`✅ created (id: ${data.user.id})`);
      results.push({ email: user.email, status: 'created' });
      created++;

      // Optionally send password reset email
      if (SEND_RESET_EMAIL) {
        await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${process.env.APP_URL ?? 'https://creative-os-eta.vercel.app'}/auth/callback?next=/set-password`,
        });
        console.log(`   📧 Reset email sent to ${user.email}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`❌ failed: ${reason}`);
      results.push({ email: user.email, status: 'failed', reason });
      failed++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Created:  ${created}`);
  console.log(`⏭  Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`📊 Total:    ${users.length}`);
  console.log('─────────────────────────────────────────\n');

  if (failed > 0) {
    console.log('Failed users:');
    results.filter(r => r.status === 'failed')
      .forEach(r => console.log(`  ${r.email}: ${r.reason}`));
  }

  if (!SEND_RESET_EMAIL && created > 0) {
    console.log(`\n⚠️  Migrated users have temporary password: "${TEMP_PASSWORD}"`);
    console.log('   Re-run with SEND_RESET_EMAIL=true to send password reset emails.\n');
  }
}

migrateUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
