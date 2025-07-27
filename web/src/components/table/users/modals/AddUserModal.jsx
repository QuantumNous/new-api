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

import React, { useState, useRef } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile.js';
import {
  Button,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Form,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconUserAdd,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const AddUserModal = (props) => {
  const { t } = useTranslation();
  const formApiRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const getInitValues = () => ({
    username: '',
    display_name: '',
    password: '',
    remark: '',
  });

  const submit = async (values) => {
    setLoading(true);
    const res = await API.post(`/api/user/`, values);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('用户账户创建成功！'));
      formApiRef.current?.setValues(getInitValues());
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
        bodyStyle={{ padding: '0' }}
        visible={props.visible}
        width={isMobile ? '100%' : 600}
        footer={
          <div className="flex justify-end bg-white">
            <Space>
              <Button
                theme="solid"
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme="light"
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
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => formApiRef.current = api}
            onSubmit={submit}
            onSubmitFail={(errs) => {
              const first = Object.values(errs)[0];
              if (first) showError(Array.isArray(first) ? first[0] : first);
              formApiRef.current?.scrollToError();
            }}
          >
            <div className="p-2">
              <Card className="!rounded-2xl shadow-sm border-0">
                <div className="flex items-center mb-2">
                  <Avatar size="small" color="blue" className="mr-2 shadow-md">
                    <IconUserAdd size={16} />
                  </Avatar>
                  <div>
                    <Text className="text-lg font-medium">{t('用户信息')}</Text>
                    <div className="text-xs text-gray-600">{t('创建新用户账户')}</div>
                  </div>
                </div>

                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='username'
                      label={t('用户名')}
                      placeholder={t('请输入用户名')}
                      rules={[{ required: true, message: t('请输入用户名') }]}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Input
                      field='display_name'
                      label={t('显示名称')}
                      placeholder={t('请输入显示名称')}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Input
                      field='password'
                      label={t('密码')}
                      type='password'
                      placeholder={t('请输入密码')}
                      rules={[{ required: true, message: t('请输入密码') }]}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Input
                      field='remark'
                      label={t('备注')}
                      placeholder={t('请输入备注（仅管理员可见）')}
                      showClear
                    />
                  </Col>
                </Row>
              </Card>
            </div>
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default AddUserModal; 