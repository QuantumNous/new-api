// functions/Pages_Functions.js
// 该函数会将所有请求转发到 http://166.108.203.60:3000/

export async function onRequest(context) {
  // 从上下文中获取原始请求
  const { request } = context;

  // 解析原始请求的 URL，以获取路径和查询参数
  const url = new URL(request.url);
  const path = url.pathname;
  const search = url.search;

  // 构建目标 URL
  const targetUrl = `http://166.108.203.60:3000${path}${search}`;

  // 创建一个新的请求以转发到目标地址
  // 复制原始请求的方法、头部和主体
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual' // 防止 fetch 自动处理重定向
  });

  // 执行转发请求并返回响应
  try {
    return await fetch(newRequest);
  } catch (error) {
    // 如果目标服务器无法访问，返回一个错误信息
    return new Response(`Error forwarding request: ${error.message}`, { status: 502 });
  }
}