import { logger } from '../lib/logger.js';
import { handleResumen } from './resumen.js';
import { handleActividad } from './actividad.js';

export async function handleCommand(text: string, groupJid: string): Promise<void> {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  logger.info(`Command received: ${command} ${args}`);

  switch (command) {
    case '!resumen':
      await handleResumen(groupJid, args);
      break;
    case '!actividad':
      await handleActividad(groupJid);
      break;
    default:
      // Unknown command — ignore silently
      break;
  }
}
