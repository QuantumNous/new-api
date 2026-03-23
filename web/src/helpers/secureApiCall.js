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
