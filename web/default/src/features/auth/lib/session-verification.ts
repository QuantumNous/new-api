/*
Copyright (C) 2023-2026 QuantumNous

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

// 进程内会话校验标记：每个页面生命周期只强制 getSelf 一次。
let sessionVerified = false

// 登出进行中：抑制并发请求 401 触发的 “Session expired” 与二次跳转。
let signingOut = false

export function isSessionVerified(): boolean {
  return sessionVerified
}

export function markSessionVerified(): void {
  sessionVerified = true
}

export function resetSessionVerified(): void {
  sessionVerified = false
}

export function beginSignOut(): void {
  signingOut = true
  sessionVerified = false
}

export function endSignOut(): void {
  signingOut = false
}

export function isSigningOut(): boolean {
  return signingOut
}
