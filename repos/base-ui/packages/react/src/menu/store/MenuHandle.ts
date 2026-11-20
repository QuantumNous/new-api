import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { MenuStore } from './MenuStore';

export class MenuHandle<Payload> {
  /**
   * Internal store holding the menu's state.
   * @internal
   */
  public readonly store: MenuStore<Payload>;

  constructor() {
    this.store = new MenuStore<Payload>();
  }

  /**
   * Opens the menu and associates it with the trigger with the given id.
   * The trigger must be a Menu.Trigger component with this handle passed as a prop.
   *
   * @param triggerId ID of the trigger to associate with the menu.
   */
  open(triggerId: string) {
    const triggerElement = triggerId
      ? (this.store.context.triggerElements.getById(triggerId) as HTMLElement | undefined)
      : undefined;

    if (triggerId && !triggerElement) {
      throw new Error(`Base UI: MenuHandle.open: No trigger found with id "${triggerId}".`);
    }

    this.store.setOpen(
      true,
      createChangeEventDetails('imperative-action', undefined, triggerElement),
    );
  }

  /**
   * Closes the menu.
   */
  close() {
    this.store.setOpen(false, createChangeEventDetails('imperative-action', undefined, undefined));
  }

  /**
   * Indicates whether the menu is currently open.
   */
  get isOpen() {
    return this.store.select('open');
  }
}

/**
 * Creates a new handle to connect a Menu.Root with detached Menu.Trigger components.
 */
export function createMenuHandle<Payload>(): MenuHandle<Payload> {
  return new MenuHandle<Payload>();
}
