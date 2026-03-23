import { useState, useEffect, useRef } from 'react';

/**
 * 检测容器宽度的 Hook
 * @returns {[ref, width]} 容器引用和当前宽度
 */
export const useContainerWidth = () => {
  const [width, setWidth] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newWidth } = entry.contentRect;
        setWidth(newWidth);
      }
    });

    resizeObserver.observe(element);

    // 初始化宽度
    setWidth(element.getBoundingClientRect().width);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [ref, width];
};
