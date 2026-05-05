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

function getTextContentFull(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    'unknown'
  );
}

async function main() {
  const sock = await connectWhatsApp();

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update;

    if (connection === 'open') {
      logger.info('WhatsApp conectado. Listando grupos...');

      // Descubrir JID de todos los grupos donde esta Benito
      try {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.entries(groups);
        logger.info('[JID-DISCOVERY] Total grupos: ' + groupList.length);
        for (const [jid, meta] of groupList) {
          logger.info('[JID-DISCOVERY] Grupo: ' + JSON.stringify(meta.subject) + ' | JID: ' + jid);
        }
      } catch (err) {
        logger.error('[JID-DISCOVERY] Error: ' + err);
      }

      // Presentacion en grupo endorinos
      setTimeout(async () => {
        try {
          await sendTextMessage(
            env.WHATSAPP_GROUP_JID,
            'Hola equipo. Soy Benito, el asistente de \u00c9ndor. ' +
            'Ya estoy conectado y listo para ayudar.',
          );
          logger.info('Presentacion enviada al grupo endorinos');
        } catch (err) {
          logger.error('Error presentacion endorinos: ' + err);
        }
      }, 5000);

      // Presentacion en warroom
      if (env.WHATSAPP_WARROOM_JID) {
        setTimeout(async () => {
          try {
            await sendTextMessage(
              env.WHATSAPP_WARROOM_JID!,
              'Hola. Soy Benito, el asistente de \u00c9ndor. De vuelta en el grupo. Listo para apoyar.',
            );
            logger.info('Presentacion enviada al warroom');
          } catch (err) {
            logger.error('Error presentacion warroom: ' + err);
          }
        }, 6000);
      }

      startCronJobs(sock);
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

        const isFromMe = msg.key.fromMe;
        if (isFromMe) continue;

        const sender = msg.key.participant || '';
        const text = getTextContent(msg);
        const fullText = getTextContentFull(msg);

        // Guardar miembro y actividad
        try {
          await upsertMember(sender, jid);
          await updateActivity(sender);
        } catch (err) {
          logger.error('Error upsertMember/updateActivity: ' + err);
        }

        // Guardar mensaje
        try {
          await saveMessage(sender, fullText);
        } catch (err) {
          logger.error('Error saveMessage: ' + err);
        }

        if (!text) continue;

        // Manejar comandos
        if (text.startsWith(COMMAND_PREFIX)) {
          try {
            await handleCommand(sock, msg, text);
          } catch (err) {
            logger.error('Error handleCommand: ' + err);
          }
          continue;
        }

        // Manejar menciones a Benito
        try {
          await handleMention(sock, msg, text);
        } catch (err) {
          logger.error('Error handleMention: ' + err);
        }
      } catch (err) {
        logger.error('Error procesando mensaje: ' + err);
      }
    }
  });
}

main().catch((err) => {
  logger.error('Fatal error en main: ' + err);
  process.exit(1);
});
