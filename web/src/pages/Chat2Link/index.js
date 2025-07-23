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

import React from 'react';
import { useTokenKeys } from '../../hooks/chat/useTokenKeys';

const chat2page = () => {
  const { keys, chatLink, serverAddress, isLoading } = useTokenKeys();

  const comLink = (key) => {
    if (!chatLink || !serverAddress || !key) return '';
    return `${chatLink}/#/?settings={"key":"sk-${key}","url":"${encodeURIComponent(serverAddress)}"}`;
  };

  if (keys.length > 0) {
    const redirectLink = comLink(keys[0]);
    if (redirectLink) {
      window.location.href = redirectLink;
    }
  }

  return (
    <div className="mt-[60px] px-2">
      <h3>正在加载，请稍候...</h3>
    </div>
  );
};

export default chat2page;
