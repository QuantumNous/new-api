import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/lib/api/services/user.service';
import type { UserListParams, UpdateUserRequest } from '@/types/user';

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
  self: () => [...userKeys.all, 'self'] as const,
};

// 获取当前用户
export const useCurrentUser = () => {
  return useQuery({
    queryKey: userKeys.self(),
    queryFn: () => userService.getSelf(),
  });
};

// 获取用户列表
export const useUsers = (params: UserListParams) => {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => userService.getUsers(params),
  });
};

// 获取单个用户
export const useUser = (id: number) => {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userService.getUserById(id),
    enabled: !!id,
  });
};

// 创建用户
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

// 更新用户
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.updateUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) });
      }
    },
  });
};

// 更新当前用户
export const useUpdateSelf = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUserRequest) => userService.updateSelf(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.self() });
    },
  });
};

// 删除用户
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};
