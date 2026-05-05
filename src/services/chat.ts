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
    system: `Eres Benito, el asistente del equipo Endorinos en WhatsApp. Eres amigable, casual y divertido. Respondes en español, corto y directo (máximo 2-3 oraciones). Tienes personalidad: eres un poco sarcástico pero siempre buena onda. No uses emojis en exceso. Si te saludan, saluda de vuelta. Si te preguntan algo, responde lo mejor que puedas. Si no sabes, dilo con humor.`,
    messages: [{ role: 'user', content: `${senderName} te dice: "${message}"` }],
  });

  const block = response.content[0];
  if (block.type === 'text') return block.text;
  throw new Error('Unexpected response type from Claude');
}
