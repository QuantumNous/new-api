import {
  createJsonErrorResponseHandler,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export interface ProdiaModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export const prodiaJobResultSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  expires_at: z.string().optional(),
  state: z
    .object({
      current: z.string(),
    })
    .optional(),
  config: z
    .looseObject({
      seed: z.number().optional(),
    })
    .optional(),
  metrics: z
    .object({
      elapsed: z.number().optional(),
      ips: z.number().optional(),
    })
    .optional(),
  price: z
    .object({
      product: z.string(),
      dollars: z.number(),
    })
    .nullish(),
});

export type ProdiaJobResult = z.infer<typeof prodiaJobResultSchema>;

export function buildProdiaProviderMetadata(jobResult: ProdiaJobResult) {
  return {
    jobId: jobResult.id,
    ...(jobResult.config?.seed != null && {
      seed: jobResult.config.seed,
    }),
    ...(jobResult.metrics?.elapsed != null && {
      elapsed: jobResult.metrics.elapsed,
    }),
    ...(jobResult.metrics?.ips != null && {
      iterationsPerSecond: jobResult.metrics.ips,
    }),
    ...(jobResult.created_at != null && {
      createdAt: jobResult.created_at,
    }),
    ...(jobResult.updated_at != null && {
      updatedAt: jobResult.updated_at,
    }),
    ...(jobResult.price?.dollars != null && {
      dollars: jobResult.price.dollars,
    }),
  };
}

export interface MultipartPart {
  headers: Record<string, string>;
  body: Uint8Array;
}

export function parseMultipart(
  data: Uint8Array,
  boundary: string,
): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBytes = new TextEncoder().encode(`--${boundary}`);
  const endBoundaryBytes = new TextEncoder().encode(`--${boundary}--`);

  const positions: number[] = [];
  for (let i = 0; i <= data.length - boundaryBytes.length; i++) {
    let match = true;
    for (let j = 0; j < boundaryBytes.length; j++) {
      if (data[i + j] !== boundaryBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      positions.push(i);
    }
  }

  for (let i = 0; i < positions.length - 1; i++) {
    const start = positions[i] + boundaryBytes.length;
    const end = positions[i + 1];

    let isEndBoundary = true;
    for (let j = 0; j < endBoundaryBytes.length && isEndBoundary; j++) {
      if (data[positions[i] + j] !== endBoundaryBytes[j]) {
        isEndBoundary = false;
      }
    }
    if (
      isEndBoundary &&
      positions[i] + endBoundaryBytes.length <= data.length
    ) {
      continue;
    }

    let partStart = start;
    if (data[partStart] === 0x0d && data[partStart + 1] === 0x0a) {
      partStart += 2;
    } else if (data[partStart] === 0x0a) {
      partStart += 1;
    }

    let partEnd = end;
    if (data[partEnd - 2] === 0x0d && data[partEnd - 1] === 0x0a) {
      partEnd -= 2;
    } else if (data[partEnd - 1] === 0x0a) {
      partEnd -= 1;
    }

    const partData = data.slice(partStart, partEnd);

    let headerEnd = -1;
    for (let j = 0; j < partData.length - 3; j++) {
      if (
        partData[j] === 0x0d &&
        partData[j + 1] === 0x0a &&
        partData[j + 2] === 0x0d &&
        partData[j + 3] === 0x0a
      ) {
        headerEnd = j;
        break;
      }
      if (partData[j] === 0x0a && partData[j + 1] === 0x0a) {
        headerEnd = j;
        break;
      }
    }

    if (headerEnd === -1) {
      continue;
    }

    const headerBytes = partData.slice(0, headerEnd);
    const headerStr = new TextDecoder().decode(headerBytes);
    const headers: Record<string, string> = {};
    for (const line of headerStr.split(/\r?\n/)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        headers[key] = value;
      }
    }

    let bodyStart = headerEnd + 2;
    if (partData[headerEnd] === 0x0d) {
      bodyStart = headerEnd + 4;
    }
    const body = partData.slice(bodyStart);

    parts.push({ headers, body });
  }

  return parts;
}

const prodiaErrorSchema = z.object({
  message: z.string().optional(),
  detail: z.unknown().optional(),
  error: z.string().optional(),
});

export const prodiaFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: prodiaErrorSchema,
  errorToMessage: error => {
    const parsed = prodiaErrorSchema.safeParse(error);
    if (!parsed.success) return 'Unknown Prodia error';
    const { message, detail, error: errorField } = parsed.data;
    if (typeof detail === 'string') return detail;
    if (detail != null) {
      try {
        return JSON.stringify(detail);
      } catch {
        // ignore
      }
    }
    return errorField ?? message ?? 'Unknown Prodia error';
  },
});
