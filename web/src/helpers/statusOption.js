const STATUS_OPTION_FIELD_MAP = {
  SystemName: 'system_name',
  Logo: 'logo',
  Footer: 'footer_html',
};

export function getStatusOptionPatch(key, value) {
  const statusKey = STATUS_OPTION_FIELD_MAP[key];

  if (!statusKey) {
    return null;
  }

  return {
    statusKey,
    storageKey: statusKey,
    value: typeof value === 'string' ? value : '',
  };
}
