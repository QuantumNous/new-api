import { useState, useEffect, useRef } from 'react';

/**
 * 自定义 Hook：确保骨架屏至少显示指定的时间
 * @param {boolean} loading - 实际的加载状态
 * @param {number} minimumTime - 最小显示时间（毫秒），默认 1000ms
 * @returns {boolean} showSkeleton - 是否显示骨架屏的状态
 */
export const useMinimumLoadingTime = (loading, minimumTime = 1000) => {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const loadingStartRef = useRef(Date.now());

  useEffect(() => {
    if (loading) {
      loadingStartRef.current = Date.now();
      setShowSkeleton(true);
    } else {
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, minimumTime - elapsed);

      if (remaining === 0) {
        setShowSkeleton(false);
      } else {
        const timer = setTimeout(() => setShowSkeleton(false), remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, minimumTime]);

  return showSkeleton;
};
