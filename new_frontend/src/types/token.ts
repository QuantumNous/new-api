import { BaseModel } from './common';

export interface Token extends BaseModel {
  userId: number;
  key: string;
  status: number;
  name: string;
  createdTime: number;
  accessedTime: number;
  expiredTime: number;
  remainQuota: number;
  unlimitedQuota: boolean;
  usedQuota: number;
  modelLimitsEnabled: boolean;
  modelLimits: string;
  allowIps?: string;
  group: string;
  crossGroupRetry: boolean;
}

export interface TokenListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
}

export interface TokenListResponse {
  success: boolean;
  message?: string;
  data: {
    items: Token[];
    total: number;
    page: number;
    page_size: number;
  };
}

export interface CreateTokenRequest {
  name: string;
  remainQuota?: number;
  expiredTime?: number;
  unlimitedQuota?: boolean;
  models?: string[];
  subnet?: string;
  group?: string;
}

export interface UpdateTokenRequest extends Partial<CreateTokenRequest> {
  id: number;
}
