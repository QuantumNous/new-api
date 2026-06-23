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

import { useMemo } from 'react';

/**
 * Hook to extract Aliyun ESA captcha configuration from status.
 *
 * @param {object} status - The status object from /api/status
 * @param {'login'|'reset_password'|'delete_account'|'checkin'|'verification'} scene - The captcha scene
 * @returns {{ enabled: boolean, region: string, prefix: string, sceneId: string }}
 */
export function useAliyunCaptcha(status, scene) {
  return useMemo(() => {
    const esaCaptchaEnabled = Boolean(status?.esa_captcha_enabled);
    const prefix = String(status?.esa_prefix ?? '');
    const scenes = status?.esa_captcha_scenes ?? {};
    const sceneId = String(scenes[scene] ?? '');

    return {
      enabled: esaCaptchaEnabled && Boolean(prefix) && Boolean(sceneId),
      region: String(status?.esa_region ?? 'cn'),
      prefix,
      sceneId,
    };
  }, [status, scene]);
}
