import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { CLAUDE_FAST } from '../config/constants.js';
import { logger } from '../lib/logger.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function generateReply(senderName: string, message: string): Promise<string> {
    logger.info(`Generating reply for ${senderName}: "${message}"`);

  const response = await client.messages.create({
        model: CLAUDE_FAST,
        max_tokens: 256,
        system: `Eres Benito, el asistente virtual del equipo Endorinos (grupoendor.com). Habla en español mexicano, con tono coloquial, cálido y natural — como un compañero de equipo, no un bot corporativo. Eres amigable, casual, con sentido del humor. Respondes corto y directo (máximo 2-3 oraciones). NUNCA uses "che". NUNCA uses "hey" seguido de un nombre (jamás digas "hey ${senderName}" ni "hey [nombre]"). NUNCA uses "compa". Varía tus saludos. Si no sabes algo, dilo con naturalidad. No uses emojis en exceso.`,
        messages: [{ role: 'user', content: `${senderName} te dice: "${message}"` }],
  });

  const block = response.content[0];
    if (block.type === 'text') return block.text;
    throw new Error('Unexpected response type from Claude');
}
