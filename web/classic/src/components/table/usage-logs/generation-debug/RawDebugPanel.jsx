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
import JsonViewer from './JsonViewer';

const RawDebugPanel = ({ raw, t }) => {
  const entries = [
    [t('Inbound request'), raw?.inbound_request],
    [t('Upstream request'), raw?.upstream_request],
    [
      raw?.raw_stream ? t('Raw stream') : t('Raw response'),
      raw?.raw_stream ?? raw?.raw_response,
    ],
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}
    >
      {entries.map(([label, value]) =>
        value ? (
          <JsonViewer
            key={label}
            label={label}
            value={value.value}
            rawMeta={value}
            t={t}
          />
        ) : null,
      )}
    </div>
  );
};

export default RawDebugPanel;
