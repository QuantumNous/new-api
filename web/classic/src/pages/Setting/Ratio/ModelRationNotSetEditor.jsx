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
import { API, showError } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import ModelPricingEditor from './components/ModelPricingEditor';

export default function ModelRatioNotSetEditor(props) {
  const { t } = useTranslation();
  const [enabledModels, setEnabledModels] = useState([]);

  const getAllEnabledModels = async () => {
    try {
      const res = await API.get('/api/channel/models_enabled');
      const { success, message, data } = res.data;
      if (success) {
        setEnabledModels(data);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error(t('获取启用模型失败:'), error);
      showError(t('获取启用模型失败'));
    }
  };

  useEffect(() => {
    // 获取所有启用的模型
    getAllEnabledModels();
  }, []);
  return (
    <ModelPricingEditor
      options={props.options}
      refresh={props.refresh}
      candidateModelNames={enabledModels}
      filterMode='unset'
      allowAddModel={false}
      allowDeleteModel={false}
      showConflictFilter={false}
      listDescription={t(
        '此页面仅显示未设置价格或基础倍率的模型，设置后会自动从列表中移出',
      )}
      emptyTitle={t('没有未设置定价的模型')}
      emptyDescription={t('当前没有未设置定价的模型')}
    />
  );
}
