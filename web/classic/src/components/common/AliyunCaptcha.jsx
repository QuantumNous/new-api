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

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useMemo,
} from 'react';

let idCounter = 0;

function useUniqueId() {
  return useMemo(() => {
    idCounter += 1;
    return `ac-${idCounter}`;
  }, []);
}

let aliyunCaptchaScriptPromise = null;

function loadAliyunCaptchaScript() {
  if (window.initAliyunCaptcha) return Promise.resolve();
  if (aliyunCaptchaScriptPromise) return aliyunCaptchaScriptPromise;

  aliyunCaptchaScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('aliyun-captcha-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('阿里验证码脚本加载失败')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.id = 'aliyun-captcha-script';
    script.src =
      'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('阿里验证码脚本加载失败'));
    document.head.appendChild(script);
  });

  return aliyunCaptchaScriptPromise;
}

const AliyunCaptcha = forwardRef(function AliyunCaptcha(
  { enabled, region, prefix, sceneId, className, onError },
  ref
) {
  const uniqueId = useUniqueId();
  const elementSelector = useMemo(() => `#aliyun-captcha-element-${uniqueId}`, [uniqueId]);
  const buttonSelector = useMemo(() => `#aliyun-captcha-button-${uniqueId}`, [uniqueId]);
  const instanceRef = useRef(null);
  const initializedSceneRef = useRef('');
  const pendingResolveRef = useRef(null);
  const pendingRejectRef = useRef(null);

  const initialize = useCallback(async () => {
    if (!enabled) return;
    if (!prefix || !sceneId) {
      throw new Error('阿里验证码配置不完整');
    }
    if (initializedSceneRef.current === sceneId) return;

    window.AliyunCaptchaConfig = {
      region: region || 'cn',
      prefix,
    };
    await loadAliyunCaptchaScript();
    if (!window.initAliyunCaptcha) {
      throw new Error('阿里验证码初始化方法不可用');
    }

    window.initAliyunCaptcha({
      SceneId: sceneId,
      mode: 'popup',
      element: elementSelector,
      button: buttonSelector,
      success: (captchaVerifyParam) => {
        pendingResolveRef.current?.(captchaVerifyParam);
        pendingResolveRef.current = null;
        pendingRejectRef.current = null;
      },
      fail: (result) => {
        const message =
          result instanceof Error
            ? result.message
            : '人机验证未通过，请重试';
        pendingRejectRef.current?.(new Error(message));
        pendingResolveRef.current = null;
        pendingRejectRef.current = null;
      },
      getInstance: (instance) => {
        instanceRef.current = instance;
      },
      server: [
        'captcha-esa-open.aliyuncs.com',
        'captcha-esa-open-b.aliyuncs.com',
      ],
      slideStyle: {
        width: 360,
        height: 40,
      },
    });
    initializedSceneRef.current = sceneId;
  }, [enabled, prefix, region, sceneId, elementSelector, buttonSelector]);

  useImperativeHandle(
    ref,
    () => ({
      execute: async () => {
        if (!enabled) return '';
        try {
          await initialize();
          return await new Promise((resolve, reject) => {
            pendingResolveRef.current = resolve;
            pendingRejectRef.current = reject;
            document.querySelector(buttonSelector)?.click();
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '人机验证初始化失败';
          onError?.(message);
          throw new Error(message);
        }
      },
      refresh: () => {
        instanceRef.current?.refresh?.();
      },
    }),
    [enabled, initialize, onError, buttonSelector]
  );

  if (!enabled) return null;

  return (
    <div className={className}>
      <div id={`aliyun-captcha-element-${uniqueId}`} />
      <button
        id={`aliyun-captcha-button-${uniqueId}`}
        type='button'
        style={{ display: 'none' }}
        tabIndex={-1}
      />
    </div>
  );
});

export default AliyunCaptcha;
