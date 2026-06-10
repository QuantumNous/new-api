import { useEffect, useRef, useState } from 'react';
import { API, isAdmin } from '../../helpers';
import {
  USER_FEEDBACK_BASE,
  ADMIN_FEEDBACK_BASE,
} from '../../components/feedback/feedbackHelpers';

// 工单未读红点轮询。三项优化（设计文档 §10.2）：
//   ① 30s 轮询  ② 后台标签页暂停  ③ 无工单用户首查一次后不再轮询用户未读。
const POLL_MS = 30000;

export function useFeedbackUnread() {
  const [userUnread, setUserUnread] = useState(0);
  const [adminUnread, setAdminUnread] = useState(0);
  const hasTopicsRef = useRef(false);
  const startedRef = useRef(false);
  const tickCountRef = useRef(0);

  useEffect(() => {
    let timer = null;

    const pollUser = async () => {
      try {
        const res = await API.get(`${USER_FEEDBACK_BASE}/unread`);
        if (res.data.success) {
          setUserUnread(res.data.data.unread || 0);
          hasTopicsRef.current = !!res.data.data.has_topics;
        }
      } catch {
        /* 静默：未读红点非关键路径 */
      }
    };

    const pollAdmin = async () => {
      if (!isAdmin()) return;
      try {
        const res = await API.get(`${ADMIN_FEEDBACK_BASE}/unread`);
        if (res.data.success) setAdminUnread(res.data.data.unread || 0);
      } catch {
        /* 静默 */
      }
    };

    const tick = () => {
      if (document.hidden) return; // ② 后台标签页暂停
      tickCountRef.current += 1;
      // ③ 无工单用户不轮询用户未读：首次查一次以确定 has_topics；之后每 10 个
      //    周期（约 5 分钟）再探测一次，以便会话内新建首个工单后自愈恢复轮询。
      const recheck = tickCountRef.current % 10 === 0;
      if (hasTopicsRef.current || !startedRef.current || recheck) {
        startedRef.current = true;
        pollUser();
      }
      pollAdmin();
    };

    tick();
    timer = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVis);

    // 工单发生变化（新建/打开/关闭等）时即时刷新红点，避免无工单用户创建首单后
    // 要等周期重探才更新；同时让本人操作（如打开工单清未读）立刻反映到角标。
    const onChanged = () => {
      hasTopicsRef.current = true; // 既然有变化，说明已有工单，恢复轮询
      pollUser();
      pollAdmin();
    };
    window.addEventListener('feedback:changed', onChanged);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('feedback:changed', onChanged);
    };
  }, []);

  return { userUnread, adminUnread };
}
