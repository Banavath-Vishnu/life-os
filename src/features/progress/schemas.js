import { z } from 'zod';

export const progressLogSchema = z.object({
  metricName: z
    .string()
    .trim()
    .min(1, { message: 'Metric name is required' })
    .max(50, { message: 'Metric name must be 50 characters or less' }),
  value: z
    .preprocess(
      (val) => (val === '' ? undefined : Number(val)),
      z.number({ invalid_type_error: 'Value must be a number' })
    ),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes must be 500 characters or less' })
    .optional()
    .or(z.literal('')),
});
