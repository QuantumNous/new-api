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

import React, { useEffect, useState } from 'react';
import { Button, Spinner, Switch } from '@heroui/react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import ConfirmDialog from '../../../components/common/ui/ConfirmDialog';

const DEFAULT_INPUTS = {
  LogConsumeEnabled: false,
  historyTimestamp: dayjs().subtract(1, 'month').toDate(),
};

// Convert a Date or ISO string to the value format datetime-local expects
// (YYYY-MM-DDTHH:mm). datetime-local does not accept seconds or timezones.
const toLocalInputValue = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTime() - d.getTimezoneOffset() * 60000;
  return new Date(offset).toISOString().slice(0, 16);
};

const fromLocalInputValue = (value) => (value ? new Date(value) : null);

export default function SettingsLog(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingCleanHistoryLog, setLoadingCleanHistoryLog] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  const onSubmit = async () => {
    const updateArray = compareObjects(inputs, inputsRow).filter(
      (item) => item.key !== 'historyTimestamp',
    );
    if (!updateArray.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }
    setLoading(true);
    try {
      const requests = updateArray.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value:
            typeof inputs[item.key] === 'boolean'
              ? String(inputs[item.key])
              : String(inputs[item.key] ?? ''),
        }),
      );
      const results = await Promise.all(requests);
      if (results.some((r) => r === undefined)) {
        if (requests.length > 1) {
          showError(t('部分保存失败，请重试'));
          return;
        }
        return;
      }
      showSuccess(t('保存成功'));
      setInputsRow(structuredClone(inputs));
      props.refresh?.();
    } catch (e) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  const promptCleanHistory = () => {
    if (!inputs.historyTimestamp) {
      showError(t('请选择日志记录时间'));
      return;
    }
    setConfirmOpen(true);
  };

  const onConfirmCleanHistory = async () => {
    setConfirmOpen(false);
    try {
      setLoadingCleanHistoryLog(true);
      const target = inputs.historyTimestamp;
      const ts = (target instanceof Date ? target.getTime() : Date.parse(target)) / 1000;
      const res = await API.delete(`/api/log/?target_timestamp=${ts}`);
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(`${data} ${t('条日志已清理！')}`);
      } else {
        throw new Error(t('日志清理失败：') + message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoadingCleanHistoryLog(false);
    }
  };

  useEffect(() => {
    if (!props.options) return;
    const next = { ...DEFAULT_INPUTS };
    if ('LogConsumeEnabled' in props.options) {
      const raw = props.options.LogConsumeEnabled;
      next.LogConsumeEnabled = raw === true || raw === 'true';
    }
    setInputs((prev) => ({ ...prev, ...next, historyTimestamp: prev.historyTimestamp }));
    setInputsRow(structuredClone(next));
  }, [props.options]);

  const target = inputs.historyTimestamp;
  const targetDate = target ? dayjs(target) : null;
  const now = dayjs();
  const targetTime = targetDate ? targetDate.format('YYYY-MM-DD HH:mm:ss') : '';
  const currentTime = now.format('YYYY-MM-DD HH:mm:ss');
  const daysDiff = targetDate ? now.diff(targetDate, 'day') : 0;

  return (
    <>
      <div className='p-6 space-y-6'>
        <div>
          <div className='text-base font-semibold text-foreground'>
            {t('日志设置')}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-medium text-foreground'>
                {t('启用额度消费日志记录')}
              </div>
              <div className='mt-1 text-xs leading-snug text-muted'>
                {t('开启后会记录每次额度变动的明细，方便审计与对账')}
              </div>
            </div>
            <Switch
              isSelected={!!inputs.LogConsumeEnabled}
              onChange={setField('LogConsumeEnabled')}
              aria-label={t('启用额度消费日志记录')}
              size='sm'
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </label>

          <div className='space-y-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
            <div>
              <div className='text-sm font-medium text-foreground'>
                {t('清除历史日志')}
              </div>
              <div className='mt-1 text-xs leading-snug text-muted'>
                {t('将清除选定时间之前的所有日志')}
              </div>
            </div>
            <input
              type='datetime-local'
              value={toLocalInputValue(inputs.historyTimestamp)}
              onChange={(e) =>
                setField('historyTimestamp')(fromLocalInputValue(e.target.value))
              }
              aria-label={t('清除历史日志时间')}
              className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
            />
            <Button
              variant='danger-soft'
              size='sm'
              onPress={promptCleanHistory}
              isPending={loadingCleanHistoryLog}
            >
              {loadingCleanHistoryLog ? (
                <span className='inline-flex items-center gap-2'>
                  <Spinner size='sm' />
                  {t('清除中…')}
                </span>
              ) : (
                t('清除历史日志')
              )}
            </Button>
          </div>
        </div>

        <div className='border-t border-[color:var(--app-border)] pt-4'>
          <Button
            color='primary'
            size='md'
            onPress={onSubmit}
            isPending={loading}
            className='min-w-[100px]'
          >
            {t('保存日志设置')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        visible={confirmOpen}
        title={t('确认清除历史日志')}
        cancelText={t('取消')}
        confirmText={t('确认删除')}
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onConfirmCleanHistory}
      >
        <div className='space-y-3 text-sm'>
          <div className='flex justify-between'>
            <span className='text-muted'>{t('当前时间')}：</span>
            <span className='font-medium text-emerald-600'>{currentTime}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted'>{t('选择时间')}：</span>
            <span className='font-medium text-rose-600'>
              {targetTime}
              {daysDiff > 0 ? (
                <span className='ml-2 text-xs text-muted'>
                  ({t('约')} {daysDiff} {t('天前')})
                </span>
              ) : null}
            </span>
          </div>
          <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'>
            ⚠️ {t('注意')}：{t('将删除')} <strong>{targetTime}</strong>
            {daysDiff > 0 ? (
              <span className='ml-1 text-muted'>
                ({t('约')} {daysDiff} {t('天前')})
              </span>
            ) : null}
            {' '}{t('之前的所有日志')}
          </div>
          <div className='text-xs text-rose-600'>
            {t('此操作不可恢复，请仔细确认时间后再操作！')}
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
