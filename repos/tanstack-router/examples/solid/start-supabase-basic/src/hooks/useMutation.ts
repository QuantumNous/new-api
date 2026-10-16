import { createSignal } from 'solid-js'

export function useMutation<TVariables, TData, TError = Error>(opts: {
  fn: (variables: TVariables) => Promise<TData>
  onSuccess?: (ctx: { data: TData }) => void | Promise<void>
}) {
  const [submittedAt, setSubmittedAt] = createSignal<number | undefined>()
  const [variables, setVariables] = createSignal<TVariables | undefined>()
  const [error, setError] = createSignal<TError | undefined>()
  const [data, setData] = createSignal<TData | undefined>()
  const [status, setStatus] = createSignal<
    'idle' | 'pending' | 'success' | 'error'
  >('idle')

  const mutate = async (variables: TVariables): Promise<TData | undefined> => {
    setStatus('pending')
    setSubmittedAt(Date.now())
    setVariables(() => variables)

    try {
      const result = await opts.fn(variables)
      await opts.onSuccess?.({ data: result })
      setStatus('success')
      setError(undefined)
      setData(() => result)
      return result
    } catch (err) {
      setStatus('error')
      setError(() => err as TError)
      return undefined
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
