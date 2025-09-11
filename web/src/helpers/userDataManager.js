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

import { API } from './api';
import {
  getCachedAvatar,
  cacheAvatar,
  clearAvatarCache
} from './avatarCache';

/**
 * 用户数据管理器
 */

/**
 * 获取用户数据（包含头像）
 * @returns {Promise<Object>} 用户数据
 */
export const getUserData = async () => {
  try {
    // 获取基础用户数据
    const res = await API.get('/api/user/self');
    const { success, message, data } = res.data;

    if (!success) {
      throw new Error(message);
    }

    // 如果有用户ID，尝试获取头像
    if (data.id) {
      const cachedAvatar = getCachedAvatar(data.id);
      if (cachedAvatar) {
        data.avatar = cachedAvatar;
      } else {
        // 如果没有缓存，尝试从头像端点获取
        try {
          const avatarRes = await API.get('/api/user/avatar');
          if (avatarRes.data.success && avatarRes.data.data.avatar) {
            data.avatar = avatarRes.data.data.avatar;
            cacheAvatar(data.id, data.avatar);
          }
        } catch (avatarError) {
          console.log('获取头像失败，使用默认头像');
          data.avatar = '';
        }
      }
    }

    return { success: true, data };
  } catch (error) {
    console.error('获取用户数据失败:', error);
    return { success: false, message: error.message };
  }
};

/**
 * 更新用户头像
 * @param {string} avatarData - 头像数据（base64）
 * @param {Object} userInfo - 用户基本信息（仅用于缓存）
 * @returns {Promise<Object>} 更新结果
 */
export const updateUserAvatar = async (avatarData, userInfo = {}) => {
  try {
    const payload = {
      avatar: avatarData,
    };

    const res = await API.put('/api/user/self', payload);
    const { success, message } = res.data;

    if (success && userInfo.id) {
      // 更新成功后，立即更新缓存
      cacheAvatar(userInfo.id, avatarData);
      console.log(`头像上传成功并已更新缓存 - 用户ID: ${userInfo.id}`);
    }

    return { success, message };
  } catch (error) {
    console.error('更新用户头像失败:', error);
    return { success: false, message: error.message };
  }
};

/**
 * 用户登出时的清理工作
 * @param {number} userId - 用户ID
 */
export const cleanupOnLogout = (userId) => {
  try {
    // 清除头像缓存
    if (userId) {
      clearAvatarCache(userId);
      console.log(`用户登出，已清除头像缓存 - 用户ID: ${userId}`);
    }
  } catch (error) {
    console.error('登出清理失败:', error);
  }
};
