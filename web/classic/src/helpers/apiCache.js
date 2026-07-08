import { API } from './api';
import { getUserIdFromLocalStorage } from './utils';

// 前端只读接口的共享缓存：按完整 URL 缓存返回信封（res.data），供图片/视频/对话三个页面共用。
// 目的：切换页面/切回分组时不再重复请求这些每次都直查后端的接口（models / pricing / groups）。
// 失效：模块级缓存，整页刷新即重置；另加默认 5 分钟 TTL，后台数据变更后最多滞后 TTL 自动纠正。
const DEFAULT_TTL = 5 * 60 * 1000;

const cache = new Map(); // cacheKey -> { payload, ts }
const inflight = new Map(); // cacheKey -> Promise<payload>

// 这些接口按当前登录用户/分组过滤，缓存 key 必须带用户 id：
// 同标签页切换账号(SPA 跳转不刷新页面)时才不会命中上一个账号的缓存而串号。
const cacheKeyFor = (url) => `${getUserIdFromLocalStorage()}::${url}`;

// 通用缓存 GET：返回 res.data（与直接 API.get(...).data 一致）。
// config 透传给 API.get（如 { skipErrorHandler: true }）；ttl 可覆盖默认值。
export async function cachedGet(url, { ttl = DEFAULT_TTL, config } = {}) {
  const key = cacheKeyFor(url);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) {
    return hit.payload;
  }
  if (inflight.has(key)) {
    return inflight.get(key);
  }
  const promise = API.get(url, config)
    .then((res) => {
      const payload = res.data;
      // 仅缓存成功结果，失败不缓存以便下次重试。
      if (payload && payload.success) {
        cache.set(key, { payload, ts: Date.now() });
      }
      return payload;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

// 便捷封装：/api/user/models?group=X
export async function getUserModelsCached(group = '') {
  const groupParam = group ? `?group=${encodeURIComponent(group)}` : '';
  return cachedGet(`/api/user/models${groupParam}`);
}

// 供切换账号/配置变更等场景手动失效整个缓存。
export function clearApiCache() {
  cache.clear();
  inflight.clear();
}
