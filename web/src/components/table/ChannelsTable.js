import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  timestamp2string,
  renderGroup,
  renderQuota,
  getChannelIcon,
  renderQuotaWithAmount
} from '../../helpers/index.js';
import { CHANNEL_OPTIONS, ITEMS_PER_PAGE, MODEL_TABLE_PAGE_SIZE } from '../../constants/index.js';
import {
  Button,
  Divider,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  Space,
  SplitButtonGroup,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Checkbox,
  Card,
  Form,
  Tabs,
  TabPane,
  Select
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import EditChannel from '../../pages/Channel/EditChannel.js';
import {
  IconTreeTriangleDown,
  IconSearch,
  IconMore,
  IconDescend2
} from '@douyinfe/semi-icons';
import { loadChannelModels, copy } from '../../helpers';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import EditTagModal from '../../pages/Channel/EditTagModal.js';
import { useTranslation } from 'react-i18next';
import { useTableCompactMode } from '../../hooks/useTableCompactMode';
import { FaRandom } from 'react-icons/fa';

const ChannelsTable = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  let type2label = undefined;

  const renderType = (type, channelInfo = undefined) => {
    if (!type2label) {
      type2label = new Map();
      for (let i = 0; i < CHANNEL_OPTIONS.length; i++) {
        type2label[CHANNEL_OPTIONS[i].value] = CHANNEL_OPTIONS[i];
      }
      type2label[0] = { value: 0, label: t('未知类型'), color: 'grey' };
    }

    let icon = getChannelIcon(type);

    if (channelInfo?.is_multi_key) {
      icon = (
        channelInfo?.multi_key_mode === 'random' ? (
          <div className="flex items-center gap-1">
            <FaRandom className="text-blue-500" />
            {icon}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <IconDescend2 className="text-blue-500" />
            {icon}
          </div>
        )
      )
    }

    return (
      <Tag
        color={type2label[type]?.color}
        shape='circle'
        prefixIcon={icon}
      >
        {type2label[type]?.label}
      </Tag>
    );
  };

  const renderTagType = () => {
    return (
      <Tag
        color='light-blue'
        shape='circle'
        type='light'
      >
        {t('标签聚合')}
      </Tag>
    );
  };

  const renderStatus = (status, channelInfo = undefined) => {
    if (channelInfo) {
      if (channelInfo.is_multi_key) {
        let keySize = channelInfo.multi_key_size;
        let enabledKeySize = keySize;
        if (channelInfo.multi_key_status_list) {
          // multi_key_status_list is a map, key is key, value is status
          // get multi_key_status_list length
          enabledKeySize = keySize - Object.keys(channelInfo.multi_key_status_list).length;
        }
        return renderMultiKeyStatus(status, keySize, enabledKeySize);
      }
    }
    switch (status) {
      case 1:
        return (
          <Tag color='green' shape='circle'>
            {t('已启用')}
          </Tag>
        );
      case 2:
        return (
          <Tag color='red' shape='circle'>
            {t('已禁用')}
          </Tag>
        );
      case 3:
        return (
          <Tag color='yellow' shape='circle'>
            {t('自动禁用')}
          </Tag>
        );
      default:
        return (
          <Tag color='grey' shape='circle'>
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const renderMultiKeyStatus = (status, keySize, enabledKeySize) => {
    switch (status) {
      case 1:
        return (
          <Tag color='green' shape='circle'>
            {t('已启用')} {enabledKeySize}/{keySize}
          </Tag>
        );
      case 2:
        return (
          <Tag color='red' shape='circle'>
            {t('已禁用')} {enabledKeySize}/{keySize}
          </Tag>
        );
      case 3:
        return (
          <Tag color='yellow' shape='circle'>
            {t('自动禁用')} {enabledKeySize}/{keySize}
          </Tag>
        );
      default:
        return (
          <Tag color='grey' shape='circle'>
            {t('未知状态')} {enabledKeySize}/{keySize}
          </Tag>
        );
    }
  }


  const renderResponseTime = (responseTime) => {
    let time = responseTime / 1000;
    time = time.toFixed(2) + t(' 秒');
    if (responseTime === 0) {
      return (
        <Tag color='grey' shape='circle'>
          {t('未测试')}
        </Tag>
      );
    } else if (responseTime <= 1000) {
      return (
        <Tag color='green' shape='circle'>
          {time}
        </Tag>
      );
    } else if (responseTime <= 3000) {
      return (
        <Tag color='lime' shape='circle'>
          {time}
        </Tag>
      );
    } else if (responseTime <= 5000) {
      return (
        <Tag color='yellow' shape='circle'>
          {time}
        </Tag>
      );
    } else {
      return (
        <Tag color='red' shape='circle'>
          {time}
        </Tag>
      );
    }
  };

  // Define column keys for selection
  const COLUMN_KEYS = {
    ID: 'id',
    NAME: 'name',
    GROUP: 'group',
    TYPE: 'type',
    STATUS: 'status',
    RESPONSE_TIME: 'response_time',
    BALANCE: 'balance',
    PRIORITY: 'priority',
    WEIGHT: 'weight',
    OPERATE: 'operate',
  };

  // State for column visibility
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // 状态筛选 all / enabled / disabled
  const [statusFilter, setStatusFilter] = useState(
    localStorage.getItem('channel-status-filter') || 'all'
  );

  // Load saved column preferences from localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem('channels-table-columns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        // Make sure all columns are accounted for
        const defaults = getDefaultColumnVisibility();
        const merged = { ...defaults, ...parsed };
        setVisibleColumns(merged);
      } catch (e) {
        console.error('Failed to parse saved column preferences', e);
        initDefaultColumns();
      }
    } else {
      initDefaultColumns();
    }
  }, []);

  // Update table when column visibility changes
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      // Save to localStorage
      localStorage.setItem(
        'channels-table-columns',
        JSON.stringify(visibleColumns),
      );
    }
  }, [visibleColumns]);

  // Get default column visibility
  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.ID]: true,
      [COLUMN_KEYS.NAME]: true,
      [COLUMN_KEYS.GROUP]: true,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.STATUS]: true,
      [COLUMN_KEYS.RESPONSE_TIME]: true,
      [COLUMN_KEYS.BALANCE]: true,
      [COLUMN_KEYS.PRIORITY]: true,
      [COLUMN_KEYS.WEIGHT]: true,
      [COLUMN_KEYS.OPERATE]: true,
    };
  };

  // Initialize default column visibility
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
  };

  // Handle column visibility change
  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  // Handle "Select All" checkbox
  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};

    allKeys.forEach((key) => {
      updatedColumns[key] = checked;
    });

    setVisibleColumns(updatedColumns);
  };

  // Define all columns with keys
  const allColumns = [
    {
      key: COLUMN_KEYS.ID,
      title: t('ID'),
      dataIndex: 'id',
    },
    {
      key: COLUMN_KEYS.NAME,
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => (
        <div>
          <Space spacing={2}>
            {text
              ?.split(',')
              .sort((a, b) => {
                if (a === 'default') return -1;
                if (b === 'default') return 1;
                return a.localeCompare(b);
              })
              .map((item, index) => renderGroup(item))}
          </Space>
        </div>
      ),
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record, index) => {
        if (record.children === undefined) {
          if (record.channel_info) {
            if (record.channel_info.is_multi_key) {
              return <>{renderType(text, record.channel_info)}</>;
            }
          }
          return <>{renderType(text)}</>;
        } else {
          return <>{renderTagType()}</>;
        }
      },
    },
    {
      key: COLUMN_KEYS.STATUS,
      title: t('状态'),
      dataIndex: 'status',
      render: (text, record, index) => {
        if (text === 3) {
          if (record.other_info === '') {
            record.other_info = '{}';
          }
          let otherInfo = JSON.parse(record.other_info);
          let reason = otherInfo['status_reason'];
          let time = otherInfo['status_time'];
          return (
            <div>
              <Tooltip
                content={t('原因：') + reason + t('，时间：') + timestamp2string(time)}
              >
                {renderStatus(text, record.channel_info)}
              </Tooltip>
            </div>
          );
        } else {
          return renderStatus(text, record.channel_info);
        }
      },
    },
    {
      key: COLUMN_KEYS.RESPONSE_TIME,
      title: t('响应时间'),
      dataIndex: 'response_time',
      render: (text, record, index) => (
        <div>{renderResponseTime(text)}</div>
      ),
    },
    {
      key: COLUMN_KEYS.BALANCE,
      title: t('已用/剩余'),
      dataIndex: 'expired_time',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return (
            <div>
              <Space spacing={1}>
                <Tooltip content={t('已用额度')}>
                  <Tag color='white' type='ghost' shape='circle'>
                    {renderQuota(record.used_quota)}
                  </Tag>
                </Tooltip>
                <Tooltip content={t('剩余额度$') + record.balance + t('，点击更新')}>
                  <Tag
                    color='white'
                    type='ghost'
                    shape='circle'
                    onClick={() => updateChannelBalance(record)}
                  >
                    {renderQuotaWithAmount(record.balance)}
                  </Tag>
                </Tooltip>
              </Space>
            </div>
          );
        } else {
          return (
            <Tooltip content={t('已用额度')}>
              <Tag color='white' type='ghost' shape='circle'>
                {renderQuota(record.used_quota)}
              </Tag>
            </Tooltip>
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.PRIORITY,
      title: t('优先级'),
      dataIndex: 'priority',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return (
            <div>
              <InputNumber
                style={{ width: 70 }}
                name='priority'
                onBlur={(e) => {
                  manageChannel(record.id, 'priority', record, e.target.value);
                }}
                keepFocus={true}
                innerButtons
                defaultValue={record.priority}
                min={-999}
                size="small"
              />
            </div>
          );
        } else {
          return (
            <InputNumber
              style={{ width: 70 }}
              name='priority'
              keepFocus={true}
              onBlur={(e) => {
                Modal.warning({
                  title: t('修改子渠道优先级'),
                  content: t('确定要修改所有子渠道优先级为 ') + e.target.value + t(' 吗？'),
                  onOk: () => {
                    if (e.target.value === '') {
                      return;
                    }
                    submitTagEdit('priority', {
                      tag: record.key,
                      priority: e.target.value,
                    });
                  },
                });
              }}
              innerButtons
              defaultValue={record.priority}
              min={-999}
              size="small"
            />
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.WEIGHT,
      title: t('权重'),
      dataIndex: 'weight',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return (
            <div>
              <InputNumber
                style={{ width: 70 }}
                name='weight'
                onBlur={(e) => {
                  manageChannel(record.id, 'weight', record, e.target.value);
                }}
                keepFocus={true}
                innerButtons
                defaultValue={record.weight}
                min={0}
                size="small"
              />
            </div>
          );
        } else {
          return (
            <InputNumber
              style={{ width: 70 }}
              name='weight'
              keepFocus={true}
              onBlur={(e) => {
                Modal.warning({
                  title: t('修改子渠道权重'),
                  content: t('确定要修改所有子渠道权重为 ') + e.target.value + t(' 吗？'),
                  onOk: () => {
                    if (e.target.value === '') {
                      return;
                    }
                    submitTagEdit('weight', {
                      tag: record.key,
                      weight: e.target.value,
                    });
                  },
                });
              }}
              innerButtons
              defaultValue={record.weight}
              min={-999}
              size="small"
            />
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.OPERATE,
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) => {
        if (record.children === undefined) {
          // 创建更多操作的下拉菜单项
          const moreMenuItems = [
            {
              node: 'item',
              name: t('删除'),
              type: 'danger',
              onClick: () => {
                Modal.confirm({
                  title: t('确定是否要删除此渠道？'),
                  content: t('此修改将不可逆'),
                  onOk: () => {
                    (async () => {
                      await manageChannel(record.id, 'delete', record);
                      await refresh();
                      setTimeout(() => {
                        if (channels.length === 0 && activePage > 1) {
                          refresh(activePage - 1);
                        }
                      }, 100);
                    })();
                  },
                });
              },
            },
            {
              node: 'item',
              name: t('复制'),
              type: 'tertiary',
              onClick: () => {
                Modal.confirm({
                  title: t('确定是否要复制此渠道？'),
                  content: t('复制渠道的所有信息'),
                  onOk: () => copySelectedChannel(record),
                });
              },
            },
          ];

          return (
            <Space wrap>
              <SplitButtonGroup
                className="overflow-hidden"
                aria-label={t('测试单个渠道操作项目组')}
              >
                <Button
                  size="small"
                  type='tertiary'
                  onClick={() => testChannel(record, '')}
                >
                  {t('测试')}
                </Button>
                <Button
                  size="small"
                  type='tertiary'
                  icon={<IconTreeTriangleDown />}
                  onClick={() => {
                    setCurrentTestChannel(record);
                    setShowModelTestModal(true);
                  }}
                />
              </SplitButtonGroup>

              {record.channel_info?.is_multi_key ? (
                <SplitButtonGroup
                  aria-label={t('多密钥渠道操作项目组')}
                >
                  {
                    record.status === 1 ? (
                      <Button
                        type='danger'
                        size="small"
                        onClick={() => manageChannel(record.id, 'disable', record)}
                      >
                        {t('禁用')}
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => manageChannel(record.id, 'enable', record)}
                      >
                        {t('启用')}
                      </Button>
                    )
                  }
                  <Dropdown
                    trigger='click'
                    position='bottomRight'
                    menu={[
                      {
                        node: 'item',
                        name: t('启用全部密钥'),
                        onClick: () => manageChannel(record.id, 'enable_all', record),
                      }
                    ]}
                  >
                    <Button
                      type='tertiary'
                      size="small"
                      icon={<IconTreeTriangleDown />}
                    />
                  </Dropdown>
                </SplitButtonGroup>
              ) : (
                record.status === 1 ? (
                  <Button
                    type='danger'
                    size="small"
                    onClick={() => manageChannel(record.id, 'disable', record)}
                  >
                    {t('禁用')}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    onClick={() => manageChannel(record.id, 'enable', record)}
                  >
                    {t('启用')}
                  </Button>
                )
              )}

              <Button
                type='tertiary'
                size="small"
                onClick={() => {
                  setEditingChannel(record);
                  setShowEdit(true);
                }}
              >
                {t('编辑')}
              </Button>

              <Dropdown
                trigger='click'
                position='bottomRight'
                menu={moreMenuItems}
              >
                <Button
                  icon={<IconMore />}
                  type='tertiary'
                  size="small"
                />
              </Dropdown>
            </Space>
          );
        } else {
          // 标签操作按钮
          return (
            <Space wrap>
              <Button
                type='tertiary'
                size="small"
                onClick={() => manageTag(record.key, 'enable')}
              >
                {t('启用全部')}
              </Button>
              <Button
                type='tertiary'
                size="small"
                onClick={() => manageTag(record.key, 'disable')}
              >
                {t('禁用全部')}
              </Button>
              <Button
                type='tertiary'
                size="small"
                onClick={() => {
                  setShowEditTag(true);
                  setEditingTag(record.key);
                }}
              >
                {t('编辑')}
              </Button>
            </Space>
          );
        }
      },
    },
  ];

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [idSort, setIdSort] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [channelCount, setChannelCount] = useState(pageSize);
  const [groupOptions, setGroupOptions] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [enableBatchDelete, setEnableBatchDelete] = useState(false);
  const [editingChannel, setEditingChannel] = useState({
    id: undefined,
  });
  const [showEditTag, setShowEditTag] = useState(false);
  const [editingTag, setEditingTag] = useState('');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [enableTagMode, setEnableTagMode] = useState(false);
  const [showBatchSetTag, setShowBatchSetTag] = useState(false);
  const [batchSetTagValue, setBatchSetTagValue] = useState('');
  const [showModelTestModal, setShowModelTestModal] = useState(false);
  const [currentTestChannel, setCurrentTestChannel] = useState(null);
  const [modelSearchKeyword, setModelSearchKeyword] = useState('');
  const [modelTestResults, setModelTestResults] = useState({});
  const [testingModels, setTestingModels] = useState(new Set());
  const [selectedModelKeys, setSelectedModelKeys] = useState([]);
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [testQueue, setTestQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [modelTablePage, setModelTablePage] = useState(1);
  const [activeTypeKey, setActiveTypeKey] = useState('all');
  const [typeCounts, setTypeCounts] = useState({});
  const requestCounter = useRef(0);
  const [formApi, setFormApi] = useState(null);
  const [compactMode, setCompactMode] = useTableCompactMode('channels');
  const formInitValues = {
    searchKeyword: '',
    searchGroup: '',
    searchModel: '',
  };
  const allSelectingRef = useRef(false);

  // Filter columns based on visibility settings
  const getVisibleColumns = () => {
    return allColumns.filter((column) => visibleColumns[column.key]);
  };

  // Column selector modal
  const renderColumnSelector = () => {
    return (
      <Modal
        title={t('列设置')}
        visible={showColumnSelector}
        onCancel={() => setShowColumnSelector(false)}
        footer={
          <div className="flex justify-end">
            <Button onClick={() => initDefaultColumns()}>
              {t('重置')}
            </Button>
            <Button onClick={() => setShowColumnSelector(false)}>
              {t('取消')}
            </Button>
            <Button onClick={() => setShowColumnSelector(false)}>
              {t('确定')}
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: 20 }}>
          <Checkbox
            checked={Object.values(visibleColumns).every((v) => v === true)}
            indeterminate={
              Object.values(visibleColumns).some((v) => v === true) &&
              !Object.values(visibleColumns).every((v) => v === true)
            }
            onChange={(e) => handleSelectAll(e.target.checked)}
          >
            {t('全选')}
          </Checkbox>
        </div>
        <div
          className="flex flex-wrap max-h-96 overflow-y-auto rounded-lg p-4"
          style={{ border: '1px solid var(--semi-color-border)' }}
        >
          {allColumns.map((column) => {
            // Skip columns without title
            if (!column.title) {
              return null;
            }

            return (
              <div
                key={column.key}
                className="w-1/2 mb-4 pr-2"
              >
                <Checkbox
                  checked={!!visibleColumns[column.key]}
                  onChange={(e) =>
                    handleColumnVisibilityChange(column.key, e.target.checked)
                  }
                >
                  {column.title}
                </Checkbox>
              </div>
            );
          })}
        </div>
      </Modal>
    );
  };

  const removeRecord = (record) => {
    let newDataSource = [...channels];
    if (record.id != null) {
      let idx = newDataSource.findIndex((data) => {
        if (data.children !== undefined) {
          for (let i = 0; i < data.children.length; i++) {
            if (data.children[i].id === record.id) {
              data.children.splice(i, 1);
              return false;
            }
          }
        } else {
          return data.id === record.id;
        }
      });

      if (idx > -1) {
        newDataSource.splice(idx, 1);
        setChannels(newDataSource);
      }
    }
  };

  const setChannelFormat = (channels, enableTagMode) => {
    let channelDates = [];
    let channelTags = {};
    for (let i = 0; i < channels.length; i++) {
      channels[i].key = '' + channels[i].id;
      if (!enableTagMode) {
        channelDates.push(channels[i]);
      } else {
        let tag = channels[i].tag ? channels[i].tag : '';
        // find from channelTags
        let tagIndex = channelTags[tag];
        let tagChannelDates = undefined;
        if (tagIndex === undefined) {
          // not found, create a new tag
          channelTags[tag] = 1;
          tagChannelDates = {
            key: tag,
            id: tag,
            tag: tag,
            name: '标签：' + tag,
            group: '',
            used_quota: 0,
            response_time: 0,
            priority: -1,
            weight: -1,
          };
          tagChannelDates.children = [];
          channelDates.push(tagChannelDates);
        } else {
          // found, add to the tag
          tagChannelDates = channelDates.find((item) => item.key === tag);
        }
        if (tagChannelDates.priority === -1) {
          tagChannelDates.priority = channels[i].priority;
        } else {
          if (tagChannelDates.priority !== channels[i].priority) {
            tagChannelDates.priority = '';
          }
        }
        if (tagChannelDates.weight === -1) {
          tagChannelDates.weight = channels[i].weight;
        } else {
          if (tagChannelDates.weight !== channels[i].weight) {
            tagChannelDates.weight = '';
          }
        }

        if (tagChannelDates.group === '') {
          tagChannelDates.group = channels[i].group;
        } else {
          let channelGroupsStr = channels[i].group;
          channelGroupsStr.split(',').forEach((item, index) => {
            if (tagChannelDates.group.indexOf(item) === -1) {
              // join
              tagChannelDates.group += ',' + item;
            }
          });
        }

        tagChannelDates.children.push(channels[i]);
        if (channels[i].status === 1) {
          tagChannelDates.status = 1;
        }
        tagChannelDates.used_quota += channels[i].used_quota;
        tagChannelDates.response_time += channels[i].response_time;
        tagChannelDates.response_time = tagChannelDates.response_time / 2;
      }
    }
    setChannels(channelDates);
  };

  const loadChannels = async (
    page,
    pageSize,
    idSort,
    enableTagMode,
    typeKey = activeTypeKey,
    statusF,
  ) => {
    if (statusF === undefined) statusF = statusFilter;

    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword !== '' || searchGroup !== '' || searchModel !== '') {
      setLoading(true);
      await searchChannels(enableTagMode, typeKey, statusF, page, pageSize, idSort);
      setLoading(false);
      return;
    }

    const reqId = ++requestCounter.current; // 记录当前请求序号
    setLoading(true);
    const typeParam = (typeKey !== 'all') ? `&type=${typeKey}` : '';
    const statusParam = statusF !== 'all' ? `&status=${statusF}` : '';
    const res = await API.get(
      `/api/channel/?p=${page}&page_size=${pageSize}&id_sort=${idSort}&tag_mode=${enableTagMode}${typeParam}${statusParam}`,
    );
    if (res === undefined || reqId !== requestCounter.current) {
      return;
    }
    const { success, message, data } = res.data;
    if (success) {
      const { items, total, type_counts } = data;
      if (type_counts) {
        const sumAll = Object.values(type_counts).reduce((acc, v) => acc + v, 0);
        setTypeCounts({ ...type_counts, all: sumAll });
      }
      setChannelFormat(items, enableTagMode);
      setChannelCount(total);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const copySelectedChannel = async (record) => {
    try {
      const res = await API.post(`/api/channel/copy/${record.id}`);
      if (res?.data?.success) {
        showSuccess(t('渠道复制成功'));
        await refresh();
      } else {
        showError(res?.data?.message || t('渠道复制失败'));
      }
    } catch (error) {
      showError(t('渠道复制失败: ') + (error?.response?.data?.message || error?.message || error));
    }
  };

  const refresh = async (page = activePage) => {
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      await loadChannels(page, pageSize, idSort, enableTagMode);
    } else {
      await searchChannels(enableTagMode, activeTypeKey, statusFilter, page, pageSize, idSort);
    }
  };

  useEffect(() => {
    const localIdSort = localStorage.getItem('id-sort') === 'true';
    const localPageSize =
      parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    const localEnableTagMode = localStorage.getItem('enable-tag-mode') === 'true';
    const localEnableBatchDelete = localStorage.getItem('enable-batch-delete') === 'true';
    setIdSort(localIdSort);
    setPageSize(localPageSize);
    setEnableTagMode(localEnableTagMode);
    setEnableBatchDelete(localEnableBatchDelete);
    loadChannels(1, localPageSize, localIdSort, localEnableTagMode)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    fetchGroups().then();
    loadChannelModels().then();
  }, []);

  const manageChannel = async (id, action, record, value) => {
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/channel/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/channel/', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/channel/', data);
        break;
      case 'priority':
        if (value === '') {
          return;
        }
        data.priority = parseInt(value);
        res = await API.put('/api/channel/', data);
        break;
      case 'weight':
        if (value === '') {
          return;
        }
        data.weight = parseInt(value);
        if (data.weight < 0) {
          data.weight = 0;
        }
        res = await API.put('/api/channel/', data);
        break;
      case 'enable_all':
        data.channel_info = record.channel_info;
        data.channel_info.multi_key_status_list = {};
        res = await API.put('/api/channel/', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      let channel = res.data.data;
      let newChannels = [...channels];
      if (action === 'delete') {
      } else {
        record.status = channel.status;
      }
      setChannels(newChannels);
    } else {
      showError(message);
    }
  };

  const manageTag = async (tag, action) => {
    console.log(tag, action);
    let res;
    switch (action) {
      case 'enable':
        res = await API.post('/api/channel/tag/enabled', {
          tag: tag,
        });
        break;
      case 'disable':
        res = await API.post('/api/channel/tag/disabled', {
          tag: tag,
        });
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess('操作成功完成！');
      let newChannels = [...channels];
      for (let i = 0; i < newChannels.length; i++) {
        if (newChannels[i].tag === tag) {
          let status = action === 'enable' ? 1 : 2;
          newChannels[i]?.children?.forEach((channel) => {
            channel.status = status;
          });
          newChannels[i].status = status;
        }
      }
      setChannels(newChannels);
    } else {
      showError(message);
    }
  };

  // 获取表单值的辅助函数
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchGroup: formValues.searchGroup || '',
      searchModel: formValues.searchModel || '',
    };
  };

  const searchChannels = async (
    enableTagMode,
    typeKey = activeTypeKey,
    statusF = statusFilter,
    page = 1,
    pageSz = pageSize,
    sortFlag = idSort,
  ) => {
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    setSearching(true);
    try {
      if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
        await loadChannels(page, pageSz, sortFlag, enableTagMode, typeKey, statusF);
        return;
      }

      const typeParam = (typeKey !== 'all') ? `&type=${typeKey}` : '';
      const statusParam = statusF !== 'all' ? `&status=${statusF}` : '';
      const res = await API.get(
        `/api/channel/search?keyword=${searchKeyword}&group=${searchGroup}&model=${searchModel}&id_sort=${sortFlag}&tag_mode=${enableTagMode}&p=${page}&page_size=${pageSz}${typeParam}${statusParam}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const { items = [], total = 0, type_counts = {} } = data;
        const sumAll = Object.values(type_counts).reduce((acc, v) => acc + v, 0);
        setTypeCounts({ ...type_counts, all: sumAll });
        setChannelFormat(items, enableTagMode);
        setChannelCount(total);
        setActivePage(page);
      } else {
        showError(message);
      }
    } finally {
      setSearching(false);
    }
  };

  const updateChannelProperty = (channelId, updateFn) => {
    // Create a new copy of channels array
    const newChannels = [...channels];
    let updated = false;

    // Find and update the correct channel
    newChannels.forEach((channel) => {
      if (channel.children !== undefined) {
        // If this is a tag group, search in its children
        channel.children.forEach((child) => {
          if (child.id === channelId) {
            updateFn(child);
            updated = true;
          }
        });
      } else if (channel.id === channelId) {
        // Direct channel match
        updateFn(channel);
        updated = true;
      }
    });

    // Only update state if we actually modified a channel
    if (updated) {
      setChannels(newChannels);
    }
  };

  const processTestQueue = async () => {
    if (!isProcessingQueue || testQueue.length === 0) return;

    const { channel, model, indexInFiltered } = testQueue[0];

    // 自动翻页到正在测试的模型所在页
    if (currentTestChannel && currentTestChannel.id === channel.id) {
      let pageNo;
      if (indexInFiltered !== undefined) {
        pageNo = Math.floor(indexInFiltered / MODEL_TABLE_PAGE_SIZE) + 1;
      } else {
        const filteredModelsList = currentTestChannel.models
          .split(',')
          .filter((m) => m.toLowerCase().includes(modelSearchKeyword.toLowerCase()));
        const modelIdx = filteredModelsList.indexOf(model);
        pageNo = modelIdx !== -1 ? Math.floor(modelIdx / MODEL_TABLE_PAGE_SIZE) + 1 : 1;
      }
      setModelTablePage(pageNo);
    }

    try {
      setTestingModels(prev => new Set([...prev, model]));
      const res = await API.get(`/api/channel/test/${channel.id}?model=${model}`);
      const { success, message, time } = res.data;

      setModelTestResults(prev => ({
        ...prev,
        [`${channel.id}-${model}`]: { success, time }
      }));

      if (success) {
        updateChannelProperty(channel.id, (ch) => {
          ch.response_time = time * 1000;
          ch.test_time = Date.now() / 1000;
        });
        if (!model) {
          showInfo(
            t('通道 ${name} 测试成功，耗时 ${time.toFixed(2)} 秒。')
              .replace('${name}', channel.name)
              .replace('${time.toFixed(2)}', time.toFixed(2)),
          );
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setTestingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(model);
        return newSet;
      });
    }

    // 移除已处理的测试
    setTestQueue(prev => prev.slice(1));
  };

  // 监听队列变化
  useEffect(() => {
    if (testQueue.length > 0 && isProcessingQueue) {
      processTestQueue();
    } else if (testQueue.length === 0 && isProcessingQueue) {
      setIsProcessingQueue(false);
      setIsBatchTesting(false);
    }
  }, [testQueue, isProcessingQueue]);

  const testChannel = async (record, model) => {
    setTestQueue(prev => [...prev, { channel: record, model }]);
    if (!isProcessingQueue) {
      setIsProcessingQueue(true);
    }
  };

  const batchTestModels = async () => {
    if (!currentTestChannel) return;

    setIsBatchTesting(true);

    // 重置分页到第一页
    setModelTablePage(1);

    const filteredModels = currentTestChannel.models
      .split(',')
      .filter((model) =>
        model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
      );

    setTestQueue(
      filteredModels.map((model, idx) => ({
        channel: currentTestChannel,
        model,
        indexInFiltered: idx, // 记录在过滤列表中的顺序
      })),
    );
    setIsProcessingQueue(true);
  };

  const handleCloseModal = () => {
    if (isBatchTesting) {
      // 清空测试队列来停止测试
      setTestQueue([]);
      setIsProcessingQueue(false);
      setIsBatchTesting(false);
      showSuccess(t('已停止测试'));
    } else {
      setShowModelTestModal(false);
      setModelSearchKeyword('');
      setSelectedModelKeys([]);
      setModelTablePage(1);
    }
  };

  const channelTypeCounts = useMemo(() => {
    if (Object.keys(typeCounts).length > 0) return typeCounts;
    // fallback 本地计算
    const counts = { all: channels.length };
    channels.forEach((channel) => {
      const collect = (ch) => {
        const type = ch.type;
        counts[type] = (counts[type] || 0) + 1;
      };
      if (channel.children !== undefined) {
        channel.children.forEach(collect);
      } else {
        collect(channel);
      }
    });
    return counts;
  }, [typeCounts, channels]);

  const availableTypeKeys = useMemo(() => {
    const keys = ['all'];
    Object.entries(channelTypeCounts).forEach(([k, v]) => {
      if (k !== 'all' && v > 0) keys.push(String(k));
    });
    return keys;
  }, [channelTypeCounts]);

  const renderTypeTabs = () => {
    if (enableTagMode) return null;

    return (
      <Tabs
        activeKey={activeTypeKey}
        type="card"
        collapsible
        onChange={(key) => {
          setActiveTypeKey(key);
          setActivePage(1);
          loadChannels(1, pageSize, idSort, enableTagMode, key);
        }}
        className="mb-4"
      >
        <TabPane
          itemKey="all"
          tab={
            <span className="flex items-center gap-2">
              {t('全部')}
              <Tag color={activeTypeKey === 'all' ? 'red' : 'grey'} shape='circle'>
                {channelTypeCounts['all'] || 0}
              </Tag>
            </span>
          }
        />

        {CHANNEL_OPTIONS.filter((opt) => availableTypeKeys.includes(String(opt.value))).map((option) => {
          const key = String(option.value);
          const count = channelTypeCounts[option.value] || 0;
          return (
            <TabPane
              key={key}
              itemKey={key}
              tab={
                <span className="flex items-center gap-2">
                  {getChannelIcon(option.value)}
                  {option.label}
                  <Tag color={activeTypeKey === key ? 'red' : 'grey'} shape='circle'>
                    {count}
                  </Tag>
                </span>
              }
            />
          );
        })}
      </Tabs>
    );
  };

  let pageData = channels;

  const handlePageChange = (page) => {
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    setActivePage(page);
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      loadChannels(page, pageSize, idSort, enableTagMode).then(() => { });
    } else {
      searchChannels(enableTagMode, activeTypeKey, statusFilter, page, pageSize, idSort);
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      loadChannels(1, size, idSort, enableTagMode)
        .then()
        .catch((reason) => {
          showError(reason);
        });
    } else {
      searchChannels(enableTagMode, activeTypeKey, statusFilter, 1, size, idSort);
    }
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      if (res === undefined) {
        return;
      }
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const submitTagEdit = async (type, data) => {
    switch (type) {
      case 'priority':
        if (data.priority === undefined || data.priority === '') {
          showInfo('优先级必须是整数！');
          return;
        }
        data.priority = parseInt(data.priority);
        break;
      case 'weight':
        if (
          data.weight === undefined ||
          data.weight < 0 ||
          data.weight === ''
        ) {
          showInfo('权重必须是非负整数！');
          return;
        }
        data.weight = parseInt(data.weight);
        break;
    }

    try {
      const res = await API.put('/api/channel/tag', data);
      if (res?.data?.success) {
        showSuccess('更新成功！');
        await refresh();
      }
    } catch (error) {
      showError(error);
    }
  };

  const closeEdit = () => {
    setShowEdit(false);
  };

  const handleRow = (record, index) => {
    if (record.status !== 1) {
      return {
        style: {
          background: 'var(--semi-color-disabled-border)',
        },
      };
    } else {
      return {};
    }
  };

  const batchSetChannelTag = async () => {
    if (selectedChannels.length === 0) {
      showError(t('请先选择要设置标签的渠道！'));
      return;
    }
    if (batchSetTagValue === '') {
      showError(t('标签不能为空！'));
      return;
    }
    let ids = selectedChannels.map((channel) => channel.id);
    const res = await API.post('/api/channel/batch/tag', {
      ids: ids,
      tag: batchSetTagValue === '' ? null : batchSetTagValue,
    });
    if (res.data.success) {
      showSuccess(
        t('已为 ${count} 个渠道设置标签！').replace('${count}', res.data.data),
      );
      await refresh();
      setShowBatchSetTag(false);
    } else {
      showError(res.data.message);
    }
  };

  const testAllChannels = async () => {
    const res = await API.get(`/api/channel/test`);
    const { success, message } = res.data;
    if (success) {
      showInfo(t('已成功开始测试所有已启用通道，请刷新页面查看结果。'));
    } else {
      showError(message);
    }
  };

  const deleteAllDisabledChannels = async () => {
    const res = await API.delete(`/api/channel/disabled`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(
        t('已删除所有禁用渠道，共计 ${data} 个').replace('${data}', data),
      );
      await refresh();
    } else {
      showError(message);
    }
  };

  const updateAllChannelsBalance = async () => {
    const res = await API.get(`/api/channel/update_balance`);
    const { success, message } = res.data;
    if (success) {
      showInfo(t('已更新完毕所有已启用通道余额！'));
    } else {
      showError(message);
    }
  };

  const updateChannelBalance = async (record) => {
    const res = await API.get(`/api/channel/update_balance/${record.id}/`);
    const { success, message, balance } = res.data;
    if (success) {
      updateChannelProperty(record.id, (channel) => {
        channel.balance = balance;
        channel.balance_updated_time = Date.now() / 1000;
      });
      showInfo(
        t('通道 ${name} 余额更新成功！').replace('${name}', record.name),
      );
    } else {
      showError(message);
    }
  };

  const batchDeleteChannels = async () => {
    if (selectedChannels.length === 0) {
      showError(t('请先选择要删除的通道！'));
      return;
    }
    setLoading(true);
    let ids = [];
    selectedChannels.forEach((channel) => {
      ids.push(channel.id);
    });
    const res = await API.post(`/api/channel/batch`, { ids: ids });
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(t('已删除 ${data} 个通道！').replace('${data}', data));
      await refresh();
      setTimeout(() => {
        if (channels.length === 0 && activePage > 1) {
          refresh(activePage - 1);
        }
      }, 100);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const fixChannelsAbilities = async () => {
    const res = await API.post(`/api/channel/fix`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(t('已修复 ${success} 个通道，失败 ${fails} 个通道。').replace('${success}', data.success).replace('${fails}', data.fails));
      await refresh();
    } else {
      showError(message);
    }
  };

  const renderHeader = () => (
    <div className="flex flex-col w-full">
      {renderTypeTabs()}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            size='small'
            disabled={!enableBatchDelete}
            type='danger'
            className="w-full md:w-auto"
            onClick={() => {
              Modal.confirm({
                title: t('确定是否要删除所选通道？'),
                content: t('此修改将不可逆'),
                onOk: () => batchDeleteChannels(),
              });
            }}
          >
            {t('删除所选通道')}
          </Button>

          <Button
            size='small'
            disabled={!enableBatchDelete}
            type='tertiary'
            onClick={() => setShowBatchSetTag(true)}
            className="w-full md:w-auto"
          >
            {t('批量设置标签')}
          </Button>

          <Dropdown
            size='small'
            trigger='click'
            render={
              <Dropdown.Menu>
                <Dropdown.Item>
                  <Button
                    size='small'
                    type='tertiary'
                    className="w-full"
                    onClick={() => {
                      Modal.confirm({
                        title: t('确定？'),
                        content: t('确定要测试所有通道吗？'),
                        onOk: () => testAllChannels(),
                        size: 'small',
                        centered: true,
                      });
                    }}
                  >
                    {t('测试所有通道')}
                  </Button>
                </Dropdown.Item>
                <Dropdown.Item>
                  <Button
                    size='small'
                    className="w-full"
                    onClick={() => {
                      Modal.confirm({
                        title: t('确定是否要修复数据库一致性？'),
                        content: t('进行该操作时，可能导致渠道访问错误，请仅在数据库出现问题时使用'),
                        onOk: () => fixChannelsAbilities(),
                        size: 'sm',
                        centered: true,
                      });
                    }}
                  >
                    {t('修复数据库一致性')}
                  </Button>
                </Dropdown.Item>
                <Dropdown.Item>
                  <Button
                    size='small'
                    type='secondary'
                    className="w-full"
                    onClick={() => {
                      Modal.confirm({
                        title: t('确定？'),
                        content: t('确定要更新所有已启用通道余额吗？'),
                        onOk: () => updateAllChannelsBalance(),
                        size: 'sm',
                        centered: true,
                      });
                    }}
                  >
                    {t('更新所有已启用通道余额')}
                  </Button>
                </Dropdown.Item>
                <Dropdown.Item>
                  <Button
                    size='small'
                    type='danger'
                    className="w-full"
                    onClick={() => {
                      Modal.confirm({
                        title: t('确定是否要删除禁用通道？'),
                        content: t('此修改将不可逆'),
                        onOk: () => deleteAllDisabledChannels(),
                        size: 'sm',
                        centered: true,
                      });
                    }}
                  >
                    {t('删除禁用通道')}
                  </Button>
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <Button size='small' theme='light' type='tertiary' className="w-full md:w-auto">
              {t('批量操作')}
            </Button>
          </Dropdown>

          <Button
            size='small'
            type='tertiary'
            className="w-full md:w-auto"
            onClick={() => setCompactMode(!compactMode)}
          >
            {compactMode ? t('自适应列表') : t('紧凑列表')}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto order-1 md:order-2">
          <div className="flex items-center justify-between w-full md:w-auto">
            <Typography.Text strong className="mr-2">
              {t('使用ID排序')}
            </Typography.Text>
            <Switch
              size='small'
              checked={idSort}
              onChange={(v) => {
                localStorage.setItem('id-sort', v + '');
                setIdSort(v);
                const { searchKeyword, searchGroup, searchModel } = getFormValues();
                if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
                  loadChannels(activePage, pageSize, v, enableTagMode);
                } else {
                  searchChannels(enableTagMode, activeTypeKey, statusFilter, activePage, pageSize, v);
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between w-full md:w-auto">
            <Typography.Text strong className="mr-2">
              {t('开启批量操作')}
            </Typography.Text>
            <Switch
              size='small'
              checked={enableBatchDelete}
              onChange={(v) => {
                localStorage.setItem('enable-batch-delete', v + '');
                setEnableBatchDelete(v);
              }}
            />
          </div>

          <div className="flex items-center justify-between w-full md:w-auto">
            <Typography.Text strong className="mr-2">
              {t('标签聚合模式')}
            </Typography.Text>
            <Switch
              size='small'
              checked={enableTagMode}
              onChange={(v) => {
                localStorage.setItem('enable-tag-mode', v + '');
                setEnableTagMode(v);
                setActivePage(1);
                loadChannels(1, pageSize, idSort, v);
              }}
            />
          </div>

          {/* 状态筛选器 */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <Typography.Text strong className="mr-2">
              {t('状态筛选')}
            </Typography.Text>
            <Select
              size='small'
              value={statusFilter}
              onChange={(v) => {
                localStorage.setItem('channel-status-filter', v);
                setStatusFilter(v);
                setActivePage(1);
                loadChannels(1, pageSize, idSort, enableTagMode, activeTypeKey, v);
              }}
            >
              <Select.Option value="all">{t('全部')}</Select.Option>
              <Select.Option value="enabled">{t('已启用')}</Select.Option>
              <Select.Option value="disabled">{t('已禁用')}</Select.Option>
            </Select>
          </div>
        </div>
      </div>

      <Divider margin="12px" />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
        <div className="flex gap-2 w-full md:w-auto order-2 md:order-1">
          <Button
            size='small'
            theme='light'
            type='primary'
            className="w-full md:w-auto"
            onClick={() => {
              setEditingChannel({
                id: undefined,
              });
              setShowEdit(true);
            }}
          >
            {t('添加渠道')}
          </Button>

          <Button
            size='small'
            type='tertiary'
            className="w-full md:w-auto"
            onClick={refresh}
          >
            {t('刷新')}
          </Button>

          <Button
            size='small'
            type='tertiary'
            onClick={() => setShowColumnSelector(true)}
            className="w-full md:w-auto"
          >
            {t('列设置')}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto order-1 md:order-2">
          <Form
            initValues={formInitValues}
            getFormApi={(api) => setFormApi(api)}
            onSubmit={() => searchChannels(enableTagMode)}
            allowEmpty={true}
            autoComplete="off"
            layout="horizontal"
            trigger="change"
            stopValidateWithError={false}
            className="flex flex-col md:flex-row items-center gap-4 w-full"
          >
            <div className="relative w-full md:w-64">
              <Form.Input
                size='small'
                field="searchKeyword"
                prefix={<IconSearch />}
                placeholder={t('渠道ID，名称，密钥，API地址')}
                showClear
                pure
              />
            </div>
            <div className="w-full md:w-48">
              <Form.Input
                size='small'
                field="searchModel"
                prefix={<IconSearch />}
                placeholder={t('模型关键字')}
                showClear
                pure
              />
            </div>
            <div className="w-full md:w-32">
              <Form.Select
                size='small'
                field="searchGroup"
                placeholder={t('选择分组')}
                optionList={[
                  { label: t('选择分组'), value: null },
                  ...groupOptions,
                ]}
                className="w-full"
                showClear
                pure
                onChange={() => {
                  // 延迟执行搜索，让表单值先更新
                  setTimeout(() => {
                    searchChannels(enableTagMode);
                  }, 0);
                }}
              />
            </div>
            <Button
              size='small'
              type="tertiary"
              htmlType="submit"
              loading={loading || searching}
              className="w-full md:w-auto"
            >
              {t('查询')}
            </Button>
            <Button
              size='small'
              type='tertiary'
              onClick={() => {
                if (formApi) {
                  formApi.reset();
                  // 重置后立即查询，使用setTimeout确保表单重置完成
                  setTimeout(() => {
                    refresh();
                  }, 100);
                }
              }}
              className="w-full md:w-auto"
            >
              {t('重置')}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderColumnSelector()}
      <EditTagModal
        visible={showEditTag}
        tag={editingTag}
        handleClose={() => setShowEditTag(false)}
        refresh={refresh}
      />
      <EditChannel
        refresh={refresh}
        visible={showEdit}
        handleClose={closeEdit}
        editingChannel={editingChannel}
      />

      <Card
        className="!rounded-2xl"
        title={renderHeader()}
        shadows='always'
        bordered={false}
      >
        <Table
          columns={compactMode ? getVisibleColumns().map(({ fixed, ...rest }) => rest) : getVisibleColumns()}
          dataSource={pageData}
          scroll={compactMode ? undefined : { x: 'max-content' }}
          pagination={{
            currentPage: activePage,
            pageSize: pageSize,
            total: channelCount,
            pageSizeOpts: [10, 20, 50, 100],
            showSizeChanger: true,
            formatPageText: (page) => t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
              start: page.currentStart,
              end: page.currentEnd,
              total: channelCount,
            }),
            onPageSizeChange: (size) => {
              handlePageSizeChange(size);
            },
            onPageChange: handlePageChange,
          }}
          expandAllRows={false}
          onRow={handleRow}
          rowSelection={
            enableBatchDelete
              ? {
                onChange: (selectedRowKeys, selectedRows) => {
                  setSelectedChannels(selectedRows);
                },
              }
              : null
          }
          empty={
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description={t('搜索无结果')}
              style={{ padding: 30 }}
            />
          }
          className="rounded-xl overflow-hidden"
          size="middle"
          loading={loading || searching}
        />
      </Card>

      {/* 批量设置标签模态框 */}
      <Modal
        title={t('批量设置标签')}
        visible={showBatchSetTag}
        onOk={batchSetChannelTag}
        onCancel={() => setShowBatchSetTag(false)}
        maskClosable={false}
        centered={true}
        size="small"
        className="!rounded-lg"
      >
        <div className="mb-5">
          <Typography.Text>{t('请输入要设置的标签名称')}</Typography.Text>
        </div>
        <Input
          placeholder={t('请输入标签名称')}
          value={batchSetTagValue}
          onChange={(v) => setBatchSetTagValue(v)}
        />
        <div className="mt-4">
          <Typography.Text type='secondary'>
            {t('已选择 ${count} 个渠道').replace('${count}', selectedChannels.length)}
          </Typography.Text>
        </div>
      </Modal>

      {/* 模型测试弹窗 */}
      <Modal
        title={
          currentTestChannel && (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <Typography.Text strong className="!text-[var(--semi-color-text-0)] !text-base">
                  {currentTestChannel.name} {t('渠道的模型测试')}
                </Typography.Text>
                <Typography.Text type="tertiary" className="!text-xs flex items-center">
                  {t('共')} {currentTestChannel.models.split(',').length} {t('个模型')}
                </Typography.Text>
              </div>
            </div>
          )
        }
        visible={showModelTestModal && currentTestChannel !== null}
        onCancel={handleCloseModal}
        footer={
          <div className="flex justify-end">
            {isBatchTesting ? (
              <Button
                type='danger'
                onClick={handleCloseModal}
              >
                {t('停止测试')}
              </Button>
            ) : (
              <Button
                type='tertiary'
                onClick={handleCloseModal}
              >
                {t('取消')}
              </Button>
            )}
            <Button
              onClick={batchTestModels}
              loading={isBatchTesting}
              disabled={isBatchTesting}
            >
              {isBatchTesting ? t('测试中...') : t('批量测试${count}个模型').replace(
                '${count}',
                currentTestChannel
                  ? currentTestChannel.models
                    .split(',')
                    .filter((model) =>
                      model.toLowerCase().includes(modelSearchKeyword.toLowerCase())
                    ).length
                  : 0
              )}
            </Button>
          </div>
        }
        maskClosable={!isBatchTesting}
        className="!rounded-lg"
        size={isMobile ? 'full-width' : 'large'}
      >
        <div className="model-test-scroll">
          {currentTestChannel && (
            <div>
              {/* 搜索与操作按钮 */}
              <div className="flex items-center justify-end gap-2 w-full mb-2">
                <Input
                  placeholder={t('搜索模型...')}
                  value={modelSearchKeyword}
                  onChange={(v) => {
                    setModelSearchKeyword(v);
                    setModelTablePage(1);
                  }}
                  className="!w-full"
                  prefix={<IconSearch />}
                  showClear
                />

                <Button
                  onClick={() => {
                    if (selectedModelKeys.length === 0) {
                      showError(t('请先选择模型！'));
                      return;
                    }
                    copy(selectedModelKeys.join(',')).then((ok) => {
                      if (ok) {
                        showSuccess(t('已复制 ${count} 个模型').replace('${count}', selectedModelKeys.length));
                      } else {
                        showError(t('复制失败，请手动复制'));
                      }
                    });
                  }}
                >
                  {t('复制已选')}
                </Button>

                <Button
                  type='tertiary'
                  onClick={() => {
                    if (!currentTestChannel) return;
                    const successKeys = currentTestChannel.models
                      .split(',')
                      .filter((m) => m.toLowerCase().includes(modelSearchKeyword.toLowerCase()))
                      .filter((m) => {
                        const result = modelTestResults[`${currentTestChannel.id}-${m}`];
                        return result && result.success;
                      });
                    if (successKeys.length === 0) {
                      showInfo(t('暂无成功模型'));
                    }
                    setSelectedModelKeys(successKeys);
                  }}
                >
                  {t('选择成功')}
                </Button>
              </div>
              <Table
                columns={[
                  {
                    title: t('模型名称'),
                    dataIndex: 'model',
                    render: (text) => (
                      <div className="flex items-center">
                        <Typography.Text strong>{text}</Typography.Text>
                      </div>
                    )
                  },
                  {
                    title: t('状态'),
                    dataIndex: 'status',
                    render: (text, record) => {
                      const testResult = modelTestResults[`${currentTestChannel.id}-${record.model}`];
                      const isTesting = testingModels.has(record.model);

                      if (isTesting) {
                        return (
                          <Tag color='blue' shape='circle'>
                            {t('测试中')}
                          </Tag>
                        );
                      }

                      if (!testResult) {
                        return (
                          <Tag color='grey' shape='circle'>
                            {t('未开始')}
                          </Tag>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2">
                          <Tag
                            color={testResult.success ? 'green' : 'red'}
                            shape='circle'
                          >
                            {testResult.success ? t('成功') : t('失败')}
                          </Tag>
                          {testResult.success && (
                            <Typography.Text type="tertiary">
                              {t('请求时长: ${time}s').replace('${time}', testResult.time.toFixed(2))}
                            </Typography.Text>
                          )}
                        </div>
                      );
                    }
                  },
                  {
                    title: '',
                    dataIndex: 'operate',
                    render: (text, record) => {
                      const isTesting = testingModels.has(record.model);
                      return (
                        <Button
                          type='tertiary'
                          onClick={() => testChannel(currentTestChannel, record.model)}
                          loading={isTesting}
                          size='small'
                        >
                          {t('测试')}
                        </Button>
                      );
                    }
                  }
                ]}
                dataSource={(() => {
                  const filtered = currentTestChannel.models
                    .split(',')
                    .filter((model) =>
                      model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
                    );
                  const start = (modelTablePage - 1) * MODEL_TABLE_PAGE_SIZE;
                  const end = start + MODEL_TABLE_PAGE_SIZE;
                  return filtered.slice(start, end).map((model) => ({
                    model,
                    key: model,
                  }));
                })()}
                rowSelection={{
                  selectedRowKeys: selectedModelKeys,
                  onChange: (keys) => {
                    if (allSelectingRef.current) {
                      allSelectingRef.current = false;
                      return;
                    }
                    setSelectedModelKeys(keys);
                  },
                  onSelectAll: (checked) => {
                    const filtered = currentTestChannel.models
                      .split(',')
                      .filter((m) => m.toLowerCase().includes(modelSearchKeyword.toLowerCase()));
                    allSelectingRef.current = true;
                    setSelectedModelKeys(checked ? filtered : []);
                  },
                }}
                pagination={{
                  currentPage: modelTablePage,
                  pageSize: MODEL_TABLE_PAGE_SIZE,
                  total: currentTestChannel.models
                    .split(',')
                    .filter((model) =>
                      model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
                    ).length,
                  showSizeChanger: false,
                  onPageChange: (page) => setModelTablePage(page),
                }}
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default ChannelsTable;
