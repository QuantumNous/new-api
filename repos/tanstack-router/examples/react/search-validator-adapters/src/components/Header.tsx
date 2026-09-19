import { Link } from '@tanstack/react-router'
import * as React from 'react'

const HeaderLink: typeof Link = (props) => {
  return <Link className="text-lg text-blue-700" {...props} />
}

export interface HeaderProps {
  readonly title: string
}

export const Header: React.FunctionComponent<HeaderProps> = ({ title }) => {
  return (
    <header className="flex items-end gap-8 border-b-2 border-slate-150 py-4">
      <h1 className="text-4xl">{title}</h1>
      <nav className="flex gap-4">
        <HeaderLink to="/users/zod">Zod</HeaderLink>
        <HeaderLink to="/users/valibot">Valibot</HeaderLink>
        <HeaderLink to="/users/arktype">Arktype</HeaderLink>
      </nav>
    </header>
  )
}
