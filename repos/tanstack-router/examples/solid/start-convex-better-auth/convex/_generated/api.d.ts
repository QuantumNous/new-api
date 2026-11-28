/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from '../auth.js'
import type * as http from '../http.js'
import type * as myFunctions from '../myFunctions.js'

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from 'convex/server'

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth
  http: typeof http
  myFunctions: typeof myFunctions
}>
declare const fullApiWithMounts: typeof fullApi

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, 'public'>
>
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, 'internal'>
>

export declare const components: {
  betterAuth: {
    adapter: {
      create: FunctionReference<
        'mutation',
        'internal',
        {
          input:
            | {
                data: {
                  createdAt: number
                  displayUsername?: null | string
                  email: string
                  emailVerified: boolean
                  image?: null | string
                  isAnonymous?: null | boolean
                  name: string
                  phoneNumber?: null | string
                  phoneNumberVerified?: null | boolean
                  twoFactorEnabled?: null | boolean
                  updatedAt: number
                  userId?: null | string
                  username?: null | string
                }
                model: 'user'
              }
            | {
                data: {
                  createdAt: number
                  expiresAt: number
                  ipAddress?: null | string
                  token: string
                  updatedAt: number
                  userAgent?: null | string
                  userId: string
                }
                model: 'session'
              }
            | {
                data: {
                  accessToken?: null | string
                  accessTokenExpiresAt?: null | number
                  accountId: string
                  createdAt: number
                  idToken?: null | string
                  password?: null | string
                  providerId: string
                  refreshToken?: null | string
                  refreshTokenExpiresAt?: null | number
                  scope?: null | string
                  updatedAt: number
                  userId: string
                }
                model: 'account'
              }
            | {
                data: {
                  createdAt: number
                  expiresAt: number
                  identifier: string
                  updatedAt: number
                  value: string
                }
                model: 'verification'
              }
            | {
                data: { backupCodes: string; secret: string; userId: string }
                model: 'twoFactor'
              }
            | {
                data: {
                  aaguid?: null | string
                  backedUp: boolean
                  counter: number
                  createdAt?: null | number
                  credentialID: string
                  deviceType: string
                  name?: null | string
                  publicKey: string
                  transports?: null | string
                  userId: string
                }
                model: 'passkey'
              }
            | {
                data: {
                  clientId?: null | string
                  clientSecret?: null | string
                  createdAt?: null | number
                  disabled?: null | boolean
                  icon?: null | string
                  metadata?: null | string
                  name?: null | string
                  redirectURLs?: null | string
                  type?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                model: 'oauthApplication'
              }
            | {
                data: {
                  accessToken?: null | string
                  accessTokenExpiresAt?: null | number
                  clientId?: null | string
                  createdAt?: null | number
                  refreshToken?: null | string
                  refreshTokenExpiresAt?: null | number
                  scopes?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                model: 'oauthAccessToken'
              }
            | {
                data: {
                  clientId?: null | string
                  consentGiven?: null | boolean
                  createdAt?: null | number
                  scopes?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                model: 'oauthConsent'
              }
            | {
                data: {
                  createdAt: number
                  privateKey: string
                  publicKey: string
                }
                model: 'jwks'
              }
            | {
                data: {
                  count?: null | number
                  key?: null | string
                  lastRequest?: null | number
                }
                model: 'rateLimit'
              }
            | {
                data: { count: number; key: string; lastRequest: number }
                model: 'ratelimit'
              }
          onCreateHandle?: string
          select?: Array<string>
        },
        any
      >
      deleteMany: FunctionReference<
        'mutation',
        'internal',
        {
          input:
            | {
                model: 'user'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'email'
                    | 'emailVerified'
                    | 'image'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'twoFactorEnabled'
                    | 'isAnonymous'
                    | 'username'
                    | 'displayUsername'
                    | 'phoneNumber'
                    | 'phoneNumberVerified'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'session'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'expiresAt'
                    | 'token'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'ipAddress'
                    | 'userAgent'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'account'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accountId'
                    | 'providerId'
                    | 'userId'
                    | 'accessToken'
                    | 'refreshToken'
                    | 'idToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'scope'
                    | 'password'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'verification'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'identifier'
                    | 'value'
                    | 'expiresAt'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'twoFactor'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'secret' | 'backupCodes' | 'userId' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'passkey'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'publicKey'
                    | 'userId'
                    | 'credentialID'
                    | 'counter'
                    | 'deviceType'
                    | 'backedUp'
                    | 'transports'
                    | 'createdAt'
                    | 'aaguid'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthApplication'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'icon'
                    | 'metadata'
                    | 'clientId'
                    | 'clientSecret'
                    | 'redirectURLs'
                    | 'type'
                    | 'disabled'
                    | 'userId'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthAccessToken'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accessToken'
                    | 'refreshToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthConsent'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'consentGiven'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'jwks'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'publicKey' | 'privateKey' | 'createdAt' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'rateLimit'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'ratelimit'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
          onDeleteHandle?: string
          paginationOpts: {
            cursor: string | null
            endCursor?: string | null
            id?: number
            maximumBytesRead?: number
            maximumRowsRead?: number
            numItems: number
          }
        },
        any
      >
      deleteOne: FunctionReference<
        'mutation',
        'internal',
        {
          input:
            | {
                model: 'user'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'email'
                    | 'emailVerified'
                    | 'image'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'twoFactorEnabled'
                    | 'isAnonymous'
                    | 'username'
                    | 'displayUsername'
                    | 'phoneNumber'
                    | 'phoneNumberVerified'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'session'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'expiresAt'
                    | 'token'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'ipAddress'
                    | 'userAgent'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'account'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accountId'
                    | 'providerId'
                    | 'userId'
                    | 'accessToken'
                    | 'refreshToken'
                    | 'idToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'scope'
                    | 'password'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'verification'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'identifier'
                    | 'value'
                    | 'expiresAt'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'twoFactor'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'secret' | 'backupCodes' | 'userId' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'passkey'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'publicKey'
                    | 'userId'
                    | 'credentialID'
                    | 'counter'
                    | 'deviceType'
                    | 'backedUp'
                    | 'transports'
                    | 'createdAt'
                    | 'aaguid'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthApplication'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'icon'
                    | 'metadata'
                    | 'clientId'
                    | 'clientSecret'
                    | 'redirectURLs'
                    | 'type'
                    | 'disabled'
                    | 'userId'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthAccessToken'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accessToken'
                    | 'refreshToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthConsent'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'consentGiven'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'jwks'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'publicKey' | 'privateKey' | 'createdAt' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'rateLimit'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'ratelimit'
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
          onDeleteHandle?: string
        },
        any
      >
      findMany: FunctionReference<
        'query',
        'internal',
        {
          limit?: number
          model:
            | 'user'
            | 'session'
            | 'account'
            | 'verification'
            | 'twoFactor'
            | 'passkey'
            | 'oauthApplication'
            | 'oauthAccessToken'
            | 'oauthConsent'
            | 'jwks'
            | 'rateLimit'
            | 'ratelimit'
          offset?: number
          paginationOpts: {
            cursor: string | null
            endCursor?: string | null
            id?: number
            maximumBytesRead?: number
            maximumRowsRead?: number
            numItems: number
          }
          sortBy?: { direction: 'asc' | 'desc'; field: string }
          where?: Array<{
            connector?: 'AND' | 'OR'
            field: string
            operator?:
              | 'lt'
              | 'lte'
              | 'gt'
              | 'gte'
              | 'eq'
              | 'in'
              | 'not_in'
              | 'ne'
              | 'contains'
              | 'starts_with'
              | 'ends_with'
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null
          }>
        },
        any
      >
      findOne: FunctionReference<
        'query',
        'internal',
        {
          model:
            | 'user'
            | 'session'
            | 'account'
            | 'verification'
            | 'twoFactor'
            | 'passkey'
            | 'oauthApplication'
            | 'oauthAccessToken'
            | 'oauthConsent'
            | 'jwks'
            | 'rateLimit'
            | 'ratelimit'
          select?: Array<string>
          where?: Array<{
            connector?: 'AND' | 'OR'
            field: string
            operator?:
              | 'lt'
              | 'lte'
              | 'gt'
              | 'gte'
              | 'eq'
              | 'in'
              | 'not_in'
              | 'ne'
              | 'contains'
              | 'starts_with'
              | 'ends_with'
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null
          }>
        },
        any
      >
      migrationRemoveUserId: FunctionReference<
        'mutation',
        'internal',
        { userId: string },
        any
      >
      updateMany: FunctionReference<
        'mutation',
        'internal',
        {
          input:
            | {
                model: 'user'
                update: {
                  createdAt?: number
                  displayUsername?: null | string
                  email?: string
                  emailVerified?: boolean
                  image?: null | string
                  isAnonymous?: null | boolean
                  name?: string
                  phoneNumber?: null | string
                  phoneNumberVerified?: null | boolean
                  twoFactorEnabled?: null | boolean
                  updatedAt?: number
                  userId?: null | string
                  username?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'email'
                    | 'emailVerified'
                    | 'image'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'twoFactorEnabled'
                    | 'isAnonymous'
                    | 'username'
                    | 'displayUsername'
                    | 'phoneNumber'
                    | 'phoneNumberVerified'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'session'
                update: {
                  createdAt?: number
                  expiresAt?: number
                  ipAddress?: null | string
                  token?: string
                  updatedAt?: number
                  userAgent?: null | string
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'expiresAt'
                    | 'token'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'ipAddress'
                    | 'userAgent'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'account'
                update: {
                  accessToken?: null | string
                  accessTokenExpiresAt?: null | number
                  accountId?: string
                  createdAt?: number
                  idToken?: null | string
                  password?: null | string
                  providerId?: string
                  refreshToken?: null | string
                  refreshTokenExpiresAt?: null | number
                  scope?: null | string
                  updatedAt?: number
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accountId'
                    | 'providerId'
                    | 'userId'
                    | 'accessToken'
                    | 'refreshToken'
                    | 'idToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'scope'
                    | 'password'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'verification'
                update: {
                  createdAt?: number
                  expiresAt?: number
                  identifier?: string
                  updatedAt?: number
                  value?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'identifier'
                    | 'value'
                    | 'expiresAt'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'twoFactor'
                update: {
                  backupCodes?: string
                  secret?: string
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'secret' | 'backupCodes' | 'userId' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'passkey'
                update: {
                  aaguid?: null | string
                  backedUp?: boolean
                  counter?: number
                  createdAt?: null | number
                  credentialID?: string
                  deviceType?: string
                  name?: null | string
                  publicKey?: string
                  transports?: null | string
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'publicKey'
                    | 'userId'
                    | 'credentialID'
                    | 'counter'
                    | 'deviceType'
                    | 'backedUp'
                    | 'transports'
                    | 'createdAt'
                    | 'aaguid'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthApplication'
                update: {
                  clientId?: null | string
                  clientSecret?: null | string
                  createdAt?: null | number
                  disabled?: null | boolean
                  icon?: null | string
                  metadata?: null | string
                  name?: null | string
                  redirectURLs?: null | string
                  type?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'icon'
                    | 'metadata'
                    | 'clientId'
                    | 'clientSecret'
                    | 'redirectURLs'
                    | 'type'
                    | 'disabled'
                    | 'userId'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthAccessToken'
                update: {
                  accessToken?: null | string
                  accessTokenExpiresAt?: null | number
                  clientId?: null | string
                  createdAt?: null | number
                  refreshToken?: null | string
                  refreshTokenExpiresAt?: null | number
                  scopes?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accessToken'
                    | 'refreshToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthConsent'
                update: {
                  clientId?: null | string
                  consentGiven?: null | boolean
                  createdAt?: null | number
                  scopes?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'consentGiven'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'jwks'
                update: {
                  createdAt?: number
                  privateKey?: string
                  publicKey?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'publicKey' | 'privateKey' | 'createdAt' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'rateLimit'
                update: {
                  count?: null | number
                  key?: null | string
                  lastRequest?: null | number
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'ratelimit'
                update: { count?: number; key?: string; lastRequest?: number }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
          onUpdateHandle?: string
          paginationOpts: {
            cursor: string | null
            endCursor?: string | null
            id?: number
            maximumBytesRead?: number
            maximumRowsRead?: number
            numItems: number
          }
        },
        any
      >
      updateOne: FunctionReference<
        'mutation',
        'internal',
        {
          input:
            | {
                model: 'user'
                update: {
                  createdAt?: number
                  displayUsername?: null | string
                  email?: string
                  emailVerified?: boolean
                  image?: null | string
                  isAnonymous?: null | boolean
                  name?: string
                  phoneNumber?: null | string
                  phoneNumberVerified?: null | boolean
                  twoFactorEnabled?: null | boolean
                  updatedAt?: number
                  userId?: null | string
                  username?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'email'
                    | 'emailVerified'
                    | 'image'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'twoFactorEnabled'
                    | 'isAnonymous'
                    | 'username'
                    | 'displayUsername'
                    | 'phoneNumber'
                    | 'phoneNumberVerified'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'session'
                update: {
                  createdAt?: number
                  expiresAt?: number
                  ipAddress?: null | string
                  token?: string
                  updatedAt?: number
                  userAgent?: null | string
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'expiresAt'
                    | 'token'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'ipAddress'
                    | 'userAgent'
                    | 'userId'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'account'
                update: {
                  accessToken?: null | string
                  accessTokenExpiresAt?: null | number
                  accountId?: string
                  createdAt?: number
                  idToken?: null | string
                  password?: null | string
                  providerId?: string
                  refreshToken?: null | string
                  refreshTokenExpiresAt?: null | number
                  scope?: null | string
                  updatedAt?: number
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accountId'
                    | 'providerId'
                    | 'userId'
                    | 'accessToken'
                    | 'refreshToken'
                    | 'idToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'scope'
                    | 'password'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'verification'
                update: {
                  createdAt?: number
                  expiresAt?: number
                  identifier?: string
                  updatedAt?: number
                  value?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'identifier'
                    | 'value'
                    | 'expiresAt'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'twoFactor'
                update: {
                  backupCodes?: string
                  secret?: string
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'secret' | 'backupCodes' | 'userId' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'passkey'
                update: {
                  aaguid?: null | string
                  backedUp?: boolean
                  counter?: number
                  createdAt?: null | number
                  credentialID?: string
                  deviceType?: string
                  name?: null | string
                  publicKey?: string
                  transports?: null | string
                  userId?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'publicKey'
                    | 'userId'
                    | 'credentialID'
                    | 'counter'
                    | 'deviceType'
                    | 'backedUp'
                    | 'transports'
                    | 'createdAt'
                    | 'aaguid'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthApplication'
                update: {
                  clientId?: null | string
                  clientSecret?: null | string
                  createdAt?: null | number
                  disabled?: null | boolean
                  icon?: null | string
                  metadata?: null | string
                  name?: null | string
                  redirectURLs?: null | string
                  type?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'name'
                    | 'icon'
                    | 'metadata'
                    | 'clientId'
                    | 'clientSecret'
                    | 'redirectURLs'
                    | 'type'
                    | 'disabled'
                    | 'userId'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthAccessToken'
                update: {
                  accessToken?: null | string
                  accessTokenExpiresAt?: null | number
                  clientId?: null | string
                  createdAt?: null | number
                  refreshToken?: null | string
                  refreshTokenExpiresAt?: null | number
                  scopes?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'accessToken'
                    | 'refreshToken'
                    | 'accessTokenExpiresAt'
                    | 'refreshTokenExpiresAt'
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'oauthConsent'
                update: {
                  clientId?: null | string
                  consentGiven?: null | boolean
                  createdAt?: null | number
                  scopes?: null | string
                  updatedAt?: null | number
                  userId?: null | string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field:
                    | 'clientId'
                    | 'userId'
                    | 'scopes'
                    | 'createdAt'
                    | 'updatedAt'
                    | 'consentGiven'
                    | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'jwks'
                update: {
                  createdAt?: number
                  privateKey?: string
                  publicKey?: string
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'publicKey' | 'privateKey' | 'createdAt' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'rateLimit'
                update: {
                  count?: null | number
                  key?: null | string
                  lastRequest?: null | number
                }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
            | {
                model: 'ratelimit'
                update: { count?: number; key?: string; lastRequest?: number }
                where?: Array<{
                  connector?: 'AND' | 'OR'
                  field: 'key' | 'count' | 'lastRequest' | '_id'
                  operator?:
                    | 'lt'
                    | 'lte'
                    | 'gt'
                    | 'gte'
                    | 'eq'
                    | 'in'
                    | 'not_in'
                    | 'ne'
                    | 'contains'
                    | 'starts_with'
                    | 'ends_with'
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null
                }>
              }
          onUpdateHandle?: string
        },
        any
      >
    }
    adapterTest: {
      count: FunctionReference<'query', 'internal', any, any>
      create: FunctionReference<'mutation', 'internal', any, any>
      delete: FunctionReference<'mutation', 'internal', any, any>
      deleteMany: FunctionReference<'mutation', 'internal', any, any>
      findMany: FunctionReference<'query', 'internal', any, any>
      findOne: FunctionReference<'query', 'internal', any, any>
      update: FunctionReference<'mutation', 'internal', any, any>
      updateMany: FunctionReference<'mutation', 'internal', any, any>
    }
  }
}
