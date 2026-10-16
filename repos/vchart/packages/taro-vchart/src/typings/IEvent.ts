import { EventType, EventQuery, EventCallback, EventParams } from '@visactor/vchart';

interface IEvent {
  /**
   * 事件的名称
   */
  type: EventType;
  /**
   * 事件 API 中的事件筛选配置
   */
  query?: EventQuery;
  handler: EventCallback<EventParams>;
}

export { IEvent };
