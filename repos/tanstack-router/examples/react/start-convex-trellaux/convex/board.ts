import { invariant } from './invariant'
import { v } from 'convex/values'
import {
  type QueryCtx,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import schema, {
  deleteColumnSchema,
  deleteItemSchema,
  newColumnsSchema,
  updateBoardSchema,
  updateColumnSchema,
} from './schema'
import type { Doc, Id } from './_generated/dataModel'

export const seed = internalMutation(async (ctx) => {
  const allBoards = await ctx.db.query('boards').collect()
  if (allBoards.length > 0) {
    return
  }
  await ctx.db.insert('boards', {
    id: '1',
    name: 'First board',
    color: '#e0e0e0',
  })
})

// Clear all boards (do this on a regular cadence for public examples)
export const clear = internalMutation(async (ctx) => {
  const allBoards = await ctx.db.query('boards').collect()
  for (const board of allBoards) {
    await ctx.db.delete(board._id)
  }
  await ctx.db.insert('boards', {
    id: '1',
    name: 'First board',
    color: '#e0e0e0',
  })
})

function withoutSystemFields<T extends { _creationTime: number; _id: Id<any> }>(
  doc: T,
) {
  const { _id, _creationTime, ...rest } = doc
  return rest
}

async function getFullBoard(ctx: QueryCtx, id: string) {
  const board = withoutSystemFields(await ensureBoardExists(ctx, id))

  const [columns, items] = await Promise.all([
    ctx.db
      .query('columns')
      .withIndex('board', (q) => q.eq('boardId', board.id))
      .collect(),
    ctx.db
      .query('items')
      .withIndex('board', (q) => q.eq('boardId', board.id))
      .collect(),
  ])

  return {
    ...board,
    columns: columns.map(withoutSystemFields),
    items: items.map(withoutSystemFields),
  }
}

export const getBoards = query(async (ctx) => {
  const boards = await ctx.db.query('boards').collect()
  return await Promise.all(boards.map((b) => getFullBoard(ctx, b.id)))
})

export const getBoard = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    return await getFullBoard(ctx, id)
  },
})

async function ensureBoardExists(
  ctx: QueryCtx,
  boardId: string,
): Promise<Doc<'boards'>> {
  const board = await ctx.db
    .query('boards')
    .withIndex('id', (q) => q.eq('id', boardId))
    .unique()

  invariant(board, `missing board ${boardId}`)
  return board
}
async function ensureColumnExists(
  ctx: QueryCtx,
  columnId: string,
): Promise<Doc<'columns'>> {
  const column = await ctx.db
    .query('columns')
    .withIndex('id', (q) => q.eq('id', columnId))
    .unique()

  invariant(column, `missing column: ${columnId}`)
  return column
}
async function ensureItemExists(
  ctx: QueryCtx,
  itemId: string,
): Promise<Doc<'items'>> {
  const item = await ctx.db
    .query('items')
    .withIndex('id', (q) => q.eq('id', itemId))
    .unique()

  invariant(item, `missing item: ${itemId}`)
  return item
}

export const createColumn = mutation({
  args: newColumnsSchema,
  handler: async (ctx, { boardId, name }) => {
    ensureBoardExists(ctx, boardId)

    const existingColumns = await ctx.db
      .query('columns')
      .withIndex('board', (q) => q.eq('boardId', boardId))
      .collect()

    ctx.db.insert('columns', {
      boardId,
      name,
      order: existingColumns.length + 1,
      id: crypto.randomUUID(),
    })
  },
})

export const createItem = mutation({
  args: schema.tables.items.validator,
  handler: async (ctx, item) => {
    await ensureBoardExists(ctx, item.boardId)
    await ctx.db.insert('items', item)
  },
})

export const deleteItem = mutation({
  args: deleteItemSchema,
  handler: async (ctx, { id, boardId }) => {
    await ensureBoardExists(ctx, boardId)
    const item = await ensureItemExists(ctx, id)
    await ctx.db.delete(item._id)
  },
})

export const updateItem = mutation({
  args: schema.tables.items.validator,
  handler: async (ctx, newItem) => {
    const { id, boardId } = newItem
    await ensureBoardExists(ctx, boardId)
    const item = await ensureItemExists(ctx, id)
    await ctx.db.patch(item._id, newItem)
  },
})

export const updateColumn = mutation({
  args: updateColumnSchema,
  handler: async (ctx, newColumn) => {
    const { id, boardId } = newColumn
    await ensureBoardExists(ctx, boardId)
    const item = await ensureColumnExists(ctx, id)
    await ctx.db.patch(item._id, newColumn)
  },
})

export const updateBoard = mutation({
  args: updateBoardSchema,
  handler: async (ctx, boardUpdate) => {
    const board = await ensureBoardExists(ctx, boardUpdate.id)
    await ctx.db.patch(board._id, boardUpdate)
  },
})

export const deleteColumn = mutation({
  args: deleteColumnSchema,
  handler: async (ctx, { boardId, id }) => {
    await ensureBoardExists(ctx, boardId)
    const column = await ensureColumnExists(ctx, id)
    const items = await ctx.db
      .query('items')
      .withIndex('column', (q) => q.eq('columnId', id))
      .collect()
    await Promise.all(items.map((item) => ctx.db.delete(item._id)))
    await ctx.db.delete(column._id)
  },
})
