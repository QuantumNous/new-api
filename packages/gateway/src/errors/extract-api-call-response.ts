import type { APICallError } from '@ai-sdk/provider';
import { secureJsonParse } from '@ai-sdk/provider-utils';

export function extractApiCallResponse(error: APICallError): unknown {
  if (error.data !== undefined) {
    return error.data;
  }
  if (error.responseBody != null) {
    try {
      return secureJsonParse(error.responseBody);
    } catch {
      return error.responseBody;
    }
  }
  return {};
}
