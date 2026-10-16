import { z } from 'zod'

// Zod is necessary for client side parsing.

export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  order: z.coerce.number<number>(),
  columnId: z.string().uuid(),
  boardId: z.coerce.string<string>(),
})

export const deleteItemSchema = itemSchema.pick({ id: true, boardId: true })
