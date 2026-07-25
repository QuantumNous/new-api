import React from 'react';
import { useNavigate } from 'react-router-dom';
import { List, NavBar, PullToRefresh } from 'antd-mobile';

import StatusFilter from '../../components/admin/StatusFilter';
import useAdminList from '../../hooks/useAdminList';
import {
  FEEDBACK_CATEGORY,
  FEEDBACK_STATUS,
  formatTs,
} from '../../utils/review';

const STATUS_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 1, label: '待处理' },
  { value: 2, label: '处理中' },
  { value: 3, label: '已回复' },
  { value: 4, label: '已关闭' },
];

const AdminTickets = () => {
  const navigate = useNavigate();
  const { list, status, setStatus, reload } = useAdminList(
    '/api/user/feedback/admin/topics',
    1,
  );

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>工单管理</NavBar>
      <StatusFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      <PullToRefresh onRefresh={reload}>
        {list.length > 0 ? (
          <List className='m-list-card' style={{ marginTop: 12 }}>
            {list.map((t) => {
              const st = FEEDBACK_STATUS[t.status] || {};
              return (
                <List.Item
                  key={t.id}
                  onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  description={`${t.username || ''} · ${FEEDBACK_CATEGORY[t.category] || '其他'} · ${formatTs(t.created_at)}`}
                  extra={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!!t.admin_unread && (
                        <span className='m-badge danger'>未读</span>
                      )}
                      <span className={`m-badge ${st.badge || ''}`}>{st.text}</span>
                    </span>
                  }
                >
                  {t.title}
                </List.Item>
              );
            })}
          </List>
        ) : (
          <p style={{ textAlign: 'center', color: '#9aa1ad', marginTop: 48 }}>
            暂无工单
          </p>
        )}
      </PullToRefresh>
    </div>
  );
};

export default AdminTickets;
