import { Link, redirect, useNavigate } from '@tanstack/solid-router'
import { onMount } from 'solid-js'
import type {
  RegisteredRouter,
  ValidateFromPath,
  ValidateLinkOptions,
  ValidateLinkOptionsArray,
  ValidateNavigateOptions,
  ValidateRedirectOptions,
} from '@tanstack/solid-router'
import type { JSX } from 'solid-js'

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

  onMount(() => {
    navigate(options)
  })
}

export function MyLink<TRouter extends RegisteredRouter, TOptions>(
  options: ValidateLinkOptions<TRouter, TOptions>,
): JSX.Element
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
>(options: ListItemsProps<TRouter, TOptions, TFrom>): JSX.Element
export function ListItems(options: ListItemsProps) {
  return options.items.map((item) => <Link {...item} from={options.from} />)
}
