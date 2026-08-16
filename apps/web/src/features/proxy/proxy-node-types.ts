import { z } from "zod";

export type ProxyNode = {
  id: number;
  name: string;
  enabled: boolean;
  proxy_configured: boolean;
  protocol: string;
  scope_type: "all" | "channel" | "group";
  scope_value?: string;
  scope_name?: string;
  health: number;
  failure_count: number;
  last_error?: string;
  last_probe_at?: string;
  probe_total: number;
  probe_success: number;
};

export type ProxyNodeReport = {
  total: number;
  enabled: number;
  healthy: number;
  probe_total: number;
  probe_success: number;
  probe_failed: number;
  probe_active: number;
  success_rate: number;
  failure_rate: number;
};

export type ProxyNodeRequest = {
  name: string;
  enabled: boolean;
  proxy?: string;
  scope_type: ProxyNode["scope_type"];
  scope_value?: string;
};

export type ProxyNodeBatchRequest = {
  name_prefix: string;
  enabled: boolean;
  proxy_text: string;
  scope_type: ProxyNode["scope_type"];
  scope_value?: string;
};

export type ProxyNodeBatchResult = {
  created: number;
  failed: number;
  skipped: number;
  errors: string[];
  items: ProxyNode[];
};

const proxyNodeSchema = z.object({
  id: z.number(),
  name: z.string(),
  enabled: z.boolean().catch(false),
  proxy_configured: z.boolean().catch(false),
  protocol: z.string().catch(""),
  scope_type: z.enum(["all", "channel", "group"]),
  scope_value: z.string().optional(),
  health: z.number().finite().catch(0),
  failure_count: z.number().catch(0),
  cooldown_until: z.string().optional(),
  last_error: z.string().optional(),
  last_probe_at: z.string().optional(),
  probe_total: z.number().catch(0),
  probe_success: z.number().catch(0),
});

export function decodeProxyNode(value: unknown): ProxyNode | null {
  const result = proxyNodeSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function decodeProxyNodes(value: unknown): ProxyNode[] {
  return z
    .array(z.unknown())
    .catch([])
    .parse(value)
    .flatMap((item) => {
      const node = decodeProxyNode(item);
      return node ? [node] : [];
    });
}
