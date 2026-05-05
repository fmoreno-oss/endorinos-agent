import { env } from './config/env.js';
// v2
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
  if (m.conversation || m.extendedTextMessage) return 'text';
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return 'audio';
  if (m.documentMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  return 'other';
}

async function main() {
  const sock = await connectWhatsApp();

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update;

    if (connection === 'open') {
      logger.info('WhatsApp conectado. Listando grupos...');

      // Descubrir JID de todos los grupos donde esta Benito
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groups = await (sock as any).groupFetchAllParticipating();
        const groupList = Object.entries(groups);
        logger.info('[JID-DISCOVERY] Total grupos: ' + groupList.length);
        for (const [gJid, meta] of groupList) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subject = (meta as any).subject || 'sin-nombre';
          logger.info('[JID-DISCOVERY] Grupo: ' + JSON.stringify(subject) + ' | JID: ' + gJid);
        }
      } catch (err) {
        logger.error('[JID-DISCOVERY] Error: ' + err);
      }

      // Presentacion en grupo endorinos
      setTimeout(async () => {
        try {
          await sendTextMessage(
            env.WHATSAPP_GROUP_JID,
            'Hola equipo. Soy Benito, el asistente de \u00c9ndor. Ya estoy conectado y listo para ayudar.',
          );
          logger.info('Presentacion enviada al grupo endorinos');
        } catch (err) {
          logger.error('Error presentacion endorinos: ' + err);
        }
      }, 5000);

      // Presentacion en warroom (si el JID esta configurado)
      if (env.WHATSAPP_WARROOM_JID) {
        setTimeout(async () => {
          try {
            await sendTextMessage(
              env.WHATSAPP_WARROOM_JID!,
              'Soy Benito, el asistente de \u00c9ndor. Puedo resumir la conversaci\u00f3n del grupo, dar avisos al equipo o resolver dudas espec\u00edficas. Esc\u00edbeme directamente.',
            );
            logger.info('Presentacion enviada al warroom');
          } catch (err) {
            logger.error('Error presentacion warroom: ' + err);
          }
        }, 6000);
      }

      startCronJobs();
    }
  });

  onMessage(async ({ messages: msgs }) => {
    for (const raw of msgs) {
      try {
        const msg = raw as proto.IWebMessageInfo;
        if (!msg.key || !msg.message) continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

        // LOG ALL INCOMING JIDS para detectar warroom JID
        if (jid.endsWith('@g.us') && jid !== env.WHATSAPP_GROUP_JID) {
          logger.info('[JID-DISCOVERY] Grupo desconocido detectado: ' + jid);
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
          content: content || '',
          messageType: type,
          sentAt: new Date((msg.messageTimestamp as number) * 1000),
        });

        if (!content) continue;

        // Commands: !resumen, !actividad
        if (content.startsWith(COMMAND_PREFIX)) {
          await handleCommand(content, jid);
          continue;
        }

        // Respond when mentioned (@Benito or 'benito' in text)
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botNumber = getSocket().user?.id?.split(':')[0] || '';
        const isMentionedByJid = mentionedJids.length > 0;
        const isMentionedByName = content.toLowerCase().includes('benito');

        if (isMentionedByJid || isMentionedByName) {
          const cleanMessage = content.replace(/@\S+/g, '').replace(/benito/gi, '').trim();
          await handleMention(senderName, cleanMessage || 'hola', jid);
        }
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    }
  });
}

main().catch((err) => {
  logger.error('Fatal error en main: ' + err);
  process.exit(1);
});
