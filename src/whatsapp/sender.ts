import { getSocket } from './client.js';
import { logger } from '../lib/logger.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 3000): Promise<T> {
    for (let i = 0; i < retries; i++) {
          try {
                  return await fn();
          } catch (error: any) {
                  const isConnClosed = error?.message?.includes('Connection Closed') ||
                            error?.message?.includes('connection') ||
                            error?.message?.includes('Precondition');
                  if (isConnClosed && i < retries - 1) {
                            logger.warn(`Send failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`);
                            await sleep(delay);
                  } else {
                            throw error;
                  }
          }
    }
    throw new Error('Max retries exceeded');
}

export async function sendTextMessage(jid: string, text: string): Promise<void> {
    await withRetry(async () => {
          const socket = getSocket();
          await socket.sendMessage(jid, { text });
          logger.info(`Text message sent to ${jid}`);
    });
}

export async function sendAudioMessage(jid: string, audioBuffer: Buffer): Promise<void> {
    await withRetry(async () => {
          const socket = getSocket();
          await socket.sendMessage(jid, {
                  audio: audioBuffer,
                  mimetype: 'audio/ogg; codecs=opus',
                  ptt: true,
          });
          logger.info(`Voice note sent to ${jid}`);
    });
}

export async function sendMentionMessage(
    jid: string,
    text: string,
    mentions: string[],
  ): Promise<void> {
    await withRetry(async () => {
          const socket = getSocket();
          await socket.sendMessage(jid, { text, mentions });
          logger.info(`Mention message sent to ${jid} (${mentions.length} mentions)`);
    });
}

export async function sendVoiceNote(jid: string, text: string): Promise<void> {
    const { textToSpeech } = await import('../services/elevenlabs.js');
    const { convertToWhatsAppAudio } = await import('../services/audio.js');

  try {
        const mp3Buffer = await textToSpeech(text);
        const oggBuffer = await convertToWhatsAppAudio(mp3Buffer);
        await sendAudioMessage(jid, oggBuffer);
  } catch (error) {
        logger.error('Failed to send voice note, falling back to text', error);
        await sendTextMessage(jid, text);
  }
}
