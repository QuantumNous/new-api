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

import GroupRatioSettings from '../../pages/Setting/Ratio/GroupRatioSettings';
import ModelRatioSettings from '../../pages/Setting/Ratio/ModelRatioSettings';
import ModelSettingsVisualEditor from '../../pages/Setting/Ratio/ModelSettingsVisualEditor';
import ModelRatioNotSetEditor from '../../pages/Setting/Ratio/ModelRationNotSetEditor';
import UpstreamRatioSync from '../../pages/Setting/Ratio/UpstreamRatioSync';

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
    ImageRatio: '',
    AudioRatio: '',
    AudioCompletionRatio: '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
    ExposeRatioEnabled: false,
    UserUsableGroups: '',
  });

  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    try {
      // 分别获取分组数据和其他配置数据
      const [optionsRes, groupOptionsRes] = await Promise.all([
        API.get('/api/option/'),
        API.get('/api/user_group/options')
      ]);

      let newInputs = {};

      // 处理普通配置数据
      if (optionsRes.data.success) {
        optionsRes.data.data.forEach((item) => {
          // 跳过分组相关的配置，这些将从UserGroup API获取
          if (['GroupRatio', 'UserUsableGroups'].includes(item.key)) {
            return;
          }

          if (
            item.key === 'ModelRatio' ||
            item.key === 'GroupGroupRatio' ||
            item.key === 'AutoGroups' ||
            item.key === 'CompletionRatio' ||
            item.key === 'ModelPrice' ||
            item.key === 'CacheRatio' ||
            item.key === 'ImageRatio' ||
            item.key === 'AudioRatio' ||
            item.key === 'AudioCompletionRatio'
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
      }

      // 处理分组数据
      if (groupOptionsRes.data.success) {
        const groupData = groupOptionsRes.data.data;
        // 格式化分组数据为JSON字符串
        if (groupData.GroupRatio) {
          try {
            newInputs.GroupRatio = JSON.stringify(JSON.parse(groupData.GroupRatio), null, 2);
          } catch (e) {
            newInputs.GroupRatio = groupData.GroupRatio;
          }
        }
        if (groupData.UserUsableGroups) {
          try {
            newInputs.UserUsableGroups = JSON.stringify(JSON.parse(groupData.UserUsableGroups), null, 2);
          } catch (e) {
            newInputs.UserUsableGroups = groupData.UserUsableGroups;
          }
        }
      }

      setInputs(newInputs);
    } catch (error) {
      showError('获取配置数据失败');
      console.error('获取配置数据失败:', error);
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
            <ModelRatioSettings options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('分组倍率设置')} itemKey='group'>
            <GroupRatioSettings options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('可视化倍率设置')} itemKey='visual'>
            <ModelSettingsVisualEditor options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('未设置倍率模型')} itemKey='unset_models'>
            <ModelRatioNotSetEditor options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('上游倍率同步')} itemKey='upstream_sync'>
            <UpstreamRatioSync options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </Spin>
  );
};

export default RatioSetting;
