import { desc, gte, and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { messages } from '../db/schema.js';
import { logger } from '../lib/logger.js';

interface SaveMessageInput {
  memberId: string;
  whatsappMessageId: string;
  content: string | null;
  messageType: string;
  sentAt: Date;
}

export async function saveMessage(input: SaveMessageInput): Promise<void> {
  await db.insert(messages).values({
    memberId: input.memberId,
    whatsappMessageId: input.whatsappMessageId,
    content: input.content,
    messageType: input.messageType,
    sentAt: input.sentAt,
  });
}

export async function getMessages(since: Date) {
  const result = await db
    .select()
    .from(messages)
    .where(and(gte(messages.sentAt, since), isNotNull(messages.content)))
    .orderBy(messages.sentAt);
  return result;
}

export async function getMessagesByPeriod(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return getMessages(since);
}

export async function getMessagesWithAuthors(since: Date) {
  const { members } = await import('../db/schema.js');

  const result = await db
    .select({
      content: messages.content,
      displayName: members.displayName,
      sentAt: messages.sentAt,
    })
    .from(messages)
    .innerJoin(members, eq(messages.memberId, members.id))
    .where(and(gte(messages.sentAt, since), isNotNull(messages.content)))
    .orderBy(messages.sentAt);

  return result;
}
