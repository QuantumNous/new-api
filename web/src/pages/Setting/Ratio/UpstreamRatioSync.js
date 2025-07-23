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

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Button,
  Table,
  Tag,
  Empty,
  Checkbox,
  Form,
  Input,
  Tooltip,
  Select,
  Modal,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import {
  RefreshCcw,
  CheckSquare,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { API, showError, showSuccess, showWarning, stringToColor } from '../../../helpers';
import { useIsMobile } from '../../../hooks/common/useIsMobile.js';
import { DEFAULT_ENDPOINT } from '../../../constants';
import { useTranslation } from 'react-i18next';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import ChannelSelectorModal from '../../../components/settings/ChannelSelectorModal';

function ConflictConfirmModal({ t, visible, items, onOk, onCancel }) {
  const isMobile = useIsMobile();
  const columns = [
    { title: t('渠道'), dataIndex: 'channel' },
    { title: t('模型'), dataIndex: 'model' },
    {
      title: t('当前计费'),
      dataIndex: 'current',
      render: (text) => <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>,
    },
    {
      title: t('修改为'),
      dataIndex: 'newVal',
      render: (text) => <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>,
    },
  ];

  return (
    <Modal
      title={t('确认冲突项修改')}
      visible={visible}
      onCancel={onCancel}
      onOk={onOk}
      size={isMobile ? 'full-width' : 'large'}
    >
      <Table columns={columns} dataSource={items} pagination={false} size="small" />
    </Modal>
  );
}

export default function UpstreamRatioSync(props) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const isMobile = useIsMobile();

  // 渠道选择相关
  const [allChannels, setAllChannels] = useState([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);

  // 渠道端点配置
  const [channelEndpoints, setChannelEndpoints] = useState({}); // { channelId: endpoint }

  // 差异数据和测试结果
  const [differences, setDifferences] = useState({});
  const [resolutions, setResolutions] = useState({});

  // 是否已经执行过同步
  const [hasSynced, setHasSynced] = useState(false);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState('');

  // 倍率类型过滤
  const [ratioTypeFilter, setRatioTypeFilter] = useState('');

  // 冲突确认弹窗相关
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [conflictItems, setConflictItems] = useState([]); // {channel, model, current, newVal, ratioType}

  const channelSelectorRef = React.useRef(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [ratioTypeFilter, searchKeyword]);

  const fetchAllChannels = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/ratio_sync/channels');

      if (res.data.success) {
        const channels = res.data.data || [];

        const transferData = channels.map(channel => ({
          key: channel.id,
          label: channel.name,
          value: channel.id,
          disabled: false,
          _originalData: channel,
        }));

        setAllChannels(transferData);

        // 合并已有 endpoints，避免每次打开弹窗都重置
        setChannelEndpoints(prev => {
          const merged = { ...prev };
          transferData.forEach(channel => {
            if (!merged[channel.key]) {
              merged[channel.key] = DEFAULT_ENDPOINT;
            }
          });
          return merged;
        });
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取渠道失败：') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmChannelSelection = () => {
    const selected = allChannels
      .filter(ch => selectedChannelIds.includes(ch.value))
      .map(ch => ch._originalData);

    if (selected.length === 0) {
      showWarning(t('请至少选择一个渠道'));
      return;
    }

    setModalVisible(false);
    fetchRatiosFromChannels(selected);
  };

  const fetchRatiosFromChannels = async (channelList) => {
    setSyncLoading(true);

    const upstreams = channelList.map(ch => ({
      id: ch.id,
      name: ch.name,
      base_url: ch.base_url,
      endpoint: channelEndpoints[ch.id] || DEFAULT_ENDPOINT,
    }));

    const payload = {
      upstreams: upstreams,
      timeout: 10,
    };

    try {
      const res = await API.post('/api/ratio_sync/fetch', payload);

      if (!res.data.success) {
        showError(res.data.message || t('后端请求失败'));
        setSyncLoading(false);
        return;
      }

      const { differences = {}, test_results = [] } = res.data.data;

      const errorResults = test_results.filter(r => r.status === 'error');
      if (errorResults.length > 0) {
        showWarning(t('部分渠道测试失败：') + errorResults.map(r => `${r.name}: ${r.error}`).join(', '));
      }

      setDifferences(differences);
      setResolutions({});
      setHasSynced(true);

      if (Object.keys(differences).length === 0) {
        showSuccess(t('未找到差异化倍率，无需同步'));
      }
    } catch (e) {
      showError(t('请求后端接口失败：') + e.message);
    } finally {
      setSyncLoading(false);
    }
  };

  function getBillingCategory(ratioType) {
    return ratioType === 'model_price' ? 'price' : 'ratio';
  }

  const selectValue = useCallback((model, ratioType, value) => {
    const category = getBillingCategory(ratioType);

    setResolutions(prev => {
      const newModelRes = { ...(prev[model] || {}) };

      Object.keys(newModelRes).forEach((rt) => {
        if (getBillingCategory(rt) !== category) {
          delete newModelRes[rt];
        }
      });

      newModelRes[ratioType] = value;

      return {
        ...prev,
        [model]: newModelRes,
      };
    });
  }, [setResolutions]);

  const applySync = async () => {
    const currentRatios = {
      ModelRatio: JSON.parse(props.options.ModelRatio || '{}'),
      CompletionRatio: JSON.parse(props.options.CompletionRatio || '{}'),
      CacheRatio: JSON.parse(props.options.CacheRatio || '{}'),
      ModelPrice: JSON.parse(props.options.ModelPrice || '{}'),
    };

    const conflicts = [];

    const getLocalBillingCategory = (model) => {
      if (currentRatios.ModelPrice[model] !== undefined) return 'price';
      if (currentRatios.ModelRatio[model] !== undefined ||
        currentRatios.CompletionRatio[model] !== undefined ||
        currentRatios.CacheRatio[model] !== undefined) return 'ratio';
      return null;
    };

    const findSourceChannel = (model, ratioType, value) => {
      if (differences[model] && differences[model][ratioType]) {
        const upMap = differences[model][ratioType].upstreams || {};
        const entry = Object.entries(upMap).find(([_, v]) => v === value);
        if (entry) return entry[0];
      }
      return t('未知');
    };

    Object.entries(resolutions).forEach(([model, ratios]) => {
      const localCat = getLocalBillingCategory(model);
      const newCat = 'model_price' in ratios ? 'price' : 'ratio';

      if (localCat && localCat !== newCat) {
        const currentDesc = localCat === 'price'
          ? `${t('固定价格')} : ${currentRatios.ModelPrice[model]}`
          : `${t('模型倍率')} : ${currentRatios.ModelRatio[model] ?? '-'}\n${t('补全倍率')} : ${currentRatios.CompletionRatio[model] ?? '-'}`;

        let newDesc = '';
        if (newCat === 'price') {
          newDesc = `${t('固定价格')} : ${ratios['model_price']}`;
        } else {
          const newModelRatio = ratios['model_ratio'] ?? '-';
          const newCompRatio = ratios['completion_ratio'] ?? '-';
          newDesc = `${t('模型倍率')} : ${newModelRatio}\n${t('补全倍率')} : ${newCompRatio}`;
        }

        const channels = Object.entries(ratios)
          .map(([rt, val]) => findSourceChannel(model, rt, val))
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(', ');

        conflicts.push({
          channel: channels,
          model,
          current: currentDesc,
          newVal: newDesc,
        });
      }
    });

    if (conflicts.length > 0) {
      setConflictItems(conflicts);
      setConfirmVisible(true);
      return;
    }

    await performSync(currentRatios);
  };

  const performSync = useCallback(async (currentRatios) => {
    const finalRatios = {
      ModelRatio: { ...currentRatios.ModelRatio },
      CompletionRatio: { ...currentRatios.CompletionRatio },
      CacheRatio: { ...currentRatios.CacheRatio },
      ModelPrice: { ...currentRatios.ModelPrice },
    };

    Object.entries(resolutions).forEach(([model, ratios]) => {
      const selectedTypes = Object.keys(ratios);
      const hasPrice = selectedTypes.includes('model_price');
      const hasRatio = selectedTypes.some(rt => rt !== 'model_price');

      if (hasPrice) {
        delete finalRatios.ModelRatio[model];
        delete finalRatios.CompletionRatio[model];
        delete finalRatios.CacheRatio[model];
      }
      if (hasRatio) {
        delete finalRatios.ModelPrice[model];
      }

      Object.entries(ratios).forEach(([ratioType, value]) => {
        const optionKey = ratioType
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
        finalRatios[optionKey][model] = parseFloat(value);
      });
    });

    setLoading(true);
    try {
      const updates = Object.entries(finalRatios).map(([key, value]) =>
        API.put('/api/option/', {
          key,
          value: JSON.stringify(value, null, 2),
        })
      );

      const results = await Promise.all(updates);

      if (results.every(res => res.data.success)) {
        showSuccess(t('同步成功'));
        props.refresh();

        setDifferences(prevDifferences => {
          const newDifferences = { ...prevDifferences };

          Object.entries(resolutions).forEach(([model, ratios]) => {
            Object.keys(ratios).forEach(ratioType => {
              if (newDifferences[model] && newDifferences[model][ratioType]) {
                delete newDifferences[model][ratioType];

                if (Object.keys(newDifferences[model]).length === 0) {
                  delete newDifferences[model];
                }
              }
            });
          });

          return newDifferences;
        });

        setResolutions({});
      } else {
        showError(t('部分保存失败'));
      }
    } catch (error) {
      showError(t('保存失败'));
    } finally {
      setLoading(false);
    }
  }, [resolutions, props.options, props.refresh]);

  const getCurrentPageData = (dataSource) => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return dataSource.slice(startIndex, endIndex);
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            icon={<RefreshCcw size={14} />}
            className="w-full md:w-auto mt-2"
            onClick={() => {
              setModalVisible(true);
              if (allChannels.length === 0) {
                fetchAllChannels();
              }
            }}
          >
            {t('选择同步渠道')}
          </Button>

          {(() => {
            const hasSelections = Object.keys(resolutions).length > 0;

            return (
              <Button
                icon={<CheckSquare size={14} />}
                type='secondary'
                onClick={applySync}
                disabled={!hasSelections}
                className="w-full md:w-auto mt-2"
              >
                {t('应用同步')}
              </Button>
            );
          })()}

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-2">
            <Input
              prefix={<IconSearch size={14} />}
              placeholder={t('搜索模型名称')}
              value={searchKeyword}
              onChange={setSearchKeyword}
              className="w-full sm:w-64"
              showClear
            />

            <Select
              placeholder={t('按倍率类型筛选')}
              value={ratioTypeFilter}
              onChange={setRatioTypeFilter}
              className="w-full sm:w-48"
              showClear
              onClear={() => setRatioTypeFilter('')}
            >
              <Select.Option value="model_ratio">{t('模型倍率')}</Select.Option>
              <Select.Option value="completion_ratio">{t('补全倍率')}</Select.Option>
              <Select.Option value="cache_ratio">{t('缓存倍率')}</Select.Option>
              <Select.Option value="model_price">{t('固定价格')}</Select.Option>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDifferenceTable = () => {
    const dataSource = useMemo(() => {
      const tmp = [];

      Object.entries(differences).forEach(([model, ratioTypes]) => {
        const hasPrice = 'model_price' in ratioTypes;
        const hasOtherRatio = ['model_ratio', 'completion_ratio', 'cache_ratio'].some(rt => rt in ratioTypes);
        const billingConflict = hasPrice && hasOtherRatio;

        Object.entries(ratioTypes).forEach(([ratioType, diff]) => {
          tmp.push({
            key: `${model}_${ratioType}`,
            model,
            ratioType,
            current: diff.current,
            upstreams: diff.upstreams,
            confidence: diff.confidence || {},
            billingConflict,
          });
        });
      });

      return tmp;
    }, [differences]);

    const filteredDataSource = useMemo(() => {
      if (!searchKeyword.trim() && !ratioTypeFilter) {
        return dataSource;
      }

      return dataSource.filter(item => {
        const matchesKeyword = !searchKeyword.trim() ||
          item.model.toLowerCase().includes(searchKeyword.toLowerCase().trim());

        const matchesRatioType = !ratioTypeFilter ||
          item.ratioType === ratioTypeFilter;

        return matchesKeyword && matchesRatioType;
      });
    }, [dataSource, searchKeyword, ratioTypeFilter]);

    const upstreamNames = useMemo(() => {
      const set = new Set();
      filteredDataSource.forEach((row) => {
        Object.keys(row.upstreams || {}).forEach((name) => set.add(name));
      });
      return Array.from(set);
    }, [filteredDataSource]);

    if (filteredDataSource.length === 0) {
      return (
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
          description={
            searchKeyword.trim()
              ? t('未找到匹配的模型')
              : (Object.keys(differences).length === 0 ?
                (hasSynced ? t('暂无差异化倍率显示') : t('请先选择同步渠道'))
                : t('请先选择同步渠道'))
          }
          style={{ padding: 30 }}
        />
      );
    }

    const columns = [
      {
        title: t('模型'),
        dataIndex: 'model',
        fixed: 'left',
      },
      {
        title: t('倍率类型'),
        dataIndex: 'ratioType',
        render: (text, record) => {
          const typeMap = {
            model_ratio: t('模型倍率'),
            completion_ratio: t('补全倍率'),
            cache_ratio: t('缓存倍率'),
            model_price: t('固定价格'),
          };
          const baseTag = <Tag color={stringToColor(text)} shape="circle">{typeMap[text] || text}</Tag>;
          if (record?.billingConflict) {
            return (
              <div className="flex items-center gap-1">
                {baseTag}
                <Tooltip position="top" content={t('该模型存在固定价格与倍率计费方式冲突，请确认选择')}>
                  <AlertTriangle size={14} className="text-yellow-500" />
                </Tooltip>
              </div>
            );
          }
          return baseTag;
        },
      },
      {
        title: t('置信度'),
        dataIndex: 'confidence',
        render: (_, record) => {
          const allConfident = Object.values(record.confidence || {}).every(v => v !== false);

          if (allConfident) {
            return (
              <Tooltip content={t('所有上游数据均可信')}>
                <Tag color="green" shape="circle" type="light" prefixIcon={<CheckCircle size={14} />}>
                  {t('可信')}
                </Tag>
              </Tooltip>
            );
          } else {
            const untrustedSources = Object.entries(record.confidence || {})
              .filter(([_, isConfident]) => isConfident === false)
              .map(([name]) => name)
              .join(', ');

            return (
              <Tooltip content={t('以下上游数据可能不可信：') + untrustedSources}>
                <Tag color="yellow" shape="circle" type="light" prefixIcon={<AlertTriangle size={14} />}>
                  {t('谨慎')}
                </Tag>
              </Tooltip>
            );
          }
        },
      },
      {
        title: t('当前值'),
        dataIndex: 'current',
        render: (text) => (
          <Tag color={text !== null && text !== undefined ? 'blue' : 'default'} shape="circle">
            {text !== null && text !== undefined ? text : t('未设置')}
          </Tag>
        ),
      },
      ...upstreamNames.map((upName) => {
        const channelStats = (() => {
          let selectableCount = 0;
          let selectedCount = 0;

          filteredDataSource.forEach((row) => {
            const upstreamVal = row.upstreams?.[upName];
            if (upstreamVal !== null && upstreamVal !== undefined && upstreamVal !== 'same') {
              selectableCount++;
              const isSelected = resolutions[row.model]?.[row.ratioType] === upstreamVal;
              if (isSelected) {
                selectedCount++;
              }
            }
          });

          return {
            selectableCount,
            selectedCount,
            allSelected: selectableCount > 0 && selectedCount === selectableCount,
            partiallySelected: selectedCount > 0 && selectedCount < selectableCount,
            hasSelectableItems: selectableCount > 0
          };
        })();

        const handleBulkSelect = (checked) => {
          if (checked) {
            filteredDataSource.forEach((row) => {
              const upstreamVal = row.upstreams?.[upName];
              if (upstreamVal !== null && upstreamVal !== undefined && upstreamVal !== 'same') {
                selectValue(row.model, row.ratioType, upstreamVal);
              }
            });
          } else {
            setResolutions((prev) => {
              const newRes = { ...prev };
              filteredDataSource.forEach((row) => {
                if (newRes[row.model]) {
                  delete newRes[row.model][row.ratioType];
                  if (Object.keys(newRes[row.model]).length === 0) {
                    delete newRes[row.model];
                  }
                }
              });
              return newRes;
            });
          }
        };

        return {
          title: channelStats.hasSelectableItems ? (
            <Checkbox
              checked={channelStats.allSelected}
              indeterminate={channelStats.partiallySelected}
              onChange={(e) => handleBulkSelect(e.target.checked)}
            >
              {upName}
            </Checkbox>
          ) : (
            <span>{upName}</span>
          ),
          dataIndex: upName,
          render: (_, record) => {
            const upstreamVal = record.upstreams?.[upName];
            const isConfident = record.confidence?.[upName] !== false;

            if (upstreamVal === null || upstreamVal === undefined) {
              return <Tag color="default" shape="circle">{t('未设置')}</Tag>;
            }

            if (upstreamVal === 'same') {
              return <Tag color="blue" shape="circle">{t('与本地相同')}</Tag>;
            }

            const isSelected = resolutions[record.model]?.[record.ratioType] === upstreamVal;

            return (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    if (isChecked) {
                      selectValue(record.model, record.ratioType, upstreamVal);
                    } else {
                      setResolutions((prev) => {
                        const newRes = { ...prev };
                        if (newRes[record.model]) {
                          delete newRes[record.model][record.ratioType];
                          if (Object.keys(newRes[record.model]).length === 0) {
                            delete newRes[record.model];
                          }
                        }
                        return newRes;
                      });
                    }
                  }}
                >
                  {upstreamVal}
                </Checkbox>
                {!isConfident && (
                  <Tooltip position='left' content={t('该数据可能不可信，请谨慎使用')}>
                    <AlertTriangle size={16} className="text-yellow-500" />
                  </Tooltip>
                )}
              </div>
            );
          },
        };
      }),
    ];

    return (
      <Table
        columns={columns}
        dataSource={getCurrentPageData(filteredDataSource)}
        pagination={{
          currentPage: currentPage,
          pageSize: pageSize,
          total: filteredDataSource.length,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['5', '10', '20', '50'],
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          },
          onShowSizeChange: (current, size) => {
            setCurrentPage(1);
            setPageSize(size);
          }
        }}
        scroll={{ x: 'max-content' }}
        size='middle'
        loading={loading || syncLoading}
      />
    );
  };

  const updateChannelEndpoint = useCallback((channelId, endpoint) => {
    setChannelEndpoints(prev => ({ ...prev, [channelId]: endpoint }));
  }, []);

  const handleModalClose = () => {
    setModalVisible(false);
    if (channelSelectorRef.current) {
      channelSelectorRef.current.resetPagination();
    }
  };

  return (
    <>
      <Form.Section text={renderHeader()}>
        {renderDifferenceTable()}
      </Form.Section>

      <ChannelSelectorModal
        ref={channelSelectorRef}
        t={t}
        visible={modalVisible}
        onCancel={handleModalClose}
        onOk={confirmChannelSelection}
        allChannels={allChannels}
        selectedChannelIds={selectedChannelIds}
        setSelectedChannelIds={setSelectedChannelIds}
        channelEndpoints={channelEndpoints}
        updateChannelEndpoint={updateChannelEndpoint}
      />

      <ConflictConfirmModal
        t={t}
        visible={confirmVisible}
        items={conflictItems}
        onOk={async () => {
          setConfirmVisible(false);
          const curRatios = {
            ModelRatio: JSON.parse(props.options.ModelRatio || '{}'),
            CompletionRatio: JSON.parse(props.options.CompletionRatio || '{}'),
            CacheRatio: JSON.parse(props.options.CacheRatio || '{}'),
            ModelPrice: JSON.parse(props.options.ModelPrice || '{}'),
          };
          await performSync(curRatios);
        }}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
} 