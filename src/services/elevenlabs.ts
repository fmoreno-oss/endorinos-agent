import { env } from '../config/env.js';
import { ELEVENLABS_MODEL } from '../config/constants.js';
import { logger } from '../lib/logger.js';

export async function textToSpeech(text: string): Promise<Buffer> {
  // Placeholder — will be fully implemented in Step 7
  logger.info('Converting text to speech...');

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  logger.info(`Audio generated: ${arrayBuffer.byteLength} bytes`);
  return Buffer.from(arrayBuffer);
}
