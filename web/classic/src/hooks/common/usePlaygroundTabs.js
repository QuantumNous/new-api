import { useContext, useMemo } from 'react';
import { StatusContext } from '../../context/Status';
import {
  getPlaygroundCategory,
  parsePlaygroundTabConfig,
  isPlaygroundTabVisible,
} from '../../constants/playgroundAdmin.constants';

// 返回某分类下「当前可见」的 tab 列表（按运营 PlaygroundTabConfig 过滤，缺省=显示）。
// 各体验区分类页共用，避免重复解析。返回 [{key,label,capability}]。
export const usePlaygroundTabs = (category) => {
  const [statusState] = useContext(StatusContext);
  const raw = statusState?.status?.PlaygroundTabConfig;
  return useMemo(() => {
    const cat = getPlaygroundCategory(category);
    const tabs = cat?.tabs || [];
    const cfg = parsePlaygroundTabConfig(raw);
    return tabs.filter((tb) => isPlaygroundTabVisible(cfg, category, tb.key));
  }, [category, raw]);
};
