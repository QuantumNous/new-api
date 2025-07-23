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
import { Card, Spin, Tabs } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

import GroupRatioSettings from '../../pages/Setting/Ratio/GroupRatioSettings.js';
import ModelRatioSettings from '../../pages/Setting/Ratio/ModelRatioSettings.js';
import ModelSettingsVisualEditor from '../../pages/Setting/Ratio/ModelSettingsVisualEditor.js';
import ModelRatioNotSetEditor from '../../pages/Setting/Ratio/ModelRationNotSetEditor.js';
import UpstreamRatioSync from '../../pages/Setting/Ratio/UpstreamRatioSync.js';

import { API, showError, toBoolean } from '../../helpers';

const RatioSetting = () => {
  const { t } = useTranslation();

  let [inputs, setInputs] = useState({
    ModelPrice: '',
    ModelRatio: '',
    CacheRatio: '',
    CompletionRatio: '',
    GroupRatio: '',
    GroupGroupRatio: '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
    ExposeRatioEnabled: false,
    UserUsableGroups: '',
  });

  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (
          item.key === 'ModelRatio' ||
          item.key === 'GroupRatio' ||
          item.key === 'GroupGroupRatio' ||
          item.key === 'AutoGroups' ||
          item.key === 'UserUsableGroups' ||
          item.key === 'CompletionRatio' ||
          item.key === 'ModelPrice' ||
          item.key === 'CacheRatio'
        ) {
          try {
            item.value = JSON.stringify(JSON.parse(item.value), null, 2);
          } catch (e) {
            // 如果后端返回的不是合法 JSON，直接展示
          }
        }
        if (['DefaultUseAutoGroup', 'ExposeRatioEnabled'].includes(item.key)) {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  const onRefresh = async () => {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Spin spinning={loading} size='large'>
      {/* 模型倍率设置以及可视化编辑器 */}
      <Card style={{ marginTop: '10px' }}>
        <Tabs type='card'>
          <Tabs.TabPane tab={t('模型倍率设置')} itemKey='model'>
            <ModelRatioSettings
              options={inputs}
              refresh={onRefresh}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('分组倍率设置')} itemKey='group'>
            <GroupRatioSettings
              options={inputs}
              refresh={onRefresh}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('可视化倍率设置')} itemKey='visual'>
            <ModelSettingsVisualEditor
              options={inputs}
              refresh={onRefresh}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('未设置倍率模型')} itemKey='unset_models'>
            <ModelRatioNotSetEditor
              options={inputs}
              refresh={onRefresh}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('上游倍率同步')} itemKey='upstream_sync'>
            <UpstreamRatioSync
              options={inputs}
              refresh={onRefresh}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </Spin>
  );
};

export default RatioSetting; 