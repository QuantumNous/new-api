import { z } from 'zod'

export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  order: z.coerce.number<number>(),
  columnId: z.string().uuid(),
  boardId: z.coerce.string<string>(),
})

export const columnSchema = z.object({
  id: z.string().uuid(),
  boardId: z.coerce.string<string>(),
  name: z.string(),
  order: z.number(),
})

export const boardSchema = z.object({
  id: z.coerce.string<string>(),
  name: z.string(),
  color: z.string(),
  columns: z.array(columnSchema),
  items: z.array(itemSchema),
})

export const updateBoardSchema = boardSchema.partial().required({ id: true })

export const updateColumnSchema = columnSchema.partial().required({
  id: true,
  boardId: true,
})

export const deleteItemSchema = itemSchema.pick({ id: true, boardId: true })
export const newColumnSchema = columnSchema.omit({ order: true, id: true })
export const deleteColumnSchema = columnSchema.pick({ boardId: true, id: true })

export type Board = z.infer<typeof boardSchema>
export type Column = z.infer<typeof columnSchema>
export type Item = z.infer<typeof itemSchema>
