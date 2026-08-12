import { z } from 'zod/v4';
/**
 * Reusable URL validation that disallows javascript: scheme
 */
export const SafeUrlSchema = z
  .string()
  .url()
  .superRefine((val, ctx) => {
    if (!URL.canParse(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL must be parseable',
        fatal: true,
      });

      return z.NEVER;
    }
  })
  .refine(
    url => {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.protocol !== 'javascript:' &&
        parsedUrl.protocol !== 'data:' &&
        parsedUrl.protocol !== 'vbscript:'
      );
    },
    { message: 'URL cannot use javascript:, data:, or vbscript: scheme' },
  );

/**
 * OAuth 2.1 token response
 */
export const OAuthTokensSchema = z
  .object({
    access_token: z.string(),
    id_token: z.string().optional(), // Optional for OAuth 2.1, but necessary in OpenID Connect
    token_type: z.string(),
    expires_in: z.number().optional(),
    scope: z.string().optional(),
    refresh_token: z.string().optional(),
    authorization_server: SafeUrlSchema.optional(),
    token_endpoint: SafeUrlSchema.optional(),
  })
  .strip();

export const OAuthProtectedResourceMetadataSchema = z.looseObject({
  resource: z.string().url(),
  authorization_servers: z.array(SafeUrlSchema).optional(),
  jwks_uri: z.string().url().optional(),
  scopes_supported: z.array(z.string()).optional(),
  bearer_methods_supported: z.array(z.string()).optional(),
  resource_signing_alg_values_supported: z.array(z.string()).optional(),
  resource_name: z.string().optional(),
  resource_documentation: z.string().optional(),
  resource_policy_uri: z.string().url().optional(),
  resource_tos_uri: z.string().url().optional(),
  tls_client_certificate_bound_access_tokens: z.boolean().optional(),
  authorization_details_types_supported: z.array(z.string()).optional(),
  dpop_signing_alg_values_supported: z.array(z.string()).optional(),
  dpop_bound_access_tokens_required: z.boolean().optional(),
});

export const OAuthMetadataSchema = z.looseObject({
  issuer: z.string(),
  authorization_endpoint: SafeUrlSchema,
  token_endpoint: SafeUrlSchema,
  registration_endpoint: SafeUrlSchema.optional(),
  scopes_supported: z.array(z.string()).optional(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()).optional(),
  code_challenge_methods_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
  token_endpoint_auth_signing_alg_values_supported: z
    .array(z.string())
    .optional(),
});

/**
 * OpenID Connect Discovery 1.0 Provider Metadata
 * see: https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export const OpenIdProviderMetadataSchema = z.looseObject({
  issuer: z.string(),
  authorization_endpoint: SafeUrlSchema,
  token_endpoint: SafeUrlSchema,
  userinfo_endpoint: SafeUrlSchema.optional(),
  jwks_uri: SafeUrlSchema,
  registration_endpoint: SafeUrlSchema.optional(),
  scopes_supported: z.array(z.string()).optional(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()).optional(),
  subject_types_supported: z.array(z.string()),
  id_token_signing_alg_values_supported: z.array(z.string()),
  claims_supported: z.array(z.string()).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
});

/**
 * OpenID Connect Discovery metadata that may include OAuth 2.0 fields
 * This schema represents the real-world scenario where OIDC providers
 * return a mix of OpenID Connect and OAuth 2.0 metadata fields
 */
export const OpenIdProviderDiscoveryMetadataSchema =
  OpenIdProviderMetadataSchema.merge(
    OAuthMetadataSchema.pick({
      code_challenge_methods_supported: true,
    }),
  );

export const OAuthClientInformationSchema = z
  .object({
    client_id: z.string(),
    client_secret: z.string().optional(),
    client_id_issued_at: z.number().optional(),
    client_secret_expires_at: z.number().optional(),
    authorization_server: SafeUrlSchema.optional(),
    token_endpoint: SafeUrlSchema.optional(),
  })
  .strip();

export const OAuthClientMetadataSchema = z
  .object({
    redirect_uris: z.array(SafeUrlSchema),
    token_endpoint_auth_method: z.string().optional(),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    client_name: z.string().optional(),
    client_uri: SafeUrlSchema.optional(),
    logo_uri: SafeUrlSchema.optional(),
    scope: z.string().optional(),
    contacts: z.array(z.string()).optional(),
    tos_uri: SafeUrlSchema.optional(),
    policy_uri: z.string().optional(),
    jwks_uri: SafeUrlSchema.optional(),
    jwks: z.any().optional(),
    software_id: z.string().optional(),
    software_version: z.string().optional(),
    software_statement: z.string().optional(),
  })
  .strip();

export type OAuthMetadata = z.infer<typeof OAuthMetadataSchema>;
export type OpenIdProviderDiscoveryMetadata = z.infer<
  typeof OpenIdProviderDiscoveryMetadataSchema
>;
export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
export type OAuthProtectedResourceMetadata = z.infer<
  typeof OAuthProtectedResourceMetadataSchema
>;
export type OAuthClientInformation = z.infer<
  typeof OAuthClientInformationSchema
>;
export type AuthorizationServerMetadata =
  | OAuthMetadata
  | OpenIdProviderDiscoveryMetadata;

export const OAuthErrorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});
export const OAuthClientInformationFullSchema = OAuthClientMetadataSchema.merge(
  OAuthClientInformationSchema,
);
export type OAuthClientMetadata = z.infer<typeof OAuthClientMetadataSchema>;
export type OAuthClientInformationFull = z.infer<
  typeof OAuthClientInformationFullSchema
>;
