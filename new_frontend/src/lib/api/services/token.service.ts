import api from '../client';
import type {
  Token,
  TokenListParams,
  TokenListResponse,
  CreateTokenRequest,
  UpdateTokenRequest,
} from '@/types/token';

export const tokenService = {
  // 令牌列表
  getAll: (params: TokenListParams) =>
    api.get<TokenListResponse>('/token/', { params }),

  getById: (id: number) => api.get<Token>(`/token/${id}`),

  search: (keyword: string) =>
    api.get<Token[]>('/token/search', { params: { keyword } }),

  // CRUD 操作
  create: (data: CreateTokenRequest) => api.post<Token>('/token/', data),

  update: (data: UpdateTokenRequest) => api.put<Token>('/token/', data),

  delete: (id: number) => api.delete(`/token/${id}`),

  // 批量操作
  batchDelete: (ids: number[]) =>
    api.post('/token/batch', { ids, action: 'delete' }),
};
