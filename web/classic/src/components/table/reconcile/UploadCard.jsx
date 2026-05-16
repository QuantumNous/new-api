import React, { useRef } from 'react';
import { Button, Select, Typography } from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function UploadCard({
  channels,
  selectedChannelIds,
  setSelectedChannelIds,
  file,
  setFile,
  granularity,
  setGranularity,
  uploading,
  onSubmit,
  onReset,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  const channelOptions = (channels || []).map((c) => ({
    label: `${c.id} - ${c.name}`,
    value: c.id,
  }));

  const granularityOptions = [
    { label: t('按小时（精细，适合 ≤ 万级请求/天）'), value: 'hour' },
    { label: t('按日（高吞吐推荐，桶数 ÷ 24）'), value: 'day' },
  ];

  return (
    <div className='flex flex-col gap-3'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-3 items-end'>
        <div>
          <div className='mb-1'>
            <Text size='small' type='tertiary'>
              {t('对账渠道（多选）')}
            </Text>
          </div>
          <Select
            placeholder={t('请选择需要对账的渠道')}
            optionList={channelOptions}
            value={selectedChannelIds}
            onChange={setSelectedChannelIds}
            multiple
            maxTagCount={4}
            filter
            showClear
            className='w-full'
            size='small'
          />
        </div>

        <div>
          <div className='mb-1'>
            <Text size='small' type='tertiary'>
              {t('供应商账单文件（xlsx）')}
            </Text>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              icon={<IconUpload />}
              onClick={() => inputRef.current?.click()}
              size='small'
            >
              {t('选择文件')}
            </Button>
            <Text type='secondary' size='small' className='truncate'>
              {file ? file.name : t('未选择文件')}
            </Text>
            <input
              ref={inputRef}
              type='file'
              accept='.xlsx,.csv'
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div>
          <div className='mb-1'>
            <Text size='small' type='tertiary'>
              {t('对账粒度')}
            </Text>
          </div>
          <Select
            value={granularity}
            onChange={setGranularity}
            optionList={granularityOptions}
            className='w-full'
            size='small'
          />
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <Button
          theme='solid'
          type='primary'
          onClick={onSubmit}
          loading={uploading}
          disabled={!file || !selectedChannelIds?.length}
        >
          {t('开始对账')}
        </Button>
        <Button onClick={onReset} disabled={uploading}>
          {t('清空')}
        </Button>
        <Text type='tertiary' size='small'>
          {t(
            '上传后系统从我方日志按 (模型, 小时) 实时聚合并与账单对比，结果不入库。',
          )}
        </Text>
      </div>
    </div>
  );
}
