import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  copy,
  getTodayStartTimestamp,
  isAdmin,
  showError,
  showSuccess,
  timestamp2string,
  renderAudioModelPrice,
  renderClaudeLogContent,
  renderClaudeModelPrice,
  renderClaudeModelPriceSimple,
  renderGroup,
  renderLogContent,
  renderModelPrice,
  renderModelPriceSimple,
  renderNumber,
  renderQuota,
  stringToColor,
  getLogOther,
  renderModelTag
} from '../../helpers';

import {
  Avatar,
  Button,
  Descriptions,
  Empty,
  Modal,
  Popover,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Checkbox,
  Card,
  Typography,
  Divider,
  Form,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { ITEMS_PER_PAGE } from '../../constants';
import Paragraph from '@douyinfe/semi-ui/lib/es/typography/paragraph';
import { IconSearch, IconHelpCircle } from '@douyinfe/semi-icons';
import { Route } from 'lucide-react';
import { useTableCompactMode } from '../../hooks/useTableCompactMode';

const { Text } = Typography;

const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

const LogsTable = () => {
  const { t } = useTranslation();

  function renderType(type) {
    switch (type) {
      case 1:
        return (
          <Tag color='cyan' shape='circle'>
            {t('充值')}
          </Tag>
        );
      case 2:
        return (
          <Tag color='lime' shape='circle'>
            {t('消费')}
          </Tag>
        );
      case 3:
        return (
          <Tag color='orange' shape='circle'>
            {t('管理')}
          </Tag>
        );
      case 4:
        return (
          <Tag color='purple' shape='circle'>
            {t('系统')}
          </Tag>
        );
      case 5:
        return (
          <Tag color='red' shape='circle'>
            {t('错误')}
          </Tag>
        );
      default:
        return (
          <Tag color='grey' shape='circle'>
            {t('未知')}
          </Tag>
        );
    }
  }

  function renderIsStream(bool) {
    if (bool) {
      return (
        <Tag color='blue' shape='circle'>
          {t('流')}
        </Tag>
      );
    } else {
      return (
        <Tag color='purple' shape='circle'>
          {t('非流')}
        </Tag>
      );
    }
  }

  function renderUseTime(type) {
    const time = parseInt(type);
    if (time < 101) {
      return (
        <Tag color='green' shape='circle'>
          {' '}
          {time} s{' '}
        </Tag>
      );
    } else if (time < 300) {
      return (
        <Tag color='orange' shape='circle'>
          {' '}
          {time} s{' '}
        </Tag>
      );
    } else {
      return (
        <Tag color='red' shape='circle'>
          {' '}
          {time} s{' '}
        </Tag>
      );
    }
  }

  function renderFirstUseTime(type) {
    let time = parseFloat(type) / 1000.0;
    time = time.toFixed(1);
    if (time < 3) {
      return (
        <Tag color='green' shape='circle'>
          {' '}
          {time} s{' '}
        </Tag>
      );
    } else if (time < 10) {
      return (
        <Tag color='orange' shape='circle'>
          {' '}
          {time} s{' '}
        </Tag>
      );
    } else {
      return (
        <Tag color='red' shape='circle'>
          {' '}
          {time} s{' '}
        </Tag>
      );
    }
  }

  function renderModelName(record) {
    let other = getLogOther(record.other);
    let modelMapped =
      other?.is_model_mapped &&
      other?.upstream_model_name &&
      other?.upstream_model_name !== '';
    if (!modelMapped) {
      return renderModelTag(record.model_name, {
        onClick: (event) => {
          copyText(event, record.model_name).then((r) => { });
        },
      });
    } else {
      return (
        <>
          <Space vertical align={'start'}>
            <Popover
              content={
                <div style={{ padding: 10 }}>
                  <Space vertical align={'start'}>
                    <div className='flex items-center'>
                      <Text strong style={{ marginRight: 8 }}>
                        {t('请求并计费模型')}:
                      </Text>
                      {renderModelTag(record.model_name, {
                        onClick: (event) => {
                          copyText(event, record.model_name).then((r) => { });
                        },
                      })}
                    </div>
                    <div className='flex items-center'>
                      <Text strong style={{ marginRight: 8 }}>
                        {t('实际模型')}:
                      </Text>
                      {renderModelTag(other.upstream_model_name, {
                        onClick: (event) => {
                          copyText(event, other.upstream_model_name).then(
                            (r) => { },
                          );
                        },
                      })}
                    </div>
                  </Space>
                </div>
              }
            >
              {renderModelTag(record.model_name, {
                onClick: (event) => {
                  copyText(event, record.model_name).then((r) => { });
                },
                suffixIcon: (
                  <Route
                    style={{ width: '0.9em', height: '0.9em', opacity: 0.75 }}
                  />
                ),
              })}
            </Popover>
          </Space>
        </>
      );
    }
  }

  // Define column keys for selection
  const COLUMN_KEYS = {
    TIME: 'time',
    CHANNEL: 'channel',
    USERNAME: 'username',
    TOKEN: 'token',
    GROUP: 'group',
    TYPE: 'type',
    MODEL: 'model',
    USE_TIME: 'use_time',
    PROMPT: 'prompt',
    COMPLETION: 'completion',
    COST: 'cost',
    RETRY: 'retry',
    IP: 'ip',
    DETAILS: 'details',
  };

  // State for column visibility
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Load saved column preferences from localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem('logs-table-columns');
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

  // Get default column visibility based on user role
  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.TIME]: true,
      [COLUMN_KEYS.CHANNEL]: isAdminUser,
      [COLUMN_KEYS.USERNAME]: isAdminUser,
      [COLUMN_KEYS.TOKEN]: true,
      [COLUMN_KEYS.GROUP]: true,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.MODEL]: true,
      [COLUMN_KEYS.USE_TIME]: true,
      [COLUMN_KEYS.PROMPT]: true,
      [COLUMN_KEYS.COMPLETION]: true,
      [COLUMN_KEYS.COST]: true,
      [COLUMN_KEYS.RETRY]: isAdminUser,
      [COLUMN_KEYS.IP]: true,
      [COLUMN_KEYS.DETAILS]: true,
    };
  };

  // Initialize default column visibility
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem('logs-table-columns', JSON.stringify(defaults));
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
      // For admin-only columns, only enable them if user is admin
      if (
        (key === COLUMN_KEYS.CHANNEL ||
          key === COLUMN_KEYS.USERNAME ||
          key === COLUMN_KEYS.RETRY) &&
        !isAdminUser
      ) {
        updatedColumns[key] = false;
      } else {
        updatedColumns[key] = checked;
      }
    });

    setVisibleColumns(updatedColumns);
  };

  // Define all columns
  const allColumns = [
    {
      key: COLUMN_KEYS.TIME,
      title: t('时间'),
      dataIndex: 'timestamp2string',
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel',
      className: isAdmin() ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        let isMultiKey = false
        let multiKeyIndex = -1;
        let other = getLogOther(record.other);
        if (other?.admin_info) {
          let adminInfo = other.admin_info;
          if (adminInfo?.is_multi_key) {
            isMultiKey = true;
            multiKeyIndex = adminInfo.multi_key_index;
          }
        }

        return isAdminUser && (record.type === 0 || record.type === 2 || record.type === 5) ? (
          <Space>
            <Tooltip content={record.channel_name || t('未知渠道')}>
              <Tag
                color={colors[parseInt(text) % colors.length]}
                shape='circle'
              >
                {text}
              </Tag>
            </Tooltip>
            {isMultiKey && (
              <Tag color='white' shape='circle'>
                {multiKeyIndex}
              </Tag>
            )}
          </Space>
        ) : null;
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      className: isAdmin() ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div>
            <Avatar
              size='extra-small'
              color={stringToColor(text)}
              style={{ marginRight: 4 }}
              onClick={(event) => {
                event.stopPropagation();
                showUserInfo(record.user_id);
              }}
            >
              {typeof text === 'string' && text.slice(0, 1)}
            </Avatar>
            {text}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.TOKEN,
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (text, record, index) => {
        return record.type === 0 || record.type === 2 || record.type === 5 ? (
          <div>
            <Tag
              color='grey'
              shape='circle'
              onClick={(event) => {
                //cancel the row click event
                copyText(event, text);
              }}
            >
              {' '}
              {t(text)}{' '}
            </Tag>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        if (record.type === 0 || record.type === 2 || record.type === 5) {
          if (record.group) {
            return <>{renderGroup(record.group)}</>;
          } else {
            let other = null;
            try {
              other = JSON.parse(record.other);
            } catch (e) {
              console.error(
                `Failed to parse record.other: "${record.other}".`,
                e,
              );
            }
            if (other === null) {
              return <></>;
            }
            if (other.group !== undefined) {
              return <>{renderGroup(other.group)}</>;
            } else {
              return <></>;
            }
          }
        } else {
          return <></>;
        }
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record, index) => {
        return <>{renderType(text)}</>;
      },
    },
    {
      key: COLUMN_KEYS.MODEL,
      title: t('模型'),
      dataIndex: 'model_name',
      render: (text, record, index) => {
        return record.type === 0 || record.type === 2 || record.type === 5 ? (
          <>{renderModelName(record)}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.USE_TIME,
      title: t('用时/首字'),
      dataIndex: 'use_time',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        if (record.is_stream) {
          let other = getLogOther(record.other);
          return (
            <>
              <Space>
                {renderUseTime(text)}
                {renderFirstUseTime(other?.frt)}
                {renderIsStream(record.is_stream)}
              </Space>
            </>
          );
        } else {
          return (
            <>
              <Space>
                {renderUseTime(text)}
                {renderIsStream(record.is_stream)}
              </Space>
            </>
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: t('提示'),
      dataIndex: 'prompt_tokens',
      render: (text, record, index) => {
        return record.type === 0 || record.type === 2 || record.type === 5 ? (
          <>{<span> {text} </span>}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COMPLETION,
      title: t('补全'),
      dataIndex: 'completion_tokens',
      render: (text, record, index) => {
        return parseInt(text) > 0 &&
          (record.type === 0 || record.type === 2 || record.type === 5) ? (
          <>{<span> {text} </span>}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COST,
      title: t('花费'),
      dataIndex: 'quota',
      render: (text, record, index) => {
        return record.type === 0 || record.type === 2 || record.type === 5 ? (
          <>{renderQuota(text, 6)}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.IP,
      title: (
        <div className="flex items-center gap-1">
          {t('IP')}
          <Tooltip content={t('只有当用户设置开启IP记录时，才会进行请求和错误类型日志的IP记录')}>
            <IconHelpCircle className="text-gray-400 cursor-help" />
          </Tooltip>
        </div>
      ),
      dataIndex: 'ip',
      render: (text, record, index) => {
        return (record.type === 2 || record.type === 5) && text ? (
          <Tooltip content={text}>
            <Tag
              color='orange'
              shape='circle'
              onClick={(event) => {
                copyText(event, text);
              }}
            >
              {text}
            </Tag>
          </Tooltip>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.RETRY,
      title: t('重试'),
      dataIndex: 'retry',
      className: isAdmin() ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        let content = t('渠道') + `：${record.channel}`;
        if (record.other !== '') {
          let other = JSON.parse(record.other);
          if (other === null) {
            return <></>;
          }
          if (other.admin_info !== undefined) {
            if (
              other.admin_info.use_channel !== null &&
              other.admin_info.use_channel !== undefined &&
              other.admin_info.use_channel !== ''
            ) {
              // channel id array
              let useChannel = other.admin_info.use_channel;
              let useChannelStr = useChannel.join('->');
              content = t('渠道') + `：${useChannelStr}`;
            }
          }
        }
        return isAdminUser ? <div>{content}</div> : <></>;
      },
    },
    {
      key: COLUMN_KEYS.DETAILS,
      title: t('详情'),
      dataIndex: 'content',
      fixed: 'right',
      render: (text, record, index) => {
        let other = getLogOther(record.other);
        if (other == null || record.type !== 2) {
          return (
            <Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 240 } },
                },
              }}
              style={{ maxWidth: 240 }}
            >
              {text}
            </Paragraph>
          );
        }
        let content = other?.claude
          ? renderClaudeModelPriceSimple(
            other.model_ratio,
            other.model_price,
            other.group_ratio,
            other?.user_group_ratio,
            other.cache_tokens || 0,
            other.cache_ratio || 1.0,
            other.cache_creation_tokens || 0,
            other.cache_creation_ratio || 1.0,
          )
          : renderModelPriceSimple(
            other.model_ratio,
            other.model_price,
            other.group_ratio,
            other?.user_group_ratio,
            other.cache_tokens || 0,
            other.cache_ratio || 1.0,
          );
        return (
          <Paragraph
            ellipsis={{
              rows: 2,
            }}
            style={{ maxWidth: 240 }}
          >
            {content}
          </Paragraph>
        );
      },
    },
  ];

  // Update table when column visibility changes
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      // Save to localStorage
      localStorage.setItem(
        'logs-table-columns',
        JSON.stringify(visibleColumns),
      );
    }
  }, [visibleColumns]);

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
          <div className='flex justify-end'>
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
          className='flex flex-wrap max-h-96 overflow-y-auto rounded-lg p-4'
          style={{ border: '1px solid var(--semi-color-border)' }}
        >
          {allColumns.map((column) => {
            // Skip admin-only columns for non-admin users
            if (
              !isAdminUser &&
              (column.key === COLUMN_KEYS.CHANNEL ||
                column.key === COLUMN_KEYS.USERNAME ||
                column.key === COLUMN_KEYS.RETRY)
            ) {
              return null;
            }

            return (
              <div key={column.key} className='w-1/2 mb-4 pr-2'>
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

  const [logs, setLogs] = useState([]);
  const [expandData, setExpandData] = useState({});
  const [showStat, setShowStat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStat, setLoadingStat] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(ITEMS_PER_PAGE);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [logType, setLogType] = useState(0);
  const isAdminUser = isAdmin();
  let now = new Date();

  // Form 初始值
  const formInitValues = {
    username: '',
    token_name: '',
    model_name: '',
    channel: '',
    group: '',
    dateRange: [
      timestamp2string(getTodayStartTimestamp()),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
    logType: '0',
  };

  const [stat, setStat] = useState({
    quota: 0,
    token: 0,
  });

  // Form API 引用
  const [formApi, setFormApi] = useState(null);

  // 获取表单值的辅助函数，确保所有值都是字符串
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};

    // 处理时间范围
    let start_timestamp = timestamp2string(getTodayStartTimestamp());
    let end_timestamp = timestamp2string(now.getTime() / 1000 + 3600);

    if (
      formValues.dateRange &&
      Array.isArray(formValues.dateRange) &&
      formValues.dateRange.length === 2
    ) {
      start_timestamp = formValues.dateRange[0];
      end_timestamp = formValues.dateRange[1];
    }

    return {
      username: formValues.username || '',
      token_name: formValues.token_name || '',
      model_name: formValues.model_name || '',
      start_timestamp,
      end_timestamp,
      channel: formValues.channel || '',
      group: formValues.group || '',
      logType: formValues.logType ? parseInt(formValues.logType) : 0,
    };
  };

  const getLogSelfStat = async () => {
    const {
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      group,
      logType: formLogType,
    } = getFormValues();
    const currentLogType = formLogType !== undefined ? formLogType : logType;
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let url = `/api/log/self/stat?type=${currentLogType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&group=${group}`;
    url = encodeURI(url);
    let res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const getLogStat = async () => {
    const {
      username,
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      channel,
      group,
      logType: formLogType,
    } = getFormValues();
    const currentLogType = formLogType !== undefined ? formLogType : logType;
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let url = `/api/log/stat?type=${currentLogType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}`;
    url = encodeURI(url);
    let res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const handleEyeClick = async () => {
    if (loadingStat) {
      return;
    }
    setLoadingStat(true);
    if (isAdminUser) {
      await getLogStat();
    } else {
      await getLogSelfStat();
    }
    setShowStat(true);
    setLoadingStat(false);
  };

  const showUserInfo = async (userId) => {
    if (!isAdminUser) {
      return;
    }
    const res = await API.get(`/api/user/${userId}`);
    const { success, message, data } = res.data;
    if (success) {
      Modal.info({
        title: t('用户信息'),
        content: (
          <div style={{ padding: 12 }}>
            <p>
              {t('用户名')}: {data.username}
            </p>
            <p>
              {t('余额')}: {renderQuota(data.quota)}
            </p>
            <p>
              {t('已用额度')}：{renderQuota(data.used_quota)}
            </p>
            <p>
              {t('请求次数')}：{renderNumber(data.request_count)}
            </p>
          </div>
        ),
        centered: true,
      });
    } else {
      showError(message);
    }
  };

  const setLogsFormat = (logs) => {
    let expandDatesLocal = {};
    for (let i = 0; i < logs.length; i++) {
      logs[i].timestamp2string = timestamp2string(logs[i].created_at);
      logs[i].key = logs[i].id;
      let other = getLogOther(logs[i].other);
      let expandDataLocal = [];
      if (isAdmin()) {
        // let content = '渠道：' + logs[i].channel;
        // if (other.admin_info !== undefined) {
        //   if (
        //     other.admin_info.use_channel !== null &&
        //     other.admin_info.use_channel !== undefined &&
        //     other.admin_info.use_channel !== ''
        //   ) {
        //     // channel id array
        //     let useChannel = other.admin_info.use_channel;
        //     let useChannelStr = useChannel.join('->');
        //     content = `渠道：${useChannelStr}`;
        //   }
        // }
        // expandDataLocal.push({
        //   key: '渠道重试',
        //   value: content,
        // })
      }
      if (isAdminUser && (logs[i].type === 0 || logs[i].type === 2)) {
        expandDataLocal.push({
          key: t('渠道信息'),
          value: `${logs[i].channel} - ${logs[i].channel_name || '[未知]'}`,
        });
      }
      if (other?.ws || other?.audio) {
        expandDataLocal.push({
          key: t('语音输入'),
          value: other.audio_input,
        });
        expandDataLocal.push({
          key: t('语音输出'),
          value: other.audio_output,
        });
        expandDataLocal.push({
          key: t('文字输入'),
          value: other.text_input,
        });
        expandDataLocal.push({
          key: t('文字输出'),
          value: other.text_output,
        });
      }
      if (other?.cache_tokens > 0) {
        expandDataLocal.push({
          key: t('缓存 Tokens'),
          value: other.cache_tokens,
        });
      }
      if (other?.cache_creation_tokens > 0) {
        expandDataLocal.push({
          key: t('缓存创建 Tokens'),
          value: other.cache_creation_tokens,
        });
      }
      if (logs[i].type === 2) {
        expandDataLocal.push({
          key: t('日志详情'),
          value: other?.claude
            ? renderClaudeLogContent(
              other?.model_ratio,
              other.completion_ratio,
              other.model_price,
              other.group_ratio,
              other?.user_group_ratio,
              other.cache_ratio || 1.0,
              other.cache_creation_ratio || 1.0,
            )
            : renderLogContent(
              other?.model_ratio,
              other.completion_ratio,
              other.model_price,
              other.group_ratio,
              other?.user_group_ratio,
              false,
              1.0,
              other.web_search || false,
              other.web_search_call_count || 0,
              other.file_search || false,
              other.file_search_call_count || 0,
            ),
        });
      }
      if (logs[i].type === 2) {
        let modelMapped =
          other?.is_model_mapped &&
          other?.upstream_model_name &&
          other?.upstream_model_name !== '';
        if (modelMapped) {
          expandDataLocal.push({
            key: t('请求并计费模型'),
            value: logs[i].model_name,
          });
          expandDataLocal.push({
            key: t('实际模型'),
            value: other.upstream_model_name,
          });
        }
        let content = '';
        if (other?.ws || other?.audio) {
          content = renderAudioModelPrice(
            other?.text_input,
            other?.text_output,
            other?.model_ratio,
            other?.model_price,
            other?.completion_ratio,
            other?.audio_input,
            other?.audio_output,
            other?.audio_ratio,
            other?.audio_completion_ratio,
            other?.group_ratio,
            other?.user_group_ratio,
            other?.cache_tokens || 0,
            other?.cache_ratio || 1.0,
          );
        } else if (other?.claude) {
          content = renderClaudeModelPrice(
            logs[i].prompt_tokens,
            logs[i].completion_tokens,
            other.model_ratio,
            other.model_price,
            other.completion_ratio,
            other.group_ratio,
            other?.user_group_ratio,
            other.cache_tokens || 0,
            other.cache_ratio || 1.0,
            other.cache_creation_tokens || 0,
            other.cache_creation_ratio || 1.0,
          );
        } else {
          content = renderModelPrice(
            logs[i].prompt_tokens,
            logs[i].completion_tokens,
            other?.model_ratio,
            other?.model_price,
            other?.completion_ratio,
            other?.group_ratio,
            other?.user_group_ratio,
            other?.cache_tokens || 0,
            other?.cache_ratio || 1.0,
            other?.image || false,
            other?.image_ratio || 0,
            other?.image_output || 0,
            other?.web_search || false,
            other?.web_search_call_count || 0,
            other?.web_search_price || 0,
            other?.file_search || false,
            other?.file_search_call_count || 0,
            other?.file_search_price || 0,
            other?.audio_input_seperate_price || false,
            other?.audio_input_token_count || 0,
            other?.audio_input_price || 0,
          );
        }
        expandDataLocal.push({
          key: t('计费过程'),
          value: content,
        });
        if (other?.reasoning_effort) {
          expandDataLocal.push({
            key: t('Reasoning Effort'),
            value: other.reasoning_effort,
          });
        }
      }
      expandDatesLocal[logs[i].key] = expandDataLocal;
    }

    setExpandData(expandDatesLocal);
    setLogs(logs);
  };

  const loadLogs = async (startIdx, pageSize, customLogType = null) => {
    setLoading(true);

    let url = '';
    const {
      username,
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      channel,
      group,
      logType: formLogType,
    } = getFormValues();

    // 使用传入的 logType 或者表单中的 logType 或者状态中的 logType
    const currentLogType =
      customLogType !== null
        ? customLogType
        : formLogType !== undefined
          ? formLogType
          : logType;

    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    if (isAdminUser) {
      url = `/api/log/?p=${startIdx}&page_size=${pageSize}&type=${currentLogType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}`;
    } else {
      url = `/api/log/self/?p=${startIdx}&page_size=${pageSize}&type=${currentLogType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&group=${group}`;
    }
    url = encodeURI(url);
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setPageSize(data.page_size);
      setLogCount(data.total);

      setLogsFormat(newPageData);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadLogs(page, pageSize).then((r) => { }); // 不传入logType，让其从表单获取最新值
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadLogs(activePage, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  const refresh = async () => {
    setActivePage(1);
    handleEyeClick();
    await loadLogs(1, pageSize); // 不传入logType，让其从表单获取最新值
  };

  const copyText = async (e, text) => {
    e.stopPropagation();
    if (await copy(text)) {
      showSuccess('已复制：' + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  useEffect(() => {
    const localPageSize =
      parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(activePage, localPageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  // 当 formApi 可用时，初始化统计
  useEffect(() => {
    if (formApi) {
      handleEyeClick();
    }
  }, [formApi]);

  const expandRowRender = (record, index) => {
    return <Descriptions data={expandData[record.key]} />;
  };

  // 检查是否有任何记录有展开内容
  const hasExpandableRows = () => {
    return logs.some(
      (log) => expandData[log.key] && expandData[log.key].length > 0,
    );
  };

  const [compactMode, setCompactMode] = useTableCompactMode('logs');

  return (
    <>
      {renderColumnSelector()}
      <Card
        className='!rounded-2xl mb-4'
        title={
          <div className='flex flex-col w-full'>
            <Spin spinning={loadingStat}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full">
                <Space>
                  <Tag
                    color='blue'
                    style={{
                      fontWeight: 500,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      padding: 13,
                    }}
                    className='!rounded-lg'
                  >
                    {t('消耗额度')}: {renderQuota(stat.quota)}
                  </Tag>
                  <Tag
                    color='pink'
                    style={{
                      fontWeight: 500,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      padding: 13,
                    }}
                    className='!rounded-lg'
                  >
                    RPM: {stat.rpm}
                  </Tag>
                  <Tag
                    color='white'
                    style={{
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      fontWeight: 500,
                      padding: 13,
                    }}
                    className='!rounded-lg'
                  >
                    TPM: {stat.tpm}
                  </Tag>
                </Space>

                <Button
                  type='tertiary'
                  className="w-full md:w-auto"
                  onClick={() => setCompactMode(!compactMode)}
                  size="small"
                >
                  {compactMode ? t('自适应列表') : t('紧凑列表')}
                </Button>
              </div>
            </Spin>

            <Divider margin='12px' />

            {/* 搜索表单区域 */}
            <Form
              initValues={formInitValues}
              getFormApi={(api) => setFormApi(api)}
              onSubmit={refresh}
              allowEmpty={true}
              autoComplete='off'
              layout='vertical'
              trigger='change'
              stopValidateWithError={false}
            >
              <div className='flex flex-col gap-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                  {/* 时间选择器 */}
                  <div className='col-span-1 lg:col-span-2'>
                    <Form.DatePicker
                      field='dateRange'
                      className='w-full'
                      type='dateTimeRange'
                      placeholder={[t('开始时间'), t('结束时间')]}
                      showClear
                      pure
                      size="small"
                    />
                  </div>

                  {/* 其他搜索字段 */}
                  <Form.Input
                    field='token_name'
                    prefix={<IconSearch />}
                    placeholder={t('令牌名称')}
                    showClear
                    pure
                    size="small"
                  />

                  <Form.Input
                    field='model_name'
                    prefix={<IconSearch />}
                    placeholder={t('模型名称')}
                    showClear
                    pure
                    size="small"
                  />

                  <Form.Input
                    field='group'
                    prefix={<IconSearch />}
                    placeholder={t('分组')}
                    showClear
                    pure
                    size="small"
                  />

                  {isAdminUser && (
                    <>
                      <Form.Input
                        field='channel'
                        prefix={<IconSearch />}
                        placeholder={t('渠道 ID')}
                        showClear
                        pure
                        size="small"
                      />
                      <Form.Input
                        field='username'
                        prefix={<IconSearch />}
                        placeholder={t('用户名称')}
                        showClear
                        pure
                        size="small"
                      />
                    </>
                  )}
                </div>

                {/* 操作按钮区域 */}
                <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3'>
                  {/* 日志类型选择器 */}
                  <div className='w-full sm:w-auto'>
                    <Form.Select
                      field='logType'
                      placeholder={t('日志类型')}
                      className='w-full sm:w-auto min-w-[120px]'
                      showClear
                      pure
                      onChange={() => {
                        // 延迟执行搜索，让表单值先更新
                        setTimeout(() => {
                          refresh();
                        }, 0);
                      }}
                      size="small"
                    >
                      <Form.Select.Option value='0'>
                        {t('全部')}
                      </Form.Select.Option>
                      <Form.Select.Option value='1'>
                        {t('充值')}
                      </Form.Select.Option>
                      <Form.Select.Option value='2'>
                        {t('消费')}
                      </Form.Select.Option>
                      <Form.Select.Option value='3'>
                        {t('管理')}
                      </Form.Select.Option>
                      <Form.Select.Option value='4'>
                        {t('系统')}
                      </Form.Select.Option>
                      <Form.Select.Option value='5'>
                        {t('错误')}
                      </Form.Select.Option>
                    </Form.Select>
                  </div>

                  <div className='flex gap-2 w-full sm:w-auto justify-end'>
                    <Button
                      type='tertiary'
                      htmlType='submit'
                      loading={loading}
                      size="small"
                    >
                      {t('查询')}
                    </Button>
                    <Button
                      type='tertiary'
                      onClick={() => {
                        if (formApi) {
                          formApi.reset();
                          setLogType(0);
                          setTimeout(() => {
                            refresh();
                          }, 100);
                        }
                      }}
                      size="small"
                    >
                      {t('重置')}
                    </Button>
                    <Button
                      type='tertiary'
                      onClick={() => setShowColumnSelector(true)}
                      size="small"
                    >
                      {t('列设置')}
                    </Button>
                  </div>
                </div>
              </div>
            </Form>
          </div>
        }
        shadows='always'
        bordered={false}
      >
        <Table
          columns={compactMode ? getVisibleColumns().map(({ fixed, ...rest }) => rest) : getVisibleColumns()}
          {...(hasExpandableRows() && {
            expandedRowRender: expandRowRender,
            expandRowByClick: true,
            rowExpandable: (record) =>
              expandData[record.key] && expandData[record.key].length > 0,
          })}
          dataSource={logs}
          rowKey='key'
          loading={loading}
          scroll={compactMode ? undefined : { x: 'max-content' }}
          className='rounded-xl overflow-hidden'
          size='middle'
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('搜索无结果')}
              style={{ padding: 30 }}
            />
          }
          pagination={{
            formatPageText: (page) =>
              t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
                start: page.currentStart,
                end: page.currentEnd,
                total: logCount,
              }),
            currentPage: activePage,
            pageSize: pageSize,
            total: logCount,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            onPageSizeChange: (size) => {
              handlePageSizeChange(size);
            },
            onPageChange: handlePageChange,
          }}
        />
      </Card>
    </>
  );
};

export default LogsTable;
