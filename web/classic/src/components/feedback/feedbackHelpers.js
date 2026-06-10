// 工单（建议及咨询）前端共用：分类/状态映射、图片压缩、API 基址。
// 设计文档：docs/feedback-consult-design.md

export const FEEDBACK_MAX_IMAGES = 3;

// 用户侧 / 管理员侧 API 基址
export const USER_FEEDBACK_BASE = '/api/user/feedback';
export const ADMIN_FEEDBACK_BASE = '/api/user/feedback/admin';

// 发言者角色（与后端 user.role 对齐）
export const FEEDBACK_ROLE_USER = 1;
export const FEEDBACK_ROLE_ADMIN = 10;

// 状态映射：t() 在使用处翻译，这里只给 key 与配色
export const FEEDBACK_STATUS = {
  1: { label: '待处理', color: 'orange' },
  2: { label: '处理中', color: 'blue' },
  3: { label: '已回复', color: 'green' },
  4: { label: '已关闭', color: 'grey' },
};

export const FEEDBACK_CATEGORY = {
  1: { label: '建议' },
  2: { label: '咨询' },
  3: { label: 'Bug 反馈' },
  4: { label: '充值与账单' },
  5: { label: '其他' },
};

// 新建工单的分类下拉选项
export const FEEDBACK_CATEGORY_OPTIONS = Object.entries(FEEDBACK_CATEGORY).map(
  ([value, { label }]) => ({ value: Number(value), label }),
);

// 把「选择」或「拖拽」进来的文件统一处理成 base64[]：自动过滤非图片、按剩余
// 配额(FEEDBACK_MAX_IMAGES - currentCount)裁剪、逐张压缩。点击上传与拖拽上传共用。
// 返回 { encoded, error }；error 为待 t() 翻译的文案 key（无错误则 undefined）。
export async function encodeFeedbackImageFiles(fileList, currentCount) {
  const files = Array.from(fileList || []).filter((f) =>
    f.type ? f.type.startsWith('image/') : true,
  );
  if (files.length === 0) return { encoded: [] };
  const room = FEEDBACK_MAX_IMAGES - currentCount;
  if (room <= 0) return { encoded: [], error: '最多上传 3 张图片' };
  try {
    const encoded = await Promise.all(
      files.slice(0, room).map((f) => compressImageToBase64(f)),
    );
    return { encoded };
  } catch {
    return { encoded: [], error: '图片处理失败' };
  }
}

// 将图片 File 压缩为纯 base64（无 data: 前缀）。与 KYC/企业认证同一套：
// 缩放到最长边 2400px、JPEG 0.88，超 1.5MB 再降一档质量重试一次。
export async function compressImageToBase64(
  file,
  maxLongEdgePx = 2400,
  maxSizeKB = 1500,
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > maxLongEdgePx) {
        if (width >= height) {
          height = Math.round((height * maxLongEdgePx) / width);
          width = maxLongEdgePx;
        } else {
          width = Math.round((width * maxLongEdgePx) / height);
          height = maxLongEdgePx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const tryEncode = (quality, isRetry) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('canvas.toBlob failed'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = reader.result.split(',')[1];
              if (!isRetry && b64.length > maxSizeKB * 1024 * (4 / 3)) {
                tryEncode(0.82, true);
              } else {
                resolve(b64);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality,
        );
      };
      tryEncode(0.88, false);
    };
    img.onerror = reject;
    img.src = url;
  });
}
