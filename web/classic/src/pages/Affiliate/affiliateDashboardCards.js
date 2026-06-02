const numberFormat = new Intl.NumberFormat('zh-CN');

const translate = (t, value) => (typeof t === 'function' ? t(value) : value);

function formatRMB(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '¥0.00';
  }
  return `¥${amount.toFixed(2)}`;
}

function formatInteger(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '0';
  }
  return numberFormat.format(amount);
}

function pendingRuleText(t, activeText, pendingText) {
  return translate(t, activeText || pendingText);
}

export function buildAffiliateDashboardCards(t, summary = {}) {
  const rulePending = summary.rule_status === 'pending_rules';

  return [
    {
      key: 'team_user_count',
      title: translate(t, '团队人数'),
      value: formatInteger(summary.team_user_count),
      description: translate(t, '当前 scope 内可见下线用户'),
    },
    {
      key: 'effective_new_user_count',
      title: translate(t, '有效新用户'),
      value: formatInteger(summary.effective_new_user_count),
      description: translate(t, '来自分销邀请码的注册用户'),
    },
    {
      key: 'net_consumption',
      title: translate(t, '净付费消耗'),
      value: formatRMB(summary.net_consumption_rmb),
      description: `${translate(t, '原始额度')} ${formatInteger(summary.net_consumption_quota)}`,
    },
    {
      key: 'estimated_commission',
      title: translate(t, '预估佣金'),
      value: formatRMB(summary.estimated_commission_rmb),
      description: pendingRuleText(
        t,
        rulePending ? '' : '按当前规则估算',
        `规则未发布，暂按 ${formatRMB(summary.estimated_commission_rmb)} 展示`,
      ),
    },
    {
      key: 'head_fee',
      title: translate(t, '人头费'),
      value: formatRMB(summary.head_fee_rmb),
      description: pendingRuleText(
        t,
        rulePending ? '' : '按当前 KPI 档位估算',
        '人头费规则未发布',
      ),
    },
    {
      key: 'pending_settlement',
      title: translate(t, '待结算金额'),
      value: formatRMB(summary.pending_settlement_rmb),
      description: translate(t, '冻结和审核后进入结算'),
    },
    {
      key: 'kpi_tier',
      title: translate(t, 'KPI 档位'),
      value: summary.kpi_tier_name || translate(t, '待配置'),
      description: pendingRuleText(
        t,
        rulePending ? '' : '已匹配当前规则集',
        '等待管理员发布分销规则',
      ),
    },
  ];
}
