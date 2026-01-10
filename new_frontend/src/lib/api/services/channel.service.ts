import api from '../client';
import type {
  Channel,
  ChannelListParams,
  ChannelListResponse,
  CreateChannelRequest,
  UpdateChannelRequest,
  TestChannelResponse,
} from '@/types/channel';

export const channelService = {
  // 渠道列表
  getAll: (params: ChannelListParams) =>
    api.get<ChannelListResponse>('/channel/', { params }),

  getById: (id: number) => api.get<Channel>(`/channel/${id}`),

  search: (keyword: string) =>
    api.get<Channel[]>('/channel/search', { params: { keyword } }),

  // CRUD 操作
  create: (data: CreateChannelRequest) => api.post<Channel>('/channel/', data),

  update: (data: UpdateChannelRequest) => api.put<Channel>('/channel/', data),

  delete: (id: number) => api.delete(`/channel/${id}`),

  // 批量操作
  batchDelete: (ids: number[]) =>
    api.post('/channel/batch', { ids, action: 'delete' }),

  batchEnable: (ids: number[]) =>
    api.post('/channel/batch', { ids, action: 'enable' }),

  batchDisable: (ids: number[]) =>
    api.post('/channel/batch', { ids, action: 'disable' }),

  // 渠道测试
  test: (id: number) => api.get<TestChannelResponse>(`/channel/test/${id}`),

  testAll: () => api.get<TestChannelResponse[]>('/channel/test'),

  // 余额更新
  updateBalance: (id: number) => api.get(`/channel/update_balance/${id}`),

  updateAllBalances: () => api.get('/channel/update_balance'),

  // 模型管理
  fetchModels: (id: number) => api.post('/channel/fetch_models', { id }),
};
