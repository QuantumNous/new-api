import { useState, useEffect, useCallback } from 'react';
import { getTableCompactMode, setTableCompactMode } from '../helpers';
import { TABLE_COMPACT_MODES_KEY } from '../constants';

/**
 * 自定义 Hook：管理表格紧凑/自适应模式
 * 返回 [compactMode, setCompactMode]。
 * 内部使用 localStorage 保存状态，并监听 storage 事件保持多标签页同步。
 */
export function useTableCompactMode(tableKey = 'global') {
    const [compactMode, setCompactModeState] = useState(() => getTableCompactMode(tableKey));

    const setCompactMode = useCallback((value) => {
        setCompactModeState(value);
        setTableCompactMode(value, tableKey);
    }, [tableKey]);

    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === TABLE_COMPACT_MODES_KEY) {
                try {
                    const modes = JSON.parse(e.newValue || '{}');
                    setCompactModeState(!!modes[tableKey]);
                } catch {
                    // ignore parse error
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [tableKey]);

    return [compactMode, setCompactMode];
} 