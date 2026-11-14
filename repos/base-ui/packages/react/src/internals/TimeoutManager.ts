/**
 * A utility class to manage multiple timeouts.
 */
export class TimeoutManager {
  private ids: Map<string, number> = new Map();

  start = (key: string, delay: number, fn: () => void) => {
    this.clear(key);
    const id = setTimeout(() => {
      this.ids.delete(key);
      fn();
    }, delay) as unknown as number; /* Node.js types are enabled in development */

    this.ids.set(key, id);
  };

  clear = (key: string) => {
    const id = this.ids.get(key);
    if (id != null) {
      clearTimeout(id);
      this.ids.delete(key);
    }
  };

  clearAll = () => {
    this.ids.forEach(clearTimeout);
    this.ids.clear();
  };
}
