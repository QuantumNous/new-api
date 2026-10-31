import convertToArrayPayload from './convertToArrayPayload';

export default <T>(data: T[], value: T | T[]): T[] => [
  ...convertToArrayPayload(value),
  ...convertToArrayPayload(data),
];
