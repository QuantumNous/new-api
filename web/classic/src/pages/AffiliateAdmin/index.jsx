/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Space,
  Table,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';
import {
  buildAffiliateProfilePayload,
  buildAffiliateProfilesQuery,
  getAffiliateProfileLevelText,
  getAffiliateProfileStatusMeta,
  validateAffiliateProfilePayload,
} from './affiliateAdminProfiles';
import {
  buildAffiliateCommissionAdjustmentPayload,
  buildAffiliateCommissionRecomputePayload,
  buildAffiliateSettlementRunPayload,
  formatAffiliateCentsRMB,
  validateAffiliateCommissionAdjustmentPayload,
  validateAffiliateCommissionRecomputePayload,
  validateAffiliateSettlementRunPayload,
} from './affiliateAdminFinance';
import {
  buildAffiliateRuleSetDraftFormValues,
  buildAffiliateRuleSetDraftPayload,
  buildAffiliateRuleSetCopyDraftFormValues,
  buildAffiliateRuleSetDiffPreview,
  buildAffiliateRuleSetExportJson,
  buildAffiliateRuleSetRollbackConfirmation,
  buildAffiliateRuleSetRollbackPayload,
  buildAffiliateRuleSetsQuery,
  buildAffiliateRuleSetSaveConfirmation,
  buildAffiliateRuleSetStatusConfirmation,
  buildAffiliateRuleSetStatusPayload,
  getAffiliateRuleSetStatusMeta,
  isAffiliateRuleSetReadOnly,
  parseAffiliateRuleSetImportJson,
  validateAffiliateRuleSetDraftPayload,
} from './affiliateAdminRules';
import { RuleLevelGroupedEditor } from './RuleArrayEditor';

const { Text, Title } = Typography;

const DEFAULT_PAGE_SIZE = 10;

const normalizeLookupUserId = (value) => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : 0;
};

const UserLookupHint = ({ t, userId }) => {
  const normalizedUserId = normalizeLookupUserId(userId);
  const [state, setState] = useState({
    loading: false,
    username: '',
    displayName: '',
    error: false,
  });

  useEffect(() => {
    if (!normalizedUserId) {
      setState({ loading: false, username: '', displayName: '', error: false });
      return;
    }

    let active = true;
    setState({ loading: true, username: '', displayName: '', error: false });
    API.get(`/api/user/${normalizedUserId}`, {
      timeout: 5000,
      skipErrorHandler: true,
    })
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data?.data) {
          setState({
            loading: false,
            username: res.data.data.username || '',
            displayName: res.data.data.display_name || '',
            error: false,
          });
          return;
        }
        setState({
          loading: false,
          username: '',
          displayName: '',
          error: true,
        });
      })
      .catch(() => {
        if (!active) return;
        setState({
          loading: false,
          username: '',
          displayName: '',
          error: true,
        });
      });

    return () => {
      active = false;
    };
  }, [normalizedUserId]);

  if (!normalizedUserId) {
    return (
      <Text type='tertiary' size='small'>
        {t('输入用户 ID 后自动显示用户名')}
      </Text>
    );
  }
  if (state.loading) {
    return (
      <Text type='tertiary' size='small'>
        {t('正在查询用户名')}
      </Text>
    );
  }
  if (!state.error) {
    return (
      <Text type='tertiary' size='small'>
        {t('用户名')}：{state.displayName || state.username || '-'}
      </Text>
    );
  }
  return (
    <Text type='danger' size='small'>
      {t('用户不存在或无权限查看')}
    </Text>
  );
};

const AffiliateAdmin = () => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [financeLoading, setFinanceLoading] = useState('');
  const [lastFinanceResult, setLastFinanceResult] = useState('');
  const [ruleSets, setRuleSets] = useState([]);
  const [ruleSetLoading, setRuleSetLoading] = useState(false);
  const [ruleSetSubmitLoading, setRuleSetSubmitLoading] = useState(false);
  const [ruleSetActionLoading, setRuleSetActionLoading] = useState('');
  const [ruleSetFilters, setRuleSetFilters] = useState({});
  const [ruleSetPage, setRuleSetPage] = useState(1);
  const [ruleSetPageSize, setRuleSetPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [ruleSetTotal, setRuleSetTotal] = useState(0);
  const [selectedRuleSet, setSelectedRuleSet] = useState(null);
  const [ruleSetFormKey, setRuleSetFormKey] = useState(0);
  const [ruleSetDraftFormApi, setRuleSetDraftFormApi] = useState(null);
  const [ruleEditorMode, setRuleEditorMode] = useState('visual');
  const [ruleSetInitialValues, setRuleSetInitialValues] = useState(() =>
    buildAffiliateRuleSetDraftFormValues(),
  );
  const [ruleSetBaselineValues, setRuleSetBaselineValues] = useState(() =>
    buildAffiliateRuleSetDraftFormValues(),
  );
  const [ruleSetTransferText, setRuleSetTransferText] = useState('');
  const [ruleSetTransferError, setRuleSetTransferError] = useState('');
  const [ruleSetDiffPreview, setRuleSetDiffPreview] = useState([]);
  const [ruleSetReadOnly, setRuleSetReadOnly] = useState(false);
  const [profileLookupIds, setProfileLookupIds] = useState({
    user_id: '',
    parent_user_id: '',
  });

  const loadProfiles = async (
    nextPage = page,
    nextPageSize = pageSize,
    nextFilters = filters,
  ) => {
    setLoading(true);
    try {
      const res = await API.get(
        buildAffiliateProfilesQuery({
          page: nextPage,
          pageSize: nextPageSize,
          filters: nextFilters,
        }),
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('分销商列表加载失败'));
        return;
      }
      setProfiles(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setPage(Number(data?.page || nextPage));
      setPageSize(Number(data?.page_size || nextPageSize));
    } catch (error) {
      showError(t('分销商列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles(1, DEFAULT_PAGE_SIZE, {});
    loadRuleSets(1, DEFAULT_PAGE_SIZE, {});
  }, []);

  const handleCreateOrUpdate = async (values) => {
    const payload = buildAffiliateProfilePayload(values);
    const validationError = validateAffiliateProfilePayload(t, payload);
    if (validationError) {
      showError(validationError);
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await API.post('/api/affiliate/admin/profiles', payload);
      const { success, message } = res.data;
      if (!success) {
        showError(message || t('保存分销商失败'));
        return;
      }
      showSuccess(t('分销商已保存'));
      await loadProfiles(1, pageSize, filters);
    } catch (error) {
      showError(t('保存分销商失败'));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStatusChange = async (record, status) => {
    try {
      const res = await API.patch(
        `/api/affiliate/admin/profiles/${record.user_id}/status`,
        {
          status,
          reason:
            status === 'active'
              ? t('管理员在分销管理页启用')
              : t('管理员在分销管理页禁用'),
        },
      );
      const { success, message } = res.data;
      if (!success) {
        showError(message || t('分销商状态更新失败'));
        return;
      }
      showSuccess(t('分销商状态已更新'));
      await loadProfiles(page, pageSize, filters);
    } catch (error) {
      showError(t('分销商状态更新失败'));
    }
  };

  const handleSettlementRun = async (values) => {
    const payload = buildAffiliateSettlementRunPayload(values);
    const validationError = validateAffiliateSettlementRunPayload(t, payload);
    if (validationError) {
      showError(validationError);
      return;
    }

    setFinanceLoading('settlement-run');
    try {
      const res = await API.post(
        '/api/affiliate/admin/settlement-runs',
        payload,
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('结算编排失败'));
        return;
      }
      const settlementCount = Number(data?.settlement_count || 0);
      setLastFinanceResult(
        t(
          '结算编排已完成：KPI {{kpi}}，佣金 {{commission}}，人头费 {{headFee}}，结算单 {{settlement}}',
        )
          .replace('{{kpi}}', String(data?.kpi_snapshot_count || 0))
          .replace('{{commission}}', String(data?.commission_event_count || 0))
          .replace('{{headFee}}', String(data?.head_fee_event_count || 0))
          .replace('{{settlement}}', String(settlementCount)),
      );
      showSuccess(t('结算编排已完成'));
    } catch (error) {
      showError(t('结算编排失败'));
    } finally {
      setFinanceLoading('');
    }
  };

  const handleCommissionRecompute = async (values) => {
    const payload = buildAffiliateCommissionRecomputePayload(values);
    const validationError = validateAffiliateCommissionRecomputePayload(
      t,
      payload,
    );
    if (validationError) {
      showError(validationError);
      return;
    }

    setFinanceLoading('commission-recompute');
    try {
      const res = await API.post(
        '/api/affiliate/admin/commissions/recompute',
        payload,
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('佣金重算失败'));
        return;
      }
      setLastFinanceResult(
        t('佣金重算已完成：作废 {{voided}}，新建 {{created}}')
          .replace('{{voided}}', String(data?.voided_event_count || 0))
          .replace('{{created}}', String(data?.created_event_count || 0)),
      );
      showSuccess(t('佣金重算已完成'));
    } catch (error) {
      showError(t('佣金重算失败'));
    } finally {
      setFinanceLoading('');
    }
  };

  const handleCommissionAdjustment = async (values) => {
    const payload = buildAffiliateCommissionAdjustmentPayload(values);
    const validationError = validateAffiliateCommissionAdjustmentPayload(
      t,
      payload,
    );
    if (validationError) {
      showError(validationError);
      return;
    }

    setFinanceLoading('commission-adjustment');
    try {
      const res = await API.post(
        '/api/affiliate/admin/commissions/adjust',
        payload,
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('佣金调整失败'));
        return;
      }
      setLastFinanceResult(
        t('佣金调整已创建：{{amount}}').replace(
          '{{amount}}',
          formatAffiliateCentsRMB(data?.commission_cents),
        ),
      );
      showSuccess(t('佣金调整已创建'));
    } catch (error) {
      showError(t('佣金调整失败'));
    } finally {
      setFinanceLoading('');
    }
  };

  const loadRuleSets = async (
    nextPage = ruleSetPage,
    nextPageSize = ruleSetPageSize,
    nextFilters = ruleSetFilters,
  ) => {
    setRuleSetLoading(true);
    try {
      const res = await API.get(
        buildAffiliateRuleSetsQuery({
          page: nextPage,
          pageSize: nextPageSize,
          filters: nextFilters,
        }),
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('规则集列表加载失败'));
        return;
      }
      setRuleSets(Array.isArray(data?.items) ? data.items : []);
      setRuleSetTotal(Number(data?.total || 0));
      setRuleSetPage(Number(data?.page || nextPage));
      setRuleSetPageSize(Number(data?.page_size || nextPageSize));
    } catch (error) {
      showError(t('规则集列表加载失败'));
    } finally {
      setRuleSetLoading(false);
    }
  };

  const handleRuleSetFilterSubmit = (values) => {
    const nextFilters = { status: values.status };
    setRuleSetFilters(nextFilters);
    loadRuleSets(1, ruleSetPageSize, nextFilters);
  };

  const handleRuleSetSelect = (record) => {
    const nextValues = buildAffiliateRuleSetDraftFormValues(record);
    setSelectedRuleSet(record);
    setRuleSetInitialValues(nextValues);
    setRuleSetBaselineValues(nextValues);
    setRuleSetDiffPreview([]);
    setRuleSetReadOnly(isAffiliateRuleSetReadOnly(record));
    setRuleEditorMode('visual');
    setRuleSetFormKey((value) => value + 1);
  };

  const handleRuleSetNew = () => {
    const nextValues = buildAffiliateRuleSetDraftFormValues();
    setSelectedRuleSet(null);
    setRuleSetInitialValues(nextValues);
    setRuleSetBaselineValues(nextValues);
    setRuleSetDiffPreview([]);
    setRuleSetReadOnly(false);
    setRuleEditorMode('visual');
    setRuleSetFormKey((value) => value + 1);
  };

  const handleRuleSetCopy = (record) => {
    setSelectedRuleSet(null);
    setRuleSetInitialValues(buildAffiliateRuleSetCopyDraftFormValues(record));
    setRuleSetBaselineValues(buildAffiliateRuleSetDraftFormValues(record));
    setRuleSetDiffPreview([]);
    setRuleSetReadOnly(false);
    setRuleEditorMode('visual');
    setRuleSetFormKey((value) => value + 1);
  };

  const getRuleSetFormValues = () =>
    ruleSetDraftFormApi?.getValues?.() || ruleSetInitialValues;

  const handleRuleSetExport = () => {
    try {
      setRuleSetTransferText(
        buildAffiliateRuleSetExportJson(getRuleSetFormValues()),
      );
      setRuleSetTransferError('');
      showSuccess(t('规则草稿 JSON 已导出'));
    } catch (error) {
      const message = error.message || t('规则 JSON 格式错误');
      setRuleSetTransferError(message);
      showError(message);
    }
  };

  const handleRuleSetImport = () => {
    if (ruleSetReadOnly) {
      showError(t('已发布和已归档规则集只读，请复制为草稿后再编辑'));
      return;
    }
    try {
      const imported = parseAffiliateRuleSetImportJson(ruleSetTransferText);
      setSelectedRuleSet(null);
      setRuleSetInitialValues(imported);
      ruleSetDraftFormApi?.setValues?.(imported);
      setRuleSetDiffPreview(
        buildAffiliateRuleSetDiffPreview(ruleSetBaselineValues, imported),
      );
      setRuleSetTransferError('');
      showSuccess(t('规则草稿 JSON 已导入'));
    } catch (error) {
      const message = error.message || t('规则 JSON 格式错误');
      setRuleSetTransferError(message);
      showError(message);
    }
  };

  const handleRuleSetDiffPreview = () => {
    try {
      setRuleSetDiffPreview(
        buildAffiliateRuleSetDiffPreview(
          ruleSetBaselineValues,
          getRuleSetFormValues(),
        ),
      );
    } catch (error) {
      showError(error.message || t('规则 JSON 格式错误'));
    }
  };

  const handleRuleSetDraftSubmit = async (values) => {
    if (ruleSetReadOnly) {
      showError(t('已发布和已归档规则集只读，请复制为草稿后再编辑'));
      return;
    }
    let payload;
    try {
      payload = buildAffiliateRuleSetDraftPayload(values);
    } catch (error) {
      showError(error.message || t('规则 JSON 格式错误'));
      return;
    }

    const validationError = validateAffiliateRuleSetDraftPayload(t, payload);
    if (validationError) {
      showError(validationError);
      return;
    }
    if (payload.id > 0 || selectedRuleSet?.id > 0) {
      const confirmation = buildAffiliateRuleSetSaveConfirmation(t, {
        id: payload.id || selectedRuleSet?.id,
        version: payload.version || selectedRuleSet?.version,
      });
      if (typeof window !== 'undefined' && !window.confirm(confirmation)) {
        return;
      }
    }

    setRuleSetSubmitLoading(true);
    try {
      const res = await API.post(
        '/api/affiliate/admin/rule-sets/draft',
        payload,
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('规则集草稿保存失败'));
        return;
      }
      showSuccess(t('规则集草稿已保存'));
      const nextValues = buildAffiliateRuleSetDraftFormValues(data || null);
      setSelectedRuleSet(data || null);
      setRuleSetInitialValues(nextValues);
      setRuleSetBaselineValues(nextValues);
      setRuleSetDiffPreview([]);
      setRuleSetReadOnly(isAffiliateRuleSetReadOnly(data || null));
      setRuleSetFormKey((value) => value + 1);
      await loadRuleSets(1, ruleSetPageSize, ruleSetFilters);
    } catch (error) {
      showError(t('规则集草稿保存失败'));
    } finally {
      setRuleSetSubmitLoading(false);
    }
  };

  const handleRuleSetStatusChange = async (record, action) => {
    const confirmation = buildAffiliateRuleSetStatusConfirmation(
      t,
      action,
      record,
    );
    if (typeof window !== 'undefined' && !window.confirm(confirmation)) {
      return;
    }
    const actionText = action === 'publish' ? t('发布') : t('归档');
    setRuleSetActionLoading(`${action}-${record.id}`);
    try {
      const res = await API.patch(
        `/api/affiliate/admin/rule-sets/${record.id}/${action}`,
        buildAffiliateRuleSetStatusPayload({
          reason: t('管理员在分销管理页{{action}}规则集').replace(
            '{{action}}',
            actionText,
          ),
        }),
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('规则集状态更新失败'));
        return;
      }
      showSuccess(t('规则集状态已更新'));
      const nextRuleSet = data || record;
      const nextValues = buildAffiliateRuleSetDraftFormValues(nextRuleSet);
      setSelectedRuleSet(nextRuleSet);
      setRuleSetInitialValues(nextValues);
      setRuleSetBaselineValues(nextValues);
      setRuleSetReadOnly(isAffiliateRuleSetReadOnly(nextRuleSet));
      setRuleSetDiffPreview([]);
      setRuleSetFormKey((value) => value + 1);
      await loadRuleSets(ruleSetPage, ruleSetPageSize, ruleSetFilters);
    } catch (error) {
      showError(t('规则集状态更新失败'));
    } finally {
      setRuleSetActionLoading('');
    }
  };

  const handleRuleSetRollback = async (record) => {
    const confirmation = buildAffiliateRuleSetRollbackConfirmation(t, record);
    if (typeof window !== 'undefined' && !window.confirm(confirmation)) {
      return;
    }
    setRuleSetActionLoading(`rollback-${record.id}`);
    try {
      const res = await API.post(
        `/api/affiliate/admin/rule-sets/${record.id}/rollback-draft`,
        buildAffiliateRuleSetRollbackPayload(t, record),
      );
      const { success, data, message } = res.data;
      if (!success) {
        showError(message || t('规则集回滚草稿创建失败'));
        return;
      }
      showSuccess(t('规则集回滚草稿已创建'));
      const nextRuleSet = data || null;
      const nextValues = buildAffiliateRuleSetDraftFormValues(nextRuleSet);
      setSelectedRuleSet(nextRuleSet);
      setRuleSetInitialValues(nextValues);
      setRuleSetBaselineValues(nextValues);
      setRuleSetReadOnly(false);
      setRuleSetDiffPreview([]);
      setRuleEditorMode('visual');
      setRuleSetFormKey((value) => value + 1);
      await loadRuleSets(1, ruleSetPageSize, ruleSetFilters);
    } catch (error) {
      showError(t('规则集回滚草稿创建失败'));
    } finally {
      setRuleSetActionLoading('');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('用户 ID'),
        dataIndex: 'user_id',
        width: 180,
        render: (value, record) => (
          <div className='flex flex-col'>
            <Text>{value}</Text>
            <Text type='secondary' size='small'>
              {record.username || '-'}
            </Text>
          </div>
        ),
      },
      {
        title: t('分销等级'),
        dataIndex: 'level',
        width: 140,
        render: (level) => getAffiliateProfileLevelText(t, level),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (status) => {
          const meta = getAffiliateProfileStatusMeta(t, status);
          return <Tag color={meta.type}>{meta.label}</Tag>;
        },
      },
      {
        title: t('上级用户 ID'),
        dataIndex: 'parent_user_id',
        width: 170,
        render: (value, record) =>
          value ? (
            <div className='flex flex-col'>
              <Text>{value}</Text>
              <Text type='secondary' size='small'>
                {record.parent_username || '-'}
              </Text>
            </div>
          ) : (
            '-'
          ),
      },
      {
        title: t('邀请码'),
        dataIndex: 'invite_code',
        width: 140,
        render: (value, record) => value || record.aff_code || '-',
      },
      {
        title: t('更新时间'),
        dataIndex: 'updated_at',
        width: 170,
        render: (value) => (value ? timestamp2string(value) : '-'),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        width: 140,
        render: (_, record) => (
          <Space>
            {record.status === 'active' ? (
              <Button
                size='small'
                type='danger'
                theme='outline'
                onClick={() => handleStatusChange(record, 'disabled')}
              >
                {t('禁用')}
              </Button>
            ) : (
              <Button
                size='small'
                type='primary'
                theme='outline'
                onClick={() => handleStatusChange(record, 'active')}
              >
                {t('启用')}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [t, page, pageSize, filters],
  );

  const ruleSetColumns = useMemo(
    () => [
      {
        title: t('规则集 ID'),
        dataIndex: 'id',
        width: 100,
      },
      {
        title: t('版本'),
        dataIndex: 'version',
        width: 170,
      },
      {
        title: t('名称'),
        dataIndex: 'name',
        width: 190,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        width: 100,
        render: (status) => {
          const meta = getAffiliateRuleSetStatusMeta(t, status);
          return <Tag color={meta.type}>{meta.label}</Tag>;
        },
      },
      {
        title: t('生效窗口'),
        dataIndex: 'effective_start',
        width: 240,
        render: (_, record) => {
          const start = record.effective_start
            ? timestamp2string(record.effective_start)
            : t('立即');
          const end = record.effective_end
            ? timestamp2string(record.effective_end)
            : t('长期');
          return `${start} - ${end}`;
        },
      },
      {
        title: t('发布时间'),
        dataIndex: 'published_at',
        width: 170,
        render: (value) => (value ? timestamp2string(value) : '-'),
      },
      {
        title: t('操作'),
        dataIndex: 'operate',
        fixed: 'right',
        width: 300,
        render: (_, record) => (
          <Space>
            <Button
              size='small'
              type='tertiary'
              theme='outline'
              onClick={() => handleRuleSetSelect(record)}
            >
              {isAffiliateRuleSetReadOnly(record) ? t('查看') : t('编辑')}
            </Button>
            <Button
              size='small'
              type='tertiary'
              theme='outline'
              onClick={() => handleRuleSetCopy(record)}
            >
              {t('复制草稿')}
            </Button>
            {isAffiliateRuleSetReadOnly(record) && (
              <Button
                size='small'
                type='tertiary'
                theme='outline'
                loading={ruleSetActionLoading === `rollback-${record.id}`}
                onClick={() => handleRuleSetRollback(record)}
              >
                {t('回滚草稿')}
              </Button>
            )}
            {record.status === 'draft' && (
              <Button
                size='small'
                type='primary'
                theme='outline'
                loading={ruleSetActionLoading === `publish-${record.id}`}
                onClick={() => handleRuleSetStatusChange(record, 'publish')}
              >
                {t('发布')}
              </Button>
            )}
            {record.status !== 'archived' && (
              <Button
                size='small'
                type='warning'
                theme='outline'
                loading={ruleSetActionLoading === `archive-${record.id}`}
                onClick={() => handleRuleSetStatusChange(record, 'archive')}
              >
                {t('归档')}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [t, ruleSetActionLoading, ruleSetPage, ruleSetPageSize, ruleSetFilters],
  );

  const handleFilterSubmit = (values) => {
    const nextFilters = {
      user_id: values.user_id,
      level: values.level,
      status: values.status,
    };
    setFilters(nextFilters);
    loadProfiles(1, pageSize, nextFilters);
  };

  return (
    <div className='mt-[60px] px-2'>
      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col gap-2 mb-4'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <Title heading={4}>{t('分销管理')}</Title>
            <Link to='/console/user' className='no-underline'>
              <Button type='tertiary'>{t('跳转用户管理')}</Button>
            </Link>
          </div>
          <Text type='secondary'>
            {t(
              '管理员可在这里指定一级/二级分销商；二级分销商必须绑定一个已启用的一级分销商。',
            )}
          </Text>
        </div>
        <Form
          layout='vertical'
          onSubmit={handleCreateOrUpdate}
          initValues={{ level: 1 }}
        >
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start'>
            <div>
              <Form.InputNumber
                field='user_id'
                label={t('用户 ID')}
                min={1}
                onChange={(value) =>
                  setProfileLookupIds((current) => ({
                    ...current,
                    user_id: value,
                  }))
                }
              />
              <UserLookupHint t={t} userId={profileLookupIds.user_id} />
            </div>
            <Form.Select
              field='level'
              label={t('分销等级')}
              optionList={[
                { label: t('一级分销商'), value: 1 },
                { label: t('二级分销商'), value: 2 },
              ]}
            />
            <div>
              <Form.InputNumber
                field='parent_user_id'
                label={t('上级用户 ID')}
                min={0}
                placeholder={t('二级分销商必填')}
                onChange={(value) =>
                  setProfileLookupIds((current) => ({
                    ...current,
                    parent_user_id: value,
                  }))
                }
              />
              <UserLookupHint t={t} userId={profileLookupIds.parent_user_id} />
            </div>
            <Form.Input
              field='invite_code'
              label={t('邀请码')}
              placeholder={t('留空使用用户邀请码')}
            />
            <Form.Input field='reason' label={t('操作原因')} />
          </div>
          <div className='mt-3 flex justify-end'>
            <Button
              className='min-w-[140px]'
              htmlType='submit'
              type='primary'
              loading={submitLoading}
            >
              {t('保存分销商')}
            </Button>
          </div>
        </Form>
      </Card>

      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col gap-2 mb-4'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <Title heading={4}>{t('规则集配置')}</Title>
            <Button type='tertiary' onClick={handleRuleSetNew}>
              {t('新建默认规则草稿')}
            </Button>
          </div>
          <Text type='secondary'>
            {t(
              '规则集保存为版本化草稿后才能发布；发布会归档旧 published 规则。JSON 区块可完整修改分佣区间、KPI、质量门槛、人头费和结算配置。',
            )}
          </Text>
        </div>

        <Form layout='vertical' onSubmit={handleRuleSetFilterSubmit}>
          <div className='grid grid-cols-1 md:grid-cols-[minmax(260px,360px)_auto] gap-3 items-end'>
            <Form.Select
              className='w-full'
              field='status'
              label={t('规则状态')}
              optionList={[
                { label: t('全部'), value: '' },
                { label: t('草稿'), value: 'draft' },
                { label: t('已发布'), value: 'published' },
                { label: t('已归档'), value: 'archived' },
              ]}
            />
            <div className='flex items-end h-full pt-[30px]'>
              <Button
                className='w-full md:min-w-[84px]'
                htmlType='submit'
                type='primary'
              >
                {t('筛选')}
              </Button>
            </div>
          </div>
        </Form>

        <Table
          className='mt-4'
          columns={ruleSetColumns}
          dataSource={ruleSets}
          rowKey='id'
          loading={ruleSetLoading}
          pagination={{
            currentPage: ruleSetPage,
            pageSize: ruleSetPageSize,
            total: ruleSetTotal,
            showSizeChanger: true,
            onPageChange: (nextPage) =>
              loadRuleSets(nextPage, ruleSetPageSize, ruleSetFilters),
            onPageSizeChange: (nextPageSize) =>
              loadRuleSets(1, nextPageSize, ruleSetFilters),
          }}
          scroll={{ x: 1200 }}
        />

        <div className='mt-4'>
          <Title heading={5}>
            {ruleSetReadOnly
              ? t('查看规则集')
              : selectedRuleSet
                ? t('编辑规则集草稿')
                : t('新建规则集草稿')}
          </Title>
          {ruleSetReadOnly && (
            <Text type='secondary'>
              {t('已发布和已归档规则集只读，请复制为草稿后再编辑。')}
            </Text>
          )}
          <Form
            key={`${selectedRuleSet?.id || 'new'}-${ruleSetFormKey}`}
            className='mt-3'
            layout='vertical'
            initValues={ruleSetInitialValues}
            getFormApi={(api) => setRuleSetDraftFormApi(api)}
            onSubmit={handleRuleSetDraftSubmit}
          >
            <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3'>
              <Form.InputNumber
                field='id'
                label={t('规则集 ID')}
                min={0}
                disabled={ruleSetReadOnly}
              />
              <Form.Input
                field='version'
                label={t('版本')}
                disabled={ruleSetReadOnly}
              />
              <Form.Input
                field='name'
                label={t('名称')}
                disabled={ruleSetReadOnly}
              />
              <Form.Input
                field='reason'
                label={t('操作原因')}
                disabled={ruleSetReadOnly}
              />
              <Form.InputNumber
                field='effective_start'
                label={t('生效开始时间戳')}
                min={0}
                disabled={ruleSetReadOnly}
              />
              <Form.InputNumber
                field='effective_end'
                label={t('生效结束时间戳')}
                min={0}
                disabled={ruleSetReadOnly}
              />
              <Form.Select
                field='settlement_cycle'
                label={t('结算周期')}
                optionList={[
                  { label: t('按自然月'), value: 'monthly' },
                  { label: t('每 30 天'), value: '30d' },
                  { label: t('每 14 天'), value: '14d' },
                  { label: t('每 7 天'), value: '7d' },
                ]}
                disabled={ruleSetReadOnly}
              />
              <Form.InputNumber
                field='freeze_days'
                label={t('冻结天数')}
                min={0}
                disabled={ruleSetReadOnly}
              />
              <Form.InputNumber
                field='min_settlement_amount_yuan'
                label={t('Minimum Settlement Amount (yuan)')}
                min={0}
                step={0.01}
                disabled={ruleSetReadOnly}
              />
              <Form.Switch
                field='manual_review_enabled'
                label={t('人工审核')}
                disabled={ruleSetReadOnly}
              />
              <Form.Switch
                field='auto_settlement_enabled'
                label={t('自动结算')}
                disabled={ruleSetReadOnly}
              />
              <Form.TextArea
                field='review_note'
                label={t('审核备注')}
                autosize={{ minRows: 2, maxRows: 4 }}
                disabled={ruleSetReadOnly}
              />
            </div>
            <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-3 mt-4'>
              <div>
                <Text strong>{t('规则导入 / 导出 JSON')}</Text>
                <TextArea
                  className='mt-2'
                  autosize={{ minRows: 5, maxRows: 12 }}
                  value={ruleSetTransferText}
                  placeholder={t('可导出当前草稿，或粘贴规则 JSON 后导入')}
                  onChange={setRuleSetTransferText}
                />
                {ruleSetTransferError && (
                  <Text className='mt-1 block' type='danger'>
                    {ruleSetTransferError}
                  </Text>
                )}
              </div>
              <div className='rounded-lg border p-3'>
                <Text strong>{t('规则草稿差异预览')}</Text>
                <div>
                  <Text type='secondary'>
                    {t('保存前可预览相对当前选中版本的变更。')}
                  </Text>
                </div>
                <div className='mt-3 max-h-48 overflow-auto'>
                  {ruleSetDiffPreview.length === 0 ? (
                    <Text type='secondary'>{t('暂无草稿变更')}</Text>
                  ) : (
                    <table className='min-w-full border-collapse text-sm'>
                      <thead className='bg-semi-color-fill-0'>
                        <tr>
                          <th className='border-b px-3 py-2 text-left'>
                            {t('Section')}
                          </th>
                          <th className='border-b px-3 py-2 text-left'>
                            {t('Before')}
                          </th>
                          <th className='border-b px-3 py-2 text-left'>
                            {t('After')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ruleSetDiffPreview.map((item) => (
                          <tr key={item.section}>
                            <td className='border-b px-3 py-2'>
                              {t(item.section)}
                            </td>
                            <td className='border-b px-3 py-2'>
                              {item.before === 'changed'
                                ? t('Changed')
                                : item.before}
                            </td>
                            <td className='border-b px-3 py-2'>
                              {item.after === 'changed'
                                ? t('Changed')
                                : item.after}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            <div className='flex flex-col gap-3 mt-2'>
              <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-2'>
                <div>
                  <Text strong>{t('规则明细')}</Text>
                  <div>
                    <Text type='secondary'>
                      {t('可在可编辑规则表格与原始 JSON 文本之间切换。')}
                    </Text>
                  </div>
                </div>
                <Space>
                  <Button
                    htmlType='button'
                    type={ruleEditorMode === 'visual' ? 'primary' : 'tertiary'}
                    onClick={() => setRuleEditorMode('visual')}
                  >
                    {t('可视化')}
                  </Button>
                  <Button
                    htmlType='button'
                    type={ruleEditorMode === 'json' ? 'primary' : 'tertiary'}
                    onClick={() => setRuleEditorMode('json')}
                  >
                    JSON
                  </Button>
                </Space>
              </div>

              {ruleEditorMode === 'visual' ? (
                <RuleLevelGroupedEditor
                  t={t}
                  formApi={ruleSetDraftFormApi}
                  readOnly={ruleSetReadOnly}
                  sections={[
                    {
                      title: t('Commission Base Rules'),
                      field: 'commission_rules_json',
                      description: t(
                        'Set default rate, cap rate, and minimum settlement amount by affiliate level.',
                      ),
                    },
                    {
                      title: t('Commission Tiers'),
                      field: 'commission_tiers_json',
                      description: t(
                        'Set commission rate and cap by accumulated net paid ranges.',
                      ),
                    },
                    {
                      title: t('KPI Tiers'),
                      field: 'kpi_tiers_json',
                      description: t(
                        'Set KPI coefficients by effective new users, net paid amount, and quality metrics.',
                      ),
                    },
                    {
                      title: t('Head Fee Rules'),
                      field: 'head_fee_rules_json',
                      description: t(
                        'Set head fee and unlock requirements by KPI tier.',
                      ),
                    },
                    {
                      title: t('Quality Thresholds'),
                      field: 'risk_rules_json',
                      description: t(
                        'Set quality/risk thresholds for gift-only ratio, abnormal ratio, refund ratio, and second-payment ratio.',
                      ),
                    },
                  ]}
                />
              ) : (
                <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
                  <Form.TextArea
                    field='commission_rules_json'
                    label={t('分佣基础规则 JSON')}
                    autosize
                    disabled={ruleSetReadOnly}
                  />
                  <Form.TextArea
                    field='commission_tiers_json'
                    label={t('分佣区间 JSON')}
                    autosize
                    disabled={ruleSetReadOnly}
                  />
                  <Form.TextArea
                    field='kpi_tiers_json'
                    label={t('KPI 档位 JSON')}
                    autosize
                    disabled={ruleSetReadOnly}
                  />
                  <Form.TextArea
                    field='head_fee_rules_json'
                    label={t('人头费规则 JSON')}
                    autosize
                    disabled={ruleSetReadOnly}
                  />
                  <Form.TextArea
                    field='risk_rules_json'
                    label={t('质量门槛 JSON')}
                    autosize
                    disabled={ruleSetReadOnly}
                  />
                </div>
              )}
            </div>
            <Space>
              <Button
                htmlType='submit'
                type='primary'
                loading={ruleSetSubmitLoading}
                disabled={ruleSetReadOnly}
              >
                {ruleSetReadOnly ? t('只读') : t('保存规则草稿')}
              </Button>
              <Text type='secondary'>
                {t('保存后可在上方列表发布或归档规则集。')}
              </Text>
              <Button
                htmlType='button'
                type='tertiary'
                onClick={handleRuleSetExport}
              >
                {t('导出 JSON')}
              </Button>
              <Button
                htmlType='button'
                type='tertiary'
                disabled={ruleSetReadOnly || !ruleSetTransferText.trim()}
                onClick={handleRuleSetImport}
              >
                {t('导入 JSON')}
              </Button>
              <Button
                htmlType='button'
                type='tertiary'
                onClick={handleRuleSetDiffPreview}
              >
                {t('预览变更')}
              </Button>
            </Space>
          </Form>
        </div>
      </Card>

      <Card className='!rounded-2xl mb-4'>
        <div className='flex flex-col gap-2 mb-4'>
          <Title heading={4}>{t('佣金与结算操作')}</Title>
          <Text type='secondary'>
            {t(
              '管理员可按周期运行 KPI、佣金、人头费和结算单编排，也可重算未入结算的佣金事件或创建人工调整。',
            )}
          </Text>
          {lastFinanceResult && <Text strong>{lastFinanceResult}</Text>}
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-3 gap-3'>
          <Card className='!rounded-xl' title={t('结算编排')}>
            <Form
              layout='vertical'
              onSubmit={handleSettlementRun}
              initValues={{ freeze_days: 7, usd_exchange_rate: 1 }}
            >
              <div className='grid grid-cols-2 gap-2 items-end'>
                <Form.InputNumber
                  field='rule_set_id'
                  label={t('规则集 ID')}
                  min={0}
                  placeholder={t('0 表示自动选择已发布规则')}
                />
                <Form.InputNumber
                  field='freeze_days'
                  label={t('冻结天数')}
                  min={0}
                />
                <div className='col-span-2'>
                  <Form.DatePicker
                    field='period_range'
                    label={t('结算周期')}
                    className='w-full'
                    type='dateTimeRange'
                    placeholder={[t('开始时间'), t('结束时间')]}
                    showClear
                  />
                </div>
                <Form.DatePicker
                  field='now_datetime'
                  label={t('执行时间')}
                  className='w-full'
                  type='dateTime'
                  placeholder={t('留空使用当前时间')}
                  showClear
                />
                <Form.InputNumber
                  field='quota_per_unit'
                  label={t('Quota 单位')}
                  min={0}
                  placeholder={t('留空使用系统默认')}
                />
                <Form.InputNumber
                  field='usd_exchange_rate'
                  label={t('CNY Exchange Rate (1:1)')}
                  min={0}
                  placeholder='1'
                />
                <Form.Input field='reason' label={t('操作原因')} />
                <Button
                  className='col-span-2'
                  htmlType='submit'
                  type='primary'
                  loading={financeLoading === 'settlement-run'}
                >
                  {t('运行结算编排')}
                </Button>
              </div>
            </Form>
          </Card>

          <Card className='!rounded-xl' title={t('佣金重算')}>
            <Form
              layout='vertical'
              onSubmit={handleCommissionRecompute}
              initValues={{ usd_exchange_rate: 1 }}
            >
              <div className='grid grid-cols-2 gap-2 items-end'>
                <Form.InputNumber
                  field='rule_set_id'
                  label={t('规则集 ID')}
                  min={0}
                  placeholder={t('0 表示自动选择已发布规则')}
                />
                <Form.InputNumber
                  field='quota_per_unit'
                  label={t('Quota 单位')}
                  min={0}
                  placeholder={t('留空使用系统默认')}
                />
                <div className='col-span-2'>
                  <Form.DatePicker
                    field='period_range'
                    label={t('重算周期')}
                    className='w-full'
                    type='dateTimeRange'
                    placeholder={[t('开始时间'), t('结束时间')]}
                    showClear
                  />
                </div>
                <Form.InputNumber
                  field='usd_exchange_rate'
                  label={t('CNY Exchange Rate (1:1)')}
                  min={0}
                  placeholder='1'
                />
                <Form.Input field='reason' label={t('操作原因')} />
                <Button
                  className='col-span-2'
                  htmlType='submit'
                  type='warning'
                  loading={financeLoading === 'commission-recompute'}
                >
                  {t('重算佣金事件')}
                </Button>
              </div>
            </Form>
          </Card>

          <Card className='!rounded-xl' title={t('人工佣金调整')}>
            <Form layout='vertical' onSubmit={handleCommissionAdjustment}>
              <div className='grid grid-cols-2 gap-2 items-end'>
                <Form.InputNumber
                  field='affiliate_user_id'
                  label={t('分销商用户 ID')}
                  min={1}
                />
                <Form.InputNumber
                  field='downstream_user_id'
                  label={t('下游用户 ID')}
                  min={0}
                />
                <Form.InputNumber
                  field='rule_set_id'
                  label={t('规则集 ID')}
                  min={0}
                  placeholder={t('0 表示自动选择已发布规则')}
                />
                <Form.InputNumber
                  field='commission_yuan'
                  label={t('Adjustment Amount (yuan)')}
                  step={0.01}
                  placeholder={t('Use negative yuan for clawback')}
                />
                <div className='col-span-2'>
                  <Form.DatePicker
                    field='period_range'
                    label={t('调整周期')}
                    className='w-full'
                    type='dateTimeRange'
                    placeholder={[t('开始时间'), t('结束时间')]}
                    showClear
                  />
                </div>
                <Form.Input field='reason' label={t('操作原因')} />
                <Button
                  className='col-span-2'
                  htmlType='submit'
                  type='danger'
                  loading={financeLoading === 'commission-adjustment'}
                >
                  {t('创建人工调整')}
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      </Card>

      <Card className='!rounded-2xl'>
        <Form layout='vertical' onSubmit={handleFilterSubmit}>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(220px,260px)_minmax(240px,280px)_minmax(220px,260px)_auto] gap-3 items-end'>
            <Form.InputNumber
              field='user_id'
              label={t('用户 ID')}
              min={1}
              style={{ width: '100%' }}
            />
            <Form.Select
              field='level'
              label={t('分销等级')}
              style={{ width: '100%' }}
              optionList={[
                { label: t('全部'), value: '' },
                { label: t('一级分销商'), value: 1 },
                { label: t('二级分销商'), value: 2 },
              ]}
            />
            <Form.Select
              field='status'
              label={t('状态')}
              style={{ width: '100%' }}
              optionList={[
                { label: t('全部'), value: '' },
                { label: t('启用'), value: 'active' },
                { label: t('禁用'), value: 'disabled' },
              ]}
            />
            <div className='flex items-end gap-2 pt-[30px]'>
              <Button
                className='min-w-[88px]'
                htmlType='submit'
                type='primary'
                loading={loading}
              >
                {t('查询')}
              </Button>
              <Button
                className='min-w-[88px]'
                type='tertiary'
                onClick={() => {
                  setFilters({});
                  loadProfiles(1, pageSize, {});
                }}
              >
                {t('重置')}
              </Button>
            </div>
          </div>
        </Form>
        <Table
          className='mt-3'
          rowKey='id'
          columns={columns}
          dataSource={profiles}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onPageChange: (nextPage) =>
              loadProfiles(nextPage, pageSize, filters),
            onPageSizeChange: (nextPageSize) =>
              loadProfiles(1, nextPageSize, filters),
          }}
        />
      </Card>
    </div>
  );
};

export default AffiliateAdmin;
