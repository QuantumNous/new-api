import { Link } from '@tanstack/solid-router'

const HeaderLink: typeof Link = (props) => {
  return <Link class="text-lg text-blue-700" {...props} />
}

export interface HeaderProps {
  readonly title: string
}

export const Header = ({ title }: HeaderProps) => {
  return (
    <header class="flex items-end gap-8 border-b-2 border-slate-150 py-4">
      <h1 class="text-4xl">{title}</h1>
      <nav class="flex gap-4">
        <HeaderLink to="/users/zod">Zod</HeaderLink>
        <HeaderLink to="/users/valibot">Valibot</HeaderLink>
        <HeaderLink to="/users/arktype">Arktype</HeaderLink>
      </nav>
    </header>
  )
}
