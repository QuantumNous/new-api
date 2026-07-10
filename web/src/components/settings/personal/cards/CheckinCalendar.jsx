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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  Calendar,
  Button,
  Typography,
  Avatar,
  Spin,
  Tooltip,
  Collapsible,
  Modal,
  Form,
} from '@douyinfe/semi-ui';
import {
  CalendarCheck,
  Gift,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { API, showError, showSuccess, renderQuota } from '../../../../helpers';
import CaptchaWidget from '../../../common/CaptchaWidget';

const CHECKIN_CAPTCHA_COUNT_COOKIE = 'checkin_captcha_display_count';
const CHECKIN_CAPTCHA_COOKIE_MAX_AGE = 180;
const CHECKIN_CAPTCHA_KEY_INPUT_LIMIT = 32;

const getCookieValue = (name) => {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
};

const setCookieValue = (name, value, maxAgeSeconds) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

const deleteCookieValue = (name) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

const CheckinCalendar = ({ t, status }) => {
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [captchaModalVisible, setCaptchaModalVisible] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefresh, setCaptchaRefresh] = useState(0);
  const [captchaDisplayCount, setCaptchaDisplayCount] = useState(0);
  const [captchaFirstSeenAt, setCaptchaFirstSeenAt] = useState(0);
  const captchaKeyInputsRef = useRef([]);
  const captchaDisplayCountRef = useRef(0);
  const captchaFirstSeenAtRef = useRef(0);
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
  // 初始加载状态，用于避免折叠状态闪烁
  const [initialLoaded, setInitialLoaded] = useState(false);
  // 折叠状态：null 表示未确定（等待首次加载）
  const [isCollapsed, setIsCollapsed] = useState(null);

  // 创建日期到额度的映射，方便快速查找
  const checkinRecordsMap = useMemo(() => {
    const map = {};
    const records = checkinData.stats?.records || [];
    records.forEach((record) => {
      map[record.checkin_date] = record.quota_awarded;
    });
    return map;
  }, [checkinData.stats?.records]);

  // 计算本月获得的额度
  const monthlyQuota = useMemo(() => {
    const records = checkinData.stats?.records || [];
    return records.reduce(
      (sum, record) => sum + (record.quota_awarded || 0),
      0,
    );
  }, [checkinData.stats?.records]);

  // 获取签到状态
  const fetchCheckinStatus = async (month) => {
    const isFirstLoad = !initialLoaded;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/checkin?month=${month}`);
      const { success, data, message } = res.data;
      if (success) {
        setCheckinData(data);
        // 首次加载时，根据签到状态设置折叠状态
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

  const postCheckin = async () => {
    const displayCount = captchaDisplayCountRef.current || captchaDisplayCount;
    const firstSeenAt = captchaFirstSeenAtRef.current || captchaFirstSeenAt;
    const clientSubmittedAt = Date.now();
    return API.post('/api/user/checkin', {
      captcha_id: captchaId,
      captcha_answer: captchaAnswer,
      captcha_display_count: displayCount,
      captcha_first_seen_at: firstSeenAt,
      client_submitted_at: clientSubmittedAt,
      captcha_key_inputs: captchaKeyInputsRef.current,
    });
  };

  const handleCaptchaRefreshSuccess = () => {
    const cookieCount = parseInt(
      getCookieValue(CHECKIN_CAPTCHA_COUNT_COOKIE) || '0',
      10,
    );
    const nextCount = Number.isFinite(cookieCount) ? cookieCount + 1 : 1;
    setCookieValue(
      CHECKIN_CAPTCHA_COUNT_COOKIE,
      String(nextCount),
      CHECKIN_CAPTCHA_COOKIE_MAX_AGE,
    );
    // 新图重新计时，并清空上一张图的按键遥测
    const firstSeenAt = Date.now();
    captchaKeyInputsRef.current = [];
    captchaDisplayCountRef.current = nextCount;
    captchaFirstSeenAtRef.current = firstSeenAt;
    setCaptchaDisplayCount(nextCount);
    setCaptchaFirstSeenAt(firstSeenAt);
  };

  const handleCaptchaChange = ({ captchaId: id, captchaAnswer: answer }) => {
    setCaptchaId(id);
    setCaptchaAnswer(answer);
  };

  const handleCaptchaKeyInput = ({ digit, valueBefore, selectionStart }) => {
    if (!/^\d$/.test(digit)) {
      return;
    }
    const now = Date.now();
    const inputs = captchaKeyInputsRef.current;
    const previous = inputs[inputs.length - 1];
    const firstSeenAt = captchaFirstSeenAtRef.current || captchaFirstSeenAt;
    const inputPosition = Number.isInteger(selectionStart)
      ? selectionStart + 1
      : (valueBefore || '').length + 1;
    captchaKeyInputsRef.current = [
      ...inputs,
      {
        order: inputs.length + 1,
        digit,
        position: inputPosition,
        display_count: captchaDisplayCountRef.current || captchaDisplayCount,
        timestamp: now,
        elapsed_ms: firstSeenAt ? Math.max(now - firstSeenAt, 0) : 0,
        interval_ms: previous?.timestamp
          ? Math.max(now - previous.timestamp, 0)
          : 0,
      },
    ].slice(-CHECKIN_CAPTCHA_KEY_INPUT_LIMIT);
  };

  const resetCaptchaTelemetry = () => {
    captchaKeyInputsRef.current = [];
    captchaDisplayCountRef.current = 0;
    captchaFirstSeenAtRef.current = 0;
  };

  const openCaptchaModal = () => {
    setCaptchaId('');
    setCaptchaAnswer('');
    setCaptchaRefresh(0);
    setCaptchaDisplayCount(0);
    setCaptchaFirstSeenAt(0);
    resetCaptchaTelemetry();
    setCaptchaModalVisible(true);
  };

  const closeCaptchaModal = () => {
    setCaptchaModalVisible(false);
    setCaptchaId('');
    setCaptchaAnswer('');
    setCaptchaRefresh(0);
    setCaptchaDisplayCount(0);
    setCaptchaFirstSeenAt(0);
    resetCaptchaTelemetry();
  };

  const doCheckin = async () => {
    if (!captchaId || !captchaAnswer) {
      showError(t('请输入图形验证码'));
      return;
    }
    setCheckinLoading(true);
    try {
      const res = await postCheckin();
      const { success, data, message } = res.data;
      if (success) {
        showSuccess(
          t('签到成功！获得') + ' ' + renderQuota(data.quota_awarded),
        );
        // 刷新签到状态
        fetchCheckinStatus(currentMonth);
        deleteCookieValue(CHECKIN_CAPTCHA_COUNT_COOKIE);
        closeCaptchaModal();
      } else {
        showError(message || t('签到失败'));
        setCaptchaAnswer('');
        // 过快失败未消费验证码，只需等待后重试，不必刷新
        if (message && String(message).includes('操作过快')) {
          return;
        }
        captchaKeyInputsRef.current = [];
        setCaptchaRefresh((v) => v + 1);
      }
    } catch (error) {
      showError(t('签到失败'));
      setCaptchaAnswer('');
      captchaKeyInputsRef.current = [];
      setCaptchaRefresh((v) => v + 1);
    } finally {
      setCheckinLoading(false);
    }
  };

  useEffect(() => {
    if (status?.checkin_enabled) {
      fetchCheckinStatus(currentMonth);
    }
  }, [status?.checkin_enabled, currentMonth]);

  // 如果签到功能未启用，不显示组件
  if (!status?.checkin_enabled) {
    return null;
  }

  // 日期渲染函数 - 显示签到状态和获得的额度
  const dateRender = (dateString) => {
    // Semi Calendar 传入的 dateString 是 Date.toString() 格式
    // 需要转换为 YYYY-MM-DD 格式来匹配后端数据
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    // 使用本地时间格式化，避免时区问题
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`; // YYYY-MM-DD
    const quotaAwarded = checkinRecordsMap[formattedDate];
    const isCheckedIn = quotaAwarded !== undefined;

    if (isCheckedIn) {
      return (
        <Tooltip
          content={`${t('获得')} ${renderQuota(quotaAwarded)}`}
          position='top'
        >
          <div className='absolute inset-0 flex flex-col items-center justify-center cursor-pointer'>
            <div className='w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mb-0.5 shadow-sm'>
              <Check size={14} className='text-white' strokeWidth={3} />
            </div>
            <div className='text-[10px] font-medium text-green-600 dark:text-green-400 leading-none'>
              {renderQuota(quotaAwarded)}
            </div>
          </div>
        </Tooltip>
      );
    }
    return null;
  };

  // 处理月份变化
  const handleMonthChange = (date) => {
    const month = date.toISOString().slice(0, 7);
    setCurrentMonth(month);
  };

  return (
    <Card className='!rounded-2xl'>
      <Modal
        className='checkin-captcha-modal'
        title={t('图形验证码')}
        visible={captchaModalVisible}
        okText={t('确认')}
        cancelText={t('取消')}
        confirmLoading={checkinLoading}
        centered
        onOk={doCheckin}
        onCancel={closeCaptchaModal}
      >
        <div className='checkin-captcha-body py-2'>
          {captchaModalVisible && (
            <Form>
              <CaptchaWidget
                answer={captchaAnswer}
                className='checkin-captcha-widget'
                onChange={handleCaptchaChange}
                onKeyInput={handleCaptchaKeyInput}
                onRefreshSuccess={handleCaptchaRefreshSuccess}
                refreshSignal={captchaRefresh}
              />
            </Form>
          )}
        </div>
      </Modal>

      {/* 卡片头部 */}
      <div className='flex items-center justify-between'>
        <div
          className='flex items-center flex-1 cursor-pointer'
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Avatar size='small' color='green' className='mr-3 shadow-md'>
            <CalendarCheck size={16} />
          </Avatar>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <Typography.Text className='text-lg font-medium'>
                {t('每日签到')}
              </Typography.Text>
              {isCollapsed ? (
                <ChevronDown size={16} className='text-gray-400' />
              ) : (
                <ChevronUp size={16} className='text-gray-400' />
              )}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
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
          type='primary'
          theme='solid'
          icon={<Gift size={16} />}
          onClick={openCaptchaModal}
          loading={checkinLoading || !initialLoaded}
          disabled={!initialLoaded || checkinData.stats?.checked_in_today}
          className='console-primary-action !rounded-2xl'
        >
          {!initialLoaded
            ? t('加载中...')
            : checkinData.stats?.checked_in_today
              ? t('今日已签到')
              : t('立即签到')}
        </Button>
      </div>

      {/* 可折叠内容 */}
      <Collapsible isOpen={isCollapsed === false} keepDOM>
        {/* 签到统计 */}
        <div className='grid grid-cols-3 gap-3 mb-4 mt-4'>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-green-600'>
              {checkinData.stats?.total_checkins || 0}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              {t('累计签到')}
            </div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-orange-600'>
              {renderQuota(monthlyQuota, 6)}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              {t('本月获得')}
            </div>
          </div>
          <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <div className='text-xl font-bold text-blue-600'>
              {renderQuota(checkinData.stats?.total_quota || 0, 6)}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              {t('累计获得')}
            </div>
          </div>
        </div>

        {/* 签到日历 - 使用更紧凑的样式 */}
        <Spin spinning={loading}>
          <div className='border rounded-lg overflow-hidden checkin-calendar'>
            <style>{`
            .checkin-calendar .semi-calendar {
              font-size: 13px;
            }
            .checkin-calendar .semi-calendar-month-header {
              padding: 8px 12px;
            }
            .checkin-calendar .semi-calendar-month-week-row {
              height: 28px;
            }
            .checkin-calendar .semi-calendar-month-week-row th {
              font-size: 12px;
              padding: 4px 0;
            }
            .checkin-calendar .semi-calendar-month-grid-row {
              height: auto;
            }
            .checkin-calendar .semi-calendar-month-grid-row td {
              height: 56px;
              padding: 2px;
            }
            .checkin-calendar .semi-calendar-month-grid-row-cell {
              position: relative;
              height: 100%;
            }
            .checkin-calendar .semi-calendar-month-grid-row-cell-day {
              position: absolute;
              top: 4px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 12px;
              z-index: 1;
            }
            .checkin-calendar .semi-calendar-month-same {
              background: transparent;
            }
            .checkin-calendar .semi-calendar-month-today .semi-calendar-month-grid-row-cell-day {
              background: var(--semi-color-primary);
              color: white;border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;}
          `}</style>
            <Calendar
              mode='month'
              onChange={handleMonthChange}
              dateGridRender={(dateString, date) => dateRender(dateString)}
            />
          </div>
        </Spin>

        {/* 签到说明 */}
        <div className='mt-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
          <Typography.Text type='tertiary' className='text-xs'>
            <ul className='list-disc list-inside space-y-0.5'>
              <li>{t('每日签到可获得随机额度奖励')}</li>
              <li>{t('签到奖励将直接添加到您的账户余额')}</li>
              <li>{t('每日仅可签到一次，请勿重复签到')}</li>
            </ul>
          </Typography.Text>
        </div>
      </Collapsible>
    </Card>
  );
};

export default CheckinCalendar;
