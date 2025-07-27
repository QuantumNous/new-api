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
import { Card } from '@douyinfe/semi-ui';
import { IconVerify, IconLayers, IconInfoCircle } from '@douyinfe/semi-icons';
import { AlertCircle } from 'lucide-react';

const ModelPricingHeader = ({
  userState,
  groupRatio,
  selectedGroup,
  models,
  t
}) => {
  return (
    <Card
      className="!rounded-2xl !border-0 !shadow-md overflow-hidden mb-6"
      style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 25%, #a855f7 50%, #c084fc 75%, #d8b4fe 100%)',
        position: 'relative'
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div className="relative p-6 sm:p-8" style={{ color: 'white' }}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
          <div className="flex items-start">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 flex items-center justify-center mr-3 sm:mr-4">
              <IconLayers size="extra-large" className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">
                {t('模型定价')}
              </div>
              <div className="text-sm text-white/80">
                {userState.user ? (
                  <div className="flex items-center">
                    <IconVerify className="mr-1.5 flex-shrink-0" size="small" />
                    <span className="truncate">
                      {t('当前分组')}: {userState.user.group}，{t('倍率')}: {groupRatio[userState.user.group]}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
                    <span className="truncate">
                      {t('未登录，使用默认分组倍率：')}{groupRatio['default']}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-2 lg:mt-0">
            <div
              className="text-center px-2 py-2 sm:px-3 sm:py-2.5 bg-white/10 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-colors duration-200"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <div className="text-xs text-white/70 mb-0.5">{t('分组倍率')}</div>
              <div className="text-sm sm:text-base font-semibold">{groupRatio[selectedGroup] || '1.0'}x</div>
            </div>
            <div
              className="text-center px-2 py-2 sm:px-3 sm:py-2.5 bg-white/10 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-colors duration-200"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <div className="text-xs text-white/70 mb-0.5">{t('可用模型')}</div>
              <div className="text-sm sm:text-base font-semibold">
                {models.filter(m => m.enable_groups.includes(selectedGroup)).length}
              </div>
            </div>
            <div
              className="text-center px-2 py-2 sm:px-3 sm:py-2.5 bg-white/10 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-colors duration-200"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <div className="text-xs text-white/70 mb-0.5">{t('计费类型')}</div>
              <div className="text-sm sm:text-base font-semibold">2</div>
            </div>
          </div>
        </div>

        {/* 计费说明 */}
        <div className="mt-4 sm:mt-5">
          <div className="flex items-start">
            <div
              className="w-full flex items-start space-x-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                backdropFilter: 'blur(10px)'
              }}
            >
              <IconInfoCircle className="flex-shrink-0 mt-0.5" size="small" />
              <span>
                {t('按量计费费用 = 分组倍率 × 模型倍率 × （提示token数 + 补全token数 × 补全倍率）/ 500000 （单位：美元）')}
              </span>
            </div>
          </div>
        </div>

        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400" style={{ opacity: 0.6 }}></div>
      </div>
    </Card>
  );
};

export default ModelPricingHeader; 