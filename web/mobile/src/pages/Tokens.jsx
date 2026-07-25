import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  Input,
  List,
  NavBar,
  PullToRefresh,
  SwipeAction,
  Switch,
  Tag,
} from 'antd-mobile';

import { API } from '@classic/helpers/api';

import { copy, showError, showSuccess } from '../shims/classic-utils';
import { renderQuota } from '../utils/quota';

const TOKEN_STATUS_ENABLED = 1;

const Tokens = () => {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await API.get('/api/token/?p=1&page_size=100');
      const { success, message, data } = res.data;
      if (success) {
        setTokens(data.items || []);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      showError('请输入令牌名称');
      return;
    }
    try {
      const res = await API.post('/api/token/', {
        name: newName.trim(),
        remain_quota: 0,
        expired_time: -1,
        unlimited_quota: true,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess('令牌创建成功');
        setAddVisible(false);
        setNewName('');
        load();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleToggle = async (token, enabled) => {
    try {
      const res = await API.put('/api/token/?status_only=true', {
        id: token.id,
        status: enabled ? 1 : 2,
      });
      if (res.data.success) {
        load();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleCopy = async (token) => {
    try {
      const res = await API.post(`/api/token/${token.id}/key`);
      const { success, message, data } = res.data;
      if (success && data?.key) {
        const ok = await copy('sk-' + data.key);
        if (ok) {
          showSuccess('已复制到剪贴板');
        } else {
          Dialog.alert({ content: 'sk-' + data.key });
        }
      } else {
        showError(message || '获取密钥失败');
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleDelete = (token) => {
    Dialog.confirm({
      content: `确定删除令牌「${token.name}」吗？`,
      onConfirm: async () => {
        try {
          const res = await API.delete(`/api/token/${token.id}`);
          if (res.data.success) {
            showSuccess('已删除');
            load();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e);
        }
      },
    });
  };

  return (
    <div>
      <NavBar
        onBack={() => navigate(-1)}
        right={
          <Button
            size='small'
            color='primary'
            fill='none'
            onClick={() => setAddVisible(true)}
          >
            新建
          </Button>
        }
      >
        令牌管理
      </NavBar>
      <PullToRefresh onRefresh={load}>
        <List>
          {tokens.map((token) => (
            <SwipeAction
              key={token.id}
              rightActions={[
                {
                  key: 'delete',
                  text: '删除',
                  color: 'danger',
                  onClick: () => handleDelete(token),
                },
              ]}
            >
              <List.Item
                description={
                  token.unlimited_quota
                    ? '额度不限'
                    : `剩余 ${renderQuota(token.remain_quota)}`
                }
                extra={
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size='mini'
                      fill='outline'
                      onClick={() => handleCopy(token)}
                    >
                      复制
                    </Button>
                    <Switch
                      checked={token.status === TOKEN_STATUS_ENABLED}
                      onChange={(v) => handleToggle(token, v)}
                      style={{ '--height': '24px', '--width': '42px' }}
                    />
                  </div>
                }
              >
                {token.name}{' '}
                {token.status !== TOKEN_STATUS_ENABLED && (
                  <Tag color='default'>已禁用</Tag>
                )}
              </List.Item>
            </SwipeAction>
          ))}
        </List>
        {tokens.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--adm-color-weak)' }}>
            暂无令牌，点右上角新建
          </p>
        )}
      </PullToRefresh>
      <Dialog
        visible={addVisible}
        title='新建令牌'
        content={
          <Input
            placeholder='令牌名称'
            value={newName}
            onChange={setNewName}
          />
        }
        closeOnAction
        onClose={() => setAddVisible(false)}
        actions={[
          [
            { key: 'cancel', text: '取消' },
            { key: 'ok', text: '创建', bold: true, onClick: handleAdd },
          ],
        ]}
      />
    </div>
  );
};

export default Tokens;
