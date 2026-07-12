/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/design-system/button";
import { Input } from "@/components/design-system/input";
import { SectionPageLayout } from "@/components/layout";
import dayjs from "@/lib/dayjs";
import { formatQuota, parseQuotaFromDollars } from "@/lib/format";
import { ROLE } from "@/lib/roles";
import { useAuthStore } from "@/stores/auth-store";

import { enterpriseApi } from "./api";
import {
  ENTERPRISE_MEMBER_ROLE,
  ENTERPRISE_STATUS_LABELS,
  INVITATION_APPROVE_MODE,
  INVITATION_APPROVE_MODE_LABELS,
  INVITATION_STATUS,
  INVITATION_STATUS_LABELS,
} from "./constants";
import type { EnterpriseMember } from "./types";

const ENTERPRISE_QUERY_KEY = ["enterprise"] as const;

function EnterprisePanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-border grid gap-3 rounded-lg border p-4">
      {children}
    </section>
  );
}

function JoinEnterprisePanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [remark, setRemark] = useState("");
  const joinMutation = useMutation({
    mutationFn: (payload: { code: string; remark?: string }) =>
      enterpriseApi.join(payload.code, payload.remark),
    onSuccess: async (response) => {
      if (!response.success) return;
      setCode("");
      setRemark("");
      toast.success(t("Join request submitted"));
      await queryClient.invalidateQueries({ queryKey: ENTERPRISE_QUERY_KEY });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim()) {
      joinMutation.mutate({
        code: code.trim(),
        remark: remark.trim() || undefined,
      });
    }
  };

  return (
    <EnterprisePanel>
      <div>
        <h2 className="text-base font-semibold">{t("Join an enterprise")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("Enter an invitation code to submit a join request")}
        </p>
      </div>
      <form className="grid max-w-lg gap-2" onSubmit={handleSubmit}>
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t("Invitation code")}
          aria-label={t("Invitation code")}
        />
        <Input
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          placeholder={t("Remark (optional)")}
          aria-label={t("Remark (optional)")}
        />
        <Button type="submit" disabled={joinMutation.isPending}>
          {t("Submit request")}
        </Button>
      </form>
    </EnterprisePanel>
  );
}

function MembershipPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const membershipQuery = useQuery({
    queryKey: ENTERPRISE_QUERY_KEY,
    queryFn: enterpriseApi.getCurrent,
  });
  const leaveMutation = useMutation({
    mutationFn: enterpriseApi.leave,
    onSuccess: async (response) => {
      if (!response.success) return;
      toast.success(t("You left the enterprise"));
      await queryClient.invalidateQueries({ queryKey: ENTERPRISE_QUERY_KEY });
    },
  });
  const membership = membershipQuery.data?.data;

  if (membershipQuery.isLoading) {
    return <div className="text-muted-foreground text-sm">{t("Loading")}</div>;
  }
  if (!membership) return <JoinEnterprisePanel />;
  return (
    <EnterprisePanel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {membership.enterprise.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            {membership.role === ENTERPRISE_MEMBER_ROLE.ADMIN
              ? t("Enterprise administrator")
              : t("Enterprise member")}
          </p>
        </div>
        {membership.role !== ENTERPRISE_MEMBER_ROLE.ADMIN && (
          <Button
            variant="outline"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            {t("Leave enterprise")}
          </Button>
        )}
      </div>
    </EnterprisePanel>
  );
}

function SystemEnterprisePanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [administratorId, setAdministratorId] = useState("");
  const enterprisesQuery = useQuery({
    queryKey: [...ENTERPRISE_QUERY_KEY, "list"],
    queryFn: enterpriseApi.listEnterprises,
  });
  const createMutation = useMutation({
    mutationFn: ({
      enterpriseName,
      userId,
    }: {
      enterpriseName: string;
      userId: number;
    }) => enterpriseApi.createEnterprise(enterpriseName, userId),
    onSuccess: async (response) => {
      if (!response.success) return;
      setName("");
      setAdministratorId("");
      toast.success(t("Enterprise created"));
      await queryClient.invalidateQueries({
        queryKey: [...ENTERPRISE_QUERY_KEY, "list"],
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = Number(administratorId);
    if (name.trim() && Number.isInteger(userId) && userId > 0) {
      createMutation.mutate({ enterpriseName: name.trim(), userId });
    }
  };

  return (
    <div className="grid gap-4">
      <EnterprisePanel>
        <h2 className="text-base font-semibold">{t("Create enterprise")}</h2>
        <form
          className="grid max-w-xl gap-3 sm:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("Enterprise name")}
            aria-label={t("Enterprise name")}
          />
          <Input
            value={administratorId}
            onChange={(event) => setAdministratorId(event.target.value)}
            inputMode="numeric"
            placeholder={t("Administrator user ID")}
            aria-label={t("Administrator user ID")}
          />
          <Button type="submit" disabled={createMutation.isPending}>
            {t("Create enterprise")}
          </Button>
        </form>
      </EnterprisePanel>
      <EnterprisePanel>
        <h2 className="text-base font-semibold">{t("Enterprises")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 font-medium">{t("Name")}</th>
                <th className="py-2 font-medium">{t("Administrator")}</th>
                <th className="py-2 font-medium">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {enterprisesQuery.data?.data.map((enterprise) => (
                <tr className="border-b last:border-0" key={enterprise.id}>
                  <td className="py-2">{enterprise.name}</td>
                  <td className="py-2 tabular-nums">
                    {enterprise.admin_user_id}
                  </td>
                  <td className="py-2">
                    {t(
                      ENTERPRISE_STATUS_LABELS[enterprise.status] ?? "Unknown",
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EnterprisePanel>
    </div>
  );
}

function EnterpriseAdminPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.auth.user?.id);
  const [amount, setAmount] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [tagName, setTagName] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [approveMode, setApproveMode] = useState<number>(
    INVITATION_APPROVE_MODE.AUTO,
  );
  const [tagMember, setTagMember] = useState<EnterpriseMember | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [showRevoked, setShowRevoked] = useState(false);
  const membersQuery = useQuery({
    queryKey: [...ENTERPRISE_QUERY_KEY, "members", filterTagIds],
    queryFn: () =>
      enterpriseApi.listMembers(
        filterTagIds.length ? { tag_ids: filterTagIds.join(",") } : undefined,
      ),
  });
  const tagsQuery = useQuery({
    queryKey: [...ENTERPRISE_QUERY_KEY, "tags"],
    queryFn: enterpriseApi.listTags,
  });
  const invitationsQuery = useQuery({
    queryKey: [...ENTERPRISE_QUERY_KEY, "invitations", showRevoked],
    queryFn: () =>
      enterpriseApi.listInvitations(showRevoked ? "all" : "active"),
  });
  const requestsQuery = useQuery({
    queryKey: [...ENTERPRISE_QUERY_KEY, "requests"],
    queryFn: enterpriseApi.listJoinRequests,
  });
  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: ENTERPRISE_QUERY_KEY });
  const distributeMutation = useMutation({
    mutationFn: () =>
      enterpriseApi.distribute(
        selectedMembers,
        parseQuotaFromDollars(Number(amount)),
      ),
    onSuccess: async (response) => {
      if (response.success) {
        setAmount("");
        setSelectedMembers([]);
        toast.success(t("Quota distributed"));
        await refresh();
      }
    },
  });
  const createTagMutation = useMutation({
    mutationFn: () => enterpriseApi.createTag(tagName.trim()),
    onSuccess: async (response) => {
      if (response.success) {
        setTagName("");
        await refresh();
      }
    },
  });
  const deleteTagMutation = useMutation({
    mutationFn: enterpriseApi.deleteTag,
    onSuccess: async (response) => {
      if (response.data.success) {
        toast.success(t("Tag deleted"));
        setFilterTagIds((current) =>
          current.filter((id) => id !== deleteTagMutation.variables),
        );
        await refresh();
      }
    },
  });
  const createInvitationMutation = useMutation({
    mutationFn: () =>
      enterpriseApi.createInvitation(
        maxUses.trim() === "" ? -1 : Number(maxUses),
        0,
        inviteName.trim() || undefined,
        approveMode,
      ),
    onSuccess: async (response) => {
      if (response.success) {
        setMaxUses("");
        setInviteName("");
        toast.success(t("Invitation created"));
        await refresh();
      }
    },
  });
  const removeMutation = useMutation({
    mutationFn: enterpriseApi.removeMember,
    onSuccess: refresh,
  });
  const revokeMutation = useMutation({
    mutationFn: enterpriseApi.revokeInvitation,
    onSuccess: async (response) => {
      if (response.success) {
        toast.success(t("Invitation revoked"));
        await refresh();
      }
    },
  });
  const assignTagsMutation = useMutation({
    mutationFn: () =>
      tagMember
        ? enterpriseApi.assignTags(tagMember.user_id, selectedTagIds)
        : Promise.resolve(null),
    onSuccess: async (response) => {
      if (!response || response.success) {
        setTagMember(null);
        setSelectedTagIds([]);
        toast.success(t("Member tags updated"));
        await refresh();
      }
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      approve
        ? enterpriseApi.approveRequest(id)
        : enterpriseApi.rejectRequest(id),
    onSuccess: refresh,
  });

  const isSelf = (member: EnterpriseMember) => member.user_id === currentUserId;
  const toggleMember = (member: EnterpriseMember) => {
    if (isSelf(member)) return;
    setSelectedMembers((current) =>
      current.includes(member.user_id)
        ? current.filter((id) => id !== member.user_id)
        : [...current, member.user_id],
    );
  };
  const submitDistribution = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedMembers.length && Number(amount) > 0) {
      if (
        !window.confirm(
          t("Distribute {{amount}} to {{count}} members?", {
            amount: formatQuota(parseQuotaFromDollars(Number(amount))),
            count: selectedMembers.length,
          }),
        )
      ) {
        return;
      }
      distributeMutation.mutate();
    }
  };
  const submitTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tagName.trim()) createTagMutation.mutate();
  };
  const submitInvitation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      maxUses.trim() === "" ||
      Number(maxUses) === -1 ||
      Number(maxUses) > 0
    ) {
      createInvitationMutation.mutate();
    }
  };
  const openTagEditor = (member: EnterpriseMember) => {
    setTagMember(member);
    setSelectedTagIds((member.tags ?? []).map((tag) => tag.id));
  };
  const toggleTag = (tagId: number) =>
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  const toggleFilterTag = (tagId: number) =>
    setFilterTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  const formatTime = (ts: number) =>
    ts > 0 ? dayjs(ts * 1000).format("YYYY-MM-DD HH:mm") : "-";

  return (
    <div className="grid gap-4">
      <EnterprisePanel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("Members")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("Select members to distribute quota or remove them")}
            </p>
          </div>
          <form className="flex gap-2" onSubmit={submitDistribution}>
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="numeric"
              placeholder={t("Amount per member")}
              aria-label={t("Amount per member")}
            />
            <Button
              type="submit"
              disabled={!selectedMembers.length || distributeMutation.isPending}
            >
              {t("Distribute quota")}
            </Button>
          </form>
        </div>
        {(tagsQuery.data?.data ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t("Filter by tag")}:
            </span>
            {(tagsQuery.data?.data ?? []).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleFilterTag(tag.id)}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${filterTagIds.includes(tag.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {tag.name}
              </button>
            ))}
            {filterTagIds.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterTagIds([])}
                className="text-muted-foreground text-xs underline"
              >
                {t("Clear")}
              </button>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 font-medium">{t("Select")}</th>
                <th className="py-2 font-medium">{t("User")}</th>
                <th className="py-2 font-medium">{t("Quota")}</th>
                <th className="py-2 font-medium">{t("Tags")}</th>
                <th className="py-2 font-medium">{t("Joined")}</th>
                <th className="py-2 font-medium">{t("Invitation")}</th>
                <th className="py-2 font-medium">{t("Approved by")}</th>
                <th className="py-2 font-medium">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {membersQuery.data?.data.map((member) => (
                <tr className="border-b last:border-0" key={member.id}>
                  <td className="py-2">
                    {isSelf(member) ? (
                      <span className="text-muted-foreground text-xs">
                        {t("You")}
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.user_id)}
                        onChange={() => toggleMember(member)}
                        aria-label={t("Select member")}
                      />
                    )}
                  </td>
                  <td className="py-2">
                    {member.display_name || member.username}
                    {isSelf(member) && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({t("Admin")})
                      </span>
                    )}
                  </td>
                  <td className="py-2 tabular-nums">
                    {formatQuota(member.quota)}
                  </td>
                  <td className="py-2">
                    {(member.tags ?? []).map((tag) => tag.name).join(", ") ||
                      "-"}
                  </td>
                  <td className="py-2 whitespace-nowrap tabular-nums">
                    {formatTime(member.joined_at)}
                  </td>
                  <td
                    className="py-2 text-xs"
                    title={member.invitation_code || undefined}
                  >
                    {member.invitation_id > 0
                      ? member.invitation_name ||
                        `…${(member.invitation_code || "").slice(-6)}`
                      : "-"}
                  </td>
                  <td className="py-2">
                    {member.reviewed_by > 0
                      ? member.reviewed_name || `#${member.reviewed_by}`
                      : t("Auto")}
                  </td>
                  <td className="flex gap-2 py-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => openTagEditor(member)}
                    >
                      {t("Set tags")}
                    </Button>
                    {!isSelf(member) && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => removeMutation.mutate(member.user_id)}
                      >
                        {t("Remove")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tagMember && (
          <form
            className="border-border grid gap-3 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              assignTagsMutation.mutate();
            }}
          >
            <div className="text-sm font-medium">
              {t("Set tags for {{name}}", {
                name: tagMember.display_name || tagMember.username,
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              {tagsQuery.data?.data.map((tag) => (
                <label
                  className="flex items-center gap-1.5 text-sm"
                  key={tag.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={assignTagsMutation.isPending}>
                {t("Save tags")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTagMember(null)}
              >
                {t("Cancel")}
              </Button>
            </div>
          </form>
        )}
      </EnterprisePanel>
      <div className="grid gap-4 lg:grid-cols-2">
        <EnterprisePanel>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t("Invitation codes")}</h2>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showRevoked}
                onChange={(event) => setShowRevoked(event.target.checked)}
              />
              {t("Show revoked")}
            </label>
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={submitInvitation}>
            <Input
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder={t("Invitation name (optional)")}
              aria-label={t("Invitation name")}
              className="min-w-40"
            />
            <Input
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              inputMode="numeric"
              placeholder={t("Maximum uses (blank = unlimited)")}
              aria-label={t("Maximum uses")}
            />
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={t("Approval mode")}
            >
              <button
                type="button"
                onClick={() => setApproveMode(INVITATION_APPROVE_MODE.AUTO)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${approveMode === INVITATION_APPROVE_MODE.AUTO ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {t("Auto approval")}
              </button>
              <button
                type="button"
                onClick={() => setApproveMode(INVITATION_APPROVE_MODE.MANUAL)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${approveMode === INVITATION_APPROVE_MODE.MANUAL ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {t("Manual approval")}
              </button>
            </div>
            <Button type="submit" disabled={createInvitationMutation.isPending}>
              {t("Create invitation")}
            </Button>
          </form>
          <p className="text-muted-foreground text-xs">
            {t(
              "Auto approval lets users join immediately; manual approval requires administrator review.",
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="py-2 font-medium">{t("Name")}</th>
                  <th className="py-2 font-medium">{t("Code")}</th>
                  <th className="py-2 font-medium">{t("Approval")}</th>
                  <th className="py-2 font-medium">{t("Status")}</th>
                  <th className="py-2 font-medium">{t("Usage")}</th>
                  <th className="py-2 font-medium">{t("Created")}</th>
                  <th className="py-2 font-medium">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {invitationsQuery.data?.data.map((invitation) => (
                  <tr className="border-b last:border-0" key={invitation.id}>
                    <td className="py-2">{invitation.name || "-"}</td>
                    <td className="py-2 font-mono text-xs">
                      {invitation.code}
                    </td>
                    <td className="py-2 text-xs">
                      {t(
                        INVITATION_APPROVE_MODE_LABELS[
                          invitation.approve_mode
                        ] ?? "Auto approval",
                      )}
                    </td>
                    <td className="py-2">
                      {t(
                        INVITATION_STATUS_LABELS[invitation.status] ??
                          "Unknown",
                      )}
                    </td>
                    <td className="py-2 tabular-nums">
                      {invitation.used_count}/
                      {invitation.max_uses === -1 ? "∞" : invitation.max_uses}
                    </td>
                    <td className="py-2 whitespace-nowrap tabular-nums">
                      {formatTime(invitation.created_time)}
                    </td>
                    <td className="flex gap-2 py-2">
                      {invitation.status === INVITATION_STATUS.ENABLED && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => revokeMutation.mutate(invitation.id)}
                        >
                          {t("Revoke")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EnterprisePanel>
        <EnterprisePanel>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t("Tags")}</h2>
            <form className="flex gap-2" onSubmit={submitTag}>
              <Input
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder={t("Tag name")}
                aria-label={t("Tag name")}
                className="w-32"
              />
              <Button
                type="submit"
                size="sm"
                disabled={createTagMutation.isPending || !tagName.trim()}
              >
                {t("Add")}
              </Button>
            </form>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(tagsQuery.data?.data ?? []).length === 0 && (
              <span className="text-muted-foreground text-sm">
                {t("No tags yet")}
              </span>
            )}
            {tagsQuery.data?.data.map((tag) => (
              <span
                className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                key={tag.id}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("Delete this tag?"))) {
                      deleteTagMutation.mutate(tag.id);
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive -mr-0.5 flex size-4 items-center justify-center rounded-full transition-colors"
                  aria-label={t("Delete tag")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </EnterprisePanel>
      </div>
      <EnterprisePanel>
        <h2 className="text-base font-semibold">{t("Join requests")}</h2>
        <div className="grid gap-2">
          {requestsQuery.data?.data.map((request) => (
            <div
              className="border-border flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
              key={request.id}
            >
              <div className="text-sm">
                <div>
                  {request.display_name || request.username}{" "}
                  <span className="text-muted-foreground">
                    @{request.username}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {t("User ID")}:{" "}
                  <span className="tabular-nums">{request.user_id}</span>
                </div>
                {request.remark && (
                  <div className="text-muted-foreground">
                    {t("Remark")}: {request.remark}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="xs"
                  onClick={() =>
                    reviewMutation.mutate({ id: request.id, approve: true })
                  }
                >
                  {t("Approve")}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    reviewMutation.mutate({ id: request.id, approve: false })
                  }
                >
                  {t("Reject")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    </div>
  );
}

export function EnterpriseManagement() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const membershipQuery = useQuery({
    queryKey: ENTERPRISE_QUERY_KEY,
    queryFn: enterpriseApi.getCurrent,
  });
  const isSystemAdmin = (user?.role ?? 0) >= ROLE.ADMIN;
  const isEnterpriseAdmin =
    membershipQuery.data?.data?.role === ENTERPRISE_MEMBER_ROLE.ADMIN;

  let panel: React.ReactNode;
  if (isSystemAdmin) {
    panel = <SystemEnterprisePanel />;
  } else if (isEnterpriseAdmin) {
    panel = <EnterpriseAdminPanel />;
  } else {
    panel = <MembershipPanel />;
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t("Enterprise management")}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>{panel}</SectionPageLayout.Content>
    </SectionPageLayout>
  );
}
