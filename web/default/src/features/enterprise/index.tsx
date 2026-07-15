/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/design-system/button";
import { Dialog } from "@/components/dialog";
import { Input } from "@/components/design-system/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/design-system/pagination";
import { SectionPageLayout } from "@/components/layout";
import { MultiSelect } from "@/components/multi-select";
import { CompactDateTimeRangePicker } from "@/features/usage-logs/components/compact-date-time-range-picker";
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
import type { EnterpriseMember, QuotaRecord } from "./types";

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
  const [nicknameMember, setNicknameMember] =
    useState<EnterpriseMember | null>(null);
  const [nicknameValue, setNicknameValue] = useState("");
  const [memberKeyword, setMemberKeyword] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [filterInvitationIds, setFilterInvitationIds] = useState<number[]>([]);
  const [filterReviewerIds, setFilterReviewerIds] = useState<number[]>([]);
  const [joinedFrom, setJoinedFrom] = useState<Date | undefined>(undefined);
  const [joinedTo, setJoinedTo] = useState<Date | undefined>(undefined);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(10);
  const [showRevoked, setShowRevoked] = useState(false);
  const [allRecordsOpen, setAllRecordsOpen] = useState(false);
  const [memberRecordsMember, setMemberRecordsMember] =
    useState<EnterpriseMember | null>(null);
  const membersQuery = useQuery({
    queryKey: [
      ...ENTERPRISE_QUERY_KEY,
      "members",
      memberKeyword,
      filterTagIds,
      filterInvitationIds,
      filterReviewerIds,
      joinedFrom,
      joinedTo,
      memberPage,
      memberPageSize,
    ],
    queryFn: () =>
      enterpriseApi.listMembers({
        keyword: memberKeyword.trim() || undefined,
        tag_ids: filterTagIds.length ? filterTagIds : undefined,
        invitation_ids: filterInvitationIds.length
          ? filterInvitationIds
          : undefined,
        reviewed_by: filterReviewerIds.length ? filterReviewerIds : undefined,
        joined_from: joinedFrom
          ? Math.floor(joinedFrom.getTime() / 1000)
          : undefined,
        joined_to: joinedTo ? Math.floor(joinedTo.getTime() / 1000) : undefined,
        page: memberPage,
        page_size: memberPageSize,
      }),
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
        inviteName.trim(),
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
  const updateNicknameMutation = useMutation({
    mutationFn: () =>
      nicknameMember
        ? enterpriseApi.updateMember(nicknameMember.user_id, nicknameValue)
        : Promise.resolve(null),
    onSuccess: async (response) => {
      if (!response || response.success) {
        setNicknameMember(null);
        setNicknameValue("");
        toast.success(t("Member nickname updated"));
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
    if (!inviteName.trim()) return;
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
  const formatTime = (ts: number) =>
    ts > 0 ? dayjs(ts * 1000).format("YYYY-MM-DD HH:mm") : "-";

  // Build dropdown options for filters
  const tagOptions = (tagsQuery.data?.data ?? []).map((tag) => ({
    label: tag.name,
    value: String(tag.id),
  }));
  const invitationOptions = (invitationsQuery.data?.data ?? []).map((inv) => ({
    label: inv.name,
    value: String(inv.id),
  }));
  // Reviewers are extracted from all members across pages — but since we only
  // have the current page, we derive reviewers from the members we've loaded.
  // For a complete list, we use the current page's unique reviewers.
  const reviewerMap = new Map<number, string>();
  for (const m of membersQuery.data?.data?.items ?? []) {
    if (m.reviewed_by > 0) {
      reviewerMap.set(m.reviewed_by, m.reviewed_name || `#${m.reviewed_by}`);
    }
  }
  const reviewerOptions = [...reviewerMap.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, name]) => ({ label: name, value: String(id) }));

  const totalMembers = membersQuery.data?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMembers / memberPageSize));
  const pageMembers = membersQuery.data?.data?.items ?? [];
  const selectableMembers = pageMembers.filter((m) => !isSelf(m));
  const allOnPageSelected =
    selectableMembers.length > 0 &&
    selectableMembers.every((m) => selectedMembers.includes(m.user_id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const pageIds = new Set(selectableMembers.map((m) => m.user_id));
      setSelectedMembers((current) => current.filter((id) => !pageIds.has(id)));
    } else {
      setSelectedMembers((current) => [
        ...current,
        ...selectableMembers
          .filter((m) => !current.includes(m.user_id))
          .map((m) => m.user_id),
      ]);
    }
  };

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
            <Button
              type="button"
              variant="outline"
              onClick={() => setAllRecordsOpen(true)}
            >
              {t("All records")}
            </Button>
          </form>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <Input
            value={memberKeyword}
            onChange={(event) => {
              setMemberKeyword(event.target.value);
              setMemberPage(1);
            }}
            placeholder={t("Search users")}
            aria-label={t("Search users")}
            className="w-[160px] shrink-0"
          />
          {tagOptions.length > 0 && (
            <MultiSelect
              options={tagOptions}
              selected={filterTagIds.map(String)}
              onChange={(vals) => {
                setFilterTagIds(vals.map(Number));
                setMemberPage(1);
              }}
              placeholder={t("Filter by tag")}
              className="w-[160px] shrink-0"
            />
          )}
          {invitationOptions.length > 0 && (
            <MultiSelect
              options={invitationOptions}
              selected={filterInvitationIds.map(String)}
              onChange={(vals) => {
                setFilterInvitationIds(vals.map(Number));
                setMemberPage(1);
              }}
              placeholder={t("Filter by invitation")}
              className="w-[160px] shrink-0"
            />
          )}
          {reviewerOptions.length > 0 && (
            <MultiSelect
              options={reviewerOptions}
              selected={filterReviewerIds.map(String)}
              onChange={(vals) => {
                setFilterReviewerIds(vals.map(Number));
                setMemberPage(1);
              }}
              placeholder={t("Filter by reviewer")}
              className="w-[160px] shrink-0"
            />
          )}
          <CompactDateTimeRangePicker
            start={joinedFrom}
            end={joinedTo}
            onChange={({ start, end }) => {
              setJoinedFrom(start);
              setJoinedTo(end);
              setMemberPage(1);
            }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 font-medium">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableMembers.length === 0}
                    aria-label={t("Select all on page")}
                  />
                </th>
                <th className="py-2 font-medium">{t("User")}</th>
                <th className="py-2 font-medium">{t("Quota")}</th>
                <th className="py-2 font-medium">{t("Received total")}</th>
                <th className="py-2 font-medium">{t("Tags")}</th>
                <th className="py-2 font-medium">{t("Joined")}</th>
                <th className="py-2 font-medium">{t("Invitation")}</th>
                <th className="py-2 font-medium">{t("Approved by")}</th>
                <th className="py-2 font-medium">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(membersQuery.data?.data?.items ?? []).map((member) => (
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
                    {member.nickname && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({member.nickname})
                      </span>
                    )}
                    {isSelf(member) && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({t("Admin")})
                      </span>
                    )}
                  </td>
                  <td className="py-2 tabular-nums">
                    {formatQuota(member.quota)}
                  </td>
                  <td className="py-2 tabular-nums">
                    {member.received_quota > 0 ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setMemberRecordsMember(member)}
                      >
                        {formatQuota(member.received_quota)}
                      </button>
                    ) : (
                      formatQuota(member.received_quota)
                    )}
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
                      onClick={() => {
                        setNicknameMember(member);
                        setNicknameValue(member.nickname || "");
                      }}
                    >
                      {t("Set nickname")}
                    </Button>
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
        {totalMembers > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">
              {t("Total")}: {totalMembers}
            </span>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                    className={
                      memberPage <= 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - memberPage) <= 1,
                  )
                  .map((p, idx, arr) => (
                    <PaginationItem key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 ? (
                        <span className="text-muted-foreground px-1">…</span>
                      ) : null}
                      <PaginationLink
                        isActive={p === memberPage}
                        onClick={() => setMemberPage(p)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setMemberPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      memberPage >= totalPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <select
              className="border-border bg-background rounded-md border px-2 py-1 text-xs"
              value={memberPageSize}
              onChange={(event) => {
                setMemberPageSize(Number(event.target.value));
                setMemberPage(1);
              }}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / {t("page")}
                </option>
              ))}
            </select>
          </div>
        )}
        {nicknameMember && (
          <form
            className="border-border grid gap-3 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                Array.from(nicknameValue.trim()).length > 32
              ) {
                return;
              }
              updateNicknameMutation.mutate();
            }}
          >
            <div className="text-sm font-medium">
              {t("Set nickname for {{name}}", {
                name:
                  nicknameMember.display_name || nicknameMember.username,
              })}
            </div>
            <Input
              value={nicknameValue}
              onChange={(event) => setNicknameValue(event.target.value)}
              maxLength={32}
              placeholder={t("Nickname (optional)")}
              aria-label={t("Nickname (optional)")}
              className="max-w-xs"
            />
            <div className="text-muted-foreground text-xs">
              {t("Max 32 characters")}
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  updateNicknameMutation.isPending ||
                  Array.from(nicknameValue.trim()).length > 32
                }
              >
                {t("Save nickname")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNicknameMember(null);
                  setNicknameValue("");
                }}
              >
                {t("Cancel")}
              </Button>
            </div>
          </form>
        )}
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
      <EnterprisePanel>
        <h2 className="text-base font-semibold">{t("Join requests")}</h2>
        <div className="grid gap-2">
          {(requestsQuery.data?.data ?? []).length === 0 && (
            <span className="text-muted-foreground text-sm">
              {t("No pending requests")}
            </span>
          )}
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
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
          <form
            className="flex flex-nowrap items-center gap-2 overflow-x-auto"
            onSubmit={submitInvitation}
          >
            <Input
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder={t("Invitation name")}
              aria-label={t("Invitation name")}
              className="w-[160px] shrink-0"
              required
            />
            <Input
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              inputMode="numeric"
              placeholder={t("Maximum uses (blank = unlimited)")}
              aria-label={t("Maximum uses")}
              className="w-[180px] shrink-0"
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
            <Button
              type="submit"
              disabled={
                createInvitationMutation.isPending || !inviteName.trim()
              }
            >
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
      <QuotaRecordsDialog
        open={allRecordsOpen}
        onOpenChange={setAllRecordsOpen}
        title={t("All quota distribution records")}
      />
      {memberRecordsMember && (
        <QuotaRecordsDialog
          open
          onOpenChange={(open) => {
            if (!open) setMemberRecordsMember(null);
          }}
          memberUserId={memberRecordsMember.user_id}
          title={t("Quota records for {{name}}", {
            name:
              memberRecordsMember.display_name || memberRecordsMember.username,
          })}
        />
      )}
    </div>
  );
}

function QuotaRecordsTable({ records }: { records: QuotaRecord[] }) {
  const { t } = useTranslation();
  const formatTime = (ts: number) =>
    ts > 0 ? dayjs(ts * 1000).format("YYYY-MM-DD HH:mm") : "-";
  if (records.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        {t("No records")}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground border-b">
          <tr>
            <th className="py-2 font-medium">{t("Time")}</th>
            <th className="py-2 font-medium">{t("From")}</th>
            <th className="py-2 font-medium">{t("To")}</th>
            <th className="py-2 font-medium">{t("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr className="border-b last:border-0" key={record.id}>
              <td className="py-2 whitespace-nowrap tabular-nums">
                {formatTime(record.created_time)}
              </td>
              <td className="py-2">{record.admin_name}</td>
              <td className="py-2">
                {record.member_display_name || record.member_name}
              </td>
              <td className="py-2 tabular-nums">
                {formatQuota(record.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuotaRecordsDialog({
  open,
  onOpenChange,
  memberUserId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberUserId?: number;
  title: string;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    if (open) setPage(1);
  }, [open, memberUserId]);
  const recordsQuery = useQuery({
    queryKey: [
      ...ENTERPRISE_QUERY_KEY,
      "quota-records",
      memberUserId,
      page,
      pageSize,
    ],
    queryFn: () =>
      enterpriseApi.listQuotaRecords({
        memberUserId,
        page,
        pageSize,
      }),
    enabled: open,
  });
  const total = recordsQuery.data?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const records = recordsQuery.data?.data?.items ?? [];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      contentClassName="sm:max-w-3xl"
      contentHeight="min(72vh, 640px)"
    >
      <div className="grid gap-3">
        <QuotaRecordsTable records={records} />
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">
              {t("Total")}: {total}
            </span>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={
                      page <= 1 ? "pointer-events-none opacity-50" : undefined
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - page) <= 1,
                  )
                  .map((p, idx, arr) => (
                    <PaginationItem key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 ? (
                        <span className="text-muted-foreground px-1">…</span>
                      ) : null}
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      page >= totalPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <select
              className="border-border bg-background rounded-md border px-2 py-1 text-xs"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / {t("page")}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Dialog>
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
