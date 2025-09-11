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
 * 头像缓存管理工具
 * 核心功能：缓存存储、读取、清理
 */

const AVATAR_CACHE_KEY = 'user_avatar';

/**
 * 获取缓存的头像数据
 * @param {number} userId - 用户ID
 * @returns {string|null} 头像数据或null
 */
export const getCachedAvatar = (userId) => {
  try {
    const avatarData = localStorage.getItem(`${AVATAR_CACHE_KEY}_${userId}`);
    return avatarData || null;
  } catch (error) {
    console.error('获取头像缓存失败:', error);
    return null;
  }
};

/**
 * 缓存头像数据
 * @param {number} userId - 用户ID
 * @param {string} avatarData - 头像数据（base64）
 */
export const cacheAvatar = (userId, avatarData) => {
  try {
    if (!avatarData) {
      clearAvatarCache(userId);
      return;
    }

    localStorage.setItem(`${AVATAR_CACHE_KEY}_${userId}`, avatarData);
  } catch (error) {
    console.error('缓存头像失败:', error);
  }
};

/**
 * 清除指定用户的头像缓存
 * @param {number} userId - 用户ID
 */
export const clearAvatarCache = (userId) => {
  try {
    localStorage.removeItem(`${AVATAR_CACHE_KEY}_${userId}`);
  } catch (error) {
    console.error('清除头像缓存失败:', error);
  }
};


