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
import { Form, Tag, Typography } from '@douyinfe/semi-ui';

export default function HttpStatusCodeRulesInput(props) {
  const { Text } = Typography;
  const {
    label,
    field,
    placeholder,
    extraText,
    onChange,
    parsed,
    invalidText,
  } = props;

  return (
    <>
      <Form.Input
        label={label}
        placeholder={placeholder}
        extraText={extraText}
        field={field}
        onChange={onChange}
      />
      {parsed?.ok && parsed.tokens?.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
          }}
        >
          {parsed.tokens.map((token) => (
            <Tag key={token} size='small'>
              {token}
            </Tag>
          ))}
        </div>
      )}
      {!parsed?.ok && (
        <Text type='danger' style={{ display: 'block', marginTop: 8 }}>
          {invalidText}
          {parsed?.invalidTokens && parsed.invalidTokens.length > 0
            ? `: ${parsed.invalidTokens.join(', ')}`
            : ''}
        </Text>
      )}
    </>
  );
}

