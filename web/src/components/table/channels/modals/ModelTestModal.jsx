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
import {
  Modal,
  Button,
  Input,
  Table,
  Tag,
  Typography
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { copy, showError, showInfo, showSuccess } from '../../../../helpers/index.js';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants/index.js';

const ModelTestModal = ({
  showModelTestModal,
  currentTestChannel,
  handleCloseModal,
  isBatchTesting,
  batchTestModels,
  modelSearchKeyword,
  setModelSearchKeyword,
  selectedModelKeys,
  setSelectedModelKeys,
  modelTestResults,
  testingModels,
  testChannel,
  modelTablePage,
  setModelTablePage,
  allSelectingRef,
  isMobile,
  t
}) => {
  const hasChannel = Boolean(currentTestChannel);

  const filteredModels = hasChannel
    ? currentTestChannel.models
      .split(',')
      .filter((model) =>
        model.toLowerCase().includes(modelSearchKeyword.toLowerCase())
      )
    : [];

  const handleCopySelected = () => {
    if (selectedModelKeys.length === 0) {
      showError(t('请先选择模型！'));
      return;
    }
    copy(selectedModelKeys.join(',')).then((ok) => {
      if (ok) {
        showSuccess(t('已复制 ${count} 个模型').replace('${count}', selectedModelKeys.length));
      } else {
        showError(t('复制失败，请手动复制'));
      }
    });
  };

  const handleSelectSuccess = () => {
    if (!currentTestChannel) return;
    const successKeys = currentTestChannel.models
      .split(',')
      .filter((m) => m.toLowerCase().includes(modelSearchKeyword.toLowerCase()))
      .filter((m) => {
        const result = modelTestResults[`${currentTestChannel.id}-${m}`];
        return result && result.success;
      });
    if (successKeys.length === 0) {
      showInfo(t('暂无成功模型'));
    }
    setSelectedModelKeys(successKeys);
  };

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'model',
      render: (text) => (
        <div className="flex items-center">
          <Typography.Text strong>{text}</Typography.Text>
        </div>
      )
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (text, record) => {
        const testResult = modelTestResults[`${currentTestChannel.id}-${record.model}`];
        const isTesting = testingModels.has(record.model);

        if (isTesting) {
          return (
            <Tag color='blue' shape='circle'>
              {t('测试中')}
            </Tag>
          );
        }

        if (!testResult) {
          return (
            <Tag color='grey' shape='circle'>
              {t('未开始')}
            </Tag>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <Tag
              color={testResult.success ? 'green' : 'red'}
              shape='circle'
            >
              {testResult.success ? t('成功') : t('失败')}
            </Tag>
            {testResult.success && (
              <Typography.Text type="tertiary">
                {t('请求时长: ${time}s').replace('${time}', testResult.time.toFixed(2))}
              </Typography.Text>
            )}
          </div>
        );
      }
    },
    {
      title: '',
      dataIndex: 'operate',
      render: (text, record) => {
        const isTesting = testingModels.has(record.model);
        return (
          <Button
            type='tertiary'
            onClick={() => testChannel(currentTestChannel, record.model)}
            loading={isTesting}
            size='small'
          >
            {t('测试')}
          </Button>
        );
      }
    }
  ];

  const dataSource = (() => {
    if (!hasChannel) return [];
    const start = (modelTablePage - 1) * MODEL_TABLE_PAGE_SIZE;
    const end = start + MODEL_TABLE_PAGE_SIZE;
    return filteredModels.slice(start, end).map((model) => ({
      model,
      key: model,
    }));
  })();

  return (
    <Modal
      title={hasChannel ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <Typography.Text strong className="!text-[var(--semi-color-text-0)] !text-base">
              {currentTestChannel.name} {t('渠道的模型测试')}
            </Typography.Text>
            <Typography.Text type="tertiary" size="small">
              {t('共')} {currentTestChannel.models.split(',').length} {t('个模型')}
            </Typography.Text>
          </div>
        </div>
      ) : null}
      visible={showModelTestModal}
      onCancel={handleCloseModal}
      footer={hasChannel ? (
        <div className="flex justify-end">
          {isBatchTesting ? (
            <Button
              type='danger'
              onClick={handleCloseModal}
            >
              {t('停止测试')}
            </Button>
          ) : (
            <Button
              type='tertiary'
              onClick={handleCloseModal}
            >
              {t('取消')}
            </Button>
          )}
          <Button
            onClick={batchTestModels}
            loading={isBatchTesting}
            disabled={isBatchTesting}
          >
            {isBatchTesting ? t('测试中...') : t('批量测试${count}个模型').replace(
              '${count}',
              filteredModels.length
            )}
          </Button>
        </div>
      ) : null}
      maskClosable={!isBatchTesting}
      className="!rounded-lg"
      size={isMobile ? 'full-width' : 'large'}
    >
      {hasChannel && (<div className="model-test-scroll">
        {/* 搜索与操作按钮 */}
        <div className="flex items-center justify-end gap-2 w-full mb-2">
          <Input
            placeholder={t('搜索模型...')}
            value={modelSearchKeyword}
            onChange={(v) => {
              setModelSearchKeyword(v);
              setModelTablePage(1);
            }}
            className="!w-full"
            prefix={<IconSearch />}
            showClear
          />

          <Button onClick={handleCopySelected}>
            {t('复制已选')}
          </Button>

          <Button
            type='tertiary'
            onClick={handleSelectSuccess}
          >
            {t('选择成功')}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          rowSelection={{
            selectedRowKeys: selectedModelKeys,
            onChange: (keys) => {
              if (allSelectingRef.current) {
                allSelectingRef.current = false;
                return;
              }
              setSelectedModelKeys(keys);
            },
            onSelectAll: (checked) => {
              allSelectingRef.current = true;
              setSelectedModelKeys(checked ? filteredModels : []);
            },
          }}
          pagination={{
            currentPage: modelTablePage,
            pageSize: MODEL_TABLE_PAGE_SIZE,
            total: filteredModels.length,
            showSizeChanger: false,
            onPageChange: (page) => setModelTablePage(page),
          }}
        />
      </div>)}
    </Modal>
  );
};

export default ModelTestModal; 