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

/**
 * 安全 API 调用包装器
 * 自动处理需要验证的 403 错误，透明地触发验证流程
 */

/**
 * 检查错误是否是需要安全验证的错误
 * @param {Error} error - 错误对象
 * @returns {boolean}
 */
export function isVerificationRequiredError(error) {
  if (!error.response) return false;

  const { status, data } = error.response;

  // 检查是否是 403 错误且包含验证相关的错误码
  if (status === 403 && data) {
    const verificationCodes = [
      'VERIFICATION_REQUIRED',
      'VERIFICATION_EXPIRED',
      'VERIFICATION_INVALID',
    ];

    return verificationCodes.includes(data.code);
  }

  return false;
}

/**
 * 从错误中提取验证需求信息
 * @param {Error} error - 错误对象
 * @returns {Object} 验证需求信息
 */
export function extractVerificationInfo(error) {
  const data = error.response?.data || {};

  return {
    code: data.code,
    message: data.message || '需要安全验证',
    required: true,
  };
}
