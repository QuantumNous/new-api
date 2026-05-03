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
import { IconIdCard, IconUpload, IconClose } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const STATUS_LABELS = {
  0: { text: '未认证', color: 'grey' },
  1: { text: '审核中', color: 'orange' },
  2: { text: '已认证', color: 'green' },
  3: { text: '已拒绝', color: 'red' },
};

const NAME_RE = /^[一-龥·]{2,25}$/;
const ID_RE = /^\d{17}[\dXx]$/;

function validate(form, t) {
  const errors = {};
  if (!NAME_RE.test(form.real_name)) {
    errors.real_name = t('请输入 2-25 位中文姓名');
  }
  if (!ID_RE.test(form.id_number)) {
    errors.id_number = t('请输入 18 位有效身份证号码（末位可为 X）');
  }
  return errors;
}

// Compress an image File to a base64 string (no data-URI prefix).
// Scales down to maxLongEdgePx, encodes as JPEG, retries with lower quality
// if the result exceeds maxSizeKB.
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

      const tryEncode = (quality) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('canvas.toBlob failed')); return; }
            const reader = new FileReader();
            reader.onload = () => {
              // Strip the "data:image/jpeg;base64," prefix
              const b64 = reader.result.split(',')[1];
              if (b64.length > maxSizeKB * 1024 * (4 / 3) && quality > 0.6) {
                tryEncode(0.82);
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
      tryEncode(0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}

const EMPTY_FORM = { real_name: '', id_number: '' };

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
    // Reset so the same file can be re-selected
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

export default function KYCSetting() {
  const { t } = useTranslation();
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [frontBase64, setFrontBase64] = useState('');
  const [backBase64, setBackBase64] = useState('');

  const loadKYC = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/kyc');
      const { success, data } = res.data;
      if (success) setKyc(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKYC();
  }, []);

  const errors = validate(form, t);
  const isValid = Object.keys(errors).length === 0;
  const canSubmit = isValid && frontBase64 !== '' && backBase64 !== '';

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const openForm = (prefill = {}) => {
    setForm({ real_name: prefill.real_name || '', id_number: '' });
    setTouched({});
    setFrontBase64('');
    setBackBase64('');
    setShowForm(true);
  };

  const handleSubmit = async (isUpdate) => {
    setTouched({ real_name: true, id_number: true });
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const method = isUpdate ? 'put' : 'post';
      const res = await API[method]('/api/user/kyc', {
        real_name: form.real_name,
        id_type: 'id_card',
        id_number: form.id_number,
        id_card_front: frontBase64,
        id_card_back: backBase64,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('提交成功，等待管理员审核'));
        setShowForm(false);
        await loadKYC();
      } else {
        showError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    try {
      const res = await API.delete('/api/user/kyc');
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('撤销成功'));
        setShowRevokeModal(false);
        await loadKYC();
      } else {
        showError(message);
      }
    } catch {
      showError(t('操作失败'));
    }
  };

  const status = kyc?.status ?? 0;
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS[0];
  const maxSubmit = 5;
  const remaining = maxSubmit - (kyc?.submit_count || 0);
  const isUpdate = status !== 0 && status !== 1;

  return (
    <Card
      className='!rounded-2xl shadow-sm border-0'
      style={{ marginBottom: 0 }}
    >
      {/* 卡片 Header */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='orange' className='mr-3 shadow-md'>
          <IconIdCard />
        </Avatar>
        <div>
          <div className='flex items-center gap-2'>
            <Typography.Text className='text-lg font-medium'>
              {t('实名认证')}
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
            {t('身份核验，保障账户安全')}
          </div>
        </div>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <>
          {status === 0 && (
            <div>
              <Text type='secondary'>{t('您尚未提交实名认证信息')}</Text>
              <br />
              <Button style={{ marginTop: 12 }} theme='solid' onClick={() => openForm()}>
                {t('立即认证')}
              </Button>
            </div>
          )}

          {status === 1 && (
            <div>
              <Text>{t('姓名')}：{kyc.real_name}</Text>
              <br />
              <Text>{t('证件类型')}：{t('居民身份证')}</Text>
              <br />
              <Text>{t('证件号')}：{kyc.id_number_masked}</Text>
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
              <Text>{t('姓名')}：{kyc.real_name}</Text>
              <br />
              <Text>{t('证件类型')}：{t('居民身份证')}</Text>
              <br />
              <Text>{t('证件号')}：{kyc.id_number_masked}</Text>
              <br />
              {kyc.verified_at && (
                <Text type='secondary'>
                  {t('认证时间')}：{new Date(kyc.verified_at).toLocaleString()}
                </Text>
              )}
            </div>
          )}

          {status === 3 && (
            <div>
              <Text type='danger'>
                {t('拒绝原因')}：{kyc.reject_reason}{' '}
                {remaining > 0 && (
                  <a
                    href='#'
                    onClick={(e) => {
                      e.preventDefault();
                      openForm({ real_name: kyc.real_name });
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
        title={status === 0 ? t('提交实名认证') : t('重新提交实名认证')}
        visible={showForm}
        onCancel={() => setShowForm(false)}
        onOk={() => handleSubmit(isUpdate)}
        okButtonProps={{ loading: submitting, disabled: !canSubmit }}
        okText={t('提交')}
        cancelText={t('取消')}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 真实姓名 */}
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              {t('真实姓名')} <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              placeholder={t('请输入真实姓名')}
              value={form.real_name}
              onChange={(v) => handleChange('real_name', v)}
              onBlur={() => setTouched((p) => ({ ...p, real_name: true }))}
              validateStatus={touched.real_name && errors.real_name ? 'error' : undefined}
            />
            {touched.real_name && errors.real_name && (
              <div style={{ color: 'var(--semi-color-danger)', fontSize: 12, marginTop: 4 }}>
                {t(errors.real_name)}
              </div>
            )}
          </div>

          {/* 证件号码 */}
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              {t('身份证号码')} <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              placeholder={t('请输入 18 位身份证号码')}
              value={form.id_number}
              onChange={(v) => handleChange('id_number', v)}
              onBlur={() => setTouched((p) => ({ ...p, id_number: true }))}
              validateStatus={touched.id_number && errors.id_number ? 'error' : undefined}
            />
            {touched.id_number && errors.id_number && (
              <div style={{ color: 'var(--semi-color-danger)', fontSize: 12, marginTop: 4 }}>
                {t(errors.id_number)}
              </div>
            )}
          </div>

          {/* 身份证图片 */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('身份证照片')} <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <ImageSlot
                label={t('正面（人像面）')}
                base64={frontBase64}
                onSelect={setFrontBase64}
                onClear={() => setFrontBase64('')}
              />
              <ImageSlot
                label={t('背面（国徽面）')}
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
        <Text>{t('确认撤回您的实名认证申请？撤回后可重新提交。')}</Text>
      </Modal>
    </Card>
  );
}
