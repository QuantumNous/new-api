import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  Image,
  Input,
  NavBar,
  PullToRefresh,
  TextArea,
} from 'antd-mobile';

import { API } from '@classic/helpers/api';

import ReasonDialog from '../../components/admin/ReasonDialog';
import StatusFilter from '../../components/admin/StatusFilter';
import useAdminList from '../../hooks/useAdminList';
import { showError, showSuccess } from '../../shims/classic-utils';
import { fenToYuan, formatTs } from '../../utils/review';

const STATUS_OPTIONS = [
  { value: 1, label: '待审核' },
  { value: 2, label: '已入账' },
  { value: 3, label: '已驳回' },
  { value: 0, label: '全部' },
];

const TRANSFER_STATUS = {
  1: { text: '待审核', badge: 'pending' },
  2: { text: '已入账', badge: 'success' },
  3: { text: '已驳回', badge: 'danger' },
};

const yuanToFen = (s) => {
  const n = Number(String(s).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
};

const AdminTransfers = () => {
  const navigate = useNavigate();
  const { list, status, setStatus, reload } = useAdminList(
    '/api/user/bank_transfer/admin',
  );
  const [rejectId, setRejectId] = useState(null);
  const [approveRow, setApproveRow] = useState(null);
  const [creditedYuan, setCreditedYuan] = useState('');
  const [remark, setRemark] = useState('');
  const [receipt, setReceipt] = useState('');

  const openApprove = (row) => {
    setApproveRow(row);
    setCreditedYuan((row.amount_fen / 100).toFixed(2));
    setRemark('');
  };

  const handleApprove = async () => {
    const fen = yuanToFen(creditedYuan);
    if (!fen) {
      showError('请输入有效的到账金额');
      return;
    }
    try {
      const res = await API.put(
        `/api/user/bank_transfer/admin/${approveRow.id}/approve`,
        { credited_fen: fen, review_remark: remark.trim() },
      );
      if (res.data.success) {
        showSuccess('已入账');
        setApproveRow(null);
        reload();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleReject = async (reason) => {
    try {
      const res = await API.put(
        `/api/user/bank_transfer/admin/${rejectId}/reject`,
        { reason },
      );
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

  const viewReceipt = async (row) => {
    try {
      const res = await API.get(
        `/api/user/bank_transfer/admin/${row.id}/receipt`,
      );
      if (res.data.success) {
        setReceipt(res.data.data.receipt_image);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>企业转账审核</NavBar>
      <StatusFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      <PullToRefresh onRefresh={reload}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((row) => {
            const st = TRANSFER_STATUS[row.status] || {};
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
                  单号 {row.trade_no} · 提交 {formatTs(row.submitted_at)}
                </div>
                {row.status === 2 && (
                  <div style={{ fontSize: 12.5, color: '#047857', marginTop: 2 }}>
                    实际入账 {fenToYuan(row.credited_fen)}
                    {row.review_remark ? ` · ${row.review_remark}` : ''}
                  </div>
                )}
                {row.reject_reason && (
                  <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 2 }}>
                    驳回原因：{row.reject_reason}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {row.has_receipt && (
                    <Button size='small' fill='outline' onClick={() => viewReceipt(row)}>
                      查看凭证
                    </Button>
                  )}
                  {row.status === 1 && (
                    <>
                      <Button size='small' color='primary' onClick={() => openApprove(row)}>
                        入账
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

      <ReasonDialog
        visible={rejectId !== null}
        title='驳回原因'
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
      />

      <Dialog
        visible={!!approveRow}
        title='确认入账'
        onClose={() => setApproveRow(null)}
        closeOnAction={false}
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => setApproveRow(null) },
            { key: 'ok', text: '确认入账', bold: true, onClick: handleApprove },
          ],
        ]}
        content={
          approveRow && (
            <div>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                {approveRow.username} 申报 {fenToYuan(approveRow.amount_fen)}
              </p>
              <div style={{ background: '#f1f2f6', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                <Input
                  type='number'
                  placeholder='实际到账金额（元）'
                  value={creditedYuan}
                  onChange={setCreditedYuan}
                />
              </div>
              <div style={{ background: '#f1f2f6', borderRadius: 8, padding: '6px 10px' }}>
                <TextArea
                  placeholder='审核备注（可选）'
                  value={remark}
                  onChange={setRemark}
                  rows={2}
                />
              </div>
            </div>
          )
        }
      />

      <Dialog
        visible={!!receipt}
        title='转账凭证'
        onClose={() => setReceipt('')}
        closeOnAction
        actions={[{ key: 'ok', text: '关闭' }]}
        content={receipt && <Image src={receipt} width='100%' />}
      />
    </div>
  );
};

export default AdminTransfers;
