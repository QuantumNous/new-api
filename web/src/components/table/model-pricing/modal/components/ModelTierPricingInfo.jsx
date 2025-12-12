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

import React, { useMemo } from 'react';
import { Card, Avatar, Typography, Table, Tag } from '@douyinfe/semi-ui';
import { IconLayers } from '@douyinfe/semi-icons';

const { Text } = Typography;

const ModelTierPricingInfo = ({ modelData, tokenTierPricing, t }) => {
    // 检查是否启用分段计费
    const tierConfig = useMemo(() => {
        if (!tokenTierPricing?.global_enabled || !modelData?.model_name) {
            return null;
        }

        // 查找匹配的模型配置
        const modelConfigs = tokenTierPricing.model_configs || {};
        for (const configKey in modelConfigs) {
            const config = modelConfigs[configKey];
            if (!config.enabled) continue;

            // 检查模型名是否匹配
            const models = config.models?.split(',').map((m) => m.trim()) || [];
            const isMatched = models.some((pattern) => {
                if (pattern.endsWith('*')) {
                    const prefix = pattern.slice(0, -1);
                    return modelData.model_name.startsWith(prefix);
                }
                return modelData.model_name === pattern;
            });

            if (isMatched) {
                return config;
            }
        }
        return null;
    }, [tokenTierPricing, modelData]);

    // 如果没有配置或规则,不显示
    if (!tierConfig || !tierConfig.rules || tierConfig.rules.length === 0) {
        return null;
    }

    // 准备表格数据
    const tableData = tierConfig.rules.map((rule, index) => {
        // 构建条件描述
        const conditions = [];

        // 输入范围
        if (rule.max_input_tokens > 0) {
            if (rule.min_input_tokens > 0) {
                conditions.push(
                    `${(rule.min_input_tokens / 1000).toFixed(0)}K < ${t('输入')} ≤ ${(rule.max_input_tokens / 1000).toFixed(0)}K`
                );
            } else {
                conditions.push(
                    `${t('输入')} ≤ ${(rule.max_input_tokens / 1000).toFixed(0)}K`
                );
            }
        } else if (rule.min_input_tokens > 0) {
            conditions.push(
                `${t('输入')} > ${(rule.min_input_tokens / 1000).toFixed(0)}K`
            );
        }

        // 输出范围
        if (rule.max_output_tokens > 0) {
            if (rule.min_output_tokens > 0) {
                conditions.push(
                    `${rule.min_output_tokens} < ${t('输出')} ≤ ${rule.max_output_tokens}`
                );
            } else {
                conditions.push(`${t('输出')} ≤ ${rule.max_output_tokens}`);
            }
        } else if (rule.min_output_tokens > 0) {
            conditions.push(`${t('输出')} > ${rule.min_output_tokens}`);
        }

        // 判断是价格模式还是倍率模式
        const isPriceMode = rule.input_price > 0 || rule.output_price > 0;

        return {
            key: index,
            name: rule.name || `T${index + 1}`,
            condition: conditions.join(' & ') || t('默认'),
            mode: isPriceMode ? t('价格模式') : t('倍率模式'),
            inputValue: isPriceMode
                ? `$${rule.input_price?.toFixed(6) || '0.000000'} / 1M`
                : `${rule.input_ratio?.toFixed(2) || '0.00'}x`,
            outputValue: isPriceMode
                ? `$${rule.output_price?.toFixed(6) || '0.000000'} / 1M`
                : `${rule.completion_ratio?.toFixed(2) || '1.00'}x`,
        };
    });

    // 定义表格列
    const columns = [
        {
            title: t('规则名称'),
            dataIndex: 'name',
            render: (text) => (
                <Tag color='cyan' size='small' shape='circle'>
                    {text}
                </Tag>
            ),
        },
        {
            title: t('触发条件'),
            dataIndex: 'condition',
            render: (text) => (
                <div className='text-sm text-gray-700'>{text}</div>
            ),
        },
        {
            title: t('计费模式'),
            dataIndex: 'mode',
            render: (text) => (
                <Tag
                    color={text === t('价格模式') ? 'green' : 'violet'}
                    size='small'
                    shape='circle'
                >
                    {text}
                </Tag>
            ),
        },
        {
            title: t('输入计费'),
            dataIndex: 'inputValue',
            render: (text) => (
                <div className='font-semibold text-orange-600'>{text}</div>
            ),
        },
        {
            title: t('输出计费'),
            dataIndex: 'outputValue',
            render: (text) => (
                <div className='font-semibold text-orange-600'>{text}</div>
            ),
        },
    ];

    return (
        <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
            <div className='flex items-center mb-2'>
                <Avatar size='small' color='purple' className='mr-2 shadow-md'>
                    <IconLayers size={16} />
                </Avatar>
                <Text className='text-lg font-medium'>{t('分段计费')}</Text>
            </div>
            <Table
                dataSource={tableData}
                columns={columns}
                pagination={false}
                size='small'
                bordered={false}
                className='!rounded-lg'
            />
            <div className='mt-2 text-xs text-gray-500'>
                {t('规则按优先级从上到下匹配')} · {t('价格模式')}: USD/1M · {t('倍率模式')}: 1x=$2/1M · {t('实际费用乘以分组倍率')}
            </div>
        </Card>
    );
};

export default ModelTierPricingInfo;
