import React, { useEffect, useRef } from 'react';
import RcSliderCaptcha from 'rc-slider-captcha';
import {
  createSliderCaptchaChallenge,
  createSliderCaptchaImages,
  isSliderCaptchaSolved,
  sliderCaptchaSizes,
} from './sliderCaptchaLogic';

const noop = () => {};

const SliderCaptcha = ({
  t,
  onVerifyChange = noop,
  onVerified = noop,
  resetSignal = 0,
}) => {
  const challengeRef = useRef(createSliderCaptchaChallenge());
  const actionRef = useRef();

  useEffect(() => {
    onVerifyChange(false);
    actionRef.current?.refresh(true);
  }, [onVerifyChange, resetSignal]);

  const requestCaptchaImages = async () => {
    const challenge = createSliderCaptchaChallenge();
    challengeRef.current = challenge;
    onVerifyChange(false);
    return createSliderCaptchaImages(challenge);
  };

  const handleVerify = async ({ x }) => {
    const solved = isSliderCaptchaSolved(challengeRef.current, x);
    onVerifyChange(solved);

    if (!solved) {
      return Promise.reject(new Error('slider captcha mismatch'));
    }

    onVerified();
    return Promise.resolve();
  };

  return (
    <div>
      <label className='auth-theme-field-label mb-2 block text-sm font-medium'>
        {t('滑块验证码')}
      </label>

      <RcSliderCaptcha
        actionRef={actionRef}
        mode='embed'
        request={requestCaptchaImages}
        onVerify={handleVerify}
        bgSize={sliderCaptchaSizes.bgSize}
        puzzleSize={sliderCaptchaSizes.puzzleSize}
        tipText={{
          default: t('拖动拼图完成验证'),
          loading: t('加载中...'),
          moving: '',
          verifying: t('验证中...'),
          success: t('验证通过'),
          error: t('验证失败，请重试'),
          loadFailed: t('加载失败，点击重试'),
        }}
        autoRefreshOnError={true}
        errorHoldDuration={500}
        style={{
          '--rcsc-primary': '#4f46e5',
          '--rcsc-primary-light': 'rgba(79, 70, 229, 0.14)',
          '--rcsc-success': '#10b981',
          '--rcsc-success-light': 'rgba(16, 185, 129, 0.14)',
          '--rcsc-error': '#ef4444',
          '--rcsc-error-light': 'rgba(239, 68, 68, 0.12)',
          '--rcsc-bg-color': 'rgba(248, 250, 252, 0.86)',
          '--rcsc-border-color': 'rgba(148, 163, 184, 0.38)',
          '--rcsc-text-color': '#475569',
          '--rcsc-button-color': '#4f46e5',
          '--rcsc-button-hover-color': '#ffffff',
          '--rcsc-button-bg-color': '#ffffff',
          '--rcsc-panel-border-radius': '12px',
          '--rcsc-control-border-radius': '12px',
          '--rcsc-control-height': '38px',
          width: '100%',
        }}
        styles={{
          panel: {
            borderRadius: '12px',
          },
          jigsaw: {
            borderRadius: '12px',
          },
          control: {
            borderRadius: '12px',
          },
        }}
      />
    </div>
  );
};

export default SliderCaptcha;
