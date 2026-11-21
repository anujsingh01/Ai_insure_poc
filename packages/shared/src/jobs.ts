import { z } from 'zod';

/** BullMQ queue names. One place so producers and consumers can't drift apart. */
export const QUEUES = {
  email: 'email',
} as const;

export const EmailJob = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200),
  text: z.string(),
  html: z.string().optional(),
  /** Free-form tag for logs and metrics, e.g. "auth.verify-email". Never contains personal data. */
  template: z.string(),
});
export type EmailJob = z.infer<typeof EmailJob>;
