import { shallowRef } from 'vue'

export function useMutation<TVariables, TData, TError = Error>(opts: {
  fn: (variables: TVariables) => Promise<TData>
  onSuccess?: (ctx: { data: TData }) => void | Promise<void>
}) {
  const submittedAt = shallowRef<number | undefined>(undefined)
  const variables = shallowRef<TVariables | undefined>(undefined)
  const error = shallowRef<TError | undefined>(undefined)
  const data = shallowRef<TData | undefined>(undefined)
  const status = shallowRef<'idle' | 'pending' | 'success' | 'error'>('idle')

  const mutate = async (
    variablesInput: TVariables,
  ): Promise<TData | undefined> => {
    status.value = 'pending'
    submittedAt.value = Date.now()
    variables.value = variablesInput
    try {
      const result = await opts.fn(variablesInput)
      await opts.onSuccess?.({ data: result })
      status.value = 'success'
      error.value = undefined
      data.value = result
      return result
    } catch (err) {
      status.value = 'error'
      error.value = err as TError
    }
  }

  return {
    status,
    variables,
    submittedAt,
    mutate,
    error,
    data,
  }
}
