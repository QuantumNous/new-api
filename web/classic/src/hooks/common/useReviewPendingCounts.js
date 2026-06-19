import { useEffect, useState } from 'react';
import { API, isAdmin } from '../../helpers';

// 管理员审核待办计数轮询（实名认证 / 企业认证 / 对公转账+发票），用于侧边栏与页签红点。
// 30s 轮询；后台标签页暂停；非管理员不请求。红点非关键路径，失败静默。
const POLL_MS = 30000;

export function useReviewPendingCounts() {
  const [counts, setCounts] = useState({
    kyc: 0,
    enterprise: 0,
    bank_transfer: 0,
    invoice: 0,
    bank_transfer_total: 0,
  });

  useEffect(() => {
    if (!isAdmin()) return;
    let timer = null;

    const poll = async () => {
      try {
        const res = await API.get('/api/user/review/pending_counts');
        if (res.data?.success) setCounts(res.data.data || {});
      } catch {
        /* 静默 */
      }
    };

    const tick = () => {
      if (document.hidden) return;
      poll();
    };

    tick();
    timer = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVis);
    // 审核动作（通过/拒绝/开具）后即时刷新
    const onChanged = () => poll();
    window.addEventListener('review:changed', onChanged);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('review:changed', onChanged);
    };
  }, []);

  return counts;
}
