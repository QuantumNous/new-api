import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Select, Button, Form, Row, Col, Switch, InputNumber, Input, Spin, Popconfirm, Typography } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning, compareObjects, isAdmin } from '../../helpers';

const CHART_CONFIG = { mode: 'desktop-browser' };

const GroupMonitorAdmin = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // 配置数据
  const [globalSettings, setGlobalSettings] = useState({
    'group_monitor_setting.enabled': false,
    'group_monitor_setting.interval_mins': 5,
    'group_monitor_setting.test_model': 'claude-3-5-haiku-20241022',
    'group_monitor_setting.retain_days': 7,
  });
  const [savedSettings, setSavedSettings] = useState({});
  const [configs, setConfigs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [channels, setChannels] = useState([]);

  // 监控数据
  const [latestData, setLatestData] = useState([]);
  const [statsData, setStatsData] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize] = useState(20);
  const [logGroupFilter, setLogGroupFilter] = useState('');

  // 新增配置表单
  const [editingConfig, setEditingConfig] = useState({ group_name: '', channel_id: 0, test_model: '', enabled: true });

  // 加载全局设置
  const loadGlobalSettings = useCallback(async () => {
    const res = await API.get('/api/option/');
    if (res.data.success) {
      const opts = res.data.data;
      const current = {};
      for (const key of Object.keys(globalSettings)) {
        if (opts[key] !== undefined) {
          if (key.includes('enabled')) {
            current[key] = opts[key] === 'true';
          } else if (key.includes('interval') || key.includes('retain') || key.includes('days')) {
            current[key] = parseInt(opts[key]);
          } else {
            current[key] = opts[key];
          }
        } else {
          current[key] = globalSettings[key];
        }
      }
      setGlobalSettings(current);
      setSavedSettings(structuredClone(current));
    }
  }, []);

  // 保存全局设置
  const saveGlobalSettings = async () => {
    const updateArray = compareObjects(globalSettings, savedSettings);
    if (!updateArray.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }
    setLoading(true);
    const requests = updateArray.map((item) => {
      const value = typeof globalSettings[item.key] === 'boolean' ? String(globalSettings[item.key]) : String(globalSettings[item.key]);
      return API.put('/api/option/', { key: item.key, value });
    });
    const results = await Promise.all(requests);
    if (results.some((r) => !r)) {
      showError(t('部分保存失败，请重试'));
    } else {
      showSuccess(t('保存成功'));
      setSavedSettings(structuredClone(globalSettings));
    }
    setLoading(false);
  };

  // 加载分组列表
  const loadGroups = useCallback(async () => {
    const res = await API.get('/api/group/');
    if (res.data.success) {
      setGroups(res.data.data || []);
    }
  }, []);

  // 加载渠道列表
  const loadChannels = useCallback(async () => {
    const res = await API.get('/api/channel/', { params: { p: 1, page_size: 100 } });
    if (res.data.success) {
      setChannels(res.data.data?.items || res.data.data || []);
    }
  }, []);

  // 加载分组监控配置
  const loadConfigs = useCallback(async () => {
    const res = await API.get('/api/group/monitor/configs');
    if (res.data.success) {
      setConfigs(res.data.data || []);
    }
  }, []);

  // 保存分组监控配置
  const saveConfig = async () => {
    if (!editingConfig.group_name) {
      showError(t('请选择分组'));
      return;
    }
    if (!editingConfig.channel_id) {
      showError(t('请选择渠道'));
      return;
    }
    const res = await API.post('/api/group/monitor/configs', editingConfig);
    if (res.data.success) {
      showSuccess(t('保存成功'));
      loadConfigs();
      setEditingConfig({ group_name: '', channel_id: 0, test_model: '', enabled: true });
    }
  };

  // 删除分组监控配置
  const deleteConfig = async (groupName) => {
    const res = await API.delete(`/api/group/monitor/configs/${groupName}`);
    if (res.data.success) {
      showSuccess(t('删除成功'));
      loadConfigs();
    }
  };

  // 加载最新状态
  const loadLatest = useCallback(async () => {
    const res = await API.get('/api/group/monitor/latest');
    if (res.data.success) {
      setLatestData(res.data.data || []);
    }
  }, []);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    const res = await API.get('/api/group/monitor/stats');
    if (res.data.success) {
      setStatsData(res.data.data || []);
    }
  }, []);

  // 加载时间序列数据
  const loadTimeSeries = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await API.get('/api/group/monitor/time_series', {
      params: { start_timestamp: now - 3600 },
    });
    if (res.data.success) {
      setTimeSeriesData(res.data.data || []);
    }
  }, []);

  // 加载日志
  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = { p: logPage, page_size: logPageSize };
    if (logGroupFilter) params.group = logGroupFilter;
    const res = await API.get('/api/group/monitor/logs', { params });
    if (res.data.success) {
      const pageData = res.data.data;
      setLogs(pageData.items || []);
      setLogTotal(pageData.total || 0);
    }
    setLoading(false);
  }, [logPage, logPageSize, logGroupFilter]);

  useEffect(() => {
    loadGlobalSettings();
    loadGroups();
    loadChannels();
    loadConfigs();
    loadLatest();
    loadStats();
    loadTimeSeries();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logPage, logGroupFilter]);

  // 构建延迟趋势图 spec
  const chartSpec = {
    type: 'line',
    data: [
      {
        id: 'latencyData',
        values: timeSeriesData.map((item) => ({
          time: dayjs.unix(item.created_at).format('HH:mm'),
          latency: item.latency_ms,
          group: item.group_name,
          success: item.success,
        })),
      },
    ],
    xField: 'time',
    yField: 'latency',
    seriesField: 'group',
    legends: { visible: true },
    title: {
      visible: true,
      text: t('延迟趋势'),
      subtext: t('最近1小时'),
    },
    line: {
      style: {
        curveType: 'monotone',
        lineWidth: 2,
      },
    },
    point: {
      visible: true,
      style: {
        size: 6,
        fill: (datum) => (datum.success ? undefined : '#ff4d4f'),
        stroke: (datum) => (datum.success ? undefined : '#ff4d4f'),
      },
    },
    axes: [
      { orient: 'bottom', label: { autoRotate: true } },
      { orient: 'left', title: { visible: true, text: 'ms' } },
    ],
    tooltip: {
      mark: {
        content: [
          { key: (datum) => datum.group, value: (datum) => `${datum.latency}ms` },
        ],
      },
    },
  };

  // 日志表格列
  const logColumns = [
    { title: t('分组'), dataIndex: 'group_name', width: 120 },
    { title: t('渠道'), dataIndex: 'channel_name', width: 150 },
    { title: t('模型'), dataIndex: 'model_name', width: 200 },
    {
      title: t('延迟'),
      dataIndex: 'latency_ms',
      width: 100,
      render: (ms) => `${ms}ms`,
    },
    {
      title: t('状态'),
      dataIndex: 'success',
      width: 80,
      render: (success) =>
        success ? (
          <Tag color='green'>{t('成功')}</Tag>
        ) : (
          <Tag color='red'>{t('失败')}</Tag>
        ),
    },
    { title: t('缓存模型'), dataIndex: 'cached_model', width: 200 },
    {
      title: t('错误信息'),
      dataIndex: 'error_msg',
      width: 300,
      ellipsis: true,
    },
    {
      title: t('时间'),
      dataIndex: 'created_at',
      width: 180,
      render: (ts) => dayjs.unix(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  // 配置表格列
  const configColumns = [
    { title: t('分组'), dataIndex: 'group_name', width: 120 },
    {
      title: t('渠道'),
      dataIndex: 'channel_id',
      width: 150,
      render: (id) => {
        const ch = channels.find((c) => c.id === id);
        return ch ? `${ch.name} (#${id})` : `#${id}`;
      },
    },
    { title: t('测试模型'), dataIndex: 'test_model', width: 200, render: (v) => v || t('使用全局默认') },
    {
      title: t('启用'),
      dataIndex: 'enabled',
      width: 80,
      render: (enabled) =>
        enabled ? (
          <Tag color='green'>{t('启用')}</Tag>
        ) : (
          <Tag color='grey'>{t('禁用')}</Tag>
        ),
    },
    {
      title: t('操作'),
      width: 100,
      render: (_, record) => (
        <Popconfirm title={t('确定删除？')} onConfirm={() => deleteConfig(record.group_name)}>
          <Button theme='light' type='danger' size='small'>
            {t('删除')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 构建统计 map
  const statsMap = {};
  statsData.forEach((s) => {
    statsMap[s.group_name] = s;
  });

  return (
    <div className='p-4'>
      <Typography.Title heading={3} className='mb-4'>{t('分组监控')}</Typography.Title>

      {/* 全局设置 */}
      <Card title={t('全局设置')} className='mb-4'>
        <Spin spinning={loading}>
          <Row gutter={16} className='items-end'>
            <Col span={4}>
              <div className='mb-2'>{t('启用分组监控')}</div>
              <Switch
                checked={globalSettings['group_monitor_setting.enabled']}
                checkedText='|'
                uncheckedText='O'
                onChange={(v) => setGlobalSettings({ ...globalSettings, 'group_monitor_setting.enabled': v })}
              />
            </Col>
            <Col span={5}>
              <div className='mb-2'>{t('监控间隔')}</div>
              <InputNumber
                value={globalSettings['group_monitor_setting.interval_mins']}
                min={1}
                suffix={t('分钟')}
                onChange={(v) => setGlobalSettings({ ...globalSettings, 'group_monitor_setting.interval_mins': parseInt(v) })}
              />
            </Col>
            <Col span={7}>
              <div className='mb-2'>{t('默认测试模型')}</div>
              <Input
                value={globalSettings['group_monitor_setting.test_model']}
                onChange={(v) => setGlobalSettings({ ...globalSettings, 'group_monitor_setting.test_model': v })}
              />
            </Col>
            <Col span={4}>
              <div className='mb-2'>{t('日志保留天数')}</div>
              <InputNumber
                value={globalSettings['group_monitor_setting.retain_days']}
                min={1}
                suffix={t('天')}
                onChange={(v) => setGlobalSettings({ ...globalSettings, 'group_monitor_setting.retain_days': parseInt(v) })}
              />
            </Col>
            <Col span={4}>
              <Button theme='solid' onClick={saveGlobalSettings}>
                {t('保存设置')}
              </Button>
            </Col>
          </Row>
        </Spin>
      </Card>

      {/* 分组渠道配置 */}
      <Card title={t('分组监控配置')} className='mb-4'>
        <Row gutter={16} className='items-end mb-4'>
          <Col span={5}>
            <div className='mb-2'>{t('分组')}</div>
            <Select
              value={editingConfig.group_name}
              placeholder={t('选择分组')}
              style={{ width: '100%' }}
              onChange={(v) => setEditingConfig({ ...editingConfig, group_name: v })}
            >
              {groups.map((g) => (
                <Select.Option key={g} value={g}>
                  {g}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <div className='mb-2'>{t('监控渠道')}</div>
            <Select
              value={editingConfig.channel_id}
              placeholder={t('选择渠道')}
              style={{ width: '100%' }}
              showClear
              filter
              onChange={(v) => setEditingConfig({ ...editingConfig, channel_id: v })}
            >
              {channels.map((ch) => (
                <Select.Option key={ch.id} value={ch.id}>
                  {ch.name} (#{ch.id})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <div className='mb-2'>{t('测试模型')}</div>
            <Input
              value={editingConfig.test_model}
              placeholder={t('留空使用全局默认')}
              onChange={(v) => setEditingConfig({ ...editingConfig, test_model: v })}
            />
          </Col>
          <Col span={3}>
            <div className='mb-2'>{t('启用')}</div>
            <Switch
              checked={editingConfig.enabled}
              checkedText='|'
              uncheckedText='O'
              onChange={(v) => setEditingConfig({ ...editingConfig, enabled: v })}
            />
          </Col>
          <Col span={4}>
            <Button theme='solid' onClick={saveConfig}>
              {t('添加/更新')}
            </Button>
          </Col>
        </Row>
        <Table columns={configColumns} dataSource={configs} rowKey='id' pagination={false} size='small' />
      </Card>

      {/* 状态概览卡片 */}
      <Card title={t('分组概览')} className='mb-4'>
        <Row gutter={16}>
          {latestData.map((item) => {
            const stat = statsMap[item.group_name];
            const availability = stat && stat.total_count > 0 ? ((stat.success_count / stat.total_count) * 100).toFixed(1) : '-';
            const avgLatency = stat ? Math.round(stat.avg_latency) : '-';
            return (
              <Col key={item.group_name} xs={24} sm={12} md={8} lg={6} className='mb-4'>
                <Card
                  bodyStyle={{ padding: '16px' }}
                  style={{
                    borderLeft: `4px solid ${item.success ? '#52c41a' : '#ff4d4f'}`,
                  }}
                >
                  <div className='font-semibold text-base mb-2'>{item.group_name}</div>
                  <div className='flex justify-between mb-1'>
                    <span className='text-gray-500'>{t('延迟')}</span>
                    <span style={{ color: item.success ? '#52c41a' : '#ff4d4f' }}>
                      {item.latency_ms}ms
                    </span>
                  </div>
                  <div className='flex justify-between mb-1'>
                    <span className='text-gray-500'>{t('可用率')}</span>
                    <span style={{ color: availability !== '-' && parseFloat(availability) >= 95 ? '#52c41a' : '#ff4d4f' }}>
                      {availability}%
                    </span>
                  </div>
                  <div className='flex justify-between mb-1'>
                    <span className='text-gray-500'>{t('平均延迟')}</span>
                    <span>{avgLatency}ms</span>
                  </div>
                  <div className='text-xs text-gray-400 mt-2'>
                    {dayjs.unix(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </Card>
              </Col>
            );
          })}
          {latestData.length === 0 && (
            <Col span={24}>
              <div className='text-center text-gray-400 py-8'>{t('暂无监控数据')}</div>
            </Col>
          )}
        </Row>
      </Card>

      {/* 延迟趋势图 */}
      {timeSeriesData.length > 0 && (
        <Card title={t('延迟趋势')} className='mb-4'>
          <div className='h-96 p-2'>
            <VChart spec={chartSpec} option={CHART_CONFIG} />
          </div>
        </Card>
      )}

      {/* 监控日志 */}
      <Card title={t('监控日志')}>
        <div className='mb-4'>
          <Select
            value={logGroupFilter}
            placeholder={t('筛选分组')}
            style={{ width: 200 }}
            showClear
            onChange={(v) => {
              setLogGroupFilter(v || '');
              setLogPage(1);
            }}
          >
            {groups.map((g) => (
              <Select.Option key={g} value={g}>
                {g}
              </Select.Option>
            ))}
          </Select>
          <Button className='ml-2' onClick={() => { loadLatest(); loadStats(); loadTimeSeries(); loadLogs(); }}>
            {t('刷新')}
          </Button>
        </div>
        <Table
          columns={logColumns}
          dataSource={logs}
          rowKey='id'
          loading={loading}
          pagination={{
            currentPage: logPage,
            total: logTotal,
            pageSize: logPageSize,
            onPageChange: (page) => setLogPage(page),
          }}
          size='small'
        />
      </Card>
    </div>
  );
};

export default GroupMonitorAdmin;
