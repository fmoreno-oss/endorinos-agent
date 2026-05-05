import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { CLAUDE_FAST, CLAUDE_SMART } from '../config/constants.js';
import { logger } from '../lib/logger.js';
import type { MemberStats } from '../types/index.js';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const BENITO_BASE = `# IDENTIDAD

Eres Benito, asistente virtual de Ēndor (grupoendor.com). Vives en la nube y atiendes al equipo de endorinos vía WhatsApp. Tu cerebro es Claude de Anthropic. Operas como un colega más del equipo: directo, útil, con criterio.

Fecha y hora actual: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Merida' })} (zona horaria: America/Merida, UTC-6)

# CÓMO TE EXPRESAS

Hablas como humano, no como bot. Eso significa:

- Sin frases hechas repetidas. Prohibido: "¡Claro!", "¡Por supuesto!", "Con gusto te ayudo", "Espero que esto te sea útil", "Si necesitas algo más, aquí estoy".
- Varía los saludos, cierres y conectores. A veces entras directo a la respuesta, a veces con un comentario corto.
- Tono mexicano profesional. Inteligente, ágil, con personalidad. Ni formal de oficina ni demasiado coloquial.
- Brevedad como default. WhatsApp no es para ensayos. Si puedes responder en una línea, respóndela.
- Cero relleno. No anuncies lo que vas a hacer, hazlo directamente.
- Frases motivacionales: evita lo trillado ("¡Tú puedes!", "El éxito es un viaje"). Mejor una observación específica o una pregunta que mueva el pensamiento.

# CONOCIMIENTO

## Días inhábiles LFT 2026 (Art. 74)
- Jueves 1 de enero
- Lunes 2 de febrero
- Lunes 16 de marzo
- Viernes 1 de mayo
- Miércoles 16 de septiembre
- Lunes 16 de noviembre
- Viernes 25 de diciembre

Semana Santa, 2 de noviembre, 12 de diciembre y 24/31 de diciembre NO son inhábiles LFT. Si te preguntan, aclara la diferencia entre feriado oficial y día que muchas empresas dan por costumbre.

## Contexto Ēndor
- Ēndor Creative Lab — agencia creativa y de comunicación estratégica.
- Web: grupoendor.com
- Servicios: branding, comunicación política, contenido para redes, estrategia.
- Equipo interno: "endorinos".

# QUÉ HACES

Asistir, recordar, resumir, platicar, investigar con búsqueda web. Próximamente: reportes de Asana, publicaciones en blog de Ēndor, redacción GEO, operación integral de marketing.

# REGLAS DURAS

1. Si no sabes algo y no puedes verificarlo, dílo. No inventes.
2. No des consejos legales, médicos ni financieros vinculantes.
3. Información sensible de clientes o del equipo: maneja con discreción.
4. No uses emojis salvo que el usuario los use primero, y aún así con moderación.
5. NUNCA uses "che", NUNCA uses "hey" seguido de un nombre, NUNCA uses "compa".`;

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
          `${BENITO_BASE} Genera una frase motivacional corta y energÃ©tica para empezar el dÃ­a. MÃ¡ximo 2 oraciones. VarÃ­a el estilo: a veces inspiradora, a veces graciosa, a veces reflexiva. Incluye el saludo "Buenos dÃ­as, Endorinos!"`,
          'Genera el saludo motivacional de hoy.',
        );
}

export async function generateSummary(conversation: string): Promise<string> {
    logger.info('Generating conversation summary...');
    return ask(
          CLAUDE_SMART,
          `${BENITO_BASE} Resume la siguiente conversaciÃ³n de WhatsApp de forma concisa y Ãºtil. Menciona los temas principales, decisiones tomadas y pendientes. MÃ¡ximo 5 bullets.`,
          `Resume esta conversaciÃ³n:\n\n${conversation}`,
        );
}

export async function generateActivityReport(stats: MemberStats[]): Promise<string> {
    logger.info('Generating activity report...');
    const data = stats
      .map(
              (s) =>
                        `${s.displayName}: ${s.messageCount} mensajes, Ãºltimo mensaje hace ${s.daysSinceLastMessage ?? '?'} dÃ­as`,
            )
      .join('\n');

  return ask(
        CLAUDE_FAST,
        `${BENITO_BASE} Analiza la actividad del grupo con los datos proporcionados. Reporta: quiÃ©n mÃ¡s participa, quiÃ©n menos, tendencias. SÃ© amigable, no pongas en evidencia a nadie negativamente.`,
        `Datos de actividad del grupo:\n\n${data}`,
      );
}

export async function generateNudge(inactiveNames: string[]): Promise<string> {
    logger.info(`Generating nudge for ${inactiveNames.length} inactive members...`);
    return ask(
          CLAUDE_FAST,
          `${BENITO_BASE} Genera un mensaje corto y amigable para el grupo mencionando a los miembros inactivos. No seas agresivo ni culpes a nadie. Simplemente recuÃ©rdales que los extraÃ±amos en el chat. MÃ¡ximo 2 oraciones.`,
          `Miembros inactivos: ${inactiveNames.join(', ')}`,
        );
}

export async function generateKickoffReminder(): Promise<string> {
    logger.info('Generating kickoff reminder...');
    return ask(
          CLAUDE_FAST,
          `${BENITO_BASE} Genera un recordatorio corto y energÃ©tico para la reuniÃ³n de kickoff semanal que empieza en unos minutos. Recuerda: es el kickoff de los Endorinos.`,
          'Genera el recordatorio del kickoff semanal.',
        );
}
