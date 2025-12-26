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

const ModelTierPricingInfo = ({ modelData, tokenTierPricing, tokenUnit = 'K', t }) => {
    // 检查是否启用分段计费
    const tierConfig = useMemo(() => {
        if (!tokenTierPricing?.global_enabled || !modelData?.model_name) {
            return null;
        }

        // 查找匹配的模型配置
        const modelConfigs = tokenTierPricing.model_configs || {};
        const configs = Object.values(modelConfigs)
            .filter((c) => c?.enabled)
            .sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0));

        for (const config of configs) {
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

    // 格式化 token 数量显示（根据 tokenUnit 调整单位）
    const formatTokens = (tokens) => {
        const divisor = tokenUnit === 'K' ? 1000 : 1000000;
        const suffix = tokenUnit === 'K' ? 'K' : 'M';
        if (tokens >= divisor) {
            return `${(tokens / divisor).toFixed(tokenUnit === 'K' ? 0 : 3)}${suffix}`;
        }
        return tokens.toString();
    };

    // 价格单位显示
    const priceUnit = tokenUnit === 'K' ? '1K' : '1M';

    // 准备表格数据
    const tableData = tierConfig.rules.map((rule, index) => {
        // 构建条件描述
        const conditions = [];

        // 输入范围
        if (rule.max_input_tokens > 0) {
            if (rule.min_input_tokens > 0) {
                conditions.push(
                    `${formatTokens(rule.min_input_tokens)} ≤ ${t('输入')} ≤ ${formatTokens(rule.max_input_tokens)}`
                );
            } else {
                conditions.push(
                    `${t('输入')} ≤ ${formatTokens(rule.max_input_tokens)}`
                );
            }
        } else if (rule.min_input_tokens > 0) {
            conditions.push(
                `${t('输入')} ≥ ${formatTokens(rule.min_input_tokens)}`
            );
        }

        // 输出范围
        if (rule.max_output_tokens > 0) {
            if (rule.min_output_tokens > 0) {
                conditions.push(
                    `${formatTokens(rule.min_output_tokens)} ≤ ${t('输出')} ≤ ${formatTokens(rule.max_output_tokens)}`
                );
            } else {
                conditions.push(`${t('输出')} ≤ ${formatTokens(rule.max_output_tokens)}`);
            }
        } else if (rule.min_output_tokens > 0) {
            conditions.push(`${t('输出')} ≥ ${formatTokens(rule.min_output_tokens)}`);
        }

        // 判断是价格模式还是倍率模式
        // 价格模式：任一价格字段非零；倍率模式：使用 input_ratio
        const isPriceMode =
            (rule.input_price ?? 0) !== 0 || (rule.output_price ?? 0) !== 0;

        return {
            key: index,
            name: rule.name || `T${index + 1}`,
            condition: conditions.join(' & ') || t('默认'),
            mode: isPriceMode ? t('价格模式') : t('倍率模式'),
            inputValue: isPriceMode
                ? `$${(rule.input_price ?? 0).toFixed(6)} / ${priceUnit}`
                : `${(rule.input_ratio ?? 0).toFixed(2)}x`,
            outputValue: isPriceMode
                ? `$${(rule.output_price ?? 0).toFixed(6)} / ${priceUnit}`
                : `${(rule.output_ratio ?? ((rule.input_ratio ?? 0) * (rule.completion_ratio ?? 1.0))).toFixed(2)}x`,
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
                {t('规则按优先级从上到下匹配')} · {t('价格模式')}: USD/{priceUnit} · {t('倍率模式')}: {t('相对于基础倍率')} · {t('实际费用乘以分组倍率')}
            </div>
        </Card>
    );
};

export default ModelTierPricingInfo;
