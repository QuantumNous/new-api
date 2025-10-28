import React, { useEffect, useState, useRef } from 'react';
import {
    Banner,
    Button,
    Form,
    Row,
    Col,
    Typography,
    Spin,
    Table,
    Modal,
    Input,
    InputNumber,
    Select,
} from '@douyinfe/semi-ui';
const { Text } = Typography;
import {
    API,
    showError,
    showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

export default function SettingsPaymentGatewayCreem(props) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [inputs, setInputs] = useState({
        CreemApiKey: '',
        CreemWebhookSecret: '',
        CreemProducts: '[]',
        CreemTestMode: false,
    });
    const [originInputs, setOriginInputs] = useState({});
    const [products, setProducts] = useState([]);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({
        name: '',
        productId: '',
        price: 0,
        quota: 0,
        currency: 'USD',
    });
    const formApiRef = useRef(null);

    useEffect(() => {
        if (props.options && formApiRef.current) {
            const currentInputs = {
                CreemApiKey: props.options.CreemApiKey || '',
                CreemWebhookSecret: props.options.CreemWebhookSecret || '',
                CreemProducts: props.options.CreemProducts || '[]',
                CreemTestMode: props.options.CreemTestMode === 'true',
            };
            setInputs(currentInputs);
            setOriginInputs({ ...currentInputs });
            formApiRef.current.setValues(currentInputs);

            // Parse products
            try {
                const parsedProducts = JSON.parse(currentInputs.CreemProducts);
                setProducts(parsedProducts);
            } catch (e) {
                setProducts([]);
            }
        }
    }, [props.options]);

    const handleFormChange = (values) => {
        setInputs(values);
    };

    const submitCreemSetting = async () => {
        setLoading(true);
        try {
            const options = [];

            if (inputs.CreemApiKey && inputs.CreemApiKey !== '') {
                options.push({ key: 'CreemApiKey', value: inputs.CreemApiKey });
            }

            if (inputs.CreemWebhookSecret && inputs.CreemWebhookSecret !== '') {
                options.push({ key: 'CreemWebhookSecret', value: inputs.CreemWebhookSecret });
            }

            // Save test mode setting
            options.push({ key: 'CreemTestMode', value: inputs.CreemTestMode ? 'true' : 'false' });

            // Save products as JSON string
            options.push({ key: 'CreemProducts', value: JSON.stringify(products) });

            // 发送请求
            const requestQueue = options.map(opt =>
                API.put('/api/option/', {
                    key: opt.key,
                    value: opt.value,
                })
            );

            const results = await Promise.all(requestQueue);

            // 检查所有请求是否成功
            const errorResults = results.filter(res => !res.data.success);
            if (errorResults.length > 0) {
                errorResults.forEach(res => {
                    showError(res.data.message);
                });
            } else {
                showSuccess(t('更新成功'));
                // 更新本地存储的原始值
                setOriginInputs({ ...inputs });
                props.refresh?.();
            }
        } catch (error) {
            showError(t('更新失败'));
        }
        setLoading(false);
    };

    const openProductModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setProductForm({ ...product });
        } else {
            setEditingProduct(null);
            setProductForm({
                name: '',
                productId: '',
                price: 0,
                quota: 0,
                currency: 'USD',
            });
        }
        setShowProductModal(true);
    };

    const closeProductModal = () => {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductForm({
            name: '',
            productId: '',
            price: 0,
            quota: 0,
            currency: 'USD',
        });
    };

    const saveProduct = () => {
        if (!productForm.name || !productForm.productId || productForm.price <= 0 || productForm.quota <= 0 || !productForm.currency) {
            showError(t('请填写完整的产品信息'));
            return;
        }

        let newProducts = [...products];
        if (editingProduct) {
            // 编辑现有产品
            const index = newProducts.findIndex(p => p.productId === editingProduct.productId);
            if (index !== -1) {
                newProducts[index] = { ...productForm };
            }
        } else {
            // 添加新产品
            if (newProducts.find(p => p.productId === productForm.productId)) {
                showError(t('产品ID已存在'));
                return;
            }
            newProducts.push({ ...productForm });
        }

        setProducts(newProducts);
        closeProductModal();
    };

    const deleteProduct = (productId) => {
        const newProducts = products.filter(p => p.productId !== productId);
        setProducts(newProducts);
    };

    const columns = [
        {
            title: t('产品名称'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('产品ID'),
            dataIndex: 'productId',
            key: 'productId',
        },
        {
            title: t('展示价格'),
            dataIndex: 'price',
            key: 'price',
            render: (price, record) => `${record.currency === 'EUR' ? '€' : '$'}${price}`,
        },
        {
            title: t('充值额度'),
            dataIndex: 'quota',
            key: 'quota',
        },
        {
            title: t('操作'),
            key: 'action',
            render: (_, record) => (
                <div className='flex gap-2'>
                    <Button
                        type='tertiary'
                        size='small'
                        onClick={() => openProductModal(record)}
                    >
                        {t('编辑')}
                    </Button>
                    <Button
                        type='danger'
                        theme='borderless'
                        size='small'
                        icon={<Trash2 size={14} />}
                        onClick={() => deleteProduct(record.productId)}
                    />
                </div>
            ),
        },
    ];

    return (
        <Spin spinning={loading}>
            <Form
                initValues={inputs}
                onValueChange={handleFormChange}
                getFormApi={(api) => (formApiRef.current = api)}
            >
                <Form.Section text={t('Creem 设置')}>
                    <Text>
                        {t('Creem 介绍')}
                        <a
                            href='https://creem.io'
                            target='_blank'
                            rel='noreferrer'
                        >Creem Official Site</a>
                        <br />
                    </Text>
                    <Banner
                        type='info'
                        description={t('Creem Setting Tips')}
                    />

                    <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
                        <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                            <Form.Input
                                field='CreemApiKey'
                                label={t('API 密钥')}
                                placeholder={t('Creem API 密钥，敏感信息不显示')}
                                type='password'
                            />
                        </Col>
                        <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                            <Form.Input
                                field='CreemWebhookSecret'
                                label={t('Webhook 密钥')}
                                placeholder={t('用于验证回调 new-api 的 webhook 请求的密钥，敏感信息不显示')}
                                type='password'
                            />
                        </Col>
                        <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                            <Form.Switch
                                field='CreemTestMode'
                                label={t('测试模式')}
                                extraText={t('启用后将使用 Creem Test Mode')}
                            />
                        </Col>
                    </Row>

                    <div style={{ marginTop: 24 }}>
                        <div className='flex justify-between items-center mb-4'>
                            <Text strong>{t('产品配置')}</Text>
                            <Button
                                type='primary'
                                icon={<Plus size={16} />}
                                onClick={() => openProductModal()}
                            >
                                {t('添加产品')}
                            </Button>
                        </div>

                        <Table
                            columns={columns}
                            dataSource={products}
                            pagination={false}
                            empty={
                                <div className='text-center py-8'>
                                    <Text type='tertiary'>{t('暂无产品配置')}</Text>
                                </div>
                            }
                        />
                    </div>

                    <Button onClick={submitCreemSetting} style={{ marginTop: 16 }}>
                        {t('更新 Creem 设置')}
                    </Button>
                </Form.Section>
            </Form>

            {/* 产品配置模态框 */}
            <Modal
                title={editingProduct ? t('编辑产品') : t('添加产品')}
                visible={showProductModal}
                onOk={saveProduct}
                onCancel={closeProductModal}
                maskClosable={false}
                size='small'
                centered
            >
                <div className='space-y-4'>
                    <div>
                        <Text strong className='block mb-2'>
                            {t('产品名称')}
                        </Text>
                        <Input
                            value={productForm.name}
                            onChange={(value) => setProductForm({ ...productForm, name: value })}
                            placeholder={t('例如：基础套餐')}
                            size='large'
                        />
                    </div>
                    <div>
                        <Text strong className='block mb-2'>
                            {t('产品ID')}
                        </Text>
                        <Input
                            value={productForm.productId}
                            onChange={(value) => setProductForm({ ...productForm, productId: value })}
                            placeholder={t('例如：prod_6I8rBerHpPxyoiU9WK4kot')}
                            size='large'
                            disabled={!!editingProduct}
                        />
                    </div>
                    <div>
                        <Text strong className='block mb-2'>
                            {t('货币')}
                        </Text>
                        <Select
                            value={productForm.currency}
                            onChange={(value) => setProductForm({ ...productForm, currency: value })}
                            size='large'
                            className='w-full'
                        >
                            <Select.Option value='USD'>{t('USD (美元)')}</Select.Option>
                            <Select.Option value='EUR'>{t('EUR (欧元)')}</Select.Option>
                        </Select>
                    </div>
                    <div>
                        <Text strong className='block mb-2'>
                            {t('价格')} ({productForm.currency === 'EUR' ? t('欧元') : t('美元')})
                        </Text>
                        <InputNumber
                            value={productForm.price}
                            onChange={(value) => setProductForm({ ...productForm, price: value })}
                            placeholder={t('例如：4.99')}
                            min={0.01}
                            precision={2}
                            size='large'
                            className='w-full'
                            defaultValue={4.49}
                        />
                    </div>
                    <div>
                        <Text strong className='block mb-2'>
                            {t('充值额度')}
                        </Text>
                        <InputNumber
                            value={productForm.quota}
                            onChange={(value) => setProductForm({ ...productForm, quota: value })}
                            placeholder={t('例如：100000')}
                            min={1}
                            precision={0}
                            size='large'
                            className='w-full'
                        />
                    </div>
                </div>
            </Modal>
        </Spin>
    );
}