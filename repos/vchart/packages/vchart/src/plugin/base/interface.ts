export interface IBasePlugin<T = any> {
  readonly type: string;
  id: UniqueId;
  name: string;
  onAdd: (service: T) => void;
  init?: () => void;
  /**
   * clear graphic items
   */
  clear?: (service: T) => void;
  /**
   * release instance
   */
  release?: (service: T) => void;
  onInit?: (service: T, ...params: any) => MaybePromise<void>;
  onDidCompile?: (service: T, ...params: any) => MaybePromise<void>;
}

export interface IBasePluginService<T = any> {
  id: UniqueId;
  load: (plugins: T[]) => void;
  add: (plugins: T[]) => T[] | null;
  activate: (plugins: T[]) => void;
  get: (id: UniqueId) => T | undefined;
  getAll: () => T[];
  release: (pluginsId: UniqueId) => void;
  releaseAll: () => void;
  clear: (pluginsId: UniqueId) => void;
  clearAll: () => void;
}

export type UniqueId = number;
export type MaybePromise<T> = T | PromiseLike<T>;
