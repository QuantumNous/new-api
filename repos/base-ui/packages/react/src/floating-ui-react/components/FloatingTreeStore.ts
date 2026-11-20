import type { FloatingNodeType, FloatingEvents } from '../types';
import { createEventEmitter } from '../utils/createEventEmitter';

/**
 * Stores and manages floating elements in a tree structure.
 * This is a backing store for the `FloatingTree` component.
 */
export class FloatingTreeStore {
  public readonly nodesRef: React.RefObject<Array<FloatingNodeType>> = { current: [] };

  public readonly events: FloatingEvents = createEventEmitter();

  public addNode(node: FloatingNodeType) {
    this.nodesRef.current.push(node);
  }

  public removeNode(node: FloatingNodeType) {
    const index = this.nodesRef.current.findIndex((n) => n === node);
    if (index !== -1) {
      this.nodesRef.current.splice(index, 1);
    }
  }
}
