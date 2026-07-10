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

import React, { useCallback, useEffect, useState } from 'react';
import { Form, Spin } from '@douyinfe/semi-ui';
import { IconShield, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';

/**
 * 图形验证码组件。
 * 拉取 /api/captcha，展示图片与输入框，点击图片可刷新。
 * 通过 onChange({ captchaId, captchaAnswer }) 将状态回传父组件。
 * 通过 onKeyInput({ digit, valueBefore, selectionStart }) 上报数字按键。
 */
const CaptchaWidget = ({
  answer,
  className = '',
  onChange,
  onKeyInput,
  onRefreshSuccess,
  refreshSignal,
}) => {
  const { t } = useTranslation();
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/captcha');
      const { success, message, data } = res.data;
      if (success) {
        setCaptchaId(data.captcha_id);
        setCaptchaImage(data.captcha_image);
        onChange && onChange({ captchaId: data.captcha_id, captchaAnswer: '' });
        onRefreshSuccess && onRefreshSuccess(data);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('图形验证码加载失败，请刷新重试'));
    } finally {
      setLoading(false);
    }
  }, [onChange, onRefreshSuccess, t]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshSignal) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const handleAnswerChange = (value) => {
    onChange && onChange({ captchaId, captchaAnswer: value });
  };

  const handleAnswerKeyDown = (event) => {
    if (!onKeyInput || !/^\d$/.test(event.key)) {
      return;
    }
    onKeyInput({
      digit: event.key,
      valueBefore: event.currentTarget?.value || '',
      selectionStart: event.currentTarget?.selectionStart,
    });
  };

  const rootClassName = ['captcha-widget', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <Form.Input
        field='captcha_answer'
        label={t('图形验证码')}
        placeholder={t('请输入图中数字')}
        name='captcha_answer'
        value={answer}
        onChange={handleAnswerChange}
        onKeyDown={handleAnswerKeyDown}
        prefix={<IconShield />}
        suffix={
          <div
            className='captcha-widget-refresh'
            onClick={loading ? undefined : refresh}
            title={t('点击刷新')}
            style={{
              cursor: loading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              height: 32,
              minWidth: 100,
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <Spin size='small' />
            ) : captchaImage ? (
              <img
                className='captcha-widget-image'
                src={captchaImage}
                alt={t('图形验证码')}
                style={{ height: 32, borderRadius: 4, display: 'block' }}
              />
            ) : (
              <IconRefresh />
            )}
          </div>
        }
      />
    </div>
  );
};

export default CaptchaWidget;
