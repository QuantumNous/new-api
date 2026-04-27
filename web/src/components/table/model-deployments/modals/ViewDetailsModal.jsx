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
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tooltip,
  useOverlayState,
} from '@heroui/react';
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
import { Inbox, RefreshCw } from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../../helpers';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
  orange: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  grey: 'bg-surface-secondary text-muted',
};

function StatusTag({ tone, size = 'sm', children }) {
  const cls = TAG_TONE[tone] || TAG_TONE.grey;
  const sizeCls = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${cls} ${sizeCls}`}
    >
      {children}
    </span>
  );
}

// Lightweight section card — replaces Semi `<Card title=...>` with a flat
// surface that follows the rest of /console (no shadow, just a thin border).
function SectionCard({ title, icon, iconClass = 'text-primary', children }) {
  return (
    <section className='rounded-2xl border border-border bg-background'>
      <header className='flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground'>
        <span className={iconClass}>{icon}</span>
        <span>{title}</span>
      </header>
      <div className='px-4 py-3'>{children}</div>
    </section>
  );
}

// Replaces Semi `<Descriptions data=[{key, value}]>` with a stacked
// label/value list. Wider screens get 2-column layout.
function DescList({ items }) {
  return (
    <dl className='grid grid-cols-1 gap-y-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-x-4'>
      {items.map((item, idx) => (
        <React.Fragment key={`${item.key}-${idx}`}>
          <dt className='text-xs font-medium text-muted sm:pt-1'>
            {item.key}
          </dt>
          <dd className='text-sm text-foreground'>{item.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// Tailwind progress bar — replaces Semi `<Progress>` for the completed
// percent indicator.
function ProgressBar({ percent }) {
  const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
  const tone = clamped >= 100 ? 'bg-success' : 'bg-primary';
  return (
    <div className='h-2 w-full overflow-hidden rounded-full bg-surface-secondary'>
      <div
        className={`h-full rounded-full transition-all ${tone}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function EmptyBlock({ description }) {
  return (
    <div className='flex flex-col items-center gap-3 py-10 text-center'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
        <Inbox size={28} />
      </div>
      <span className='text-sm text-muted'>{description}</span>
    </div>
  );
}

const ViewDetailsModal = ({ visible, onCancel, deployment, t }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState([]);
  const [containersLoading, setContainersLoading] = useState(false);

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

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
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='2xl' scroll='inside' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <FaInfoCircle className='text-primary' />
                <span>{t('容器详情')}</span>
              </div>
            </ModalHeader>
            <ModalBody className='max-h-[70vh] overflow-y-auto px-4 py-4 md:px-6'>
              {loading && !details ? (
                <div className='flex flex-col items-center justify-center gap-3 py-12'>
                  <Spinner color='primary' />
                  <span className='text-sm text-muted'>
                    {t('加载详情中...')}
                  </span>
                </div>
              ) : details ? (
                <div className='space-y-4'>
                  {/* Basic Info */}
                  <SectionCard
                    title={t('基本信息')}
                    icon={<FaServer />}
                    iconClass='text-primary'
                  >
                    <DescList
                      items={[
                        {
                          key: t('容器名称'),
                          value: (
                            <div className='flex items-center gap-2'>
                              <span className='text-base font-semibold text-foreground'>
                                {details.deployment_name || details.id}
                              </span>
                              <Button
                                isIconOnly
                                size='sm'
                                variant='tertiary'
                                onPress={handleCopyId}
                                aria-label={t('复制')}
                                className='opacity-70 hover:opacity-100'
                              >
                                <FaCopy />
                              </Button>
                            </div>
                          ),
                        },
                        {
                          key: t('容器ID'),
                          value: (
                            <span className='font-mono text-sm text-muted'>
                              {details.id}
                            </span>
                          ),
                        },
                        {
                          key: t('状态'),
                          value: (
                            <div className='flex items-center gap-2'>
                              <span>{statusConfig.icon}</span>
                              <StatusTag tone={statusConfig.color}>
                                {t(statusConfig.text)}
                              </StatusTag>
                            </div>
                          ),
                        },
                        {
                          key: t('创建时间'),
                          value: (
                            <span className='tabular-nums'>
                              {timestamp2string(details.created_at)}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </SectionCard>

                  {/* Hardware & Performance */}
                  <SectionCard
                    title={t('硬件与性能')}
                    icon={<FaChartLine />}
                    iconClass='text-success'
                  >
                    <div className='space-y-4'>
                      <DescList
                        items={[
                          {
                            key: t('硬件类型'),
                            value: (
                              <div className='flex items-center gap-2'>
                                <StatusTag tone='blue'>
                                  {details.brand_name}
                                </StatusTag>
                                <span className='font-semibold'>
                                  {details.hardware_name}
                                </span>
                              </div>
                            ),
                          },
                          {
                            key: t('GPU数量'),
                            value: (
                              <div className='flex items-center gap-2'>
                                <span className='inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white'>
                                  {details.total_gpus}
                                </span>
                                <span>
                                  {t('总计')} {details.total_gpus}{' '}
                                  {t('个GPU')}
                                </span>
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
                        <div className='flex items-center justify-between text-sm'>
                          <span className='font-semibold text-foreground'>
                            {t('完成进度')}
                          </span>
                          <span className='tabular-nums text-foreground'>
                            {details.completed_percent}%
                          </span>
                        </div>
                        <ProgressBar percent={details.completed_percent} />
                        <div className='flex justify-between text-xs text-muted'>
                          <span>
                            {t('已服务')}: {details.compute_minutes_served}{' '}
                            {t('分钟')}
                          </span>
                          <span>
                            {t('剩余')}: {details.compute_minutes_remaining}{' '}
                            {t('分钟')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  {/* Container Configuration */}
                  {details.container_config && (
                    <SectionCard
                      title={t('容器配置')}
                      icon={<FaDocker />}
                      iconClass='text-primary'
                    >
                      <div className='space-y-3'>
                        <DescList
                          items={[
                            {
                              key: t('镜像地址'),
                              value: (
                                <span className='break-all font-mono text-sm'>
                                  {details.container_config.image_url || 'N/A'}
                                </span>
                              ),
                            },
                            {
                              key: t('流量端口'),
                              value: details.container_config.traffic_port || 'N/A',
                            },
                            {
                              key: t('启动命令'),
                              value: (
                                <span className='font-mono text-sm'>
                                  {details.container_config.entrypoint
                                    ? details.container_config.entrypoint.join(' ')
                                    : 'N/A'}
                                </span>
                              ),
                            },
                          ]}
                        />

                        {/* Environment Variables */}
                        {details.container_config.env_variables &&
                          Object.keys(details.container_config.env_variables)
                            .length > 0 && (
                            <div className='mt-4'>
                              <div className='mb-2 text-sm font-semibold text-foreground'>
                                {t('环境变量')}:
                              </div>
                              <div className='max-h-32 overflow-y-auto rounded-lg bg-surface-secondary p-3'>
                                {Object.entries(
                                  details.container_config.env_variables,
                                ).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className='mb-1 flex gap-2 font-mono text-sm'
                                  >
                                    <span className='font-medium text-primary'>
                                      {key}=
                                    </span>
                                    <span className='break-all text-foreground'>
                                      {String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </SectionCard>
                  )}

                  {/* Containers List */}
                  <SectionCard
                    title={t('容器实例')}
                    icon={<FaServer />}
                    iconClass='text-accent'
                  >
                    {containersLoading ? (
                      <div className='flex flex-col items-center justify-center gap-3 py-6'>
                        <Spinner color='primary' />
                        <span className='text-sm text-muted'>
                          {t('加载容器信息中...')}
                        </span>
                      </div>
                    ) : containers.length === 0 ? (
                      <EmptyBlock description={t('暂无容器信息')} />
                    ) : (
                      <div className='space-y-3'>
                        {containers.map((ctr) => (
                          <div
                            key={ctr.container_id}
                            className='rounded-xl border border-border bg-surface-secondary px-4 py-3'
                          >
                            <div className='flex flex-wrap items-center justify-between gap-3'>
                              <div className='flex flex-col gap-1'>
                                <span className='font-mono text-sm font-semibold'>
                                  {ctr.container_id}
                                </span>
                                <span className='text-xs text-muted'>
                                  {t('设备')} {ctr.device_id || '--'} ·{' '}
                                  {t('状态')} {ctr.status || '--'}
                                </span>
                                <span className='text-xs text-muted'>
                                  {t('创建时间')}:{' '}
                                  {ctr.created_at
                                    ? timestamp2string(ctr.created_at)
                                    : '--'}
                                </span>
                              </div>
                              <div className='flex flex-col items-end gap-2'>
                                <StatusTag tone='blue'>
                                  {t('GPU/容器')}:{' '}
                                  {ctr.gpus_per_container ?? '--'}
                                </StatusTag>
                                {ctr.public_url && (
                                  <Tooltip content={ctr.public_url}>
                                    <Button
                                      size='sm'
                                      variant='tertiary'
                                      startContent={<FaLink />}
                                      onPress={() =>
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
                              <div className='mt-3 rounded-md border border-border bg-background p-3'>
                                <div className='mb-2 text-xs text-muted'>
                                  {t('最近事件')}
                                </div>
                                <div className='max-h-32 space-y-2 overflow-y-auto'>
                                  {ctr.events.map((event, index) => (
                                    <div
                                      key={`${ctr.container_id}-${event.time}-${index}`}
                                      className='flex gap-3 font-mono text-xs'
                                    >
                                      <span className='min-w-[140px] text-muted'>
                                        {event.time
                                          ? timestamp2string(event.time)
                                          : '--'}
                                      </span>
                                      <span className='flex-1 break-all text-foreground'>
                                        {event.message || '--'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Location Information */}
                  {details.locations && details.locations.length > 0 && (
                    <SectionCard
                      title={t('部署位置')}
                      icon={<FaMapMarkerAlt />}
                      iconClass='text-warning'
                    >
                      <div className='flex flex-wrap gap-2'>
                        {details.locations.map((location) => (
                          <StatusTag
                            key={location.id}
                            tone='orange'
                            size='lg'
                          >
                            <span className='mr-1'>🌍</span>
                            <span>
                              {location.name} ({location.iso2})
                            </span>
                          </StatusTag>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Cost Information */}
                  <SectionCard
                    title={t('费用信息')}
                    icon={<FaMoneyBillWave />}
                    iconClass='text-success'
                  >
                    <div className='space-y-3'>
                      <div className='flex items-center justify-between rounded-lg bg-success/10 p-3'>
                        <span>{t('已支付金额')}</span>
                        <span className='text-lg font-semibold text-success tabular-nums'>
                          $
                          {details.amount_paid
                            ? details.amount_paid.toFixed(2)
                            : '0.00'}{' '}
                          USDC
                        </span>
                      </div>

                      <div className='grid grid-cols-1 gap-4 text-sm sm:grid-cols-2'>
                        <div className='flex justify-between'>
                          <span className='text-muted'>
                            {t('计费开始')}:
                          </span>
                          <span className='tabular-nums'>
                            {details.started_at
                              ? timestamp2string(details.started_at)
                              : 'N/A'}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted'>
                            {t('预计结束')}:
                          </span>
                          <span className='tabular-nums'>
                            {details.finished_at
                              ? timestamp2string(details.finished_at)
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  {/* Time Information */}
                  <SectionCard
                    title={t('时间信息')}
                    icon={<FaClock />}
                    iconClass='text-accent'
                  >
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>{t('已运行时间')}:</span>
                          <span className='font-semibold tabular-nums'>
                            {Math.floor(details.compute_minutes_served / 60)}h{' '}
                            {details.compute_minutes_served % 60}m
                          </span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>{t('剩余时间')}:</span>
                          <span className='font-semibold text-warning tabular-nums'>
                            {Math.floor(details.compute_minutes_remaining / 60)}
                            h {details.compute_minutes_remaining % 60}m
                          </span>
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>{t('创建时间')}:</span>
                          <span className='tabular-nums'>
                            {timestamp2string(details.created_at)}
                          </span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>{t('最后更新')}:</span>
                          <span className='tabular-nums'>
                            {timestamp2string(details.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              ) : (
                <EmptyBlock description={t('无法获取容器详情')} />
              )}
            </ModalBody>
            <ModalFooter className='flex justify-between border-t border-border'>
              <Button
                variant='tertiary'
                startContent={<RefreshCw size={14} />}
                onPress={handleRefresh}
                isPending={loading || containersLoading}
              >
                {t('刷新')}
              </Button>
              <Button onPress={onCancel}>{t('关闭')}</Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ViewDetailsModal;
