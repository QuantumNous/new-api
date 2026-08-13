import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Trash2, TestTube2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getChannels } from "@/features/channels/api";
import { getGroups } from "@/features/users/api";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  clearProxyNodeErrors,
  createProxyNode,
  createProxyNodesBatch,
  deleteProxyNode,
  fetchProxyNodeDetail,
  fetchProxyNodeReport,
  fetchProxyNodes,
  setProxyNodesEnabled,
  testAllProxyNodes,
  testProxyNode,
  updateProxyNode,
} from "./proxy-node-api";
import { proxyNodeDefaultScopeValue } from "./proxy-node-scope";

import type {
  ProxyNode,
  ProxyNodeBatchRequest,
  ProxyNodeBatchResult,
  ProxyNodeRequest,
} from "./proxy-node-types";

type EditorState = ProxyNodeRequest & { id?: number };

const emptyEditor = (): EditorState => ({
  name: "",
  enabled: true,
  proxy: "",
  scope_type: "all",
  scope_value: "",
});

const emptyBatch = (): ProxyNodeBatchRequest => ({
  name_prefix: "",
  enabled: true,
  proxy_text: "",
  scope_type: "all",
  scope_value: "",
});

export function ProxyNodeView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [batch, setBatch] = useState<ProxyNodeBatchRequest | null>(null);
  const [batchResult, setBatchResult] = useState<ProxyNodeBatchResult | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<ProxyNode | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [sortField, setSortField] = useState<"name" | "health" | "probe_count">(
    "name",
  );

  const nodesQuery = useQuery({
    queryKey: ["proxy-nodes"],
    queryFn: fetchProxyNodes,
    retry: false,
  });
  const reportQuery = useQuery({
    queryKey: ["proxy-nodes", "report"],
    queryFn: fetchProxyNodeReport,
    retry: false,
  });
  const channelsQuery = useQuery({
    queryKey: ["proxy-node-scope", "channels"],
    queryFn: async () =>
      (await getChannels({ p: 1, page_size: 1000 })).data?.items ?? [],
    staleTime: 5 * 60 * 1000,
  });
  const groupsQuery = useQuery({
    queryKey: ["proxy-node-scope", "groups"],
    queryFn: getGroups,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["proxy-nodes"] });
  };

  const saveMutation = useMutation({
    mutationFn: (value: EditorState) =>
      value.id ? updateProxyNode(value.id, value) : createProxyNode(value),
    onSuccess: () => {
      setEditor(null);
      invalidate();
      toast.success(t("Saved successfully"));
    },
    onError: (error: Error) =>
      toast.error(error.message || t("Failed to save")),
  });
  const batchMutation = useMutation({
    mutationFn: createProxyNodesBatch,
    onSuccess: (result) => {
      setBatchResult(result);
      setBatch(null);
      invalidate();
      toast.success(
        t("Created {{created}}, failed {{failed}}", {
          created: result.created,
          failed: result.failed,
        }),
      );
    },
    onError: (error: Error) =>
      toast.error(error.message || t("Batch import failed")),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteProxyNode,
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error: Error) =>
      toast.error(error.message || t("Failed to delete")),
  });
  const testMutation = useMutation({
    mutationFn: testProxyNode,
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message || t("Test failed")),
  });
  const testAllMutation = useMutation({
    mutationFn: testAllProxyNodes,
    onSuccess: (result) => {
      invalidate();
      toast.success(t("Tested {{passed}} of {{total}} nodes", result));
    },
    onError: (error: Error) => toast.error(error.message || t("Test failed")),
  });
  const enabledMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      setProxyNodesEnabled([...selectedIds], enabled),
    onSuccess: () => {
      setSelectedIds(new Set());
      invalidate();
    },
    onError: (error: Error) =>
      toast.error(error.message || t("Batch update failed")),
  });
  const clearErrorsMutation = useMutation({
    mutationFn: () => clearProxyNodeErrors([...selectedIds]),
    onSuccess: () => {
      setSelectedIds(new Set());
      invalidate();
    },
    onError: (error: Error) =>
      toast.error(error.message || t("Failed to clear errors")),
  });

  const nodes = useMemo(() => {
    const items = [...(nodesQuery.data ?? [])];
    return items.sort((left, right) => {
      if (sortField === "name") return left.name.localeCompare(right.name);
      if (sortField === "health") return right.health - left.health;
      return right.probe_total - left.probe_total;
    });
  }, [nodesQuery.data, sortField]);
  const report = reportQuery.data;
  const selectedCount = selectedIds.size;

  const openBatch = () => {
    setBatchResult(null);
    setBatch(emptyBatch());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={invalidate}
            disabled={nodesQuery.isFetching}
          >
            <RefreshCw className="size-4" />
            {t("Refresh")}
          </Button>
          <Button onClick={() => setEditor(emptyEditor())}>
            <Plus className="size-4" />
            {t("Add Proxy Node")}
          </Button>
          <Button variant="outline" onClick={openBatch}>
            <Plus className="size-4" />
            {t("Batch Import")}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => testAllMutation.mutate()}
          disabled={nodes.length === 0 || testAllMutation.isPending}
        >
          {testAllMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TestTube2 className="size-4" />
          )}
          {t("Test All Nodes")}
        </Button>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
          <span className="text-muted-foreground text-sm">
            {t("{{count}} selected", { count: selectedCount })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => enabledMutation.mutate(true)}
            disabled={enabledMutation.isPending}
          >
            {t("Enable Selected")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => enabledMutation.mutate(false)}
            disabled={enabledMutation.isPending}
          >
            {t("Disable Selected")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => clearErrorsMutation.mutate()}
            disabled={clearErrorsMutation.isPending}
          >
            {t("Clear Errors")}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NodeMetric
          label={t("Nodes")}
          value={String(report?.total ?? 0)}
          detail={t("{{count}} enabled", { count: report?.enabled ?? 0 })}
        />
        <NodeMetric
          label={t("Healthy Nodes")}
          value={String(report?.healthy ?? 0)}
          detail={t("of {{count}} total", { count: report?.total ?? 0 })}
        />
        <NodeMetric
          label={t("Probe Success Rate")}
          value={
            report?.probe_total ? `${report.success_rate.toFixed(1)}%` : "-"
          }
          detail={t("{{count}} probes", { count: report?.probe_total ?? 0 })}
        />
        <NodeMetric
          label={t("Probe Failure Rate")}
          value={
            report?.probe_total ? `${report.failure_rate.toFixed(1)}%` : "-"
          }
          detail={t("{{count}} failed", { count: report?.probe_failed ?? 0 })}
        />
        <NodeMetric
          label={t("Probe Count")}
          value={String(report?.probe_total ?? 0)}
          detail={t("Process-local statistics reset on restart")}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{t("Proxy Nodes")}</CardTitle>
          <Select
            value={sortField}
            onValueChange={(value) => {
              if (
                value === "name" ||
                value === "health" ||
                value === "probe_count"
              ) {
                setSortField(value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="name">{t("Sort by Name")}</SelectItem>
                <SelectItem value="health">{t("Sort by Health")}</SelectItem>
                <SelectItem value="probe_count">
                  {t("Sort by Probe Count")}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {nodesQuery.isLoading && (
            <p className="text-muted-foreground text-sm">{t("Loading...")}</p>
          )}
          {nodesQuery.error && (
            <p className="text-destructive text-sm">
              {(nodesQuery.error as Error).message}
            </p>
          )}
          {!nodesQuery.isLoading && !nodesQuery.error && nodes.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {t(
                "No proxy nodes are configured. Existing global proxy and direct channel behavior are unchanged.",
              )}
            </p>
          )}
          {nodes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left">
                  <tr>
                    <th className="p-2">
                      <span className="sr-only">{t("Select")}</span>
                    </th>
                    {[
                      "Name",
                      "Enabled",
                      "Scope",
                      "Protocol",
                      "Health",
                      "Probe Success Rate",
                      "Probe Failure Rate",
                      "Probe Count",
                      "Last Probe",
                      "Actions",
                    ].map((key) => (
                      <th className="p-2" key={key}>
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <ProxyNodeRow
                      key={node.id}
                      node={node}
                      selected={selectedIds.has(node.id)}
                      onSelectedChange={(selected) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (selected) next.add(node.id);
                          else next.delete(node.id);
                          return next;
                        });
                      }}
                      onEdit={async () => {
                        const detail = await fetchProxyNodeDetail(node.id);
                        setEditor({
                          ...node,
                          proxy: detail.proxy,
                          scope_value: node.scope_value ?? "",
                        });
                      }}
                      onTest={() => testMutation.mutate(node.id)}
                      testing={
                        testMutation.isPending &&
                        testMutation.variables === node.id
                      }
                      onDelete={() => setDeleteTarget(node)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editor && (
        <ProxyNodeEditor
          editor={editor}
          channels={channelsQuery.data ?? []}
          groups={groupsQuery.data?.data ?? []}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={() => saveMutation.mutate(editor)}
          saving={saveMutation.isPending}
        />
      )}
      {batch && (
        <ProxyNodeBatchEditor
          batch={batch}
          channels={channelsQuery.data ?? []}
          groups={groupsQuery.data?.data ?? []}
          result={batchResult}
          onChange={setBatch}
          onClose={() => setBatch(null)}
          onSave={() => batchMutation.mutate(batch)}
          saving={batchMutation.isPending}
        />
      )}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Proxy Node")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Delete proxy node "{{name}}"? This cannot be undone.', {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NodeMetric(props: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{props.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{props.value}</p>
        <p className="text-muted-foreground text-xs">{props.detail}</p>
      </CardContent>
    </Card>
  );
}

function ProxyNodeRow(props: {
  node: ProxyNode;
  selected: boolean;
  testing: boolean;
  onSelectedChange: (selected: boolean) => void;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const node = props.node;
  const successRate = node.probe_total
    ? `${((node.probe_success / node.probe_total) * 100).toFixed(1)}%`
    : "-";
  const failureRate = node.probe_total
    ? `${(((node.probe_total - node.probe_success) / node.probe_total) * 100).toFixed(1)}%`
    : "-";
  let scope = t("All Channels");
  if (node.scope_type === "channel") {
    scope = node.scope_name || t("Channel #{{id}}", { id: node.scope_value });
  } else if (node.scope_type === "group") {
    scope = t("Group: {{name}}", { name: node.scope_value });
  }
  return (
    <tr className={cn("border-b last:border-0", !node.enabled && "opacity-50")}>
      <td className="p-2">
        <Checkbox
          checked={props.selected}
          aria-label={t("Select {{name}}", { name: node.name })}
          onCheckedChange={(checked) =>
            props.onSelectedChange(checked === true)
          }
        />
      </td>
      <td className="p-2">
        <div>{node.name}</div>
        {node.last_error && (
          <div className="text-destructive text-xs">
            {node.last_error}
            {node.last_probe_at
              ? ` · ${new Date(node.last_probe_at).toLocaleString()}`
              : ""}
          </div>
        )}
      </td>
      <td className="p-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            node.enabled ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              node.enabled ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
          {node.enabled ? t("Enabled") : t("Disabled")}
        </span>
      </td>
      <td className="p-2">{scope}</td>
      <td className="p-2">{node.protocol}</td>
      <td className="p-2">{`${(node.health * 100).toFixed(0)}%`}</td>
      <td className="p-2">{successRate}</td>
      <td className="p-2">{failureRate}</td>
      <td className="p-2">{node.probe_total}</td>
      <td className="p-2">
        {node.last_probe_at
          ? new Date(node.last_probe_at).toLocaleString()
          : "-"}
      </td>
      <td className="p-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={props.onTest}
            disabled={props.testing}
          >
            {props.testing && <Loader2 className="size-4 animate-spin" />}
            {t("Test")}
          </Button>
          <Button size="sm" variant="outline" onClick={props.onEdit}>
            {t("Edit")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            aria-label={t("Delete Proxy Node")}
            onClick={props.onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ProxyNodeEditor(props: {
  editor: EditorState;
  channels: Array<{ id: number; name: string }>;
  groups: string[];
  onChange: (value: EditorState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const editor = props.editor;
  const isAll = editor.scope_type === "all";

  useEffect(() => {
    if (isAll || editor.scope_value) return;
    const scopeValue = proxyNodeDefaultScopeValue(
      editor.scope_type,
      props.channels,
      props.groups,
    );
    if (scopeValue) props.onChange({ ...editor, scope_value: scopeValue });
  }, [editor, isAll, props.channels, props.groups, props.onChange]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editor.id ? t("Edit Proxy Node") : t("Add Proxy Node")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("Name")}</Label>
            <Input
              value={editor.name}
              onChange={(event) =>
                props.onChange({ ...editor, name: event.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={editor.enabled}
              onCheckedChange={(enabled) =>
                props.onChange({ ...editor, enabled })
            }
            />
            <Label>{t("Enabled")}</Label>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Scope Type")}</Label>
            <Select
              value={editor.scope_type}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "channel" ||
                  value === "group"
                ) {
                  props.onChange({
                    ...editor,
                    scope_type: value,
                    scope_value: proxyNodeDefaultScopeValue(
                      value,
                      props.channels,
                      props.groups,
                    ),
                  });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">{t("All Channels")}</SelectItem>
                  <SelectItem value="channel">
                    {t("Specific Channel")}
                  </SelectItem>
                  <SelectItem value="group">{t("By Group")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {!isAll && (
            <div className="space-y-1.5">
              <Label>
                {editor.scope_type === "channel"
                  ? t("Channel ID")
                  : t("Group Name")}
              </Label>
              {editor.scope_type === "channel" && props.channels.length > 0 ? (
                <Select
                  value={editor.scope_value ?? ""}
                  onValueChange={(scope_value) =>
                    props.onChange({ ...editor, scope_value: scope_value || undefined })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.channels.map((channel) => (
                      <SelectItem key={channel.id} value={String(channel.id)}>
                        {channel.name} (#{channel.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : editor.scope_type === "group" && props.groups.length > 0 ? (
                <Select
                  value={editor.scope_value ?? ""}
                  onValueChange={(scope_value) =>
                    props.onChange({ ...editor, scope_value: scope_value || undefined })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.groups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={editor.scope_value ?? ""}
                  onChange={(event) =>
                    props.onChange({
                      ...editor,
                      scope_value: event.target.value,
                    })
                  }
                />
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t("Proxy Link")}</Label>
            <Input
              type="text"
              value={editor.proxy}
              placeholder={editor.id ? "" : "vless://…"}
              onChange={(event) =>
                props.onChange({ ...editor, proxy: event.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={props.onSave}
            disabled={
              props.saving || !editor.name || (!editor.id && !editor.proxy)
            }
          >
            {props.saving ? t("Saving...") : t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProxyNodeBatchEditor(props: {
  batch: ProxyNodeBatchRequest;
  channels: Array<{ id: number; name: string }>;
  groups: string[];
  result: ProxyNodeBatchResult | null;
  onChange: (value: ProxyNodeBatchRequest | null) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const batch = props.batch;
  const isAll = batch.scope_type === "all";
  const lines = batch.proxy_text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line, index, all) =>
        line && !line.startsWith("#") && all.indexOf(line) === index,
    );

  useEffect(() => {
    if (isAll || batch.scope_value) return;
    const scopeValue = proxyNodeDefaultScopeValue(
      batch.scope_type,
      props.channels,
      props.groups,
    );
    if (scopeValue) props.onChange({ ...batch, scope_value: scopeValue });
  }, [batch, isAll, props.channels, props.groups, props.onChange]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Batch Import")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("Name Prefix")}</Label>
            <Input
              value={batch.name_prefix}
              placeholder={t("Default: Proxy Node")}
              onChange={(event) =>
                props.onChange({ ...batch, name_prefix: event.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={batch.enabled}
              onCheckedChange={(enabled) =>
                props.onChange({ ...batch, enabled })
              }
            />
            <Label>{t("Enabled")}</Label>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Scope Type")}</Label>
            <Select
              value={batch.scope_type}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "channel" ||
                  value === "group"
                ) {
                  props.onChange({
                    ...batch,
                    scope_type: value,
                    scope_value: proxyNodeDefaultScopeValue(
                      value,
                      props.channels,
                      props.groups,
                    ),
                  });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">{t("All Channels")}</SelectItem>
                  <SelectItem value="channel">
                    {t("Specific Channel")}
                  </SelectItem>
                  <SelectItem value="group">{t("By Group")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {!isAll && (
            <div className="space-y-1.5">
              <Label>
                {batch.scope_type === "channel"
                  ? t("Channel ID")
                  : t("Group Name")}
              </Label>
              {batch.scope_type === "channel" && props.channels.length > 0 ? (
                <Select
                  value={batch.scope_value ?? ""}
                  onValueChange={(scope_value) =>
                    props.onChange({
                      ...batch,
                      scope_value: scope_value || undefined,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.channels.map((channel) => (
                      <SelectItem key={channel.id} value={String(channel.id)}>
                        {channel.name} (#{channel.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : batch.scope_type === "group" && props.groups.length > 0 ? (
                <Select
                  value={batch.scope_value ?? ""}
                  onValueChange={(scope_value) =>
                    props.onChange({
                      ...batch,
                      scope_value: scope_value || undefined,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.groups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={batch.scope_value ?? ""}
                  onChange={(event) =>
                    props.onChange({
                      ...batch,
                      scope_value: event.target.value,
                    })
                  }
                />
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t("Proxy Links")}</Label>
            <Textarea
              rows={8}
              value={batch.proxy_text}
              onChange={(event) =>
                props.onChange({ ...batch, proxy_text: event.target.value })
              }
              placeholder={"vless://…\nvmess://…"}
            />
            <p className="text-muted-foreground text-xs">
              {t("{{count}} unique entries will be created", {
                count: lines.length,
              })}
            </p>
          </div>
          {lines.length > 500 && (
            <p className="text-destructive text-sm">
              {t("Maximum 500 entries")}
            </p>
          )}
          {props.result && (
            <div className="space-y-1 text-sm">
              <p>
                {t(
                  "Created {{created}}, failed {{failed}}, skipped {{skipped}}",
                  {
                    created: props.result.created,
                    failed: props.result.failed,
                    skipped: props.result.skipped,
                  },
                )}
              </p>
              {props.result.errors.length > 0 && (
                <ul className="text-destructive list-disc pl-5">
                  {props.result.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={props.onSave}
            disabled={props.saving || lines.length === 0 || lines.length > 500}
          >
            {props.saving ? t("Saving...") : t("Import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
