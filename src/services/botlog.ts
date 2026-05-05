import { db } from '../db/index.js';
import { botLogs } from '../db/schema.js';
import { logger } from '../lib/logger.js';

export async function logBotAction(
  action: string,
  details: Record<string, unknown>,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await db.insert(botLogs).values({
      action,
      details,
      success,
      error: error || null,
    });
  } catch (err) {
    logger.error('Failed to log bot action:', err);
  }
}
