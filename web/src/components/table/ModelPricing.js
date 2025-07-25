import React, { useContext, useEffect, useRef, useMemo, useState } from 'react';
import { API, copy, showError, showInfo, showSuccess, getModelCategories, renderModelTag, stringToColor } from '../../helpers';
import { useTranslation } from 'react-i18next';

import {
  Input,
  Layout,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Popover,
  ImagePreview,
  Button,
  Card,
  Tabs,
  TabPane,
  Empty,
  Switch,
  Select
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import {
  IconVerify,
  IconHelpCircle,
  IconSearch,
  IconCopy,
  IconInfoCircle,
  IconLayers
} from '@douyinfe/semi-icons';
import { UserContext } from '../../context/User/index.js';
import { AlertCircle } from 'lucide-react';
import { StatusContext } from '../../context/Status/index.js';

const ModelPricing = () => {
  const { t } = useTranslation();
  const [filteredValue, setFilteredValue] = useState([]);
  const compositionRef = useRef({ isComposition: false });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('default');
  const [activeKey, setActiveKey] = useState('all');
  const [pageSize, setPageSize] = useState(10);

  const [currency, setCurrency] = useState('USD');
  const [showWithRecharge, setShowWithRecharge] = useState(false);
  const [tokenUnit, setTokenUnit] = useState('M');
  const [statusState] = useContext(StatusContext);
  // 充值汇率（price）与美元兑人民币汇率（usd_exchange_rate）
  const priceRate = useMemo(() => statusState?.status?.price ?? 1, [statusState]);
  const usdExchangeRate = useMemo(() => statusState?.status?.usd_exchange_rate ?? priceRate, [statusState, priceRate]);

  const rowSelection = useMemo(
    () => ({
      onChange: (selectedRowKeys, selectedRows) => {
        setSelectedRowKeys(selectedRowKeys);
      },
    }),
    [],
  );

  const handleChange = (value) => {
    if (compositionRef.current.isComposition) {
      return;
    }
    const newFilteredValue = value ? [value] : [];
    setFilteredValue(newFilteredValue);
  };

  const handleCompositionStart = () => {
    compositionRef.current.isComposition = true;
  };

  const handleCompositionEnd = (event) => {
    compositionRef.current.isComposition = false;
    const value = event.target.value;
    const newFilteredValue = value ? [value] : [];
    setFilteredValue(newFilteredValue);
  };

  function renderQuotaType(type) {
    switch (type) {
      case 1:
        return (
          <Tag color='teal' shape='circle'>
            {t('按次计费')}
          </Tag>
        );
      case 0:
        return (
          <Tag color='violet' shape='circle'>
            {t('按量计费')}
          </Tag>
        );
      default:
        return t('未知');
    }
  }

  function renderAvailable(available) {
    return available ? (
      <Popover
        content={
          <div style={{ padding: 8 }}>{t('您的分组可以使用该模型')}</div>
        }
        position='top'
        key={available}
        className="bg-green-50"
      >
        <IconVerify style={{ color: 'rgb(22 163 74)' }} size='large' />
      </Popover>
    ) : null;
  }

  function renderSupportedEndpoints(endpoints) {
    if (!endpoints || endpoints.length === 0) {
      return null;
    }
    return (
      <Space wrap>
        {endpoints.map((endpoint, idx) => (
          <Tag
            key={endpoint}
            color={stringToColor(endpoint)}
            shape='circle'
          >
            {endpoint}
          </Tag>
        ))}
      </Space>
    );
  }

  const displayPrice = (usdPrice) => {
    let priceInUSD = usdPrice;
    if (showWithRecharge) {
      priceInUSD = usdPrice * priceRate / usdExchangeRate;
    }

    if (currency === 'CNY') {
      return `¥${(priceInUSD * usdExchangeRate).toFixed(3)}`;
    }
    return `$${priceInUSD.toFixed(3)}`;
  };

  const columns = [
    {
      title: t('可用性'),
      dataIndex: 'available',
      render: (text, record, index) => {
        return renderAvailable(record.enable_groups.includes(selectedGroup));
      },
      sorter: (a, b) => {
        const aAvailable = a.enable_groups.includes(selectedGroup);
        const bAvailable = b.enable_groups.includes(selectedGroup);
        return Number(aAvailable) - Number(bAvailable);
      },
      defaultSortOrder: 'descend',
    },
    {
      title: t('可用端点类型'),
      dataIndex: 'supported_endpoint_types',
      render: (text, record, index) => {
        return renderSupportedEndpoints(text);
      },
    },
    {
      title: t('模型名称'),
      dataIndex: 'model_name',
      render: (text, record, index) => {
        return renderModelTag(text, {
          onClick: () => {
            copyText(text);
          }
        });
      },
      onFilter: (value, record) =>
        record.model_name.toLowerCase().includes(value.toLowerCase()),
      filteredValue,
    },
    {
      title: t('计费类型'),
      dataIndex: 'quota_type',
      render: (text, record, index) => {
        return renderQuotaType(parseInt(text));
      },
      sorter: (a, b) => a.quota_type - b.quota_type,
    },
    {
      title: t('可用分组'),
      dataIndex: 'enable_groups',
      render: (text, record, index) => {
        return (
          <Space wrap>
            {text.map((group) => {
              if (usableGroup[group]) {
                if (group === selectedGroup) {
                  return (
                    <Tag color='blue' shape='circle' prefixIcon={<IconVerify />}>
                      {group}
                    </Tag>
                  );
                } else {
                  return (
                    <Tag
                      color='blue'
                      shape='circle'
                      onClick={() => {
                        setSelectedGroup(group);
                        showInfo(
                          t('当前查看的分组为：{{group}}，倍率为：{{ratio}}', {
                            group: group,
                            ratio: groupRatio[group],
                          }),
                        );
                      }}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {group}
                    </Tag>
                  );
                }
              }
            })}
          </Space>
        );
      },
    },
    {
      title: () => (
        <div className="flex items-center space-x-1">
          <span>{t('倍率')}</span>
          <Tooltip content={t('倍率是为了方便换算不同价格的模型')}>
            <IconHelpCircle
              className="text-blue-500 cursor-pointer"
              onClick={() => {
                setModalImageUrl('/ratio.png');
                setIsModalOpenurl(true);
              }}
            />
          </Tooltip>
        </div>
      ),
      dataIndex: 'model_ratio',
      render: (text, record, index) => {
        let content = text;
        let completionRatio = parseFloat(record.completion_ratio.toFixed(3));
        content = (
          <div className="space-y-1">
            <div className="text-gray-700">
              {t('模型倍率')}：{record.quota_type === 0 ? text : t('无')}
            </div>
            <div className="text-gray-700">
              {t('补全倍率')}：
              {record.quota_type === 0 ? completionRatio : t('无')}
            </div>
            <div className="text-gray-700">
              {t('分组倍率')}：{groupRatio[selectedGroup]}
            </div>
          </div>
        );
        return content;
      },
    },
    {
      title: (
        <div className="flex items-center space-x-2">
          <span>{t('模型价格')}</span>
          {/* 计费单位切换 */}
          <Switch
            checked={tokenUnit === 'K'}
            onChange={(checked) => setTokenUnit(checked ? 'K' : 'M')}
            checkedText="K"
            uncheckedText="M"
          />
        </div>
      ),
      dataIndex: 'model_price',
      render: (text, record, index) => {
        let content = text;
        if (record.quota_type === 0) {
          let inputRatioPriceUSD = record.model_ratio * 2 * groupRatio[selectedGroup];
          let completionRatioPriceUSD =
            record.model_ratio * record.completion_ratio * 2 * groupRatio[selectedGroup];

          const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
          const unitLabel = tokenUnit === 'K' ? 'K' : 'M';

          let displayInput = displayPrice(inputRatioPriceUSD);
          let displayCompletion = displayPrice(completionRatioPriceUSD);

          const divisor = unitDivisor;
          const numInput = parseFloat(displayInput.replace(/[^0-9.]/g, '')) / divisor;
          const numCompletion = parseFloat(displayCompletion.replace(/[^0-9.]/g, '')) / divisor;

          displayInput = `${currency === 'CNY' ? '¥' : '$'}${numInput.toFixed(3)}`;
          displayCompletion = `${currency === 'CNY' ? '¥' : '$'}${numCompletion.toFixed(3)}`;
          content = (
            <div className="space-y-1">
              <div className="text-gray-700">
                {t('提示')} {displayInput} / 1{unitLabel} tokens
              </div>
              <div className="text-gray-700">
                {t('补全')} {displayCompletion} / 1{unitLabel} tokens
              </div>
            </div>
          );
        } else {
          let priceUSD = parseFloat(text) * groupRatio[selectedGroup];
          let displayVal = displayPrice(priceUSD);
          content = (
            <div className="text-gray-700">
              {t('模型价格')}：{displayVal}
            </div>
          );
        }
        return content;
      },
    },
  ];

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userState] = useContext(UserContext);
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroup, setUsableGroup] = useState({});

  const setModelsFormat = (models, groupRatio) => {
    for (let i = 0; i < models.length; i++) {
      models[i].key = models[i].model_name;
      models[i].group_ratio = groupRatio[models[i].model_name];
    }
    models.sort((a, b) => {
      return a.quota_type - b.quota_type;
    });

    models.sort((a, b) => {
      if (a.model_name.startsWith('gpt') && !b.model_name.startsWith('gpt')) {
        return -1;
      } else if (
        !a.model_name.startsWith('gpt') &&
        b.model_name.startsWith('gpt')
      ) {
        return 1;
      } else {
        return a.model_name.localeCompare(b.model_name);
      }
    });

    setModels(models);
  };

  const loadPricing = async () => {
    setLoading(true);
    let url = '/api/pricing';
    const res = await API.get(url);
    const { success, message, data, group_ratio, usable_group } = res.data;
    if (success) {
      setGroupRatio(group_ratio);
      setUsableGroup(usable_group);
      setSelectedGroup(userState.user ? userState.user.group : 'default');
      setModelsFormat(data, group_ratio);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const refresh = async () => {
    await loadPricing();
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  useEffect(() => {
    refresh().then();
  }, []);

  const modelCategories = getModelCategories(t);

  const categoryCounts = useMemo(() => {
    const counts = {};
    if (models.length > 0) {
      counts['all'] = models.length;

      Object.entries(modelCategories).forEach(([key, category]) => {
        if (key !== 'all') {
          counts[key] = models.filter(model => category.filter(model)).length;
        }
      });
    }
    return counts;
  }, [models, modelCategories]);

  const availableCategories = useMemo(() => {
    if (!models.length) return ['all'];

    return Object.entries(modelCategories).filter(([key, category]) => {
      if (key === 'all') return true;
      return models.some(model => category.filter(model));
    }).map(([key]) => key);
  }, [models]);

  const renderTabs = () => {
    return (
      <Tabs
        activeKey={activeKey}
        type="card"
        collapsible
        onChange={key => setActiveKey(key)}
        className="mt-2"
      >
        {Object.entries(modelCategories)
          .filter(([key]) => availableCategories.includes(key))
          .map(([key, category]) => {
            const modelCount = categoryCounts[key] || 0;

            return (
              <TabPane
                tab={
                  <span className="flex items-center gap-2">
                    {category.icon && <span className="w-4 h-4">{category.icon}</span>}
                    {category.label}
                    <Tag
                      color={activeKey === key ? 'red' : 'grey'}
                      shape='circle'
                    >
                      {modelCount}
                    </Tag>
                  </span>
                }
                itemKey={key}
                key={key}
              />
            );
          })}
      </Tabs>
    );
  };

  const filteredModels = useMemo(() => {
    let result = models;

    if (activeKey !== 'all') {
      result = result.filter(model => modelCategories[activeKey].filter(model));
    }

    if (filteredValue.length > 0) {
      const searchTerm = filteredValue[0].toLowerCase();
      result = result.filter(model =>
        model.model_name.toLowerCase().includes(searchTerm)
      );
    }

    return result;
  }, [activeKey, models, filteredValue]);

  const SearchAndActions = useMemo(() => (
    <Card className="!rounded-xl mb-6" bordered={false}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            prefix={<IconSearch />}
            placeholder={t('模糊搜索模型名称')}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onChange={handleChange}
            showClear
          />
        </div>
        <Button
          theme='light'
          type='primary'
          icon={<IconCopy />}
          onClick={() => copyText(selectedRowKeys)}
          disabled={selectedRowKeys.length === 0}
          className="!bg-blue-500 hover:!bg-blue-600 text-white"
        >
          {t('复制选中模型')}
        </Button>

        {/* 充值价格显示开关 */}
        <Space align="center">
          <span>{t('以充值价格显示')}</span>
          <Switch
            checked={showWithRecharge}
            onChange={setShowWithRecharge}
            size="small"
          />
          {showWithRecharge && (
            <Select
              value={currency}
              onChange={setCurrency}
              size="small"
              style={{ width: 100 }}
            >
              <Select.Option value="USD">USD ($)</Select.Option>
              <Select.Option value="CNY">CNY (¥)</Select.Option>
            </Select>
          )}
        </Space>
      </div>
    </Card>
  ), [selectedRowKeys, t, showWithRecharge, currency]);

  const ModelTable = useMemo(() => (
    <Card className="!rounded-xl overflow-hidden" bordered={false}>
      <Table
        columns={columns}
        dataSource={filteredModels}
        loading={loading}
        rowSelection={rowSelection}
        className="custom-table"
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
            description={t('搜索无结果')}
            style={{ padding: 30 }}
          />
        }
        pagination={{
          defaultPageSize: 10,
          pageSize: pageSize,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          formatPageText: (page) =>
            t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
              start: page.currentStart,
              end: page.currentEnd,
              total: filteredModels.length,
            }),
          onPageSizeChange: (size) => setPageSize(size),
        }}
      />
    </Card>
  ), [filteredModels, loading, columns, rowSelection, pageSize, t]);

  return (
    <div className="bg-gray-50">
      <Layout>
        <Layout.Content>
          <div className="flex justify-center">
            <div className="w-full">
              {/* 主卡片容器 */}
              <Card bordered={false} className="!rounded-2xl shadow-lg border-0">
                {/* 顶部状态卡片 */}
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

                {/* 模型分类 Tabs */}
                <div className="mb-6">
                  {renderTabs()}

                  {/* 搜索和表格区域 */}
                  {SearchAndActions}
                  {ModelTable}
                </div>

                {/* 倍率说明图预览 */}
                <ImagePreview
                  src={modalImageUrl}
                  visible={isModalOpenurl}
                  onVisibleChange={(visible) => setIsModalOpenurl(visible)}
                />
              </Card>
            </div>
          </div>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default ModelPricing;
