/* eslint-disable no-console */
/**
 * One-shot cleanup: collapse all duplicate @blue-owned "Orthopaedic Surgery
 * Fellowship Exam" checklists onto a single canonical row so every participant
 * shares the same project and leaderboard.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/dedup-ortho.ts
 *
 * Idempotent: re-running prints "Nothing to dedup."
 *
 * What it does:
 *   1. Find user @blue.
 *   2. Find all checklists owned by @blue named "Orthopaedic Surgery Fellowship Exam".
 *   3. Pick the oldest as canonical; set its visibility to PUBLIC_EDIT.
 *   4. For each duplicate:
 *        - Move ChecklistParticipant rows to canonical (skip conflicts).
 *        - Delete the duplicate checklist (cascade drops its items + orphan progress/revisions).
 *   5. Print a summary.
 *
 * Note: user progress/revisions on the duplicates are dropped because their
 * item ids don't match the canonical's item ids. Users will need to re-check
 * the items — this is called out in the PR description.
 */

import { PrismaClient } from "@prisma/client";

const ORTHO_NAME = "Orthopaedic Surgery Fellowship Exam";

async function main() {
  const prisma = new PrismaClient();
  try {
    const blue = await prisma.user.findUnique({ where: { username: "blue" } });
    if (!blue) {
      console.error("No user @blue found — aborting.");
      process.exit(1);
    }

    const ortho = await prisma.checklist.findMany({
      where: { userId: blue.id, name: ORTHO_NAME },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, visibility: true },
    });

    if (ortho.length === 0) {
      console.log("No Ortho checklist found for @blue. Nothing to dedup.");
      return;
    }

    if (ortho.length === 1) {
      // Still enforce visibility invariant.
      if (ortho[0].visibility !== "PUBLIC_EDIT") {
        await prisma.checklist.update({
          where: { id: ortho[0].id },
          data: { visibility: "PUBLIC_EDIT" },
        });
        console.log(`Only 1 Ortho found; updated visibility to PUBLIC_EDIT on ${ortho[0].id}.`);
      } else {
        console.log("Nothing to dedup.");
      }
      return;
    }

    const [canonical, ...duplicates] = ortho;
    console.log(`Canonical: ${canonical.id} (created ${canonical.createdAt.toISOString()})`);
    console.log(`Duplicates: ${duplicates.length}`);

    // Enforce canonical visibility.
    if (canonical.visibility !== "PUBLIC_EDIT") {
      await prisma.checklist.update({
        where: { id: canonical.id },
        data: { visibility: "PUBLIC_EDIT" },
      });
      console.log(`Updated canonical visibility → PUBLIC_EDIT`);
    }

    let movedParticipants = 0;
    let skippedParticipants = 0;

    for (const dup of duplicates) {
      const participants = await prisma.checklistParticipant.findMany({
        where: { checklistId: dup.id },
        select: { userId: true },
      });

      for (const p of participants) {
        // Skip if they're the canonical owner (@blue himself).
        if (p.userId === blue.id) continue;
        try {
          await prisma.checklistParticipant.upsert({
            where: { checklistId_userId: { checklistId: canonical.id, userId: p.userId } },
            update: {},
            create: { checklistId: canonical.id, userId: p.userId },
          });
          movedParticipants++;
        } catch (e) {
          skippedParticipants++;
          console.warn(`Failed to move participant ${p.userId}:`, (e as Error).message);
        }
      }

      // Delete the duplicate checklist (cascade drops items, progress, revisions).
      await prisma.checklist.delete({ where: { id: dup.id } });
      console.log(`Deleted duplicate ${dup.id}`);
    }

    console.log(
      `\nDone. Kept canonical ${canonical.id}, merged ${duplicates.length} duplicates, moved ${movedParticipants} participants (${skippedParticipants} skipped).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
