import { BASE_CLASS_PREFIX } from './env';

const VALIDATE_STATUS = ['default', 'error', 'warning', 'success'] as const;
// const VALIDATE_STATUS = ['default', 'error', 'warning', 'success', 'validating'] as const;

export { BASE_CLASS_PREFIX, VALIDATE_STATUS };
