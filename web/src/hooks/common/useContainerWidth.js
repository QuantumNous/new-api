/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

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
