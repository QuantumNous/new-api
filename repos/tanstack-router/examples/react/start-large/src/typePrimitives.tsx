import * as React from 'react'
import { Link, redirect, useNavigate } from '@tanstack/react-router'
import type {
  RegisteredRouter,
  ValidateFromPath,
  ValidateLinkOptions,
  ValidateLinkOptionsArray,
  ValidateNavigateOptions,
  ValidateRedirectOptions,
} from '@tanstack/react-router'

export function customRedirect<TRouter extends RegisteredRouter, TOptions>(
  options: ValidateRedirectOptions<TRouter, TOptions>,
): void
export function customRedirect(options: ValidateRedirectOptions): void {
  throw redirect(options)
}

export function useCustomNavigate<TRouter extends RegisteredRouter, TOptions>(
  options: ValidateNavigateOptions<TRouter, TOptions>,
): void
export function useCustomNavigate(options: ValidateNavigateOptions): void {
  const navigate = useNavigate()

  const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

  useIsomorphicLayoutEffect(() => {
    navigate(options)
  }, [navigate, options])
}

export function MyLink<TRouter extends RegisteredRouter, TOptions>(
  options: ValidateLinkOptions<TRouter, TOptions>,
): React.ReactNode
export function MyLink(options: ValidateLinkOptions) {
  return <Link {...options} />
}

export interface ListItemsProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
  TFrom extends string = string,
> {
  from: ValidateFromPath<TRouter, TFrom>
  items: ValidateLinkOptionsArray<TRouter, TOptions, TFrom>
}

export function ListItems<
  TRouter extends RegisteredRouter,
  TOptions extends ReadonlyArray<unknown>,
  TFrom extends string,
>(options: ListItemsProps<TRouter, TOptions, TFrom>): React.ReactNode
export function ListItems(options: ListItemsProps) {
  return options.items.map((item) => <Link {...item} from={options.from} />)
}
