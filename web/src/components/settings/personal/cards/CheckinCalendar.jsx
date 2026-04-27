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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Tooltip,
  Spinner,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import {
  CalendarCheck,
  Gift,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import Turnstile from 'react-turnstile';
import { API, showError, showSuccess, renderQuota } from '../../../../helpers';
import { successButtonClass } from '../../../common/ui/buttonTones';

const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(yearMonth) {
  const [year, month] = yearMonth.split('-').map((v) => parseInt(v, 10));
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const startDate = new Date(year, month - 1, 1 - startWeekday);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i,
    );
    cells.push(date);
  }
  return cells;
}

function MonthCalendar({ yearMonth, onMonthChange, dateRender, t }) {
  const [year, month] = yearMonth.split('-').map((v) => parseInt(v, 10));
  const todayKey = formatDate(new Date());
  const cells = useMemo(() => buildMonthGrid(yearMonth), [yearMonth]);

  const goPrev = () => {
    const prev = new Date(year, month - 2, 1);
    onMonthChange?.(prev);
  };
  const goNext = () => {
    const next = new Date(year, month, 1);
    onMonthChange?.(next);
  };
  const goToday = () => onMonthChange?.(new Date());

  const monthLabel = `${year} / ${String(month).padStart(2, '0')}`;
  const weekdays = WEEKDAY_KEYS.map((key) => t(key));

  return (
    <div className='overflow-hidden rounded-lg border border-[color:var(--app-border)] text-sm'>
      <div className='flex items-center justify-between border-b border-[color:var(--app-border)] bg-[color:var(--app-background)] px-3 py-2'>
        <div className='flex items-center gap-1'>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            onPress={goPrev}
            aria-label='prev'
          >
            <ChevronLeft size={14} />
          </Button>
          <Button variant='tertiary' size='sm' onPress={goToday}>
            {t('今天')}
          </Button>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            onPress={goNext}
            aria-label='next'
          >
            <ChevronRight size={14} />
          </Button>
        </div>
        <div className='text-sm font-semibold text-foreground'>
          {monthLabel}
        </div>
        <div className='w-[120px]' />
      </div>

      <table className='w-full table-fixed'>
        <thead>
          <tr className='border-b border-[color:var(--app-border)]'>
            {weekdays.map((wd) => (
              <th
                key={wd}
                className='py-1 text-center text-xs font-semibold text-muted'
              >
                {wd}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, weekIndex) => (
            <tr key={weekIndex}>
              {Array.from({ length: 7 }).map((__, dayIndex) => {
                const cellDate = cells[weekIndex * 7 + dayIndex];
                const cellKey = formatDate(cellDate);
                const isCurrentMonth = cellDate.getMonth() === month - 1;
                const isToday = cellKey === todayKey;
                const renderResult = dateRender?.(cellKey, cellDate);
                return (
                  <td
                    key={cellKey}
                    className={`relative h-14 align-top ${
                      isCurrentMonth ? '' : 'opacity-40'
                    }`}
                  >
                    <div
                      className={`absolute left-1/2 top-1 z-[1] flex h-5 w-5 -translate-x-1/2 items-center justify-center text-xs ${
                        isToday
                          ? 'rounded-full bg-primary font-semibold text-white'
                          : 'text-foreground'
                      }`}
                    >
                      {cellDate.getDate()}
                    </div>
                    {renderResult}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CheckinCalendar = ({ t, status, turnstileEnabled, turnstileSiteKey }) => {
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false);
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0);
  const [checkinData, setCheckinData] = useState({
    enabled: false,
    stats: {
      checked_in_today: false,
      total_checkins: 0,
      total_quota: 0,
      checkin_count: 0,
      records: [],
    },
  });
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(null);

  const checkinRecordsMap = useMemo(() => {
    const map = {};
    const records = checkinData.stats?.records || [];
    records.forEach((record) => {
      map[record.checkin_date] = record.quota_awarded;
    });
    return map;
  }, [checkinData.stats?.records]);

  const monthlyQuota = useMemo(() => {
    const records = checkinData.stats?.records || [];
    return records.reduce(
      (sum, record) => sum + (record.quota_awarded || 0),
      0,
    );
  }, [checkinData.stats?.records]);

  const fetchCheckinStatus = async (month) => {
    const isFirstLoad = !initialLoaded;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/checkin?month=${month}`);
      const { success, data, message } = res.data;
      if (success) {
        setCheckinData(data);
        if (isFirstLoad) {
          setIsCollapsed(data.stats?.checked_in_today ?? false);
          setInitialLoaded(true);
        }
      } else {
        showError(message || t('获取签到状态失败'));
        if (isFirstLoad) {
          setIsCollapsed(false);
          setInitialLoaded(true);
        }
      }
    } catch (error) {
      showError(t('获取签到状态失败'));
      if (isFirstLoad) {
        setIsCollapsed(false);
        setInitialLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const postCheckin = async (token) => {
    const url = token
      ? `/api/user/checkin?turnstile=${encodeURIComponent(token)}`
      : '/api/user/checkin';
    return API.post(url);
  };

  const shouldTriggerTurnstile = (message) => {
    if (!turnstileEnabled) return false;
    if (typeof message !== 'string') return true;
    return message.includes('Turnstile');
  };

  const doCheckin = async (token) => {
    setCheckinLoading(true);
    try {
      const res = await postCheckin(token);
      const { success, data, message } = res.data;
      if (success) {
        showSuccess(
          t('签到成功！获得') + ' ' + renderQuota(data.quota_awarded),
        );
        fetchCheckinStatus(currentMonth);
        setTurnstileModalVisible(false);
      } else {
        if (!token && shouldTriggerTurnstile(message)) {
          if (!turnstileSiteKey) {
            showError('Turnstile is enabled but site key is empty.');
            return;
          }
          setTurnstileModalVisible(true);
          return;
        }
        if (token && shouldTriggerTurnstile(message)) {
          setTurnstileWidgetKey((v) => v + 1);
        }
        showError(message || t('签到失败'));
      }
    } catch (error) {
      showError(t('签到失败'));
    } finally {
      setCheckinLoading(false);
    }
  };

  useEffect(() => {
    if (status?.checkin_enabled) {
      fetchCheckinStatus(currentMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.checkin_enabled, currentMonth]);

  const turnstileModalState = useOverlayState({
    isOpen: turnstileModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        setTurnstileModalVisible(false);
        setTurnstileWidgetKey((v) => v + 1);
      }
    },
  });

  if (!status?.checkin_enabled) {
    return null;
  }

  const dateRender = (cellKey) => {
    const quotaAwarded = checkinRecordsMap[cellKey];
    const isCheckedIn = quotaAwarded !== undefined;
    if (!isCheckedIn) return null;
    return (
      <Tooltip
        content={`${t('获得')} ${renderQuota(quotaAwarded)}`}
        placement='top'
      >
        <div className='absolute inset-0 flex cursor-pointer flex-col items-center justify-center pt-5'>
          <div className='mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-sm'>
            <Check size={14} className='text-white' strokeWidth={3} />
          </div>
          <div className='text-[10px] font-medium leading-none text-emerald-600 dark:text-emerald-400'>
            {renderQuota(quotaAwarded)}
          </div>
        </div>
      </Tooltip>
    );
  };

  const handleMonthChange = (date) => {
    const month = date.toISOString().slice(0, 7);
    setCurrentMonth(month);
  };

  return (
    <Card className='!rounded-2xl border border-[color:var(--app-border)]'>
      <Card.Content className='space-y-0 p-5'>
        <Modal state={turnstileModalState}>
          <ModalBackdrop variant='blur'>
            <ModalContainer size='sm' placement='center'>
              <ModalDialog className='bg-background/95 backdrop-blur'>
                <ModalHeader className='border-b border-border'>
                  Security Check
                </ModalHeader>
                <ModalBody className='flex justify-center px-6 py-5'>
                  <Turnstile
                    key={turnstileWidgetKey}
                    sitekey={turnstileSiteKey}
                    onVerify={(token) => doCheckin(token)}
                    onExpire={() => setTurnstileWidgetKey((v) => v + 1)}
                  />
                </ModalBody>
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>

        <div className='flex items-center justify-between'>
          <div
            className='flex flex-1 cursor-pointer items-center'
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <span className='mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-md dark:bg-emerald-950/40 dark:text-emerald-300'>
              <CalendarCheck size={16} />
            </span>
            <div className='flex-1'>
              <div className='flex items-center gap-2 text-base font-medium text-foreground'>
                <span>{t('每日签到')}</span>
                {isCollapsed ? (
                  <ChevronDown size={16} className='text-muted' />
                ) : (
                  <ChevronUp size={16} className='text-muted' />
                )}
              </div>
              <div className='text-xs text-muted'>
                {!initialLoaded
                  ? t('正在加载签到状态...')
                  : checkinData.stats?.checked_in_today
                    ? t('今日已签到，累计签到') +
                      ` ${checkinData.stats?.total_checkins || 0} ` +
                      t('天')
                    : t('每日签到可获得随机额度奖励')}
              </div>
            </div>
          </div>
          <Button
            variant='primary'
            className={successButtonClass}
            onPress={() => doCheckin()}
            isPending={checkinLoading || !initialLoaded}
            isDisabled={!initialLoaded || checkinData.stats?.checked_in_today}
          >
            <Gift size={14} />
            {!initialLoaded
              ? t('加载中...')
              : checkinData.stats?.checked_in_today
                ? t('今日已签到')
                : t('立即签到')}
          </Button>
        </div>

        {isCollapsed === false ? (
          <div className='mt-4 space-y-4'>
            <div className='grid grid-cols-3 gap-3'>
              <div className='rounded-lg bg-surface-secondary p-2.5 text-center'>
                <div className='text-xl font-bold text-emerald-600'>
                  {checkinData.stats?.total_checkins || 0}
                </div>
                <div className='text-xs text-muted'>{t('累计签到')}</div>
              </div>
              <div className='rounded-lg bg-surface-secondary p-2.5 text-center'>
                <div className='text-xl font-bold text-orange-600'>
                  {renderQuota(monthlyQuota, 6)}
                </div>
                <div className='text-xs text-muted'>{t('本月获得')}</div>
              </div>
              <div className='rounded-lg bg-surface-secondary p-2.5 text-center'>
                <div className='text-xl font-bold text-sky-600'>
                  {renderQuota(checkinData.stats?.total_quota || 0, 6)}
                </div>
                <div className='text-xs text-muted'>{t('累计获得')}</div>
              </div>
            </div>

            <div className='relative'>
              {loading ? (
                <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60'>
                  <Spinner size='sm' />
                </div>
              ) : null}
              <MonthCalendar
                yearMonth={currentMonth}
                onMonthChange={handleMonthChange}
                dateRender={dateRender}
                t={t}
              />
            </div>

            <div className='rounded-lg bg-surface-secondary p-2.5'>
              <ul className='list-inside list-disc space-y-0.5 text-xs text-muted'>
                <li>{t('每日签到可获得随机额度奖励')}</li>
                <li>{t('签到奖励将直接添加到您的账户余额')}</li>
                <li>{t('每日仅可签到一次，请勿重复签到')}</li>
              </ul>
            </div>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
};

export default CheckinCalendar;
