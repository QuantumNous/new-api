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
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Modal,
  Radio,
  RadioGroup,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showSuccess } from '../../../../helpers';

const { Text } = Typography;

const DEFAULT_POLL_INTERVAL_MS = 3000;

// ZCode StartPlan 一键重授权：复刻 ZCode CLI 设备码式 OAuth。
// 后端负责 cli/init + cli/poll 与 JWT 写回渠道密钥，前端只做展示与轮询驱动。
const ZcodeStartPlanAuthFlow = ({ t, record }) => {
  const [provider, setProvider] = useState('zai');
  const [phase, setPhase] = useState('idle'); // idle|starting|authorizing|ready|failed
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [failure, setFailure] = useState('');
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const busyRef = useRef(false);

  const clearPollTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetState = () => {
    generationRef.current += 1;
    clearPollTimer();
    busyRef.current = false;
    setPhase('idle');
    setAuthorizeUrl('');
    setFailure('');
    setResult(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    resetState();
    setProvider('zai');
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearPollTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const schedulePoll = (channelId, delayMs, generation) => {
    clearPollTimer();
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current || generation !== generationRef.current) return;
      try {
        const res = await API.get(
          `/api/channel/${channelId}/zcode/start_plan/auth/poll`,
          { skipErrorHandler: true },
        );
        if (!mountedRef.current || generation !== generationRef.current) return;
        const payload = res?.data;
        if (!payload?.success) {
          // 会话丢失或网络抖动：不终止，等待下一轮。
          schedulePoll(channelId, delayMs, generation);
          return;
        }
        const status = payload?.data?.status;
        if (status === 'ready') {
          busyRef.current = false;
          setPhase('ready');
          setResult(payload.data);
          if (payload.data.provider) setProvider(payload.data.provider);
          showSuccess(t('授权成功，渠道密钥已更新'));
          return;
        }
        if (status === 'failed') {
          busyRef.current = false;
          setAuthorizeUrl('');
          setPhase('failed');
          setFailure(t('授权失败或已取消'));
          return;
        }
        if (status === 'expired') {
          busyRef.current = false;
          setAuthorizeUrl('');
          setPhase('failed');
          setFailure(t('授权流程已过期，请重试'));
          return;
        }
        schedulePoll(channelId, delayMs, generation);
      } catch {
        if (mountedRef.current && generation === generationRef.current) {
          schedulePoll(channelId, delayMs, generation);
        }
      }
    }, delayMs);
  };

  const startFlow = async () => {
    if (!record?.id || !mountedRef.current || busyRef.current) return;
    busyRef.current = true;
    const generation = ++generationRef.current;
    clearPollTimer();
    setFailure('');
    setResult(null);
    setAuthorizeUrl('');
    setPhase('starting');
    try {
      const res = await API.post(
        `/api/channel/${record.id}/zcode/start_plan/auth/init`,
        { provider },
        { skipErrorHandler: true },
      );
      if (!mountedRef.current || generation !== generationRef.current) return;
      const payload = res?.data;
      if (!payload?.success || !payload?.data?.authorize_url) {
        busyRef.current = false;
        setPhase('failed');
        setFailure(payload?.message || t('发起授权失败'));
        return;
      }
      if (payload.data.provider) setProvider(payload.data.provider);
      setAuthorizeUrl(payload.data.authorize_url);
      const intervalSec = Number(payload.data.poll_interval_sec);
      const delayMs =
        Number.isFinite(intervalSec) && intervalSec > 0
          ? Math.max(intervalSec * 1000, 1000)
          : DEFAULT_POLL_INTERVAL_MS;
      setPhase('authorizing');
      schedulePoll(record.id, delayMs, generation);
    } catch (error) {
      if (!mountedRef.current || generation !== generationRef.current) return;
      busyRef.current = false;
      setPhase('failed');
      setFailure(error?.message ? String(error.message) : t('发起授权失败'));
    }
  };

  const formatJwtExp = (expSeconds) => {
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null;
    const date = new Date(expSeconds * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  const jwtExp = formatJwtExp(Number(result?.jwt_expires_at));

  return (
    <div className='flex flex-col gap-3'>
      <Banner
        type='info'
        description={t(
          '官方客户端不支持自动刷新 JWT。过期后使用所选服务商重新授权，新密钥将自动保存。',
        )}
      />
      <fieldset disabled={phase !== 'idle'} className='min-w-0'>
        <legend className='mb-2'>{t('授权服务商')}</legend>
        <RadioGroup
          value={provider}
          disabled={phase !== 'idle'}
          onChange={(event) => {
            const value = event.target.value;
            if (phase === 'idle' && (value === 'zai' || value === 'bigmodel')) {
              setProvider(value);
            }
          }}
        >
          <Radio value='zai'>{t('Z.ai（国际版）')}</Radio>
          <Radio value='bigmodel'>{t('智谱 BigModel（中国版）')}</Radio>
        </RadioGroup>
      </fieldset>
      {(phase === 'starting' || phase === 'authorizing') && (
        <div className='flex items-center gap-3 py-2'>
          <Spin spinning={true} />
          <Text type='tertiary'>
            {phase === 'starting'
              ? t('正在发起授权流程...')
              : t('等待授权完成...')}
          </Text>
        </div>
      )}
      {phase === 'authorizing' && authorizeUrl && (
        <Button
          type='primary'
          theme='solid'
          onClick={() => window.open(authorizeUrl, '_blank', 'noopener')}
        >
          {t('打开授权页')}
        </Button>
      )}
      {phase === 'ready' && (
        <div className='flex flex-col gap-3'>
          <Banner type='success' description={t('授权成功，渠道密钥已更新')} />
          {result?.user_name && (
            <Text type='tertiary'>
              {t('账号')}：{result.user_name}
              {result.email ? ` (${result.email})` : ''}
            </Text>
          )}
          {jwtExp && (
            <Text type='tertiary'>
              {t('JWT 过期时间')}：{jwtExp}
            </Text>
          )}
        </div>
      )}
      {phase === 'idle' && (
        <Button
          type='primary'
          theme='solid'
          onClick={startFlow}
          disabled={!record?.id}
        >
          {t('开始授权')}
        </Button>
      )}
      {phase === 'failed' && (
        <div className='flex flex-col gap-3'>
          <Text type='danger'>{failure}</Text>
          <div>
            <Button
              size='small'
              type='primary'
              theme='outline'
              onClick={startFlow}
            >
              {t('重试')}
            </Button>
          </div>
        </div>
      )}
      {(phase === 'failed' || phase === 'ready') && (
        <Button theme='outline' onClick={resetState}>
          {phase === 'ready' ? t('重新发起授权') : t('返回')}
        </Button>
      )}
    </div>
  );
};

export const openZcodeStartPlanAuthModal = ({ t, record }) => {
  Modal.info({
    title: t('StartPlan 重新授权'),
    centered: false,
    width: 560,
    style: { maxWidth: '95vw' },
    content: <ZcodeStartPlanAuthFlow t={t} record={record} />,
    footer: (
      <div className='flex justify-end gap-2'>
        <Button type='primary' theme='solid' onClick={() => Modal.destroyAll()}>
          {t('关闭')}
        </Button>
      </div>
    ),
  });
};

export default ZcodeStartPlanAuthFlow;
