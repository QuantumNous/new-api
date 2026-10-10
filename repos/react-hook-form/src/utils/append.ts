import convertToArrayPayload from './convertToArrayPayload';

export default <T>(data: T[], value: T | T[]): T[] => [
  ...data,
  ...convertToArrayPayload(value),
];
