import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, NavBar, PullToRefresh } from 'antd-mobile';

import { API } from '@classic/helpers/api';

import ReasonDialog from '../../components/admin/ReasonDialog';
import StatusFilter from '../../components/admin/StatusFilter';
import useAdminList from '../../hooks/useAdminList';
import { showError, showSuccess } from '../../shims/classic-utils';
import { downloadBase64File, fenToYuan, formatTs } from '../../utils/review';

const STATUS_OPTIONS = [
  { value: 1, label: '待开票' },
  { value: 2, label: '已开具' },
  { value: 3, label: '已驳回' },
  { value: 0, label: '全部' },
];

const INVOICE_STATUS = {
  1: { text: '待开票', badge: 'pending' },
  2: { text: '已开具', badge: 'success' },
  3: { text: '已驳回', badge: 'danger' },
};

const INVOICE_TYPE = { 1: '增值税普通发票', 2: '增值税专用发票' };

const AdminInvoices = () => {
  const navigate = useNavigate();
  const { list, status, setStatus, reload } = useAdminList(
    '/api/user/invoice/admin',
  );
  const [rejectId, setRejectId] = useState(null);
  const issueRowRef = useRef(null);
  const fileRef = useRef(null);

  const openIssue = (row) => {
    issueRowRef.current = row;
    fileRef.current?.click();
  };

  const handleIssueFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const row = issueRowRef.current;
    if (!file || !row) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result).split(',')[1];
      try {
        const res = await API.put(`/api/user/invoice/admin/${row.id}/issue`, {
          file_name: file.name,
          file_data: base64,
        });
        if (res.data.success) {
          showSuccess('已开具');
          reload();
        } else {
          showError(res.data.message);
        }
      } catch (err) {
        showError(err);
      }
    };
    reader.onerror = () => showError('文件读取失败');
    reader.readAsDataURL(file);
  };

  const handleReject = async (reason) => {
    try {
      const res = await API.put(`/api/user/invoice/admin/${rejectId}/reject`, {
        reason,
      });
      if (res.data.success) {
        showSuccess('已驳回');
        setRejectId(null);
        reload();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  };

  const viewFile = async (row) => {
    try {
      const res = await API.get(`/api/user/invoice/admin/${row.id}/file`);
      if (res.data.success) {
        downloadBase64File(res.data.data.file_name, res.data.data.file_data);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>企业开票审核</NavBar>
      <StatusFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      <PullToRefresh onRefresh={reload}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((row) => {
            const st = INVOICE_STATUS[row.status] || {};
            return (
              <div className='m-card' key={row.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fenToYuan(row.amount_fen)}
                    <span style={{ color: '#9aa1ad', fontWeight: 400, fontSize: 13 }}>
                      {' '}· {row.username}
                    </span>
                  </div>
                  <span className={`m-badge ${st.badge || ''}`}>{st.text}</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 6 }}>
                  {INVOICE_TYPE[row.invoice_type] || '发票'} · 抬头 {row.title}
                </div>
                <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>
                  税号 {row.tax_no} · {row.email} · 提交 {formatTs(row.submitted_at)}
                </div>
                {row.reject_reason && (
                  <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 2 }}>
                    驳回原因：{row.reject_reason}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {row.status === 2 && (
                    <Button size='small' fill='outline' onClick={() => viewFile(row)}>
                      下载发票
                    </Button>
                  )}
                  {row.status === 1 && (
                    <>
                      <Button size='small' color='primary' onClick={() => openIssue(row)}>
                        上传发票并开具
                      </Button>
                      <Button
                        size='small'
                        color='danger'
                        fill='outline'
                        onClick={() => setRejectId(row.id)}
                      >
                        驳回
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9aa1ad', marginTop: 40 }}>
              暂无记录
            </p>
          )}
        </div>
      </PullToRefresh>

      <input
        ref={fileRef}
        type='file'
        accept='.pdf,.jpg,.jpeg,.png'
        hidden
        onChange={handleIssueFile}
      />

      <ReasonDialog
        visible={rejectId !== null}
        title='驳回原因'
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
      />
    </div>
  );
};

export default AdminInvoices;
