import crypto from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { invariant } from '../invariant'
import * as z from 'zod'
import {
  deleteColumnSchema,
  deleteItemSchema,
  itemSchema,
  newColumnSchema,
  updateBoardSchema,
  updateColumnSchema,
} from './schema'
import type { Board } from './schema'

const DELAY = 1000

const boards: Array<Board> = [
  {
    id: '1',
    name: 'First board',
    color: '#e0e0e0',
    columns: [],
    items: [],
  },
]

const delay = (ms: number = 1000) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const getBoards = createServerFn({ method: 'GET' }).handler(async () => {
  await delay(DELAY)
  return boards
})

export const getBoard = createServerFn({ method: 'GET' })
  .validator(z.string())
  .handler(async ({ data }) => {
    await delay(DELAY)
    const board = boards.find((b) => b.id === data)
    invariant(board, 'missing board')
    return board
  })

export const createColumn = createServerFn()
  .validator(newColumnSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const newColumn = newColumnSchema.parse(data)

    const board = boards.find((b) => b.id === newColumn.boardId)

    invariant(board, 'missing board')

    board.columns = [
      ...board.columns,
      {
        ...newColumn,
        order: board.columns.length + 1,
        id: crypto.randomUUID(),
      },
    ]
  })

export const createItem = createServerFn()
  .validator(itemSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const item = itemSchema.parse(data)

    const board = boards.find((b) => b.id === item.boardId)

    invariant(board, 'missing board')

    board.items.push(item)
  })

export const deleteItem = createServerFn({ method: 'GET' })
  .validator(deleteItemSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const { id } = deleteItemSchema.parse(data)
    const board = boards.find((b) => b.items.some((i) => i.id === id))
    invariant(board, 'missing board')
    board.items = board.items.filter((item) => item.id !== id)
  })

export const updateItem = createServerFn()
  .validator(itemSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const item = itemSchema.parse(data)
    const board = boards.find((b) => b.id === item.boardId)
    invariant(board, 'missing board')
    const existingItem = board.items.find((i) => i.id === item.id)
    invariant(existingItem, 'missing item')
    Object.assign(existingItem, item)
  })

export const updateColumn = createServerFn()
  .validator(updateColumnSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const column = updateColumnSchema.parse(data)
    const board = boards.find((b) => b.id === column.boardId)
    invariant(board, 'missing board')
    const existingColumn = board.columns.find((c) => c.id === column.id)
    invariant(existingColumn, 'missing column')
    Object.assign(existingColumn, column)
  })

export const updateBoard = createServerFn()
  .validator(updateBoardSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const update = updateBoardSchema.parse(data)
    const board = boards.find((b) => b.id === update.id)
    invariant(board, 'missing board')
    Object.assign(board, update)
  })

export const deleteColumn = createServerFn({ method: 'GET' })
  .validator(deleteColumnSchema)
  .handler(async ({ data }) => {
    await delay(DELAY)
    const { id } = deleteColumnSchema.parse(data)
    const board = boards.find((b) => b.columns.some((c) => c.id === id))
    invariant(board, 'missing board')
    board.columns = board.columns.filter((column) => column.id !== id)
    board.items = board.items.filter((item) => item.columnId !== id)
  })
