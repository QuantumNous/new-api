/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { api } from "@/lib/api";

import type {
  ApiResponse,
  Enterprise,
  EnterpriseInvitation,
  EnterpriseMember,
  EnterpriseMembership,
  EnterpriseTag,
  JoinRequest,
  PaginatedData,
} from "./types";

export type MemberFilters = {
  keyword?: string;
  tag_ids?: number[];
  invitation_ids?: number[];
  reviewed_by?: number[];
  joined_from?: number;
  joined_to?: number;
  page?: number;
  page_size?: number;
};

async function getData<T>(path: string, params?: Record<string, unknown>) {
  const response = await api.get<ApiResponse<T>>(path, { params });
  return response.data;
}

async function postData<T>(path: string, data?: unknown) {
  const response = await api.post<ApiResponse<T>>(path, data);
  return response.data;
}

export const enterpriseApi = {
  getCurrent: () => getData<EnterpriseMembership | null>("/api/enterprise/me"),
  join: (code: string, remark?: string) =>
    postData("/api/enterprise/join", { code, remark }),
  leave: () => postData("/api/enterprise/leave"),
  listEnterprises: () => getData<Enterprise[]>("/api/enterprise"),
  createEnterprise: (name: string, adminUserId: number) =>
    postData<Enterprise>("/api/enterprise", {
      name,
      admin_user_id: adminUserId,
    }),
  listMembers: (filters: MemberFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.keyword) {
      params.keyword = filters.keyword;
    }
    if (filters.tag_ids?.length) {
      params.tag_ids = filters.tag_ids.join(",");
    }
    if (filters.invitation_ids?.length) {
      params.invitation_ids = filters.invitation_ids.join(",");
    }
    if (filters.reviewed_by?.length) {
      params.reviewed_by = filters.reviewed_by.join(",");
    }
    if (filters.joined_from) {
      params.joined_from = filters.joined_from;
    }
    if (filters.joined_to) {
      params.joined_to = filters.joined_to;
    }
    if (filters.page) {
      params.p = filters.page;
    }
    if (filters.page_size) {
      params.page_size = filters.page_size;
    }
    return getData<PaginatedData<EnterpriseMember>>(
      "/api/enterprise/me/members",
      Object.keys(params).length ? params : undefined,
    );
  },
  removeMember: (userId: number) =>
    postData(`/api/enterprise/me/members/${userId}/remove`),
  updateMember: (userId: number, nickname: string) =>
    api
      .put<ApiResponse<unknown>>(`/api/enterprise/me/members/${userId}`, {
        nickname,
      })
      .then((response) => response.data),
  listTags: () => getData<EnterpriseTag[]>("/api/enterprise/me/tags"),
  createTag: (name: string) =>
    postData<EnterpriseTag>("/api/enterprise/me/tags", { name }),
  deleteTag: (id: number) => api.delete(`/api/enterprise/me/tags/${id}`),
  assignTags: (userId: number, tagIds: number[]) =>
    postData(`/api/enterprise/me/members/${userId}/tags`, { tag_ids: tagIds }),
  listInvitations: (status?: "active" | "all", keyword?: string) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (keyword) params.keyword = keyword;
    return getData<EnterpriseInvitation[]>(
      "/api/enterprise/me/invitations",
      Object.keys(params).length ? params : undefined,
    );
  },
  createInvitation: (
    maxUses: number,
    expiredAt: number,
    name: string,
    approveMode: number,
  ) =>
    postData<EnterpriseInvitation>("/api/enterprise/me/invitations", {
      max_uses: maxUses,
      expired_at: expiredAt,
      name,
      approve_mode: approveMode,
    }),
  revokeInvitation: (id: number) =>
    postData(`/api/enterprise/me/invitations/${id}/revoke`),
  listJoinRequests: () =>
    getData<JoinRequest[]>("/api/enterprise/me/join-requests"),
  approveRequest: (id: number) =>
    postData(`/api/enterprise/me/join-requests/${id}/approve`),
  rejectRequest: (id: number) =>
    postData(`/api/enterprise/me/join-requests/${id}/reject`),
  distribute: (memberIds: number[], amount: number) =>
    postData("/api/enterprise/me/quota/distribute", {
      member_ids: memberIds,
      amount,
    }),
};
