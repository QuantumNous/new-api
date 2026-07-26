import type { UserInfo, UserProfilePatch } from '@/types/auth'

import { api } from './client'

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ user: UserInfo }>('/api/user/login', { username, password }),
  register: (payload: { username: string; email: string; password: string }) =>
    api.post<{ message: string }>('/api/user/register', payload),
  resetPassword: (email: string) =>
    api.post<{ message: string }>('/api/user/reset', { email }),
  logout: () => api.post('/api/user/logout'),
  self: () => api.get<UserInfo>('/api/user/self'),
  deleteSelf: () => api.delete<{ message: string }>('/api/user/self'),
  updateProfile: (patch: UserProfilePatch) =>
    api.put<{ user: UserInfo }>('/api/user/self', patch),
}
