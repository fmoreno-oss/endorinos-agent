import { generateReply } from './chat.js';
import { sendVoiceNote } from '../whatsapp/sender.js';
import { logBotAction } from './botlog.js';
import { logger } from '../lib/logger.js';

export async function handleMention(senderName: string, message: string, groupJid: string): Promise<void> {
  try {
    logger.info(`Mention detected from ${senderName}: "${message}"`);
    const reply = await generateReply(senderName, message);
    await sendVoiceNote(groupJid, reply);
    await logBotAction('mention_reply', { senderName, message, reply }, true);
    logger.info(`Reply sent to ${senderName}`);
  } catch (error) {
    logger.error('Error handling mention:', error);
    await logBotAction('mention_reply', { error: String(error) }, false, String(error));
  }
}
