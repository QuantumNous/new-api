import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  Image,
  NavBar,
  PullToRefresh,
} from 'antd-mobile';

import { API } from '@classic/helpers/api';

import ReasonDialog from '../../components/admin/ReasonDialog';
import StatusFilter from '../../components/admin/StatusFilter';
import useAdminList from '../../hooks/useAdminList';
import { showError, showSuccess } from '../../shims/classic-utils';
import { REVIEW_STATUS, formatTs } from '../../utils/review';

const STATUS_OPTIONS = [
  { value: 1, label: '待审核' },
  { value: 2, label: '已通过' },
  { value: 3, label: '已驳回' },
  { value: 0, label: '全部' },
];

const AdminKyc = () => {
  const navigate = useNavigate();
  const { list, status, setStatus, reload } = useAdminList('/api/user/kyc/admin');
  const [rejectId, setRejectId] = useState(null);
  const [inspect, setInspect] = useState(null); // {reveal, images}

  const handleApprove = (row) => {
    Dialog.confirm({
      content: `通过 ${row.username} 的实名认证（${row.real_name}）？`,
      onConfirm: async () => {
        try {
          const res = await API.put(`/api/user/kyc/admin/${row.id}/approve`);
          if (res.data.success) {
            showSuccess('已通过');
            reload();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e);
        }
      },
    });
  };

  const handleReject = async (reason) => {
    try {
      const res = await API.put(`/api/user/kyc/admin/${rejectId}/reject`, {
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

  const handleInspect = async (row) => {
    try {
      const calls = [API.get(`/api/user/kyc/admin/${row.id}/reveal`)];
      if (row.has_images) {
        calls.push(API.get(`/api/user/kyc/admin/${row.id}/images`));
      }
      const [revealRes, imagesRes] = await Promise.all(calls);
      setInspect({
        reveal: revealRes.data.data,
        images: imagesRes?.data?.data,
      });
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>实名认证审批</NavBar>
      <StatusFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      <PullToRefresh onRefresh={reload}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((row) => {
            const st = REVIEW_STATUS[row.status] || {};
            return (
              <div className='m-card' key={row.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600 }}>
                    {row.real_name}
                    <span style={{ color: '#9aa1ad', fontWeight: 400, fontSize: 13 }}>
                      {' '}· {row.username}
                    </span>
                  </div>
                  <span className={`m-badge ${st.badge || ''}`}>{st.text}</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 6 }}>
                  证件号 {row.id_number_masked} · 提交 {formatTs(row.submitted_at)}
                  {row.submit_count > 1 ? ` · 第 ${row.submit_count} 次提交` : ''}
                </div>
                {row.reject_reason && (
                  <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 4 }}>
                    驳回原因：{row.reject_reason}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button size='small' fill='outline' onClick={() => handleInspect(row)}>
                    查看资料
                  </Button>
                  {row.status === 1 && (
                    <>
                      <Button
                        size='small'
                        color='primary'
                        onClick={() => handleApprove(row)}
                      >
                        通过
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
        visible={!!inspect}
        title='认证资料'
        onClose={() => setInspect(null)}
        closeOnAction
        actions={[{ key: 'ok', text: '关闭' }]}
        content={
          inspect && (
            <div style={{ fontSize: 14 }}>
              <p>姓名：{inspect.reveal?.real_name}</p>
              <p>证件号：{inspect.reveal?.id_number}</p>
              {inspect.images?.front_image && (
                <Image src={inspect.images.front_image} width='100%' />
              )}
              {inspect.images?.back_image && (
                <Image
                  src={inspect.images.back_image}
                  width='100%'
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          )
        }
      />
    </div>
  );
};

export default AdminKyc;
