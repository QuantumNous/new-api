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

import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Row,
  Spin,
  Progress,
  Descriptions,
  Tag,
  Popconfirm,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// 格式化字节大小
function formatBytes(bytes, decimals = 2) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return '-' + formatBytes(-bytes, decimals);
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return bytes + ' Bytes';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function SettingsPerformance(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [inputs, setInputs] = useState({
    'performance_setting.disk_cache_enabled': false,
    'performance_setting.disk_cache_threshold_mb': 10,
    'performance_setting.disk_cache_max_size_mb': 1024,
    'performance_setting.disk_cache_path': '',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = String(inputs[item.key]);
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
        fetchStats();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await API.get('/api/performance/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch performance stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }

  async function clearDiskCache() {
    try {
      const res = await API.delete('/api/performance/disk_cache');
      if (res.data.success) {
        showSuccess(t('磁盘缓存已清理'));
        fetchStats();
      } else {
        showError(res.data.message || t('清理失败'));
      }
    } catch (error) {
      showError(t('清理失败'));
    }
  }

  async function resetStats() {
    try {
      const res = await API.post('/api/performance/reset_stats');
      if (res.data.success) {
        showSuccess(t('统计已重置'));
        fetchStats();
      }
    } catch (error) {
      showError(t('重置失败'));
    }
  }

  async function forceGC() {
    try {
      const res = await API.post('/api/performance/gc');
      if (res.data.success) {
        showSuccess(t('GC 已执行'));
        fetchStats();
      }
    } catch (error) {
      showError(t('GC 执行失败'));
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        if (typeof inputs[key] === 'boolean') {
          currentInputs[key] =
            props.options[key] === 'true' || props.options[key] === true;
        } else if (typeof inputs[key] === 'number') {
          currentInputs[key] = parseInt(props.options[key]) || inputs[key];
        } else {
          currentInputs[key] = props.options[key];
        }
      }
    }
    setInputs({ ...inputs, ...currentInputs });
    setInputsRow({ ...inputs, ...currentInputs });
    if (refForm.current) {
      refForm.current.setValues({ ...inputs, ...currentInputs });
    }
    fetchStats();
  }, [props.options]);

  const diskCacheUsagePercent =
    stats?.cache_stats?.disk_cache_max_bytes > 0
      ? (
          (stats.cache_stats.current_disk_usage_bytes /
            stats.cache_stats.disk_cache_max_bytes) *
          100
        ).toFixed(1)
      : 0;

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('磁盘缓存设置（磁盘换内存）')}>
            <Banner
              type='info'
              description={t(
                '启用磁盘缓存后，大请求体将临时存储到磁盘而非内存，可显著降低内存占用，适用于处理包含大量图片/文件的请求。建议在 SSD 环境下使用。',
              )}
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'performance_setting.disk_cache_enabled'}
                  label={t('启用磁盘缓存')}
                  extraText={t('将大请求体临时存储到磁盘')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={handleFieldChange(
                    'performance_setting.disk_cache_enabled',
                  )}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'performance_setting.disk_cache_threshold_mb'}
                  label={t('磁盘缓存阈值 (MB)')}
                  extraText={t('请求体超过此大小时使用磁盘缓存')}
                  min={1}
                  max={1024}
                  onChange={handleFieldChange(
                    'performance_setting.disk_cache_threshold_mb',
                  )}
                  disabled={!inputs['performance_setting.disk_cache_enabled']}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  field={'performance_setting.disk_cache_max_size_mb'}
                  label={t('磁盘缓存最大总量 (MB)')}
                  extraText={
                    stats?.disk_space_info?.total > 0
                      ? t('可用空间: {{free}} / 总空间: {{total}}', {
                          free: formatBytes(stats.disk_space_info.free),
                          total: formatBytes(stats.disk_space_info.total),
                        })
                      : t('磁盘缓存占用的最大空间')
                  }
                  min={100}
                  max={102400}
                  onChange={handleFieldChange(
                    'performance_setting.disk_cache_max_size_mb',
                  )}
                  disabled={!inputs['performance_setting.disk_cache_enabled']}
                />
              </Col>
              {/* 只在非容器环境显示缓存目录配置 */}
              {!stats?.config?.is_running_in_container && (
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.Input
                    field={'performance_setting.disk_cache_path'}
                    label={t('缓存目录')}
                    extraText={t('留空使用系统临时目录')}
                    placeholder={t('例如 /var/cache/new-api')}
                    onChange={handleFieldChange(
                      'performance_setting.disk_cache_path',
                    )}
                    showClear
                    disabled={!inputs['performance_setting.disk_cache_enabled']}
                  />
                </Col>
              )}
            </Row>
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存性能设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>

      {/* 性能统计 */}
      <Spin spinning={statsLoading}>
        <Form.Section text={t('性能监控')}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={fetchStats}>{t('刷新统计')}</Button>
                <Popconfirm
                  title={t('确认清理磁盘缓存？')}
                  content={t('这将删除所有临时缓存文件')}
                  onConfirm={clearDiskCache}
                >
                  <Button type='warning'>{t('清理磁盘缓存')}</Button>
                </Popconfirm>
                <Button onClick={resetStats}>{t('重置统计')}</Button>
                <Button onClick={forceGC}>{t('执行 GC')}</Button>
              </div>
            </Col>
          </Row>

          {stats && (
            <>
              {/* 缓存使用情况 */}
              <Row
                gutter={16}
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'stretch',
                }}
              >
                <Col xs={24} md={12} style={{ display: 'flex' }}>
                  <div
                    style={{
                      padding: 16,
                      background: 'var(--semi-color-fill-0)',
                      borderRadius: 8,
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Text strong style={{ marginBottom: 8, display: 'block' }}>
                      {t('请求体磁盘缓存')}
                    </Text>
                    <Progress
                      percent={parseFloat(diskCacheUsagePercent)}
                      showInfo
                      style={{ marginBottom: 8 }}
                      stroke={
                        parseFloat(diskCacheUsagePercent) > 80
                          ? 'var(--semi-color-danger)'
                          : 'var(--semi-color-primary)'
                      }
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <Text type='tertiary'>
                        {formatBytes(
                          stats.cache_stats.current_disk_usage_bytes,
                        )}{' '}
                        / {formatBytes(stats.cache_stats.disk_cache_max_bytes)}
                      </Text>
                      <Text type='tertiary'>
                        {t('活跃文件')}: {stats.cache_stats.active_disk_files}
                      </Text>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      <Tag color='blue'>
                        {t('磁盘命中')}: {stats.cache_stats.disk_cache_hits}
                      </Tag>
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={12} style={{ display: 'flex' }}>
                  <div
                    style={{
                      padding: 16,
                      background: 'var(--semi-color-fill-0)',
                      borderRadius: 8,
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Text strong style={{ marginBottom: 8, display: 'block' }}>
                      {t('请求体内存缓存')}
                    </Text>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <Text>
                        {t('当前缓存大小')}:{' '}
                        {formatBytes(
                          stats.cache_stats.current_memory_usage_bytes,
                        )}
                      </Text>
                      <Text>
                        {t('活跃缓存数')}:{' '}
                        {stats.cache_stats.active_memory_buffers}
                      </Text>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      <Tag color='green'>
                        {t('内存命中')}: {stats.cache_stats.memory_cache_hits}
                      </Tag>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* 缓存目录磁盘空间 */}
              {stats.disk_space_info?.total > 0 && (
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={24}>
                    <div
                      style={{
                        padding: 16,
                        background: 'var(--semi-color-fill-0)',
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        strong
                        style={{ marginBottom: 8, display: 'block' }}
                      >
                        {t('缓存目录磁盘空间')}
                      </Text>
                      <Progress
                        percent={parseFloat(
                          stats.disk_space_info.used_percent.toFixed(1),
                        )}
                        showInfo
                        style={{ marginBottom: 8 }}
                        stroke={
                          stats.disk_space_info.used_percent > 90
                            ? 'var(--semi-color-danger)'
                            : stats.disk_space_info.used_percent > 70
                              ? 'var(--semi-color-warning)'
                              : 'var(--semi-color-primary)'
                        }
                      />
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <Text type='tertiary'>
                          {t('已用')}: {formatBytes(stats.disk_space_info.used)}
                        </Text>
                        <Text type='tertiary'>
                          {t('可用')}: {formatBytes(stats.disk_space_info.free)}
                        </Text>
                        <Text type='tertiary'>
                          {t('总计')}:{' '}
                          {formatBytes(stats.disk_space_info.total)}
                        </Text>
                      </div>
                      {stats.disk_space_info.free <
                        inputs['performance_setting.disk_cache_max_size_mb'] *
                          1024 *
                          1024 && (
                        <Banner
                          type='warning'
                          description={t('磁盘可用空间小于缓存最大总量设置')}
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </div>
                  </Col>
                </Row>
              )}

              {/* 系统内存统计 */}
              <Row gutter={16}>
                <Col span={24}>
                  <Descriptions
                    data={[
                      {
                        key: t('已分配内存'),
                        value: formatBytes(stats.memory_stats.alloc),
                      },
                      {
                        key: t('总分配内存'),
                        value: formatBytes(stats.memory_stats.total_alloc),
                      },
                      {
                        key: t('系统内存'),
                        value: formatBytes(stats.memory_stats.sys),
                      },
                      { key: t('GC 次数'), value: stats.memory_stats.num_gc },
                      {
                        key: t('Goroutine 数'),
                        value: stats.memory_stats.num_goroutine,
                      },
                      { key: t('缓存目录'), value: stats.disk_cache_info.path },
                      {
                        key: t('目录文件数'),
                        value: stats.disk_cache_info.file_count,
                      },
                      {
                        key: t('目录总大小'),
                        value: formatBytes(stats.disk_cache_info.total_size),
                      },
                    ]}
                  />
                </Col>
              </Row>
            </>
          )}
        </Form.Section>
      </Spin>
    </>
  );
}
