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
import { Button, ButtonGroup } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import ModelPricingEditor from './components/ModelPricingEditor';
import ModelRatioSettings from './ModelRatioSettings';

export default function ModelPricingCombined({ options, refresh }) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState('visual');

  return (
    <div>
      <div className='mb-4 mt-3'>
        <ButtonGroup size='sm' variant='outline'>
          <Button
            variant={editMode === 'visual' ? 'primary' : 'outline'}
            onPress={() => setEditMode('visual')}
          >
            {t('可视化编辑')}
          </Button>
          <Button
            variant={editMode === 'manual' ? 'primary' : 'outline'}
            onPress={() => setEditMode('manual')}
          >
            {t('手动编辑')}
          </Button>
        </ButtonGroup>
      </div>
      {editMode === 'visual' ? (
        <ModelPricingEditor options={options} refresh={refresh} />
      ) : (
        <ModelRatioSettings options={options} refresh={refresh} />
      )}
    </div>
  );
}
