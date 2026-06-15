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

import React, { useState } from 'react';
import { Banner, Radio, RadioGroup } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import ModelPricingEditor from './components/ModelPricingEditor';
import ModelRatioSettings from './ModelRatioSettings';

export default function ModelPricingCombined({ options, refresh }) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState('visual');

  return (
    <div>
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <RadioGroup
          type='button'
          size='small'
          value={editMode}
          onChange={(e) => setEditMode(e.target.value)}
        >
          <Radio value='visual'>{t('可视化编辑')}</Radio>
          <Radio value='manual'>{t('倍率（高级）')}</Radio>
        </RadioGroup>
      </div>
      {editMode === 'visual' ? (
        <ModelPricingEditor options={options} refresh={refresh} />
      ) : (
        <>
          <Banner
            type='warning'
            bordered
            fullMode={false}
            closeIcon={null}
            style={{ marginBottom: 16 }}
            description={t(
              '高级模式：此处编辑的是后端原始倍率（无量纲系数）与美元按次价（ModelPrice），与上方「可视化编辑」的人民币口径不同，请勿混用。不熟悉倍率的话建议使用可视化编辑。',
            )}
          />
          <ModelRatioSettings options={options} refresh={refresh} />
        </>
      )}
    </div>
  );
}
