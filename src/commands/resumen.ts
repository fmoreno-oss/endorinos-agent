import { getMessagesWithAuthors } from '../services/messages.js';
import { generateSummary } from '../services/claude.js';
import { sendVoiceNote } from '../whatsapp/sender.js';
import { logBotAction } from '../services/botlog.js';
import { parsePeriod } from '../lib/utils.js';
import { logger } from '../lib/logger.js';

export async function handleResumen(groupJid: string, args: string): Promise<void> {
  try {
    const days = args ? parsePeriod(args) : 1;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const msgs = await getMessagesWithAuthors(since);

    if (msgs.length < 3) {
      await sendVoiceNote(groupJid, 'No hay suficientes mensajes para generar un resumen en ese período.');
      return;
    }

    const formatted = msgs.map((m) => `${m.displayName}: ${m.content}`).join('\n');
    const summary = await generateSummary(formatted);

    await sendVoiceNote(groupJid, summary);
    await logBotAction('summary', { days, messageCount: msgs.length }, true);

    logger.info(`Summary sent for last ${days} day(s), ${msgs.length} messages`);
  } catch (error) {
    logger.error('Error generating summary:', error);
    await logBotAction('summary', { error: String(error) }, false, String(error));
  }
}
