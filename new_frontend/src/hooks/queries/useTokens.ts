import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokenService } from '@/lib/api/services/token.service';
import type { TokenListParams } from '@/types/token';

// Query Keys
export const tokenKeys = {
  all: ['tokens'] as const,
  lists: () => [...tokenKeys.all, 'list'] as const,
  list: (params: TokenListParams) => [...tokenKeys.lists(), params] as const,
  details: () => [...tokenKeys.all, 'detail'] as const,
  detail: (id: number) => [...tokenKeys.details(), id] as const,
};

// 获取令牌列表
export const useTokens = (params: TokenListParams) => {
  return useQuery({
    queryKey: tokenKeys.list(params),
    queryFn: () => tokenService.getAll(params),
  });
};

// 获取单个令牌
export const useToken = (id: number) => {
  return useQuery({
    queryKey: tokenKeys.detail(id),
    queryFn: () => tokenService.getById(id),
    enabled: !!id,
  });
};

// 创建令牌
export const useCreateToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tokenService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
    },
  });
};

// 更新令牌
export const useUpdateToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tokenService.update,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: tokenKeys.detail(data.id) });
      }
    },
  });
};

// 删除令牌
export const useDeleteToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tokenService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
    },
  });
};

// 批量删除令牌
export const useBatchDeleteTokens = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tokenService.batchDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
    },
  });
};
