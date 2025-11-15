import React, { useEffect, useState, useRef } from 'react';
import {
    Table,
    Button,
    Input,
    Modal,
    Form,
    Space,
    Tag,
    Collapse,
    Tooltip,
    Card,
    Typography,
    Banner,
    Popconfirm,
} from '@douyinfe/semi-ui';
import {
    IconDelete,
    IconPlus,
    IconSearch,
    IconSave,
    IconEdit,
    IconInfoCircle,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SegmentedRatioEditor() {
    const { t } = useTranslation();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [formRules, setFormRules] = useState([]); // 新增：使用 state 管理规则
    const formRef = useRef(null);

    // Load all segmented ratio configurations
    const loadConfigs = async () => {
        setLoading(true);
        try {
            const res = await API.get('/api/segmented_ratio/');
            if (res.data.success) {
                const configArray = Object.values(res.data.data || {});
                setConfigs(configArray);
            } else {
                showError(res.data.message || '加载失败');
            }
        } catch (error) {
            showError('加载分段倍率配置失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfigs();
    }, []);

    const handleAdd = () => {
        setEditingConfig(null);
        const initialRules = [
            {
                input_min: 0,
                input_max: 32000,
                input_min_exclusive: true,  // 左边界默认开区间 (>)
                input_max_exclusive: false, // 右边界默认闭区间 (≤)
                output_min: 0,
                output_max: 200000,
                output_min_exclusive: true,  // 左边界默认开区间 (>)
                output_max_exclusive: false, // 右边界默认闭区间 (≤)
                model_ratio: 0.4,
                completion_ratio: 2.5,
                priority: 100,
            },
        ];
        setFormRules(initialRules); // 设置初始规则
        setVisible(true);
        setTimeout(() => {
            formRef.current?.setValues({
                model_name: '',
                enabled: true,
                rules: initialRules,
            });
        }, 0);
    };

    const handleEdit = (config) => {
        setEditingConfig(config);
        setFormRules(config.rules || []); // 设置编辑时的规则
        setVisible(true);
        setTimeout(() => {
            formRef.current?.setValues(config);
        }, 0);
    };

    const handleDelete = async (modelName) => {
        try {
            const res = await API.delete(`/api/segmented_ratio/${modelName}`);
            if (res.data.success) {
                showSuccess('删除成功');
                loadConfigs();
            } else {
                showError(res.data.message || '删除失败');
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

        if (!values?.rules || values.rules.length === 0) {
            showError('至少需要配置一条规则');
            return;
        }

        try {
            const res = await API.post('/api/segmented_ratio/', values);
            if (res.data.success) {
                showSuccess(editingConfig ? '更新成功' : '创建成功');
                setVisible(false);
                loadConfigs();
            } else {
                showError(res.data.message || '保存失败');
            }
        } catch (error) {
            showError('保存失败: ' + error.message);
        }
    };

    const addRule = () => {
        const newRule = {
            input_min: 0,
            input_max: 0,
            input_min_exclusive: true,  // 左边界默认开区间 (>)
            input_max_exclusive: false, // 右边界默认闭区间 (≤)
            output_min: 0,
            output_max: 0,
            output_min_exclusive: true,  // 左边界默认开区间 (>)
            output_max_exclusive: false, // 右边界默认闭区间 (≤)
            model_ratio: 1.0,
            completion_ratio: 2.0,
            priority: 50,
        };
        const updatedRules = [...formRules, newRule];

        setFormRules(updatedRules); // 更新 state

        // 确保表单也更新
        setTimeout(() => {
            formRef.current?.formApi?.setValue('rules', updatedRules);
        }, 0);
    };

    const removeRule = (index) => {
        const updatedRules = formRules.filter((_, i) => i !== index);
        setFormRules(updatedRules); // 更新 state
        formRef.current?.formApi?.setValue('rules', updatedRules); // 同步到表单
    };

    const formatTokenRange = (min, max) => {
        const formatNum = (num) => {
            if (num === 0) return '无限制';
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return num;
        };

        if (min === 0 && max === 0) return '无限制';
        if (min === 0) {
            return `≤ ${formatNum(max)}`;
        }
        if (max === 0) {
            return `> ${formatNum(min)}`;
        }
        // 默认左开右闭: min < x ≤ max
        return `${formatNum(min)} < x ≤ ${formatNum(max)}`;
    };

    const columns = [
        {
            title: '模型名称',
            dataIndex: 'model_name',
            key: 'model_name',
            render: (text) => <Text strong>{text}</Text>,
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
            title: '规则数量',
            dataIndex: 'rules',
            key: 'rules_count',
            render: (rules) => <Tag>{rules?.length || 0} 条规则</Tag>,
        },
        {
            title: '规则概览',
            dataIndex: 'rules',
            key: 'rules_preview',
            render: (rules) => {
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
                        onConfirm={() => handleDelete(record.model_name)}
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
                description="分段倍率允许您根据输入和输出token数量配置不同的计费倍率。支持精确设置开闭区间（如：32K < Input ≤ 128K）。例如，对于 doubao-seed-1.6 模型，您可以设置：输入≤32K且输出≤200K时使用0.4倍率，输入>128K时使用1.2倍率等。规则按优先级从高到低匹配。"
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
                title={editingConfig ? '编辑分段倍率配置' : '新增分段倍率配置'}
                visible={visible}
                onCancel={() => setVisible(false)}
                onOk={handleSubmit}
                width={900}
                style={{ maxHeight: '80vh' }}
            >
                <Form ref={formRef} labelPosition="left" labelWidth={120}>
                    <Form.Input
                        field="model_name"
                        label="模型名称"
                        placeholder="例如：doubao-seed-1.6"
                        rules={[{ required: true, message: '请输入模型名称' }]}
                        disabled={!!editingConfig}
                    />
                    <Form.Switch
                        field="enabled"
                        label="启用状态"
                        checkedText="启用"
                        uncheckedText="禁用"
                    />

                    <div style={{ marginTop: 20, marginBottom: 10 }}>
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

                    {/* 直接渲染规则列表，不使用 Form.Slot */}
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
                                            label="输入最小值 (>)"
                                            placeholder="0表示无限制"
                                            min={0}
                                            style={{ width: 150 }}
                                            suffix="tokens"
                                        />
                                        <Form.InputNumber
                                            field={`rules[${index}].input_max`}
                                            label="输入最大值 (≤)"
                                            placeholder="0表示无限制"
                                            min={0}
                                            style={{ width: 150 }}
                                            suffix="tokens"
                                        />
                                    </Space>

                                    <Space>
                                        <Form.InputNumber
                                            field={`rules[${index}].output_min`}
                                            label="输出最小值 (>)"
                                            placeholder="0表示无限制"
                                            min={0}
                                            style={{ width: 150 }}
                                            suffix="tokens"
                                        />
                                        <Form.InputNumber
                                            field={`rules[${index}].output_max`}
                                            label="输出最大值 (≤)"
                                            placeholder="0表示无限制"
                                            min={0}
                                            style={{ width: 150 }}
                                            suffix="tokens"
                                        />
                                    </Space>

                                    <Space>
                                        <Form.InputNumber
                                            field={`rules[${index}].model_ratio`}
                                            label="模型倍率"
                                            placeholder="输入token倍率"
                                            min={0}
                                            step={0.1}
                                            style={{ width: 150 }}
                                            rules={[{ required: true, message: '请输入模型倍率' }]}
                                        />
                                        <Form.InputNumber
                                            field={`rules[${index}].completion_ratio`}
                                            label="补全倍率"
                                            placeholder="输出token倍率"
                                            min={0}
                                            step={0.1}
                                            style={{ width: 150 }}
                                            rules={[{ required: true, message: '请输入补全倍率' }]}
                                        />
                                        <Form.InputNumber
                                            field={`rules[${index}].priority`}
                                            label="优先级"
                                            placeholder="数值越大优先级越高"
                                            min={0}
                                            style={{ width: 150 }}
                                        />
                                    </Space>

                                    <Text type="tertiary" size="small">
                                        示例：输入{formatTokenRange(rule.input_min, rule.input_max)}，
                                        输出{formatTokenRange(rule.output_min, rule.output_max)} →
                                        模型倍率 {rule.model_ratio}x，补全倍率 {rule.completion_ratio}x
                                    </Text>
                                </Space>
                            </Card>
                        ))}
                    </div>
                </Form>
            </Modal>
        </div>
    );
}