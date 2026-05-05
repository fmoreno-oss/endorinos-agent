import { getSocket } from './client.js';
import { logger } from '../lib/logger.js';

export async function sendTextMessage(jid: string, text: string): Promise<void> {
  const socket = getSocket();
  await socket.sendMessage(jid, { text });
  logger.info(`Text message sent to ${jid}`);
}

export async function sendAudioMessage(jid: string, audioBuffer: Buffer): Promise<void> {
  const socket = getSocket();
  await socket.sendMessage(jid, {
    audio: audioBuffer,
    mimetype: 'audio/ogg; codecs=opus',
    ptt: true,
  });
  logger.info(`Voice note sent to ${jid}`);
}

export async function sendMentionMessage(
  jid: string,
  text: string,
  mentions: string[],
): Promise<void> {
  const socket = getSocket();
  await socket.sendMessage(jid, { text, mentions });
  logger.info(`Mention message sent to ${jid} (${mentions.length} mentions)`);
}

export async function sendVoiceNote(jid: string, text: string): Promise<void> {
  // This will be completed in Step 7 when ElevenLabs + audio conversion are implemented
  // For now, fall back to text
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
