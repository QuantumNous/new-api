import { useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '../convex/_generated/api'

export const boardQueries = {
  list: () => convexQuery(api.board.getBoards, {}),
  detail: (id: string) => convexQuery(api.board.getBoard, { id }),
}

export function useCreateColumnMutation() {
  const mutationFn = useConvexMutation(
    api.board.createColumn,
  ).withOptimisticUpdate((localStore, args) => {
    const board = localStore.getQuery(api.board.getBoard, { id: args.boardId })
    if (!board) return

    const randomId = Math.random() + ''

    const newBoard = {
      ...board,
      columns: [
        ...board.columns,
        {
          ...args,
          order: board.columns.length + 1,
          id: randomId,
          items: [],
        },
      ],
    }

    localStore.setQuery(api.board.getBoard, { id: board.id }, newBoard)
  })

  return useMutation({ mutationFn })
}

export function useCreateItemMutation() {
  const mutationFn = useConvexMutation(
    api.board.createItem,
  ).withOptimisticUpdate((localStore, args) => {
    const board = localStore.getQuery(api.board.getBoard, { id: args.boardId })
    if (!board) return

    const items = [...board.items, args]
    localStore.setQuery(
      api.board.getBoard,
      { id: board.id },
      { ...board, items },
    )
  })

  return useMutation({ mutationFn })
}

export function useUpdateCardMutation() {
  const mutationFn = useConvexMutation(
    api.board.updateItem,
  ).withOptimisticUpdate((localStore, args) => {
    const board = localStore.getQuery(api.board.getBoard, { id: args.boardId })
    if (!board) return
    const items = board.items.map((item) => (item.id === args.id ? args : item))
    localStore.setQuery(
      api.board.getBoard,
      { id: board.id },
      { ...board, items },
    )
  })

  return useMutation({ mutationFn })
}

export function useDeleteCardMutation() {
  const mutationFn = useConvexMutation(
    api.board.deleteItem,
  ).withOptimisticUpdate((localStore, args) => {
    const board = localStore.getQuery(api.board.getBoard, { id: args.boardId })
    if (!board) return
    const items = board.items.filter((item) => item.id !== args.id)
    localStore.setQuery(
      api.board.getBoard,
      { id: board.id },
      { ...board, items },
    )
  })

  return useMutation({ mutationFn })
}

export function useDeleteColumnMutation() {
  const mutationFn = useConvexMutation(
    api.board.deleteColumn,
  ).withOptimisticUpdate((localStore, args) => {
    const board = localStore.getQuery(api.board.getBoard, { id: args.boardId })
    if (!board) return
    const columns = board.columns.filter((col) => col.id !== args.id)
    const items = board.items.filter((item) => item.columnId !== args.id)
    localStore.setQuery(
      api.board.getBoard,
      { id: board.id },
      { ...board, items, columns },
    )
  })

  return useMutation({ mutationFn })
}

export function useUpdateBoardMutation() {
  const mutationFn = useConvexMutation(api.board.updateBoard)
  return useMutation({ mutationFn })
}

export function useUpdateColumnMutation() {
  const mutationFn = useConvexMutation(
    api.board.updateColumn,
  ).withOptimisticUpdate((localStore, args) => {
    const board = localStore.getQuery(api.board.getBoard, { id: args.boardId })
    if (!board) return
    const columns = board.columns.map((col) =>
      col.id === args.id ? { ...col, ...args } : col,
    )
    localStore.setQuery(
      api.board.getBoard,
      { id: board.id },
      { ...board, columns },
    )
  })

  return useMutation({ mutationFn })
}
