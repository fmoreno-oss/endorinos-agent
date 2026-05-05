import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { CLAUDE_FAST, CLAUDE_SMART } from '../config/constants.js';
import { logger } from '../lib/logger.js';
import type { MemberStats } from '../types/index.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const BENITO_BASE = `Eres Benito, el asistente virtual del equipo Endorinos (grupoendor.com). Habla en español mexicano, con tono coloquial, cálido y natural — como un compañero de equipo, no un bot corporativo. USA expresiones como "va", "sale", "órale", "ahorita", "con gusto", "claro". NUNCA uses "che", NUNCA uses "hey" seguido de un nombre (por ejemplo NUNCA digas "hey Frank" ni "hey [nombre]"), NUNCA uses "compa". Varía tus saludos y no los repitas. Sé conciso — mensajes cortos para WhatsApp.`;

async function ask(model: string, system: string, userMessage: string): Promise<string> {
    const response = await client.messages.create({
          model,
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: userMessage }],
    });

  const block = response.content[0];
    if (block.type === 'text') return block.text;
    throw new Error('Unexpected response type from Claude');
}

export async function generateGreeting(): Promise<string> {
    logger.info('Generating daily greeting...');
    return ask(
          CLAUDE_FAST,
          `${BENITO_BASE} Genera una frase motivacional corta y energética para empezar el día. Máximo 2 oraciones. Varía el estilo: a veces inspiradora, a veces graciosa, a veces reflexiva. Incluye el saludo "Buenos días, Endorinos!"`,
          'Genera el saludo motivacional de hoy.',
        );
}

export async function generateSummary(conversation: string): Promise<string> {
    logger.info('Generating conversation summary...');
    return ask(
          CLAUDE_SMART,
          `${BENITO_BASE} Resume la siguiente conversación de WhatsApp de forma concisa y útil. Menciona los temas principales, decisiones tomadas y pendientes. Máximo 5 bullets.`,
          `Resume esta conversación:\n\n${conversation}`,
        );
}

export async function generateActivityReport(stats: MemberStats[]): Promise<string> {
    logger.info('Generating activity report...');
    const data = stats
      .map(
              (s) =>
                        `${s.displayName}: ${s.messageCount} mensajes, último mensaje hace ${s.daysSinceLastMessage ?? '?'} días`,
            )
      .join('\n');

  return ask(
        CLAUDE_FAST,
        `${BENITO_BASE} Analiza la actividad del grupo con los datos proporcionados. Reporta: quién más participa, quién menos, tendencias. Sé amigable, no pongas en evidencia a nadie negativamente.`,
        `Datos de actividad del grupo:\n\n${data}`,
      );
}

export async function generateNudge(inactiveNames: string[]): Promise<string> {
    logger.info(`Generating nudge for ${inactiveNames.length} inactive members...`);
    return ask(
          CLAUDE_FAST,
          `${BENITO_BASE} Genera un mensaje corto y amigable para el grupo mencionando a los miembros inactivos. No seas agresivo ni culpes a nadie. Simplemente recuérdales que los extrañamos en el chat. Máximo 2 oraciones.`,
          `Miembros inactivos: ${inactiveNames.join(', ')}`,
        );
}

export async function generateKickoffReminder(): Promise<string> {
    logger.info('Generating kickoff reminder...');
    return ask(
          CLAUDE_FAST,
          `${BENITO_BASE} Genera un recordatorio corto y energético para la reunión de kickoff semanal que empieza en unos minutos. Recuerda: es el kickoff de los Endorinos.`,
          'Genera el recordatorio del kickoff semanal.',
        );
}
