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
import { Modal, Button, Space, Typography } from '@douyinfe/semi-ui';

const { TextArea, Text } = Typography;

const TokenExportConfigModal = ({
  visible,
  onCancel,
  payload,
  t,
  onCopy,
}) => {
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];

  return (
    <Modal
      title={payload?.display_name ? t('导出 {{name}} 配置', { name: payload.display_name }) : t('导出配置')}
      icon={null}
      visible={visible}
      onCancel={onCancel}
      width={760}
      footer={
        <Space>
          <Button type='tertiary' onClick={onCancel}>
            {t('关闭')}
          </Button>
        </Space>
      }
    >
      <Space vertical align='start' style={{ width: '100%' }} spacing='large'>
        <div style={{ width: '100%' }}>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <Text strong>{t('环境变量脚本')}</Text>
            <Button size='small' type='tertiary' onClick={() => onCopy(payload?.env_script)}>
              {t('复制')}
            </Button>
          </div>
          <TextArea value={payload?.env_script || ''} autosize={{ minRows: 3, maxRows: 8 }} readOnly />
        </div>

        <div style={{ width: '100%' }}>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <Text strong>{t('配置文件路径')}</Text>
            <Button size='small' type='tertiary' onClick={() => onCopy(payload?.config_file)}>
              {t('复制')}
            </Button>
          </div>
          <Text>{payload?.config_file || '-'}</Text>
        </div>

        <div style={{ width: '100%' }}>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <Text strong>{t('配置文件内容')}</Text>
            <Button size='small' type='tertiary' onClick={() => onCopy(payload?.config_content)}>
              {t('复制')}
            </Button>
          </div>
          <TextArea value={payload?.config_content || ''} autosize={{ minRows: 6, maxRows: 16 }} readOnly />
        </div>

        <div style={{ width: '100%' }}>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <Text strong>{t('测试命令')}</Text>
            <Button size='small' type='tertiary' onClick={() => onCopy(payload?.test_command)}>
              {t('复制')}
            </Button>
          </div>
          <TextArea value={payload?.test_command || ''} autosize={{ minRows: 3, maxRows: 10 }} readOnly />
        </div>

        <div style={{ width: '100%' }}>
          <Text strong>{t('说明')}</Text>
          <ul className='mt-2 pl-5'>
            {notes.length > 0 ? (
              notes.map((note, index) => <li key={`${payload?.tool || 'tool'}-${index}`}>{note}</li>)
            ) : (
              <li>{t('暂无说明')}</li>
            )}
          </ul>
        </div>
      </Space>
    </Modal>
  );
};

export default TokenExportConfigModal;
