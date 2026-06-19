import React, { useEffect, useState, useRef } from 'react';
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';

// 金额一律以「分」整数与后端交互（docs/enterprise-features-design.md D1）。
// 元 → 分按字符串拆段解析，禁止浮点乘法（1234.56*100 === 123455.99999...）。
// 整数部分限 10 位（≤99 亿元），避免超长输入越过 Number.MAX_SAFE_INTEGER 丢精度。
export function yuanStringToFen(str) {
  const s = String(str ?? '').trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10);
}

export function fenToYuanString(fen) {
  const n = parseInt(fen, 10);
  if (!Number.isFinite(n) || n <= 0) return '';
  const whole = Math.trunc(n / 100);
  const frac = String(n % 100).padStart(2, '0');
  return frac === '00' ? String(whole) : `${whole}.${frac}`;
}

export default function SettingsPaymentBankTransfer(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    BankTransferEnabled: false,
    BankTransferCompanyName: '',
    BankTransferPayeeName: '',
    BankTransferAccountNumber: '',
    BankTransferBankName: '',
    BankTransferMinAmount: '', // 展示用元，保存时转分
    BankTransferTips: '',
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        BankTransferEnabled: props.options.BankTransferEnabled || false,
        BankTransferCompanyName: props.options.BankTransferCompanyName || '',
        BankTransferPayeeName: props.options.BankTransferPayeeName || '',
        BankTransferAccountNumber:
          props.options.BankTransferAccountNumber || '',
        BankTransferBankName: props.options.BankTransferBankName || '',
        BankTransferMinAmount: fenToYuanString(
          props.options.BankTransferMinAmountFen,
        ),
        BankTransferTips: props.options.BankTransferTips || '',
      };
      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitBankTransferSettings = async () => {
    const minAmount = String(inputs.BankTransferMinAmount ?? '').trim();
    let minAmountFen = 0;
    if (minAmount !== '') {
      const fen = yuanStringToFen(minAmount);
      if (fen === null) {
        showError(t('最低转账金额格式无效，最多两位小数'));
        return;
      }
      minAmountFen = fen;
    }
    if (inputs.BankTransferEnabled) {
      if (
        !inputs.BankTransferCompanyName.trim() ||
        !inputs.BankTransferPayeeName.trim() ||
        !inputs.BankTransferAccountNumber.trim() ||
        !inputs.BankTransferBankName.trim()
      ) {
        showError(t('启用对公转账前请填写完整的收款信息'));
        return;
      }
    }

    setLoading(true);
    try {
      const fieldMap = [
        [
          'BankTransferEnabled',
          'bank_transfer_setting.enabled',
          (v) => String(v),
        ],
        [
          'BankTransferCompanyName',
          'bank_transfer_setting.company_name',
          (v) => v.trim(),
        ],
        [
          'BankTransferPayeeName',
          'bank_transfer_setting.payee_name',
          (v) => v.trim(),
        ],
        [
          'BankTransferAccountNumber',
          'bank_transfer_setting.account_number',
          (v) => v.trim(),
        ],
        [
          'BankTransferBankName',
          'bank_transfer_setting.bank_name',
          (v) => v.trim(),
        ],
        [
          'BankTransferMinAmount',
          'bank_transfer_setting.min_amount_fen',
          () => String(minAmountFen),
        ],
        ['BankTransferTips', 'bank_transfer_setting.tips', (v) => v],
      ];
      const options = [];
      for (const [field, key, transform] of fieldMap) {
        if (originInputs[field] !== inputs[field]) {
          options.push({ key, value: transform(inputs[field]) });
        }
      }
      if (options.length === 0) {
        showSuccess(t('未发生改动'));
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        options.map((option) =>
          API.put('/api/option/', { key: option.key, value: option.value }),
        ),
      );
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length === 0) {
        showSuccess(t('更新成功'));
        setOriginInputs({ ...inputs });
        props.refresh && props.refresh();
      } else {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section
          text={props.hideSectionTitle ? undefined : t('对公转账设置')}
        >
          <Banner
            type='info'
            icon={<Landmark size={16} />}
            description={t(
              '对公转账仅对已通过企业认证的用户展示。用户线下转账后上传回执，由管理员在「对公转账」审核页人工核对入账。',
            )}
            style={{ marginBottom: 16 }}
          />
          <Form.Switch field='BankTransferEnabled' label={t('启用对公转账')} />
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='BankTransferCompanyName'
                label={t('公司名称')}
                placeholder={t('营业执照上的公司全称')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='BankTransferPayeeName'
                label={t('收款单位')}
                placeholder={t('银行账户的开户名称')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='BankTransferAccountNumber'
                label={t('收款账号')}
                placeholder={t('对公银行账号')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='BankTransferBankName'
                label={t('开户行')}
                placeholder={t('开户银行全称（含支行）')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='BankTransferMinAmount'
                label={t('最低单笔转账金额（元）')}
                placeholder={t('留空或 0 表示不限')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='BankTransferTips'
                label={t('附加说明')}
                placeholder={t('例如：转账时请备注注册邮箱')}
              />
            </Col>
          </Row>
          <Button
            onClick={submitBankTransferSettings}
            style={{ marginTop: 16 }}
          >
            {t('保存对公转账设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
