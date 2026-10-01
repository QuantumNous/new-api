import type {
  CompositeComponentResult,
  ValidateCompositeComponent,
} from './ServerComponentTypes'

/**
 * Client stub for createCompositeComponent.
 *
 * This function should never be called at runtime on the client.
 * It exists only to satisfy bundler imports in client bundles.
 * The real implementation only runs inside server functions.
 */
export function createCompositeComponent<TComp>(
  _component: ValidateCompositeComponent<TComp>,
): Promise<CompositeComponentResult<TComp>> {
  throw new Error(
    'createCompositeComponent cannot be called on the client. ' +
      'This function should only be called inside a server function or route loader.',
  )
}
