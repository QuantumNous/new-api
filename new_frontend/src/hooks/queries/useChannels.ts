import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelService } from '@/lib/api/services/channel.service';
import type { ChannelListParams } from '@/types/channel';

// Query Keys
export const channelKeys = {
  all: ['channels'] as const,
  lists: () => [...channelKeys.all, 'list'] as const,
  list: (params: ChannelListParams) => [...channelKeys.lists(), params] as const,
  details: () => [...channelKeys.all, 'detail'] as const,
  detail: (id: number) => [...channelKeys.details(), id] as const,
};

// 获取渠道列表
export const useChannels = (params: ChannelListParams) => {
  return useQuery({
    queryKey: channelKeys.list(params),
    queryFn: () => channelService.getAll(params),
  });
};

// 获取单个渠道
export const useChannel = (id: number) => {
  return useQuery({
    queryKey: channelKeys.detail(id),
    queryFn: () => channelService.getById(id),
    enabled: !!id,
  });
};

// 创建渠道
export const useCreateChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: channelService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.lists() });
    },
  });
};

// 更新渠道
export const useUpdateChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: channelService.update,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: channelKeys.lists() });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: channelKeys.detail(data.id) });
      }
    },
  });
};

// 删除渠道
export const useDeleteChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: channelService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.lists() });
    },
  });
};

// 测试渠道
export const useTestChannel = () => {
  return useMutation({
    mutationFn: channelService.test,
  });
};

// 批量删除渠道
export const useBatchDeleteChannels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: channelService.batchDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.lists() });
    },
  });
};
