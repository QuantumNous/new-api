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
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { Info } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../../helpers';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const CodexOAuthModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [input, setInput] = useState('');

  const startOAuth = async () => {
    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/codex/oauth/start',
        {},
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        // eslint-disable-next-line no-console
        console.error('Codex OAuth start failed:', res?.data?.message);
        throw new Error(t('启动授权失败'));
      }
      const url = res?.data?.data?.authorize_url || '';
      if (!url) {
        // eslint-disable-next-line no-console
        console.error(
          'Codex OAuth start response missing authorize_url:',
          res?.data,
        );
        throw new Error(t('响应缺少授权链接'));
      }
      setAuthorizeUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
      showSuccess(t('已打开授权页面'));
    } catch (error) {
      showError(error?.message || t('启动授权失败'));
    } finally {
      setLoading(false);
    }
  };

  const completeOAuth = async () => {
    if (!input || !input.trim()) {
      showError(t('请先粘贴回调 URL'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/codex/oauth/complete',
        { input },
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        // eslint-disable-next-line no-console
        console.error('Codex OAuth complete failed:', res?.data?.message);
        throw new Error(t('授权失败'));
      }
      const key = res?.data?.data?.key || '';
      if (!key) {
        // eslint-disable-next-line no-console
        console.error('Codex OAuth complete response missing key:', res?.data);
        throw new Error(t('响应缺少凭据'));
      }
      onSuccess?.(key);
      showSuccess(t('已生成授权凭据'));
      onCancel?.();
    } catch (error) {
      showError(error?.message || t('授权失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setAuthorizeUrl('');
    setInput('');
  }, [visible]);

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='lg' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {t('Codex 授权')}
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              <div className='flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'>
                <Info size={16} className='mt-0.5 shrink-0' />
                <div>
                  {t(
                    '1) 点击「打开授权页面」完成登录；2) 浏览器会跳转到 localhost（页面打不开也没关系）；3) 复制地址栏完整 URL 粘贴到下方；4) 点击「生成并填入」。',
                  )}
                </div>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button color='primary' onPress={startOAuth} isPending={loading}>
                  {t('打开授权页面')}
                </Button>
                <Button
                  variant='secondary'
                  isDisabled={!authorizeUrl || loading}
                  onPress={() => copy(authorizeUrl)}
                >
                  {t('复制授权链接')}
                </Button>
              </div>

              <Input
                type='text'
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t('请粘贴完整回调 URL（包含 code 与 state）')}
                aria-label={t('回调 URL')}
                className={inputClass}
              />

              <div className='text-xs leading-snug text-muted'>
                {t(
                  '说明：生成结果是可直接粘贴到渠道密钥里的 JSON（包含 access_token / refresh_token / account_id）。',
                )}
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='tertiary' onPress={onCancel} isDisabled={loading}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                onPress={completeOAuth}
                isPending={loading}
              >
                {t('生成并填入')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default CodexOAuthModal;
