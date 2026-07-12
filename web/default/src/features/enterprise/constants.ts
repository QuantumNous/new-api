/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

export const ENTERPRISE_MEMBER_ROLE = {
  USER: 1,
  ADMIN: 10,
} as const;

export const ENTERPRISE_STATUS_LABELS: Record<number, string> = {
  1: "Enabled",
  2: "Disabled",
};

export const INVITATION_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  REVOKED: 3,
} as const;

export const INVITATION_STATUS_LABELS: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Revoked",
};

export const INVITATION_APPROVE_MODE = {
  AUTO: 1,
  MANUAL: 2,
} as const;

export const INVITATION_APPROVE_MODE_LABELS: Record<number, string> = {
  1: "Auto approval",
  2: "Manual approval",
};
