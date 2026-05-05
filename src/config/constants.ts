// Cron schedules
export const GREETING_CRON = '0 9 * * *'; // Todos los días a las 9:00am
export const KICKOFF_REMINDER_CRON = '45 8 * * 1'; // Lunes a las 8:45am - recordatorio previo al kickoff
export const KICKOFF_CRON = '15 9 * * 1'; // Lunes a las 9:15am
export const NUDGE_CRON = '0 10 * * *'; // Todos los días a las 10:00am

// Activity thresholds
export const INACTIVE_DAYS_THRESHOLD = 30;

// Command config
export const COMMAND_PREFIX = '!';

// Claude models
export const CLAUDE_FAST = 'claude-haiku-4-5-20251001';
export const CLAUDE_SMART = 'claude-sonnet-4-6';

// ElevenLabs
export const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

// Links fijos
export const ZOOM_KICKOFF_URL = 'https://us06web.zoom.us/j/85845574082?pwd=cmQva2JKUUhpTnVHSUkremJ3SkQ3Zz09';
