import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, isMobile, showError, showSuccess, renderQuota, renderQuotaWithPrompt } from '../../helpers';
import {
  Button,
  Input,
  Modal,
  Select,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconSave,
  IconClose,
  IconKey,
  IconCreditCard,
  IconLink,
  IconUserGroup,
  IconPlus,
  IconEdit,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const EditUser = (props) => {
  const userId = props.editingUser.id;
  const [loading, setLoading] = useState(true);
  const [addQuotaModalOpen, setIsModalOpen] = useState(false);
  const [addQuotaLocal, setAddQuotaLocal] = useState('');
  const [inputs, setInputs] = useState({
    username: '',
    display_name: '',
    password: '',
    github_id: '',
    oidc_id: '',
    wechat_id: '',
    email: '',
    quota: 0,
    group: 'default',
    remark: '',
  });
  const [groupOptions, setGroupOptions] = useState([]);
  const {
    username,
    display_name,
    password,
    github_id,
    oidc_id,
    wechat_id,
    telegram_id,
    email,
    quota,
    group,
    remark,
  } = inputs;
  const handleInputChange = (name, value) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };
  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };
  const navigate = useNavigate();
  const handleCancel = () => {
    props.handleClose();
  };
  const loadUser = async () => {
    setLoading(true);
    let res = undefined;
    if (userId) {
      res = await API.get(`/api/user/${userId}`);
    } else {
      res = await API.get(`/api/user/self`);
    }
    const { success, message, data } = res.data;
    if (success) {
      data.password = '';
      setInputs(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser().then();
    if (userId) {
      fetchGroups().then();
    }
  }, [props.editingUser.id]);

  const submit = async () => {
    setLoading(true);
    let res = undefined;
    if (userId) {
      let data = { ...inputs, id: parseInt(userId) };
      if (typeof data.quota === 'string') {
        data.quota = parseInt(data.quota);
      }
      res = await API.put(`/api/user/`, data);
    } else {
      res = await API.put(`/api/user/self`, inputs);
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess('用户信息更新成功！');
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const addLocalQuota = () => {
    let newQuota = parseInt(quota) + parseInt(addQuotaLocal);
    setInputs((inputs) => ({ ...inputs, quota: newQuota }));
  };

  const openAddQuotaModal = () => {
    setAddQuotaLocal('0');
    setIsModalOpen(true);
  };

  const { t } = useTranslation();

  return (
    <>
      <SideSheet
        placement={'right'}
        title={
          <Space>
            <Tag color="blue" shape="circle">{t('编辑')}</Tag>
            <Title heading={4} className="m-0">
              {t('编辑用户')}
            </Title>
          </Space>
        }
        headerStyle={{
          borderBottom: '1px solid var(--semi-color-border)',
          padding: '24px'
        }}
        bodyStyle={{
          backgroundColor: 'var(--semi-color-bg-0)',
          padding: '0'
        }}
        visible={props.visible}
        width={isMobile() ? '100%' : 600}
        footer={
          <div className="flex justify-end bg-white">
            <Space>
              <Button
                theme="solid"
                size="large"
                className="!rounded-full"
                onClick={submit}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme="light"
                size="large"
                className="!rounded-full"
                type="primary"
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={() => handleCancel()}
      >
        <Spin spinning={loading}>
          <div className="p-6">
            <Card className="!rounded-2xl shadow-sm border-0 mb-6">
              <div className="flex items-center mb-4 p-6 rounded-xl" style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
                position: 'relative'
              }}>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                  <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                  <IconUser size="large" style={{ color: '#ffffff' }} />
                </div>
                <div className="relative">
                  <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('基本信息')}</Text>
                  <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('用户的基本账户信息')}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">{t('用户名')}</Text>
                  <Input
                    placeholder={t('请输入新的用户名')}
                    onChange={(value) => handleInputChange('username', value)}
                    value={username}
                    autoComplete="new-password"
                    size="large"
                    className="!rounded-lg"
                    showClear
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('密码')}</Text>
                  <Input
                    type="password"
                    placeholder={t('请输入新的密码，最短 8 位')}
                    onChange={(value) => handleInputChange('password', value)}
                    value={password}
                    autoComplete="new-password"
                    size="large"
                    className="!rounded-lg"
                    prefix={<IconKey />}
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('显示名称')}</Text>
                  <Input
                    placeholder={t('请输入新的显示名称')}
                    onChange={(value) => handleInputChange('display_name', value)}
                    value={display_name}
                    autoComplete="new-password"
                    size="large"
                    className="!rounded-lg"
                    showClear
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('备注')}</Text>
                  <Input
                    placeholder={t('请输入备注（仅管理员可见）')}
                    onChange={(value) => handleInputChange('remark', value)}
                    value={remark}
                    autoComplete="off"
                    size="large"
                    className="!rounded-lg"
                    prefix={<IconEdit />}
                    showClear
                  />
                </div>
              </div>
            </Card>

            {userId && (
              <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                <div className="flex items-center mb-4 p-6 rounded-xl" style={{
                  background: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)',
                  position: 'relative'
                }}>
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                    <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                    <IconUserGroup size="large" style={{ color: '#ffffff' }} />
                  </div>
                  <div className="relative">
                    <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('权限设置')}</Text>
                    <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('用户分组和额度管理')}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Text strong className="block mb-2">{t('分组')}</Text>
                    <Select
                      placeholder={t('请选择分组')}
                      search
                      allowAdditions
                      additionLabel={t(
                        '请在系统设置页面编辑分组倍率以添加新的分组：',
                      )}
                      onChange={(value) => handleInputChange('group', value)}
                      value={inputs.group}
                      autoComplete="new-password"
                      optionList={groupOptions}
                      size="large"
                      className="w-full !rounded-lg"
                      prefix={<IconUserGroup />}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Text strong>{t('剩余额度')}</Text>
                      <Text type="tertiary">{renderQuotaWithPrompt(quota)}</Text>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t('请输入新的剩余额度')}
                        onChange={(value) => handleInputChange('quota', value)}
                        value={quota}
                        type="number"
                        autoComplete="new-password"
                        size="large"
                        className="flex-1 !rounded-lg"
                        prefix={<IconCreditCard />}
                      />
                      <Button
                        onClick={openAddQuotaModal}
                        size="large"
                        className="!rounded-lg"
                        icon={<IconPlus />}
                      >
                        {t('添加额度')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="!rounded-2xl shadow-sm border-0">
              <div className="flex items-center mb-4 p-6 rounded-xl" style={{
                background: 'linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)',
                position: 'relative'
              }}>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                  <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                  <IconLink size="large" style={{ color: '#ffffff' }} />
                </div>
                <div className="relative">
                  <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('绑定信息')}</Text>
                  <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('第三方账户绑定状态（只读）')}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">{t('已绑定的 GitHub 账户')}</Text>
                  <Input
                    value={github_id}
                    autoComplete="new-password"
                    placeholder={t(
                      '此项只读，需要用户通过个人设置页面的相关绑定按钮进行绑定，不可直接修改',
                    )}
                    readonly
                    size="large"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('已绑定的 OIDC 账户')}</Text>
                  <Input
                    value={oidc_id}
                    placeholder={t(
                      '此项只读，需要用户通过个人设置页面的相关绑定按钮进行绑定，不可直接修改',
                    )}
                    readonly
                    size="large"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('已绑定的微信账户')}</Text>
                  <Input
                    value={wechat_id}
                    autoComplete="new-password"
                    placeholder={t(
                      '此项只读，需要用户通过个人设置页面的相关绑定按钮进行绑定，不可直接修改',
                    )}
                    readonly
                    size="large"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('已绑定的邮箱账户')}</Text>
                  <Input
                    value={email}
                    autoComplete="new-password"
                    placeholder={t(
                      '此项只读，需要用户通过个人设置页面的相关绑定按钮进行绑定，不可直接修改',
                    )}
                    readonly
                    size="large"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('已绑定的 Telegram 账户')}</Text>
                  <Input
                    value={telegram_id}
                    autoComplete="new-password"
                    placeholder={t(
                      '此项只读，需要用户通过个人设置页面的相关绑定按钮进行绑定，不可直接修改',
                    )}
                    readonly
                    size="large"
                    className="!rounded-lg"
                  />
                </div>
              </div>
            </Card>
          </div>
        </Spin>
      </SideSheet>

      <Modal
        centered={true}
        visible={addQuotaModalOpen}
        onOk={() => {
          addLocalQuota();
          setIsModalOpen(false);
        }}
        onCancel={() => setIsModalOpen(false)}
        closable={null}
        title={
          <div className="flex items-center">
            <IconPlus className="mr-2" />
            {t('添加额度')}
          </div>
        }
      >
        <div className="mb-4">
          <Text type="secondary" className="block mb-2">
            {`${t('新额度')}${renderQuota(quota)} + ${renderQuota(addQuotaLocal)} = ${renderQuota(quota + parseInt(addQuotaLocal || 0))}`}
          </Text>
        </div>
        <Input
          placeholder={t('需要添加的额度（支持负数）')}
          onChange={(value) => {
            setAddQuotaLocal(value);
          }}
          value={addQuotaLocal}
          type="number"
          autoComplete="new-password"
          size="large"
          className="!rounded-lg"
          prefix={<IconCreditCard />}
        />
      </Modal>
    </>
  );
};

export default EditUser;
