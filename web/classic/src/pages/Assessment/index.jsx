import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { API, isAdmin, showSuccess, showError } from '../../helpers';
import {
  Card,
  Button,
  Input,
  Textarea,
  Modal,
  Select,
  Tag,
  Typography,
  Spin,
  Empty,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';

const SUBMISSION_STATUS = { 0: 'Pending Review', 1: 'Passed', 2: 'Failed' };
const ASSESS_STATUS = { 0: 'Not Started', 1: 'In Progress', 2: 'Ended' };

const useData = (key, fetcher, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher();
      setData(res?.data || res);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
};

const Assessment = () => {
  const { t } = useTranslation();
  const admin = isAdmin();

  if (admin) return <AdminView t={t} />;
  return <UserView t={t} />;
};

const UserView = ({ t }) => (
  <div className="px-4 pt-[60px] mx-auto max-w-4xl">
    <Typography.Title heading={3}>{t('AI Code Review Assessment')}</Typography.Title>
    <Tabs defaultActiveKey="active" style={{ marginTop: 16 }}>
      <TabPane tab={t('Active Assessments')} itemKey="active">
        <ActiveAssessments t={t} />
      </TabPane>
      <TabPane tab={t('My Submissions')} itemKey="my">
        <MySubmissions t={t} />
      </TabPane>
      <TabPane tab={t('My Statistics')} itemKey="stats">
        <MyStats t={t} />
      </TabPane>
    </Tabs>
  </div>
);

const ActiveAssessments = ({ t }) => {
  const { data, loading, reload } = useData('active', () =>
    API.get('/api/assessment/active').then(r => r.data)
  );
  const [submitTarget, setSubmitTarget] = useState(null);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!submitTarget) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('assessment_id', String(submitTarget.id));
      fd.append('content', content);
      for (const f of files) fd.append('screenshots', f);
      const res = await API.post('/api/assessment/submit', fd);
      if (res.data.success) {
        showSuccess(t('Submitted successfully'));
        setSubmitTarget(null);
        setContent('');
        setFiles([]);
        reload();
      }
    } catch {
      showError(t('Submission failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin />;
  const items = data?.data ?? [];
  if (items.length === 0) return <Empty title={t('No active assessments')} />;

  return (
    <>
      {items.map((item) => (
        <Card key={item.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Title heading={5}>{item.title}</Typography.Title>
            <Tag color={item.submitted ? 'grey' : 'blue'}>
              {t(item.submitted ? SUBMISSION_STATUS[item.submission_status] || 'Unknown' : 'Not Submitted')}
            </Tag>
          </div>
          <Typography.Text type="tertiary" size="small">
            {dayjs.unix(item.start_time).format('YYYY-MM-DD HH:mm')} ~ {dayjs.unix(item.end_time).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Typography.Paragraph>{item.description}</Typography.Paragraph>
            {item.submitted && item.score != null && (
              <Typography.Text>{t('Score')}: {item.score}</Typography.Text>
            )}
            {!item.submitted && (
              <Button theme="solid" onClick={() => setSubmitTarget(item)} style={{ marginTop: 8 }}>
                {t('Submit Work')}
              </Button>
            )}
          </div>
        </Card>
      ))}

      <Modal visible={!!submitTarget} title={t('Submit Assessment') + ' - ' + (submitTarget?.title || '')}
        onCancel={() => setSubmitTarget(null)} footer={null}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Typography.Text strong>{t('Description')}</Typography.Text>
            <Textarea placeholder={t('Describe your work')} value={content} onChange={setContent} rows={4} />
          </div>
          <div>
            <Typography.Text strong>{t('Upload screenshots (png/jpg/gif/webp, optional)')}</Typography.Text>
            <Input type="file" accept="image/*" multiple onChange={(e) => {
              if (e.target.files) setFiles(Array.from(e.target.files));
            }} />
            {files.length > 0 && (
              <Typography.Text size="small" type="tertiary">{files.length} {t('file(s) selected')}</Typography.Text>
            )}
          </div>
          <Button theme="solid" onClick={handleSubmit} loading={submitting}>
            {t('Confirm Submit')}
          </Button>
        </div>
      </Modal>
    </>
  );
};

const MySubmissions = ({ t }) => {
  const { data, loading } = useData('my', () =>
    API.get('/api/assessment/my').then(r => r.data)
  );

  if (loading) return <Spin />;
  const items = data?.data ?? [];
  if (items.length === 0) return <Empty title={t('No submissions yet')} />;

  return items.map((sub) => (
    <Card key={sub.id} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title heading={5}>{sub.assessment_title}</Typography.Title>
        <Tag color={sub.status === 1 ? 'blue' : sub.status === 2 ? 'red' : 'grey'}>
          {t(SUBMISSION_STATUS[sub.status] || 'Unknown')}
        </Tag>
      </div>
      <Typography.Text type="tertiary" size="small">
        {t('Submitted at')}: {dayjs.unix(sub.submitted_at).format('YYYY-MM-DD HH:mm')}
      </Typography.Text>
      <div style={{ marginTop: 8 }}>
        <Typography.Paragraph>{sub.content}</Typography.Paragraph>
        {sub.screenshots && sub.screenshots.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {sub.screenshots.map((s, i) => (
              <img key={i} src={`/api/assessment/screenshot/${s}`} alt={`screenshot-${i}`}
                style={{ width: 96, height: 96, borderRadius: 4, border: '1px solid var(--semi-color-border)', objectFit: 'cover' }} />
            ))}
          </div>
        )}
        {sub.score != null && <Typography.Text strong>{t('Score')}: {sub.score}</Typography.Text>}
        {sub.comment && <Typography.Text type="tertiary">{t('Comment')}: {sub.comment}</Typography.Text>}
      </div>
    </Card>
  ));
};

const MyStats = ({ t }) => {
  const { data, loading } = useData('my-stats', () =>
    API.get('/api/assessment/my/stats').then(r => r.data)
  );

  if (loading) return <Spin />;
  const s = data?.data ?? {};

  return (
    <Card>
      <Typography.Title heading={5}>{t('My Assessment Statistics')}</Typography.Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center', marginTop: 12 }}>
        <div><Typography.Text style={{ fontSize: 24, fontWeight: 'bold' }}>{s.total_submissions ?? 0}</Typography.Text><br />
          <Typography.Text type="tertiary" size="small">{t('Total Submissions')}</Typography.Text></div>
        <div><Typography.Text style={{ fontSize: 24, fontWeight: 'bold' }}>{s.passed ?? 0}</Typography.Text><br />
          <Typography.Text type="tertiary" size="small">{t('Passed')}</Typography.Text></div>
        <div><Typography.Text style={{ fontSize: 24, fontWeight: 'bold' }}>{s.average_score ?? 0}</Typography.Text><br />
          <Typography.Text type="tertiary" size="small">{t('Average Score')}</Typography.Text></div>
      </div>
    </Card>
  );
};

const AdminView = ({ t }) => (
  <div className="px-4 pt-[60px] mx-auto max-w-4xl">
    <Typography.Title heading={3}>{t('AI Code Review Assessment')}</Typography.Title>
    <Tabs defaultActiveKey="manage" style={{ marginTop: 16 }}>
      <TabPane tab={t('Manage Assessments')} itemKey="manage">
        <AdminManage t={t} />
      </TabPane>
      <TabPane tab={t('Review Submissions')} itemKey="review">
        <AdminReview t={t} />
      </TabPane>
    </Tabs>
  </div>
);

const AdminManage = ({ t }) => {
  const { data, loading, reload } = useData('all', () =>
    API.get('/api/assessment/all').then(r => r.data)
  );
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '', max_score: 100, status: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: '', description: '', start_time: '', end_time: '', max_score: 100, status: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      title: item.title, description: item.description,
      start_time: dayjs.unix(item.start_time).format('YYYY-MM-DDTHH:mm'),
      end_time: dayjs.unix(item.end_time).format('YYYY-MM-DDTHH:mm'),
      max_score: item.max_score, status: item.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description,
        start_time: dayjs(form.start_time).unix(),
        end_time: dayjs(form.end_time).unix(),
        max_score: form.max_score, status: form.status,
      };
      if (editItem) {
        await API.put('/api/assessment', { ...payload, id: editItem.id });
        showSuccess(t('Updated successfully'));
      } else {
        await API.post('/api/assessment', payload);
        showSuccess(t('Created successfully'));
      }
      setDialogOpen(false);
      reload();
    } catch {
      showError(t('Operation failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/api/assessment/${id}`);
      showSuccess(t('Deleted successfully'));
      reload();
    } catch {
      showError(t('Deletion failed'));
    }
  };

  if (loading) return <Spin />;
  const items = data?.data ?? [];

  return (
    <>
      <Button theme="solid" onClick={openCreate}>{t('Create Assessment')}</Button>
      {items.length === 0 && <Empty title={t('No assessments yet')} />}
      {items.map((item) => (
        <Card key={item.id} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Title heading={5}>{item.title}</Typography.Title>
            <div style={{ display: 'flex', gap: 8 }}>
              <Tag color={item.status === 1 ? 'blue' : item.status === 2 ? 'grey' : 'yellow'}>
                {t(ASSESS_STATUS[item.status] || 'Unknown')}
              </Tag>
              <Button size="small" onClick={() => openEdit(item)}>{t('Edit')}</Button>
              <Button size="small" type="danger" onClick={() => handleDelete(item.id)}>{t('Delete')}</Button>
            </div>
          </div>
          <Typography.Text type="tertiary" size="small">
            {dayjs.unix(item.start_time).format('YYYY-MM-DD HH:mm')} ~ {dayjs.unix(item.end_time).format('YYYY-MM-DD HH:mm')} | {t('Max Score')}: {item.max_score}
          </Typography.Text>
          <Typography.Paragraph style={{ marginTop: 8 }}>{item.description}</Typography.Paragraph>
        </Card>
      ))}

      <Modal visible={dialogOpen} title={editItem ? t('Edit Assessment') : t('Create Assessment')}
        onCancel={() => setDialogOpen(false)} footer={null}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><Typography.Text strong>{t('Title')}</Typography.Text>
            <Input value={form.title} onChange={v => setForm({ ...form, title: v })} /></div>
          <div><Typography.Text strong>{t('Description')}</Typography.Text>
            <Textarea value={form.description} onChange={v => setForm({ ...form, description: v })} rows={3} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Typography.Text strong>{t('Start Time')}</Typography.Text>
              <Input type="datetime-local" value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} /></div>
            <div><Typography.Text strong>{t('End Time')}</Typography.Text>
              <Input type="datetime-local" value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Typography.Text strong>{t('Max Score')}</Typography.Text>
              <Input type="number" value={form.max_score} onChange={v => setForm({ ...form, max_score: Number(v) })} /></div>
            <div><Typography.Text strong>{t('Status')}</Typography.Text>
              <Select value={String(form.status)} onChange={v => setForm({ ...form, status: Number(v) })}>
                <Select.Option value="0">{t('Not Started')}</Select.Option>
                <Select.Option value="1">{t('In Progress')}</Select.Option>
                <Select.Option value="2">{t('Ended')}</Select.Option>
              </Select></div>
          </div>
          <Button theme="solid" onClick={handleSave} loading={saving}>{t('Save')}</Button>
        </div>
      </Modal>
    </>
  );
};

const AdminReview = ({ t }) => {
  const { data: assessments } = useData('all', () =>
    API.get('/api/assessment/all').then(r => r.data)
  );
  const [selectedId, setSelectedId] = useState(null);
  const { data: submissions, loading: subsLoading, reload: reloadSubs } = useData(
    'subs-' + selectedId, () => selectedId ? API.get(`/api/assessment/${selectedId}/submissions`).then(r => r.data) : Promise.resolve({ data: [] }), [selectedId]
  );
  const { data: stats } = useData(
    'stats-' + selectedId, () => selectedId ? API.get(`/api/assessment/${selectedId}/stats`).then(r => r.data) : Promise.resolve(null), [selectedId]
  );
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ status: 1, score: 0, comment: '' });
  const [reviewing, setReviewing] = useState(false);

  const handleReview = async () => {
    if (!reviewingId) return;
    setReviewing(true);
    try {
      await API.post('/api/assessment/review', { id: reviewingId, ...reviewForm });
      showSuccess(t('Review submitted successfully'));
      setReviewingId(null);
      reloadSubs();
    } catch {
      showError(t('Review failed'));
    } finally {
      setReviewing(false);
    }
  };

  const items = assessments?.data ?? [];
  const subs = submissions?.data ?? [];
  const s = stats?.data;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>{t('Select Assessment')}</Typography.Text>
        <Select placeholder={t('Select an assessment')} value={selectedId ? String(selectedId) : undefined}
          onChange={v => setSelectedId(Number(v))} style={{ width: '100%' }}>
          {items.map(a => <Select.Option key={a.id} value={String(a.id)}>{a.title}</Select.Option>)}
        </Select>
      </div>

      {s && (
        <Card style={{ marginBottom: 16 }}>
          <Typography.Title heading={6}>{t('Statistics')}</Typography.Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div><Typography.Text strong>{s.total}</Typography.Text><br /><Typography.Text size="small" type="tertiary">{t('Total')}</Typography.Text></div>
            <div><Typography.Text strong>{s.pending}</Typography.Text><br /><Typography.Text size="small" type="tertiary">{t('Pending')}</Typography.Text></div>
            <div><Typography.Text strong>{s.passed}</Typography.Text><br /><Typography.Text size="small" type="tertiary">{t('Passed')}</Typography.Text></div>
            <div><Typography.Text strong>{s.failed}</Typography.Text><br /><Typography.Text size="small" type="tertiary">{t('Failed')}</Typography.Text></div>
            <div><Typography.Text strong>{s.average_score}</Typography.Text><br /><Typography.Text size="small" type="tertiary">{t('Avg Score')}</Typography.Text></div>
          </div>
        </Card>
      )}

      {subsLoading && <Spin />}
      {!subsLoading && selectedId && subs.length === 0 && <Empty title={t('No submissions yet')} />}
      {subs.map((sub) => (
        <Card key={sub.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Typography.Title heading={6}>{sub.username} ({sub.email})</Typography.Title>
              <Typography.Text type="tertiary" size="small">
                {dayjs.unix(sub.submitted_at).format('YYYY-MM-DD HH:mm')}
              </Typography.Text>
            </div>
            <Tag color={sub.status === 1 ? 'blue' : sub.status === 2 ? 'red' : 'grey'}>
              {t(SUBMISSION_STATUS[sub.status] || 'Unknown')}
            </Tag>
          </div>
          <div style={{ marginTop: 8 }}>
            <Typography.Paragraph>{sub.content}</Typography.Paragraph>
            {sub.screenshots && sub.screenshots.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {sub.screenshots.map((s, i) => (
                  <img key={i} src={`/api/assessment/screenshot/${s}`} alt={`screenshot-${i}`}
                    style={{ width: 128, height: 128, borderRadius: 4, border: '1px solid var(--semi-color-border)', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => window.open(`/api/assessment/screenshot/${s}`, '_blank')} />
                ))}
              </div>
            )}
            {sub.score != null && <Typography.Text strong>{t('Score')}: {sub.score}</Typography.Text>}
            {sub.comment && <Typography.Text type="tertiary">{t('Comment')}: {sub.comment}</Typography.Text>}
            <div style={{ marginTop: 12, borderTop: '1px solid var(--semi-color-border)', paddingTop: 8 }}>
              {reviewingId === sub.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Typography.Text style={{ width: 60 }}>{t('Result')}</Typography.Text>
                    <Select value={String(reviewForm.status)} onChange={v => setReviewForm({ ...reviewForm, status: Number(v) })} style={{ width: 120 }}>
                      <Select.Option value="1">{t('Passed')}</Select.Option>
                      <Select.Option value="2">{t('Failed')}</Select.Option>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Typography.Text style={{ width: 60 }}>{t('Score')}</Typography.Text>
                    <Input type="number" style={{ width: 120 }} value={reviewForm.score}
                      onChange={v => setReviewForm({ ...reviewForm, score: Number(v) })} />
                  </div>
                  <div><Typography.Text>{t('Comment')}</Typography.Text>
                    <Textarea value={reviewForm.comment} onChange={v => setReviewForm({ ...reviewForm, comment: v })} rows={2} /></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" theme="solid" onClick={handleReview} loading={reviewing}>{t('Confirm')}</Button>
                    <Button size="small" onClick={() => setReviewingId(null)}>{t('Cancel')}</Button>
                  </div>
                </div>
              ) : (
                <Button size="small" onClick={() => {
                  setReviewingId(sub.id);
                  setReviewForm({ status: sub.status || 1, score: sub.score ?? 0, comment: sub.comment ?? '' });
                }}>
                  {sub.status === 0 ? t('Review') : t('Re-review')}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default Assessment;
