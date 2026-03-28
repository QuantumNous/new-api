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

import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Form,
  Modal,
  Space,
  Tag,
  Typography,
  Avatar,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconUser,
  IconCreditCard,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const EditGroupModal = (props) => {
  const { t, visible, onCancel, onSave, editingGroup, existingNames } = props;
  const isEdit = editingGroup !== null;
  const [loading, setLoading] = useState(false);
  const formApiRef = useRef(null);

  const getInitValues = () => ({
    name: '',
    description: '',
    ratio: 1,
  });

  useEffect(() => {
    if (formApiRef.current) {
      if (isEdit) {
        formApiRef.current.setValues({
          name: editingGroup.name,
          description: editingGroup.description || '',
          ratio: editingGroup.ratio,
        });
      } else {
        formApiRef.current.setValues(getInitValues());
      }
    }
  }, [editingGroup, visible]);

  const handleSubmit = async (values) => {
    setLoading(true);

    const groupName = values.name.trim().toLowerCase();
    const description = values.description.trim();
    const ratio = parseFloat(values.ratio);

    if (!groupName) {
      setLoading(false);
      return;
    }

    if (!isEdit && existingNames.includes(groupName)) {
      Modal.error({
        title: t('分组名称已存在'),
        content: t('请使用其他名称'),
      });
      setLoading(false);
      return;
    }

    const success = onSave({
      name: groupName,
      description: description,
      ratio: ratio,
    });

    setLoading(false);
    if (success !== false) {
      formApiRef.current?.setValues(getInitValues());
    }
  };

  const handleCancel = () => {
    formApiRef.current?.setValues(getInitValues());
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          {isEdit ? (
            <Tag color="blue" shape="circle">
              {t('编辑')}
            </Tag>
          ) : (
            <Tag color="green" shape="circle">
              {t('新增')}
            </Tag>
          )}
          <Title heading={4} className="m-0">
            {isEdit ? t('编辑分组') : t('新增分组')}
          </Title>
        </Space>
      }
      visible={visible}
      onCancel={handleCancel}
      footer={null}
      width={500}
    >
      <Form
        initValues={getInitValues()}
        getFormApi={(api) => (formApiRef.current = api)}
        onSubmit={handleSubmit}
      >
        {({ values }) => (
          <div className="p-2">
            <div className="flex items-center mb-4">
              <Avatar size="small" color="blue" className="mr-2 shadow-md">
                <IconUser size={16} />
              </Avatar>
              <div>
                <Text className="text-lg font-medium">{t('分组信息')}</Text>
                <div className="text-xs text-gray-600">
                  {t('设置分组的基本信息和倍率')}
                </div>
              </div>
            </div>

            <Row gutter={12}>
              <Col span={24}>
                <Form.Input
                  field="name"
                  label={t('分组名称')}
                  placeholder={t('请输入分组名称（英文）')}
                  style={{ width: '100%' }}
                  rules={[
                    { required: true, message: t('请输入分组名称') },
                    {
                      pattern: /^[a-zA-Z0-9_-]+$/,
                      message: t('分组名称只能包含字母、数字、下划线和连字符'),
                    },
                  ]}
                  disabled={isEdit}
                  showClear
                />
              </Col>
              <Col span={24}>
                <Form.Input
                  field="description"
                  label={t('分组描述')}
                  placeholder={t('请输入分组描述（可选）')}
                  style={{ width: '100%' }}
                  showClear
                />
              </Col>
              <Col span={24}>
                <Form.InputNumber
                  field="ratio"
                  label={t('倍率')}
                  placeholder={t('请输入倍率')}
                  style={{ width: '100%' }}
                  min={0}
                  step={0.1}
                  precision={2}
                  rules={[{ required: true, message: t('请输入倍率') }]}
                  extraText={t(
                    '倍率用于调整该分组用户的计费比例，1为标准倍率，小于1为优惠，大于1为加价',
                  )}
                />
              </Col>
            </Row>

            <div className="flex justify-end mt-6">
              <Space>
                <Button
                  theme="light"
                  type="primary"
                  onClick={handleCancel}
                  icon={<IconClose />}
                >
                  {t('取消')}
                </Button>
                <Button
                  theme="solid"
                  onClick={() => formApiRef.current?.submitForm()}
                  icon={<IconSave />}
                  loading={loading}
                >
                  {t('保存')}
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default EditGroupModal;
