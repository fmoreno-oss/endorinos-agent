import { getMemberStats } from '../services/members.js';
import { generateActivityReport } from '../services/claude.js';
import { sendVoiceNote } from '../whatsapp/sender.js';
import { logBotAction } from '../services/botlog.js';
import { logger } from '../lib/logger.js';

export async function handleActividad(groupJid: string): Promise<void> {
  try {
    const stats = await getMemberStats();

    if (stats.length === 0) {
      await sendVoiceNote(groupJid, 'Aún no tengo datos de actividad. Espera a que recolecte algunos mensajes.');
      return;
    }

    const report = await generateActivityReport(stats);

    await sendVoiceNote(groupJid, report);
    await logBotAction('activity', { memberCount: stats.length }, true);

    logger.info(`Activity report sent for ${stats.length} members`);
  } catch (error) {
    logger.error('Error generating activity report:', error);
    await logBotAction('activity', { error: String(error) }, false, String(error));
  }
}
