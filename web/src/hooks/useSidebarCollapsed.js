import { useState, useCallback } from 'react';

const KEY = 'default_collapse_sidebar';

export const useSidebarCollapsed = () => {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === 'true');

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(KEY, next.toString());
      return next;
    });
  }, []);

  const set = useCallback((value) => {
    setCollapsed(value);
    localStorage.setItem(KEY, value.toString());
  }, []);

  return [collapsed, toggle, set];
}; 