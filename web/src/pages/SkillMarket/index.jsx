import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, setUserData, showError, showSuccess, updateAPI } from '../../helpers';
import CardTable from '../../components/common/ui/CardTable';

const defaultSkillForm = {
  id: undefined,
  name: '',
  display_name: '',
  display_name_zh: '',
  description: '',
  description_zh: '',
  category: '',
  tags_text: '',
  source: 'community',
  source_platform: 'manual',
  source_skill_id: '',
  source_slug: '',
  url: '',
  download_url: '',
  author: '',
  version: '',
  downloads: 0,
  sort_order: 0,
  enabled: true,
  is_public: true,
};

const CATEGORY_PRESETS = [
  { value: 'productivity', label: '通用基础 / productivity' },
  { value: 'content-creation', label: '创作 / content-creation' },
  { value: 'education', label: '学术教育 / education' },
  { value: 'developer-tools', label: '开发技术 / developer-tools' },
  { value: 'ai-intelligence', label: '开发技术 / ai-intelligence' },
  { value: 'security-compliance', label: '安全合规 / security-compliance' },
  { value: 'legal', label: '安全合规 / legal' },
  { value: 'life', label: '生活 / life' },
  { value: 'communication-collaboration', label: '生活 / communication-collaboration' },
  { value: 'marketing', label: '自媒体营销 / marketing' },
  { value: '自媒体-小红书创作', label: '自媒体营销 / 小红书创作' },
  { value: '自媒体-小红书配图', label: '自媒体营销 / 小红书配图' },
  { value: '自媒体-小红书选题', label: '自媒体营销 / 小红书选题' },
  { value: '自媒体-小红书分析', label: '自媒体营销 / 小红书分析' },
  { value: '自媒体-小红书发布', label: '自媒体营销 / 小红书发布' },
  { value: '自媒体-抖音运营', label: '自媒体营销 / 抖音运营' },
  { value: '自媒体-多平台运营', label: '自媒体营销 / 多平台运营' },
  { value: 'finance', label: '财务金融 / finance' },
  { value: 'data-analysis', label: '财务金融 / data-analysis' },
];

const MYCLAW_NAV_LABELS = {
  productivity: '通用基础',
  'content-creation': '创作',
  education: '学术教育',
  'developer-tools': '开发技术',
  'ai-intelligence': '开发技术',
  'security-compliance': '安全合规',
  legal: '安全合规',
  life: '生活',
  'communication-collaboration': '生活',
  marketing: '自媒体营销',
  '自媒体-小红书创作': '自媒体营销',
  '自媒体-小红书配图': '自媒体营销',
  '自媒体-小红书选题': '自媒体营销',
  '自媒体-小红书分析': '自媒体营销',
  '自媒体-小红书发布': '自媒体营销',
  '自媒体-抖音运营': '自媒体营销',
  '自媒体-多平台运营': '自媒体营销',
  '自媒体-精选': '自媒体营销',
  finance: '财务金融',
  'data-analysis': '财务金融',
};

const normalizeSkillForm = (skill) => ({
  ...defaultSkillForm,
  ...skill,
  tags_text: Array.isArray(skill?.tags) ? skill.tags.join(', ') : '',
});

const parseTags = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getMylclawNavLabel = (category) => MYCLAW_NAV_LABELS[category] || '未匹配到现有导航';

const SkillMarket = () => {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingSkill, setEditingSkill] = useState(defaultSkillForm);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [statusLoadingMap, setStatusLoadingMap] = useState({});
  const [authReady, setAuthReady] = useState(false);
  const editRequestSeqRef = useRef(0);
  const navigate = useNavigate();

  const ensureSessionSynced = useCallback(async () => {
    const res = await API.get('/api/user/self');
    if (!res?.data?.success || !res?.data?.data) {
      throw new Error(res?.data?.message || '获取当前登录用户失败');
    }

    const serverUser = res.data.data;
    let localUser = null;
    try {
      const raw = localStorage.getItem('user');
      localUser = raw ? JSON.parse(raw) : null;
    } catch {
      localUser = null;
    }

    const needSync =
      !localUser ||
      String(localUser.id) !== String(serverUser.id) ||
      Number(localUser.role) !== Number(serverUser.role);

    if (needSync) {
      setUserData(serverUser);
      updateAPI();
    }
  }, []);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/client/admin/skills', { skipErrorHandler: true });
      if (res.data.success) {
        setSkills(res.data.data || []);
      } else {
        showError(res.data.message || '获取技能列表失败');
      }
    } catch (error) {
      showError(error.message || '获取技能列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSkillDetail = useCallback(async (id) => {
    setEditLoading(true);
    setEditError('');
    try {
      if (id === 'new' || !id) {
        setEditingSkill(defaultSkillForm);
        return;
      }

      const fallback = skills.find((skill) => String(skill.id) === String(id));
      if (fallback) {
        setEditingSkill(normalizeSkillForm(fallback));
        setEditError('');
      } else {
        setEditingSkill(defaultSkillForm);
        setEditError('当前技能未在列表中找到，请先点击“刷新”后再编辑');
      }
    } catch (error) {
      const errorMsg = error.message || '读取编辑数据失败';
      setEditError(errorMsg);
      showError(errorMsg);
    } finally {
      setEditLoading(false);
    }
  }, [skills]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        await ensureSessionSynced();
        await loadSkills();
      } catch (error) {
        showError(error.message || '登录态校验失败，请重新登录');
      } finally {
        if (mounted) setAuthReady(true);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [ensureSessionSynced, loadSkills]);

  const filteredSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (statusFilter === 'enabled' && !skill.enabled) return false;
      if (statusFilter === 'disabled' && skill.enabled) return false;
      if (statusFilter === 'public' && !skill.is_public) return false;
      if (statusFilter === 'private' && skill.is_public) return false;
      if (categoryFilter !== 'all' && (skill.category || '') !== categoryFilter) return false;

      if (!keyword) return true;

      const content = [
        skill.name,
        skill.display_name,
        skill.display_name_zh,
        skill.description,
        skill.description_zh,
        skill.category,
        ...(Array.isArray(skill.tags) ? skill.tags : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return content.includes(keyword);
    });
  }, [categoryFilter, query, skills, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, categoryFilter]);

  const paginatedSkills = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSkills.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredSkills, pageSize]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(
      new Set(skills.map((skill) => skill.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    return values.map((value) => ({
      value,
      label: `${getMylclawNavLabel(value)} / ${value}`,
    }));
  }, [skills]);

  const statusSummary = useMemo(
    () => ({
      total: skills.length,
      enabled: skills.filter((skill) => skill.enabled).length,
      public: skills.filter((skill) => skill.is_public).length,
    }),
    [skills]
  );

  const matchedEditSkill = useMemo(() => {
    if (!editingSkill?.id) return null;
    return skills.find((skill) => String(skill.id) === String(editingSkill.id)) || null;
  }, [editingSkill?.id, skills]);

  const openCreateEditor = () => {
    navigate('/console/skill-market/edit/new');
  };

  const openEditEditor = (skill) => {
    navigate(`/console/skill-market/edit/${skill.id}`);
  };

  const closeEditor = () => {
    editRequestSeqRef.current += 1;
    setEditingSkill(defaultSkillForm);
    setEditLoading(false);
    setEditError('');
  };

  const getPreviewUrl = (skill) => {
    if (skill?.url?.trim()) {
      const url = skill.url.trim();
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith('/')) return `${window.location.origin}${url}`;
      return `https://${url}`;
    }
    return `${window.location.origin}/api/client/skills/${skill.id}`;
  };

  const submitSkill = async () => {
    if (!editingSkill.name.trim()) {
      showError('原始名称不能为空');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        skill: {
          ...editingSkill,
          name: editingSkill.name.trim(),
          display_name: editingSkill.display_name.trim(),
          display_name_zh: editingSkill.display_name_zh.trim(),
          description: editingSkill.description.trim(),
          description_zh: editingSkill.description_zh.trim(),
          category: editingSkill.category.trim(),
          tags: parseTags(editingSkill.tags_text),
          source: editingSkill.source.trim(),
          source_platform: editingSkill.source_platform.trim(),
          source_skill_id: editingSkill.source_skill_id.trim(),
          source_slug: editingSkill.source_slug.trim(),
          url: editingSkill.url.trim(),
          download_url: editingSkill.download_url.trim(),
          author: editingSkill.author.trim(),
          version: editingSkill.version.trim(),
          downloads: Number(editingSkill.downloads) || 0,
          sort_order: Number(editingSkill.sort_order) || 0,
        },
      };

      const isEdit = Boolean(editingSkill.id);
      const res = isEdit
        ? await API.put(`/api/client/admin/skills/${editingSkill.id}`, payload)
        : await API.post('/api/client/admin/skills', payload);

      if (res.data.success) {
        showSuccess(isEdit ? '技能已更新' : '技能已创建');
        closeEditor();
        await loadSkills();
      } else {
        showError(res.data.message || '保存失败');
      }
    } catch (error) {
      showError(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateSkillStatus = async (record, patch) => {
    const rowId = String(record.id);
    setStatusLoadingMap((prev) => ({ ...prev, [rowId]: true }));
    try {
      const res = await API.patch(`/api/client/admin/skills/${record.id}/status`, patch);
      if (res.data.success) {
        showSuccess('状态已更新');
        await loadSkills();
        if (String(editingSkill?.id) === rowId) {
          setEditingSkill((prev) => ({
            ...prev,
            ...patch,
          }));
        }
      } else {
        showError(res.data.message || '状态更新失败');
      }
    } catch (error) {
      showError(error.message || '状态更新失败');
    } finally {
      setStatusLoadingMap((prev) => ({ ...prev, [rowId]: false }));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '技能',
        dataIndex: 'name',
        key: 'skill',
        render: (_, record) => (
          <div className='min-w-0'>
            <div className='font-semibold text-[15px]'>
              {record.display_name_zh || record.display_name || record.name}
            </div>
            <div className='text-xs text-gray-500 break-all'>{record.name}</div>
          </div>
        ),
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        render: (value) => (
          <Space wrap spacing={4}>
            <Tag color='blue'>{value || '未分类'}</Tag>
            {value ? <Tag color='cyan'>{getMylclawNavLabel(value)}</Tag> : null}
          </Space>
        ),
      },
      {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        render: (_, record) => (
          <div className='text-sm'>
            <div>{record.source_platform || record.source || '-'}</div>
            {record.source_slug ? (
              <div className='text-xs text-gray-500 break-all'>{record.source_slug}</div>
            ) : null}
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'status',
        render: (_, record) => (
          <Space wrap>
            <Tag color={record.enabled ? 'green' : 'grey'}>
              {record.enabled ? '已启用' : '已停用'}
            </Tag>
            <Tag color={record.is_public ? 'cyan' : 'orange'}>
              {record.is_public ? '已上架' : '未上架'}
            </Tag>
          </Space>
        ),
      },
      {
        title: '下载',
        dataIndex: 'downloads',
        key: 'downloads',
        render: (value) => value || 0,
      },
      {
        title: '操作',
        key: 'operate',
        render: (_, record) => (
          <Space wrap>
            <Button size='small' theme='light' onClick={() => openEditEditor(record)}>
              设置
            </Button>
            <Button
              size='small'
              theme='borderless'
              onClick={() => window.open(getPreviewUrl(record), '_blank', 'noopener,noreferrer')}
            >
              预览
            </Button>
            <Popconfirm
              title='确认上架该技能？'
              content='上架后会在 myclaw 技能商店可见'
              onConfirm={() => void updateSkillStatus(record, { is_public: true })}
              disabled={record.is_public}
            >
              <Button
                size='small'
                type='primary'
                theme='light'
                disabled={record.is_public}
                loading={Boolean(statusLoadingMap[String(record.id)])}
              >
                上架
              </Button>
            </Popconfirm>
            <Popconfirm
              title='确认下架该技能？'
              content='下架后不会在 myclaw 技能商店展示'
              onConfirm={() => void updateSkillStatus(record, { is_public: false })}
              disabled={!record.is_public}
            >
              <Button
                size='small'
                type='danger'
                theme='light'
                disabled={!record.is_public}
                loading={Boolean(statusLoadingMap[String(record.id)])}
              >
                下架
              </Button>
            </Popconfirm>
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-500'>启用</span>
              <Switch
                size='small'
                checked={record.enabled}
                disabled={Boolean(statusLoadingMap[String(record.id)])}
                onChange={(checked) => void updateSkillStatus(record, { enabled: checked })}
              />
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-500'>上架</span>
              <Switch
                size='small'
                checked={record.is_public}
                disabled={Boolean(statusLoadingMap[String(record.id)])}
                onChange={(checked) => void updateSkillStatus(record, { is_public: checked })}
              />
            </div>
          </Space>
        ),
      },
    ],
    [editingSkill?.id, statusLoadingMap]
  );

  return (
    <div className='mt-[60px] px-2'>
      <div className='rounded-2xl border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] p-4 shadow-sm'>
        <div className='mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div>
            <Typography.Title heading={4} style={{ marginBottom: 4 }}>
              技能管理
            </Typography.Title>
            <Typography.Text type='tertiary'>
              统一管理 myclaw 技能商店的上架、下架、中文别名和展示信息
            </Typography.Text>
          </div>
          <Space wrap>
            <Input
              showClear
              placeholder='搜索技能名、中文别名、分类'
              value={query}
              onChange={setQuery}
              style={{ width: 280 }}
            />
            <Button theme='light' onClick={() => void loadSkills()}>
              刷新
            </Button>
            <Button type='primary' onClick={openCreateEditor}>
              新增技能
            </Button>
          </Space>
        </div>

        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <Tag color='blue'>总数 {statusSummary.total}</Tag>
          <Tag color='green'>已启用 {statusSummary.enabled}</Tag>
          <Tag color='cyan'>已上架 {statusSummary.public}</Tag>
          <Tag color='grey'>筛选后 {filteredSkills.length}</Tag>
        </div>

        <div className='mb-4 grid grid-cols-1 gap-3 md:grid-cols-4'>
          <div>
            <div className='mb-1 text-xs text-gray-500'>状态筛选</div>
            <select
              className='w-full rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] px-3 py-2 text-sm'
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value='all'>全部状态</option>
              <option value='enabled'>仅已启用</option>
              <option value='disabled'>仅已停用</option>
              <option value='public'>仅已上架</option>
              <option value='private'>仅未上架</option>
            </select>
          </div>
          <div>
            <div className='mb-1 text-xs text-gray-500'>分类筛选</div>
            <select
              className='w-full rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] px-3 py-2 text-sm'
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value='all'>全部分类</option>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className='mb-1 text-xs text-gray-500'>每页条数</div>
            <select
              className='w-full rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] px-3 py-2 text-sm'
              value={String(pageSize)}
              onChange={(event) => {
                setCurrentPage(1);
                setPageSize(Number(event.target.value));
              }}
            >
              <option value='10'>10 条</option>
              <option value='20'>20 条</option>
              <option value='50'>50 条</option>
            </select>
          </div>
          <div className='flex items-end'>
            <Button
              theme='light'
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
                setCategoryFilter('all');
                setCurrentPage(1);
                setPageSize(10);
              }}
            >
              重置筛选
            </Button>
          </div>
        </div>

        <CardTable
          rowKey='id'
          columns={columns}
          dataSource={paginatedSkills}
          loading={loading}
          pagination={{
            currentPage,
            pageSize,
            total: filteredSkills.length,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            onShowSizeChange: (page, size) => {
              setCurrentPage(1);
              setPageSize(size);
            },
          }}
          empty={
            <Empty
              image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
              darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
              description='当前没有技能数据'
              style={{ padding: 30 }}
            />
          }
        />
      </div>
    </div>
  );
};

export default SkillMarket;
