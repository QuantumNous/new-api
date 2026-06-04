const normalizeInteger = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.trunc(number);
};

const translate = (t, value) => (typeof t === 'function' ? t(value) : value);

export function buildAffiliateProfilesQuery({
  page = 1,
  pageSize = 10,
  filters = {},
} = {}) {
  const params = new URLSearchParams();
  params.set('p', String(page || 1));
  params.set('page_size', String(pageSize || 10));

  const userId = normalizeInteger(filters.user_id);
  const level = normalizeInteger(filters.level);
  const status = String(filters.status || '').trim();

  if (userId > 0) {
    params.set('user_id', String(userId));
  }
  if (level === 1 || level === 2) {
    params.set('level', String(level));
  }
  if (status) {
    params.set('status', status);
  }

  return `/api/affiliate/admin/profiles?${params.toString()}`;
}

export function buildAffiliateProfilePayload(values = {}) {
  const level = normalizeInteger(values.level);
  return {
    user_id: normalizeInteger(values.user_id),
    level,
    parent_user_id: level === 2 ? normalizeInteger(values.parent_user_id) : 0,
    invite_code: String(values.invite_code || '').trim(),
    reason: String(values.reason || '').trim(),
  };
}

export function validateAffiliateProfilePayload(t, payload) {
  if (!payload.user_id) {
    return translate(t, '请输入用户 ID');
  }
  if (payload.level !== 1 && payload.level !== 2) {
    return translate(t, '请选择分销等级');
  }
  if (payload.level === 2 && !payload.parent_user_id) {
    return translate(t, '二级分销商必须填写上级用户 ID');
  }
  if (payload.level === 2 && payload.parent_user_id === payload.user_id) {
    return translate(t, '二级分销商上级不能是自己');
  }
  return '';
}

export function getAffiliateProfileStatusMeta(t, status) {
  switch (status) {
    case 'active':
      return { label: translate(t, '启用'), type: 'success' };
    case 'disabled':
      return { label: translate(t, '禁用'), type: 'danger' };
    default:
      return { label: status || translate(t, '未知'), type: 'tertiary' };
  }
}

export function getAffiliateProfileLevelText(t, level) {
  if (Number(level) === 1) {
    return translate(t, '一级分销商');
  }
  if (Number(level) === 2) {
    return translate(t, '二级分销商');
  }
  return translate(t, '未设置');
}
