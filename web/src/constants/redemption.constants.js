export const REDEMPTION_STATUS = {
  UNUSED: 1, // Unused
  DISABLED: 2, // Disabled
  USED: 3, // Used
};

// Redemption code status display mapping
export const REDEMPTION_STATUS_MAP = {
  [REDEMPTION_STATUS.UNUSED]: {
    color: 'green',
    text: '未使用',
  },
  [REDEMPTION_STATUS.DISABLED]: {
    color: 'red',
    text: '已禁用',
  },
  [REDEMPTION_STATUS.USED]: {
    color: 'grey',
    text: '已使用',
  },
};

// Action type constants
export const REDEMPTION_ACTIONS = {
  DELETE: 'delete',
  ENABLE: 'enable',
  DISABLE: 'disable',
};
