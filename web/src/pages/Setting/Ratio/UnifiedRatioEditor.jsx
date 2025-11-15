import React, { useEffect, useState, useRef } from 'react';
import {
    Table,
    Button,
    Input,
    Modal,
    Form,
    Space,
    Tag,
    Tooltip,
    Card,
    Typography,
    Banner,
    Popconfirm,
    Switch,
    Divider,
    RadioGroup,
    Radio,
} from '@douyinfe/semi-ui';
import {
    IconDelete,
    IconPlus,
    IconSearch,
    IconEdit,
    IconInfoCircle,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

export default function UnifiedRatioEditor({ refresh }) {
    const { t } = useTranslation();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [formRules, setFormRules] = useState([]);
    const [ratioMode, setRatioMode] = useState('fixed'); // 'fixed' or 'segmented'
    const [pricingSubMode, setPricingSubMode] = useState('ratio'); // 'ratio' or 'price-usd' or 'price-cny'
    const [segmentedPricingSubMode, setSegmentedPricingSubMode] = useState('ratio'); // 分段倍率的设置方式
    const [tempPriceValues, setTempPriceValues] = useState({ input_price_usd: '', output_price_usd: '', input_price_cny: '', output_price_cny: '' }); // 临时存储价格值
    const formRef = useRef(null);

    // 汇率常量（从后端 model_ratio.go）
    const USD_TO_CNY_RATE = 7.3; // 1 USD = 7.3 RMB
    const USD_RATE = 500; // $0.002 = 1 -> $1 = 500
    const RMB_RATE = USD_RATE / USD_TO_CNY_RATE; // ¥1 = USD_RATE / 7.3

    // 获取固定倍率的初始值（根据当前设置方式）
    const getFixedRatioInitValues = () => {
        if (!editingConfig) return {};

        console.log('getFixedRatioInitValues called');
        console.log('pricingSubMode:', pricingSubMode);
        console.log('editingConfig:', editingConfig);

        const values = {
            model_name: editingConfig.model_name || '',
            enabled: editingConfig.enabled !== false,
            fixed_price: editingConfig.fixed_price,
            model_ratio: editingConfig.model_ratio,
            completion_ratio: editingConfig.completion_ratio,
        };

        // 根据设置方式计算额外的价格字段
        if (pricingSubMode === 'price-usd' && editingConfig.model_ratio !== undefined) {
            values.input_price_usd = parseFloat(calculateUsdPriceFromRatio(editingConfig.model_ratio).toFixed(6));
            if (editingConfig.completion_ratio !== undefined) {
                values.output_price_usd = parseFloat((values.input_price_usd * editingConfig.completion_ratio).toFixed(6));
            }
            console.log('Calculated USD prices:', values.input_price_usd, values.output_price_usd);
        } else if (pricingSubMode === 'price-cny' && editingConfig.model_ratio !== undefined) {
            values.input_price_cny = parseFloat(calculateCnyPriceFromRatio(editingConfig.model_ratio).toFixed(6));
            if (editingConfig.completion_ratio !== undefined) {
                values.output_price_cny = parseFloat((values.input_price_cny * editingConfig.completion_ratio).toFixed(6));
            }
            console.log('Calculated CNY prices:', values.input_price_cny, values.output_price_cny);
        }

        return values;
    };

    // 获取分段规则的价格初始值（根据当前设置方式）
    const getRuleInitValue = (rule, field) => {
        if (!rule) return undefined;

        console.log(`getRuleInitValue called for field: ${field}, mode: ${segmentedPricingSubMode}`);
        console.log('rule:', rule);

        if (segmentedPricingSubMode === 'ratio') {
            // 按倍率模式，直接返回倍率值
            return rule[field];
        } else if (segmentedPricingSubMode === 'price-usd') {
            // 按美元价格模式
            if (field === 'input_price_usd' && rule.model_ratio !== undefined) {
                const price = parseFloat(calculateUsdPriceFromRatio(rule.model_ratio).toFixed(6));
                console.log(`Calculated input_price_usd: ${price}`);
                return price;
            } else if (field === 'output_price_usd' && rule.model_ratio !== undefined && rule.completion_ratio !== undefined) {
                const inputPrice = calculateUsdPriceFromRatio(rule.model_ratio);
                const outputPrice = parseFloat((inputPrice * rule.completion_ratio).toFixed(6));
                console.log(`Calculated output_price_usd: ${outputPrice}`);
                return outputPrice;
            }
        } else if (segmentedPricingSubMode === 'price-cny') {
            // 按人民币价格模式
            if (field === 'input_price_cny' && rule.model_ratio !== undefined) {
                const price = parseFloat(calculateCnyPriceFromRatio(rule.model_ratio).toFixed(6));
                console.log(`Calculated input_price_cny: ${price}`);
                return price;
            } else if (field === 'output_price_cny' && rule.model_ratio !== undefined && rule.completion_ratio !== undefined) {
                const inputPrice = calculateCnyPriceFromRatio(rule.model_ratio);
                const outputPrice = parseFloat((inputPrice * rule.completion_ratio).toFixed(6));
                console.log(`Calculated output_price_cny: ${outputPrice}`);
                return outputPrice;
            }
        }

        return rule[field];
    };

    // Load all ratio configurations (both fixed and segmented)
    const loadConfigs = async () => {
        setLoading(true);
        try {
            // 加载分段倍率配置
            const segmentedRes = await API.get('/api/segmented_ratio/');
            console.log('API Response for segmented_ratio:', segmentedRes.data);

            const segmentedConfigs = segmentedRes.data.success
                ? Object.values(segmentedRes.data.data || {}).map(config => ({
                    ...config,
                    is_fixed_mode: false, // 明确标记为分段倍率模式
                }))
                : [];

            console.log('Parsed segmentedConfigs:', segmentedConfigs);
            segmentedConfigs.forEach((config, index) => {
                console.log(`Config ${index}:`, config.model_name, 'rules:', config.rules, 'is_fixed_mode:', config.is_fixed_mode);
            });

            // 加载固定倍率配置（从系统选项）
            const optionsRes = await API.get('/api/option/');
            let fixedConfigs = [];

            if (optionsRes.data.success) {
                let modelPrice = {};
                let modelRatio = {};
                let completionRatio = {};

                optionsRes.data.data.forEach((item) => {
                    try {
                        if (item.key === 'ModelPrice') {
                            modelPrice = JSON.parse(item.value || '{}');
                        } else if (item.key === 'ModelRatio') {
                            modelRatio = JSON.parse(item.value || '{}');
                        } else if (item.key === 'CompletionRatio') {
                            completionRatio = JSON.parse(item.value || '{}');
                        }
                    } catch (e) {
                        console.error('解析配置失败:', e);
                    }
                });

                // 将固定倍率转换为配置对象
                const allModelNames = new Set([
                    ...Object.keys(modelPrice),
                    ...Object.keys(modelRatio),
                ]);

                allModelNames.forEach((modelName) => {
                    // 如果该模型已经在分段倍率配置中，则跳过
                    const existsInSegmented = segmentedConfigs.some(
                        (c) => c.model_name === modelName
                    );
                    if (existsInSegmented) return;

                    const config = {
                        model_name: modelName,
                        enabled: true,
                        rules: [],
                        is_fixed_mode: true,
                    };

                    if (modelPrice[modelName] !== undefined) {
                        config.fixed_price = modelPrice[modelName];
                    }
                    if (modelRatio[modelName] !== undefined) {
                        config.model_ratio = modelRatio[modelName];
                    }
                    if (completionRatio[modelName] !== undefined) {
                        config.completion_ratio = completionRatio[modelName];
                    }

                    fixedConfigs.push(config);
                });
            }

            // 合并配置
            setConfigs([...segmentedConfigs, ...fixedConfigs]);
        } catch (error) {
            showError('加载倍率配置失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfigs();
    }, []);

    // 价格转换辅助函数
    // 根据后端定义：1 === $0.002 / 1K tokens
    // 即：1倍率 = $0.002/1K = $2.0/1M tokens
    // 所以：价格($/1M tokens) = 倍率 × 2
    //      倍率 = 价格($/1M tokens) ÷ 2
    const calculateRatioFromUsdPrice = (pricePerMillion) => {
        return pricePerMillion / 2.0;
    };

    const calculateUsdPriceFromRatio = (ratio) => {
        return ratio * 2.0;
    };

    const calculateRatioFromCnyPrice = (pricePerMillion) => {
        // 先转换为美元，再计算倍率
        const priceUsd = pricePerMillion / USD_TO_CNY_RATE;
        return priceUsd / 2.0;
    };

    const calculateCnyPriceFromRatio = (ratio) => {
        // 先计算美元价格，再转换为人民币
        const priceUsd = ratio * 2.0;
        return priceUsd * USD_TO_CNY_RATE;
    };

    const calculateCompletionRatioFromPrices = (inputPrice, outputPrice) => {
        if (!inputPrice || inputPrice === 0) {
            showError('输入价格不能为0');
            return '';
        }
        return outputPrice / inputPrice;
    };

    // 处理输入价格变化（美元）
    const handleInputPriceUsdChange = (value) => {
        setTempPriceValues(prev => ({ ...prev, input_price_usd: value }));
        if (!isNaN(value) && value !== '') {
            const pricePerMillion = parseFloat(value);
            const ratio = calculateRatioFromUsdPrice(pricePerMillion);
            formRef.current?.formApi?.setValue('model_ratio', ratio);
        }
    };

    // 处理输出价格变化（美元）
    const handleOutputPriceUsdChange = (value) => {
        setTempPriceValues(prev => ({ ...prev, output_price_usd: value }));
        if (!isNaN(value) && value !== '' && tempPriceValues.input_price_usd) {
            const outputPrice = parseFloat(value);
            const inputPrice = parseFloat(tempPriceValues.input_price_usd);
            if (inputPrice > 0) {
                const completionRatio = calculateCompletionRatioFromPrices(inputPrice, outputPrice);
                formRef.current?.formApi?.setValue('completion_ratio', completionRatio);
            }
        }
    };

    // 处理输入价格变化（人民币）
    const handleInputPriceCnyChange = (value) => {
        setTempPriceValues(prev => ({ ...prev, input_price_cny: value }));
        if (!isNaN(value) && value !== '') {
            const priceCny = parseFloat(value);
            const ratio = calculateRatioFromCnyPrice(priceCny);
            formRef.current?.formApi?.setValue('model_ratio', ratio);
            // 同步更新美元价格
            const priceUsd = calculateUsdPriceFromRatio(ratio);
            setTempPriceValues(prev => ({ ...prev, input_price_usd: priceUsd.toFixed(4) }));
        }
    };

    // 处理输出价格变化（人民币）
    const handleOutputPriceCnyChange = (value) => {
        setTempPriceValues(prev => ({ ...prev, output_price_cny: value }));
        if (!isNaN(value) && value !== '' && tempPriceValues.input_price_cny) {
            const outputPriceCny = parseFloat(value);
            const inputPriceCny = parseFloat(tempPriceValues.input_price_cny);
            const outputPriceUsd = outputPriceCny / USD_TO_CNY_RATE;
            const inputPriceUsd = inputPriceCny / USD_TO_CNY_RATE;
            if (inputPriceUsd > 0) {
                const completionRatio = calculateCompletionRatioFromPrices(inputPriceUsd, outputPriceUsd);
                formRef.current?.formApi?.setValue('completion_ratio', completionRatio);
                setTempPriceValues(prev => ({ ...prev, output_price_usd: outputPriceUsd.toFixed(4) }));
            }
        }
    };

    const handleAdd = () => {
        setEditingConfig(null);
        setRatioMode('fixed');
        setPricingSubMode('ratio');
        setFormRules([]);
        setTempPriceValues({ input_price_usd: '', output_price_usd: '', input_price_cny: '', output_price_cny: '' });
        setVisible(true);
    };

    const handleModalClose = () => {
        setVisible(false);
        setEditingConfig(null);
        setRatioMode('fixed');
        setPricingSubMode('ratio');
        setFormRules([]);
        setTempPriceValues({ input_price_usd: '', output_price_usd: '', input_price_cny: '', output_price_cny: '' });
        // 重置表单
        if (formRef.current) {
            formRef.current.reset();
        }
    };

    const handleEdit = (config) => {
        console.log('handleEdit called with config:', config);
        console.log('config.rules:', config.rules);
        console.log('config.rules length:', config.rules ? config.rules.length : 0);
        console.log('config.fixed_price:', config.fixed_price);
        console.log('config.model_ratio:', config.model_ratio);
        console.log('config.completion_ratio:', config.completion_ratio);

        // 判断是固定倍率还是分段倍率
        const isFixed = config.is_fixed_mode || checkIsFixedMode(config);
        const mode = isFixed ? 'fixed' : 'segmented';

        console.log('Determined mode:', mode, 'isFixed:', isFixed);
        console.log('checkIsFixedMode result:', checkIsFixedMode(config));

        // 确保rules是数组
        const rules = Array.isArray(config.rules) ? config.rules : [];
        console.log('Setting formRules with:', rules);

        // 创建完整的编辑配置对象，确保所有字段都被保留
        const fullConfig = {
            ...config,
            model_name: config.model_name,
            enabled: config.enabled !== false,
            fixed_price: config.fixed_price,
            model_ratio: config.model_ratio,
            completion_ratio: config.completion_ratio,
            rules: rules,
        };

        console.log('Full config to edit:', fullConfig);

        // 如果有倍率值，计算对应的价格值用于显示
        const initialPriceValues = { input_price_usd: '', output_price_usd: '', input_price_cny: '', output_price_cny: '' };
        if (config.model_ratio !== undefined && config.model_ratio !== '') {
            const inputPriceUsd = calculateUsdPriceFromRatio(parseFloat(config.model_ratio));
            const inputPriceCny = calculateCnyPriceFromRatio(parseFloat(config.model_ratio));
            initialPriceValues.input_price_usd = inputPriceUsd.toFixed(4);
            initialPriceValues.input_price_cny = inputPriceCny.toFixed(4);

            if (config.completion_ratio !== undefined && config.completion_ratio !== '') {
                const outputPriceUsd = inputPriceUsd * parseFloat(config.completion_ratio);
                const outputPriceCny = inputPriceCny * parseFloat(config.completion_ratio);
                initialPriceValues.output_price_usd = outputPriceUsd.toFixed(4);
                initialPriceValues.output_price_cny = outputPriceCny.toFixed(4);
            }
        }

        // 设置所有状态
        setEditingConfig(fullConfig);
        setRatioMode(mode);
        setPricingSubMode('ratio'); // 默认使用倍率模式
        setSegmentedPricingSubMode('ratio'); // 分段倍率也默认使用倍率模式
        setFormRules(rules);
        setTempPriceValues(initialPriceValues);

        // 打开 Modal，并在下一个渲染周期后填充表单
        setVisible(true);
    };

    const handleDelete = async (modelName, isFixedConfig) => {
        try {
            if (isFixedConfig) {
                // 删除固定倍率：从系统选项中删除
                const optionsRes = await API.get('/api/option/');
                if (!optionsRes.data.success) {
                    showError('获取当前配置失败');
                    return;
                }

                let modelPrice = {};
                let modelRatio = {};
                let completionRatio = {};

                optionsRes.data.data.forEach((item) => {
                    try {
                        if (item.key === 'ModelPrice') {
                            modelPrice = JSON.parse(item.value || '{}');
                        } else if (item.key === 'ModelRatio') {
                            modelRatio = JSON.parse(item.value || '{}');
                        } else if (item.key === 'CompletionRatio') {
                            completionRatio = JSON.parse(item.value || '{}');
                        }
                    } catch (e) {
                        console.error('解析配置失败:', e);
                    }
                });

                // 删除该模型的配置
                delete modelPrice[modelName];
                delete modelRatio[modelName];
                delete completionRatio[modelName];

                // 保存配置
                const requestQueue = [
                    API.put('/api/option/', {
                        key: 'ModelPrice',
                        value: JSON.stringify(modelPrice, null, 2),
                    }),
                    API.put('/api/option/', {
                        key: 'ModelRatio',
                        value: JSON.stringify(modelRatio, null, 2),
                    }),
                    API.put('/api/option/', {
                        key: 'CompletionRatio',
                        value: JSON.stringify(completionRatio, null, 2),
                    }),
                ];

                const results = await Promise.all(requestQueue);
                const allSuccess = results.every((r) => r.data.success);

                if (allSuccess) {
                    showSuccess('删除成功');
                    loadConfigs();
                    // 通知父组件刷新以同步其他标签页的数据
                    if (refresh) {
                        refresh();
                    }
                } else {
                    showError('删除失败，请重试');
                }
            } else {
                // 删除分段倍率：使用分段倍率API
                const res = await API.delete(`/api/segmented_ratio/${modelName}`);
                if (res.data.success) {
                    showSuccess('删除成功');
                    loadConfigs();
                    // 通知父组件刷新以同步其他标签页的数据
                    if (refresh) {
                        refresh();
                    }
                } else {
                    showError(res.data.message || '删除失败');
                }
            }
        } catch (error) {
            showError('删除失败: ' + error.message);
        }
    };

    const handleSubmit = async () => {
        const values = formRef.current?.formApi?.getValues();

        if (!values?.model_name) {
            showError('请输入模型名称');
            return;
        }

        try {
            if (ratioMode === 'segmented') {
                // 分段倍率模式：使用分段倍率API
                if (!values?.rules || values.rules.length === 0) {
                    showError('分段倍率模式至少需要配置一条规则');
                    return;
                }

                const submitData = {
                    model_name: values.model_name,
                    enabled: values.enabled !== false,
                    rules: values.rules,
                };

                const res = await API.post('/api/segmented_ratio/', submitData);
                if (res.data.success) {
                    showSuccess(editingConfig ? '更新成功' : '创建成功');
                    setVisible(false);
                    loadConfigs();
                    // 通知父组件刷新以同步其他标签页的数据
                    if (refresh) {
                        refresh();
                    }
                } else {
                    showError(res.data.message || '保存失败');
                }
            } else {
                // 固定倍率模式：更新系统选项（ModelPrice、ModelRatio、CompletionRatio）
                if (!values.fixed_price && !values.model_ratio) {
                    showError('请至少设置固定价格或模型倍率');
                    return;
                }

                const modelName = values.model_name;

                // 获取当前的配置
                const modelPriceRes = await API.get('/api/option/');
                if (!modelPriceRes.data.success) {
                    showError('获取当前配置失败');
                    return;
                }

                // 解析现有配置
                let modelPrice = {};
                let modelRatio = {};
                let completionRatio = {};

                modelPriceRes.data.data.forEach((item) => {
                    try {
                        if (item.key === 'ModelPrice') {
                            modelPrice = JSON.parse(item.value || '{}');
                        } else if (item.key === 'ModelRatio') {
                            modelRatio = JSON.parse(item.value || '{}');
                        } else if (item.key === 'CompletionRatio') {
                            completionRatio = JSON.parse(item.value || '{}');
                        }
                    } catch (e) {
                        console.error('解析配置失败:', e);
                    }
                });

                // 更新配置
                if (values.fixed_price) {
                    // 设置固定价格，清除倍率
                    modelPrice[modelName] = parseFloat(values.fixed_price);
                    delete modelRatio[modelName];
                    delete completionRatio[modelName];
                } else {
                    // 设置倍率，清除固定价格
                    delete modelPrice[modelName];
                    if (values.model_ratio) {
                        modelRatio[modelName] = parseFloat(values.model_ratio);
                    }
                    if (values.completion_ratio) {
                        completionRatio[modelName] = parseFloat(values.completion_ratio);
                    }
                }

                // 保存配置
                const requestQueue = [];

                requestQueue.push(
                    API.put('/api/option/', {
                        key: 'ModelPrice',
                        value: JSON.stringify(modelPrice, null, 2),
                    })
                );
                requestQueue.push(
                    API.put('/api/option/', {
                        key: 'ModelRatio',
                        value: JSON.stringify(modelRatio, null, 2),
                    })
                );
                requestQueue.push(
                    API.put('/api/option/', {
                        key: 'CompletionRatio',
                        value: JSON.stringify(completionRatio, null, 2),
                    })
                );

                const results = await Promise.all(requestQueue);
                const allSuccess = results.every((r) => r.data.success);

                if (allSuccess) {
                    showSuccess(editingConfig ? '更新成功' : '创建成功');
                    setVisible(false);
                    loadConfigs();
                    // 通知父组件刷新以同步其他标签页的数据
                    if (refresh) {
                        refresh();
                    }
                } else {
                    showError('保存失败，请重试');
                }
            }
        } catch (error) {
            showError('保存失败: ' + error.message);
        }
    };

    const handleModeChange = (mode) => {
        setRatioMode(mode);
        if (mode === 'segmented' && formRules.length === 0) {
            // 切换到分段模式时，如果没有规则，添加一个默认规则
            const initialRules = [
                {
                    input_min: 0,
                    input_max: 32000,
                    output_min: 0,
                    output_max: 200000,
                    model_ratio: 0.4,
                    completion_ratio: 2.5,
                    priority: 100,
                },
            ];
            setFormRules(initialRules);
            setTimeout(() => {
                formRef.current?.formApi?.setValue('rules', initialRules);
            }, 0);
        }
    };

    const addRule = () => {
        const newRule = {
            input_min: 0,
            input_max: 0,
            output_min: 0,
            output_max: 0,
            model_ratio: 1.0,
            completion_ratio: 2.0,
            priority: 50,
        };
        const updatedRules = [...formRules, newRule];

        setFormRules(updatedRules);

        setTimeout(() => {
            formRef.current?.formApi?.setValue('rules', updatedRules);
        }, 0);
    };

    const removeRule = (index) => {
        const updatedRules = formRules.filter((_, i) => i !== index);
        setFormRules(updatedRules);
        formRef.current?.formApi?.setValue('rules', updatedRules);
    };

    const formatTokenRange = (min, max) => {
        const formatNum = (num) => {
            if (num === 0) return '无限制';
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return num;
        };

        if (min === 0 && max === 0) return '无限制';
        if (min === 0) return `≤ ${formatNum(max)}`;
        if (max === 0) return `> ${formatNum(min)}`;
        return `${formatNum(min)} ~ ${formatNum(max)}`;
    };

    // 判断配置是否为固定倍率模式
    const checkIsFixedMode = (config) => {
        // 如果明确标记了 is_fixed_mode，直接使用该标记
        if (config.is_fixed_mode === true) return true;
        if (config.is_fixed_mode === false) return false;

        // 如果没有规则或规则为空数组，认为是固定倍率
        if (!config.rules || config.rules.length === 0) return true;

        // 如果有多条规则，肯定是分段倍率
        if (config.rules.length > 1) return false;

        // 如果只有一条规则，检查是否所有token范围都为0（代表固定倍率的特殊表示）
        if (config.rules.length === 1) {
            const rule = config.rules[0];
            return rule.input_min === 0 && rule.input_max === 0 &&
                   rule.output_min === 0 && rule.output_max === 0;
        }

        return false;
    };

    const columns = [
        {
            title: '模型名称',
            dataIndex: 'model_name',
            key: 'model_name',
            render: (text) => <Text strong>{text}</Text>,
        },
        {
            title: '倍率模式',
            dataIndex: 'rules',
            key: 'ratio_mode',
            render: (rules, record) => {
                const isFixed = checkIsFixedMode(record);
                return (
                    <Tag color={isFixed ? 'blue' : 'purple'}>
                        {isFixed ? '固定倍率' : '分段倍率'}
                    </Tag>
                );
            },
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled) => (
                <Tag color={enabled ? 'green' : 'red'}>
                    {enabled ? '启用' : '禁用'}
                </Tag>
            ),
        },
        {
            title: '配置详情',
            dataIndex: 'rules',
            key: 'config_detail',
            render: (rules, record) => {
                const isFixed = checkIsFixedMode(record);
                if (isFixed) {
                    // 固定倍率模式
                    if (record.fixed_price !== undefined) {
                        return <Text>固定价格: ${record.fixed_price}</Text>;
                    }
                    if (record.model_ratio !== undefined || record.completion_ratio !== undefined) {
                        return (
                            <Text>
                                模型倍率: {record.model_ratio || '-'} | 补全倍率: {record.completion_ratio || '-'}
                            </Text>
                        );
                    }
                    return '-';
                }

                // 分段倍率模式
                if (!rules || rules.length === 0) return '-';
                return (
                    <Space>
                        {rules.slice(0, 2).map((rule, idx) => (
                            <Tooltip
                                key={idx}
                                content={`输入: ${formatTokenRange(rule.input_min, rule.input_max)} | 输出: ${formatTokenRange(rule.output_min, rule.output_max)} | 模型倍率: ${rule.model_ratio} | 补全倍率: ${rule.completion_ratio}`}
                            >
                                <Tag>规则 {idx + 1}</Tag>
                            </Tooltip>
                        ))}
                        {rules.length > 2 && <Text type="tertiary">等 {rules.length} 条</Text>}
                    </Space>
                );
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<IconEdit />}
                        theme="borderless"
                        size="small"
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确认删除此配置？"
                        content="删除后该模型将使用默认倍率计费"
                        onConfirm={() => handleDelete(record.model_name, checkIsFixedMode(record))}
                    >
                        <Button
                            icon={<IconDelete />}
                            theme="borderless"
                            size="small"
                            type="danger"
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const filteredConfigs = configs.filter((config) =>
        config.model_name.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div style={{ padding: '20px' }}>
            <Banner
                type="info"
                icon={<IconInfoCircle />}
                description="统一倍率管理：支持固定倍率和分段倍率两种模式。固定倍率：为整个模型设置统一的价格或倍率；分段倍率：根据输入输出token数量配置不同的计费倍率，规则按优先级从高到低匹配。"
                style={{ marginBottom: 20 }}
            />

            <Space style={{ marginBottom: 16 }}>
                <Input
                    prefix={<IconSearch />}
                    placeholder="搜索模型名称"
                    value={searchText}
                    onChange={(value) => setSearchText(value)}
                    style={{ width: 300 }}
                />
                <Button
                    icon={<IconPlus />}
                    theme="solid"
                    onClick={handleAdd}
                >
                    新增配置
                </Button>
            </Space>

            <Table
                columns={columns}
                dataSource={filteredConfigs}
                loading={loading}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                }}
                rowKey="model_name"
            />

            <Modal
                title={editingConfig ? '编辑倍率配置' : '新增倍率配置'}
                visible={visible}
                onCancel={handleModalClose}
                onOk={handleSubmit}
                width={900}
                style={{ maxHeight: '80vh' }}
            >
                <Form
                    key={editingConfig ? `edit-${editingConfig.model_name}-${pricingSubMode}-${segmentedPricingSubMode}` : `add-new-${pricingSubMode}-${segmentedPricingSubMode}`}
                    ref={formRef}
                    labelPosition="left"
                    labelWidth={120}
                >
                    <Form.Input
                        field="model_name"
                        label="模型名称"
                        placeholder="例如：gpt-4, doubao-seed-1.6"
                        rules={[{ required: true, message: '请输入模型名称' }]}
                        disabled={!!editingConfig}
                        initValue={editingConfig?.model_name || ''}
                    />
                    <Form.Switch
                        field="enabled"
                        label="启用状态"
                        checkedText="启用"
                        uncheckedText="禁用"
                        initValue={editingConfig?.enabled !== false}
                    />

                    <Divider margin="20px" />

                    {/* 倍率模式选择 */}
                    <div style={{ marginBottom: 20 }}>
                        <Space align="start">
                            <Text strong style={{ lineHeight: '32px' }}>倍率模式：</Text>
                            <RadioGroup
                                type="button"
                                value={ratioMode}
                                onChange={(e) => handleModeChange(e.target.value)}
                                buttonSize="middle"
                            >
                                <Radio value="fixed">固定倍率</Radio>
                                <Radio value="segmented">分段倍率</Radio>
                            </RadioGroup>
                        </Space>
                        <div style={{ marginTop: 8, marginLeft: 0 }}>
                            <Text type="tertiary" size="small">
                                {ratioMode === 'fixed'
                                    ? '为整个模型设置统一的固定价格或倍率，适用于计费规则简单的模型'
                                    : '根据输入输出token数量范围配置不同的倍率，适用于复杂计费规则的模型'}
                            </Text>
                        </div>
                    </div>

                    {/* 固定倍率模式 */}
                    {ratioMode === 'fixed' && (
                        <Card
                            style={{
                                marginBottom: 16,
                                backgroundColor: '#f8f9fa',
                            }}
                            bodyStyle={{ padding: 20 }}
                        >
                            <Space vertical align="start" style={{ width: '100%' }}>
                                <Text strong>固定倍率设置</Text>
                                <Text type="tertiary" size="small">
                                    固定价格优先级高于倍率设置。如果设置了固定价格，则忽略倍率设置。
                                </Text>

                                <Form.InputNumber
                                    field="fixed_price"
                                    label="固定价格"
                                    placeholder="每次调用的固定价格（单位：美元）"
                                    min={0}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                    prefix="$"
                                    initValue={editingConfig?.fixed_price}
                                />

                                <Divider margin="12px">或按量计费</Divider>

                                {/* 价格设置方式选择 */}
                                <div style={{ width: '100%' }}>
                                    <Space align="start" style={{ marginBottom: 12 }}>
                                        <Text strong style={{ lineHeight: '32px' }}>设置方式：</Text>
                                        <RadioGroup
                                            type="button"
                                            value={pricingSubMode}
                                            onChange={(e) => setPricingSubMode(e.target.value)}
                                            buttonSize="small"
                                        >
                                            <Radio value="ratio">按倍率</Radio>
                                            <Radio value="price-usd">按美元价格</Radio>
                                            <Radio value="price-cny">按人民币价格</Radio>
                                        </RadioGroup>
                                    </Space>
                                </div>

                                {/* 按倍率设置 */}
                                {pricingSubMode === 'ratio' && (
                                    <Space style={{ width: '100%' }}>
                                        <Form.InputNumber
                                            field="model_ratio"
                                            label="模型倍率"
                                            placeholder="输入token倍率"
                                            min={0}
                                            step={0.1}
                                            style={{ width: 200 }}
                                            initValue={editingConfig?.model_ratio}
                                        />
                                        <Form.InputNumber
                                            field="completion_ratio"
                                            label="补全倍率"
                                            placeholder="输出token倍率"
                                            min={0}
                                            step={0.1}
                                            style={{ width: 200 }}
                                            initValue={editingConfig?.completion_ratio}
                                        />
                                    </Space>
                                )}

                                {/* 按美元价格设置 */}
                                {pricingSubMode === 'price-usd' && (
                                    <>
                                        <Space style={{ width: '100%' }}>
                                            <Form.InputNumber
                                                field="input_price_usd"
                                                label="输入价格"
                                                placeholder="输入token价格"
                                                min={0}
                                                step={0.01}
                                                style={{ width: 200 }}
                                                suffix="$/1M tokens"
                                                initValue={getFixedRatioInitValues().input_price_usd}
                                                onChange={handleInputPriceUsdChange}
                                            />
                                            <Form.InputNumber
                                                field="output_price_usd"
                                                label="输出价格"
                                                placeholder="输出token价格"
                                                min={0}
                                                step={0.01}
                                                style={{ width: 200 }}
                                                suffix="$/1M tokens"
                                                initValue={getFixedRatioInitValues().output_price_usd}
                                                onChange={handleOutputPriceUsdChange}
                                            />
                                        </Space>
                                        <Text type="tertiary" size="small">
                                            当前倍率：输入 {formRef.current?.formApi?.getValue('model_ratio')?.toFixed(2) || '0.00'}x，
                                            输出 {formRef.current?.formApi?.getValue('completion_ratio')?.toFixed(2) || '0.00'}x
                                        </Text>
                                    </>
                                )}

                                {/* 按人民币价格设置 */}
                                {pricingSubMode === 'price-cny' && (
                                    <>
                                        <Space style={{ width: '100%' }}>
                                            <Form.InputNumber
                                                field="input_price_cny"
                                                label="输入价格"
                                                placeholder="输入token价格"
                                                min={0}
                                                step={0.01}
                                                style={{ width: 200 }}
                                                suffix="¥/1M tokens"
                                                initValue={getFixedRatioInitValues().input_price_cny}
                                                onChange={handleInputPriceCnyChange}
                                            />
                                            <Form.InputNumber
                                                field="output_price_cny"
                                                label="输出价格"
                                                placeholder="输出token价格"
                                                min={0}
                                                step={0.01}
                                                style={{ width: 200 }}
                                                suffix="¥/1M tokens"
                                                initValue={getFixedRatioInitValues().output_price_cny}
                                                onChange={handleOutputPriceCnyChange}
                                            />
                                        </Space>
                                        <Text type="tertiary" size="small">
                                            当前倍率：输入 {formRef.current?.formApi?.getValue('model_ratio')?.toFixed(2) || '0.00'}x，
                                            输出 {formRef.current?.formApi?.getValue('completion_ratio')?.toFixed(2) || '0.00'}x
                                            （汇率：1 USD = {USD_TO_CNY_RATE} CNY）
                                        </Text>
                                    </>
                                )}

                                <Banner
                                    type="warning"
                                    description="注意：固定价格适用于按次计费的模型（如 gpt-4-gizmo-*）；模型倍率和补全倍率适用于按token计费的模型。"
                                    style={{ marginTop: 12 }}
                                />
                            </Space>
                        </Card>
                    )}

                    {/* 分段倍率模式 */}
                    {ratioMode === 'segmented' && (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <Space align="start" style={{ marginBottom: 12 }}>
                                    <Text strong style={{ lineHeight: '32px' }}>设置方式：</Text>
                                    <RadioGroup
                                        type="button"
                                        value={segmentedPricingSubMode}
                                        onChange={(e) => setSegmentedPricingSubMode(e.target.value)}
                                        buttonSize="small"
                                    >
                                        <Radio value="ratio">按倍率</Radio>
                                        <Radio value="price-usd">按美元价格</Radio>
                                        <Radio value="price-cny">按人民币价格</Radio>
                                    </RadioGroup>
                                </Space>
                                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 12 }}>
                                    {segmentedPricingSubMode === 'ratio' && '直接设置模型倍率和补全倍率'}
                                    {segmentedPricingSubMode === 'price-usd' && '输入美元价格，自动计算倍率（基于 $1 = 500倍率）'}
                                    {segmentedPricingSubMode === 'price-cny' && '输入人民币价格，自动计算倍率（基于 ¥1 = 68.49倍率）'}
                                </Text>
                            </div>

                            <div style={{ marginBottom: 10 }}>
                                <Space>
                                    <Text strong>分段规则</Text>
                                    <Button
                                        icon={<IconPlus />}
                                        size="small"
                                        onClick={addRule}
                                    >
                                        添加规则
                                    </Button>
                                </Space>
                            </div>

                            <div>
                                {formRules.length === 0 && (
                                    <Text type="tertiary">暂无规则，点击"添加规则"按钮创建</Text>
                                )}
                                {formRules.map((rule, index) => (
                                    <Card
                                        key={index}
                                        style={{
                                            marginBottom: 16,
                                            backgroundColor: '#fafafa',
                                        }}
                                        bodyStyle={{ padding: 16 }}
                                    >
                                        <Space
                                            vertical
                                            align="start"
                                            style={{ width: '100%' }}
                                        >
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Text strong>规则 {index + 1}</Text>
                                                <Button
                                                    icon={<IconDelete />}
                                                    size="small"
                                                    type="danger"
                                                    theme="borderless"
                                                    onClick={() => removeRule(index)}
                                                >
                                                    删除
                                                </Button>
                                            </Space>

                                            <Space>
                                                <Form.InputNumber
                                                    field={`rules[${index}].input_min`}
                                                    label="输入最小值"
                                                    placeholder="0表示无限制"
                                                    min={0}
                                                    style={{ width: 150 }}
                                                    suffix="tokens"
                                                    initValue={rule.input_min}
                                                />
                                                <Form.InputNumber
                                                    field={`rules[${index}].input_max`}
                                                    label="输入最大值"
                                                    placeholder="0表示无限制"
                                                    min={0}
                                                    style={{ width: 150 }}
                                                    suffix="tokens"
                                                    initValue={rule.input_max}
                                                />
                                            </Space>

                                            <Space>
                                                <Form.InputNumber
                                                    field={`rules[${index}].output_min`}
                                                    label="输出最小值"
                                                    placeholder="0表示无限制"
                                                    min={0}
                                                    style={{ width: 150 }}
                                                    suffix="tokens"
                                                    initValue={rule.output_min}
                                                />
                                                <Form.InputNumber
                                                    field={`rules[${index}].output_max`}
                                                    label="输出最大值"
                                                    placeholder="0表示无限制"
                                                    min={0}
                                                    style={{ width: 150 }}
                                                    suffix="tokens"
                                                    initValue={rule.output_max}
                                                />
                                            </Space>

                                            {/* 按倍率设置 */}
                                            {segmentedPricingSubMode === 'ratio' && (
                                                <Space>
                                                    <Form.InputNumber
                                                        field={`rules[${index}].model_ratio`}
                                                        label="模型倍率"
                                                        placeholder="输入token倍率"
                                                        min={0}
                                                        step={0.1}
                                                        style={{ width: 150 }}
                                                        rules={[{ required: true, message: '请输入模型倍率' }]}
                                                        initValue={rule.model_ratio}
                                                    />
                                                    <Form.InputNumber
                                                        field={`rules[${index}].completion_ratio`}
                                                        label="补全倍率"
                                                        placeholder="输出token倍率"
                                                        min={0}
                                                        step={0.1}
                                                        style={{ width: 150 }}
                                                        rules={[{ required: true, message: '请输入补全倍率' }]}
                                                        initValue={rule.completion_ratio}
                                                    />
                                                    <Form.InputNumber
                                                        field={`rules[${index}].priority`}
                                                        label="优先级"
                                                        placeholder="数值越大优先级越高"
                                                        min={0}
                                                        style={{ width: 150 }}
                                                        initValue={rule.priority}
                                                    />
                                                </Space>
                                            )}

                                            {/* 按美元价格设置 */}
                                            {segmentedPricingSubMode === 'price-usd' && (
                                                <>
                                                    <Space>
                                                        <Form.InputNumber
                                                            field={`rules[${index}].input_price_usd`}
                                                            label="输入价格"
                                                            placeholder="输入token价格"
                                                            min={0}
                                                            step={0.01}
                                                            style={{ width: 150 }}
                                                            suffix="$/1M"
                                                            initValue={getRuleInitValue(rule, 'input_price_usd')}
                                                            onChange={(val) => {
                                                                if (!isNaN(val) && val !== '') {
                                                                    const ratio = calculateRatioFromUsdPrice(parseFloat(val));
                                                                    formRef.current?.formApi?.setValue(`rules[${index}].model_ratio`, ratio);
                                                                }
                                                            }}
                                                        />
                                                        <Form.InputNumber
                                                            field={`rules[${index}].output_price_usd`}
                                                            label="输出价格"
                                                            placeholder="输出token价格"
                                                            min={0}
                                                            step={0.01}
                                                            style={{ width: 150 }}
                                                            suffix="$/1M"
                                                            initValue={getRuleInitValue(rule, 'output_price_usd')}
                                                            onChange={(val) => {
                                                                const inputPrice = formRef.current?.formApi?.getValue(`rules[${index}].input_price_usd`);
                                                                if (!isNaN(val) && val !== '' && inputPrice) {
                                                                    const completionRatio = parseFloat(val) / parseFloat(inputPrice);
                                                                    formRef.current?.formApi?.setValue(`rules[${index}].completion_ratio`, completionRatio);
                                                                }
                                                            }}
                                                        />
                                                        <Form.InputNumber
                                                            field={`rules[${index}].priority`}
                                                            label="优先级"
                                                            placeholder="数值越大优先级越高"
                                                            min={0}
                                                            style={{ width: 100 }}
                                                            initValue={rule.priority}
                                                        />
                                                    </Space>
                                                    {/* 隐藏的倍率字段 */}
                                                    <div style={{ display: 'none' }}>
                                                        <Form.InputNumber field={`rules[${index}].model_ratio`} initValue={rule.model_ratio} />
                                                        <Form.InputNumber field={`rules[${index}].completion_ratio`} initValue={rule.completion_ratio} />
                                                    </div>
                                                </>
                                            )}

                                            {/* 按人民币价格设置 */}
                                            {segmentedPricingSubMode === 'price-cny' && (
                                                <>
                                                    <Space>
                                                        <Form.InputNumber
                                                            field={`rules[${index}].input_price_cny`}
                                                            label="输入价格"
                                                            placeholder="输入token价格"
                                                            min={0}
                                                            step={0.01}
                                                            style={{ width: 150 }}
                                                            suffix="¥/1M"
                                                            initValue={getRuleInitValue(rule, 'input_price_cny')}
                                                            onChange={(val) => {
                                                                if (!isNaN(val) && val !== '') {
                                                                    const ratio = calculateRatioFromCnyPrice(parseFloat(val));
                                                                    formRef.current?.formApi?.setValue(`rules[${index}].model_ratio`, ratio);
                                                                }
                                                            }}
                                                        />
                                                        <Form.InputNumber
                                                            field={`rules[${index}].output_price_cny`}
                                                            label="输出价格"
                                                            placeholder="输出token价格"
                                                            min={0}
                                                            step={0.01}
                                                            style={{ width: 150 }}
                                                            suffix="¥/1M"
                                                            initValue={getRuleInitValue(rule, 'output_price_cny')}
                                                            onChange={(val) => {
                                                                const inputPrice = formRef.current?.formApi?.getValue(`rules[${index}].input_price_cny`);
                                                                if (!isNaN(val) && val !== '') {
                                                                    const completionRatio = parseFloat(val) / parseFloat(inputPrice);
                                                                    formRef.current?.formApi?.setValue(`rules[${index}].completion_ratio`, completionRatio);
                                                                }
                                                            }}
                                                        />
                                                        <Form.InputNumber
                                                            field={`rules[${index}].priority`}
                                                            label="优先级"
                                                            placeholder="数值越大优先级越高"
                                                            min={0}
                                                            style={{ width: 100 }}
                                                            initValue={rule.priority}
                                                        />
                                                    </Space>
                                                    {/* 隐藏的倍率字段 */}
                                                    <div style={{ display: 'none' }}>
                                                        <Form.InputNumber field={`rules[${index}].model_ratio`} initValue={rule.model_ratio} />
                                                        <Form.InputNumber field={`rules[${index}].completion_ratio`} initValue={rule.completion_ratio} />
                                                    </div>
                                                </>
                                            )}

                                            <Text type="tertiary" size="small">
                                                示例：输入{formatTokenRange(rule.input_min, rule.input_max)}，
                                                输出{formatTokenRange(rule.output_min, rule.output_max)} →
                                                模型倍率 {rule.model_ratio || 0}x，补全倍率 {rule.completion_ratio || 0}x
                                            </Text>
                                        </Space>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </Form>
            </Modal>
        </div>
    );
}
