import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  whatsappJid: varchar('whatsapp_jid', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  messageCount: integer('message_count').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').references(() => members.id),
  whatsappMessageId: varchar('whatsapp_message_id', { length: 100 }),
  content: text('content'),
  messageType: varchar('message_type', { length: 20 }).default('text'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const botLogs = pgTable('bot_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 50 }).notNull(),
  details: jsonb('details'),
  success: boolean('success').default(true),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const authState = pgTable('auth_state', {
  id: varchar('id', { length: 255 }).primaryKey(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
