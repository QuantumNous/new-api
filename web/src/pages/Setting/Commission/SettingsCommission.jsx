import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Col,
  Form,
  Row,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsCommission(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    CommissionEnabled: false,
    CommissionTopUpRatio1: 0,
    CommissionTopUpRatio2: 0,
    CommissionTopUpRatio3: 0,
    CommissionHighValueThreshold: 0,
    CommissionHighValueBonus: 0,
    CommissionMinWithdraw: 10,
    CommissionNotice: '',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (item.key === 'CommissionHighValueBonus') {
        // 元→分存储
        value = String(Math.round(inputs[item.key] * 100));
      } else if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = String(inputs[item.key]);
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    // 分→元展示
    if (currentInputs['CommissionHighValueBonus'] !== undefined) {
      currentInputs['CommissionHighValueBonus'] = currentInputs['CommissionHighValueBonus'] / 100;
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('返佣设置')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field={'CommissionEnabled'}
                label={t('启用返佣系统')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('CommissionEnabled')}
              />
            </Col>
          </Row>

          <div style={{ display: inputs.CommissionEnabled ? 'block' : 'none' }}>
              <Typography.Title heading={6} style={{ margin: '16px 0 8px' }}>
                {t('邀请充值返佣')}
              </Typography.Title>
              <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
                {t('被邀请用户注册后30天内，前3次充值分别按以下比例返佣给邀请人')}
              </Typography.Text>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    field={'CommissionTopUpRatio1'}
                    label={t('第1次充值返佣比例 (%)')}
                    min={0}
                    max={100}
                    step={0.1}
                    precision={1}
                    placeholder='0'
                    onChange={handleFieldChange('CommissionTopUpRatio1')}
                  />
                </Col>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    field={'CommissionTopUpRatio2'}
                    label={t('第2次充值返佣比例 (%)')}
                    min={0}
                    max={100}
                    step={0.1}
                    precision={1}
                    placeholder='0'
                    onChange={handleFieldChange('CommissionTopUpRatio2')}
                  />
                </Col>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    field={'CommissionTopUpRatio3'}
                    label={t('第3次充值返佣比例 (%)')}
                    min={0}
                    max={100}
                    step={0.1}
                    precision={1}
                    placeholder='0'
                    onChange={handleFieldChange('CommissionTopUpRatio3')}
                  />
                </Col>
              </Row>

              <Typography.Title heading={6} style={{ margin: '16px 0 8px' }}>
                {t('高价值用户奖励')}
              </Typography.Title>
              <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
                {t('被邀请用户注册后90天内累计充值达到门槛，邀请人获得一次性奖励')}
              </Typography.Text>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    field={'CommissionHighValueThreshold'}
                    label={t('累计充值门槛（元）')}
                    min={0}
                    step={1}
                    placeholder='0'
                    extraText={t('设为 0 表示禁用高价值奖励')}
                    onChange={handleFieldChange('CommissionHighValueThreshold')}
                  />
                </Col>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    field={'CommissionHighValueBonus'}
                    label={t('奖励金额（元）')}
                    min={0}
                    step={1}
                    precision={2}
                    placeholder='0'
                    onChange={handleFieldChange('CommissionHighValueBonus')}
                  />
                </Col>
              </Row>

              <Typography.Title heading={6} style={{ margin: '16px 0 8px' }}>
                {t('提现设置')}
              </Typography.Title>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                  <Form.InputNumber
                    field={'CommissionMinWithdraw'}
                    label={t('最低提现金额（元）')}
                    min={1}
                    step={1}
                    placeholder='10'
                    onChange={handleFieldChange('CommissionMinWithdraw')}
                  />
                </Col>
              </Row>

              <Typography.Title heading={6} style={{ margin: '16px 0 8px' }}>
                {t('返佣公告')}
              </Typography.Title>
              <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
                {t('在返佣管理页面顶部展示的公告内容，支持 HTML 和 Markdown')}
              </Typography.Text>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.TextArea
                    field={'CommissionNotice'}
                    label={t('公告内容')}
                    placeholder={t('请输入返佣公告内容，支持 HTML 和 Markdown')}
                    autosize={{ minRows: 3, maxRows: 10 }}
                    onChange={handleFieldChange('CommissionNotice')}
                  />
                </Col>
              </Row>
          </div>

          <Row style={{ marginTop: 16 }}>
            <Button size='default' onClick={onSubmit}>
              {t('保存返佣设置')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
