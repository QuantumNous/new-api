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
