import { useMemo } from 'react';

import { usePlaygroundTabs } from '@classic/hooks/common/usePlaygroundTabs';

// 移动端各页 MODES（curated 子集）与运营「体验区管理」可见 tab 求交集，
// 使桌面端隐藏某 tab 时移动端同步隐藏。返回过滤后的 modes 数组。
export const useVisibleModes = (category, modes) => {
  const visible = usePlaygroundTabs(category);
  return useMemo(() => {
    const keys = new Set(visible.map((tb) => tb.key));
    return modes.filter((m) => keys.has(m.key));
  }, [visible, modes]);
};
