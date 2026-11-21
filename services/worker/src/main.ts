import { EmailJob, LOG_REDACT_PATHS, parseEnv, QUEUES, WorkerEnv } from '@ai-insure/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createTransport } from 'nodemailer';
import { pino } from 'pino';

const env = parseEnv(WorkerEnv);
const log = pino({
  level: env.LOG_LEVEL,
  redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
});

const mailer = createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
});

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const emailWorker = new Worker<EmailJob>(
  QUEUES.email,
  async (job) => {
    const mail = EmailJob.parse(job.data);
    await mailer.sendMail({ from: env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    // Never log the recipient or body: they are personal data.
    log.info({ jobId: job.id, template: mail.template }, 'email sent');
  },
  { connection, concurrency: 5 },
);

emailWorker.on('failed', (job, err) => {
  log.warn({ jobId: job?.id, template: job?.data.template, attempts: job?.attemptsMade, err: err.message }, 'email failed');
});
emailWorker.on('error', (err) => log.error({ err: err.message }, 'worker error'));

log.info({ queues: [QUEUES.email] }, 'worker started');

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'shutting down');
  // Lets in-flight jobs finish; unfinished ones return to the queue.
  await emailWorker.close();
  await connection.quit();
  mailer.close();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
