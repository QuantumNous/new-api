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

import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Row,
  Modal,
  Space,
  Card,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';

const LEGAL_USER_AGREEMENT_KEY = 'legal.user_agreement';
const LEGAL_PRIVACY_POLICY_KEY = 'legal.privacy_policy';

const OtherSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    Notice: '',
    [LEGAL_USER_AGREEMENT_KEY]: '',
    [LEGAL_PRIVACY_POLICY_KEY]: '',
    SystemName: '',
    Logo: '',
    Footer: '',
    About: '',
    HomePageContent: '',
    FeedbackLarkWebhookEnabled: false,
    FeedbackLarkWebhookURL: '',
    FeedbackLarkWebhookSecret: '',
    FeedbackLarkWebhookMentionAllEnabled: false,
    FeedbackLarkWebhookMentionOpenIDs: '',
  });
  let [loading, setLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const logoFileInputRef = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [updateData, setUpdateData] = useState({
    tag_name: '',
    repository: '',
    last_updated: '',
    details_url: '',
  });

  const updateOption = async (key, value) => {
    setLoading(true);
    const res = await API.put('/api/option/', {
      key,
      value,
    });
    const { success, message } = res.data;
    if (success) {
      setInputs((inputs) => ({ ...inputs, [key]: value }));
    } else {
      showError(message);
    }
    setLoading(false);
    return success;
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
    FeedbackLarkWebhook: false,
  });
  const handleInputChange = async (value, e) => {
    const name = e.target.id;
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  // 通用设置
  const formAPISettingGeneral = useRef();
  // 通用设置 - Notice
  const submitNotice = async () => {
    try {
      setLoadingInput((loadingInput) => ({ ...loadingInput, Notice: true }));
      await updateOption('Notice', inputs.Notice);
      showSuccess(t('公告已更新'));
    } catch (error) {
      console.error(t('公告更新失败'), error);
      showError(t('公告更新失败'));
    } finally {
      setLoadingInput((loadingInput) => ({ ...loadingInput, Notice: false }));
    }
  };
  // 通用设置 - UserAgreement
  const submitUserAgreement = async () => {
    try {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        [LEGAL_USER_AGREEMENT_KEY]: true,
      }));
      await updateOption(
        LEGAL_USER_AGREEMENT_KEY,
        inputs[LEGAL_USER_AGREEMENT_KEY],
      );
      showSuccess(t('用户协议已更新'));
    } catch (error) {
      console.error(t('用户协议更新失败'), error);
      showError(t('用户协议更新失败'));
    } finally {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        [LEGAL_USER_AGREEMENT_KEY]: false,
      }));
    }
  };
  // 通用设置 - PrivacyPolicy
  const submitPrivacyPolicy = async () => {
    try {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        [LEGAL_PRIVACY_POLICY_KEY]: true,
      }));
      await updateOption(
        LEGAL_PRIVACY_POLICY_KEY,
        inputs[LEGAL_PRIVACY_POLICY_KEY],
      );
      showSuccess(t('隐私政策已更新'));
    } catch (error) {
      console.error(t('隐私政策更新失败'), error);
      showError(t('隐私政策更新失败'));
    } finally {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        [LEGAL_PRIVACY_POLICY_KEY]: false,
      }));
    }
  };
  // 个性化设置
  const formAPIPersonalization = useRef();
  //  个性化设置 - SystemName
  const submitSystemName = async () => {
    try {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        SystemName: true,
      }));
      await updateOption('SystemName', inputs.SystemName);
      showSuccess(t('系统名称已更新'));
    } catch (error) {
      console.error(t('系统名称更新失败'), error);
      showError(t('系统名称更新失败'));
    } finally {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        SystemName: false,
      }));
    }
  };

  const handleLogoFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setLogoFile(nextFile);
  };

  const openLogoPicker = () => {
    logoFileInputRef.current?.click();
  };

  // 个性化设置 - Logo
  const submitLogo = async () => {
    try {
      if (!logoFile) {
        showError(t('请先选择一张 Logo 图片'));
        return;
      }
      setLoadingInput((loadingInput) => ({ ...loadingInput, Logo: true }));
      const formData = new FormData();
      formData.append('file', logoFile);

      const uploadRes = await API.post('/api/upload/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const {
        success: uploadSuccess,
        message: uploadMessage,
        data,
      } = uploadRes.data;
      if (!uploadSuccess) {
        showError(uploadMessage);
        return;
      }

      const logoUrl = data?.url || '';
      const updated = await updateOption('Logo', logoUrl);
      if (!updated) {
        return;
      }
      setLogoFile(null);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
      showSuccess(t('Logo 已更新'));
    } catch (error) {
      console.error('Logo 更新失败', error);
      showError(t('Logo 更新失败'));
    } finally {
      setLoadingInput((loadingInput) => ({ ...loadingInput, Logo: false }));
    }
  };
  // 个性化设置 - 首页内容
  const submitOption = async (key) => {
    try {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        HomePageContent: true,
      }));
      await updateOption(key, inputs[key]);
      showSuccess('首页内容已更新');
    } catch (error) {
      console.error('首页内容更新失败', error);
      showError('首页内容更新失败');
    } finally {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        HomePageContent: false,
      }));
    }
  };
  // 个性化设置 - 关于
  const submitAbout = async () => {
    try {
      setLoadingInput((loadingInput) => ({ ...loadingInput, About: true }));
      await updateOption('About', inputs.About);
      showSuccess('关于内容已更新');
    } catch (error) {
      console.error('关于内容更新失败', error);
      showError('关于内容更新失败');
    } finally {
      setLoadingInput((loadingInput) => ({ ...loadingInput, About: false }));
    }
  };
  // 个性化设置 - 页脚
  const submitFooter = async () => {
    try {
      setLoadingInput((loadingInput) => ({ ...loadingInput, Footer: true }));
      await updateOption('Footer', inputs.Footer);
      showSuccess('页脚内容已更新');
    } catch (error) {
      console.error('页脚内容更新失败', error);
      showError('页脚内容更新失败');
    } finally {
      setLoadingInput((loadingInput) => ({ ...loadingInput, Footer: false }));
    }
  };

  const submitFeedbackLarkWebhook = async () => {
    const webhookURL = inputs.FeedbackLarkWebhookURL?.trim() || '';
    const webhookSecret = inputs.FeedbackLarkWebhookSecret?.trim() || '';
    const webhookMentionOpenIDs =
      inputs.FeedbackLarkWebhookMentionOpenIDs?.trim() || '';

    if (inputs.FeedbackLarkWebhookEnabled && webhookURL === '') {
      showError(t('开启反馈 Lark Webhook 前请先填写 Webhook 地址'));
      return;
    }

    setLoadingInput((loadingInput) => ({
      ...loadingInput,
      FeedbackLarkWebhook: true,
    }));
    try {
      const requests = [
        {
          key: 'FeedbackLarkWebhookURL',
          value: webhookURL,
        },
        {
          key: 'FeedbackLarkWebhookMentionAllEnabled',
          value: inputs.FeedbackLarkWebhookMentionAllEnabled,
        },
        {
          key: 'FeedbackLarkWebhookMentionOpenIDs',
          value: webhookMentionOpenIDs,
        },
      ];

      if (webhookSecret !== '') {
        requests.push({
          key: 'FeedbackLarkWebhookSecret',
          value: webhookSecret,
        });
      }

      requests.push({
        key: 'FeedbackLarkWebhookEnabled',
        value: inputs.FeedbackLarkWebhookEnabled,
      });

      for (const request of requests) {
        const response = await API.put('/api/option/', request);
        if (!response.data.success) {
          showError(response.data.message);
          return;
        }
      }

      setInputs((prev) => ({
        ...prev,
        FeedbackLarkWebhookURL: webhookURL,
        FeedbackLarkWebhookSecret: '',
        FeedbackLarkWebhookMentionOpenIDs: webhookMentionOpenIDs,
      }));
      formAPIPersonalization.current?.setValue(
        'FeedbackLarkWebhookSecret',
        '',
      );
      showSuccess(t('反馈 Lark Webhook 已更新'));
    } catch (error) {
      showError(t('反馈 Lark Webhook 更新失败'));
    } finally {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        FeedbackLarkWebhook: false,
      }));
    }
  };

  const checkUpdate = async () => {
    try {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        CheckUpdate: true,
      }));
      const response = await API.get('/api/status/docker-version');
      const { success, message, data } = response.data;
      if (!success) {
        showError(message);
        return;
      }

      const { latest_tag, repository, last_updated, details_url } = data;
      const currentVersion =
        statusState?.status?.docker_image_tag || statusState?.status?.version;
      if (latest_tag === currentVersion) {
        showSuccess(`已是最新版本：${latest_tag}`);
        return;
      }

      setUpdateData({
        tag_name: latest_tag,
        repository,
        last_updated: last_updated || '',
        details_url: details_url || '',
      });
      setShowUpdateModal(true);
    } catch (error) {
      console.error('Failed to check for updates:', error);
      showError('检查更新失败，请稍后再试');
    } finally {
      setLoadingInput((loadingInput) => ({
        ...loadingInput,
        CheckUpdate: false,
      }));
    }
  };
  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key in inputs) {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
      formAPISettingGeneral.current.setValues(newInputs);
      formAPIPersonalization.current.setValues(newInputs);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions();
  }, []);

  const openDockerTagDetails = () => {
    if (!updateData.details_url) {
      return;
    }
    window.open(updateData.details_url, '_blank');
  };

  const getStartTimeString = () => {
    const timestamp = statusState?.status?.start_time;
    return statusState.status ? timestamp2string(timestamp) : '';
  };

  const getLastUpdatedString = () => {
    if (!updateData.last_updated) {
      return '-';
    }
    const date = new Date(updateData.last_updated);
    if (Number.isNaN(date.getTime())) {
      return updateData.last_updated;
    }
    return date.toISOString().replace('T', ' ').slice(0, 19);
  };

  return (
    <Row>
      <Col
        span={24}
        style={{
          marginTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* 版本信息 */}
        <Form>
          <Card>
            <Form.Section text={t('系统信息')}>
              <Row>
                <Col span={16}>
                  <Space>
                    <Text>
                      {t('当前版本')}：
                      {statusState?.status?.docker_image_tag ||
                        statusState?.status?.version ||
                        t('未知')}
                    </Text>
                    <Button
                      type='primary'
                      onClick={checkUpdate}
                      loading={loadingInput['CheckUpdate']}
                    >
                      {t('检查更新')}
                    </Button>
                  </Space>
                </Col>
              </Row>
              <Row>
                <Col span={16}>
                  <Text>
                    {t('启动时间')}：{getStartTimeString()}
                  </Text>
                </Col>
              </Row>
            </Form.Section>
          </Card>
        </Form>
        {/* 通用设置 */}
        <Form
          values={inputs}
          getFormApi={(formAPI) => (formAPISettingGeneral.current = formAPI)}
        >
          <Card>
            <Form.Section text={t('通用设置')}>
              <Form.TextArea
                label={t('公告')}
                placeholder={t(
                  '在此输入新的公告内容，支持 Markdown & HTML 代码',
                )}
                field={'Notice'}
                onChange={handleInputChange}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 6, maxRows: 12 }}
              />
              <Button onClick={submitNotice} loading={loadingInput['Notice']}>
                {t('设置公告')}
              </Button>
              <Form.TextArea
                label={t('用户协议')}
                placeholder={t(
                  '在此输入用户协议内容，支持 Markdown & HTML 代码',
                )}
                field={LEGAL_USER_AGREEMENT_KEY}
                onChange={handleInputChange}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 6, maxRows: 12 }}
                helpText={t(
                  '填写用户协议内容后，用户注册时将被要求勾选已阅读用户协议',
                )}
              />
              <Button
                onClick={submitUserAgreement}
                loading={loadingInput[LEGAL_USER_AGREEMENT_KEY]}
              >
                {t('设置用户协议')}
              </Button>
              <Form.TextArea
                label={t('隐私政策')}
                placeholder={t(
                  '在此输入隐私政策内容，支持 Markdown & HTML 代码',
                )}
                field={LEGAL_PRIVACY_POLICY_KEY}
                onChange={handleInputChange}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 6, maxRows: 12 }}
                helpText={t(
                  '填写隐私政策内容后，用户注册时将被要求勾选已阅读隐私政策',
                )}
              />
              <Button
                onClick={submitPrivacyPolicy}
                loading={loadingInput[LEGAL_PRIVACY_POLICY_KEY]}
              >
                {t('设置隐私政策')}
              </Button>
            </Form.Section>
          </Card>
        </Form>
        {/* 个性化设置 */}
        <Form
          values={inputs}
          getFormApi={(formAPI) => (formAPIPersonalization.current = formAPI)}
        >
          <Card>
            <Form.Section text={t('个性化设置')}>
              <Form.Input
                label={t('系统名称')}
                placeholder={t('在此输入系统名称')}
                field={'SystemName'}
                onChange={handleInputChange}
              />
              <Button
                onClick={submitSystemName}
                loading={loadingInput['SystemName']}
              >
                {t('设置系统名称')}
              </Button>
              <Form.Input
                label={t('当前 Logo 地址')}
                placeholder={t('上传后会自动生成 Logo 地址')}
                field={'Logo'}
                onChange={handleInputChange}
                disabled
              />
              <input
                ref={logoFileInputRef}
                type='file'
                accept='.png,.jpg,.jpeg,.webp,.gif'
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
              />
              <Space vertical align='start' spacing='medium'>
                <Space wrap>
                  <Button onClick={openLogoPicker}>{t('选择 Logo 图片')}</Button>
                  <Button onClick={submitLogo} loading={loadingInput['Logo']}>
                    {t('上传并设置 Logo')}
                  </Button>
                </Space>
                <Text type='secondary'>
                  {logoFile
                    ? `${t('已选择文件')}：${logoFile.name}`
                    : t('支持 png、jpg、jpeg、webp、gif，大小不超过 2MB')}
                </Text>
                {inputs.Logo ? (
                  <div className='flex items-center gap-4 rounded-xl border border-semi-color-border px-4 py-3'>
                    <img
                      src={inputs.Logo}
                      alt='logo preview'
                      className='h-12 w-12 rounded-xl object-contain bg-semi-color-bg-1'
                    />
                    <Text>{inputs.Logo}</Text>
                  </div>
                ) : null}
              </Space>
              <Form.TextArea
                label={t('首页内容')}
                placeholder={t(
                  '在此输入首页内容，支持 Markdown & HTML 代码，设置后首页的状态信息将不再显示。如果输入的是一个链接，则会使用该链接作为 iframe 的 src 属性，这允许你设置任意网页作为首页',
                )}
                field={'HomePageContent'}
                onChange={handleInputChange}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 6, maxRows: 12 }}
              />
              <Button
                onClick={() => submitOption('HomePageContent')}
                loading={loadingInput['HomePageContent']}
              >
                {t('设置首页内容')}
              </Button>
              <Form.TextArea
                label={t('关于')}
                placeholder={t(
                  '在此输入新的关于内容，支持 Markdown & HTML 代码。如果输入的是一个链接，则会使用该链接作为 iframe 的 src 属性，这允许你设置任意网页作为关于页面',
                )}
                field={'About'}
                onChange={handleInputChange}
                style={{ fontFamily: 'JetBrains Mono, Consolas' }}
                autosize={{ minRows: 6, maxRows: 12 }}
              />
              <Button onClick={submitAbout} loading={loadingInput['About']}>
                {t('设置关于')}
              </Button>
              {/*  */}
              <Banner
                fullMode={false}
                type='info'
                description={t(
                  '移除 One API 的版权标识必须首先获得授权，项目维护需要花费大量精力，如果本项目对你有意义，请主动支持本项目',
                )}
                closeIcon={null}
                style={{ marginTop: 15 }}
              />
              <Form.Input
                label={t('页脚')}
                placeholder={t(
                  '在此输入新的页脚，留空则使用默认页脚，支持 HTML 代码',
                )}
                field={'Footer'}
                onChange={handleInputChange}
              />
              <Button onClick={submitFooter} loading={loadingInput['Footer']}>
                {t('设置页脚')}
              </Button>
              <Banner
                fullMode={false}
                type='info'
                description={t(
                  '用户在联系页提交反馈后，可通过 Lark 自定义机器人 Webhook 推送消息卡片到群聊。保存时会先写入 Webhook 地址，再更新启用开关，避免开关因校验顺序未生效。',
                )}
                closeIcon={null}
                style={{ marginTop: 15 }}
              />
              <Form.Switch
                field='FeedbackLarkWebhookEnabled'
                label={t('启用反馈 Lark Webhook')}
                onChange={(value) =>
                  setInputs((prev) => ({
                    ...prev,
                    FeedbackLarkWebhookEnabled: value,
                  }))
                }
              />
              <Form.Input
                field='FeedbackLarkWebhookURL'
                label={t('反馈 Lark Webhook 地址')}
                placeholder={t(
                  '例如 https://open.larksuite.com/open-apis/bot/v2/hook/xxxx',
                )}
                onChange={handleInputChange}
              />
              <Form.Input
                field='FeedbackLarkWebhookSecret'
                label={t('反馈 Lark Webhook Secret')}
                placeholder={t('从 Lark 自定义机器人获取，可留空')}
                mode='password'
                onChange={handleInputChange}
              />
              <Form.Switch
                field='FeedbackLarkWebhookMentionAllEnabled'
                label={t('反馈通知时 @所有人')}
                onChange={(value) =>
                  setInputs((prev) => ({
                    ...prev,
                    FeedbackLarkWebhookMentionAllEnabled: value,
                  }))
                }
              />
              <Form.TextArea
                field='FeedbackLarkWebhookMentionOpenIDs'
                label={t('反馈通知时 @指定 Lark 成员')}
                placeholder={t('填写一个或多个 Open ID，支持逗号或换行分隔')}
                autosize={{ minRows: 3, maxRows: 6 }}
                onChange={handleInputChange}
              />
              <Button
                onClick={submitFeedbackLarkWebhook}
                loading={loadingInput['FeedbackLarkWebhook']}
              >
                {t('保存反馈 Lark Webhook')}
              </Button>
            </Form.Section>
          </Card>
        </Form>
      </Col>
      <Modal
        title={t('新版本') + '：' + updateData.tag_name}
        visible={showUpdateModal}
        onCancel={() => setShowUpdateModal(false)}
        footer={[
          <Button
            key='details'
            type='primary'
            disabled={!updateData.details_url}
            onClick={() => {
              setShowUpdateModal(false);
              openDockerTagDetails();
            }}
          >
            {t('详情')}
          </Button>,
        ]}
      >
        <Space vertical align='start'>
          <Text>
            {t('当前版本')}：
            {statusState?.status?.docker_image_tag || statusState?.status?.version}
          </Text>
          <Text>
            {t('镜像仓库')}：{updateData.repository || '-'}
          </Text>
          <Text>
            {t('镜像版本')}：{updateData.tag_name || '-'}
          </Text>
          <Text>
            {t('最后更新')}：
            {getLastUpdatedString()}
          </Text>
        </Space>
      </Modal>
    </Row>
  );
};

export default OtherSetting;
