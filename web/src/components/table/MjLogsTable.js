import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Palette,
  ZoomIn,
  Shuffle,
  Move,
  FileText,
  Blend,
  Upload,
  Minimize2,
  RotateCcw,
  PaintBucket,
  Focus,
  Move3D,
  Monitor,
  UserCheck,
  HelpCircle,
  CheckCircle,
  Clock,
  Copy,
  FileX,
  Pause,
  XCircle,
  Loader,
  AlertCircle,
  Hash,
} from 'lucide-react';
import {
  API,
  copy,
  isAdmin,
  showError,
  showSuccess,
  timestamp2string
} from '../../helpers';

import {
  Button,
  Card,
  Checkbox,
  Divider,
  Empty,
  Form,
  ImagePreview,
  Layout,
  Modal,
  Progress,
  Skeleton,
  Table,
  Tag,
  Typography
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  IconEyeOpened,
  IconSearch,
} from '@douyinfe/semi-icons';
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

// 定义列键值常量
const COLUMN_KEYS = {
  SUBMIT_TIME: 'submit_time',
  DURATION: 'duration',
  CHANNEL: 'channel',
  TYPE: 'type',
  TASK_ID: 'task_id',
  SUBMIT_RESULT: 'submit_result',
  TASK_STATUS: 'task_status',
  PROGRESS: 'progress',
  IMAGE: 'image',
  PROMPT: 'prompt',
  PROMPT_EN: 'prompt_en',
  FAIL_REASON: 'fail_reason',
};

const LogsTable = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');

  // 列可见性状态
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const isAdminUser = isAdmin();
  const [compactMode, setCompactMode] = useTableCompactMode('mjLogs');

  // 加载保存的列偏好设置
  useEffect(() => {
    const savedColumns = localStorage.getItem('mj-logs-table-columns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
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

  // 获取默认列可见性
  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.SUBMIT_TIME]: true,
      [COLUMN_KEYS.DURATION]: true,
      [COLUMN_KEYS.CHANNEL]: isAdminUser,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.TASK_ID]: true,
      [COLUMN_KEYS.SUBMIT_RESULT]: isAdminUser,
      [COLUMN_KEYS.TASK_STATUS]: true,
      [COLUMN_KEYS.PROGRESS]: true,
      [COLUMN_KEYS.IMAGE]: true,
      [COLUMN_KEYS.PROMPT]: true,
      [COLUMN_KEYS.PROMPT_EN]: true,
      [COLUMN_KEYS.FAIL_REASON]: true,
    };
  };

  // 初始化默认列可见性
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem('mj-logs-table-columns', JSON.stringify(defaults));
  };

  // 处理列可见性变化
  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  // 处理全选
  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};

    allKeys.forEach((key) => {
      if ((key === COLUMN_KEYS.CHANNEL || key === COLUMN_KEYS.SUBMIT_RESULT) && !isAdminUser) {
        updatedColumns[key] = false;
      } else {
        updatedColumns[key] = checked;
      }
    });

    setVisibleColumns(updatedColumns);
  };

  // 更新表格时保存列可见性
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem('mj-logs-table-columns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  function renderType(type) {
    switch (type) {
      case 'IMAGINE':
        return (
          <Tag color='blue' shape='circle' prefixIcon={<Palette size={14} />}>
            {t('绘图')}
          </Tag>
        );
      case 'UPSCALE':
        return (
          <Tag color='orange' shape='circle' prefixIcon={<ZoomIn size={14} />}>
            {t('放大')}
          </Tag>
        );
      case 'VIDEO':
        return (
          <Tag color='orange' shape='circle' prefixIcon={<Video size={14} />}>
            {t('视频')}
          </Tag>
        );
      case 'EDITS':
        return (
          <Tag color='orange' shape='circle' prefixIcon={<Video size={14} />}>
            {t('编辑')}
          </Tag>
        );
      case 'VARIATION':
        return (
          <Tag color='purple' shape='circle' prefixIcon={<Shuffle size={14} />}>
            {t('变换')}
          </Tag>
        );
      case 'HIGH_VARIATION':
        return (
          <Tag color='purple' shape='circle' prefixIcon={<Shuffle size={14} />}>
            {t('强变换')}
          </Tag>
        );
      case 'LOW_VARIATION':
        return (
          <Tag color='purple' shape='circle' prefixIcon={<Shuffle size={14} />}>
            {t('弱变换')}
          </Tag>
        );
      case 'PAN':
        return (
          <Tag color='cyan' shape='circle' prefixIcon={<Move size={14} />}>
            {t('平移')}
          </Tag>
        );
      case 'DESCRIBE':
        return (
          <Tag color='yellow' shape='circle' prefixIcon={<FileText size={14} />}>
            {t('图生文')}
          </Tag>
        );
      case 'BLEND':
        return (
          <Tag color='lime' shape='circle' prefixIcon={<Blend size={14} />}>
            {t('图混合')}
          </Tag>
        );
      case 'UPLOAD':
        return (
          <Tag color='blue' shape='circle' prefixIcon={<Upload size={14} />}>
            上传文件
          </Tag>
        );
      case 'SHORTEN':
        return (
          <Tag color='pink' shape='circle' prefixIcon={<Minimize2 size={14} />}>
            {t('缩词')}
          </Tag>
        );
      case 'REROLL':
        return (
          <Tag color='indigo' shape='circle' prefixIcon={<RotateCcw size={14} />}>
            {t('重绘')}
          </Tag>
        );
      case 'INPAINT':
        return (
          <Tag color='violet' shape='circle' prefixIcon={<PaintBucket size={14} />}>
            {t('局部重绘-提交')}
          </Tag>
        );
      case 'ZOOM':
        return (
          <Tag color='teal' shape='circle' prefixIcon={<Focus size={14} />}>
            {t('变焦')}
          </Tag>
        );
      case 'CUSTOM_ZOOM':
        return (
          <Tag color='teal' shape='circle' prefixIcon={<Move3D size={14} />}>
            {t('自定义变焦-提交')}
          </Tag>
        );
      case 'MODAL':
        return (
          <Tag color='green' shape='circle' prefixIcon={<Monitor size={14} />}>
            {t('窗口处理')}
          </Tag>
        );
      case 'SWAP_FACE':
        return (
          <Tag color='light-green' shape='circle' prefixIcon={<UserCheck size={14} />}>
            {t('换脸')}
          </Tag>
        );
      default:
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
    }
  }

  function renderCode(code) {
    switch (code) {
      case 1:
        return (
          <Tag color='green' shape='circle' prefixIcon={<CheckCircle size={14} />}>
            {t('已提交')}
          </Tag>
        );
      case 21:
        return (
          <Tag color='lime' shape='circle' prefixIcon={<Clock size={14} />}>
            {t('等待中')}
          </Tag>
        );
      case 22:
        return (
          <Tag color='orange' shape='circle' prefixIcon={<Copy size={14} />}>
            {t('重复提交')}
          </Tag>
        );
      case 0:
        return (
          <Tag color='yellow' shape='circle' prefixIcon={<FileX size={14} />}>
            {t('未提交')}
          </Tag>
        );
      default:
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
    }
  }

  function renderStatus(type) {
    switch (type) {
      case 'SUCCESS':
        return (
          <Tag color='green' shape='circle' prefixIcon={<CheckCircle size={14} />}>
            {t('成功')}
          </Tag>
        );
      case 'NOT_START':
        return (
          <Tag color='grey' shape='circle' prefixIcon={<Pause size={14} />}>
            {t('未启动')}
          </Tag>
        );
      case 'SUBMITTED':
        return (
          <Tag color='yellow' shape='circle' prefixIcon={<Clock size={14} />}>
            {t('队列中')}
          </Tag>
        );
      case 'IN_PROGRESS':
        return (
          <Tag color='blue' shape='circle' prefixIcon={<Loader size={14} />}>
            {t('执行中')}
          </Tag>
        );
      case 'FAILURE':
        return (
          <Tag color='red' shape='circle' prefixIcon={<XCircle size={14} />}>
            {t('失败')}
          </Tag>
        );
      case 'MODAL':
        return (
          <Tag color='yellow' shape='circle' prefixIcon={<AlertCircle size={14} />}>
            {t('窗口等待')}
          </Tag>
        );
      default:
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
    }
  }

  const renderTimestamp = (timestampInSeconds) => {
    const date = new Date(timestampInSeconds * 1000); // 从秒转换为毫秒

    const year = date.getFullYear(); // 获取年份
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // 获取月份，从0开始需要+1，并保证两位数
    const day = ('0' + date.getDate()).slice(-2); // 获取日期，并保证两位数
    const hours = ('0' + date.getHours()).slice(-2); // 获取小时，并保证两位数
    const minutes = ('0' + date.getMinutes()).slice(-2); // 获取分钟，并保证两位数
    const seconds = ('0' + date.getSeconds()).slice(-2); // 获取秒钟，并保证两位数

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`; // 格式化输出
  };
  // 修改renderDuration函数以包含颜色逻辑
  function renderDuration(submit_time, finishTime) {
    if (!submit_time || !finishTime) return 'N/A';

    const start = new Date(submit_time);
    const finish = new Date(finishTime);
    const durationMs = finish - start;
    const durationSec = (durationMs / 1000).toFixed(1);
    const color = durationSec > 60 ? 'red' : 'green';

    return (
      <Tag color={color} shape='circle' prefixIcon={<Clock size={14} />}>
        {durationSec} {t('秒')}
      </Tag>
    );
  }

  // 定义所有列
  const allColumns = [
    {
      key: COLUMN_KEYS.SUBMIT_TIME,
      title: t('提交时间'),
      dataIndex: 'submit_time',
      render: (text, record, index) => {
        return <div>{renderTimestamp(text / 1000)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.DURATION,
      title: t('花费时间'),
      dataIndex: 'finish_time',
      render: (finish, record) => {
        return renderDuration(record.submit_time, finish);
      },
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel_id',
      className: isAdmin() ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div>
            <Tag
              color={colors[parseInt(text) % colors.length]}
              shape='circle'
              prefixIcon={<Hash size={14} />}
              onClick={() => {
                copyText(text);
              }}
            >
              {' '}
              {text}{' '}
            </Tag>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'action',
      render: (text, record, index) => {
        return <div>{renderType(text)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.TASK_ID,
      title: t('任务ID'),
      dataIndex: 'mj_id',
      render: (text, record, index) => {
        return <div>{text}</div>;
      },
    },
    {
      key: COLUMN_KEYS.SUBMIT_RESULT,
      title: t('提交结果'),
      dataIndex: 'code',
      className: isAdmin() ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        return isAdminUser ? <div>{renderCode(text)}</div> : <></>;
      },
    },
    {
      key: COLUMN_KEYS.TASK_STATUS,
      title: t('任务状态'),
      dataIndex: 'status',
      className: isAdmin() ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        return <div>{renderStatus(text)}</div>;
      },
    },
    {
      key: COLUMN_KEYS.PROGRESS,
      title: t('进度'),
      dataIndex: 'progress',
      render: (text, record, index) => {
        return (
          <div>
            {
              <Progress
                stroke={
                  record.status === 'FAILURE'
                    ? 'var(--semi-color-warning)'
                    : null
                }
                percent={text ? parseInt(text.replace('%', '')) : 0}
                showInfo={true}
                aria-label='drawing progress'
                style={{ minWidth: '160px' }}
              />
            }
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.IMAGE,
      title: t('结果图片'),
      dataIndex: 'image_url',
      render: (text, record, index) => {
        if (!text) {
          return t('无');
        }
        return (
          <Button
            size="small"
            onClick={() => {
              setModalImageUrl(text);
              setIsModalOpenurl(true);
            }}
          >
            {t('查看图片')}
          </Button>
        );
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: 'Prompt',
      dataIndex: 'prompt',
      render: (text, record, index) => {
        if (!text) {
          return t('无');
        }

        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ width: 100 }}
            onClick={() => {
              setModalContent(text);
              setIsModalOpen(true);
            }}
          >
            {text}
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.PROMPT_EN,
      title: 'PromptEn',
      dataIndex: 'prompt_en',
      render: (text, record, index) => {
        if (!text) {
          return t('无');
        }

        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ width: 100 }}
            onClick={() => {
              setModalContent(text);
              setIsModalOpen(true);
            }}
          >
            {text}
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.FAIL_REASON,
      title: t('失败原因'),
      dataIndex: 'fail_reason',
      fixed: 'right',
      render: (text, record, index) => {
        if (!text) {
          return t('无');
        }

        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            style={{ width: 100 }}
            onClick={() => {
              setModalContent(text);
              setIsModalOpen(true);
            }}
          >
            {text}
          </Typography.Text>
        );
      },
    },
  ];

  // 根据可见性设置过滤列
  const getVisibleColumns = () => {
    return allColumns.filter((column) => visibleColumns[column.key]);
  };

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // 定义模态框图片URL的状态和更新函数
  const [modalImageUrl, setModalImageUrl] = useState('');
  let now = new Date();

  // Form 初始值
  const formInitValues = {
    channel_id: '',
    mj_id: '',
    dateRange: [
      timestamp2string(now.getTime() / 1000 - 2592000),
      timestamp2string(now.getTime() / 1000 + 3600)
    ],
  };

  // Form API 引用
  const [formApi, setFormApi] = useState(null);

  const [stat, setStat] = useState({
    quota: 0,
    token: 0,
  });

  // 获取表单值的辅助函数
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};

    // 处理时间范围
    let start_timestamp = timestamp2string(now.getTime() / 1000 - 2592000);
    let end_timestamp = timestamp2string(now.getTime() / 1000 + 3600);

    if (formValues.dateRange && Array.isArray(formValues.dateRange) && formValues.dateRange.length === 2) {
      start_timestamp = formValues.dateRange[0];
      end_timestamp = formValues.dateRange[1];
    }

    return {
      channel_id: formValues.channel_id || '',
      mj_id: formValues.mj_id || '',
      start_timestamp,
      end_timestamp,
    };
  };

  const enrichLogs = (items) => {
    return items.map((log) => ({
      ...log,
      timestamp2string: timestamp2string(log.created_at),
      key: '' + log.id,
    }));
  };

  const syncPageData = (payload) => {
    const items = enrichLogs(payload.items || []);
    setLogs(items);
    setLogCount(payload.total || 0);
    setActivePage(payload.page || 1);
    setPageSize(payload.page_size || pageSize);
  };

  const loadLogs = async (page = 1, size = pageSize) => {
    setLoading(true);
    const { channel_id, mj_id, start_timestamp, end_timestamp } = getFormValues();
    let localStartTimestamp = Date.parse(start_timestamp);
    let localEndTimestamp = Date.parse(end_timestamp);
    const url = isAdminUser
      ? `/api/mj/?p=${page}&page_size=${size}&channel_id=${channel_id}&mj_id=${mj_id}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`
      : `/api/mj/self/?p=${page}&page_size=${size}&mj_id=${mj_id}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      syncPageData(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const pageData = logs;

  const handlePageChange = (page) => {
    loadLogs(page, pageSize).then();
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('mj-page-size', size + '');
    await loadLogs(1, size);
  };

  const refresh = async () => {
    await loadLogs(1, pageSize);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      // setSearchKeyword(text);
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  useEffect(() => {
    const localPageSize = parseInt(localStorage.getItem('mj-page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(1, localPageSize).then();
  }, []);

  useEffect(() => {
    const mjNotifyEnabled = localStorage.getItem('mj_notify_enabled');
    if (mjNotifyEnabled !== 'true') {
      setShowBanner(true);
    }
  }, []);

  // 列选择器模态框
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
        <div className="flex flex-wrap max-h-96 overflow-y-auto rounded-lg p-4" style={{ border: '1px solid var(--semi-color-border)' }}>
          {allColumns.map((column) => {
            // 为非管理员用户跳过管理员专用列
            if (
              !isAdminUser &&
              (column.key === COLUMN_KEYS.CHANNEL ||
                column.key === COLUMN_KEYS.SUBMIT_RESULT)
            ) {
              return null;
            }

            return (
              <div key={column.key} className="w-1/2 mb-4 pr-2">
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

  return (
    <>
      {renderColumnSelector()}
      <Layout>
        <Card
          className="!rounded-2xl mb-4"
          title={
            <div className="flex flex-col w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full">
                <div className="flex items-center text-orange-500 mb-2 md:mb-0">
                  <IconEyeOpened className="mr-2" />
                  {loading ? (
                    <Skeleton.Title
                      style={{
                        width: 300,
                        marginBottom: 0,
                        marginTop: 0
                      }}
                    />
                  ) : (
                    <Text>
                      {isAdminUser && showBanner
                        ? t('当前未开启Midjourney回调，部分项目可能无法获得绘图结果，可在运营设置中开启。')
                        : t('Midjourney 任务记录')}
                    </Text>
                  )}
                </div>
                <Button
                  type='tertiary'
                  className="w-full md:w-auto"
                  onClick={() => setCompactMode(!compactMode)}
                  size="small"
                >
                  {compactMode ? t('自适应列表') : t('紧凑列表')}
                </Button>
              </div>

              <Divider margin="12px" />

              {/* 搜索表单区域 */}
              <Form
                initValues={formInitValues}
                getFormApi={(api) => setFormApi(api)}
                onSubmit={refresh}
                allowEmpty={true}
                autoComplete="off"
                layout="vertical"
                trigger="change"
                stopValidateWithError={false}
              >
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 时间选择器 */}
                    <div className="col-span-1 lg:col-span-2">
                      <Form.DatePicker
                        field='dateRange'
                        className="w-full"
                        type='dateTimeRange'
                        placeholder={[t('开始时间'), t('结束时间')]}
                        showClear
                        pure
                        size="small"
                      />
                    </div>

                    {/* 任务 ID */}
                    <Form.Input
                      field='mj_id'
                      prefix={<IconSearch />}
                      placeholder={t('任务 ID')}
                      showClear
                      pure
                      size="small"
                    />

                    {/* 渠道 ID - 仅管理员可见 */}
                    {isAdminUser && (
                      <Form.Input
                        field='channel_id'
                        prefix={<IconSearch />}
                        placeholder={t('渠道 ID')}
                        showClear
                        pure
                        size="small"
                      />
                    )}
                  </div>

                  {/* 操作按钮区域 */}
                  <div className="flex justify-between items-center">
                    <div></div>
                    <div className="flex gap-2">
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
                            // 重置后立即查询，使用setTimeout确保表单重置完成
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
            dataSource={logs}
            rowKey='key'
            loading={loading}
            scroll={compactMode ? undefined : { x: 'max-content' }}
            className="rounded-xl overflow-hidden"
            size="middle"
            empty={
              <Empty
                image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
                darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
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
              onPageSizeChange: handlePageSizeChange,
              onPageChange: handlePageChange,
            }}
          />
        </Card>

        <Modal
          visible={isModalOpen}
          onOk={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
          closable={null}
          bodyStyle={{ height: '400px', overflow: 'auto' }} // 设置模态框内容区域样式
          width={800} // 设置模态框宽度
        >
          <p style={{ whiteSpace: 'pre-line' }}>{modalContent}</p>
        </Modal>
        <ImagePreview
          src={modalImageUrl}
          visible={isModalOpenurl}
          onVisibleChange={(visible) => setIsModalOpenurl(visible)}
        />
      </Layout>
    </>
  );
};

export default LogsTable;
