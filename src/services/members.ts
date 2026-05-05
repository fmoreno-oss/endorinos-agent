import { eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { members } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import type { MemberStats } from '../types/index.js';
import { daysAgo } from '../lib/utils.js';

export async function upsertMember(jid: string, name: string | null): Promise<string> {
  const [existing] = await db
    .select()
    .from(members)
    .where(eq(members.whatsappJid, jid))
    .limit(1);

  if (existing) {
    if (name && name !== existing.displayName) {
      await db
        .update(members)
        .set({ displayName: name, updatedAt: new Date() })
        .where(eq(members.id, existing.id));
    }
    return existing.id;
  }

  const phone = jid.split('@')[0];
  const [newMember] = await db
    .insert(members)
    .values({
      whatsappJid: jid,
      displayName: name,
      phoneNumber: phone,
    })
    .returning({ id: members.id });

  logger.info(`New member registered: ${name || phone}`);
  return newMember.id;
}

export async function updateActivity(jid: string): Promise<void> {
  await db
    .update(members)
    .set({
      lastMessageAt: new Date(),
      messageCount: sql`${members.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(members.whatsappJid, jid));
}

export async function getInactiveMembers(days: number) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);

  return db
    .select()
    .from(members)
    .where(eq(members.isActive, true))
    .then((rows) =>
      rows.filter(
        (m) => !m.lastMessageAt || m.lastMessageAt < threshold,
      ),
    );
}

export async function getAllMembers() {
  return db.select().from(members).where(eq(members.isActive, true));
}

export async function getMemberStats(): Promise<MemberStats[]> {
  const allMembers = await getAllMembers();

  return allMembers.map((m) => ({
    displayName: m.displayName || m.phoneNumber || m.whatsappJid,
    messageCount: m.messageCount || 0,
    lastMessageAt: m.lastMessageAt,
    daysSinceLastMessage: m.lastMessageAt ? daysAgo(m.lastMessageAt) : null,
  }));
}

export async function syncGroupMembers(
  participants: { id: string; name?: string }[],
): Promise<void> {
  for (const p of participants) {
    await upsertMember(p.id, p.name || null);
  }
  logger.info(`Synced ${participants.length} group members`);
}
