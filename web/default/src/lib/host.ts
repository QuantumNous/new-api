// 判断当前是否处于营销站点 host（www.91flow.com）。
// 部署上 www 承载营销前台、app 承载 New-API 原生控制台，二者共用同一份 SPA 构建。
// 该函数仅用于按 host 切换营销/控制台路由，绝不修改任何控制台逻辑。
export function isMarketingHost(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.host.startsWith('www.')
}
