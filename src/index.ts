import { env } from './config/env.js';
// v5 - STRICT @mention only - diagnóstico completo
import { logger } from './lib/logger.js';
import { connectWhatsApp, onMessage, getSocket } from './whatsapp/client.js';
import { upsertMember, updateActivity } from './services/members.js';
import { saveMessage } from './services/messages.js';
import { handleCommand } from './commands/index.js';
import { handleMention } from './services/mention.js';
import { startCronJobs } from './cron/jobs.js';
import { COMMAND_PREFIX } from './config/constants.js';
import type { proto } from 'baileys';

function getTextContent(msg: proto.IWebMessageInfo): string | null {
        const m = msg.message;
        if (!m) return null;
        return m.conversation || m.extendedTextMessage?.text || null;
}

function getMessageType(msg: proto.IWebMessageInfo): string {
        const m = msg.message;
        if (!m) return 'unknown';
        return Object.keys(m)[0] ?? 'unknown';
}

async function main() {
        logger.info('[v5] Starting Endorinos WhatsApp Agent - STRICT @mention mode...');

    await connectWhatsApp();
        logger.info('WhatsApp connection established');

    startCronJobs();

    onMessage(async ({ messages, type }) => {
                if (type !== 'notify') return;

                      for (const msg of messages as proto.IWebMessageInfo[]) {
                                      try {
                                                          const jid = msg.key.remoteJid ?? '';

                                          // Solo mensajes de grupo
                                          if (!jid.endsWith('@g.us')) continue;

                                          // Log group discovery
                                          if (!env.WHATSAPP_GROUP_JID) {
                                                                  logger.info(`[JID DISCOVERY] Grupo desconocido: ${jid}`);
                                          }

                                          // Solo grupos permitidos
                                          const allowedGroups = [env.WHATSAPP_GROUP_JID];
                                                          if (env.WHATSAPP_WARROOM_JID) allowedGroups.push(env.WHATSAPP_WARROOM_JID);
                                                          if (!allowedGroups.includes(jid)) continue;

                                          if (msg.key.fromMe) continue;

                                          const senderJid = msg.key.participant || '';
                                                          if (!senderJid) continue;

                                          const senderName = msg.pushName || 'Desconocido';
                                                          const content = getTextContent(msg);
                                                          const msgType = getMessageType(msg);

                                          // Guardar en base de datos
                                          const memberId = await upsertMember(senderJid, senderName);
                                                          await updateActivity(senderJid);
                                                          await saveMessage({
                                                                                  memberId,
                                                                                  whatsappMessageId: msg.key.id || '',
                                                                                  content,
                                                                                  messageType: msgType,
                                                                                  sentAt: new Date((msg.messageTimestamp as number) * 1000),
                                                          });

                                          if (!content) continue;

                                          // Comandos: !resumen, !actividad
                                          if (content.startsWith(COMMAND_PREFIX)) {
                                                                  await handleCommand(content, jid);
                                                                  continue;
                                          }

                                          // === GATE ESTRICTO: solo responder con @mention formal de WhatsApp ===

                                          // Obtener número del bot
                                          const rawId = getSocket().user?.id ?? '';
                                                          // rawId puede ser "521234567890:15@s.whatsapp.net" o "521234567890@s.whatsapp.net"
                                          const botNumber = rawId.split('@')[0].split(':')[0];

                                          logger.info(`[MENTION-GATE] rawId=${rawId} botNumber=${botNumber} msgType=${msgType} content="${content}"`);

                                          // Si no tenemos número del bot, no podemos verificar — silencio total
                                          if (!botNumber) {
                                                                  logger.warn('[MENTION-GATE] botNumber vacío — ignorando mensaje');
                                                                  continue;
                                          }

                                          const botJid = `${botNumber}@s.whatsapp.net`;
                                                          const mentionedJids: string[] = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];

                                          logger.info(`[MENTION-GATE] botJid=${botJid} mentionedJids=${JSON.stringify(mentionedJids)}`);

                                          const isMentioned = mentionedJids.includes(botJid);

                                          logger.info(`[MENTION-GATE] isMentioned=${isMentioned} — ${isMentioned ? 'RESPONDIENDO' : 'SILENCIO TOTAL'}`);

                                          // SILENCIO ABSOLUTO si no hay @mention formal
                                          if (!isMentioned) continue;

                                          const cleanMessage = content.replace(/@\S+/g, '').trim();
                                                          await handleMention(senderName, cleanMessage || 'hola', jid);

                                      } catch (error) {
                                                          logger.error('Error processing message:', error);
                                      }
                      }
    });
}

main().catch((err) => {
        logger.error('Fatal error:', err);
        process.exit(1);
});
