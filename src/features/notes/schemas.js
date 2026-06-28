import { z } from 'zod';

export const noteFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Title is required' })
    .max(80, { message: 'Title must be 80 characters or less' }),
  content: z
    .string()
    .trim()
    .max(5000, { message: 'Content must be 5000 characters or less' })
    .optional()
    .or(z.literal('')),
  category: z
    .string()
    .trim()
    .min(1, { message: 'Category is required' })
    .default('General'),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, { message: 'Must be a valid hex color code' })
    .optional()
    .or(z.literal('')),
});
