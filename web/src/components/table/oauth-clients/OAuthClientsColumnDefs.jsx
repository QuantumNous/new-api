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
import { Button, Space, Tag, Modal, Typography, Tooltip } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../helpers';

const { Text } = Typography;

// Render timestamp
function renderTimestamp(timestamp) {
  if (!timestamp) return '-';
  return <>{timestamp2string(timestamp)}</>;
}

// Render client type
const renderClientType = (text, t) => {
  if (text === 'public') {
    return (
      <Tag color='blue' shape='circle' size='small'>
        {t('公开')}
      </Tag>
    );
  }
  return (
    <Tag color='green' shape='circle' size='small'>
      {t('机密')}
    </Tag>
  );
};

// Render redirect URIs
const renderRedirectUris = (uris, t) => {
  if (!uris || uris.length === 0) {
    return <Text type='tertiary'>-</Text>;
  }

  const uriArray = Array.isArray(uris) ? uris : [uris];
  const displayUris = uriArray.slice(0, 1);
  const extraCount = uriArray.length - displayUris.length;

  return (
    <Space wrap>
      {displayUris.map((uri, idx) => (
        <Tooltip key={idx} content={uri} position='top'>
          <Tag shape='circle' style={{ maxWidth: '200px' }}>
            <Text ellipsis={{ showTooltip: false }} style={{ maxWidth: '180px' }}>
              {uri}
            </Text>
          </Tag>
        </Tooltip>
      ))}
      {extraCount > 0 && (
        <Tooltip
          content={uriArray.slice(1).join('\n')}
          position='top'
          showArrow
        >
          <Tag shape='circle'>{'+' + extraCount}</Tag>
        </Tooltip>
      )}
    </Space>
  );
};

// Render scopes
const renderScopes = (scopes, t) => {
  if (!scopes || scopes.length === 0) {
    return <Text type='tertiary'>-</Text>;
  }

  const scopeArray = Array.isArray(scopes) ? scopes : scopes.split(' ');
  const displayScopes = scopeArray.slice(0, 2);
  const extraCount = scopeArray.length - displayScopes.length;

  return (
    <Space wrap>
      {displayScopes.map((scope, idx) => (
        <Tag key={idx} color='cyan' shape='circle' size='small'>
          {scope}
        </Tag>
      ))}
      {extraCount > 0 && (
        <Tooltip
          content={scopeArray.slice(2).join(', ')}
          position='top'
          showArrow
        >
          <Tag shape='circle'>{'+' + extraCount}</Tag>
        </Tooltip>
      )}
    </Space>
  );
};

// Render client ID with copy button
const renderClientId = (text, copyText, t) => {
  if (!text) return '-';

  return (
    <Space>
      <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '150px' }}>
        {text}
      </Text>
      <Button
        theme='borderless'
        size='small'
        type='tertiary'
        icon={<IconCopy />}
        aria-label='copy client id'
        onClick={async (e) => {
          e.stopPropagation();
          await copyText(text);
        }}
      />
    </Space>
  );
};

// Render operations column
const renderOperations = (
  text,
  record,
  setEditingClient,
  setShowEdit,
  deleteClient,
  refresh,
  t
) => {
  return (
    <Space wrap>
      <Button
        type='tertiary'
        size='small'
        onClick={() => {
          setEditingClient(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </Button>

      <Button
        type='danger'
        size='small'
        onClick={() => {
          Modal.confirm({
            title: t('确定是否要删除此客户端？'),
            content: t('此修改将不可逆'),
            onOk: async () => {
              await deleteClient(record.client_id);
            },
          });
        }}
      >
        {t('删除')}
      </Button>
    </Space>
  );
};

export const getOAuthClientsColumns = ({
  t,
  copyText,
  deleteClient,
  setEditingClient,
  setShowEdit,
  refresh,
}) => {
  return [
    {
      title: t('客户端名称'),
      dataIndex: 'client_name',
      key: 'client_name',
    },
    {
      title: t('Client ID'),
      dataIndex: 'client_id',
      key: 'client_id',
      render: (text) => renderClientId(text, copyText, t),
    },
    {
      title: t('类型'),
      dataIndex: 'token_endpoint_auth_method',
      key: 'token_endpoint_auth_method',
      render: (text) => {
        const isPublic = text === 'none';
        return renderClientType(isPublic ? 'public' : 'confidential', t);
      },
    },
    {
      title: t('Redirect URI'),
      dataIndex: 'redirect_uris',
      key: 'redirect_uris',
      render: (uris) => renderRedirectUris(uris, t),
    },
    {
      title: t('允许的 Scope'),
      dataIndex: 'scope',
      key: 'scope',
      render: (scopes) => renderScopes(scopes, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => renderTimestamp(text),
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record) =>
        renderOperations(
          text,
          record,
          setEditingClient,
          setShowEdit,
          deleteClient,
          refresh,
          t
        ),
    },
  ];
};
