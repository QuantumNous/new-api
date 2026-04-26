/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
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
  useOverlayState,
} from '@heroui/react';
import {
  FaClock,
  FaCalculator,
  FaInfoCircle,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { API, showError, showSuccess } from '../../../../helpers';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
  orange: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  grey: 'bg-surface-secondary text-muted',
};

function StatusChip({ tone = 'grey', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        TAG_TONE[tone] || TAG_TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

const MIN_HOURS = 1;
const MAX_HOURS = 720;

const ExtendDurationModal = ({
  visible,
  onCancel,
  deployment,
  onSuccess,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [durationHours, setDurationHours] = useState(1);
  const [durationError, setDurationError] = useState('');
  const [costLoading, setCostLoading] = useState(false);
  const [priceEstimation, setPriceEstimation] = useState(null);
  const [priceError, setPriceError] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deploymentDetails, setDeploymentDetails] = useState(null);
  const costRequestIdRef = useRef(0);

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const resetState = () => {
    costRequestIdRef.current += 1;
    setDurationHours(1);
    setDurationError('');
    setPriceEstimation(null);
    setPriceError(null);
    setDeploymentDetails(null);
    setCostLoading(false);
  };

  const validateDuration = (value) => {
    if (value === '' || value === null || value === undefined) {
      return t('请输入延长时长');
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return t('请输入延长时长');
    }
    if (numeric < MIN_HOURS) {
      return t('延长时长至少为1小时');
    }
    if (numeric > MAX_HOURS) {
      return t('延长时长不能超过720小时（30天）');
    }
    return '';
  };

  const handleDurationChange = (raw) => {
    const value = raw === '' ? '' : Number(raw);
    setDurationHours(value);
    setDurationError(validateDuration(value));
  };

  const fetchDeploymentDetails = async (deploymentId) => {
    setDetailsLoading(true);
    try {
      const response = await API.get(`/api/deployments/${deploymentId}`);
      if (response.data.success) {
        const details = response.data.data;
        setDeploymentDetails(details);
        setPriceError(null);
        return details;
      }

      const message = response.data.message || '';
      const errorMessage = t('获取详情失败') + (message ? `: ${message}` : '');
      showError(errorMessage);
      setDeploymentDetails(null);
      setPriceEstimation(null);
      setPriceError(errorMessage);
      return null;
    } catch (error) {
      const message = error?.response?.data?.message || error.message || '';
      const errorMessage = t('获取详情失败') + (message ? `: ${message}` : '');
      showError(errorMessage);
      setDeploymentDetails(null);
      setPriceEstimation(null);
      setPriceError(errorMessage);
      return null;
    } finally {
      setDetailsLoading(false);
    }
  };

  const calculatePrice = async (hours, details) => {
    if (!visible || !details) {
      return;
    }

    const sanitizedHours = Number.isFinite(hours) ? Math.round(hours) : 0;
    if (sanitizedHours <= 0) {
      setPriceEstimation(null);
      setPriceError(null);
      return;
    }

    const hardwareId = Number(details?.hardware_id) || 0;
    const totalGPUs = Number(details?.total_gpus) || 0;
    const totalContainers = Number(details?.total_containers) || 0;
    const baseGpusPerContainer = Number(details?.gpus_per_container) || 0;
    const resolvedGpusPerContainer =
      baseGpusPerContainer > 0
        ? baseGpusPerContainer
        : totalContainers > 0 && totalGPUs > 0
          ? Math.max(1, Math.round(totalGPUs / totalContainers))
          : 0;
    const resolvedReplicaCount =
      totalContainers > 0
        ? totalContainers
        : resolvedGpusPerContainer > 0 && totalGPUs > 0
          ? Math.max(1, Math.round(totalGPUs / resolvedGpusPerContainer))
          : 0;
    const locationIds = Array.isArray(details?.locations)
      ? details.locations
          .map((location) =>
            Number(
              location?.id ?? location?.location_id ?? location?.locationId,
            ),
          )
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (
      hardwareId <= 0 ||
      resolvedGpusPerContainer <= 0 ||
      resolvedReplicaCount <= 0 ||
      locationIds.length === 0
    ) {
      setPriceEstimation(null);
      setPriceError(t('价格计算失败'));
      return;
    }

    const requestId = Date.now();
    costRequestIdRef.current = requestId;
    setCostLoading(true);
    setPriceError(null);

    const payload = {
      location_ids: locationIds,
      hardware_id: hardwareId,
      gpus_per_container: resolvedGpusPerContainer,
      duration_hours: sanitizedHours,
      replica_count: resolvedReplicaCount,
      currency: 'usdc',
      duration_type: 'hour',
      duration_qty: sanitizedHours,
      hardware_qty: resolvedGpusPerContainer,
    };

    try {
      const response = await API.post(
        '/api/deployments/price-estimation',
        payload,
      );

      if (costRequestIdRef.current !== requestId) {
        return;
      }

      if (response.data.success) {
        setPriceEstimation(response.data.data);
      } else {
        const message = response.data.message || '';
        setPriceEstimation(null);
        setPriceError(t('价格计算失败') + (message ? `: ${message}` : ''));
      }
    } catch (error) {
      if (costRequestIdRef.current !== requestId) {
        return;
      }

      const message = error?.response?.data?.message || error.message || '';
      setPriceEstimation(null);
      setPriceError(t('价格计算失败') + (message ? `: ${message}` : ''));
    } finally {
      if (costRequestIdRef.current === requestId) {
        setCostLoading(false);
      }
    }
  };

  useEffect(() => {
    if (visible && deployment?.id) {
      resetState();
      fetchDeploymentDetails(deployment.id);
    }
    if (!visible) {
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, deployment?.id]);

  useEffect(() => {
    if (!visible || !deploymentDetails) return;
    calculatePrice(durationHours, deploymentDetails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationHours, deploymentDetails, visible]);

  const handleExtend = async () => {
    const error = validateDuration(durationHours);
    if (error) {
      setDurationError(error);
      return;
    }

    try {
      setLoading(true);

      const response = await API.post(
        `/api/deployments/${deployment.id}/extend`,
        {
          duration_hours: Math.round(Number(durationHours)),
        },
      );

      if (response.data.success) {
        showSuccess(t('容器时长延长成功'));
        onSuccess?.(response.data.data);
        handleCancel();
      }
    } catch (error) {
      showError(
        t('延长时长失败') +
          ': ' +
          (error?.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  const currentRemainingTime = deployment?.time_remaining || '0分钟';
  const newTotalTime = `${currentRemainingTime} + ${durationHours}${t('小时')}`;

  const priceData = priceEstimation || {};
  const breakdown = priceData.price_breakdown || priceData.PriceBreakdown || {};
  const currencyLabel = (priceData.currency || priceData.Currency || 'USDC')
    .toString()
    .toUpperCase();

  const estimatedTotalCost =
    typeof priceData.estimated_cost === 'number'
      ? priceData.estimated_cost
      : typeof priceData.EstimatedCost === 'number'
        ? priceData.EstimatedCost
        : typeof breakdown.total_cost === 'number'
          ? breakdown.total_cost
          : breakdown.TotalCost;
  const hourlyRate =
    typeof breakdown.hourly_rate === 'number'
      ? breakdown.hourly_rate
      : breakdown.HourlyRate;
  const computeCost =
    typeof breakdown.compute_cost === 'number'
      ? breakdown.compute_cost
      : breakdown.ComputeCost;

  const resolvedHardwareName =
    deploymentDetails?.hardware_name || deployment?.hardware_name || '--';
  const gpuCount =
    deploymentDetails?.total_gpus || deployment?.hardware_quantity || 0;
  const containers = deploymentDetails?.total_containers || 0;

  const confirmDisabled =
    !deployment?.id ||
    detailsLoading ||
    !durationHours ||
    Number(durationHours) < MIN_HOURS ||
    Number(durationHours) > MAX_HOURS ||
    Boolean(durationError);

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='lg' scroll='inside' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <FaClock className='text-primary' />
                <span>{t('延长容器时长')}</span>
              </div>
            </ModalHeader>
            <ModalBody className='max-h-[70vh] overflow-y-auto px-4 py-4 md:px-6'>
              <div className='space-y-4'>
                {/* Container summary */}
                <section className='rounded-2xl border border-border bg-surface-secondary px-4 py-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <div className='text-base font-semibold text-foreground'>
                        {deployment?.container_name ||
                          deployment?.deployment_name}
                      </div>
                      <div className='mt-1 text-xs text-muted'>
                        ID: {deployment?.id}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='mb-1'>
                        <StatusChip tone='blue'>
                          {resolvedHardwareName}
                          {gpuCount ? ` x${gpuCount}` : ''}
                        </StatusChip>
                      </div>
                      <div className='text-xs text-muted'>
                        {t('当前剩余')}:{' '}
                        <span className='font-semibold text-foreground'>
                          {currentRemainingTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Warning banner */}
                <section className='rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3'>
                  <div className='flex items-start gap-3'>
                    <FaExclamationTriangle className='mt-0.5 shrink-0 text-warning' />
                    <div className='space-y-2 text-sm'>
                      <div className='font-semibold text-foreground'>
                        {t('重要提醒')}
                      </div>
                      <p className='text-muted'>
                        {t(
                          '延长容器时长将会产生额外费用，请确认您有足够的账户余额。',
                        )}
                      </p>
                      <p className='text-muted'>
                        {t('延长操作一旦确认无法撤销，费用将立即扣除。')}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Duration input */}
                <div className='space-y-1.5'>
                  <label className='text-sm font-medium text-foreground'>
                    {t('延长时长（小时）')}
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      min={MIN_HOURS}
                      max={MAX_HOURS}
                      step={1}
                      value={durationHours}
                      onChange={(event) =>
                        handleDurationChange(event.target.value)
                      }
                      placeholder={t('请输入要延长的小时数')}
                      aria-label={t('延长时长（小时）')}
                      className={`h-10 w-full rounded-xl border bg-background pl-3 pr-14 text-sm text-foreground outline-none transition focus:border-primary ${
                        durationError ? 'border-danger' : 'border-border'
                      }`}
                    />
                    <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted'>
                      {t('小时')}
                    </span>
                  </div>
                  {durationError ? (
                    <div className='text-xs text-danger'>{durationError}</div>
                  ) : null}
                </div>

                {/* Quick select chips */}
                <div className='space-y-2'>
                  <div className='text-xs text-muted'>{t('快速选择')}:</div>
                  <div className='flex flex-wrap gap-2'>
                    {[1, 2, 6, 12, 24, 48, 72, 168].map((hours) => {
                      const active = Number(durationHours) === hours;
                      return (
                        <Button
                          key={hours}
                          size='sm'
                          variant={active ? 'solid' : 'flat'}
                          color={active ? 'primary' : undefined}
                          onPress={() => handleDurationChange(hours)}
                        >
                          {hours < 24
                            ? `${hours}${t('小时')}`
                            : `${hours / 24}${t('天')}`}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className='h-px bg-border' />

                {/* Cost estimate card */}
                <section className='rounded-2xl border border-success/30 bg-background'>
                  <header className='flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground'>
                    <FaCalculator className='text-success' />
                    <span>{t('费用预估')}</span>
                  </header>
                  <div className='px-4 py-4'>
                    {priceEstimation ? (
                      <div className='space-y-3 text-sm'>
                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>{t('延长时长')}:</span>
                          <span className='font-semibold tabular-nums'>
                            {Math.round(Number(durationHours))} {t('小时')}
                          </span>
                        </div>

                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>{t('硬件配置')}:</span>
                          <span className='font-semibold'>
                            {resolvedHardwareName}
                            {gpuCount ? ` x${gpuCount}` : ''}
                          </span>
                        </div>

                        {containers ? (
                          <div className='flex items-center justify-between'>
                            <span className='text-muted'>{t('容器数量')}:</span>
                            <span className='font-semibold tabular-nums'>
                              {containers}
                            </span>
                          </div>
                        ) : null}

                        <div className='flex items-center justify-between'>
                          <span className='text-muted'>
                            {t('单GPU小时费率')}:
                          </span>
                          <span className='font-semibold tabular-nums'>
                            {typeof hourlyRate === 'number'
                              ? `${hourlyRate.toFixed(4)} ${currencyLabel}`
                              : '--'}
                          </span>
                        </div>

                        {typeof computeCost === 'number' && (
                          <div className='flex items-center justify-between'>
                            <span className='text-muted'>
                              {t('计算成本')}:
                            </span>
                            <span className='font-semibold tabular-nums'>
                              {computeCost.toFixed(4)} {currencyLabel}
                            </span>
                          </div>
                        )}

                        <div className='h-px bg-border' />

                        <div className='flex items-center justify-between'>
                          <span className='text-base font-semibold text-foreground'>
                            {t('预估总费用')}:
                          </span>
                          <span className='text-lg font-semibold text-success tabular-nums'>
                            {typeof estimatedTotalCost === 'number'
                              ? `${estimatedTotalCost.toFixed(4)} ${currencyLabel}`
                              : '--'}
                          </span>
                        </div>

                        <div className='rounded-lg bg-primary/5 p-3'>
                          <div className='flex items-start gap-2'>
                            <FaInfoCircle className='mt-0.5 text-primary' />
                            <div className='text-xs leading-5 text-muted'>
                              <div>
                                {t('延长后总时长')}:{' '}
                                <span className='font-semibold text-foreground'>
                                  {newTotalTime}
                                </span>
                              </div>
                              <div>
                                {t('预估费用仅供参考，实际费用可能略有差异')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className='flex flex-col items-center justify-center gap-2 py-4 text-sm'>
                        {costLoading ? (
                          <>
                            <Spinner color='primary' size='sm' />
                            <span className='text-muted'>
                              {t('计算费用中...')}
                            </span>
                          </>
                        ) : priceError ? (
                          <span className='text-danger'>{priceError}</span>
                        ) : deploymentDetails ? (
                          <span className='text-muted'>
                            {t('请输入延长时长')}
                          </span>
                        ) : (
                          <span className='text-muted'>
                            {t('加载详情中...')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Final confirm reminder */}
                <section className='rounded-lg border border-danger/30 bg-danger/5 p-3'>
                  <div className='flex items-start gap-2'>
                    <FaExclamationTriangle className='mt-0.5 shrink-0 text-danger' />
                    <div>
                      <div className='font-semibold text-danger'>
                        {t('确认延长容器时长')}
                      </div>
                      <div className='mt-1 text-xs text-danger/80'>
                        {t(
                          '点击"确认延长"后将立即扣除费用并延长容器运行时间',
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='light' onPress={handleCancel}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                isPending={loading}
                isDisabled={confirmDisabled}
                onPress={handleExtend}
              >
                {t('确认延长')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ExtendDurationModal;
