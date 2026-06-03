export const USAGE_LOGS_MODE_DEFAULT = 'default';
export const USAGE_LOGS_MODE_AFFILIATE = 'affiliate';

const toUnixTimestamp = (value) => {
  const timestamp = Date.parse(value) / 1000;
  return Number.isFinite(timestamp) ? timestamp : '';
};

const buildQuery = (entries) =>
  entries.map(([key, value]) => `${key}=${value ?? ''}`).join('&');

export const buildUsageLogsListUrl = ({
  mode = USAGE_LOGS_MODE_DEFAULT,
  isAdminUser = false,
  page,
  pageSize,
  logType = 0,
  values = {},
}) => {
  const startTimestamp = toUnixTimestamp(values.start_timestamp);
  const endTimestamp = toUnixTimestamp(values.end_timestamp);

  if (mode === USAGE_LOGS_MODE_AFFILIATE) {
    return encodeURI(
      `/api/affiliate/logs?${buildQuery([
        ['p', page],
        ['page_size', pageSize],
        ['type', logType],
        ['model_name', values.model_name],
        ['start_timestamp', startTimestamp],
        ['end_timestamp', endTimestamp],
        ['group', values.group],
        ['user_id', values.user_id],
        ['second_level_user_id', values.second_level_user_id],
        ['request_status', values.request_status],
      ])}`,
    );
  }

  if (isAdminUser) {
    return encodeURI(
      `/api/log/?${buildQuery([
        ['p', page],
        ['page_size', pageSize],
        ['type', logType],
        ['username', values.username],
        ['token_name', values.token_name],
        ['model_name', values.model_name],
        ['start_timestamp', startTimestamp],
        ['end_timestamp', endTimestamp],
        ['channel', values.channel],
        ['group', values.group],
        ['request_id', values.request_id],
      ])}`,
    );
  }

  return encodeURI(
    `/api/log/self/?${buildQuery([
      ['p', page],
      ['page_size', pageSize],
      ['type', logType],
      ['token_name', values.token_name],
      ['model_name', values.model_name],
      ['start_timestamp', startTimestamp],
      ['end_timestamp', endTimestamp],
      ['group', values.group],
      ['request_id', values.request_id],
    ])}`,
  );
};

export const buildUsageLogsStatUrl = ({
  mode = USAGE_LOGS_MODE_DEFAULT,
  isAdminUser = false,
  logType = 0,
  values = {},
}) => {
  if (mode === USAGE_LOGS_MODE_AFFILIATE) {
    return null;
  }

  const startTimestamp = toUnixTimestamp(values.start_timestamp);
  const endTimestamp = toUnixTimestamp(values.end_timestamp);

  if (isAdminUser) {
    return encodeURI(
      `/api/log/stat?${buildQuery([
        ['type', logType],
        ['username', values.username],
        ['token_name', values.token_name],
        ['model_name', values.model_name],
        ['start_timestamp', startTimestamp],
        ['end_timestamp', endTimestamp],
        ['channel', values.channel],
        ['group', values.group],
      ])}`,
    );
  }

  return encodeURI(
    `/api/log/self/stat?${buildQuery([
      ['type', logType],
      ['token_name', values.token_name],
      ['model_name', values.model_name],
      ['start_timestamp', startTimestamp],
      ['end_timestamp', endTimestamp],
      ['group', values.group],
    ])}`,
  );
};
