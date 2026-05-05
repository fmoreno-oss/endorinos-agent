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
      logger.info('WhatsApp conectado. Escaneando grupos...');

      // Descubrir todos los grupos en los que esta Benito
      try {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.entries(groups);
        logger.info('[JID-DISCOVERY] Total grupos encontrados: ' + groupList.length);
        for (const [jid, meta] of groupList) {
          logger.info('[JID-DISCOVERY] Grupo: "' + meta.subject + '" | JID: ' + jid);
        }
      } catch (err) {
        logger.error('[JID-DISCOVERY] Error al obtener grupos: ' + err);
      }

      // Presentacion en grupo endorinos
      setTimeout(async () => {
        try {
          const introMsg =
            'Hola equipo. Soy Benito, el asistente de \u00c9ndor. ' +
            'Ya estoy conectado y listo para ayudar. ' +
            'Puedo responder menciones, registrar actividad y en breve tendr\u00e9 m\u00e1s automatizaciones disponibles.';
          await sendTextMessage(env.WHATSAPP_GROUP_JID, introMsg);
          logger.info('Presentacion enviada al grupo endorinos');
        } catch (err) {
          logger.error('Error en presentacion endorinos: ' + err);
        }
      }, 5000);

      // Presentacion en warroom (si el JID esta configurado)
      if (env.WHATSAPP_WARROOM_JID) {
        setTimeout(async () => {
          try {
            const warroomMsg =
              'Hola. Soy Benito, el asistente de \u00c9ndor. ' +
              'Ya estoy de vuelta en el grupo. Listo para apoyar.';
            await sendTextMessage(env.WHATSAPP_WARROOM_JID!, warroomMsg);
            logger.info('Presentacion enviada al warroom');
          } catch (err) {
            logger.error('Error en presentacion warroom: ' + err);
          }
        }, 6000);
      }

      startCronJobs(sock);
    }
  });

  onMessage(async (msg) => {
    if (!msg.key.remoteJid) return;

    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    const isFromMe = msg.key.fromMe;

    // Solo procesar mensajes de grupo (no los propios)
    if (!isGroup || isFromMe) return;

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

    if (!text) return;

    // Manejar comandos
    if (text.startsWith(COMMAND_PREFIX)) {
      try {
        await handleCommand(sock, msg, text);
      } catch (err) {
        logger.error('Error handleCommand: ' + err);
      }
      return;
    }

    // Manejar menciones a Benito
    try {
      await handleMention(sock, msg, text);
    } catch (err) {
      logger.error('Error handleMention: ' + err);
    }
  });
}

main().catch((err) => {
  logger.error('Fatal error en main: ' + err);
  process.exit(1);
});
