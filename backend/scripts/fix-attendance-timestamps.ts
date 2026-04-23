/**
 * One-time migration: subtract 5h30m from the TIME portion only of all
 * ClassAttendance timestamps.  The calendar DATE is never changed.
 *
 * e.g.  07:30 → 02:00 (same date)
 *       20:43 → 15:13 (same date)
 *       02:00 → 20:30 (same date, time wraps within the day)
 *
 * Safe to run multiple times only if needed — use DRY_RUN=true to preview first.
 *
 * Usage:
 *   DRY_RUN=true npx ts-node scripts/fix-attendance-timestamps.ts   ← preview
 *             npx ts-node scripts/fix-attendance-timestamps.ts       ← live run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Subtract 5h30m (330 min) from the time component only.
 * The UTC year/month/day is preserved exactly — time wraps within the same day.
 */
function shiftTimeOnly(dt: Date): Date {
  const totalMins = dt.getUTCHours() * 60 + dt.getUTCMinutes();
  const shifted    = ((totalMins - 330) % 1440 + 1440) % 1440;  // always 0–1439
  const newH = Math.floor(shifted / 60);
  const newM = shifted % 60;
  const result = new Date(dt);
  result.setUTCHours(newH, newM, dt.getUTCSeconds(), dt.getUTCMilliseconds());
  return result;
}

function fmt(dt: Date | null): string {
  if (!dt) return 'null';
  return dt.toISOString().replace('T', ' ').slice(0, 19);
}

async function main() {
  console.log(`\n=== Attendance Time-Only Fix (${DRY_RUN ? 'DRY RUN — no changes written' : 'LIVE'}) ===`);
  console.log('Rule: date stays the same, only HH:mm shifts back 5h30m.\n');

  const records = await prisma.classAttendance.findMany({
    where: {
      OR: [
        { sessionAt:  { not: null } },
        { checkInAt:  { not: null } },
        { checkOutAt: { not: null } },
      ],
    },
    select: { id: true, sessionAt: true, checkInAt: true, checkOutAt: true },
  });

  console.log(`Found ${records.length} records with at least one timestamp.\n`);

  if (DRY_RUN) {
    console.log('Preview (first 15 records):');
    for (const r of records.slice(0, 15)) {
      console.log(`  id=${r.id}`);
      if (r.sessionAt)  console.log(`    sessionAt:  ${fmt(r.sessionAt)}  →  ${fmt(shiftTimeOnly(r.sessionAt))}`);
      if (r.checkInAt)  console.log(`    checkInAt:  ${fmt(r.checkInAt)}  →  ${fmt(shiftTimeOnly(r.checkInAt))}`);
      if (r.checkOutAt) console.log(`    checkOutAt: ${fmt(r.checkOutAt)}  →  ${fmt(shiftTimeOnly(r.checkOutAt))}`);
    }
    console.log('\nDRY RUN complete — nothing written.  Remove DRY_RUN=true to apply.');
    return;
  }

  let updated = 0, errors = 0;

  for (const r of records) {
    try {
      await prisma.classAttendance.update({
        where: { id: r.id },
        data: {
          sessionAt:  r.sessionAt  ? shiftTimeOnly(r.sessionAt)  : undefined,
          checkInAt:  r.checkInAt  ? shiftTimeOnly(r.checkInAt)  : undefined,
          checkOutAt: r.checkOutAt ? shiftTimeOnly(r.checkOutAt) : undefined,
        },
      });
      updated++;
      if (updated % 200 === 0) console.log(`  ${updated}/${records.length} updated…`);
    } catch (err) {
      errors++;
      console.error(`  ERROR id=${r.id}:`, err);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  Updated: ${updated}`);
  if (errors) console.log(`  Errors : ${errors}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
