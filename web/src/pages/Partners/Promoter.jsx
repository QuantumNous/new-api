import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

const promoterStyles = `
.promoter-page .bg-white {
  background-color: #ffffff;
}
.promoter-page .bg-white\/80 {
  background-color: rgba(255, 255, 255, 0.8);
}
.promoter-page .bg-slate-50 {
  background-color: #f8fafc;
}
.promoter-page .bg-slate-100 {
  background-color: #f1f5f9;
}
.promoter-page .text-white {
  color: #ffffff;
}
.promoter-page .border-slate-200 {
  border-color: #e2e8f0;
}
.promoter-page .border-slate-300 {
  border-color: #cbd5e1;
}
.promoter-page .infistar-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border-radius: 10px;
  border: 0;
  background: linear-gradient(135deg, #2f65ff, #7545ff);
  padding: 0 18px;
  color: #fff;
  font-weight: 800;
  box-shadow: 0 12px 28px rgba(71, 75, 255, 0.22);
}
.promoter-page .infistar-btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}
.promoter-page .infistar-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid #dbe4f0;
  background: #fff;
  padding: 0 18px;
  color: #2f62ff;
  font-weight: 800;
}
.promoter-page .entry-action {
  border-radius: 9px;
  border: 1px solid #dbe4f0;
  background: #fff;
  padding: 8px 12px;
  color: #2f62ff;
  font-size: 12px;
  font-weight: 800;
}
.promoter-page .portal-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  font-size: 13px;
}
.promoter-page .portal-table th {
  white-space: nowrap;
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
}
.promoter-page .portal-table td {
  white-space: nowrap;
  border-top: 1px solid #e2e8f0;
  padding: 13px 14px;
  color: #475569;
}
`;

const apiPrefix = '/api/partnership/promoter';

const tabs = [
  { key: 'overview', label: '推广概览', shortLabel: '概览' },
  { key: 'tools', label: '推广工具', shortLabel: '工具' },
  { key: 'data', label: '推广数据', shortLabel: '数据' },
  { key: 'withdrawals', label: '分佣提现', shortLabel: '分佣' },
  { key: 'rules', label: '规则说明', shortLabel: '规则' },
];

const rangeOptions = [
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'last90', label: '近90天' },
  { key: 'all', label: '全部' },
];

const tierRows = [
  ['0-5 万', '8%'],
  ['5-10 万', '10%'],
  ['10-30 万', '12%'],
  ['30-50 万', '15%'],
  ['50 万以上', '20%'],
];

function getLocalUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (error) {
    return null;
  }
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(/[￥,\s]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function money(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function copyText(text, label = '内容') {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => Toast.success(`${label}已复制`))
    .catch(() => Toast.warning('当前浏览器不支持自动复制'));
}

function downloadQrSvg(filename) {
  const svg = document.querySelector('[data-promoter-qr="main"]');
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function statusLabel(status) {
  const map = {
    active: '合作中',
    paused: '暂停中',
    frozen: '已冻结',
    terminated: '已终止',
  };
  return map[status] || status || '合作中';
}

function rowValue(row, keys, fallback = '-') {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }
  return fallback;
}

function isInRange(dateText, range) {
  if (range === 'all') return true;
  if (!dateText) return true;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'month') return date >= startOfMonth;
  if (range === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date >= start && date < startOfMonth;
  }
  const start90 = new Date(now);
  start90.setDate(now.getDate() - 90);
  return date >= start90;
}

const Promoter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [userRange, setUserRange] = useState('month');
  const [topupRange, setTopupRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [profile, setProfile] = useState(null);
  const [center, setCenter] = useState(null);
  const [credentialModal, setCredentialModal] = useState(null);
  const [credentialDraft, setCredentialDraft] = useState('');
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [payoutDraft, setPayoutDraft] = useState({
    identity_name: '',
    identity_no: '',
    bank_account_name: '',
    bank_account_no: '',
    bank_name: '',
    bank_branch: '',
  });

  const user = useMemo(() => getLocalUser(), []);
  const isLoggedIn = Boolean(user?.id);
  const snapshot = center || {};
  const portalProfile = snapshot.profile || profile || {};
  const stats = snapshot.stats || {};
  const users = normalizeRows(snapshot.users);
  const topups = normalizeRows(snapshot.topups);
  const statements = normalizeRows(snapshot.statements);
  const withdrawals = normalizeRows(snapshot.withdrawals);
  const receipt = snapshot.receipt || {};
  const isOpened = Boolean(snapshot.opened || profile?.opened);
  const promoterStatus = portalProfile.status || profile?.status || '';
  const restricted =
    promoterStatus === 'frozen' || promoterStatus === 'terminated';
  const recommendationCode =
    portalProfile.recommendation_code || profile?.recommendation_code || '';
  const recommendationPhrase =
    portalProfile.recommendation_phrase || profile?.recommendation_phrase || '';
  const recommendationLink =
    portalProfile.recommendation_link || profile?.recommendation_link || '';
  const remainingChanges =
    portalProfile.remaining_changes ?? profile?.remaining_changes ?? 0;

  const monthGmv = stats.month_effective_gmv || 0;
  const monthCommission = stats.month_commission || 0;
  const monthNewUsers = stats.month_new_users || 0;
  const monthTopupCount = stats.month_topup_count || 0;
  const availableWithdraw = stats.available_withdraw || 0;
  const withdrawingAmount = stats.withdrawing_amount || 0;
  const paidAmount = stats.paid_amount || 0;
  const currentRate = stats.current_rate || '12%';

  const filteredUsers = users.filter((item) =>
    isInRange(rowValue(item, ['locked_at', 'lockedAt'], ''), userRange),
  );
  const filteredTopups = topups.filter((item) =>
    isInRange(
      rowValue(item, ['date', 'occurred_at', 'occurredAt'], ''),
      topupRange,
    ),
  );
  const firstChargedUsers = filteredUsers.filter((item) =>
    String(rowValue(item, ['first_charge', 'firstCharge'], '')).includes(
      '已首充',
    ),
  ).length;

  const fetchPromoterState = async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMaintenance(false);
    try {
      const meRes = await API.get(`${apiPrefix}/me`, {
        skipErrorHandler: true,
      });
      const me = meRes.data;
      setProfile(me);
      if (me?.opened) {
        const centerRes = await API.get(`${apiPrefix}/center`, {
          skipErrorHandler: true,
        });
        setCenter(centerRes.data);
        const nextReceipt = centerRes.data?.receipt || {};
        setPayoutDraft({
          identity_name: nextReceipt.identity_name || '',
          identity_no: nextReceipt.identity_no || '',
          bank_account_name: nextReceipt.bank_account_name || '',
          bank_account_no: nextReceipt.bank_account_no || '',
          bank_name: nextReceipt.bank_name || '',
          bank_branch: nextReceipt.bank_branch || '',
        });
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem('user');
      } else {
        setMaintenance(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tabs.some((item) => item.key === tab)) setActiveTab(tab);
    fetchPromoterState();
  }, []);

  const goLogin = () => navigate('/login?return_to=/partners/promoter');

  const openPromoter = async () => {
    if (!isLoggedIn) {
      goLogin();
      return;
    }
    setOpening(true);
    try {
      await API.post(`${apiPrefix}/me/open`, {}, { skipErrorHandler: true });
      showSuccess(t('开通成功'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('开通失败，请稍后再试'));
    } finally {
      setOpening(false);
    }
  };

  const saveCredential = async () => {
    const value = credentialDraft.trim();
    if (!credentialModal || !value) return;
    try {
      await API.patch(
        `${apiPrefix}/referral-credential`,
        { credential_type: credentialModal, value },
        { skipErrorHandler: true },
      );
      setCredentialModal(null);
      showSuccess(t('保存成功'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('保存失败'));
    }
  };

  const savePayoutProfile = async () => {
    try {
      await API.put(`${apiPrefix}/payout-profile`, payoutDraft, {
        skipErrorHandler: true,
      });
      setPayoutModalVisible(false);
      showSuccess(t('收款资料已保存'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('保存失败'));
    }
  };

  const createWithdrawal = async () => {
    try {
      await API.post(
        `${apiPrefix}/withdrawals`,
        { amount: Number(withdrawAmount), note: withdrawNote },
        { skipErrorHandler: true },
      );
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawNote('');
      showSuccess(t('提现申请已提交'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('提交失败'));
    }
  };

  const openCredentialModal = (kind) => {
    setCredentialModal(kind);
    setCredentialDraft(
      kind === 'code' ? recommendationCode : recommendationPhrase,
    );
  };

  const renderOverview = () => (
    <div className='grid gap-5'>
      <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
        <SummaryStatCard
          color='purple'
          icon='userPlus'
          label='本月新增推广用户'
          value={`${monthNewUsers}`}
        />
        <SummaryStatCard
          color='blue'
          icon='chart'
          label='本月有效 GMV'
          value={money(monthGmv)}
        />
        <SummaryStatCard
          color='purple'
          icon='calendar'
          label='本月预估分佣'
          value={money(monthCommission)}
        />
        <SummaryStatCard
          color='amber'
          icon='wallet'
          label='可提现分佣'
          value={money(availableWithdraw)}
        />
      </div>

      <div className='grid gap-5 xl:grid-cols-[1fr_0.95fr]'>
        <Panel>
          <PanelTitle title='推广工具预览' />
          <div className='mt-4 grid gap-3'>
            <PreviewToolLine
              icon='link'
              label='推荐链接'
              value={recommendationLink}
              onClick={() => copyText(recommendationLink, '推广链接')}
            />
            <PreviewToolLine
              icon='message'
              label='推荐口令'
              value={recommendationPhrase}
              onClick={() => copyText(recommendationPhrase, '推荐口令')}
            />
            <PreviewToolLine
              icon='qr'
              label='推广二维码'
              value='扫码进入专属推广入口'
              action='下载'
              onClick={() =>
                downloadQrSvg(
                  `infistar-${recommendationCode || 'promoter'}-qr.svg`,
                )
              }
            />
          </div>
          <button
            className='infistar-btn-primary mt-4 w-full'
            type='button'
            onClick={() => setActiveTab('tools')}
          >
            进入推广工具
          </button>
        </Panel>

        <Panel>
          <PanelTitle title='二维码预览' />
          <div className='mt-4 flex flex-col items-center'>
            <QrPreview value={recommendationLink} />
            <button
              className='infistar-btn-secondary mt-4 w-full max-w-[240px]'
              type='button'
              onClick={() =>
                downloadQrSvg(
                  `infistar-${recommendationCode || 'promoter'}-qr.svg`,
                )
              }
            >
              下载二维码
            </button>
          </div>
        </Panel>
      </div>

      <div className='grid gap-5 xl:grid-cols-[1fr_0.95fr]'>
        <Panel>
          <PanelTitle title='本月趋势' />
          <TrendBars />
        </Panel>
        <Panel>
          <PanelTitle title='最近分佣' />
          <TableWrap>
            <table className='portal-table'>
              <thead>
                <tr>
                  <th>账单月份</th>
                  <th>有效 GMV</th>
                  <th>返佣比例</th>
                  <th>实结佣金</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {(statements.length
                  ? statements.slice(0, 3)
                  : [
                      {
                        month: '本月',
                        effective_gmv: monthGmv,
                        ratio: currentRate,
                        settled_commission: monthCommission,
                        status: '统计中',
                      },
                    ]
                ).map((item, index) => (
                  <tr key={rowValue(item, ['month'], index)}>
                    <td>{rowValue(item, ['month'])}</td>
                    <td>
                      {money(
                        rowValue(item, ['effective_gmv', 'effectiveGmv'], 0),
                      )}
                    </td>
                    <td>{rowValue(item, ['ratio'], currentRate)}</td>
                    <td>
                      {money(
                        rowValue(
                          item,
                          ['settled_commission', 'settledCommission'],
                          monthCommission,
                        ),
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        status={rowValue(item, ['status'], '统计中')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <button
            className='infistar-btn-secondary mx-auto mt-4 flex w-full max-w-[240px]'
            type='button'
            onClick={() => setActiveTab('withdrawals')}
          >
            查看分佣提现
          </button>
        </Panel>
      </div>
    </div>
  );

  const renderTools = () => (
    <div className='grid gap-5'>
      <div className='grid gap-5 xl:grid-cols-[1.08fr_0.92fr]'>
        <Panel>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <PanelTitle title='推荐信息' />
            <span className='rounded-full border border-[#dfe7ff] bg-[#f8fbff] px-3 py-1.5 text-xs font-extrabold text-[#2f62ff]'>
              今年还可修改 {remainingChanges} 次
            </span>
          </div>
          <div className='mt-5 grid gap-3'>
            <ToolInfoRow
              label='推荐链接'
              value={recommendationLink}
              onCopy={() => copyText(recommendationLink, '推广链接')}
              onEdit={() => openCredentialModal('code')}
              disabled={restricted}
            />
            <ToolInfoRow
              label='推荐口令'
              value={recommendationPhrase}
              onCopy={() => copyText(recommendationPhrase, '推荐口令')}
              onEdit={() => openCredentialModal('phrase')}
              disabled={restricted}
            />
          </div>
          <div className='mt-4 text-sm leading-6 text-slate-500'>
            修改推荐链接时，只会修改链接最后的专属后缀；修改后旧链接不再可用。
          </div>
        </Panel>

        <Panel>
          <PanelTitle title='带头像二维码' />
          <div className='mt-5 flex flex-col items-center'>
            <QrPreview value={recommendationLink} />
            <button
              className='infistar-btn-primary mt-5 w-full max-w-[320px]'
              type='button'
              onClick={() =>
                downloadQrSvg(
                  `infistar-${recommendationCode || 'promoter'}-qr.svg`,
                )
              }
            >
              下载二维码
            </button>
          </div>
        </Panel>
      </div>

      <div className='grid gap-5 lg:grid-cols-3'>
        <UseCaseCard
          color='purple'
          icon='userPlus'
          title='社群转发：用推荐口令更自然'
          detail='在社群或聊天中分享推荐口令，用户注册时手动填写即可归属。'
        />
        <UseCaseCard
          color='blue'
          icon='link'
          title='内容平台：用推荐链接更方便'
          detail='在文章、视频、评论区等内容平台分享推荐链接，用户点击即可注册。'
        />
        <UseCaseCard
          color='amber'
          icon='qr'
          title='海报物料：用带头像二维码更醒目'
          detail='将专属二维码添加到海报、宣传页等物料，扫码即可关注与注册。'
        />
      </div>

      <Panel>
        <PanelTitle title='推荐信息变更记录' />
        <CredentialChangeTable
          rows={normalizeRows(
            snapshot.credential_changes || snapshot.credentialChanges,
          )}
        />
      </Panel>
    </div>
  );

  const renderData = () => (
    <div className='grid gap-5'>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
        <InfoBox
          title='本月新增推广用户'
          value={`${monthNewUsers}`}
          detail='本月新建立推荐关系的用户数'
          color='purple'
        />
        <InfoBox
          title='本月已首充用户'
          value={`${firstChargedUsers}`}
          detail='本月推广用户中已完成首充的用户'
          color='cyan'
        />
        <InfoBox
          title='本月有效 GMV'
          value={money(monthGmv)}
          detail={`${monthTopupCount} 笔计入分佣的充值流水`}
          color='blue'
        />
        <InfoBox
          title='本月预估分佣'
          value={money(monthCommission)}
          detail='最终以月度分佣记录为准'
          color='amber'
        />
      </div>
      <Panel>
        <PanelHeader
          title='推广用户'
          hint='只展示脱敏用户 ID，不展示昵称、手机号、邮箱或实名信息。'
          right={<SegmentedRange value={userRange} onChange={setUserRange} />}
        />
        <UserTable rows={filteredUsers} />
      </Panel>
      <Panel>
        <PanelHeader
          title='充值流水'
          hint='按单笔展示有效 GMV，不按用户聚合，不展示用户累计值。'
          right={<SegmentedRange value={topupRange} onChange={setTopupRange} />}
        />
        <TopupTable rows={filteredTopups} />
      </Panel>
    </div>
  );

  const renderWithdrawals = () => (
    <div className='grid gap-5'>
      <div className='grid gap-3 md:grid-cols-3'>
        <InfoBox
          title='可提现分佣'
          value={money(availableWithdraw)}
          detail='已结算且满足提现条件'
          color='amber'
        />
        <InfoBox
          title='提现中'
          value={money(withdrawingAmount)}
          detail='已提交，等待财务处理'
          color='blue'
        />
        <InfoBox
          title='已提现'
          value={money(paidAmount)}
          detail='历史已完成金额'
          color='green'
        />
      </div>
      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <Panel>
          <PanelTitle
            title='月度分佣记录'
            hint='发布后可按可提现金额发起申请。'
          />
          <StatementTable rows={statements} />
        </Panel>
        <Panel>
          <PanelTitle
            title='申请提现'
            hint='收款信息确认后，可提交提现申请。'
          />
          <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4'>
            <div className='text-xs font-extrabold text-amber-700'>
              当前可提现
            </div>
            <div className='mt-1 text-3xl font-black text-amber-700'>
              {money(availableWithdraw)}
            </div>
          </div>
          <div className='mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3'>
            <div>
              <div className='text-sm font-black text-slate-950'>
                收款信息：{receipt.status || '未提交'}
              </div>
              <div className='mt-1 text-xs text-slate-500'>
                {receipt.identity_name || '-'} ·{' '}
                {receipt.bank_account_no || '-'}
              </div>
            </div>
            <button
              className='text-sm font-extrabold text-[#2f62ff]'
              type='button'
              onClick={() => setPayoutModalVisible(true)}
            >
              修改
            </button>
          </div>
          <button
            className='infistar-btn-primary mt-4 w-full'
            type='button'
            disabled={restricted}
            onClick={() => setWithdrawModalVisible(true)}
          >
            申请提现
          </button>
        </Panel>
      </div>
      <Panel>
        <PanelTitle title='提现记录' hint='前台不展示完整财务凭证。' />
        <WithdrawalTable rows={withdrawals} />
      </Panel>
    </div>
  );

  const renderRules = () => (
    <div className='grid gap-5'>
      <Panel>
        <PanelTitle
          title='分佣梯度'
          hint='按当月有效 GMV 对应区间计算，最终以月度分佣记录为准。'
        />
        <TableWrap>
          <table className='portal-table'>
            <thead>
              <tr>
                <th>月有效 GMV 区间</th>
                <th>分佣比例</th>
              </tr>
            </thead>
            <tbody>
              {tierRows.map(([range, ratio]) => (
                <tr key={range}>
                  <td className='font-bold text-slate-900'>{range}</td>
                  <td>{ratio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
      <Panel>
        <PanelTitle
          title='规则说明'
          hint='这里仅展示推广者需要了解的基础结算口径。'
        />
        <div className='mt-4 grid gap-3 md:grid-cols-2'>
          {[
            [
              '推荐关系',
              '用户通过你的推荐链接注册，或在注册页填写你的推荐口令后，会记录到你的推广数据中。',
            ],
            [
              '有效 GMV',
              '用户完成有效充值后，扣除退款和不参与分佣的项目，再进入分佣统计。',
            ],
            ['月度分佣', '系统按月生成分佣记录，确认后会更新可提现金额。'],
            [
              '提现申请',
              '有可提现分佣时，可以在分佣提现页提交申请，并查看处理进度。',
            ],
          ].map(([title, detail]) => (
            <RuleCard key={title} title={title} detail={detail} />
          ))}
        </div>
      </Panel>
    </div>
  );

  const renderCenter = () => (
    <div className='mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-8 lg:px-12'>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-black leading-tight text-slate-950'>
            我的联运后台
          </h1>
          <p className='mt-2 text-sm leading-6 text-slate-500'>
            推荐链接已生效，数据每日更新，最终结算以月度分佣为准。
          </p>
        </div>
        <span className='inline-flex items-center gap-2 rounded-full border border-[#dfe7ff] bg-[#f8fbff] px-4 py-2 text-sm font-extrabold text-[#2f62ff]'>
          <span className='h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#2f65ff] to-[#7545ff] shadow-[0_0_0_4px_rgba(47,107,255,0.12)]' />
          {statusLabel(promoterStatus)}
        </span>
      </header>
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <section className='mt-5'>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'data' && renderData()}
        {activeTab === 'withdrawals' && renderWithdrawals()}
        {activeTab === 'rules' && renderRules()}
      </section>
    </div>
  );

  if (loading) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center'>
        <Spin size='large' />
      </div>
    );
  }

  return (
    <main className='promoter-page header-offset-top header-offset-min-height overflow-x-hidden bg-[#f7f9fc] text-slate-950'>
      <style>{promoterStyles}</style>
      <div className='header-offset-min-height bg-[radial-gradient(circle_at_18%_10%,rgba(47,107,255,0.08),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(114,71,255,0.08),transparent_30%)]'>
        {maintenance ? (
          <MaintenanceState onRetry={fetchPromoterState} />
        ) : isOpened ? (
          renderCenter()
        ) : (
          <Landing loading={opening} onOpen={openPromoter} />
        )}
      </div>
      <Modal
        title={credentialModal === 'phrase' ? '修改推荐口令' : '修改推荐链接'}
        visible={Boolean(credentialModal)}
        onCancel={() => setCredentialModal(null)}
        onOk={saveCredential}
        okText='确认修改'
        cancelText='取消'
      >
        <p className='mb-4 text-sm leading-6 text-slate-500'>
          {credentialModal === 'code'
            ? '这里只修改链接最后的专属后缀，修改后旧推广链接将不再可用。'
            : '修改后，旧推荐口令将不再可用。'}
          今年还可修改 {remainingChanges} 次。
        </p>
        <Input
          value={credentialDraft}
          maxLength={64}
          onChange={setCredentialDraft}
        />
      </Modal>
      <Modal
        title='收款信息'
        visible={payoutModalVisible}
        onCancel={() => setPayoutModalVisible(false)}
        onOk={savePayoutProfile}
        okText='保存收款信息'
        cancelText='关闭'
      >
        <div className='grid gap-3'>
          {[
            ['identity_name', '真实姓名'],
            ['identity_no', '身份证号'],
            ['bank_account_name', '开户人姓名'],
            ['bank_account_no', '收款账号'],
            ['bank_name', '开户银行'],
            ['bank_branch', '开户支行'],
          ].map(([key, label]) => (
            <Input
              key={key}
              prefix={label}
              value={payoutDraft[key]}
              onChange={(value) =>
                setPayoutDraft((current) => ({ ...current, [key]: value }))
              }
            />
          ))}
        </div>
      </Modal>
      <Modal
        title='提交提现申请'
        visible={withdrawModalVisible}
        onCancel={() => setWithdrawModalVisible(false)}
        onOk={createWithdrawal}
        okText='提交提现申请'
        cancelText='取消'
      >
        <p className='mb-4 text-sm leading-6 text-slate-500'>
          可提现分佣 {money(availableWithdraw)}，可全部或部分提现。
        </p>
        <div className='grid gap-3'>
          <Input
            prefix='提现金额'
            value={withdrawAmount}
            onChange={setWithdrawAmount}
          />
          <Input
            prefix='备注'
            value={withdrawNote}
            onChange={setWithdrawNote}
          />
        </div>
      </Modal>
    </main>
  );
};

function Landing({ loading, onOpen }) {
  const benefits = [
    ['一键开通', '登录后即可开通，开通前不用填写资料。', 'userPlus', 'purple'],
    [
      '多种推荐方式',
      '链接、口令和二维码都能用，按你的习惯分享。',
      'link',
      'blue',
    ],
    ['持续分佣', '推广用户后续有效充值，合作期间都会计入。', 'chart', 'purple'],
    [
      '清晰数据',
      '推广用户和单笔有效充值都能查看，收益变化更清楚。',
      'calendar',
      'cyan',
    ],
    ['月度结算', '每月形成分佣记录，确认后可申请提现。', 'calendar', 'blue'],
    [
      '分佣提现',
      '需要提现时再补充收款信息，流程集中在分佣提现里。',
      'wallet',
      'amber',
    ],
  ];
  const scenarios = [
    [
      '稳定社群或客户群',
      '适合把 Infistar 作为常用 AI 服务入口推荐给成员，让有需求的人自然选择使用。',
      'userPlus',
      'cyan',
    ],
    [
      '教程、测评或内容分发',
      '可以把推荐链接放在文章、视频简介或评论区，让读者从内容里直接进入注册。',
      'link',
      'purple',
    ],
    [
      '工具清单或解决方案',
      '可把二维码和推荐口令放进资料包、交付文档或社群公告，方便长期复用。',
      'qr',
      'amber',
    ],
  ];
  return (
    <>
      <div className='mx-auto max-w-[1220px] px-4 pb-36 pt-10 sm:px-6'>
        <section className='grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-16'>
          <div>
            <div className='inline-flex items-center gap-2 rounded-full border border-[#dfe7ff] bg-white/80 px-3.5 py-2 text-sm font-extrabold text-[#2f62ff] shadow-[0_10px_28px_rgba(47,107,255,0.08)]'>
              <span className='h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#2f65ff] to-[#7545ff] shadow-[0_0_0_4px_rgba(47,107,255,0.12)]' />
              推广者联运 · 一键开通
            </div>
            <h1 className='mt-6 text-[40px] font-black leading-[1.08] text-slate-950 sm:text-[52px] lg:text-[56px]'>
              <span className='hidden whitespace-nowrap sm:inline'>
                推荐Infistar
              </span>
              <span className='sm:hidden'>
                推荐
                <br />
                Infistar
              </span>
              <br />
              <span className='bg-gradient-to-r from-[#2176ff] to-[#7357ff] bg-clip-text text-transparent'>
                持续获得合作分佣
              </span>
            </h1>
            <p className='mt-5 max-w-[620px] text-[15px] leading-8 text-slate-700 sm:text-[17px]'>
              如果你认可
              Infistar，可以把它分享给社群、客户或内容受众。用户通过你的专属入口完成注册并产生有效充值后，系统会按规则记录分佣。
            </p>
            <div className='mt-6 flex flex-wrap items-center gap-4'>
              <button
                className='infistar-btn-primary'
                type='button'
                onClick={onOpen}
                disabled={loading}
              >
                {loading ? '开通中...' : '立即开通联运'}
              </button>
            </div>
          </div>
          <aside className='rounded-lg border border-slate-200 bg-white p-7 shadow-[0_20px_54px_rgba(25,39,84,0.08)]'>
            <h2 className='text-xl font-black text-slate-950'>合作收益</h2>
            <div className='mt-6 grid gap-6'>
              <PreviewItem
                color='cyan'
                title='长期分佣'
                detail='不是一次性推荐，用户后续有效充值也会持续计入。'
                icon='userPlus'
              />
              <PreviewItem
                color='blue'
                title='月度结算'
                detail='每月形成分佣记录，明细和提现进度都能查看。'
                icon='calendar'
              />
              <PreviewItem
                color='purple'
                title='梯度分佣'
                detail='有效 GMV 越稳定，分佣比例按梯度提升，最高 20%。'
                icon='chart'
              />
            </div>
          </aside>
        </section>
        <section className='mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
          {benefits.map(([title, detail, icon, color]) => (
            <LandingFeatureCard
              key={title}
              color={color}
              detail={detail}
              icon={icon}
              title={title}
            />
          ))}
        </section>
        <section className='mt-16'>
          <h2 className='text-3xl font-black leading-tight text-slate-950'>
            适合自然推荐的场景
          </h2>
          <div className='mt-7 grid gap-5 lg:grid-cols-3'>
            {scenarios.map(([title, detail, icon, color]) => (
              <LandingScenarioCard
                key={title}
                color={color}
                detail={detail}
                icon={icon}
                title={title}
              />
            ))}
          </div>
        </section>
      </div>
      <div className='fixed inset-x-0 bottom-0 z-40 bg-white shadow-[0_-12px_36px_rgba(25,39,84,0.1)]'>
        <div className='mx-auto grid max-w-[1220px] items-center gap-3 px-4 py-3 sm:px-6 lg:min-h-[84px] lg:grid-cols-[1fr_180px]'>
          <div>
            <strong className='block text-base font-black text-slate-700'>
              准备好后就可以开始分享
            </strong>
            <span className='text-sm leading-6 text-slate-500'>
              开通后可复制链接、推荐口令和二维码。
            </span>
          </div>
          <button
            className='infistar-btn-primary w-full'
            type='button'
            onClick={onOpen}
            disabled={loading}
          >
            立即开通
          </button>
        </div>
      </div>
    </>
  );
}

function TabNav({ activeTab, setActiveTab }) {
  return (
    <nav
      className='mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm'
      aria-label='推广中心导航'
    >
      <div className='flex min-w-max gap-1'>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${activeTab === tab.key ? 'bg-gradient-to-br from-[#2f65ff] to-[#7545ff] text-white shadow-[0_10px_24px_rgba(71,75,255,0.18)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
            type='button'
            onClick={() => setActiveTab(tab.key)}
          >
            <span className='hidden sm:inline'>{tab.label}</span>
            <span className='sm:hidden'>{tab.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(25,39,84,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}
function PanelTitle({ title, hint }) {
  return (
    <div>
      <div className='text-lg font-black text-slate-950'>{title}</div>
      {hint ? (
        <div className='mt-1 text-xs leading-5 text-slate-500'>{hint}</div>
      ) : null}
    </div>
  );
}
function PanelHeader({ title, hint, right }) {
  return (
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <PanelTitle title={title} hint={hint} />
      {right}
    </div>
  );
}
function TableWrap({ children }) {
  return (
    <div className='mt-4 overflow-x-auto rounded-lg border border-slate-200'>
      {children}
    </div>
  );
}

function SummaryStatCard({ color, icon, label, value }) {
  return (
    <article className='grid min-h-[92px] grid-cols-[58px_1fr] items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(25,39,84,0.04)]'>
      <IconBubble color={color} icon={icon} />
      <div>
        <div className='text-sm font-bold text-slate-500'>{label}</div>
        <div className='mt-1 text-2xl font-black text-slate-950'>{value}</div>
      </div>
    </article>
  );
}
function InfoBox({ title, value, detail, color }) {
  return (
    <Panel>
      <div className='text-xs font-extrabold text-slate-500'>{title}</div>
      <div className={`mt-2 text-2xl font-black ${textColor(color)}`}>
        {value}
      </div>
      <div className='mt-2 text-sm leading-6 text-slate-500'>{detail}</div>
    </Panel>
  );
}
function PreviewToolLine({ icon, label, value, action = '复制', onClick }) {
  return (
    <div className='grid grid-cols-[44px_96px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3'>
      <MiniIconBubble color='blue' icon={icon} />
      <span className='text-sm font-bold text-slate-500'>{label}</span>
      <span className='truncate text-sm font-semibold text-slate-700'>
        {value || '-'}
      </span>
      <button className='entry-action' type='button' onClick={onClick}>
        {action}
      </button>
    </div>
  );
}
function ToolInfoRow({ label, value, onCopy, onEdit, disabled }) {
  return (
    <div className='grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[44px_88px_minmax(0,1fr)_auto] sm:items-center'>
      <MiniIconBubble
        color='purple'
        icon={label.includes('口令') ? 'message' : 'link'}
      />
      <div className='text-sm font-bold text-slate-500'>{label}</div>
      <div className='min-w-0 truncate text-sm font-semibold text-slate-700'>
        {value || '-'}
      </div>
      <div className='flex flex-wrap gap-2'>
        <button
          className='infistar-btn-primary h-10 min-w-[72px]'
          type='button'
          onClick={onCopy}
        >
          复制
        </button>
        <button
          className='infistar-btn-secondary h-10 min-w-[72px]'
          type='button'
          disabled={disabled}
          onClick={onEdit}
        >
          修改
        </button>
      </div>
    </div>
  );
}

function SegmentedRange({ value, onChange }) {
  return (
    <div className='flex rounded-lg border border-slate-200 bg-slate-50 p-1'>
      {rangeOptions.map((option) => (
        <button
          key={option.key}
          className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition ${value === option.key ? 'bg-white text-[#2f62ff] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          type='button'
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
function ReadonlyField({ label, value }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-white px-3 py-3'>
      <div className='text-xs text-slate-500'>{label}</div>
      <div className='mt-1 break-all text-sm font-black text-slate-950'>
        {value}
      </div>
    </div>
  );
}
function RuleCard({ title, detail }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-4'>
      <div className='text-sm font-black text-slate-950'>{title}</div>
      <div className='mt-2 text-sm leading-6 text-slate-600'>{detail}</div>
    </div>
  );
}

function UserTable({ rows }) {
  if (!rows.length)
    return (
      <EmptyState
        title='还没有推广用户'
        detail='复制推广链接、推荐口令或二维码，分享给需要 Infistar 的用户。'
      />
    );
  return (
    <TableWrap>
      <table className='portal-table'>
        <thead>
          <tr>
            <th>用户 ID</th>
            <th>绑定方式</th>
            <th>绑定时间</th>
            <th>首充状态</th>
            <th>用户状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={rowValue(item, ['masked_id', 'maskedId'], index)}>
              <td className='font-bold text-slate-900'>
                {rowValue(item, ['masked_id', 'maskedId'])}
              </td>
              <td>{rowValue(item, ['source', 'attribution_source'])}</td>
              <td>{rowValue(item, ['locked_at', 'lockedAt'])}</td>
              <td>
                <StatusBadge
                  status={rowValue(
                    item,
                    ['first_charge', 'firstCharge'],
                    '未首充',
                  )}
                />
              </td>
              <td>
                <StatusBadge
                  status={rowValue(item, ['status', 'user_status'], '正常')}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function TopupTable({ rows, compact = false }) {
  if (!rows.length)
    return (
      <EmptyState
        title='当前时间范围内没有充值流水'
        detail='推广用户产生有效充值后，会显示在这里。'
      />
    );
  return (
    <TableWrap>
      <table className='portal-table'>
        <thead>
          <tr>
            {compact ? (
              <>
                <th>日期</th>
                <th>记录</th>
                <th>用户 ID</th>
                <th>金额</th>
                <th>状态</th>
              </>
            ) : (
              <>
                <th>日期</th>
                <th>流水编号</th>
                <th>用户 ID</th>
                <th>类型</th>
                <th>单笔有效 GMV</th>
                <th>预估分佣</th>
                <th>分佣影响</th>
                <th>状态</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr
              key={rowValue(
                item,
                ['id', 'masked_flow_no', 'maskedFlowNo'],
                index,
              )}
            >
              {compact ? (
                <>
                  <td>{rowValue(item, ['date'])}</td>
                  <td>{rowValue(item, ['type'])}</td>
                  <td className='font-bold text-slate-900'>
                    {rowValue(item, ['masked_user_id', 'maskedUserId'])}
                  </td>
                  <td>
                    {money(
                      rowValue(item, ['effective_gmv', 'effectiveGmv'], 0),
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={rowValue(item, ['status'], '统计中')}
                    />
                  </td>
                </>
              ) : (
                <>
                  <td>{rowValue(item, ['date'])}</td>
                  <td className='font-bold text-slate-900'>
                    {rowValue(item, ['masked_flow_no', 'maskedFlowNo'])}
                  </td>
                  <td>{rowValue(item, ['masked_user_id', 'maskedUserId'])}</td>
                  <td>{rowValue(item, ['type'])}</td>
                  <td>
                    {money(
                      rowValue(item, ['effective_gmv', 'effectiveGmv'], 0),
                    )}
                  </td>
                  <td>
                    {money(
                      rowValue(
                        item,
                        ['commission_amount', 'commissionAmount'],
                        0,
                      ),
                    )}
                  </td>
                  <td>{rowValue(item, ['impact'])}</td>
                  <td>
                    <StatusBadge
                      status={rowValue(item, ['status'], '统计中')}
                    />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function StatementTable({ rows }) {
  if (!rows.length)
    return (
      <EmptyState
        title='暂无月度分佣记录'
        detail='联运系统生成月度分佣记录后，会显示在这里。'
      />
    );
  return (
    <TableWrap>
      <table className='portal-table'>
        <thead>
          <tr>
            <th>月份</th>
            <th>有效 GMV</th>
            <th>返佣比例</th>
            <th>应结佣金</th>
            <th>扣回调整</th>
            <th>实结佣金</th>
            <th>状态</th>
            <th>预计可提现时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={rowValue(item, ['month'], index)}>
              <td className='font-bold text-slate-900'>
                {rowValue(item, ['month'])}
              </td>
              <td>
                {money(rowValue(item, ['effective_gmv', 'effectiveGmv'], 0))}
              </td>
              <td>{rowValue(item, ['ratio'])}</td>
              <td>
                {money(
                  rowValue(
                    item,
                    ['expected_commission', 'expectedCommission'],
                    0,
                  ),
                )}
              </td>
              <td>
                {money(rowValue(item, ['adjustment', 'adjustment_amount'], 0))}
              </td>
              <td>
                {money(
                  rowValue(
                    item,
                    ['settled_commission', 'settledCommission'],
                    0,
                  ),
                )}
              </td>
              <td>
                <StatusBadge status={rowValue(item, ['status'], '待确认')} />
              </td>
              <td>{rowValue(item, ['payable_at', 'payableAt'])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
function WithdrawalTable({ rows }) {
  if (!rows.length)
    return (
      <EmptyState
        title='暂无提现记录'
        detail='提交提现申请后，会显示处理进度。'
      />
    );
  return (
    <TableWrap>
      <table className='portal-table'>
        <thead>
          <tr>
            <th>提现单号</th>
            <th>申请时间</th>
            <th>提现金额</th>
            <th>状态</th>
            <th>处理时间</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={rowValue(item, ['id'], index)}>
              <td className='font-bold text-slate-900'>
                {rowValue(item, ['id'])}
              </td>
              <td>{rowValue(item, ['applied_at', 'appliedAt'])}</td>
              <td>{money(rowValue(item, ['amount'], 0))}</td>
              <td>
                <StatusBadge status={rowValue(item, ['status'], '处理中')} />
              </td>
              <td>{rowValue(item, ['handled_at', 'handledAt'])}</td>
              <td>{rowValue(item, ['note'])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
function CredentialChangeTable({ rows }) {
  if (!rows.length)
    return (
      <EmptyState
        title='暂无推荐信息变更记录'
        detail='推荐链接后缀或推荐口令发生变更后，会显示在这里。'
      />
    );
  return (
    <TableWrap>
      <table className='portal-table'>
        <thead>
          <tr>
            <th>变更时间</th>
            <th>类型</th>
            <th>旧值</th>
            <th>新值</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={rowValue(item, ['id', 'changed_at', 'changedAt'], index)}>
              <td>{rowValue(item, ['changed_at', 'changedAt', 'time'])}</td>
              <td>
                {rowValue(item, ['type', 'credential_type', 'credentialType'])}
              </td>
              <td>{rowValue(item, ['old_value', 'oldValue'])}</td>
              <td>{rowValue(item, ['new_value', 'newValue'])}</td>
              <td>
                <StatusBadge status={rowValue(item, ['status'], '生效中')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function TrendBars() {
  const bars = [
    34, 62, 28, 48, 86, 22, 68, 30, 24, 34, 50, 18, 54, 62, 98, 16, 56, 80, 60,
    34, 42, 46, 36, 70, 20, 86, 52, 22, 38, 56, 18,
  ];
  return (
    <div className='mt-4'>
      <div className='mb-4 flex flex-wrap gap-6 text-sm text-slate-500'>
        <span className='inline-flex items-center gap-2'>
          <i className='h-2.5 w-2.5 rounded-sm bg-[#6b48ff]' />
          有效 GMV（元）
        </span>
        <span className='inline-flex items-center gap-2'>
          <i className='h-2.5 w-2.5 rounded-sm bg-[#4da3ff]' />
          预估分佣（元）
        </span>
      </div>
      <div className='flex h-[116px] items-end gap-2 border-b border-slate-200 px-1'>
        {bars.map((height, index) => (
          <div key={index} className='flex h-full flex-1 items-end gap-1'>
            <span
              className='block w-1/2 rounded-t bg-[#6b48ff]'
              style={{ height: `${height}%` }}
            />
            <span
              className='block w-1/2 rounded-t bg-[#4da3ff]'
              style={{ height: `${Math.max(12, height * 0.32)}%` }}
            />
          </div>
        ))}
      </div>
      <div className='mt-2 grid grid-cols-5 text-center text-xs text-slate-500'>
        <span>05-01</span>
        <span>05-08</span>
        <span>05-15</span>
        <span>05-22</span>
        <span>05-31</span>
      </div>
    </div>
  );
}
function QrPreview({ value }) {
  return (
    <div className='relative grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-3 shadow-sm'>
      {value ? (
        <QRCodeSVG data-promoter-qr='main' value={value} size={196} level='H' />
      ) : (
        <div className='h-full w-full rounded bg-slate-50' />
      )}
      <span className='absolute grid h-12 w-12 place-items-center rounded-lg border-4 border-white bg-gradient-to-br from-[#2f65ff] to-[#7545ff] text-sm font-black text-white shadow-sm'>
        FI
      </span>
    </div>
  );
}
function EmptyState({ title, detail }) {
  return (
    <div className='mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center'>
      <div className='text-base font-black text-slate-800'>{title}</div>
      <div className='mt-2 text-sm leading-6 text-slate-500'>{detail}</div>
    </div>
  );
}
function MaintenanceState({ onRetry }) {
  return (
    <div className='mx-auto max-w-[760px] px-4 py-20 text-center'>
      <Panel>
        <div className='text-2xl font-black text-slate-950'>
          推广中心暂时无法访问，请稍后再试。
        </div>
        <p className='mt-3 text-sm leading-6 text-slate-500'>
          NewAPI 后端暂时无法连接联运前台 API，或桥接密钥/代理配置未生效。
        </p>
        <button
          className='infistar-btn-primary mx-auto mt-6'
          type='button'
          onClick={onRetry}
        >
          重试
        </button>
      </Panel>
    </div>
  );
}

function LandingFeatureCard({ color, detail, icon, title }) {
  return (
    <article className='min-h-[150px] rounded-lg border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(25,39,84,0.05)]'>
      <MiniIconBubble color={color} icon={icon} />
      <h3 className='mt-4 text-base font-black leading-tight text-slate-950'>
        {title}
      </h3>
      <p className='mt-2 text-sm leading-6 text-slate-600'>{detail}</p>
    </article>
  );
}
function LandingScenarioCard({ color, detail, icon, title }) {
  return (
    <article className='rounded-lg border border-slate-200 bg-white p-7 shadow-[0_16px_42px_rgba(25,39,84,0.06)]'>
      <div className='flex items-center gap-4'>
        <IconBubble color={color} icon={icon} />
        <h3 className='text-xl font-black leading-tight text-slate-950'>
          {title}
        </h3>
      </div>
      <p className='mt-5 text-sm leading-7 text-slate-600'>{detail}</p>
    </article>
  );
}
function UseCaseCard({ color, detail, icon, title }) {
  return (
    <article className='grid min-h-[112px] grid-cols-[58px_1fr] gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(25,39,84,0.04)]'>
      <IconBubble color={color} icon={icon} />
      <div>
        <h3 className='text-lg font-black text-slate-950'>{title}</h3>
        <p className='mt-2 text-sm leading-6 text-slate-500'>{detail}</p>
      </div>
    </article>
  );
}
function PreviewItem({ color, title, detail, icon }) {
  return (
    <div className='grid grid-cols-[64px_1fr] items-center gap-4'>
      <IconBubble color={color} icon={icon} />
      <div>
        <strong className='block text-2xl font-black leading-tight text-slate-950'>
          {title}
        </strong>
        <span className='mt-1 block text-sm leading-6 text-slate-500'>
          {detail}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = {
    正常: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    合作中: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    生效中: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    已首充: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    未首充: 'border-slate-200 bg-slate-50 text-slate-600',
    统计中: 'border-sky-200 bg-sky-50 text-sky-700',
    待确认: 'border-amber-200 bg-amber-50 text-amber-700',
    已结算: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    可提现: 'border-amber-200 bg-amber-50 text-amber-700',
    提现中: 'border-blue-200 bg-blue-50 text-blue-700',
    已提现: 'border-slate-200 bg-slate-100 text-slate-600',
    已扣回: 'border-rose-200 bg-rose-50 text-rose-700',
    已排除: 'border-slate-200 bg-slate-100 text-slate-600',
    已注销: 'border-slate-200 bg-slate-100 text-slate-500',
    处理中: 'border-blue-200 bg-blue-50 text-blue-700',
    已打款: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      className={`rounded border px-2 py-1 text-xs font-bold ${tone[status] || tone['待确认']}`}
    >
      {status}
    </span>
  );
}
function IconBubble({ color, icon }) {
  return (
    <span
      className={`grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full ${bubbleColor(color)}`}
    >
      <IconGlyph icon={icon} />
    </span>
  );
}
function MiniIconBubble({ color, icon }) {
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${bubbleColor(color)}`}
    >
      <IconGlyph icon={icon} small />
    </span>
  );
}
function IconGlyph({ icon, small = false }) {
  const size = small ? '18' : '28';
  const glyphs = {
    userPlus:
      'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Zm8-5v3h3v2h-3v3h-2v-3h-3v-2h3V9h2Z',
    link: 'M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1-2-2 1-1a2 2 0 0 0-3-3l-2 2a2 2 0 0 0 0 3l-2 2Zm4-2a5 5 0 0 1 0 7l-2 2a5 5 0 1 1-7-7l1-1 2 2-1 1a2 2 0 1 0 3 3l2-2a2 2 0 0 0 0-3l2-2Z',
    chart: 'M4 19h16v2H2V3h2v16Zm3-2V9h3v8H7Zm5 0V5h3v12h-3Zm5 0v-6h3v6h-3Z',
    calendar: 'M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm11 8H6v10h12V10Z',
    wallet: 'M3 6h18v14H3V6Zm2 3v9h14V9H5Zm11 3h2v3h-2v-3Z',
    qr: 'M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm10-2h2v2h-2v-2Zm4 0h2v4h-4v-2h2v-2Zm-6 4h2v4h-2v-4Zm4 2h4v2h-4v-2Z',
    message: 'M4 4h16v12H8l-4 4V4Zm3 3v2h10V7H7Zm0 4v2h7v-2H7Z',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='currentColor'
      aria-hidden='true'
    >
      <path d={glyphs[icon] || glyphs.link} />
    </svg>
  );
}
function bubbleColor(color) {
  return (
    {
      purple: 'bg-[#ede8ff] text-[#7247ff]',
      blue: 'bg-[#e7f0ff] text-[#2f6bff]',
      cyan: 'bg-[#e4f9fb] text-[#21bfc8]',
      amber: 'bg-[#fff1d6] text-[#f5a524]',
      green: 'bg-[#e8f7ef] text-[#28a36b]',
    }[color] || 'bg-[#e7f0ff] text-[#2f6bff]'
  );
}
function textColor(color) {
  return (
    {
      purple: 'text-[#7247ff]',
      blue: 'text-[#2f6bff]',
      cyan: 'text-[#149ca4]',
      amber: 'text-[#c77700]',
      green: 'text-[#28a36b]',
    }[color] || 'text-[#2f6bff]'
  );
}

export default Promoter;
