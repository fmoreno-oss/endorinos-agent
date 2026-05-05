import { makeWASocket, fetchLatestWaWebVersion, DisconnectReason } from 'baileys';
import type { WASocket } from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { usePostgreSQLAuthState } from './session.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

let socket: WASocket | null = null;
let messageHandler: ((msg: { messages: unknown[]; type: string }) => void) | null = null;

export function getSocket(): WASocket {
  if (!socket) throw new Error('WhatsApp socket not initialized');
  return socket;
}

export function onMessage(handler: (msg: { messages: unknown[]; type: string }) => void) {
  messageHandler = handler;
}

export async function connectWhatsApp(): Promise<WASocket> {
  const { version } = await fetchLatestWaWebVersion(undefined);
  logger.info(`Using WhatsApp Web version: ${version.join('.')}`);

  const { state, saveCreds } = await usePostgreSQLAuthState();

  socket = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' }) as unknown as Parameters<typeof makeWASocket>[0]['logger'],
    browser: ['Endorinos Agent', 'Chrome', '1.0.0'],
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('========================================');
      logger.info('  SCAN THIS QR CODE WITH WHATSAPP');
      logger.info('========================================');
      qrcode.generate(qr, { small: true });

      // Also save as PNG image for easy scanning
      const qrPath = new URL('../../qr-code.png', import.meta.url).pathname;
      QRCode.toFile(qrPath, qr, { width: 400 }).then(() => {
        logger.info(`QR code saved as image: ${qrPath}`);
        logger.info('Open it with: open qr-code.png');
      }).catch(() => {});
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      logger.warn(`Connection closed. Reason: ${reason}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(), 5000);
      } else {
        logger.error('Logged out. Delete auth_info/ folder and restart to re-authenticate.');
      }
    }

    if (connection === 'open') {
      logger.info('Connected to WhatsApp successfully!');
    }
  });

  socket.ev.on('messages.upsert', (msg) => {
    if (messageHandler) {
      messageHandler(msg as { messages: unknown[]; type: string });
    }
  });

  return socket;
}
