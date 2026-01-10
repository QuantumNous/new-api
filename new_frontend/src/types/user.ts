import { BaseModel } from './common';

export interface User extends BaseModel {
  username: string;
  password?: string;
  displayName: string;
  role: number;
  status: number;
  email: string;
  githubId?: string;
  wechatId?: string;
  verificationCode?: string;
  accessToken: string;
  quota: number;
  usedQuota: number;
  requestCount: number;
  group: string;
  affCode: string;
  inviterId?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    username: string;
    display_name: string;
    role: number;
    status: number;
    email?: string;
    group: string;
  };
}

export interface AccessTokenResponse {
  success: boolean;
  data: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  verificationCode?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  display_name?: string;
  role?: number;
  email?: string;
}

export interface UpdateUserRequest {
  id: number;
  username?: string;
  password?: string;
  display_name?: string;
  role?: number;
  email?: string;
}

export interface UserListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  group?: string;
  role?: number;
}

export interface UserListResponse {
  success: boolean;
  data: {
    items: User[];
    total: number;
    page: number;
    page_size: number;
  };
}
