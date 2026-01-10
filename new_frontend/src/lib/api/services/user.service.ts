import api from '../client';
import type {
  User,
  LoginRequest,
  LoginResponse,
  AccessTokenResponse,
  RegisterRequest,
  UpdateUserRequest,
  UserListParams,
  UserListResponse,
} from '@/types/user';

export const userService = {
  // 用户认证
  login: (data: LoginRequest) => api.post<LoginResponse>('/user/login', data),

  login2FA: (code: string) =>
    api.post<LoginResponse>('/user/login/2fa', { code }),

  register: (data: RegisterRequest) => api.post<User>('/user/register', data),

  logout: () => api.get('/user/logout'),

  // 用户信息
  getSelf: () => api.get<User>('/user/self'),

  updateSelf: (data: UpdateUserRequest) =>
    api.put<User>('/user/self', data),

  deleteSelf: () => api.delete('/user/self'),

  // 用户管理（管理员）
  getUsers: (params: UserListParams) =>
    api.get<UserListResponse>('/user/', { params }),

  getUserById: (id: number) => api.get<User>(`/user/${id}`),

  createUser: (data: Partial<User>) => api.post<User>('/user/', data),

  updateUser: (data: Partial<User>) => api.put<User>('/user/', data),

  deleteUser: (id: number) => api.delete(`/user/${id}`),

  manageUser: (data: { id: number; action: string; value?: any }) =>
    api.post('/user/manage', data),

  // 密码重置
  resetPassword: (data: { email: string }) =>
    api.post('/user/reset', data),

  // 2FA
  get2FAStatus: () => api.get('/user/2fa/status'),

  setup2FA: () => api.post('/user/2fa/setup'),

  enable2FA: (code: string) => api.post('/user/2fa/enable', { code }),

  disable2FA: (code: string) => api.post('/user/2fa/disable', { code }),

  getBackupCodes: () => api.post('/user/2fa/backup_codes'),

  disable2FAForUser: (userId: number) => api.delete(`/user/${userId}/2fa`),

  // Passkey
  getPasskeys: () => api.get('/user/passkey'),

  registerPasskeyBegin: () => api.post('/user/passkey/register/begin'),

  registerPasskeyFinish: (data: any) =>
    api.post('/user/passkey/register/finish', data),

  loginPasskeyBegin: () => api.post('/user/passkey/login/begin'),

  loginPasskeyFinish: (data: any) =>
    api.post('/user/passkey/login/finish', data),

  deletePasskey: (id: string) => api.delete(`/user/passkey/${id}`),

  resetPasskey: (userId: number) =>
    api.delete(`/user/${userId}/reset_passkey`),

  // 充值
  getTopupInfo: () => api.get('/user/topup/info'),

  topup: (amount: number) => api.post('/user/topup', { amount }),

  getTopupHistory: (params?: any) => api.get('/user/topup/self', { params }),

  completeTopup: (data: any) => api.post('/user/topup/complete', data),

  // 邀请
  getAffiliateInfo: () => api.get('/user/aff'),

  transferAffiliate: (data: { to_user: number; amount: number }) =>
    api.post('/user/aff_transfer', data),

  // 签到
  getCheckinStatus: () => api.get('/user/checkin'),

  checkin: () => api.post('/user/checkin'),

  // 获取访问令牌
  getAccessToken: () => api.get<AccessTokenResponse>('/user/self/token'),
};
