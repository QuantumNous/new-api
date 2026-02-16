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

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Typography,
  Card,
  Tag,
  Progress,
  Descriptions,
  Spin,
  Empty,
  Button,
  Badge,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  FaInfoCircle,
  FaServer,
  FaClock,
  FaMapMarkerAlt,
  FaDocker,
  FaMoneyBillWave,
  FaChartLine,
  FaCopy,
  FaLink,
} from 'react-icons/fa';
import { IconRefresh } from '@douyinfe/semi-icons';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const ViewDetailsModal = ({ visible, onCancel, deployment }) => {
  const { t } = useTranslation();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState([]);
  const [containersLoading, setContainersLoading] = useState(false);

  const fetchDetails = async () => {
    if (!deployment?.id) return;

    setLoading(true);
    try {
      const response = await API.get(`/api/deployments/${deployment.id}`);
      if (response.data.success) {
        setDetails(response.data.data);
      }
    } catch (error) {
      showError(
        t('获取详情失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchContainers = async () => {
    if (!deployment?.id) return;

    setContainersLoading(true);
    try {
      const response = await API.get(
        `/api/deployments/${deployment.id}/containers`,
      );
      if (response.data.success) {
        setContainers(response.data.data?.containers || []);
      }
    } catch (error) {
      showError(
        t('获取容器信息失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setContainersLoading(false);
    }
  };

  useEffect(() => {
    if (visible && deployment?.id) {
      fetchDetails();
      fetchContainers();
    } else if (!visible) {
      setDetails(null);
      setContainers([]);
    }
  }, [visible, deployment?.id]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(deployment?.id);
    showSuccess(t('已复制 ID 到剪贴板'));
  };

  const handleRefresh = () => {
    fetchDetails();
    fetchContainers();
  };

  const getStatusConfig = (status) => {
    const statusConfig = {
      running: { color: 'green', text: '运行中', icon: '🟢' },
      completed: { color: 'green', text: '已完成', icon: '✅' },
      'deployment requested': { color: 'blue', text: '部署请求中', icon: '🔄' },
      'termination requested': {
        color: 'orange',
        text: '终止请求中',
        icon: '⏸️',
      },
      destroyed: { color: 'red', text: '已销毁', icon: '🔴' },
      failed: { color: 'red', text: '失败', icon: '❌' },
    };
    return statusConfig[status] || { color: 'grey', text: status, icon: '❓' };
  };

  const statusConfig = getStatusConfig(deployment?.status);

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          <FaInfoCircle className='text-blue-500' />
          <span>{t('容器详情')}</span>
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      footer={
        <div className='flex justify-between'>
          <Button
            icon={<IconRefresh />}
            onClick={handleRefresh}
            loading={loading || containersLoading}
            theme='borderless'
          >
            {t('刷新')}
          </Button>
          <Button onClick={onCancel}>{t('关闭')}</Button>
        </div>
      }
      width={800}
      className='deployment-details-modal'
    >
      {loading && !details ? (
        <div className='flex items-center justify-center py-12'>
          <Spin size='large' tip={t('加载详情中...')} />
        </div>
      ) : details ? (
        <div className='space-y-4 max-h-[600px] overflow-y-auto'>
          {/* Basic Info */}
          <Card
            title={
              <div className='flex items-center gap-2'>
                <FaServer className='text-blue-500' />
                <span>{t('基本信息')}</span>
              </div>
            }
            className='border-0 shadow-sm'
          >
            <Descriptions
              data={[
                {
                  key: t('容器名称'),
                  value: (
                    <div className='flex items-center gap-2'>
                      <Text strong className='text-base'>
                        {details.deployment_name || details.id}
                      </Text>
                      <Button
                        size='small'
                        theme='borderless'
                        icon={<FaCopy />}
                        onClick={handleCopyId}
                        className='opacity-70 hover:opacity-100'
                      />
                    </div>
                  ),
                },
                {
                  key: t('容器ID'),
                  value: (
                    <Text type='secondary' className='font-mono text-sm'>
                      {details.id}
                    </Text>
                  ),
                },
                {
                  key: t('状态'),
                  value: (
                    <div className='flex items-center gap-2'>
                      <span>{statusConfig.icon}</span>
                      <Tag color={statusConfig.color}>
                        {t(statusConfig.text)}
                      </Tag>
                    </div>
                  ),
                },
                {
                  key: t('创建时间'),
                  value: timestamp2string(details.created_at),
                },
              ]}
            />
          </Card>

          {/* Hardware & Performance */}
          <Card
            title={
              <div className='flex items-center gap-2'>
                <FaChartLine className='text-green-500' />
                <span>{t('硬件与性能')}</span>
              </div>
            }
            className='border-0 shadow-sm'
          >
            <div className='space-y-4'>
              <Descriptions
                data={[
                  {
                    key: t('硬件类型'),
                    value: (
                      <div className='flex items-center gap-2'>
                        <Tag color='blue'>{details.brand_name}</Tag>
                        <Text strong>{details.hardware_name}</Text>
                      </div>
                    ),
                  },
                  {
                    key: t('GPU数量'),
                    value: (
                      <div className='flex items-center gap-2'>
                        <Badge
                          count={details.total_gpus}
                          theme='solid'
                          type='primary'
                        >
                          <FaServer className='text-purple-500' />
                        </Badge>
                        <Text>
                          {t('总计')} {details.total_gpus} {t('个GPU')}
                        </Text>
                      </div>
                    ),
                  },
                  {
                    key: t('容器配置'),
                    value: (
                      <div className='space-y-1'>
                        <div>
                          {t('每容器GPU数')}: {details.gpus_per_container}
                        </div>
                        <div>
                          {t('容器总数')}: {details.total_containers}
                        </div>
                      </div>
                    ),
                  },
                ]}
              />

              {/* Progress Bar */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Text strong>{t('完成进度')}</Text>
                  <Text>{details.completed_percent}%</Text>
                </div>
                <Progress
                  percent={details.completed_percent}
                  status={
                    details.completed_percent === 100 ? 'success' : 'normal'
                  }
                  strokeWidth={8}
                  showInfo={false}
                />
                <div className='flex justify-between text-xs text-gray-500'>
                  <span>
                    {t('已服务')}: {details.compute_minutes_served} {t('分钟')}
                  </span>
                  <span>
                    {t('剩余')}: {details.compute_minutes_remaining} {t('分钟')}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Container Configuration */}
          {details.container_config && (
            <Card
              title={
                <div className='flex items-center gap-2'>
                  <FaDocker className='text-blue-600' />
                  <span>{t('容器配置')}</span>
                </div>
              }
              className='border-0 shadow-sm'
            >
              <div className='space-y-3'>
                <Descriptions
                  data={[
                    {
                      key: t('镜像地址'),
                      value: (
                        <Text className='font-mono text-sm break-all'>
                          {details.container_config.image_url || 'N/A'}
                        </Text>
                      ),
                    },
                    {
                      key: t('流量端口'),
                      value: details.container_config.traffic_port || 'N/A',
                    },
                    {
                      key: t('启动命令'),
                      value: (
                        <Text className='font-mono text-sm'>
                          {details.container_config.entrypoint
                            ? details.container_config.entrypoint.join(' ')
                            : 'N/A'}
                        </Text>
                      ),
                    },
                  ]}
                />

                {/* Environment Variables */}
                {details.container_config.env_variables &&
                  Object.keys(details.container_config.env_variables).length >
                    0 && (
                    <div className='mt-4'>
                      <Text strong className='block mb-2'>
                        {t('环境变量')}:
                      </Text>
                      <div className='bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto'>
                        {Object.entries(
                          details.container_config.env_variables,
                        ).map(([key, value]) => (
                          <div
                            key={key}
                            className='flex gap-2 text-sm font-mono mb-1'
                          >
                            <span className='text-blue-600 font-medium'>
                              {key}=
                            </span>
                            <span className='text-gray-700 break-all'>
                              {String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </Card>
          )}

          {/* Containers List */}
          <Card
            title={
              <div className='flex items-center gap-2'>
                <FaServer className='text-indigo-500' />
                <span>{t('容器实例')}</span>
              </div>
            }
            className='border-0 shadow-sm'
          >
            {containersLoading ? (
              <div className='flex items-center justify-center py-6'>
                <Spin tip={t('加载容器信息中...')} />
              </div>
            ) : containers.length === 0 ? (
              <Empty
                description={t('暂无容器信息')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className='space-y-3'>
                {containers.map((ctr) => (
                  <Card
                    key={ctr.container_id}
                    className='bg-gray-50 border border-gray-100'
                    bodyStyle={{ padding: '12px 16px' }}
                  >
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div className='flex flex-col gap-1'>
                        <Text strong className='font-mono text-sm'>
                          {ctr.container_id}
                        </Text>
                        <Text size='small' type='secondary'>
                          {t('设备')} {ctr.device_id || '--'} · {t('状态')}{' '}
                          {ctr.status || '--'}
                        </Text>
                        <Text size='small' type='secondary'>
                          {t('创建时间')}:{' '}
                          {ctr.created_at
                            ? timestamp2string(ctr.created_at)
                            : '--'}
                        </Text>
                      </div>
                      <div className='flex flex-col items-end gap-2'>
                        <Tag color='blue' size='small'>
                          {t('GPU/容器')}: {ctr.gpus_per_container ?? '--'}
                        </Tag>
                        {ctr.public_url && (
                          <Tooltip content={ctr.public_url}>
                            <Button
                              icon={<FaLink />}
                              size='small'
                              theme='light'
                              onClick={() =>
                                window.open(
                                  ctr.public_url,
                                  '_blank',
                                  'noopener,noreferrer',
                                )
                              }
                            >
                              {t('访问容器')}
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {ctr.events && ctr.events.length > 0 && (
                      <div className='mt-3 bg-white rounded-md border border-gray-100 p-3'>
                        <Text
                          size='small'
                          type='secondary'
                          className='block mb-2'
                        >
                          {t('最近事件')}
                        </Text>
                        <div className='space-y-2 max-h-32 overflow-y-auto'>
                          {ctr.events.map((event, index) => (
                            <div
                              key={`${ctr.container_id}-${event.time}-${index}`}
                              className='flex gap-3 text-xs font-mono'
                            >
                              <span className='text-gray-500 min-w-[140px]'>
                                {event.time
                                  ? timestamp2string(event.time)
                                  : '--'}
                              </span>
                              <span className='text-gray-700 break-all flex-1'>
                                {event.message || '--'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Location Information */}
          {details.locations && details.locations.length > 0 && (
            <Card
              title={
                <div className='flex items-center gap-2'>
                  <FaMapMarkerAlt className='text-orange-500' />
                  <span>{t('部署位置')}</span>
                </div>
              }
              className='border-0 shadow-sm'
            >
              <div className='flex flex-wrap gap-2'>
                {details.locations.map((location) => (
                  <Tag key={location.id} color='orange' size='large'>
                    <div className='flex items-center gap-1'>
                      <span>🌍</span>
                      <span>
                        {location.name} ({location.iso2})
                      </span>
                    </div>
                  </Tag>
                ))}
              </div>
            </Card>
          )}

          {/* Cost Information */}
          <Card
            title={
              <div className='flex items-center gap-2'>
                <FaMoneyBillWave className='text-green-500' />
                <span>{t('费用信息')}</span>
              </div>
            }
            className='border-0 shadow-sm'
          >
            <div className='space-y-3'>
              <div className='flex items-center justify-between p-3 bg-green-50 rounded-lg'>
                <Text>{t('已支付金额')}</Text>
                <Text strong className='text-lg text-green-600'>
                  $
                  {details.amount_paid
                    ? details.amount_paid.toFixed(2)
                    : '0.00'}{' '}
                  USDC
                </Text>
              </div>

              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div className='flex justify-between'>
                  <Text type='secondary'>{t('计费开始')}:</Text>
                  <Text>
                    {details.started_at
                      ? timestamp2string(details.started_at)
                      : 'N/A'}
                  </Text>
                </div>
                <div className='flex justify-between'>
                  <Text type='secondary'>{t('预计结束')}:</Text>
                  <Text>
                    {details.finished_at
                      ? timestamp2string(details.finished_at)
                      : 'N/A'}
                  </Text>
                </div>
              </div>
            </div>
          </Card>

          {/* Time Information */}
          <Card
            title={
              <div className='flex items-center gap-2'>
                <FaClock className='text-purple-500' />
                <span>{t('时间信息')}</span>
              </div>
            }
            className='border-0 shadow-sm'
          >
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Text type='secondary'>{t('已运行时间')}:</Text>
                  <Text strong>
                    {Math.floor(details.compute_minutes_served / 60)}h{' '}
                    {details.compute_minutes_served % 60}m
                  </Text>
                </div>
                <div className='flex items-center justify-between'>
                  <Text type='secondary'>{t('剩余时间')}:</Text>
                  <Text strong className='text-orange-600'>
                    {Math.floor(details.compute_minutes_remaining / 60)}h{' '}
                    {details.compute_minutes_remaining % 60}m
                  </Text>
                </div>
              </div>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Text type='secondary'>{t('创建时间')}:</Text>
                  <Text>{timestamp2string(details.created_at)}</Text>
                </div>
                <div className='flex items-center justify-between'>
                  <Text type='secondary'>{t('最后更新')}:</Text>
                  <Text>{timestamp2string(details.updated_at)}</Text>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('无法获取容器详情')}
        />
      )}
    </Modal>
  );
};

export default ViewDetailsModal;
