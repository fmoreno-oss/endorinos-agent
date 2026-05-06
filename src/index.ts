────────────────────────────────────────────ááú→→→────────────────────────────────────────────────────────────íimport { env } from './config/env.js';
// v3
import { logger } from './lib/logger.js';
import { connectWhatsApp, onMessage, getSocket } from './whatsapp/client.js';
import { upsertMember, updateActivity } from './services/members.js';
import { saveMessage } from './services/messages.js';
import { handleCommand } from './commands/index.js';
import { handleMention } from './services/mention.js';
import { generateGreeting } from './services/claude.js';
import { startCronJobs } from './cron/jobs.js';
import { COMMAND_PREFIX } from './config/constants.js';
import { sendTextMessage } from './whatsapp/sender.js';
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
        logger.info('Starting Endorinos WhatsApp Agent...');

    await connectWhatsApp();
        logger.info('WhatsApp connection established');

    startCronJobs();

    onMessage(async ({ messages, type }) => {
                if (type !== 'notify') return;

                      for (const msg of messages as proto.IWebMessageInfo[]) {
                                      try {
                                                          const jid = msg.key.remoteJid ?? '';

                                          // Only process group messages
                                          if (!jid.endsWith('@g.us')) continue;

                                          // Skip if no group JID
                                          if (!jid) continue;

                                          // Log group discovery
                                          if (!env.WHATSAPP_GROUP_JID) {
                                                                  logger.info(`[JID DISCOVERY] Grupo desconocido detectado: ${jid}`);
                                          }

                                          // Accept messages from endorinos group or warroom group
                                          const allowedGroups = [env.WHATSAPP_GROUP_JID];
                                                          if (env.WHATSAPP_WARROOM_JID) allowedGroups.push(env.WHATSAPP_WARROOM_JID);
                                                          if (!allowedGroups.includes(jid)) continue;

                                          if (msg.key.fromMe) continue;

                                          const senderJid = msg.key.participant || '';
                                                          if (!senderJid) continue;

                                          const senderName = msg.pushName || 'Desconocido';
                                                          const content = getTextContent(msg);
                                                          const type = getMessageType(msg);

                                          // Save to database
                                          const memberId = await upsertMember(senderJid, senderName);
                                                          await updateActivity(senderJid);
                                                          await saveMessage({
                                                                                  memberId,
                                                                                  whatsappMessageId: msg.key.id || '',
                                                                                  content,
                                                                                  messageType: type,
                                                                                  sentAt: new Date((msg.messageTimestamp as number) * 1000),
                                                          });

                                          if (!content) continue;

                                          // Commands: !resumen, !actividad
                                          if (content.startsWith(COMMAND_PREFIX)) {
                                                                  await handleCommand(content, jid);
                                                                  continue;
                                          }

                                          // Respond ONLY when mentioned with @Benito (formal WhatsApp mention)
                                          const botNumber = getSocket().user?.id?.split(':')[0] || '';

                                          // Guard: if botNumber is empty, we can't verify the mention — skip
                                          if (!botNumber) continue;

                                          const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                                                          const botJid = `${botNumber}@s.whatsapp.net`;
                                                          const isMentionedByJid = mentionedJids.includes(botJid);

                                          if (isMentionedByJid) {
                                                                  const cleanMessage = content.replace(/@\S+/g, '').trim();
                                                                  await handleMention(senderName, cleanMessage || 'hola', jid);
                                          }
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
