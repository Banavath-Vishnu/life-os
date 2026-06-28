import { z } from 'zod';

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Task title is required' })
    .max(120, { message: 'Title must be 120 characters or less' }),
  description: z
    .string()
    .trim()
    .max(1000, { message: 'Description must be 1000 characters or less' })
    .optional()
    .or(z.literal('')),
  priority: z
    .enum(['low', 'medium', 'high'], {
      errorMap: () => ({ message: 'Priority must be low, medium, or high' }),
    })
    .default('medium'),
  dueDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Must be a valid date string',
    })
    .optional()
    .or(z.literal('')),
  startTime: z
    .string()
    .optional()
    .or(z.literal('')),
  endTime: z
    .string()
    .optional()
    .or(z.literal('')),
});
