# API 集成指南

> 本文档说明如何在项目中集成后端 API

## 🌐 API 架构

### 基础配置

```typescript
// src/lib/api/client.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_TIMEOUT = 30000;

// 创建 Axios 实例
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加认证令牌
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加用户 ID
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        config.headers['New-Api-User'] = user.id;
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    // 处理 401 未授权
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    // 处理 403 禁止访问
    if (error.response?.status === 403) {
      console.error('Access denied');
    }

    // 处理 500 服务器错误
    if (error.response?.status >= 500) {
      console.error('Server error', error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;
```

### 环境变量配置

```typescript
// .env.development
VITE_API_BASE_URL=http://localhost:3000/api

// .env.production
VITE_API_BASE_URL=/api
```

## 📦 API 服务模块

### 用户服务

```typescript
// src/lib/api/services/user.service.ts
import api from '../client';
import type { 
  User, 
  LoginRequest, 
  LoginResponse,
  RegisterRequest,
  UpdateUserRequest,
  UserListParams,
  UserListResponse,
} from '@/types/user';

export const userService = {
  // 用户认证
  login: (data: LoginRequest) => 
    api.post<LoginResponse>('/user/login', data),

  login2FA: (code: string) => 
    api.post<LoginResponse>('/user/login/2fa', { code }),

  register: (data: RegisterRequest) => 
    api.post<User>('/user/register', data),

  logout: () => 
    api.get('/user/logout'),

  // 用户信息
  getSelf: () => 
    api.get<User>('/user/self'),

  updateSelf: (data: UpdateUserRequest) => 
    api.put<User>('/user/self', data),

  deleteSelf: () => 
    api.delete('/user/self'),

  // 用户管理（管理员）
  getUsers: (params: UserListParams) => 
    api.get<UserListResponse>('/user/', { params }),

  getUserById: (id: number) => 
    api.get<User>(`/user/${id}`),

  createUser: (data: Partial<User>) => 
    api.post<User>('/user/', data),

  updateUser: (data: Partial<User>) => 
    api.put<User>('/user/', data),

  deleteUser: (id: number) => 
    api.delete(`/user/${id}`),

  manageUser: (data: { id: number; action: string; value?: any }) => 
    api.post('/user/manage', data),

  // 密码重置
  resetPassword: (data: { email: string }) => 
    api.post('/user/reset', data),

  // 2FA
  get2FAStatus: () => 
    api.get('/user/2fa/status'),

  setup2FA: () => 
    api.post('/user/2fa/setup'),

  enable2FA: (code: string) => 
    api.post('/user/2fa/enable', { code }),

  disable2FA: (code: string) => 
    api.post('/user/2fa/disable', { code }),

  getBackupCodes: () => 
    api.post('/user/2fa/backup_codes'),

  disable2FAForUser: (userId: number) => 
    api.delete(`/user/${userId}/2fa`),

  // Passkey
  getPasskeys: () => 
    api.get('/user/passkey'),

  registerPasskeyBegin: () => 
    api.post('/user/passkey/register/begin'),

  registerPasskeyFinish: (data: any) => 
    api.post('/user/passkey/register/finish', data),

  loginPasskeyBegin: () => 
    api.post('/user/passkey/login/begin'),

  loginPasskeyFinish: (data: any) => 
    api.post('/user/passkey/login/finish', data),

  deletePasskey: (id: string) => 
    api.delete(`/user/passkey/${id}`),

  resetPasskey: (userId: number) => 
    api.delete(`/user/${userId}/reset_passkey`),

  // 充值
  getTopupInfo: () => 
    api.get('/user/topup/info'),

  topup: (amount: number) => 
    api.post('/user/topup', { amount }),

  getTopupHistory: (params?: any) => 
    api.get('/user/topup/self', { params }),

  completeTopup: (data: any) => 
    api.post('/user/topup/complete', data),

  // 邀请
  getAffiliateInfo: () => 
    api.get('/user/aff'),

  transferAffiliate: (data: { to_user: number; amount: number }) => 
    api.post('/user/aff_transfer', data),

  // 签到
  getCheckinStatus: () => 
    api.get('/user/checkin'),

  checkin: () => 
    api.post('/user/checkin'),
};
```

### 渠道服务

```typescript
// src/lib/api/services/channel.service.ts
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

  getById: (id: number) => 
    api.get<Channel>(`/channel/${id}`),

  search: (keyword: string) => 
    api.get<Channel[]>('/channel/search', { params: { keyword } }),

  // CRUD 操作
  create: (data: CreateChannelRequest) => 
    api.post<Channel>('/channel/', data),

  update: (data: UpdateChannelRequest) => 
    api.put<Channel>('/channel/', data),

  delete: (id: number) => 
    api.delete(`/channel/${id}`),

  // 批量操作
  batchDelete: (ids: number[]) => 
    api.post('/channel/batch', { ids, action: 'delete' }),

  batchEnable: (ids: number[]) => 
    api.post('/channel/batch', { ids, action: 'enable' }),

  batchDisable: (ids: number[]) => 
    api.post('/channel/batch', { ids, action: 'disable' }),

  // 渠道测试
  test: (id: number) => 
    api.get<TestChannelResponse>(`/channel/test/${id}`),

  testAll: () => 
    api.get<TestChannelResponse[]>('/channel/test'),

  // 余额更新
  updateBalance: (id: number) => 
    api.get(`/channel/update_balance/${id}`),

  updateAllBalances: () => 
    api.get('/channel/update_balance'),

  // 模型管理
  fetchModels: (id: number) => 
    api.post('/channel/fetch_models', { id }),

  // Ollama 管理
  ollamaPull: (id: number, model: string) => 
    api.post('/channel/ollama/pull', { id, model }),

  ollamaDelete: (id: number, model: string) => 
    api.delete('/channel/ollama/delete', { data: { id, model } }),

  // 多密钥管理
  manageMultiKey: (data: {
    channel_id: number;
    action: 'add' | 'delete' | 'disable';
    key?: string;
    key_id?: number;
  }) => 
    api.post('/channel/multi_key/manage', data),
};
```

### 令牌服务

```typescript
// src/lib/api/services/token.service.ts
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

  getById: (id: number) => 
    api.get<Token>(`/token/${id}`),

  search: (keyword: string) => 
    api.get<Token[]>('/token/search', { params: { keyword } }),

  // CRUD 操作
  create: (data: CreateTokenRequest) => 
    api.post<Token>('/token/', data),

  update: (data: UpdateTokenRequest) => 
    api.put<Token>('/token/', data),

  delete: (id: number) => 
    api.delete(`/token/${id}`),

  // 批量操作
  batchDelete: (ids: number[]) => 
    api.post('/token/batch', { ids, action: 'delete' }),
};
```

## 🔄 React Query 集成

### Query Client 配置

```typescript
// src/lib/query/client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      gcTime: 10 * 60 * 1000, // 10 分钟
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### Query Hooks

```typescript
// src/hooks/queries/useChannels.ts
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
      queryClient.invalidateQueries({ queryKey: channelKeys.detail(data.id) });
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
```

### 使用示例

```tsx
// src/pages/console/channels/ChannelList.tsx
import { useChannels, useDeleteChannel } from '@/hooks/queries/useChannels';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export function ChannelList() {
  const [params, setParams] = useState({ page: 1, pageSize: 10 });
  const { data, isLoading, error } = useChannels(params);
  const deleteChannel = useDeleteChannel();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deleteChannel.mutateAsync(id);
      toast({
        title: '删除成功',
        description: '渠道已成功删除',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: error.message,
      });
    }
  };

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      {data?.data.map((channel) => (
        <div key={channel.id}>
          <span>{channel.name}</span>
          <Button onClick={() => handleDelete(channel.id)}>删除</Button>
        </div>
      ))}
    </div>
  );
}
```

## 🔐 认证流程

### 登录流程

```typescript
// src/hooks/useAuth.ts
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { userService } from '@/lib/api/services/user.service';
import { useUserStore } from '@/stores/user.store';

export const useLogin = () => {
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);

  return useMutation({
    mutationFn: userService.login,
    onSuccess: (data) => {
      // 保存令牌
      localStorage.setItem('token', data.token);
      
      // 保存用户信息
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);

      // 跳转到仪表板
      navigate('/console/dashboard');
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  const clearUser = useUserStore((state) => state.clearUser);

  return useMutation({
    mutationFn: userService.logout,
    onSuccess: () => {
      // 清除本地数据
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearUser();

      // 跳转到登录页
      navigate('/login');
    },
  });
};
```

## 🎯 错误处理

### 全局错误处理

```typescript
// src/lib/api/error-handler.ts
import { AxiosError } from 'axios';
import { toast } from '@/components/ui/use-toast';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export const handleApiError = (error: unknown) => {
  if (error instanceof AxiosError) {
    const apiError = error.response?.data as ApiError;
    
    // 显示错误提示
    toast({
      variant: 'destructive',
      title: '操作失败',
      description: apiError?.message || '请求失败，请稍后重试',
    });

    // 记录错误日志
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: apiError,
    });

    return apiError;
  }

  // 未知错误
  toast({
    variant: 'destructive',
    title: '未知错误',
    description: '发生了未知错误，请稍后重试',
  });

  console.error('Unknown Error:', error);
  return null;
};
```

### 在组件中使用

```tsx
import { handleApiError } from '@/lib/api/error-handler';

const handleSubmit = async (data: FormData) => {
  try {
    await createChannel.mutateAsync(data);
    toast({ title: '创建成功' });
  } catch (error) {
    handleApiError(error);
  }
};
```

## 📡 实时通信

### WebSocket 集成

```typescript
// src/lib/websocket/client.ts
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.reconnect(url);
    };
  }

  private reconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(url);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(data: any) {
    // 处理消息
    console.log('Received message:', data);
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.ws?.close();
  }
}
```

### SSE (Server-Sent Events)

```typescript
// src/hooks/useSSE.ts
import { useEffect, useState } from 'react';

export const useSSE = (url: string) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      setData(JSON.parse(event.data));
    };

    eventSource.onerror = (error) => {
      setError(error as Error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [url]);

  return { data, error };
};
```

## 🧪 API 测试

### Mock 数据

```typescript
// src/lib/api/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // 用户登录
  rest.post('/api/user/login', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          token: 'mock-token',
          user: {
            id: 1,
            username: 'testuser',
            role: 1,
          },
        },
      })
    );
  }),

  // 渠道列表
  rest.get('/api/channel/', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: [
          { id: 1, name: 'OpenAI', type: 'openai', status: 'enabled' },
          { id: 2, name: 'Anthropic', type: 'claude', status: 'enabled' },
        ],
      })
    );
  }),
];
```

### 测试配置

```typescript
// src/lib/api/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

## 📚 参考资源

- [Axios 文档](https://axios-http.com)
- [TanStack Query 文档](https://tanstack.com/query)
- [MSW 文档](https://mswjs.io)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
