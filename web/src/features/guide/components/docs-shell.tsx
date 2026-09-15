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
type DocsShellProps = {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function DocsShell(props: DocsShellProps) {
  return (
    <div
      data-testid='guide-shell'
      className='bg-background h-full min-h-0 overflow-y-auto overscroll-contain'
    >
      <div
        data-testid='guide-layout'
        className='mx-auto grid min-h-full w-full max-w-[96rem] min-w-0 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]'
      >
        <aside className='border-border bg-background sticky top-0 hidden h-[calc(100svh-var(--app-header-height,0px))] min-h-0 border-r lg:block'>
          <div className='h-full overflow-y-auto overscroll-contain'>
            {props.sidebar}
          </div>
        </aside>
        {props.children}
      </div>
    </div>
  )
}
