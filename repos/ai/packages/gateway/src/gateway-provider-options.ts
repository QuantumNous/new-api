// https://vercel.com/docs/ai-gateway/provider-options
export type GatewayProviderOptions = {
  /**
   * Service-owned options may be added by the Gateway without requiring an SDK
   * release. The Gateway service validates and applies the runtime schema.
   */
  [key: string]: unknown;

  /** Request-scoped BYOK credentials to use instead of cached credentials. */
  byok?: Record<string, Array<Record<string, unknown>>>;

  /** Enables automatic caching behavior when supported by the Gateway. */
  caching?: 'auto';

  /** Filter to providers that do not train on prompt data. */
  disallowPromptTraining?: boolean;

  /**
   * Restrict routing to models that have all of the given capabilities.
   * Currently supports `'implicit-caching'`.
   */
  has?: Array<'implicit-caching'>;

  /** Filter to providers that are HIPAA compliant with Vercel AI Gateway. */
  hipaaCompliant?: boolean;

  /** Array of model slugs specifying fallback models to use in order. */
  models?: string[];

  /** Array of provider slugs that are the only ones allowed to be used. */
  only?: string[];

  /** Array of provider slugs specifying the provider attempt order. */
  order?: string[];

  /** Per-provider timeouts for BYOK credentials in milliseconds. */
  providerTimeouts?: {
    byok?: Record<string, number>;
  };

  /** Entity identifier against which quota is tracked. */
  quotaEntityId?: string;

  /** Unified service tier intent. */
  serviceTier?: 'flex' | 'priority';

  /** Sort providers by a performance or cost metric before routing. */
  sort?: 'cost' | 'tps' | 'ttft';

  /** User-specified tags for reporting and filtering usage. */
  tags?: string[];

  /** End-user identifier for spend tracking and attribution. */
  user?: string;

  /** Filter to providers with zero data retention agreements. */
  zeroDataRetention?: boolean;
};
