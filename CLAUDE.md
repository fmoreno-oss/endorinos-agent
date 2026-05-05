# Endorinos WhatsApp Agent

Agente de WhatsApp para el grupo de oficina "Endorinos". Envía saludos motivacionales diarios, recuerda el kickoff semanal, genera resúmenes de chat, analiza actividad del grupo, y reactiva miembros inactivos. Todas las respuestas son por nota de voz.

## Commands

- `npm run dev` — Iniciar en modo desarrollo (tsx watch)
- `npm run build` — Compilar TypeScript
- `npm start` — Iniciar en producción
- `npm run db:generate` — Generar migraciones de Drizzle
- `npm run db:migrate` — Ejecutar migraciones
- `npm run db:push` — Push schema directo a DB (solo dev)

## Tech Stack

Node.js + TypeScript + Baileys (WhatsApp) + Claude API + ElevenLabs + PostgreSQL + Drizzle + node-cron + Railway

## Architecture

### Directory Structure
- `src/whatsapp/` — Conexión Baileys, sesión, envío de mensajes
- `src/services/` — Lógica de negocio: Claude, ElevenLabs, audio, resúmenes, actividad
- `src/commands/` — Handlers de comandos del grupo (!resumen, !actividad)
- `src/cron/` — Definición de tareas programadas
- `src/db/` — Schema Drizzle, migraciones, cliente de base de datos
- `src/config/` — Variables de entorno (Zod) y constantes
- `src/lib/` — Utilidades y logger

### Data Flow
Mensaje WhatsApp → Baileys listener → guardar en PostgreSQL → si es comando → procesar → Claude genera texto → ElevenLabs genera audio → ffmpeg convierte a OGG/Opus → Baileys envía nota de voz

### Key Patterns
- Toda interacción del bot se envía como nota de voz (audio/ogg; codecs=opus)
- La sesión de Baileys se persiste en PostgreSQL, no en disco
- Los cron jobs se configuran con timezone explícita (env var TZ)
- Cada acción del bot se registra en la tabla bot_logs para debugging

## Code Organization Rules

1. **Un servicio por archivo.** Cada integración externa tiene su propio archivo en services/.
2. **No barrel exports.** Importar directamente desde el archivo fuente.
3. **Máximo 200 líneas por archivo.** Si crece más, extraer funcionalidad.
4. **Env vars validadas al arrancar.** Si falta alguna, el proceso falla inmediatamente.
5. **Toda interacción con Claude usa system prompt explícito.**
6. **Los prompts de Claude van en español.** El bot habla español.

## Environment Variables

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `ANTHROPIC_API_KEY` | API key de Claude |
| `ELEVENLABS_API_KEY` | API key de ElevenLabs |
| `ELEVENLABS_VOICE_ID` | ID de voz de ElevenLabs |
| `WHATSAPP_GROUP_JID` | JID del grupo (formato: 123456789@g.us) |
| `TZ` | Timezone (e.g., America/Mexico_City) |
| `NODE_ENV` | development o production |

## Reglas No Negociables

1. **NUNCA enviar mensajes fuera del grupo configurado.** Siempre validar JID antes de enviar.
2. **NUNCA almacenar media (fotos, videos).** Solo guardar texto de mensajes.
3. **SIEMPRE enviar respuestas como nota de voz.** Nunca como texto plano.
4. **SIEMPRE registrar acciones en bot_logs.** Cada saludo, resumen, nudge queda logueado.
5. **NUNCA exponer API keys en logs.**
6. **TypeScript strict mode.** Cero `any` types.
7. **Los cron jobs deben tener try/catch.** Un error en un job no debe crashear el bot.
