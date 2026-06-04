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

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Banner,
  Space,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { showError } from '../../../../helpers';

const { Text } = Typography;

const parseKeyInput = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set();
  const keys = [];

  lines.forEach((line) => {
    if (seen.has(line)) return;
    seen.add(line);
    keys.push(line);
  });

  return {
    keys,
    totalInput: lines.length,
    duplicateCount: lines.length - keys.length,
  };
};

const BatchKeyQueryModal = ({ visible, onCancel, onApply, loading }) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');

  const parsed = useMemo(() => parseKeyInput(inputText), [inputText]);
  const canSubmit = parsed.keys.length > 0 && !loading;

  const resetAndCancel = () => {
    if (loading) return;
    setInputText('');
    onCancel();
  };

  const handleApply = async () => {
    if (parsed.keys.length === 0) {
      showError(t('请输入密钥'));
      return;
    }
    try {
      const success = await onApply(parsed);
      if (success === false) return;
      setInputText('');
      onCancel();
    } catch (error) {
      showError(
        error?.response?.data?.message || error?.message || t('网络错误'),
      );
    }
  };

  return (
    <Modal
      title={
        <span>
          <IconSearch style={{ marginRight: 8 }} />
          {t('批量密钥查询')}
        </span>
      }
      visible={visible}
      onCancel={resetAndCancel}
      maskClosable={!loading}
      closable={!loading}
      width='min(1080px, 92vw)'
      footer={
        <Space>
          <Button onClick={resetAndCancel} disabled={loading}>
            {t('取消')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            onClick={handleApply}
            disabled={!canSubmit}
            loading={loading}
          >
            {t('开始查询')}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Banner
          type='info'
          description={t('解析后将移除空行和重复密钥，仅按精确密钥匹配渠道。')}
        />
        <div>
          <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
            {t('粘贴密钥，每行一个')}
          </div>
          <TextArea
            value={inputText}
            onChange={setInputText}
            disabled={loading}
            placeholder={`sk-xxxx\nsk-yyyy\nsk-zzzz`}
            autosize={{ minRows: 12, maxRows: 20 }}
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: '20px',
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}
            wrap='off'
          />
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Text strong>{t('解析结果')}</Text>
          <Tag color={parsed.keys.length > 0 ? 'green' : 'grey'}>
            {t(
              '共 {{total}} 行，{{unique}} 个唯一密钥，已移除 {{duplicates}} 个重复项',
            )
              .replace('{{total}}', parsed.totalInput)
              .replace('{{unique}}', parsed.keys.length)
              .replace('{{duplicates}}', parsed.duplicateCount)}
          </Tag>
        </div>
      </div>
    </Modal>
  );
};

export default BatchKeyQueryModal;
