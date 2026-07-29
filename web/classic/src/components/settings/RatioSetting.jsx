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
import { Card, Spin, Switch, Tabs } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

import ModelPricingEditor from '../../pages/Setting/Ratio/components/ModelPricingEditor';
import GroupRatioSettings from '../../pages/Setting/Ratio/GroupRatioSettings';
import UpstreamRatioSync from '../../pages/Setting/Ratio/UpstreamRatioSync';
import ToolPriceSettings from '../../pages/Setting/Ratio/ToolPriceSettings';

import { API, showError, showSuccess, toBoolean } from '../../helpers';

const RatioSetting = () => {
  const { t } = useTranslation();

  let [inputs, setInputs] = useState({
    ModelPrice: '',
    ModelRatio: '',
    CacheRatio: '',
    CreateCacheRatio: '',
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
    'group_ratio_setting.group_special_usable_group': '',
  });
  const [pricingModelNames, setPricingModelNames] = useState([]);
  const [pricingRevision, setPricingRevision] = useState(0);

  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const [res, pricingRes] = await Promise.all([
      API.get('/api/option/'),
      API.get('/api/admin/pricing/models'),
    ]);
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.value.startsWith('{') || item.value.startsWith('[')) {
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
    if (pricingRes.data.success) {
      const pricingData = pricingRes.data.data;
      const pricingMaps = {
        ModelPrice: {},
        ModelRatio: {},
        CompletionRatio: {},
        CacheRatio: {},
        CreateCacheRatio: {},
        ImageRatio: {},
        AudioRatio: {},
        AudioCompletionRatio: {},
        CompletionRatioMeta: {},
        'billing_setting.billing_mode': {},
        'billing_setting.billing_expr': {},
      };
      const fieldMap = {
        model_price: 'ModelPrice',
        model_ratio: 'ModelRatio',
        completion_ratio: 'CompletionRatio',
        cache_ratio: 'CacheRatio',
        create_cache_ratio: 'CreateCacheRatio',
        image_ratio: 'ImageRatio',
        audio_ratio: 'AudioRatio',
        audio_completion_ratio: 'AudioCompletionRatio',
      };
      (pricingData.models || []).forEach((model) => {
        Object.entries(fieldMap).forEach(([field, optionKey]) => {
          if (model.pricing[field] !== undefined) {
            pricingMaps[optionKey][model.model_name] = model.pricing[field];
          }
        });
        pricingMaps.CompletionRatioMeta[model.model_name] = {
          locked: model.completion_ratio_locked,
          ratio: model.pricing.completion_ratio,
        };
        if (model.pricing.mode === 'tiered_expr') {
          pricingMaps['billing_setting.billing_mode'][model.model_name] =
            'tiered_expr';
        }
        if (model.pricing.billing_expr !== undefined) {
          pricingMaps['billing_setting.billing_expr'][model.model_name] =
            model.pricing.billing_expr;
        }
      });
      setInputs((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(pricingMaps).map(([key, value]) => [
            key,
            JSON.stringify(value, null, 2),
          ]),
        ),
      }));
      setPricingRevision(pricingData.revision || 0);
      setPricingModelNames(
        (pricingData.models || []).map((model) => model.model_name),
      );
    } else {
      showError(pricingRes.data.message);
    }
  };

  const updateExposeRatio = async (checked) => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'ExposeRatioEnabled',
        value: String(checked),
      });
      if (!res.data.success) {
        showError(res.data.message);
        return;
      }
      setInputs((current) => ({
        ...current,
        ExposeRatioEnabled: checked,
      }));
      showSuccess(t('保存成功'));
    } catch (error) {
      showError(error.message || t('保存失败'));
    } finally {
      setLoading(false);
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
      <Card style={{ marginTop: '10px' }}>
        <div className='mb-4 flex items-center justify-end gap-2'>
          <span>{t('暴露倍率接口')}</span>
          <Switch
            checked={inputs.ExposeRatioEnabled}
            onChange={updateExposeRatio}
          />
        </div>
        <Tabs type='card' defaultActiveKey='pricing'>
          <Tabs.TabPane tab={t('模型定价设置')} itemKey='pricing'>
            <ModelPricingEditor
              options={inputs}
              refresh={onRefresh}
              candidateModelNames={pricingModelNames}
              pricingRevision={pricingRevision}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('分组相关设置')} itemKey='group'>
            <GroupRatioSettings options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('上游价格同步')} itemKey='upstream_sync'>
            <UpstreamRatioSync options={inputs} refresh={onRefresh} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('工具调用定价')} itemKey='tool_price'>
            <ToolPriceSettings options={inputs} />
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </Spin>
  );
};

export default RatioSetting;
