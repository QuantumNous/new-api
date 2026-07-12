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
} from "./types";

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
  listMembers: (params?: Record<string, unknown>) =>
    getData<EnterpriseMember[]>("/api/enterprise/me/members", params),
  removeMember: (userId: number) =>
    postData(`/api/enterprise/me/members/${userId}/remove`),
  listTags: () => getData<EnterpriseTag[]>("/api/enterprise/me/tags"),
  createTag: (name: string) =>
    postData<EnterpriseTag>("/api/enterprise/me/tags", { name }),
  deleteTag: (id: number) => api.delete(`/api/enterprise/me/tags/${id}`),
  assignTags: (userId: number, tagIds: number[]) =>
    postData(`/api/enterprise/me/members/${userId}/tags`, { tag_ids: tagIds }),
  listInvitations: (status?: "active" | "all") =>
    getData<EnterpriseInvitation[]>(
      "/api/enterprise/me/invitations",
      status ? { status } : undefined,
    ),
  createInvitation: (
    maxUses: number,
    expiredAt: number,
    name: string | undefined,
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
