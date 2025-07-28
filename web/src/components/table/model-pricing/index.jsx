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
import { Layout, Card, ImagePreview } from '@douyinfe/semi-ui';
import ModelPricingTabs from './ModelPricingTabs.jsx';
import ModelPricingFilters from './ModelPricingFilters.jsx';
import ModelPricingTable from './ModelPricingTable.jsx';
import ModelPricingHeader from './ModelPricingHeader.jsx';
import { useModelPricingData } from '../../../hooks/model-pricing/useModelPricingData.js';

const ModelPricingPage = () => {
  const modelPricingData = useModelPricingData();

  return (
    <div className="bg-gray-50">
      <Layout>
        <Layout.Content>
          <div className="flex justify-center">
            <div className="w-full">
              {/* 主卡片容器 */}
              <Card bordered={false} className="!rounded-2xl shadow-lg border-0">
                {/* 顶部状态卡片 */}
                <ModelPricingHeader {...modelPricingData} />

                {/* 模型分类 Tabs */}
                <div className="mb-6">
                  <ModelPricingTabs {...modelPricingData} />

                  {/* 搜索和表格区域 */}
                  <ModelPricingFilters {...modelPricingData} />
                  <ModelPricingTable {...modelPricingData} />
                </div>

                {/* 倍率说明图预览 */}
                <ImagePreview
                  src={modelPricingData.modalImageUrl}
                  visible={modelPricingData.isModalOpenurl}
                  onVisibleChange={(visible) => modelPricingData.setIsModalOpenurl(visible)}
                />
              </Card>
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default ModelPricingPage; 