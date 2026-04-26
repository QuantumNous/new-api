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

import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Card,
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
import { API, showError, showSuccess, timestamp2string } from '../../helpers';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';

const LEGAL_USER_AGREEMENT_KEY = 'legal.user_agreement';
const LEGAL_PRIVACY_POLICY_KEY = 'legal.privacy_policy';

// Replaces Semi `<Form.Section text>` with a clean section header inside
// each settings card.
function SectionHeader({ children }) {
  return (
    <h3 className='mb-4 text-base font-semibold text-foreground'>{children}</h3>
  );
}

function FieldLabel({ children }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

const codeFontStyle = { fontFamily: 'JetBrains Mono, Consolas' };

const OtherSetting = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    Notice: '',
    [LEGAL_USER_AGREEMENT_KEY]: '',
    [LEGAL_PRIVACY_POLICY_KEY]: '',
    SystemName: '',
    Logo: '',
    Footer: '',
    About: '',
    HomePageContent: '',
  });
  const [loading, setLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [statusState] = useContext(StatusContext);
  const [updateData, setUpdateData] = useState({
    tag_name: '',
    content: '',
  });
  const updateModalState = useOverlayState({
    isOpen: showUpdateModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowUpdateModal(false);
    },
  });

  const updateOption = async (key, value) => {
    setLoading(true);
    const res = await API.put('/api/option/', {
      key,
      value,
    });
    const { success, message } = res.data;
    if (success) {
      setInputs((prev) => ({ ...prev, [key]: value }));
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const [loadingInput, setLoadingInput] = useState({
    Notice: false,
    [LEGAL_USER_AGREEMENT_KEY]: false,
    [LEGAL_PRIVACY_POLICY_KEY]: false,
    SystemName: false,
    Logo: false,
    HomePageContent: false,
    About: false,
    Footer: false,
    CheckUpdate: false,
  });

  const handleInputChange = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const submitField = async (key, label) => {
    try {
      setLoadingInput((prev) => ({ ...prev, [key]: true }));
      await updateOption(key, inputs[key]);
      showSuccess(label || `${key} 已更新`);
    } catch (error) {
      console.error(`${key} 更新失败`, error);
      showError(`${key} 更新失败`);
    } finally {
      setLoadingInput((prev) => ({ ...prev, [key]: false }));
    }
  };

  const submitNotice = () => submitField('Notice', t('公告已更新'));
  const submitUserAgreement = () =>
    submitField(LEGAL_USER_AGREEMENT_KEY, t('用户协议已更新'));
  const submitPrivacyPolicy = () =>
    submitField(LEGAL_PRIVACY_POLICY_KEY, t('隐私政策已更新'));
  const submitSystemName = () => submitField('SystemName', t('系统名称已更新'));
  const submitLogo = () => submitField('Logo', 'Logo 已更新');
  const submitHomePageContent = () =>
    submitField('HomePageContent', '首页内容已更新');
  const submitAbout = () => submitField('About', '关于内容已更新');
  const submitFooter = () => submitField('Footer', '页脚内容已更新');

  const checkUpdate = async () => {
    try {
      setLoadingInput((prev) => ({ ...prev, CheckUpdate: true }));
      const res = await fetch(
        'https://api.github.com/repos/Calcium-Ion/new-api/releases/latest',
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'new-api-update-checker',
          },
        },
      ).then((response) => response.json());

      const { tag_name, body } = res;
      if (tag_name === statusState?.status?.version) {
        showSuccess(`已是最新版本：${tag_name}`);
      } else {
        setUpdateData({
          tag_name: tag_name,
          content: marked.parse(body),
        });
        setShowUpdateModal(true);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      showError('检查更新失败，请稍后再试');
    } finally {
      setLoadingInput((prev) => ({ ...prev, CheckUpdate: false }));
    }
  };

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      const newInputs = {};
      data.forEach((item) => {
        if (item.key in inputs) {
          newInputs[item.key] = item.value;
        }
      });
      setInputs((prev) => ({ ...prev, ...newInputs }));
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openGitHubRelease = () => {
    window.open(
      `https://github.com/Calcium-Ion/new-api/releases/tag/${updateData.tag_name}`,
      '_blank',
    );
  };

  const getStartTimeString = () => {
    const timestamp = statusState?.status?.start_time;
    return statusState.status ? timestamp2string(timestamp) : '';
  };

  return (
    <div className='mt-2.5 flex flex-col gap-2.5'>
      {/* 系统信息 */}
      <Card>
        <SectionHeader>{t('系统信息')}</SectionHeader>
        <div className='space-y-3 text-sm text-foreground'>
          <div className='flex flex-wrap items-center gap-3'>
            <span>
              {t('当前版本')}：
              {statusState?.status?.version || t('未知')}
            </span>
            <Button
              color='primary'
              onPress={checkUpdate}
              isPending={loadingInput['CheckUpdate']}
            >
              {t('检查更新')}
            </Button>
          </div>
          <div>
            {t('启动时间')}：{getStartTimeString()}
          </div>
        </div>
      </Card>

      {/* 通用设置 */}
      <Card>
        <SectionHeader>{t('通用设置')}</SectionHeader>
        <div className='space-y-5'>
          <div className='space-y-2'>
            <FieldLabel>{t('公告')}</FieldLabel>
            <textarea
              value={inputs.Notice}
              onChange={(event) =>
                handleInputChange('Notice', event.target.value)
              }
              placeholder={t('在此输入新的公告内容，支持 Markdown & HTML 代码')}
              rows={6}
              style={codeFontStyle}
              className={textareaClass}
            />
            <Button
              onPress={submitNotice}
              isPending={loadingInput['Notice']}
              isDisabled={loading}
            >
              {t('设置公告')}
            </Button>
          </div>

          <div className='space-y-2'>
            <FieldLabel>{t('用户协议')}</FieldLabel>
            <textarea
              value={inputs[LEGAL_USER_AGREEMENT_KEY]}
              onChange={(event) =>
                handleInputChange(LEGAL_USER_AGREEMENT_KEY, event.target.value)
              }
              placeholder={t('在此输入用户协议内容，支持 Markdown & HTML 代码')}
              rows={6}
              style={codeFontStyle}
              className={textareaClass}
            />
            <FieldHint>
              {t('填写用户协议内容后，用户注册时将被要求勾选已阅读用户协议')}
            </FieldHint>
            <Button
              onPress={submitUserAgreement}
              isPending={loadingInput[LEGAL_USER_AGREEMENT_KEY]}
              isDisabled={loading}
            >
              {t('设置用户协议')}
            </Button>
          </div>

          <div className='space-y-2'>
            <FieldLabel>{t('隐私政策')}</FieldLabel>
            <textarea
              value={inputs[LEGAL_PRIVACY_POLICY_KEY]}
              onChange={(event) =>
                handleInputChange(LEGAL_PRIVACY_POLICY_KEY, event.target.value)
              }
              placeholder={t('在此输入隐私政策内容，支持 Markdown & HTML 代码')}
              rows={6}
              style={codeFontStyle}
              className={textareaClass}
            />
            <FieldHint>
              {t('填写隐私政策内容后，用户注册时将被要求勾选已阅读隐私政策')}
            </FieldHint>
            <Button
              onPress={submitPrivacyPolicy}
              isPending={loadingInput[LEGAL_PRIVACY_POLICY_KEY]}
              isDisabled={loading}
            >
              {t('设置隐私政策')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 个性化设置 */}
      <Card>
        <SectionHeader>{t('个性化设置')}</SectionHeader>
        <div className='space-y-5'>
          <div className='space-y-2'>
            <FieldLabel>{t('系统名称')}</FieldLabel>
            <input
              type='text'
              value={inputs.SystemName}
              onChange={(event) =>
                handleInputChange('SystemName', event.target.value)
              }
              placeholder={t('在此输入系统名称')}
              className={inputClass}
            />
            <Button
              onPress={submitSystemName}
              isPending={loadingInput['SystemName']}
              isDisabled={loading}
            >
              {t('设置系统名称')}
            </Button>
          </div>

          <div className='space-y-2'>
            <FieldLabel>{t('Logo 图片地址')}</FieldLabel>
            <input
              type='text'
              value={inputs.Logo}
              onChange={(event) =>
                handleInputChange('Logo', event.target.value)
              }
              placeholder={t('在此输入 Logo 图片地址')}
              className={inputClass}
            />
            <Button
              onPress={submitLogo}
              isPending={loadingInput['Logo']}
              isDisabled={loading}
            >
              {t('设置 Logo')}
            </Button>
          </div>

          <div className='space-y-2'>
            <FieldLabel>{t('首页内容')}</FieldLabel>
            <textarea
              value={inputs.HomePageContent}
              onChange={(event) =>
                handleInputChange('HomePageContent', event.target.value)
              }
              placeholder={t(
                '在此输入首页内容，支持 Markdown & HTML 代码，设置后首页的状态信息将不再显示。如果输入的是一个链接，则会使用该链接作为 iframe 的 src 属性，这允许你设置任意网页作为首页',
              )}
              rows={6}
              style={codeFontStyle}
              className={textareaClass}
            />
            <Button
              onPress={submitHomePageContent}
              isPending={loadingInput['HomePageContent']}
              isDisabled={loading}
            >
              {t('设置首页内容')}
            </Button>
          </div>

          <div className='space-y-2'>
            <FieldLabel>{t('关于')}</FieldLabel>
            <textarea
              value={inputs.About}
              onChange={(event) =>
                handleInputChange('About', event.target.value)
              }
              placeholder={t(
                '在此输入新的关于内容，支持 Markdown & HTML 代码。如果输入的是一个链接，则会使用该链接作为 iframe 的 src 属性，这允许你设置任意网页作为关于页面',
              )}
              rows={6}
              style={codeFontStyle}
              className={textareaClass}
            />
            <Button
              onPress={submitAbout}
              isPending={loadingInput['About']}
              isDisabled={loading}
            >
              {t('设置关于')}
            </Button>
          </div>

          {/* Copyright preservation banner */}
          <div className='flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted'>
            <Info size={14} className='mt-0.5 shrink-0 text-primary' />
            <span>
              {t(
                '移除 One API 的版权标识必须首先获得授权，项目维护需要花费大量精力，如果本项目对你有意义，请主动支持本项目',
              )}
            </span>
          </div>

          <div className='space-y-2'>
            <FieldLabel>{t('页脚')}</FieldLabel>
            <input
              type='text'
              value={inputs.Footer}
              onChange={(event) =>
                handleInputChange('Footer', event.target.value)
              }
              placeholder={t(
                '在此输入新的页脚，留空则使用默认页脚，支持 HTML 代码',
              )}
              className={inputClass}
            />
            <Button
              onPress={submitFooter}
              isPending={loadingInput['Footer']}
              isDisabled={loading}
            >
              {t('设置页脚')}
            </Button>
          </div>
        </div>
      </Card>

      {/* New version available modal */}
      <Modal state={updateModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='lg' scroll='inside' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                {t('新版本') + '：' + updateData.tag_name}
              </ModalHeader>
              <ModalBody className='max-h-[60vh] overflow-y-auto px-4 py-4 md:px-6'>
                <div
                  className='prose prose-sm max-w-none dark:prose-invert'
                  dangerouslySetInnerHTML={{ __html: updateData.content }}
                />
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button
                  variant='light'
                  onPress={() => setShowUpdateModal(false)}
                >
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={() => {
                    setShowUpdateModal(false);
                    openGitHubRelease();
                  }}
                >
                  {t('详情')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
};

export default OtherSetting;
