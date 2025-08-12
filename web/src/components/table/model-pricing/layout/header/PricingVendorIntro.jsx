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

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Tag, Avatar, AvatarGroup, Typography } from '@douyinfe/semi-ui';
import { getLobeHubIcon } from '../../../../../helpers';

const { Paragraph } = Typography;

const PricingVendorIntro = ({
  filterVendor,
  models = [],
  allModels = [],
  t
}) => {
  // 轮播动效状态（只对全部供应商生效）
  const [currentOffset, setCurrentOffset] = useState(0);

  // 获取所有供应商信息
  const vendorInfo = useMemo(() => {
    const vendors = new Map();
    let unknownCount = 0;

    (allModels.length > 0 ? allModels : models).forEach(model => {
      if (model.vendor_name) {
        if (!vendors.has(model.vendor_name)) {
          vendors.set(model.vendor_name, {
            name: model.vendor_name,
            icon: model.vendor_icon,
            description: model.vendor_description,
            count: 0
          });
        }
        vendors.get(model.vendor_name).count++;
      } else {
        unknownCount++;
      }
    });

    const vendorList = Array.from(vendors.values()).sort((a, b) => a.name.localeCompare(b.name));

    if (unknownCount > 0) {
      vendorList.push({
        name: 'unknown',
        icon: null,
        description: t('包含来自未知或未标明供应商的AI模型，这些模型可能来自小型供应商或开源项目。'),
        count: unknownCount
      });
    }

    return vendorList;
  }, [allModels, models]);

  // 计算当前过滤器的模型数量
  const currentModelCount = models.length;

  // 设置轮播定时器（只对全部供应商且有足够头像时生效）
  useEffect(() => {
    if (filterVendor !== 'all' || vendorInfo.length <= 3) {
      setCurrentOffset(0); // 重置偏移
      return;
    }

    const interval = setInterval(() => {
      setCurrentOffset(prev => (prev + 1) % vendorInfo.length);
    }, 2000); // 每2秒切换一次

    return () => clearInterval(interval);
  }, [filterVendor, vendorInfo.length]);

  // 获取供应商描述信息（从后端数据中）
  const getVendorDescription = (vendorKey) => {
    if (vendorKey === 'all') {
      return t('查看所有可用的AI模型供应商，包括众多知名供应商的模型。');
    }
    if (vendorKey === 'unknown') {
      return t('包含来自未知或未标明供应商的AI模型，这些模型可能来自小型供应商或开源项目。');
    }
    const vendor = vendorInfo.find(v => v.name === vendorKey);
    return vendor?.description || t('该供应商提供多种AI模型，适用于不同的应用场景。');
  };

  // 为全部供应商创建特殊的头像组合
  const renderAllVendorsAvatar = () => {
    // 重新排列数组，让当前偏移量的头像在第一位
    const rotatedVendors = vendorInfo.length > 3 ? [
      ...vendorInfo.slice(currentOffset),
      ...vendorInfo.slice(0, currentOffset)
    ] : vendorInfo;

    // 如果没有供应商，显示占位符
    if (vendorInfo.length === 0) {
      return (
        <div className="min-w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center px-2">
          <Avatar size="default" color="transparent">
            AI
          </Avatar>
        </div>
      );
    }

    return (
      <div className="min-w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center px-2">
        <AvatarGroup
          maxCount={4}
          size="default"
          overlapFrom='end'
          key={currentOffset}
          renderMore={(restNumber) => (
            <Avatar
              size="default"
              style={{ backgroundColor: 'transparent', color: 'var(--semi-color-text-0)' }}
              alt={`${restNumber} more vendors`}
            >
              {`+${restNumber}`}
            </Avatar>
          )}
        >
          {rotatedVendors.map((vendor) => (
            <Avatar
              key={vendor.name}
              size="default"
              color="transparent"
              alt={vendor.name === 'unknown' ? t('未知供应商') : vendor.name}
            >
              {vendor.icon ?
                getLobeHubIcon(vendor.icon, 20) :
                (vendor.name === 'unknown' ? '?' : vendor.name.charAt(0).toUpperCase())
              }
            </Avatar>
          ))}
        </AvatarGroup>
      </div>
    );
  };

  // 为具体供应商渲染单个图标
  const renderVendorAvatar = (vendor) => (
    <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
      {vendor.icon ?
        getLobeHubIcon(vendor.icon, 40) :
        <Avatar size="large" color="transparent">
          {vendor.name === 'unknown' ? '?' : vendor.name.charAt(0).toUpperCase()}
        </Avatar>
      }
    </div>
  );

  // 如果是全部供应商
  if (filterVendor === 'all') {
    return (
      <div className='mb-4'>
        <Card className="!rounded-2xl with-pastel-balls" bodyStyle={{ padding: '16px' }}>
          <div className="flex items-start space-x-3 md:space-x-4">
            {/* 全部供应商的头像组合 */}
            <div className="flex-shrink-0">
              {renderAllVendorsAvatar()}
            </div>

            {/* 供应商信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{t('全部供应商')}</h2>
                <Tag color="white" shape="circle" size="small" className="self-start sm:self-center">
                  {t('共 {{count}} 个模型', { count: currentModelCount })}
                </Tag>
              </div>
              <Paragraph
                className="text-xs sm:text-sm text-gray-600 leading-relaxed !mb-0"
                ellipsis={{
                  rows: 2,
                  expandable: true,
                  collapsible: true,
                  collapseText: t('收起'),
                  expandText: t('展开')
                }}
              >
                {getVendorDescription('all')}
              </Paragraph>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 具体供应商
  const currentVendor = vendorInfo.find(v => v.name === filterVendor);
  if (!currentVendor) {
    return null;
  }

  const vendorDisplayName = currentVendor.name === 'unknown' ? t('未知供应商') : currentVendor.name;

  return (
    <div className='mb-4'>
      <Card className="!rounded-2xl with-pastel-balls" bodyStyle={{ padding: '16px' }}>
        <div className="flex items-start space-x-3 md:space-x-4">
          {/* 供应商图标 */}
          <div className="flex-shrink-0">
            {renderVendorAvatar(currentVendor)}
          </div>

          {/* 供应商信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{vendorDisplayName}</h2>
              <Tag color="white" shape="circle" size="small" className="self-start sm:self-center">
                {t('共 {{count}} 个模型', { count: currentModelCount })}
              </Tag>
            </div>
            <Paragraph
              className="text-xs sm:text-sm text-gray-600 leading-relaxed !mb-0"
              ellipsis={{
                rows: 2,
                expandable: true,
                collapsible: true,
                collapseText: t('收起'),
                expandText: t('展开')
              }}
            >
              {currentVendor.description || getVendorDescription(currentVendor.name)}
            </Paragraph>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PricingVendorIntro;