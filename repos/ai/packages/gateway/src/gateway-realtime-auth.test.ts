import { describe, expect, it } from 'vitest';
import {
  GATEWAY_AUTH_SUBPROTOCOL_PREFIX,
  GATEWAY_REALTIME_SUBPROTOCOL,
  GATEWAY_TEAM_SUBPROTOCOL_PREFIX,
  getGatewayRealtimeAuthToken,
  getGatewayRealtimeProtocols,
  getGatewayRealtimeTeamIdOrSlug,
} from './gateway-realtime-auth';

describe('getGatewayRealtimeProtocols', () => {
  it('offers the marker subprotocol and the prefixed auth token', () => {
    expect(getGatewayRealtimeProtocols('vck_test-token')).toEqual([
      GATEWAY_REALTIME_SUBPROTOCOL,
      `${GATEWAY_AUTH_SUBPROTOCOL_PREFIX}vck_test-token`,
    ]);
  });

  it('offers encoded team scoping when provided', () => {
    const protocols = getGatewayRealtimeProtocols('vck_test-token', {
      teamIdOrSlug: 'team/with/slashes',
    });

    expect(protocols).toHaveLength(3);
    const teamProtocol = protocols[2];
    expect(teamProtocol).toBeDefined();
    if (teamProtocol == null) return;
    expect(teamProtocol.startsWith(GATEWAY_TEAM_SUBPROTOCOL_PREFIX)).toBe(true);
    expect(teamProtocol.slice(GATEWAY_TEAM_SUBPROTOCOL_PREFIX.length)).toMatch(
      /^[A-Za-z0-9_-]+$/u,
    );
    expect(getGatewayRealtimeTeamIdOrSlug(protocols.join(', '))).toBe(
      'team/with/slashes',
    );
  });
});

describe('getGatewayRealtimeAuthToken', () => {
  it('round-trips a token produced by getGatewayRealtimeProtocols', () => {
    // The server receives the offered subprotocols as a comma-joined header.
    const header = getGatewayRealtimeProtocols('vck_test-token').join(', ');
    expect(getGatewayRealtimeAuthToken(header)).toBe('vck_test-token');
  });

  it('tolerates arbitrary whitespace and subprotocol ordering', () => {
    const header = `  ${GATEWAY_AUTH_SUBPROTOCOL_PREFIX}oidc-token  ,  ${GATEWAY_REALTIME_SUBPROTOCOL}  `;
    expect(getGatewayRealtimeAuthToken(header)).toBe('oidc-token');
  });

  it('returns undefined when no auth subprotocol is present', () => {
    expect(
      getGatewayRealtimeAuthToken(GATEWAY_REALTIME_SUBPROTOCOL),
    ).toBeUndefined();
  });

  it('returns undefined for an empty/whitespace token', () => {
    expect(
      getGatewayRealtimeAuthToken(`${GATEWAY_AUTH_SUBPROTOCOL_PREFIX}   `),
    ).toBeUndefined();
  });

  it('returns undefined for missing header values', () => {
    expect(getGatewayRealtimeAuthToken(undefined)).toBeUndefined();
    expect(getGatewayRealtimeAuthToken(null)).toBeUndefined();
    expect(getGatewayRealtimeAuthToken('')).toBeUndefined();
  });

  it('preserves tokens that contain dots (e.g. JWT/OIDC)', () => {
    const jwt = 'header.payload.signature';
    const header = getGatewayRealtimeProtocols(jwt).join(',');
    expect(getGatewayRealtimeAuthToken(header)).toBe(jwt);
  });
});

describe('getGatewayRealtimeTeamIdOrSlug', () => {
  it('round-trips a team id produced by getGatewayRealtimeProtocols', () => {
    const header = getGatewayRealtimeProtocols('vck_test-token', {
      teamIdOrSlug: 'team_123',
    }).join(', ');
    expect(getGatewayRealtimeTeamIdOrSlug(header)).toBe('team_123');
  });

  it('tolerates arbitrary whitespace and subprotocol ordering', () => {
    const teamProtocol = getGatewayRealtimeProtocols('token', {
      teamIdOrSlug: 'my-team',
    })[2];
    expect(teamProtocol).toBeDefined();
    if (teamProtocol == null) return;
    const header = `  ${teamProtocol}  ,  ${GATEWAY_REALTIME_SUBPROTOCOL}  `;
    expect(getGatewayRealtimeTeamIdOrSlug(header)).toBe('my-team');
  });

  it('returns undefined when no team subprotocol is present', () => {
    expect(
      getGatewayRealtimeTeamIdOrSlug(GATEWAY_REALTIME_SUBPROTOCOL),
    ).toBeUndefined();
  });

  it('returns undefined for malformed encoded team values', () => {
    expect(
      getGatewayRealtimeTeamIdOrSlug(`${GATEWAY_TEAM_SUBPROTOCOL_PREFIX}%%%`),
    ).toBeUndefined();
  });
});
