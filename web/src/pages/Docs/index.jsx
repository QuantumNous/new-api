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

const DOCS_URL = '/docs-proxy/';

const Docs = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      <iframe
        src={DOCS_URL}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title='Documentation'
        allow='accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone'
        sandbox='allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation'
      />
    </div>
  );
};

export default Docs;
