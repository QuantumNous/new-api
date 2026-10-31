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
    //
    try {
      const data = await opts.fn(variables)
      await opts.onSuccess?.({ data })
      setStatus('success')
      setError(undefined)
      setData(() => data)
      return data
    } catch (err: any) {
      setStatus('error')
      setError(() => err)
    }
  }

  return {
    get status() {
      return status()
    },
    get variables() {
      return variables()
    },
    get submittedAt() {
      return submittedAt()
    },
    mutate,
    get error() {
      return error()
    },
    get data() {
      return data()
    },
  }
}
