const translate = (t, value) => (typeof t === 'function' ? t(value) : value);

export function buildAffiliateStatusLoadingState(t) {
  return {
    title: translate(t, '正在加载分销状态'),
    description: translate(t, '请稍候，正在确认分销权限和数据范围。'),
    actionLabel: '',
  };
}

export function buildAffiliateSectionErrorState(t, options = {}) {
  const section = options.section || '';
  const retryable = Boolean(options.retryable);
  const sectionTitles = {
    dashboard: '分销看板加载失败',
    team: '推广关系树加载失败',
    logs: '分销明细加载失败',
  };

  return {
    title: translate(t, sectionTitles[section] || '分销分区加载失败'),
    description: translate(t, '当前分区渲染出错，其他分销信息不受影响。'),
    actionLabel: retryable
      ? translate(
          t,
          section === 'logs'
            ? '重新加载明细'
            : section === 'team'
              ? '重新加载关系树'
              : '重新加载看板',
        )
      : '',
  };
}
