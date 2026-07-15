/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

export type Enterprise = {
  id: number;
  name: string;
  status: number;
  admin_user_id: number;
  created_time: number;
  updated_time: number;
};

export type EnterpriseMembership = {
  enterprise: Enterprise;
  role: number;
  member: {
    id: number;
    user_id: number;
    joined_at: number;
  };
};

export type EnterpriseTag = {
  id: number;
  name: string;
  created_time: number;
};

export type EnterpriseMember = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  nickname: string;
  remark: string;
  quota: number;
  received_quota: number;
  role: number;
  joined_at: number;
  invitation_id: number;
  invitation_name: string;
  invitation_code: string;
  reviewed_by: number;
  reviewed_name: string;
  reviewed_at: number;
  tags: EnterpriseTag[];
};

export type EnterpriseInvitation = {
  id: number;
  enterprise_id: number;
  code: string;
  name: string;
  status: number;
  approve_mode: number;
  max_uses: number;
  used_count: number;
  expired_at: number;
  created_by: number;
  created_time: number;
};

export type JoinRequest = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  remark: string;
  created_time: number;
};

export type QuotaRecord = {
  id: number;
  admin_user_id: number;
  admin_name: string;
  member_user_id: number;
  member_name: string;
  member_display_name: string;
  amount: number;
  created_time: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type PaginatedData<T> = {
  page: number;
  page_size: number;
  total: number;
  items: T[];
};
