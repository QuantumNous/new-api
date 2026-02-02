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

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Descriptions, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showError, timestamp2string } from '../../../../helpers';

const { Text } = Typography;

function formatRate(hit, total) {
  if (!total || total <= 0) return '-';
  const r = (Number(hit || 0) / Number(total || 0)) * 100;
  if (!Number.isFinite(r)) return '-';
  return `${r.toFixed(2)}%`;
}

function formatTokenRate(n, d) {
  const nn = Number(n || 0);
  const dd = Number(d || 0);
  if (!dd || dd <= 0) return '-';
  const r = (nn / dd) * 100;
  if (!Number.isFinite(r)) return '-';
  return `${r.toFixed(2)}%`;
}

const ChannelAffinityUsageCacheModal = ({
  t,
  showChannelAffinityUsageCacheModal,
  setShowChannelAffinityUsageCacheModal,
  channelAffinityUsageCacheTarget,
}) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const params = useMemo(() => {
    const x = channelAffinityUsageCacheTarget || {};
    return {
      rule_name: (x.rule_name || '').trim(),
      using_group: (x.using_group || '').trim(),
      key_hint: (x.key_hint || '').trim(),
      key_fp: (x.key_fp || '').trim(),
    };
  }, [channelAffinityUsageCacheTarget]);

  useEffect(() => {
    const shouldFetch =
      showChannelAffinityUsageCacheModal &&
      params.rule_name &&
      params.key_fp &&
      !loading;
    if (!shouldFetch) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await API.get('/api/log/channel_affinity_usage_cache', {
          params,
          disableDuplicate: true,
        });
        const { success, message, data } = res.data || {};
        if (!success) {
          showError(t(message || '请求失败'));
          return;
        }
        if (!cancelled) setStats(data || {});
      } catch (e) {
        showError(t('请求失败'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showChannelAffinityUsageCacheModal, params, loading, t]);

  const rows = useMemo(() => {
    const s = stats || {};
    const hit = Number(s.hit || 0);
    const total = Number(s.total || 0);
    const windowSeconds = Number(s.window_seconds || 0);
    const lastSeenAt = Number(s.last_seen_at || 0);
    const promptTokens = Number(s.prompt_tokens || 0);
    const completionTokens = Number(s.completion_tokens || 0);
    const totalTokens = Number(s.total_tokens || 0);
    const cachedTokens = Number(s.cached_tokens || 0);
    const promptCacheHitTokens = Number(s.prompt_cache_hit_tokens || 0);

    return [
      { key: t('规则'), value: s.rule_name || params.rule_name || '-' },
      { key: t('分组'), value: s.using_group || params.using_group || '-' },
      {
        key: t('Key 摘要'),
        value: params.key_hint || '-',
      },
      {
        key: t('Key 指纹'),
        value: s.key_fp || params.key_fp || '-',
      },
      { key: t('TTL（秒）'), value: windowSeconds > 0 ? windowSeconds : '-' },
      {
        key: t('命中率'),
        value: `${hit}/${total} (${formatRate(hit, total)})`,
      },
      {
        key: t('Prompt tokens'),
        value: promptTokens,
      },
      {
        key: t('Cached tokens'),
        value: `${cachedTokens} (${formatTokenRate(cachedTokens, promptTokens)})`,
      },
      {
        key: t('Prompt cache hit tokens'),
        value: promptCacheHitTokens,
      },
      {
        key: t('Completion tokens'),
        value: completionTokens,
      },
      {
        key: t('Total tokens'),
        value: totalTokens,
      },
      {
        key: t('最近一次'),
        value: lastSeenAt > 0 ? timestamp2string(lastSeenAt) : '-',
      },
    ];
  }, [stats, params, t]);

  return (
    <Modal
      title={t('渠道亲和性：上游缓存命中')}
      visible={showChannelAffinityUsageCacheModal}
      onCancel={() => setShowChannelAffinityUsageCacheModal(false)}
      footer={null}
      centered
      closable
      maskClosable
      width={640}
    >
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text type='tertiary' size='small'>
            {t('命中判定：usage 中存在 cached tokens（例如 cached_tokens/prompt_cache_hit_tokens）即视为命中。')}
          </Text>
        </div>
        <Spin spinning={loading}>
          <Descriptions data={rows} />
        </Spin>
      </div>
    </Modal>
  );
};

export default ChannelAffinityUsageCacheModal;
