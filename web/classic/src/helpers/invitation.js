/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export const INVITATION_REGISTRATION_METHODS = [
  'password',
  'github',
  'discord',
  'linuxdo',
  'oidc',
  'custom_oauth',
  'wechat',
];

const invitationRegistrationMethodSet = new Set(
  INVITATION_REGISTRATION_METHODS,
);

const LEGACY_INVITATION_CODE_STORAGE_KEYS = [
  'registration:invitation-code',
  'invitation_code',
];

export function clearLegacyInvitationCodeStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    LEGACY_INVITATION_CODE_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore browsers where storage access is unavailable.
  }
}

export function getInvitationCodeMethods(status) {
  const raw = status?.invitation_code_methods;
  if (!Array.isArray(raw)) return ['linuxdo'];

  const methods = Array.from(
    new Set(
      raw.filter((method) => invitationRegistrationMethodSet.has(method)),
    ),
  );
  return status?.invitation_code_required === true && methods.length === 0
    ? ['linuxdo']
    : methods;
}

export function isInvitationCodeRequired(status, method) {
  return (
    status?.invitation_code_required === true &&
    getInvitationCodeMethods(status).includes(method)
  );
}
