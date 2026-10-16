export type ServerFnInput = {
  id: string
}

export type ServerFnChurnContext = {
  ctx: string
}

const recordIndexes = Array.from({ length: 5 }, (_, index) => index)

export function validateServerFnInput(input: unknown): ServerFnInput {
  const payload = input as Partial<ServerFnInput> | null

  if (typeof payload?.id !== 'string') {
    throw new Error('invalid server-fn churn input')
  }

  return { id: payload.id }
}

export function makeServerFnChurnPayload(
  data: ServerFnInput,
  context: ServerFnChurnContext,
) {
  return {
    id: data.id,
    ctx: context.ctx,
    payload: recordIndexes.map((index) => ({
      id: `${data.id}-${index}`,
      label: `record-${index}`,
    })),
  }
}
