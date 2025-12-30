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

import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Banner,
  Typography,
  Space,
  Toast,
  Input,
  Switch,
} from '@douyinfe/semi-ui';
import { Network } from 'lucide-react';
import { API } from '../../helpers';

const { Title, Text, Paragraph } = Typography;

const AnyRouterSetting = () => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [tokens, setTokens] = useState([]);
  // 使用 state 存储每个令牌的配置
  const [tokenConfigs, setTokenConfigs] = useState({});

  // 加载用户令牌列表
  const loadTokens = async () => {
    try {
      setLoadingData(true);
      const res = await API.get('/api/token/');
      const { success, data, message } = res.data;
      console.log('API 返回的原始数据:', res.data);
      console.log('第一个 token 的 AnyRouter 字段:', data?.items?.[0]?.anyrouter_token, data?.items?.[0]?.anyrouter_enabled);
      if (success && data && data.items) {
        // 确保 anyrouter_token 不是 null
        const processedTokens = data.items.map((token) => ({
          ...token,
          anyrouter_token: token.anyrouter_token || '',
          anyrouter_enabled: token.anyrouter_enabled || false,
        }));
        setTokens(processedTokens);

        // 初始化 tokenConfigs
        const configs = {};
        processedTokens.forEach((token) => {
          configs[token.id] = {
            anyrouter_token: token.anyrouter_token || '',
            anyrouter_enabled: token.anyrouter_enabled || false,
          };
        });
        console.log('初始化的 tokenConfigs:', configs);
        setTokenConfigs(configs);
      } else {
        Toast.error(message || '加载令牌列表失败');
        setTokens([]);
      }
    } catch (error) {
      console.error('加载令牌列表错误:', error);
      Toast.error('加载令牌列表失败: ' + (error.message || '未知错误'));
      setTokens([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  // 更新配置
  const updateTokenConfig = (tokenId, field, value) => {
    setTokenConfigs((prev) => ({
      ...prev,
      [tokenId]: {
        ...prev[tokenId],
        [field]: value,
      },
    }));
  };

  // 保存 AnyRouter 设置
  const handleSave = async (tokenId) => {
    try {
      setLoading(true);

      const token = tokens.find((t) => t.id === tokenId);

      if (!token) {
        Toast.error('找不到对应的令牌');
        return;
      }

      const config = tokenConfigs[tokenId] || {};
      const anyrouterToken = config.anyrouter_token || '';
      const anyrouterEnabled = config.anyrouter_enabled || false;

      console.log('Saving AnyRouter config:', {
        tokenId,
        anyrouterToken: anyrouterToken ? anyrouterToken.substring(0, 10) + '...' : '(empty)',
        anyrouterEnabled,
      });

      const updateData = {
        ...token,
        anyrouter_token: anyrouterToken === '' ? null : anyrouterToken,
        anyrouter_enabled: anyrouterEnabled,
      };

      console.log('Update data:', {
        id: updateData.id,
        name: updateData.name,
        anyrouter_token: updateData.anyrouter_token ? '***' : null,
        anyrouter_enabled: updateData.anyrouter_enabled,
      });

      const res = await API.put('/api/token/', updateData);
      console.log('API response:', res.data);

      const { success, message } = res.data;

      if (success) {
        Toast.success('保存成功');
        await loadTokens();
      } else {
        Toast.error(message || '保存失败');
        console.error('Save failed:', message);
      }
    } catch (error) {
      console.error('保存失败详情:', error);
      console.error('Error response:', error.response?.data);
      Toast.error('保存失败: ' + (error.response?.data?.message || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mt-[60px] px-2'>
      <Card className='max-w-5xl mx-auto'>
        <div className='flex items-center gap-3 mb-6'>
          <Network size={32} strokeWidth={2} />
          <div>
            <Title heading={3}>AnyRouter 反代优选（暂不可用）</Title>
            <Text type='secondary'>
              将您的令牌绑定到 AnyRouter，自动过滤非必要请求
            </Text>
          </div>
        </div>

        <Paragraph className='mb-6'>
          <Text strong>什么是 AnyRouter 反代优选？</Text>
          <br />
          <Text>
            AnyRouter 反代优选功能允许您绑定 AnyRouter 令牌到您的 New API 令牌。启用后：
          </Text>
          <br />
          <ul className='list-disc pl-5 space-y-1 mt-2'>
            <li>自动过滤 Claude Code 的 count_tokens 等非必要请求</li>
            <li>仅转发真正的流式聊天请求到 AnyRouter</li>
            <li>减少请求数量，避免触发上游限流（520 错误）</li>
            <li>无需手动设置环境变量</li>
          </ul>
          <br />
          <Text strong>使用方法：</Text>
          <br />
          <ul className='list-disc pl-5 space-y-1 mt-2'>
            <li>在下方输入您的 AnyRouter 令牌</li>
            <li>勾选"启用"开关</li>
            <li>点击"保存"</li>
          </ul>
          <br />
          <Text strong>在 Claude Code 中配置：</Text>
          <br />
          <ul className='list-disc pl-5 space-y-1 mt-2'>
            <li>ANTHROPIC_AUTH_TOKEN: 您的 New API 令牌（如 sk-xxx）</li>
            <li>ANTHROPIC_BASE_URL: http://cifang.xyz</li>
          </ul>
        </Paragraph>

        {loadingData ? (
          <div className='text-center py-8'>
            <Text type='tertiary'>加载中...</Text>
          </div>
        ) : tokens.length === 0 ? (
          <Banner
            type='warning'
            description='您还没有创建任何令牌，请先在"令牌管理"页面创建令牌'
          />
        ) : (
          <Space vertical align='start' spacing='loose' className='w-full'>
            {tokens && tokens.length > 0 && tokens.map((token) => {
              if (!token || !token.id) return null;

              // 优先使用 tokenConfigs，如果不存在则使用 token 自己的值
              let currentAnyrouterToken = '';
              let currentAnyrouterEnabled = false;

              if (tokenConfigs[token.id]) {
                currentAnyrouterToken = tokenConfigs[token.id].anyrouter_token || '';
                currentAnyrouterEnabled = tokenConfigs[token.id].anyrouter_enabled || false;
              } else {
                // 如果 tokenConfigs 还没初始化，直接用 token 的值
                currentAnyrouterToken = token.anyrouter_token || '';
                currentAnyrouterEnabled = token.anyrouter_enabled || false;
              }

              console.log(`渲染 Token ID=${token.id}, 当前值: token=${currentAnyrouterToken}, enabled=${currentAnyrouterEnabled}`);

              return (
                <Card
                  key={token.id}
                  className='w-full'
                  bodyStyle={{ padding: '20px' }}
                >
                  <div className='flex justify-between items-start mb-4'>
                    <div>
                      <Text strong className='text-lg'>
                        {token.name || '未命名令牌'}
                      </Text>
                      <br />
                      <Text type='tertiary' size='small'>
                        令牌 ID: {token.id}
                      </Text>
                    </div>
                  </div>

                  <div className='space-y-4'>
                    <div className='flex items-center gap-4'>
                      <div style={{ width: '150px', flexShrink: 0 }}>
                        <Text strong>AnyRouter 令牌</Text>
                      </div>
                      <Input
                        placeholder='sk-xxxxxx'
                        value={currentAnyrouterToken}
                        onChange={(value) => updateTokenConfig(token.id, 'anyrouter_token', value)}
                        style={{ flex: 1 }}
                      />
                    </div>

                    <div className='flex items-center gap-4'>
                      <div style={{ width: '150px', flexShrink: 0 }}>
                        <Text strong>启用 AnyRouter</Text>
                      </div>
                      <Switch
                        checked={currentAnyrouterEnabled}
                        onChange={(checked) => updateTokenConfig(token.id, 'anyrouter_enabled', checked)}
                      />
                    </div>
                  </div>

                  <div className='mt-4 flex justify-end'>
                    <Button
                      theme='solid'
                      type='primary'
                      loading={loading}
                      onClick={() => handleSave(token.id)}
                    >
                      保存
                    </Button>
                  </div>
                </Card>
              );
            })}
          </Space>
        )}
      </Card>
    </div>
  );
};

export default AnyRouterSetting;
