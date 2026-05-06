import { env } from './config/env.js';
// v6 - LOG RAW completo para diagnosticar
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
        logger.info('[v6] Starting Endorinos WhatsApp Agent...');

    await connectWhatsApp();
        logger.info('[v6] WhatsApp connection established');

    startCronJobs();

    onMessage(async ({ messages, type }) => {
                if (type !== 'notify') return;

                      for (const msg of messages as proto.IWebMessageInfo[]) {
                                      try {
                                                          const jid = msg.key.remoteJid ?? '';
                                                          const content = getTextContent(msg);
                                                          const msgType = getMessageType(msg);

                                          // LOG COMPLETO para cada mensaje recibido
                                          const rawId = getSocket().user?.id ?? '';
                                                          const botNumber = rawId.split('@')[0].split(':')[0];
                                                          const mentionedJids: string[] = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
                                                          const botJid = botNumber ? `${botNumber}@s.whatsapp.net` : '';

                                          logger.warn(`[MSG-RAW] jid=${jid} type=${msgType} content="${content}" fromMe=${msg.key.fromMe}`);
                                                          logger.warn(`[MSG-RAW] rawId=${rawId} botNumber=${botNumber} botJid=${botJid}`);
                                                          logger.warn(`[MSG-RAW] mentionedJids=${JSON.stringify(mentionedJids)}`);

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

                                          // === GATE ESTRICTO ===
                                          // SOLO responder si hay @mention formal en mentionedJids
                                          // Si botNumber vacío o botJid no en mentionedJids -> SILENCIO TOTAL

                                          if (!botNumber) {
                                                                  logger.warn('[GATE] botNumber vacío — SILENCIO');
                                                                  continue;
                                          }

                                          const isMentioned = mentionedJids.includes(botJid);
                                                          logger.warn(`[GATE] isMentioned=${isMentioned} botJid=${botJid} — ${isMentioned ? 'RESPONDER' : 'SILENCIO'}`);

                                          if (!isMentioned) continue;

                                          const cleanMessage = content.replace(/@\S+/g, '').trim();
                                                          await handleMention(senderName, cleanMessage || 'hola', jid);

                                      } catch (error) {
                                                          logger.error('[ERROR] Error processing message:', error);
                                      }
                      }
    });
}

main().catch((err) => {
        logger.error('Fatal error:', err);
        process.exit(1);
});
