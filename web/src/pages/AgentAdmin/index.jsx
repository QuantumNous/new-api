import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Switch,
  Table,
  Tabs,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import {
  adminCreateKBDoc,
  adminDeleteKBDoc,
  adminListAgentAudit,
  adminListAgentTools,
  adminListKBDocs,
  adminUpdateAgentTool,
} from '../../services/agent';
import { showError, showSuccess } from '../../helpers';

const { Title, Text } = Typography;

const AgentAdmin = () => {
  const [tools, setTools] = useState([]);
  const [docs, setDocs] = useState([]);
  const [audit, setAudit] = useState([]);
  const [docForm, setDocForm] = useState({ title: '', source: '', content: '' });
  const [loading, setLoading] = useState(false);

  const loadTools = async () => {
    const res = await adminListAgentTools();
    if (res.data?.success) setTools(res.data.data || []);
  };

  const loadDocs = async () => {
    const res = await adminListKBDocs();
    if (res.data?.success) setDocs(res.data.data || []);
  };

  const loadAudit = async () => {
    const res = await adminListAgentAudit({ page_size: 50 });
    if (res.data?.success) setAudit(res.data.data?.items || []);
  };

  useEffect(() => {
    loadTools().catch((error) => showError(error.message));
    loadDocs().catch((error) => showError(error.message));
    loadAudit().catch((error) => showError(error.message));
  }, []);

  const updateTool = async (name, enabled) => {
    try {
      await adminUpdateAgentTool(name, enabled);
      showSuccess('Tool updated');
      await loadTools();
    } catch (error) {
      showError(error.message || 'Failed to update tool');
    }
  };

  const createDoc = async () => {
    if (!docForm.title.trim() || !docForm.content.trim()) {
      showError('Title and content are required');
      return;
    }
    setLoading(true);
    try {
      await adminCreateKBDoc(docForm);
      setDocForm({ title: '', source: '', content: '' });
      showSuccess('Knowledge document added');
      await loadDocs();
    } catch (error) {
      showError(error.message || 'Failed to create document');
    } finally {
      setLoading(false);
    }
  };

  const deleteDoc = async (id) => {
    try {
      await adminDeleteKBDoc(id);
      showSuccess('Knowledge document deleted');
      await loadDocs();
    } catch (error) {
      showError(error.message || 'Failed to delete document');
    }
  };

  return (
    <div className='mt-[60px] p-4'>
      <div className='mb-4'>
        <Title heading={4}>Agent Admin</Title>
        <Text type='tertiary'>
          Tool switches, knowledge base entries, and audit trail.
        </Text>
      </div>
      <Tabs type='card'>
        <Tabs.TabPane tab='Tools' itemKey='tools'>
          <Card>
            <Table
              dataSource={tools}
              rowKey={(row) => row.tool?.name}
              pagination={false}
              columns={[
                {
                  title: 'Tool',
                  dataIndex: 'tool',
                  render: (tool) => (
                    <div>
                      <div className='font-medium'>{tool?.name}</div>
                      <Text type='tertiary' size='small'>
                        {tool?.description}
                      </Text>
                    </div>
                  ),
                },
                {
                  title: 'Risk',
                  dataIndex: 'tool',
                  width: 120,
                  render: (tool) => tool?.risk_level || 'low',
                },
                {
                  title: 'Enabled',
                  dataIndex: 'enabled',
                  width: 120,
                  render: (enabled, row) => (
                    <Switch
                      checked={enabled}
                      onChange={(value) => updateTool(row.tool.name, value)}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Tabs.TabPane>
        <Tabs.TabPane tab='Knowledge Base' itemKey='kb'>
          <div className='grid gap-4 lg:grid-cols-[360px_1fr]'>
            <Card title='Add document'>
              <div className='flex flex-col gap-3'>
                <Input
                  placeholder='Title'
                  value={docForm.title}
                  onChange={(value) => setDocForm({ ...docForm, title: value })}
                />
                <Input
                  placeholder='Source'
                  value={docForm.source}
                  onChange={(value) => setDocForm({ ...docForm, source: value })}
                />
                <TextArea
                  autosize={{ minRows: 8, maxRows: 16 }}
                  placeholder='Paste help content'
                  value={docForm.content}
                  onChange={(value) =>
                    setDocForm({ ...docForm, content: value })
                  }
                />
                <Button type='primary' loading={loading} onClick={createDoc}>
                  Add
                </Button>
              </div>
            </Card>
            <Card title='Documents'>
              <Table
                dataSource={docs}
                rowKey='id'
                pagination={false}
                columns={[
                  { title: 'ID', dataIndex: 'id', width: 80 },
                  { title: 'Title', dataIndex: 'title' },
                  { title: 'Chunks', dataIndex: 'chunks_count', width: 100 },
                  {
                    title: 'Action',
                    width: 120,
                    render: (_, row) => (
                      <Button
                        type='danger'
                        size='small'
                        onClick={() => deleteDoc(row.id)}
                      >
                        Delete
                      </Button>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab='Audit' itemKey='audit'>
          <Card>
            <Table
              dataSource={audit}
              rowKey='id'
              pagination={false}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 80 },
                { title: 'User', dataIndex: 'user_id', width: 90 },
                { title: 'Tool', dataIndex: 'tool_name' },
                { title: 'Status', dataIndex: 'status', width: 110 },
                { title: 'Confirmed', dataIndex: 'confirmed', width: 110 },
                { title: 'Duration', dataIndex: 'duration_ms', width: 110 },
                { title: 'Created', dataIndex: 'created_at', width: 180 },
              ]}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AgentAdmin;
