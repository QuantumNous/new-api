/**
 * @deprecated Use [`Response.json`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static) from the standard Web API directly.
 */
export interface JsonResponse<TData> extends Response {
  json: () => Promise<TData>
}

/**
 * @deprecated Use [`Response.json`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static) from the standard Web API directly.
 */
export function json<TData>(
  payload: TData,
  init?: ResponseInit,
): JsonResponse<TData> {
  return Response.json(payload, init)
}
