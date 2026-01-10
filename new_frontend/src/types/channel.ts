import { BaseModel } from './common';

export interface Channel extends BaseModel {
  type: number;
  key: string;
  status: number;
  name: string;
  weight: number;
  createdTime: number;
  testTime: number;
  responseTime: number;
  baseUrl?: string;
  other?: string;
  balance: number;
  balanceUpdatedTime: number;
  models: string[];
  group: string[];
  usedQuota: number;
  modelMapping?: string;
  headers?: string;
  priority: number;
  autoDisable: number;
  statusCodeMapping?: string;
  config?: string;
  plugin?: string;
  tag?: string;
}

export interface ChannelListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: number;
  status?: number;
  group?: string;
  tag?: string;
}

export interface ChannelListResponse {
  success: boolean;
  data: {
    items: Channel[];
    total: number;
    page: number;
    page_size: number;
    type_counts?: Record<number, number>;
  };
}

export interface CreateChannelRequest {
  type: number;
  name: string;
  key: string;
  baseUrl?: string;
  models?: string[];
  group?: string[];
  priority?: number;
  weight?: number;
}

export interface UpdateChannelRequest {
  id: number;
  type?: number;
  name?: string;
  key?: string;
  base_url?: string;
  models?: string;
  group?: string;
  priority?: number;
  weight?: number;
  other?: string;
  model_mapping?: string;
  status?: number;
  test_model?: string;
  setting?: string;
  param_override?: string;
  header_override?: string;
  tag?: string;
  multi_key_mode?: string;
  key_mode?: 'append' | 'replace';
}

export interface TestChannelResponse {
  success: boolean;
  message: string;
  time: number;
}

export type ChannelType = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'aws'
  | 'cohere'
  | 'huggingface'
  | 'custom';
