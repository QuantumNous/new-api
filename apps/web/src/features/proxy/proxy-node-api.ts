import { api } from "@/lib/api";

import { decodeProxyNode, decodeProxyNodes } from "./proxy-node-types";

import type {
  ProxyNode,
  ProxyNodeBatchRequest,
  ProxyNodeBatchResult,
  ProxyNodeReport,
  ProxyNodeRequest,
} from "./proxy-node-types";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

async function unwrap<T>(
  request: Promise<{ data: ApiResponse<T> }>,
): Promise<T> {
  const response = await request;
  if (!response.data.success) {
    throw new Error(response.data.message || "Request failed");
  }
  return response.data.data;
}

export async function fetchProxyNodes(): Promise<ProxyNode[]> {
  return decodeProxyNodes(
    await unwrap(api.get<ApiResponse<unknown>>("/api/proxy/nodes")),
  );
}

export async function fetchProxyNodeReport(): Promise<ProxyNodeReport> {
  return await unwrap(
    api.get<ApiResponse<ProxyNodeReport>>("/api/proxy/nodes/report"),
  );
}

export async function createProxyNode(
  payload: ProxyNodeRequest,
): Promise<ProxyNode> {
  const node = decodeProxyNode(
    await unwrap(api.post<ApiResponse<unknown>>("/api/proxy/nodes", payload)),
  );
  if (!node) throw new Error("Invalid proxy node response");
  return node;
}

export async function updateProxyNode(
  id: number,
  payload: ProxyNodeRequest,
): Promise<ProxyNode> {
  const node = decodeProxyNode(
    await unwrap(
      api.put<ApiResponse<unknown>>(`/api/proxy/nodes/${id}`, payload),
    ),
  );
  if (!node) throw new Error("Invalid proxy node response");
  return node;
}

export async function deleteProxyNode(id: number): Promise<void> {
  await unwrap(api.delete<ApiResponse<null>>(`/api/proxy/nodes/${id}`));
}

export async function fetchProxyNodeDetail(
  id: number,
): Promise<{ node: ProxyNode; proxy: string }> {
  return unwrap(
    api.get<ApiResponse<{ node: ProxyNode; proxy: string }>>(
      `/api/proxy/nodes/${id}`,
    ),
  );
}

export async function testProxyNode(id: number): Promise<void> {
  await unwrap(api.post<ApiResponse<unknown>>(`/api/proxy/nodes/${id}/test`));
}

export async function testAllProxyNodes(): Promise<{
  passed: number;
  failed: number;
  total: number;
}> {
  return await unwrap(
    api.post<ApiResponse<{ passed: number; failed: number; total: number }>>(
      "/api/proxy/nodes/test",
    ),
  );
}

export async function setProxyNodesEnabled(
  ids: number[],
  enabled: boolean,
): Promise<number> {
  const result = await unwrap(
    api.post<ApiResponse<{ updated: number }>>(
      "/api/proxy/nodes/batch-enabled",
      { ids, enabled },
    ),
  );
  return result.updated;
}

export async function clearProxyNodeErrors(ids: number[]): Promise<number> {
  const result = await unwrap(
    api.post<ApiResponse<{ cleared: number }>>(
      "/api/proxy/nodes/batch-clear-errors",
      { ids },
    ),
  );
  return result.cleared;
}

export async function createProxyNodesBatch(
  payload: ProxyNodeBatchRequest,
): Promise<ProxyNodeBatchResult> {
  return await unwrap(
    api.post<ApiResponse<ProxyNodeBatchResult>>(
      "/api/proxy/nodes/batch",
      payload,
    ),
  );
}
