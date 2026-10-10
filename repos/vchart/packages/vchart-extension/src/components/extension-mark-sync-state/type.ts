import type { EnableMarkType } from '@visactor/vchart';

/**
 * 扩展 extensionMark spec，增加 syncState 配置
 */
export interface IExtensionMarkSyncStateSpec {
  /**
   * Whether to synchronize the interactive states (e.g., hover, select) from the corresponding primary mark.
   * When enabled, the extensionMark will automatically follow state changes of the primary mark that shares
   * the same data key. Users need to configure the corresponding `state` styles to take effect.
   * 是否同步主图元的交互状态（如 hover、select 等）
   * 开启后，extensionMark 会自动同步对应主图元的状态名，需自行配置对应的 state 样式
   * @default false
   */
  syncState?: boolean;
}

/**
 * 带 syncState 能力的 extensionMark spec
 */
export interface IExtensionMarkSpecWithSyncState<
  T extends Exclude<EnableMarkType, 'group'> = any
> extends IExtensionMarkSyncStateSpec {
  type: T;
  name?: string;
  dataId?: string;
  dataIndex?: number;
  [key: string]: any;
}
