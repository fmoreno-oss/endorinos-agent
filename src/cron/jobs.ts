import { schedule, type ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { GREETING_CRON, KICKOFF_REMINDER_CRON, KICKOFF_CRON, NUDGE_CRON, INACTIVE_DAYS_THRESHOLD, ZOOM_KICKOFF_URL } from '../config/constants.js';
import { generateGreeting, generateKickoffReminder, generateNudge, generateWarroomArticleMessage } from '../services/claude.js';
import { getInactiveMembers } from '../services/members.js';
import { sendTextMessage, sendMentionMessage } from '../whatsapp/sender.js';
import { logBotAction } from '../services/botlog.js';
import { logger } from '../lib/logger.js';

const tasks: ScheduledTask[] = [];

export function startCronJobs(): void {
    const tz = env.TZ;
    const groupJid = env.WHATSAPP_GROUP_JID;
    const warroomJid = env.WHATSAPP_WARROOM_JID;

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
                          logger.error('Daily greeting job failed:', error);
                          await logBotAction('greeting', { error: String(error) }, false, String(error));
                }
        }, { timezone: tz }),
      );

  // Kickoff pre-reminder at 8:45am on Mondays
  tasks.push(
        schedule(KICKOFF_REMINDER_CRON, async () => {
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

  // Kickoff message at 9:15am on Mondays
  tasks.push(
        schedule(KICKOFF_CRON, async () => {
                try {
                          logger.info('Running kickoff job...');
                          await sendTextMessage(groupJid, `Kickoff en curso. Únete aquí: ${ZOOM_KICKOFF_URL}`);
                          await logBotAction('kickoff', { url: ZOOM_KICKOFF_URL }, true);
                          logger.info('Kickoff message sent successfully');
                } catch (error) {
                          logger.error('Kickoff job failed:', error);
                          await logBotAction('kickoff', { error: String(error) }, false, String(error));
                }
        }, { timezone: tz }),
      );

  // Nudge inactive members daily at 10:00am
  tasks.push(
        schedule(NUDGE_CRON, async () => {
                try {
                          logger.info('Running nudge job...');
                          const inactive = await getInactiveMembers(INACTIVE_DAYS_THRESHOLD);
                          if (inactive.length > 0) {
                                      const names = inactive.map((m) => m.pushName ?? m.jid);
                                      const jids = inactive.map((m) => m.jid);
                                      const nudgeText = await generateNudge(names);

                            // Send as text with mentions so inactive members get notified
                            await sendMentionMessage(groupJid, nudgeText, jids);
                                      await logBotAction('nudge', { inactive: names }, true);
                                      logger.info(`Nudge sent to ${inactive.length} inactive members`);
                          }
                } catch (error) {
                          logger.error('Nudge job failed:', error);
                          await logBotAction('nudge', { error: String(error) }, false, String(error));
                }
        }, { timezone: tz }),
      );

  // Share article in War Room group (one-time on startup)
  if (warroomJid) {
        void (async () => {
                try {
                          logger.info('Sharing article in War Room group...');
                          const articleUrl = 'https://www.grupoendor.com/la-ia-no-puede-ser-creativa-lo-que-los-escepticos-no-quieren-ver/';
                          const articleTitle = '¿La IA no puede ser creativa? Lo que los escépticos no quieren ver.';
                          const message = await generateWarroomArticleMessage(articleUrl, articleTitle);
                          await sendTextMessage(warroomJid, message);
                          await logBotAction('warroom_article', { url: articleUrl, title: articleTitle }, true);
                          logger.info('Article shared in War Room successfully');
                } catch (error) {
                          logger.error('War Room article share failed:', error);
                          await logBotAction('warroom_article', { error: String(error) }, false, String(error));
                }
        })();
  } else {
        logger.warn('WHATSAPP_WARROOM_JID not set, skipping War Room article share');
  }

  logger.info(`Cron jobs started (timezone: ${tz})`);
    logger.info(`  Greeting:         ${GREETING_CRON}`);
    logger.info(`  Kickoff reminder: ${KICKOFF_REMINDER_CRON}`);
    logger.info(`  Kickoff:          ${KICKOFF_CRON}`);
    logger.info(`  Nudge:            ${NUDGE_CRON}`);
}

export function stopCronJobs(): void {
    tasks.forEach((task) => task.stop());
    tasks.length = 0;
    logger.info('Cron jobs stopped');
}
