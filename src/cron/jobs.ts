import { schedule, type ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { GREETING_CRON, KICKOFF_CRON, NUDGE_CRON, INACTIVE_DAYS_THRESHOLD } from '../config/constants.js';
import { generateGreeting, generateKickoffReminder, generateNudge } from '../services/claude.js';
import { getInactiveMembers } from '../services/members.js';
import { sendTextMessage, sendMentionMessage } from '../whatsapp/sender.js';
import { logBotAction } from '../services/botlog.js';
import { logger } from '../lib/logger.js';

const tasks: ScheduledTask[] = [];

export function startCronJobs(): void {
  const tz = env.TZ;
  const groupJid = env.WHATSAPP_GROUP_JID;

  // Daily greeting at 9:00am
  tasks.push(
    schedule(GREETING_CRON, async () => {
      try {
        logger.info('Running daily greeting job...');
        const greeting = await generateGreeting();
        await sendTextMessage(groupJid, greeting);
        await logBotAction('greeting', { text: greeting }, true);
        logger.info('Daily greeting sent successfully');
      } catch (error) {
        logger.error('Daily greeting failed:', error);
        await logBotAction('greeting', { error: String(error) }, false, String(error));
      }
    }, { timezone: tz }),
  );

  // Kickoff reminder on Mondays at 9:15am
  tasks.push(
    schedule(KICKOFF_CRON, async () => {
      try {
        logger.info('Running kickoff reminder job...');
        const reminder = await generateKickoffReminder();
        await sendTextMessage(groupJid, reminder);
        await logBotAction('reminder', { text: reminder }, true);
        logger.info('Kickoff reminder sent successfully');
      } catch (error) {
        logger.error('Kickoff reminder failed:', error);
        await logBotAction('reminder', { error: String(error) }, false, String(error));
      }
    }, { timezone: tz }),
  );

  // Nudge inactive members daily at 10:00am
  tasks.push(
    schedule(NUDGE_CRON, async () => {
      try {
        logger.info('Running inactive members check...');
        const inactive = await getInactiveMembers(INACTIVE_DAYS_THRESHOLD);

        if (inactive.length === 0) {
          logger.info('No inactive members found. Skipping nudge.');
          return;
        }

        const names = inactive.map((m) => m.displayName || m.phoneNumber || 'Desconocido');
        const jids = inactive.map((m) => m.whatsappJid);

        const nudgeText = await generateNudge(names);

        // Send as text with mentions so inactive members get notified
        await sendMentionMessage(groupJid, nudgeText, jids);
        await logBotAction('nudge', { inactive: names }, true);
        logger.info(`Nudge sent to ${inactive.length} inactive members`);
      } catch (error) {
        logger.error('Nudge job failed:', error);
        await logBotAction('nudge', { error: String(error) }, false, String(error));
      }
    }, { timezone: tz }),
  );

  logger.info(`Cron jobs started (timezone: ${tz})`);
  logger.info(`  Greeting: ${GREETING_CRON}`);
  logger.info(`  Kickoff:  ${KICKOFF_CRON}`);
  logger.info(`  Nudge:    ${NUDGE_CRON}`);
}

export function stopCronJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  logger.info('All cron jobs stopped');
}
