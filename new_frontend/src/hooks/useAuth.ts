import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { userService } from '@/lib/api/services/user.service';
import { STORAGE_KEYS } from '@/lib/constants';
import { mapBackendToFrontendUser } from '@/lib/utils/mappers';
import type { LoginRequest, RegisterRequest } from '@/types/user';

export const useLogin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => userService.login(data),
    onSuccess: async (response: any) => {
      if (response.success && response.data) {
        // 使用映射工具转换后端字段到前端格式
        const frontendUser = mapBackendToFrontendUser(response.data);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(frontendUser));

        // 后端使用 Session 认证（Cookie），不需要手动获取 Access Token
        // Access Token 是用户在个人设置中手动生成的，用于 API 调用
        // 登录成功后直接跳转，Session Cookie 会自动携带
        
        // 设置一个标记表示已登录
        localStorage.setItem(STORAGE_KEYS.TOKEN, 'session');

        // 跳转到仪表板
        navigate('/console');

        // 刷新用户数据
        queryClient.invalidateQueries({ queryKey: ['users', 'self'] });
      } else {
        // 登录失败
        throw new Error(response.message || '登录失败');
      }
    },
    onError: (error: any) => {
      // 错误已经在Login.tsx中通过mutation的error处理
      console.error('Login error:', error);
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterRequest) => userService.register(data),
    onSuccess: () => {
      // 注册成功后跳转到登录页
      navigate('/login');
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userService.logout(),
    onSuccess: () => {
      // 清除本地数据
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      
      // 清除查询缓存
      queryClient.clear();
      
      // 跳转到登录页
      navigate('/login');
    },
  });
};

export const useCurrentUser = () => {
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const useIsAuthenticated = () => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  return !!token;
};
