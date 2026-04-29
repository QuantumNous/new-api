import React, { useState } from 'react';
import {
  Form,
  Button,
  Typography,
  Spin,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';

const CommissionManualIssue = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/commission/issue', {
        user_id: parseInt(values.user_id) || 0,
        inviter_id: parseInt(values.inviter_id),
        amount: Math.round(values.amount * 100), // yuan to fen
        remark: values.remark || '',
      });
      if (res.data?.success) {
        showSuccess(res.data.message || t('手动发放成功'));
      } else {
        showError(res.data?.message || t('手动发放失败'));
      }
    } catch (e) {
      showError(t('手动发放失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 16 }}>
        {t('手动向指定用户发放佣金，金额将直接计入用户的可提现余额')}
      </Typography.Text>
      <Form
        onSubmit={handleSubmit}
        labelPosition='left'
        labelWidth={120}
        style={{ maxWidth: 500 }}
      >
      <Form.InputNumber
          field='inviter_id'
          label={t('佣金接收用户ID')}
          placeholder={t('请输入佣金接收用户ID（邀请人）')}
          min={1}
          step={1}
          rules={[{ required: true, message: t('请输入佣金接收用户ID') }]}
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field='user_id'
          label={t('来源用户ID')}
          placeholder={t('请输入来源用户ID（被邀请人，可选）')}
          min={0}
          step={1}
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field='amount'
          label={t('金额（元）')}
          placeholder={t('请输入发放金额')}
          min={0.01}
          precision={2}
          step={1}
          rules={[{ required: true, message: t('请输入发放金额') }]}
          style={{ width: '100%' }}
        />
        <Form.Input
          field='remark'
          label={t('备注')}
          placeholder={t('请输入备注信息')}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: 16 }}>
          <Button
            theme='solid'
            type='primary'
            htmlType='submit'
            loading={loading}
          >
            {t('确认发放')}
          </Button>
        </div>
      </Form>
    </Spin>
  );
};

export default CommissionManualIssue;
