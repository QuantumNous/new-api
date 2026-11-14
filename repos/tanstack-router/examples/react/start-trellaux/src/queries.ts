import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createColumn,
  createItem,
  deleteColumn,
  deleteItem,
  getBoard,
  getBoards,
  updateBoard,
  updateColumn,
  updateItem,
} from './db/board.js'

export const boardQueries = {
  list: () =>
    queryOptions({ queryKey: ['boards', 'list'], queryFn: () => getBoards() }),
  detail: (id: string) =>
    queryOptions({
      queryKey: ['boards', 'detail', id],
      queryFn: () => getBoard({ data: id }),
    }),
}

export function useCreateColumnMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createColumn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries()
      queryClient.setQueryData(
        boardQueries.detail(variables.data.boardId).queryKey,
        (board) =>
          board
            ? {
                ...board,
                columns: [
                  ...board.columns,
                  {
                    ...variables.data,
                    order: board.columns.length + 1,
                    id: Math.random() + '',
                  },
                ],
              }
            : undefined,
      )
    },
  })
}

export function useCreateItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createItem,
    onMutate: async (variables) => {
      await queryClient.cancelQueries()
      queryClient.setQueryData(
        boardQueries.detail(variables.data.boardId).queryKey,
        (board) =>
          board
            ? {
                ...board,
                items: [...board.items, variables.data],
              }
            : undefined,
      )
    },
  })
}

export function useUpdateCardMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateItem,
    onMutate: async (variables) => {
      await queryClient.cancelQueries()
      queryClient.setQueryData(
        boardQueries.detail(variables.data.boardId).queryKey,
        (board) =>
          board
            ? {
                ...board,
                items: board.items.map((i) =>
                  i.id === variables.data.id ? variables.data : i,
                ),
              }
            : undefined,
      )
    },
  })
}

export function useDeleteCardMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteItem,
    onMutate: async (variables) => {
      await queryClient.cancelQueries()

      queryClient.setQueryData(
        boardQueries.detail(variables.data.boardId).queryKey,
        (board) =>
          board
            ? {
                ...board,
                items: board.items.filter(
                  (item) => item.id !== variables.data.id,
                ),
              }
            : undefined,
      )
    },
  })
}

export function useDeleteColumnMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteColumn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries()

      queryClient.setQueryData(
        boardQueries.detail(variables.data.boardId).queryKey,
        (board) =>
          board
            ? {
                ...board,
                columns: board.columns.filter(
                  (column) => column.id !== variables.data.id,
                ),
                items: board.items.filter(
                  (item) => item.columnId !== variables.data.id,
                ),
              }
            : undefined,
      )
    },
  })
}

export function useUpdateBoardMutation() {
  return useMutation({
    mutationFn: updateBoard,
  })
}

export function useUpdateColumnMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateColumn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries()

      queryClient.setQueryData(
        boardQueries.detail(variables.data.boardId).queryKey,
        (board) =>
          board
            ? {
                ...board,
                columns: board.columns.map((c) =>
                  c.id === variables.data.id
                    ? {
                        ...c,
                        ...variables,
                      }
                    : c,
                ),
              }
            : undefined,
      )
    },
  })
}
