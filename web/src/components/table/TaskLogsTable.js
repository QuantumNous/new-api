import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Music,
  FileText,
  HelpCircle,
  CheckCircle,
  Pause,
  Clock,
  Play,
  XCircle,
  Loader,
  List,
  Hash,
  Video,
  Sparkles
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
  Layout,
  Modal,
  Progress,
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
import { TASK_ACTION_GENERATE, TASK_ACTION_TEXT_GENERATE } from '../../constants/common.constant';

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
  FINISH_TIME: 'finish_time',
  DURATION: 'duration',
  CHANNEL: 'channel',
  PLATFORM: 'platform',
  TYPE: 'type',
  TASK_ID: 'task_id',
  TASK_STATUS: 'task_status',
  PROGRESS: 'progress',
  FAIL_REASON: 'fail_reason',
  RESULT_URL: 'result_url',
};

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

function renderDuration(submit_time, finishTime) {
  if (!submit_time || !finishTime) return 'N/A';
  const durationSec = finishTime - submit_time;
  const color = durationSec > 60 ? 'red' : 'green';

  // 返回带有样式的颜色标签
  return (
    <Tag color={color} prefixIcon={<Clock size={14} />}>
      {durationSec} 秒
    </Tag>
  );
}

const LogsTable = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');

  // 列可见性状态
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const isAdminUser = isAdmin();
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);

  // 加载保存的列偏好设置
  useEffect(() => {
    const savedColumns = localStorage.getItem('task-logs-table-columns');
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
      [COLUMN_KEYS.FINISH_TIME]: true,
      [COLUMN_KEYS.DURATION]: true,
      [COLUMN_KEYS.CHANNEL]: isAdminUser,
      [COLUMN_KEYS.PLATFORM]: true,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.TASK_ID]: true,
      [COLUMN_KEYS.TASK_STATUS]: true,
      [COLUMN_KEYS.PROGRESS]: true,
      [COLUMN_KEYS.FAIL_REASON]: true,
      [COLUMN_KEYS.RESULT_URL]: true,
    };
  };

  // 初始化默认列可见性
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem('task-logs-table-columns', JSON.stringify(defaults));
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
      if (key === COLUMN_KEYS.CHANNEL && !isAdminUser) {
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
      localStorage.setItem('task-logs-table-columns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  const renderType = (type) => {
    switch (type) {
      case 'MUSIC':
        return (
          <Tag color='grey' shape='circle' prefixIcon={<Music size={14} />}>
            {t('生成音乐')}
          </Tag>
        );
      case 'LYRICS':
        return (
          <Tag color='pink' shape='circle' prefixIcon={<FileText size={14} />}>
            {t('生成歌词')}
          </Tag>
        );
      case TASK_ACTION_GENERATE:
        return (
          <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
            {t('图生视频')}
          </Tag>
        );
      case TASK_ACTION_TEXT_GENERATE:
        return (
          <Tag color='blue' shape='circle' prefixIcon={<Sparkles size={14} />}>
            {t('文生视频')}
          </Tag>
        );
      default:
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
    }
  };

  const renderPlatform = (platform) => {
    switch (platform) {
      case 'suno':
        return (
          <Tag color='green' shape='circle' prefixIcon={<Music size={14} />}>
            Suno
          </Tag>
        );
      case 'kling':
        return (
          <Tag color='orange' shape='circle' prefixIcon={<Video size={14} />}>
            Kling
          </Tag>
        );
      case 'jimeng':
        return (
          <Tag color='purple' shape='circle' prefixIcon={<Video size={14} />}>
            Jimeng
          </Tag>
        );
      default:
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
    }
  };

  const renderStatus = (type) => {
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
          <Tag color='blue' shape='circle' prefixIcon={<Play size={14} />}>
            {t('执行中')}
          </Tag>
        );
      case 'FAILURE':
        return (
          <Tag color='red' shape='circle' prefixIcon={<XCircle size={14} />}>
            {t('失败')}
          </Tag>
        );
      case 'QUEUED':
        return (
          <Tag color='orange' shape='circle' prefixIcon={<List size={14} />}>
            {t('排队中')}
          </Tag>
        );
      case 'UNKNOWN':
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
      case '':
        return (
          <Tag color='grey' shape='circle' prefixIcon={<Loader size={14} />}>
            {t('正在提交')}
          </Tag>
        );
      default:
        return (
          <Tag color='white' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知')}
          </Tag>
        );
    }
  };

  // 定义所有列
  const allColumns = [
    {
      key: COLUMN_KEYS.SUBMIT_TIME,
      title: t('提交时间'),
      dataIndex: 'submit_time',
      render: (text, record, index) => {
        return <div>{text ? renderTimestamp(text) : '-'}</div>;
      },
    },
    {
      key: COLUMN_KEYS.FINISH_TIME,
      title: t('结束时间'),
      dataIndex: 'finish_time',
      render: (text, record, index) => {
        return <div>{text ? renderTimestamp(text) : '-'}</div>;
      },
    },
    {
      key: COLUMN_KEYS.DURATION,
      title: t('花费时间'),
      dataIndex: 'finish_time',
      render: (finish, record) => {
        return <>{finish ? renderDuration(record.submit_time, finish) : '-'}</>;
      },
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel_id',
      className: isAdminUser ? 'tableShow' : 'tableHiddle',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div>
            <Tag
              color={colors[parseInt(text) % colors.length]}
              size='large'
              shape='circle'
              prefixIcon={<Hash size={14} />}
              onClick={() => {
                copyText(text);
              }}
            >
              {text}
            </Tag>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.PLATFORM,
      title: t('平台'),
      dataIndex: 'platform',
      render: (text, record, index) => {
        return <div>{renderPlatform(text)}</div>;
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
      dataIndex: 'task_id',
      render: (text, record, index) => {
        return (
          <Typography.Text
            ellipsis={{ showTooltip: true }}
            onClick={() => {
              setModalContent(JSON.stringify(record, null, 2));
              setIsModalOpen(true);
            }}
          >
            <div>{text}</div>
          </Typography.Text>
        );
      },
    },
    {
      key: COLUMN_KEYS.TASK_STATUS,
      title: t('任务状态'),
      dataIndex: 'status',
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
              isNaN(text?.replace('%', '')) ? (
                text || '-'
              ) : (
                <Progress
                  stroke={
                    record.status === 'FAILURE'
                      ? 'var(--semi-color-warning)'
                      : null
                  }
                  percent={text ? parseInt(text.replace('%', '')) : 0}
                  showInfo={true}
                  aria-label='task progress'
                  style={{ minWidth: '160px' }}
                />
              )
            }
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.FAIL_REASON,
      title: t('详情'),
      dataIndex: 'fail_reason',
      fixed: 'right',
      render: (text, record, index) => {
        // 仅当为视频生成任务且成功，且 fail_reason 是 URL 时显示可点击链接
        const isVideoTask = record.action === TASK_ACTION_GENERATE || record.action === TASK_ACTION_TEXT_GENERATE;
        const isSuccess = record.status === 'SUCCESS';
        const isUrl = typeof text === 'string' && /^https?:\/\//.test(text);
        if (isSuccess && isVideoTask && isUrl) {
          return (
            <a href={text} target="_blank" rel="noopener noreferrer">
              {t('点击预览视频')}
            </a>
          );
        }
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

  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [compactMode, setCompactMode] = useTableCompactMode('taskLogs');

  useEffect(() => {
    const localPageSize = parseInt(localStorage.getItem('task-page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(1, localPageSize).then();
  }, []);

  let now = new Date();
  // 初始化start_timestamp为前一天
  let zeroNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Form 初始值
  const formInitValues = {
    channel_id: '',
    task_id: '',
    dateRange: [
      timestamp2string(zeroNow.getTime() / 1000),
      timestamp2string(now.getTime() / 1000 + 3600)
    ],
  };

  // Form API 引用
  const [formApi, setFormApi] = useState(null);

  // 获取表单值的辅助函数
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};

    // 处理时间范围
    let start_timestamp = timestamp2string(zeroNow.getTime() / 1000);
    let end_timestamp = timestamp2string(now.getTime() / 1000 + 3600);

    if (formValues.dateRange && Array.isArray(formValues.dateRange) && formValues.dateRange.length === 2) {
      start_timestamp = formValues.dateRange[0];
      end_timestamp = formValues.dateRange[1];
    }

    return {
      channel_id: formValues.channel_id || '',
      task_id: formValues.task_id || '',
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
    const { channel_id, task_id, start_timestamp, end_timestamp } = getFormValues();
    let localStartTimestamp = parseInt(Date.parse(start_timestamp) / 1000);
    let localEndTimestamp = parseInt(Date.parse(end_timestamp) / 1000);
    let url = isAdminUser
      ? `/api/task/?p=${page}&page_size=${size}&channel_id=${channel_id}&task_id=${task_id}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`
      : `/api/task/self?p=${page}&page_size=${size}&task_id=${task_id}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
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
    localStorage.setItem('task-page-size', size + '');
    await loadLogs(1, size);
  };

  const refresh = async () => {
    await loadLogs(1, pageSize);
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

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
            if (!isAdminUser && column.key === COLUMN_KEYS.CHANNEL) {
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
                  <Text>{t('任务记录')}</Text>
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
                      field='task_id'
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
      </Layout>
    </>
  );
};

export default LogsTable;
