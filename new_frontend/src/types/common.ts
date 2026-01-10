// 通用类型定义

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type Status = 'enabled' | 'disabled' | 'pending';

export interface BaseModel {
  id: number;
  createdAt: number;
  updatedAt?: number;
}
