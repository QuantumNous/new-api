import type {
  RenderableServerComponentBuilder,
  ValidateRenderableServerComponent,
} from './ServerComponentTypes'

/**
 * Client stub for renderServerComponent.
 *
 * This function should never be called at runtime on the client.
 * It exists only to satisfy bundler imports in client bundles.
 * The real implementation only runs inside server functions.
 */
export function renderServerComponent<TNode>(
  _node: ValidateRenderableServerComponent<TNode>,
): Promise<RenderableServerComponentBuilder<TNode>> {
  // Unit/type tests import this stub directly and call it.
  // Avoid throwing in that environment while keeping a hard runtime guard elsewhere.
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve(null as any)
  }

  throw new Error(
    'renderServerComponent cannot be called on the client. ' +
      'This function should only be called inside a server function or route loader.',
  )
}
