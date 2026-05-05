import { env } from './config/env.js';
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
  if (m.stickerMessage) return 'sticker';
  return 'other';
}

async function main() {
  logger.info(`Endorinos Agent starting...`);
  logger.info(`Group: ${env.WHATSAPP_GROUP_JID}`);
  if (env.WHATSAPP_WARROOM_JID) {
    logger.info(`Warroom: ${env.WHATSAPP_WARROOM_JID}`);
  }

  await connectWhatsApp();

  // Send intro message to endorinos after connecting
  setTimeout(async () => {
    try {
      await sendTextMessage(
        env.WHATSAPP_GROUP_JID,
        'Qué onda equipo. Soy Benito, su agente de IA. Aquí para apoyarles cuando me necesiten: mencionen mi nombre o escríbanme directamente.'
      );
    } catch (err) {
      logger.error('Failed to send intro message', err);
    }
  }, 5000);

  // One-time NY vibe message
  setTimeout(async () => {
    try {
      await sendTextMessage(
        env.WHATSAPP_GROUP_JID,
        'La ciudad nunca duerme, y nosotros tampoco... pero aquí estamos, pa los que sí duermen en el grupo 🌃'
      );
    } catch (err) {
      logger.error('Failed to send vibe message', err);
    }
  }, 8000);

  // One-time motivational message
  setTimeout(async () => {
    try {
      const motivacion = await generateGreeting();
      await sendTextMessage(env.WHATSAPP_GROUP_JID, motivacion);
    } catch (err) {
      logger.error('Failed to send motivational message', err);
    }
  }, 12000);

  // Send intro message to warroom if configured
  if (env.WHATSAPP_WARROOM_JID) {
    setTimeout(async () => {
      try {
        await sendTextMessage(
          env.WHATSAPP_WARROOM_JID!,
          'Reportándome. Soy Benito, ya estoy aquí en el warroom. Mencíonenme cuando me necesiten.'
        );
      } catch (err) {
        logger.error('Failed to send warroom intro message', err);
      }
    }, 6000);
  }

  onMessage(async ({ messages: msgs }) => {
    for (const raw of msgs) {
      try {
        const msg = raw as proto.IWebMessageInfo;
        if (!msg.key || !msg.message) continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

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

        logger.info(`[${senderName}] (${jid === env.WHATSAPP_WARROOM_JID ? 'warroom' : 'endorinos'}): "${content || `<${type}>`}"`);

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

        // Respond when mentioned (@Benito or "benito" in text)
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botNumber = getSocket().user?.id?.split(':')[0] || '';
        const isMentionedByJid = mentionedJids.length > 0; // Any mention in group = likely the bot
        const isMentionedByName = content.toLowerCase().includes('benito');

        if (isMentionedByJid || isMentionedByName) {
          // Clean: remove @numbers and "benito" to get the actual message
          const cleanMessage = content.replace(/@\S+/g, '').replace(/benito/gi, '').trim();
          logger.info(`Mention detected! Responding to: "${cleanMessage || 'hola'}"`);
          await handleMention(senderName, cleanMessage || 'hola', jid);
        }
      } catch (error) {
        logger.error('Error processing message:', error);
      }
    }
  });

  startCronJobs();
  logger.info('Bot running. Listening for messages...');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
