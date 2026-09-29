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

import { useEffect, useMemo, useState } from 'react';
import {
  getNextSubscriptionTransition,
  partitionSubscriptions,
} from '../../helpers/subscriptionDisplay';

export function useSubscriptionDisplay(subscriptions) {
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      const timestamp = Date.now() / 1000;
      setNow(timestamp);
      const next = getNextSubscriptionTransition(subscriptions, timestamp);
      if (next !== null) {
        // 浏览器对超长延迟会溢出，达到上限后重新计算。
        timer = setTimeout(
          update,
          Math.min((next - timestamp) * 1000, 2147483647),
        );
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [subscriptions]);

  const groups = useMemo(
    () => partitionSubscriptions(subscriptions, now),
    [subscriptions, now],
  );
  return { ...groups, now };
}
