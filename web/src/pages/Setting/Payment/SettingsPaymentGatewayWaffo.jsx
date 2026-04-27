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

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  Switch,
  useOverlayState,
} from '@heroui/react';
import { BookOpen, TriangleAlert } from 'lucide-react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';

const toBoolean = (value) => value === true || value === 'true';

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function InfoBanner({ tone = 'info', icon, children }) {
  const cls =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : 'border-primary/20 bg-primary/5';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border ${cls} px-3 py-2 text-sm text-foreground`}
    >
      {icon ? <span className='mt-0.5 shrink-0'>{icon}</span> : null}
      <div className='flex-1'>{children}</div>
    </div>
  );
}

function SectionHeader({ title }) {
  if (!title) return null;
  return (
    <div className='border-b border-border pb-2 text-base font-semibold text-foreground'>
      {title}
    </div>
  );
}

// Mirrors Semi `<Form.Switch checkedText='｜' uncheckedText='〇' label
// extraText>` row layout: title + description on the left, the switch
// on the right.
function SwitchRow({ label, hint, value, onChange }) {
  return (
    <div className='flex items-start justify-between gap-3'>
      <div className='space-y-1'>
        <div className='text-sm font-medium text-foreground'>{label}</div>
        {hint ? <div className='text-xs text-muted'>{hint}</div> : null}
      </div>
      <Switch
        isSelected={!!value}
        onValueChange={onChange}
        size='md'
        aria-label={label}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </div>
  );
}

const INITIAL_INPUTS = {
  WaffoEnabled: false,
  WaffoApiKey: '',
  WaffoPrivateKey: '',
  WaffoPublicCert: '',
  WaffoSandboxPublicCert: '',
  WaffoSandboxApiKey: '',
  WaffoSandboxPrivateKey: '',
  WaffoSandbox: false,
  WaffoMerchantId: '',
  WaffoCurrency: 'USD',
  WaffoUnitPrice: 1.0,
  WaffoMinTopUp: 1,
  WaffoNotifyUrl: '',
  WaffoReturnUrl: '',
};

export default function SettingsPaymentGatewayWaffo(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Waffo 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const iconFileInputRef = useRef(null);

  // Pay-methods table state
  const [waffoPayMethods, setWaffoPayMethods] = useState([]);
  const [payMethodModalVisible, setPayMethodModalVisible] = useState(false);
  const [editingPayMethodIndex, setEditingPayMethodIndex] = useState(-1);
  const [payMethodForm, setPayMethodForm] = useState({
    name: '',
    icon: '',
    payMethodType: '',
    payMethodName: '',
  });

  const payMethodModalState = useOverlayState({
    isOpen: payMethodModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) setPayMethodModalVisible(false);
    },
  });

  const setField = (key) => (value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleIconFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const MAX_ICON_SIZE = 100 * 1024; // 100 KB
    if (file.size > MAX_ICON_SIZE) {
      showError(t('图标文件不能超过 100KB，请压缩后重新上传'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPayMethodForm((prev) => ({ ...prev, icon: event.target.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (!props.options) return;
    const currentInputs = {
      WaffoEnabled: toBoolean(props.options.WaffoEnabled),
      WaffoApiKey: props.options.WaffoApiKey || '',
      WaffoPrivateKey: props.options.WaffoPrivateKey || '',
      WaffoPublicCert: props.options.WaffoPublicCert || '',
      WaffoSandboxPublicCert: props.options.WaffoSandboxPublicCert || '',
      WaffoSandboxApiKey: props.options.WaffoSandboxApiKey || '',
      WaffoSandboxPrivateKey: props.options.WaffoSandboxPrivateKey || '',
      WaffoSandbox: toBoolean(props.options.WaffoSandbox),
      WaffoMerchantId: props.options.WaffoMerchantId || '',
      WaffoCurrency: props.options.WaffoCurrency || 'USD',
      WaffoUnitPrice: parseFloat(props.options.WaffoUnitPrice) || 1.0,
      WaffoMinTopUp: parseInt(props.options.WaffoMinTopUp) || 1,
      WaffoNotifyUrl: props.options.WaffoNotifyUrl || '',
      WaffoReturnUrl: props.options.WaffoReturnUrl || '',
    };
    setInputs(currentInputs);

    try {
      const rawPayMethods = props.options.WaffoPayMethods;
      if (rawPayMethods) {
        const parsed = JSON.parse(rawPayMethods);
        if (Array.isArray(parsed)) {
          setWaffoPayMethods(parsed);
        }
      }
    } catch {
      setWaffoPayMethods([]);
    }
  }, [props.options]);

  const submitWaffoSetting = async () => {
    setLoading(true);
    try {
      const options = [];
      options.push({
        key: 'WaffoEnabled',
        value: inputs.WaffoEnabled ? 'true' : 'false',
      });
      if (inputs.WaffoApiKey && inputs.WaffoApiKey !== '') {
        options.push({ key: 'WaffoApiKey', value: inputs.WaffoApiKey });
      }
      if (inputs.WaffoPrivateKey && inputs.WaffoPrivateKey !== '') {
        options.push({
          key: 'WaffoPrivateKey',
          value: inputs.WaffoPrivateKey,
        });
      }
      options.push({
        key: 'WaffoPublicCert',
        value: inputs.WaffoPublicCert || '',
      });
      options.push({
        key: 'WaffoSandboxPublicCert',
        value: inputs.WaffoSandboxPublicCert || '',
      });
      if (inputs.WaffoSandboxApiKey && inputs.WaffoSandboxApiKey !== '') {
        options.push({
          key: 'WaffoSandboxApiKey',
          value: inputs.WaffoSandboxApiKey,
        });
      }
      if (
        inputs.WaffoSandboxPrivateKey &&
        inputs.WaffoSandboxPrivateKey !== ''
      ) {
        options.push({
          key: 'WaffoSandboxPrivateKey',
          value: inputs.WaffoSandboxPrivateKey,
        });
      }
      options.push({
        key: 'WaffoSandbox',
        value: inputs.WaffoSandbox ? 'true' : 'false',
      });
      options.push({
        key: 'WaffoMerchantId',
        value: inputs.WaffoMerchantId || '',
      });
      options.push({
        key: 'WaffoCurrency',
        value: inputs.WaffoCurrency || '',
      });
      options.push({
        key: 'WaffoUnitPrice',
        value: String(inputs.WaffoUnitPrice || 1.0),
      });
      options.push({
        key: 'WaffoMinTopUp',
        value: String(inputs.WaffoMinTopUp || 1),
      });
      options.push({
        key: 'WaffoNotifyUrl',
        value: inputs.WaffoNotifyUrl || '',
      });
      options.push({
        key: 'WaffoReturnUrl',
        value: inputs.WaffoReturnUrl || '',
      });
      options.push({
        key: 'WaffoPayMethods',
        value: JSON.stringify(waffoPayMethods),
      });

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', { key: opt.key, value: opt.value }),
      );
      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  const openAddPayMethodModal = () => {
    setEditingPayMethodIndex(-1);
    setPayMethodForm({
      name: '',
      icon: '',
      payMethodType: '',
      payMethodName: '',
    });
    setPayMethodModalVisible(true);
  };

  const openEditPayMethodModal = (record, index) => {
    setEditingPayMethodIndex(index);
    setPayMethodForm({
      name: record.name || '',
      icon: record.icon || '',
      payMethodType: record.payMethodType || '',
      payMethodName: record.payMethodName || '',
    });
    setPayMethodModalVisible(true);
  };

  const handlePayMethodModalOk = () => {
    if (!payMethodForm.name || payMethodForm.name.trim() === '') {
      showError(t('支付方式名称不能为空'));
      return;
    }
    const newMethod = {
      name: payMethodForm.name.trim(),
      icon: payMethodForm.icon.trim(),
      payMethodType: payMethodForm.payMethodType.trim(),
      payMethodName: payMethodForm.payMethodName.trim(),
    };
    if (editingPayMethodIndex === -1) {
      setWaffoPayMethods([...waffoPayMethods, newMethod]);
    } else {
      const updated = [...waffoPayMethods];
      updated[editingPayMethodIndex] = newMethod;
      setWaffoPayMethods(updated);
    }
    setPayMethodModalVisible(false);
  };

  const handleDeletePayMethod = (index) => {
    setWaffoPayMethods(waffoPayMethods.filter((_, i) => i !== index));
  };

  const dashSpan = <span className='text-muted'>—</span>;

  return (
    <div className='relative space-y-6'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
          <Spinner color='primary' />
        </div>
      )}

      <div className='space-y-4'>
        <SectionHeader title={sectionTitle} />

        <InfoBanner icon={<BookOpen size={16} className='text-primary' />}>
          Waffo 密钥、商户和支付方式等设置请
          <a
            href='https://waffo.com'
            target='_blank'
            rel='noreferrer'
            className='text-primary underline-offset-2 hover:underline'
          >
            点击此处
          </a>
          进行配置，切换沙盒模式时请同步填写对应环境的密钥。
          <br />
          {t('回调地址')}：
          {props.options?.ServerAddress
            ? removeTrailingSlash(props.options.ServerAddress)
            : t('网站地址')}
          /api/waffo/webhook
        </InfoBanner>

        <InfoBanner
          tone='warning'
          icon={<TriangleAlert size={16} className='text-warning' />}
        >
          {t('请确认商户和所选环境密钥一致。')}
        </InfoBanner>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <SwitchRow
            label={t('启用 Waffo')}
            value={inputs.WaffoEnabled}
            onChange={setField('WaffoEnabled')}
          />
          <SwitchRow
            label={t('沙盒模式')}
            hint={t('用于切换当前下单和回调校验所使用的环境')}
            value={inputs.WaffoSandbox}
            onChange={setField('WaffoSandbox')}
          />
          <div className='space-y-2'>
            <FieldLabel>{t('商户 ID')}</FieldLabel>
            <input
              type='text'
              value={inputs.WaffoMerchantId}
              onChange={(event) =>
                setField('WaffoMerchantId')(event.target.value)
              }
              placeholder={t('例如：MER_xxx')}
              className={inputClass}
            />
            <FieldHint>{t('当前环境共用同一商户 ID')}</FieldHint>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='space-y-2'>
            <FieldLabel>{t('API 密钥（生产环境）')}</FieldLabel>
            <input
              type='password'
              value={inputs.WaffoApiKey}
              onChange={(event) => setField('WaffoApiKey')(event.target.value)}
              placeholder={t(
                '填写后覆盖当前生产环境 API 密钥，留空表示保持当前不变',
              )}
              className={inputClass}
            />
            <FieldHint>
              {t('保存后不会回显，请填写生产环境对应的 API 密钥')}
            </FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('API 私钥（生产环境）')}</FieldLabel>
            <textarea
              rows={4}
              value={inputs.WaffoPrivateKey}
              onChange={(event) =>
                setField('WaffoPrivateKey')(event.target.value)
              }
              placeholder={t(
                '填写后覆盖当前生产环境私钥，留空表示保持当前不变',
              )}
              className={textareaClass}
            />
            <FieldHint>
              {t('保存后不会回显，请填写生产环境对应的 API 私钥')}
            </FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('Waffo 公钥（生产环境）')}</FieldLabel>
            <textarea
              rows={4}
              value={inputs.WaffoPublicCert}
              onChange={(event) =>
                setField('WaffoPublicCert')(event.target.value)
              }
              placeholder={t(
                '填写生产环境 Waffo 公钥，Base64 或 PEM 内容均可',
              )}
              className={textareaClass}
            />
            <FieldHint>{t('用于校验生产环境的 Waffo 回调签名')}</FieldHint>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='space-y-2'>
            <FieldLabel>{t('API 密钥（测试环境）')}</FieldLabel>
            <input
              type='password'
              value={inputs.WaffoSandboxApiKey}
              onChange={(event) =>
                setField('WaffoSandboxApiKey')(event.target.value)
              }
              placeholder={t(
                '填写后覆盖当前测试环境 API 密钥，留空表示保持当前不变',
              )}
              className={inputClass}
            />
            <FieldHint>
              {t('保存后不会回显，请填写测试环境对应的 API 密钥')}
            </FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('API 私钥（测试环境）')}</FieldLabel>
            <textarea
              rows={4}
              value={inputs.WaffoSandboxPrivateKey}
              onChange={(event) =>
                setField('WaffoSandboxPrivateKey')(event.target.value)
              }
              placeholder={t(
                '填写后覆盖当前测试环境私钥，留空表示保持当前不变',
              )}
              className={textareaClass}
            />
            <FieldHint>
              {t('保存后不会回显，请填写测试环境对应的 API 私钥')}
            </FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('Waffo 公钥（测试环境）')}</FieldLabel>
            <textarea
              rows={4}
              value={inputs.WaffoSandboxPublicCert}
              onChange={(event) =>
                setField('WaffoSandboxPublicCert')(event.target.value)
              }
              placeholder={t(
                '填写测试环境 Waffo 公钥，Base64 或 PEM 内容均可',
              )}
              className={textareaClass}
            />
            <FieldHint>{t('用于校验测试环境的 Waffo 回调签名')}</FieldHint>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='space-y-2'>
            <FieldLabel>{t('货币')}</FieldLabel>
            <input
              type='text'
              value={inputs.WaffoCurrency}
              disabled
              placeholder='USD'
              className={inputClass}
            />
            <FieldHint>{t('Waffo 当前使用 USD 结算')}</FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('充值价格（x元/美金）')}</FieldLabel>
            <input
              type='number'
              step='0.01'
              min={0}
              value={inputs.WaffoUnitPrice}
              onChange={(event) => {
                const raw = event.target.value;
                setField('WaffoUnitPrice')(raw === '' ? '' : Number(raw));
              }}
              placeholder={t('例如：7，就是7元/美金')}
              className={inputClass}
            />
            <FieldHint>{t('按 1 美元对应的站内价格填写')}</FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('最低充值美元数量')}</FieldLabel>
            <input
              type='number'
              min={1}
              value={inputs.WaffoMinTopUp}
              onChange={(event) => {
                const raw = event.target.value;
                setField('WaffoMinTopUp')(raw === '' ? '' : Number(raw));
              }}
              placeholder={t('例如：2，就是最低充值2$')}
              className={inputClass}
            />
            <FieldHint>{t('用户单次最少可充值的美元数量')}</FieldHint>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <FieldLabel>{t('回调地址')}</FieldLabel>
            <input
              type='text'
              value={inputs.WaffoNotifyUrl}
              onChange={(event) =>
                setField('WaffoNotifyUrl')(event.target.value)
              }
              placeholder={t(
                '例如：https://example.com/api/waffo/webhook',
              )}
              className={inputClass}
            />
            <FieldHint>{t('留空则自动使用当前站点的默认回调地址')}</FieldHint>
          </div>
          <div className='space-y-2'>
            <FieldLabel>{t('支付返回地址')}</FieldLabel>
            <input
              type='text'
              value={inputs.WaffoReturnUrl}
              onChange={(event) =>
                setField('WaffoReturnUrl')(event.target.value)
              }
              placeholder={t('例如：https://example.com/console/topup')}
              className={inputClass}
            />
            <FieldHint>
              {t('留空则自动使用当前站点的默认充值页地址')}
            </FieldHint>
          </div>
        </div>
      </div>

      <div className='space-y-3'>
        <SectionHeader title={t('支付方式设置')} />

        <div className='text-sm text-muted'>
          {t(
            '这里配置 Waffo 下展示给用户的 Card、Apple Pay、Google Pay 等子支付方式。',
          )}
        </div>

        <div>
          <Button onPress={openAddPayMethodModal}>
            {t('新增支付方式')}
          </Button>
        </div>

        <div className='overflow-x-auto rounded-xl border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
              <tr>
                <th className='px-4 py-2 text-left font-medium'>
                  {t('显示名称')}
                </th>
                <th className='px-4 py-2 text-left font-medium'>
                  {t('图标')}
                </th>
                <th className='px-4 py-2 text-left font-medium'>
                  {t('支付方式类型')}
                </th>
                <th className='px-4 py-2 text-left font-medium'>
                  {t('支付方式名称')}
                </th>
                <th className='w-[180px] px-4 py-2 text-left font-medium'>
                  {t('操作')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {waffoPayMethods.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className='px-4 py-8 text-center text-sm text-muted'
                  >
                    {t('暂无支付方式，点击上方按钮新增')}
                  </td>
                </tr>
              ) : (
                waffoPayMethods.map((record, index) => (
                  <tr
                    key={index}
                    className='bg-background hover:bg-surface-secondary/60'
                  >
                    <td className='px-4 py-3 align-middle text-foreground'>
                      {record.name || dashSpan}
                    </td>
                    <td className='px-4 py-3 align-middle'>
                      {record.icon ? (
                        <img
                          src={record.icon}
                          alt='icon'
                          className='h-6 w-6 object-contain'
                        />
                      ) : (
                        dashSpan
                      )}
                    </td>
                    <td className='px-4 py-3 align-middle text-foreground'>
                      {record.payMethodType || dashSpan}
                    </td>
                    <td className='px-4 py-3 align-middle text-foreground'>
                      {record.payMethodName || dashSpan}
                    </td>
                    <td className='px-4 py-3 align-middle'>
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          variant='tertiary'
                          onPress={() =>
                            openEditPayMethodModal(record, index)
                          }
                        >
                          {t('编辑')}
                        </Button>
                        <Button
                          size='sm'
                          variant='danger-soft'
                          onPress={() => handleDeletePayMethod(index)}
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <Button color='primary' onPress={submitWaffoSetting}>
            {t('更新 Waffo 设置')}
          </Button>
        </div>
      </div>

      {/* 新增/编辑支付方式弹窗 */}
      <Modal state={payMethodModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='lg' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>
                  {editingPayMethodIndex === -1
                    ? t('新增支付方式')
                    : t('编辑支付方式')}
                </span>
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('显示名称')}</FieldLabel>
                  <input
                    type='text'
                    value={payMethodForm.name}
                    onChange={(event) =>
                      setPayMethodForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder={t('例如：Credit Card')}
                    className={inputClass}
                  />
                  <FieldHint>
                    {t(
                      '用户在充值页面看到的支付方式名称，例如：Credit Card',
                    )}
                  </FieldHint>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('图标')}</FieldLabel>
                  <div className='flex flex-wrap items-center gap-2'>
                    {payMethodForm.icon && (
                      <img
                        src={payMethodForm.icon}
                        alt='preview'
                        className='h-8 w-8 rounded border border-border object-contain'
                      />
                    )}
                    <input
                      type='file'
                      accept='image/*'
                      ref={iconFileInputRef}
                      className='hidden'
                      onChange={handleIconFileChange}
                    />
                    <Button
                      size='sm'
                      variant='tertiary'
                      onPress={() => iconFileInputRef.current?.click()}
                    >
                      {payMethodForm.icon
                        ? t('重新上传')
                        : t('上传图片')}
                    </Button>
                    {payMethodForm.icon && (
                      <Button
                        size='sm'
                        variant='danger-soft'
                        onPress={() =>
                          setPayMethodForm((prev) => ({
                            ...prev,
                            icon: '',
                          }))
                        }
                      >
                        {t('清除')}
                      </Button>
                    )}
                  </div>
                  <FieldHint>
                    {t('上传 PNG/JPG/SVG 图片，建议尺寸 ≤ 128×128px')}
                  </FieldHint>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('支付方式类型')}</FieldLabel>
                  <input
                    type='text'
                    value={payMethodForm.payMethodType}
                    onChange={(event) =>
                      setPayMethodForm((prev) => ({
                        ...prev,
                        payMethodType: event.target.value,
                      }))
                    }
                    placeholder='CREDITCARD,DEBITCARD'
                    maxLength={64}
                    className={inputClass}
                  />
                  <FieldHint>
                    {t(
                      'Waffo API 参数，可空，例如：CREDITCARD,DEBITCARD（最多64位）',
                    )}
                  </FieldHint>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('支付方式名称')}</FieldLabel>
                  <input
                    type='text'
                    value={payMethodForm.payMethodName}
                    onChange={(event) =>
                      setPayMethodForm((prev) => ({
                        ...prev,
                        payMethodName: event.target.value,
                      }))
                    }
                    placeholder={t('可空')}
                    maxLength={64}
                    className={inputClass}
                  />
                  <FieldHint>
                    {t('Waffo API 参数，可空（最多64位）')}
                  </FieldHint>
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button
                  variant='tertiary'
                  onPress={() => setPayMethodModalVisible(false)}
                >
                  {t('取消')}
                </Button>
                <Button color='primary' onPress={handlePayMethodModalOk}>
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
