const translate = (t, value) => (typeof t === 'function' ? t(value) : value);

const normalizeInteger = (value, { allowZero = false } = {}) => {
  const number = Number(String(value ?? '').trim());
  if (!Number.isFinite(number)) {
    return 0;
  }
  const integer = Math.trunc(number);
  if (integer > 0) {
    return integer;
  }
  return allowZero && integer === 0 ? 0 : 0;
};

export function buildAffiliateInviterCandidatesQuery({
  keyword = '',
  page = 1,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();
  const normalizedKeyword = String(keyword || '').trim();
  if (normalizedKeyword) {
    params.set('keyword', normalizedKeyword);
  }
  params.set('p', String(normalizeInteger(page) || 1));
  params.set('page_size', String(normalizeInteger(pageSize) || 10));

  return `/api/affiliate/admin/inviter-candidates?${params.toString()}`;
}

export function buildAffiliateInviterPreviewQuery(
  targetUserId,
  newInviterUserId,
) {
  const target = normalizeInteger(targetUserId);
  const inviter = normalizeInteger(newInviterUserId, { allowZero: true });
  return `/api/affiliate/admin/users/${target}/inviter/preview?new_inviter_user_id=${inviter}`;
}

export function buildAffiliateInviterUpdateUrl(targetUserId) {
  const target = normalizeInteger(targetUserId);
  return `/api/affiliate/admin/users/${target}/inviter`;
}

export function buildAffiliateInviterUpdatePayload({
  newInviterUserId,
  reason = '',
} = {}) {
  return {
    new_inviter_user_id: normalizeInteger(newInviterUserId, {
      allowZero: true,
    }),
    reason: String(reason || '').trim(),
  };
}

export function validateAffiliateInviterChange(
  t,
  targetUserId,
  newInviterUserId,
) {
  const target = normalizeInteger(targetUserId);
  const inviter = normalizeInteger(newInviterUserId, { allowZero: true });
  if (!target) {
    return translate(t, '用户信息缺失');
  }
  if (inviter > 0 && target === inviter) {
    return translate(t, '邀请人不能是目标用户自己');
  }
  return '';
}

export function formatAffiliateInviterPath(t, path) {
  if (!Array.isArray(path) || path.length === 0) {
    return translate(t, '无');
  }
  return path.map((id) => String(id)).join(' -> ');
}

export function formatAffiliateInviterCandidateLabel(user = {}) {
  const parts = [`#${user.id || 0}`];
  if (user.username) {
    parts.push(user.username);
  }
  if (user.display_name && user.display_name !== user.username) {
    parts.push(`(${user.display_name})`);
  }
  if (user.email) {
    parts.push(user.email);
  }
  return parts.join(' ');
}
