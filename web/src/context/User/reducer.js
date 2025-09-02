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

export const reducer = (state, action) => {
  switch (action.type) {
    case 'login':
      // 用户登录时，头像数据通过独立端点获取和缓存
      return {
        ...state,
        user: action.payload,
      };
    case 'logout':
      // 当用户登出时，清理头像缓存和会话标记
      if (state.user?.id) {
        import('../../helpers/userDataManager').then(({ cleanupOnLogout }) => {
          cleanupOnLogout(state.user.id);
        });
      }
      return {
        ...state,
        user: undefined,
      };

    default:
      return state;
  }
};

export const initialState = {
  user: undefined,
};
