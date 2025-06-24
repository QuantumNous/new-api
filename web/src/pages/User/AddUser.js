import React, { useState } from 'react';
import { API, isMobile, showError, showSuccess } from '../../helpers';
import {
  Button,
  Input,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconSave,
  IconClose,
  IconKey,
  IconUserAdd,
  IconEdit,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const AddUser = (props) => {
  const { t } = useTranslation();
  const originInputs = {
    username: '',
    display_name: '',
    password: '',
    remark: '',
  };
  const [inputs, setInputs] = useState(originInputs);
  const [loading, setLoading] = useState(false);
  const { username, display_name, password, remark } = inputs;

  const handleInputChange = (name, value) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const submit = async () => {
    setLoading(true);
    if (inputs.username === '' || inputs.password === '') {
      setLoading(false);
      showError(t('用户名和密码不能为空！'));
      return;
    }
    const res = await API.post(`/api/user/`, inputs);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('用户账户创建成功！'));
      setInputs(originInputs);
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handleCancel = () => {
    props.handleClose();
  };

  return (
    <>
      <SideSheet
        placement={'left'}
        title={
          <Space>
            <Tag color="green" shape="circle">{t('新建')}</Tag>
            <Title heading={4} className="m-0">
              {t('添加用户')}
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
            <Card className="!rounded-2xl shadow-sm border-0">
              <div className="flex items-center mb-4 p-6 rounded-xl" style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
                position: 'relative'
              }}>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                  <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                  <IconUserAdd size="large" style={{ color: '#ffffff' }} />
                </div>
                <div className="relative">
                  <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('用户信息')}</Text>
                  <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('创建新用户账户')}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">{t('用户名')}</Text>
                  <Input
                    placeholder={t('请输入用户名')}
                    onChange={(value) => handleInputChange('username', value)}
                    value={username}
                    autoComplete="off"
                    size="large"
                    className="!rounded-lg"
                    prefix={<IconUser />}
                    showClear
                    required
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('显示名称')}</Text>
                  <Input
                    placeholder={t('请输入显示名称')}
                    onChange={(value) => handleInputChange('display_name', value)}
                    value={display_name}
                    autoComplete="off"
                    size="large"
                    className="!rounded-lg"
                    prefix={<IconUser />}
                    showClear
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('密码')}</Text>
                  <Input
                    type="password"
                    placeholder={t('请输入密码')}
                    onChange={(value) => handleInputChange('password', value)}
                    value={password}
                    autoComplete="off"
                    size="large"
                    className="!rounded-lg"
                    prefix={<IconKey />}
                    required
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
          </div>
        </Spin>
      </SideSheet>
    </>
  );
};

export default AddUser;
