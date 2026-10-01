export type CachedWordMeasure = {
  sprite: number[];
  bounds: { dTop: number; dBottom: number; dLeft: number; dRight: number };
  wordSize: [number, number];
};

export class WordMeasureCache {
  private _map = new Map<string, CachedWordMeasure>();
  private _maxSize: number;

  constructor(maxSize: number = 1000) {
    this._maxSize = maxSize;
  }

  get(key: string) {
    const v = this._map.get(key);
    if (!v) {
      return undefined;
    }

    this._map.delete(key);
    this._map.set(key, v);

    return v;
  }

  set(key: string, value: CachedWordMeasure) {
    if (this._map.has(key)) {
      this._map.set(key, value);
      return;
    }

    if (this._map.size >= this._maxSize) {
      const oldest = this._map.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        this._map.delete(oldest);
      }
    }

    this._map.set(key, value);
  }

  clear() {
    this._map.clear();
  }

  size() {
    return this._map.size;
  }
}
