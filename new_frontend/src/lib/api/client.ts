import axios, { AxiosInstance, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_TIMEOUT = 30000;

// 创建类型安全的 API 客户端
const rawApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
rawApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 添加用户 ID（必需的请求头）
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        config.headers['New-Api-User'] = user.id;
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    }

    // Session Cookie 会自动携带，不需要手动设置 Authorization
    // Access Token 用于 API 调用，用户在个人设置中手动生成
    const token = localStorage.getItem('token');
    if (token && token !== 'session') {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 返回响应体数据
rawApi.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error: AxiosError) => {
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
    if (error.response?.status && error.response.status >= 500) {
      console.error('Server error', error.response.data);
    }

    return Promise.reject(error);
  }
);

// 类型安全的 API 方法
export const api = {
  get: <T = any>(url: string, config?: any): Promise<T> => rawApi.get(url, config),
  post: <T = any>(url: string, data?: any, config?: any): Promise<T> => rawApi.post(url, data, config),
  put: <T = any>(url: string, data?: any, config?: any): Promise<T> => rawApi.put(url, data, config),
  delete: <T = any>(url: string, config?: any): Promise<T> => rawApi.delete(url, config),
  patch: <T = any>(url: string, data?: any, config?: any): Promise<T> => rawApi.patch(url, data, config),
};

export default api;
