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
import { Modal, Spin } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, toBoolean } from '../../../../helpers';
import SettingsChannelAffinity from '../../../../pages/Setting/Operation/SettingsChannelAffinity';

const KEY_ENABLED = 'channel_affinity_setting.enabled';
const KEY_MAX_ENTRIES = 'channel_affinity_setting.max_entries';
const KEY_DEFAULT_TTL = 'channel_affinity_setting.default_ttl_seconds';
const KEY_RULES = 'channel_affinity_setting.rules';

const buildOptions = (data) => {
  const options = {
    [KEY_ENABLED]: false,
    [KEY_MAX_ENTRIES]: 100000,
    [KEY_DEFAULT_TTL]: 3600,
    [KEY_RULES]: '[]',
  };

  (data || []).forEach((item) => {
    if (!item?.key) return;
    if (
      ![KEY_ENABLED, KEY_MAX_ENTRIES, KEY_DEFAULT_TTL, KEY_RULES].includes(
        item.key,
      )
    ) {
      return;
    }
    if (item.key === KEY_ENABLED) options[item.key] = toBoolean(item.value);
    else if (item.key === KEY_MAX_ENTRIES)
      options[item.key] = Number(item.value || 0) || 0;
    else if (item.key === KEY_DEFAULT_TTL)
      options[item.key] = Number(item.value || 0) || 0;
    else if (item.key === KEY_RULES) options[item.key] = item.value || '[]';
  });

  return options;
};

const ChannelAffinitySettingModal = ({ visible, onCancel }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState(buildOptions([]));

  const refresh = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/option/');
      const { success, message, data } = res?.data || {};
      if (!success) {
        showError(message || t('获取配置失败'));
        return;
      }
      setOptions(buildOptions(data));
    } catch (e) {
      showError(t('获取配置失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    refresh();
  }, [visible]);

  return (
    <Modal
      title={t('渠道亲和性')}
      visible={visible}
      footer={null}
      onCancel={onCancel}
      width={900}
      style={{ top: 40 }}
    >
      <Spin spinning={loading}>
        <SettingsChannelAffinity options={options} refresh={refresh} />
      </Spin>
    </Modal>
  );
};

export default ChannelAffinitySettingModal;
