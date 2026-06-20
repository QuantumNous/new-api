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
import { Card, Modal, Tabs, Tag, Typography } from '@douyinfe/semi-ui';
import PromptDebugPanel from './PromptDebugPanel';
import RawDebugPanel from './RawDebugPanel';
import JsonViewer from './JsonViewer';
import {
  finishReasonLabel,
  formatCost,
  formatLatency,
  formatThroughput,
  formatTokens,
} from './utils';

const OverviewCard = ({ label, value, mono }) => (
  <Card bodyStyle={{ padding: 12 }} style={{ borderRadius: 8 }}>
    <Typography.Text type='tertiary' size='small'>
      {label}
    </Typography.Text>
    <div
      style={{
        marginTop: 4,
        fontWeight: 700,
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-word',
      }}
    >
      {value || '--'}
    </div>
  </Card>
);

const CompletionPanel = ({ completion, rawResponse, t }) => {
  if (!completion && !rawResponse) {
    return (
      <Typography.Text type='tertiary'>
        {t('No completion data')}
      </Typography.Text>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}
    >
      {completion && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {completion.finish_reason && (
            <Tag>
              {t('Finish Reason')}:{' '}
              {finishReasonLabel(completion.finish_reason, t)}
            </Tag>
          )}
          {completion.generation_id && (
            <Tag color='blue'>
              {t('Generation ID')}: {completion.generation_id}
            </Tag>
          )}
          {completion.truncated && <Tag color='orange'>{t('Truncated')}</Tag>}
        </div>
      )}
      {completion?.normalized_output && (
        <Card
          title={t('LLM output')}
          bodyStyle={{ padding: 12 }}
          style={{ borderRadius: 8 }}
        >
          <div
            style={{
              maxHeight: 'min(44vh, 440px)',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {completion.normalized_output}
          </div>
        </Card>
      )}
      {completion?.reasoning_output && (
        <Card
          title={t('Reasoning output')}
          bodyStyle={{ padding: 12 }}
          style={{ borderRadius: 8 }}
        >
          <div
            style={{
              maxHeight: 'min(32vh, 320px)',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {completion.reasoning_output}
          </div>
        </Card>
      )}
      {rawResponse && (
        <JsonViewer
          label={t('Raw response')}
          value={rawResponse.value}
          rawMeta={rawResponse}
          t={t}
        />
      )}
    </div>
  );
};

const GenerationDebugModal = ({
  showGenerationDebugModal,
  generationDebugTarget,
  closeGenerationDebugModal,
  isAdminUser,
  t,
}) => {
  const log = generationDebugTarget?.log;
  const other = generationDebugTarget?.other;
  const summary = other?.generation_debug;
  const raw = isAdminUser ? other?.admin_info?.generation_debug_raw : undefined;
  const rawRequest = raw?.upstream_request ?? raw?.inbound_request;
  const rawResponse = raw?.raw_stream ?? raw?.raw_response;
  const provider = log?.channel_name
    ? `${log.channel_name} #${log.channel}`
    : log?.channel
      ? `#${log.channel}`
      : '--';

  return (
    <Modal
      title={t('Generation Debug')}
      visible={showGenerationDebugModal}
      onCancel={closeGenerationDebugModal}
      footer={null}
      width='min(96vw, 1440px)'
      bodyStyle={{ height: 'calc(100vh - 120px)', overflow: 'hidden' }}
    >
      {summary && (
        <div
          style={{
            height: '100%',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingRight: 4,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 8,
            }}
          >
            <OverviewCard
              label={t('Model')}
              value={other?.upstream_model_name || log?.model_name}
              mono
            />
            <OverviewCard label={t('Provider')} value={provider} mono />
            <OverviewCard
              label={t('Request ID')}
              value={summary.request_id || log?.request_id}
              mono
            />
            <OverviewCard
              label={t('Generation ID')}
              value={summary.generation_id}
              mono
            />
            <OverviewCard
              label={t('Finish Reason')}
              value={finishReasonLabel(
                summary.finish_reason || summary.completion?.finish_reason,
                t,
              )}
              mono
            />
            <OverviewCard
              label={t('Streaming')}
              value={summary.streaming ? t('Yes') : t('No')}
            />
            <OverviewCard
              label={t('Cost')}
              value={formatCost(
                summary.provider_cost ?? summary.cost,
                summary.charged_cost,
              )}
            />
            <OverviewCard
              label={t('Tokens')}
              value={`${formatTokens(summary.prompt_tokens)} → ${formatTokens(summary.completion_tokens)}`}
              mono
            />
            <OverviewCard
              label={t('Cached')}
              value={`${formatTokens(summary.cache?.cached_tokens ?? 0)} · ${(
                summary.cache?.cache_hit_rate ?? 0
              ).toLocaleString(undefined, {
                style: 'percent',
                maximumFractionDigits: 1,
              })}`}
            />
            <OverviewCard
              label={t('Provider latency')}
              value={formatLatency(summary.provider_latency_ms)}
            />
            <OverviewCard
              label={t('Throughput')}
              value={formatThroughput(summary.throughput_tokens_per_second)}
            />
          </div>

          <PromptDebugPanel
            prompt={summary.prompt}
            rawRequest={rawRequest}
            providerPromptTokens={summary.prompt_tokens}
            providerCachedTokens={summary.cache?.cached_tokens ?? 0}
            t={t}
          />

          <Tabs type='line' defaultActiveKey='completion'>
            <Tabs.TabPane tab={t('Completion')} itemKey='completion'>
              <CompletionPanel
                completion={summary.completion}
                rawResponse={rawResponse}
                t={t}
              />
            </Tabs.TabPane>
            {isAdminUser && raw && (
              <Tabs.TabPane tab={t('Raw')} itemKey='raw'>
                <RawDebugPanel raw={raw} t={t} />
              </Tabs.TabPane>
            )}
          </Tabs>
        </div>
      )}
    </Modal>
  );
};

export default GenerationDebugModal;
