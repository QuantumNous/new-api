import React, { useContext, useState } from 'react';
import { Checkbox } from 'antd-mobile';

import { StatusContext } from '@classic/context/Status';

import { showInfo } from '../shims/classic-utils';

// 用户协议/隐私政策勾选（与 PC 端一致：由运营配置
// user_agreement_enabled / privacy_policy_enabled 控制显隐，未启用则不拦截）。
export const useAgreementGate = () => {
  const [statusState] = useContext(StatusContext);
  const [agreed, setAgreed] = useState(false);

  const status = statusState?.status || {};
  const hasUserAgreement = !!status.user_agreement_enabled;
  const hasPrivacyPolicy = !!status.privacy_policy_enabled;
  const required = hasUserAgreement || hasPrivacyPolicy;

  const ensureAgreed = () => {
    if (required && !agreed) {
      showInfo('请先阅读并同意用户协议和隐私政策');
      return false;
    }
    return true;
  };

  const node = required ? (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 16px 0',
        fontSize: 12.5,
        color: '#6b7280',
      }}
    >
      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        style={{ '--icon-size': '16px', '--font-size': '12.5px' }}
      >
        我已阅读并同意
        {hasUserAgreement && (
          <>
            {' '}
            <a href='/user-agreement' target='_blank' rel='noreferrer'>
              《用户协议》
            </a>
          </>
        )}
        {hasUserAgreement && hasPrivacyPolicy && ' 和'}
        {hasPrivacyPolicy && (
          <>
            {' '}
            <a href='/privacy-policy' target='_blank' rel='noreferrer'>
              《隐私政策》
            </a>
          </>
        )}
      </Checkbox>
    </div>
  ) : null;

  return { agreementNode: node, ensureAgreed };
};
