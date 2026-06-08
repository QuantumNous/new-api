import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconShield,
  IconUpload,
  IconClose,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const STATUS_LABELS = {
  0: { text: '未认证', color: 'grey' },
  1: { text: '审核中', color: 'orange' },
  2: { text: '已认证', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

// USCC = 统一社会信用代码 (GB32100): 18 chars, excludes the easily-confused
// letters I/O/Z/S/V. Legal-rep ID number reuses the resident ID card rule.
const USCC_RE = /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/;
const LEGAL_ID_RE = /^\d{17}[\dXx]$/;
const COMPANY_RE = /^.{2,128}$/;
const LEGAL_NAME_RE = /^[一-龥·]{2,25}$/;

function validate(form, t) {
  const errors = {};
  if (!COMPANY_RE.test(form.company_name.trim())) {
    errors.company_name = t('请输入 2-128 位企业名称');
  }
  if (!USCC_RE.test(form.uscc.trim().toUpperCase())) {
    errors.uscc = t('请输入 18 位统一社会信用代码');
  }
  if (!LEGAL_NAME_RE.test(form.legal_rep_name)) {
    errors.legal_rep_name = t('请输入 2-25 位中文姓名');
  }
  if (!LEGAL_ID_RE.test(form.legal_rep_id)) {
    errors.legal_rep_id = t('请输入 18 位有效身份证号码（末位可为 X）');
  }
  return errors;
}

// Compress an image File to a base64 string (no data-URI prefix). Scales to
// maxLongEdgePx, encodes JPEG, retries lower quality if over maxSizeKB.
async function compressImageToBase64(file, maxLongEdgePx = 2400, maxSizeKB = 1500) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > maxLongEdgePx) {
        if (width >= height) {
          height = Math.round((height * maxLongEdgePx) / width);
          width = maxLongEdgePx;
        } else {
          width = Math.round((width * maxLongEdgePx) / height);
          height = maxLongEdgePx;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Encode at the given quality. Retry exactly once at a lower quality if
      // the result is still over target — a single fallback, never a loop
      // (re-encoding at a fixed quality would never shrink and would hang).
      const tryEncode = (quality, isRetry) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('canvas.toBlob failed')); return; }
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = reader.result.split(',')[1];
              if (!isRetry && b64.length > maxSizeKB * 1024 * (4 / 3)) {
                tryEncode(0.82, true);
              } else {
                resolve(b64);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality,
        );
      };
      tryEncode(0.88, false);
    };
    img.onerror = reject;
    img.src = url;
  });
}

const EMPTY_FORM = {
  company_name: '',
  uscc: '',
  legal_rep_name: '',
  legal_rep_id: '',
  contact_name: '',
  contact_phone: '',
};

// Single image upload slot with preview thumbnail
function ImageSlot({ label, base64, onSelect, onClear }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressImageToBase64(file);
      onSelect(b64);
    } catch {
      showError(t('图片处理失败，请重试'));
    }
    e.target.value = '';
  };

  return (
    <div
      style={{
        flex: 1,
        border: '1px dashed var(--semi-color-border)',
        borderRadius: 8,
        padding: 8,
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => !base64 && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {base64 ? (
        <>
          <img
            src={`data:image/jpeg;base64,${base64}`}
            alt={label}
            style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 4 }}
          />
          <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
            <Button
              size='small'
              icon={<IconUpload />}
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            />
            <Button
              size='small'
              type='danger'
              icon={<IconClose />}
              onClick={(e) => { e.stopPropagation(); onClear(); }}
            />
          </div>
        </>
      ) : (
        <>
          <IconUpload size='large' style={{ color: 'var(--semi-color-text-2)', marginBottom: 6 }} />
          <Text type='secondary' size='small'>{label}</Text>
          <Text type='tertiary' size='small'>{t('点击上传')}</Text>
        </>
      )}
    </div>
  );
}

export default function EnterpriseSetting() {
  const { t } = useTranslation();
  const [ent, setEnt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [licenseBase64, setLicenseBase64] = useState('');
  const [frontBase64, setFrontBase64] = useState('');
  const [backBase64, setBackBase64] = useState('');

  const loadEnterprise = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/enterprise');
      const { success, data } = res.data;
      if (success) setEnt(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnterprise();
  }, []);

  const errors = validate(form, t);
  const isValid = Object.keys(errors).length === 0;
  const canSubmit =
    isValid && licenseBase64 !== '' && frontBase64 !== '' && backBase64 !== '';

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((p) => ({ ...p, [field]: true }));
  };

  const openForm = (prefill = {}) => {
    setForm({
      ...EMPTY_FORM,
      company_name: prefill.company_name || '',
      legal_rep_name: prefill.legal_rep_name || '',
      contact_name: prefill.contact_name || '',
    });
    setTouched({});
    setLicenseBase64('');
    setFrontBase64('');
    setBackBase64('');
    setShowForm(true);
  };

  const handleSubmit = async (isUpdate) => {
    setTouched({
      company_name: true,
      uscc: true,
      legal_rep_name: true,
      legal_rep_id: true,
    });
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const method = isUpdate ? 'put' : 'post';
      const res = await API[method]('/api/user/enterprise', {
        company_name: form.company_name.trim(),
        uscc: form.uscc.trim().toUpperCase(),
        legal_rep_name: form.legal_rep_name,
        legal_rep_id: form.legal_rep_id,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        license: licenseBase64,
        legal_front: frontBase64,
        legal_back: backBase64,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('提交成功，等待管理员审核'));
        setShowForm(false);
        await loadEnterprise();
      } else {
        showError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    try {
      const res = await API.delete('/api/user/enterprise');
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('撤销成功'));
        setShowRevokeModal(false);
        await loadEnterprise();
      } else {
        showError(message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  const status = ent?.status ?? 0;
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS[0];
  const maxSubmit = 5;
  const remaining = maxSubmit - (ent?.submit_count || 0);
  const isUpdate = status !== 0 && status !== 1;
  const approved = status === 2;

  return (
    <Card className='!rounded-2xl shadow-sm border-0' style={{ marginBottom: 0 }}>
      {/* 卡片 Header */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='blue' className='mr-3 shadow-md'>
          <IconShield />
        </Avatar>
        <div>
          <div className='flex items-center gap-2'>
            <Typography.Text className='text-lg font-medium'>
              {t('企业认证')}
            </Typography.Text>
            <Badge
              count={t(statusInfo.text)}
              type={
                statusInfo.color === 'green'
                  ? 'success'
                  : statusInfo.color === 'red'
                    ? 'danger'
                    : statusInfo.color === 'orange'
                      ? 'warning'
                      : 'secondary'
              }
            />
          </div>
          <div className='text-xs text-gray-600 dark:text-gray-400'>
            {t('企业级身份核验，解锁专属企业服务')}
          </div>
        </div>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <>
          {status === 0 && (
            <div>
              <Text type='secondary'>{t('您尚未提交企业认证信息')}</Text>
              <br />
              <Button style={{ marginTop: 12 }} theme='solid' onClick={() => openForm()}>
                {t('立即认证')}
              </Button>
            </div>
          )}

          {status === 1 && (
            <div>
              <Text>{t('企业名称')}：{ent.company_name}</Text>
              <br />
              <Text>{t('统一社会信用代码')}：{ent.uscc_masked}</Text>
              <br />
              <Text>{t('法人代表姓名')}：{ent.legal_rep_name}</Text>
              <br />
              <Text type='secondary' style={{ marginTop: 8, display: 'block' }}>
                {t('已提交，等待管理员审核')}
              </Text>
              <Button
                style={{ marginTop: 12 }}
                type='danger'
                onClick={() => setShowRevokeModal(true)}
              >
                {t('撤回申请')}
              </Button>
            </div>
          )}

          {status === 2 && (
            <div>
              <Text>{t('企业名称')}：{ent.company_name}</Text>
              <br />
              <Text>{t('统一社会信用代码')}：{ent.uscc_masked}</Text>
              <br />
              <Text>{t('法人代表姓名')}：{ent.legal_rep_name}</Text>
              <br />
              {ent.verified_at && (
                <Text type='secondary'>
                  {t('认证时间')}：{new Date(ent.verified_at).toLocaleString()}
                </Text>
              )}
            </div>
          )}

          {status === 3 && (
            <div>
              <Text type='danger'>
                {t('拒绝原因')}：{ent.reject_reason}{' '}
                {remaining > 0 && (
                  <a
                    href='#'
                    onClick={(e) => {
                      e.preventDefault();
                      openForm({
                        company_name: ent.company_name,
                        legal_rep_name: ent.legal_rep_name,
                        contact_name: ent.contact_name,
                      });
                    }}
                  >
                    {t('重新提交')}
                  </a>
                )}
              </Text>
              <br />
              <Text type='secondary' style={{ marginTop: 4, display: 'block' }}>
                {t('剩余提交次数')}：{remaining > 0 ? remaining : 0}
              </Text>
            </div>
          )}
        </>
      )}

      {/* 提交 / 重新提交 Modal */}
      <Modal
        title={status === 0 ? t('提交企业认证') : t('重新提交企业认证')}
        visible={showForm}
        onCancel={() => setShowForm(false)}
        onOk={() => handleSubmit(isUpdate)}
        okButtonProps={{ loading: submitting, disabled: !canSubmit }}
        okText={t('提交')}
        cancelText={t('取消')}
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField
            label={t('企业名称')}
            required
            placeholder={t('请输入营业执照上的企业全称')}
            value={form.company_name}
            error={touched.company_name && errors.company_name}
            onChange={(v) => handleChange('company_name', v)}
            onBlur={() => setTouched((p) => ({ ...p, company_name: true }))}
          />
          <FormField
            label={t('统一社会信用代码')}
            required
            placeholder={t('请输入 18 位统一社会信用代码')}
            value={form.uscc}
            error={touched.uscc && errors.uscc}
            onChange={(v) => handleChange('uscc', v)}
            onBlur={() => setTouched((p) => ({ ...p, uscc: true }))}
          />
          <FormField
            label={t('法人代表姓名')}
            required
            placeholder={t('请输入法人代表姓名')}
            value={form.legal_rep_name}
            error={touched.legal_rep_name && errors.legal_rep_name}
            onChange={(v) => handleChange('legal_rep_name', v)}
            onBlur={() => setTouched((p) => ({ ...p, legal_rep_name: true }))}
          />
          <FormField
            label={t('法人身份证号')}
            required
            placeholder={t('请输入 18 位身份证号码')}
            value={form.legal_rep_id}
            error={touched.legal_rep_id && errors.legal_rep_id}
            onChange={(v) => handleChange('legal_rep_id', v)}
            onBlur={() => setTouched((p) => ({ ...p, legal_rep_id: true }))}
          />

          {/* 选填联系方式 */}
          <FormField
            label={t('联系人')}
            placeholder={t('选填')}
            value={form.contact_name}
            onChange={(v) => handleChange('contact_name', v)}
          />
          <FormField
            label={t('联系电话')}
            placeholder={t('选填')}
            value={form.contact_phone}
            onChange={(v) => handleChange('contact_phone', v)}
          />

          {/* 图片：营业执照 + 法人身份证正反面 */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('营业执照')} <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <ImageSlot
                label={t('营业执照')}
                base64={licenseBase64}
                onSelect={setLicenseBase64}
                onClear={() => setLicenseBase64('')}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('法人身份证照片')} <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <ImageSlot
                label={t('法人身份证正面')}
                base64={frontBase64}
                onSelect={setFrontBase64}
                onClear={() => setFrontBase64('')}
              />
              <ImageSlot
                label={t('法人身份证背面')}
                base64={backBase64}
                onSelect={setBackBase64}
                onClear={() => setBackBase64('')}
              />
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
              {t('格式不限，上传前自动压缩，每张建议不超过 5MB')}
            </div>
          </div>
        </div>
      </Modal>

      {/* 撤回确认 Modal */}
      <Modal
        title={t('撤回认证申请')}
        visible={showRevokeModal}
        onCancel={() => setShowRevokeModal(false)}
        onOk={handleRevoke}
        okText={t('确认撤回')}
        cancelText={t('取消')}
      >
        <Text>{t('确认撤回您的企业认证申请？撤回后可重新提交。')}</Text>
      </Modal>
    </Card>
  );
}

// FormField is a small labeled input with inline error text.
function FormField({ label, required, placeholder, value, error, onChange, onBlur }) {
  const { t } = useTranslation();
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {label} {required && <span style={{ color: 'red' }}>*</span>}
      </label>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        validateStatus={error ? 'error' : undefined}
      />
      {error && (
        <div style={{ color: 'var(--semi-color-danger)', fontSize: 12, marginTop: 4 }}>
          {t(error)}
        </div>
      )}
    </div>
  );
}
