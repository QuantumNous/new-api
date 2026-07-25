// 生成结果分享：优先系统分享面板（可直接发微信/朋友圈），
// 不支持时回退为下载保存；微信内置浏览器由调用方引导（长按/外部浏览器）。

export const isWeChatBrowser = () =>
  /MicroMessenger/i.test(navigator.userAgent);

// 返回 'shared' | 'downloaded' | 'cancelled'
export async function shareMediaUrl(url, filename) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`获取文件失败 (${res.status})`);
  }
  const blob = await res.blob();
  const file = new File([blob], filename, {
    type: blob.type || 'application/octet-stream',
  });
  if (
    typeof navigator.share === 'function' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // 部分浏览器 share 失败后仍可下载兜底
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
  return 'downloaded';
}
