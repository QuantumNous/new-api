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

export const userConstants = {
  REGISTER_REQUEST: 'USERS_REGISTER_REQUEST',
  REGISTER_SUCCESS: 'USERS_REGISTER_SUCCESS',
  REGISTER_FAILURE: 'USERS_REGISTER_FAILURE',

  LOGIN_REQUEST: 'USERS_LOGIN_REQUEST',
  LOGIN_SUCCESS: 'USERS_LOGIN_SUCCESS',
  LOGIN_FAILURE: 'USERS_LOGIN_FAILURE',

  LOGOUT: 'USERS_LOGOUT',

  GETALL_REQUEST: 'USERS_GETALL_REQUEST',
  GETALL_SUCCESS: 'USERS_GETALL_SUCCESS',
  GETALL_FAILURE: 'USERS_GETALL_FAILURE',

  DELETE_REQUEST: 'USERS_DELETE_REQUEST',
  DELETE_SUCCESS: 'USERS_DELETE_SUCCESS',
  DELETE_FAILURE: 'USERS_DELETE_FAILURE',
};

/**
 * 用户角色常量 - 与后端保持一致
 * 对应后端 common/constants.go 中的角色定义
 */
export const USER_ROLES = {
  GUEST: 0,      // RoleGuestUser
  COMMON: 1,     // RoleCommonUser
  ADMIN: 10,     // RoleAdminUser
  ROOT: 100,     // RoleRootUser
};

/**
 * 检查用户是否为管理员（包括超级管理员）
 * @param {number} role - 用户角色
 * @returns {boolean}
 */
export const isAdmin = (role) => {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.ROOT;
};

/**
 * 检查用户是否为超级管理员
 * @param {number} role - 用户角色
 * @returns {boolean}
 */
export const isRoot = (role) => {
  return role === USER_ROLES.ROOT;
};

/**
 * 检查用户是否为普通用户
 * @param {number} role - 用户角色
 * @returns {boolean}
 */
export const isCommonUser = (role) => {
  return role === USER_ROLES.COMMON;
};

/**
 * 获取角色显示名称
 * @param {number} role - 用户角色
 * @param {function} t - 翻译函数
 * @returns {string}
 */
export const getRoleDisplayName = (role, t) => {
  switch (role) {
    case USER_ROLES.COMMON:
      return t('普通用户');
    case USER_ROLES.ADMIN:
      return t('管理员');
    case USER_ROLES.ROOT:
      return t('超级管理员');
    case USER_ROLES.GUEST:
      return t('访客');
    default:
      return t('未知身份');
  }
};
