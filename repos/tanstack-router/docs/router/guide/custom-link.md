---
title: Custom Link
---

While repeating yourself can be acceptable in many situations, you might find that you do it too often. At times, you may want to create cross-cutting components with additional behavior or styles. You might also consider using third-party libraries in combination with TanStack Router's type safety.

## `createLink` for cross-cutting concerns

`createLink` creates a custom `Link` component with the same type parameters as `Link`. This means you can create your own component which provides the same type safety and typescript performance as `Link`.

### Basic example

If you want to create a basic custom link component, you can do so with the following:

<!-- ::start:framework -->

# React

```tsx
import * as React from 'react'
import { createLink, LinkComponent } from '@tanstack/react-router'

interface BasicLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  // Add any additional props you want to pass to the anchor element
}

const BasicLinkComponent = React.forwardRef<HTMLAnchorElement, BasicLinkProps>(
  (props, ref) => {
    return (
      <a ref={ref} {...props} className={'block px-3 py-2 text-blue-700'} />
    )
  },
)

const CreatedLinkComponent = createLink(BasicLinkComponent)

export const CustomLink: LinkComponent<typeof BasicLinkComponent> = (props) => {
  return <CreatedLinkComponent preload={'intent'} {...props} />
}
```

# Solid

```tsx
import * as Solid from 'solid-js'
import { createLink, LinkComponent } from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
})

type BasicLinkProps = Solid.JSX.IntrinsicElements['a'] & {
  // Add any additional props you want to pass to the anchor element
}

const BasicLinkComponent: Solid.Component<BasicLinkProps> = (props) => (
  <a {...props} class="block px-3 py-2 text-red-700">
    {props.children}
  </a>
)

const CreatedLinkComponent = createLink(BasicLinkComponent)

export const CustomLink: LinkComponent<typeof BasicLinkComponent> = (props) => {
  return <CreatedLinkComponent preload={'intent'} {...props} />
}
```

<!-- ::end:framework -->

You can then use your newly created `Link` component as any other `Link`

```tsx
<CustomLink to={'/dashboard/invoices/$invoiceId'} params={{ invoiceId: 0 }} />
```

## `createLink` with third party libraries

Here are some examples of how you can use `createLink` with third-party libraries.

<!-- ::start:framework -->

# React

### React Aria Components example

React Aria Components v1.11.0 and later works with TanStack Router's `preload (intent)` prop. Use `createLink` to wrap each React Aria component that you use as a link.

<!-- ::start:tabs variant="files" -->

```tsx title="RACLink.tsx"
import { createLink } from '@tanstack/react-router'
import { Link as RACLink, MenuItem } from 'react-aria-components'

export const Link = createLink(RACLink)
export const MenuItemLink = createLink(MenuItem)
```

```tsx title="CustomRACLink.tsx"
import { createLink } from '@tanstack/react-router'
import { Link as RACLink, type LinkProps } from 'react-aria-components'

interface MyLinkProps extends LinkProps {
  // your props
}

function MyLink(props: MyLinkProps) {
  return (
    <RACLink
      {...props}
      style={({ isHovered }) => ({
        color: isHovered ? 'red' : 'blue',
      })}
    />
  )
}

export const Link = createLink(MyLink)
```

<!-- ::end:tabs -->

To use React Aria's render props, including the `className`, `style`, and `children` functions, create a wrapper component and pass that to `createLink`.

<!-- ::end:framework -->

<!-- ::start:framework -->

# React

### Chakra UI example

```tsx title="ChakraLinkComponent.tsx"
import * as React from 'react'
import { createLink, LinkComponent } from '@tanstack/react-router'
import { Link } from '@chakra-ui/react'

interface ChakraLinkProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Link>,
  'href'
> {
  // Add any additional props you want to pass to the link
}

const ChakraLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  ChakraLinkProps
>((props, ref) => {
  return <Link ref={ref} {...props} />
})

const CreatedLinkComponent = createLink(ChakraLinkComponent)

export const CustomLink: LinkComponent<typeof ChakraLinkComponent> = (
  props,
) => {
  return (
    <CreatedLinkComponent
      textDecoration={'underline'}
      _hover={{ textDecoration: 'none' }}
      _focus={{ textDecoration: 'none' }}
      preload={'intent'}
      {...props}
    />
  )
}
```

<!-- ::end:framework -->

<!-- ::start:framework -->

# React

### MUI example

There is an [example](https://github.com/TanStack/router/tree/main/examples/react/start-material-ui) available which uses these patterns.

#### `Link`

If the MUI `Link` should simply behave like the router `Link`, it can be just wrapped with `createLink`:

<!-- ::start:tabs variant="files" -->

```tsx title="CustomLink.tsx"
import { createLink } from '@tanstack/react-router'
import { Link } from '@mui/material'

export const CustomLink = createLink(Link)
```

<!-- ::end:tabs -->

If the `Link` should be customized this approach can be used:

<!-- ::start:tabs variant="files" -->

```tsx title="CustomLink.tsx"
import React from 'react'
import { createLink } from '@tanstack/react-router'
import { Link } from '@mui/material'
import type { LinkProps } from '@mui/material'
import type { LinkComponent } from '@tanstack/react-router'

interface MUILinkProps extends LinkProps {
  // Add any additional props you want to pass to the Link
}

const MUILinkComponent = React.forwardRef<HTMLAnchorElement, MUILinkProps>(
  (props, ref) => <Link ref={ref} {...props} />,
)

const CreatedLinkComponent = createLink(MUILinkComponent)

export const CustomLink: LinkComponent<typeof MUILinkComponent> = (props) => {
  return <CreatedLinkComponent preload={'intent'} {...props} />
}

// Can also be styled
```

<!-- ::end:tabs -->

#### `Button`

If a `Button` should be used as a router `Link`, the `component` should be set as `a`:

<!-- ::start:tabs variant="files" -->

```tsx title="CustomButtonLink.tsx"
import React from 'react'
import { createLink } from '@tanstack/react-router'
import { Button } from '@mui/material'
import type { ButtonProps } from '@mui/material'
import type { LinkComponent } from '@tanstack/react-router'

interface MUIButtonLinkProps extends ButtonProps<'a'> {
  // Add any additional props you want to pass to the Button
}

const MUIButtonLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MUIButtonLinkProps
>((props, ref) => <Button ref={ref} component="a" {...props} />)

const CreatedButtonLinkComponent = createLink(MUIButtonLinkComponent)

export const CustomButtonLink: LinkComponent<typeof MUIButtonLinkComponent> = (
  props,
) => {
  return <CreatedButtonLinkComponent preload={'intent'} {...props} />
}
```

<!-- ::end:tabs -->

#### Usage with `styled`

Any of these MUI approaches can then be used with `styled`:

<!-- ::start:tabs variant="files" -->

```tsx title="StyledCustomLink.tsx"
import { css, styled } from '@mui/material'
import { CustomLink } from './CustomLink'

const StyledCustomLink = styled(CustomLink)(
  ({ theme }) => css`
    color: ${theme.palette.common.white};
  `,
)
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

<!-- ::start:framework -->

# React

### Mantine example

<!-- ::start:tabs variant="files" -->

```tsx title="CustomLink.tsx"
import * as React from 'react'
import { createLink, LinkComponent } from '@tanstack/react-router'
import { Anchor, AnchorProps } from '@mantine/core'

interface MantineAnchorProps extends Omit<AnchorProps, 'href'> {
  // Add any additional props you want to pass to the anchor
}

const MantineLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MantineAnchorProps
>((props, ref) => {
  return <Anchor ref={ref} {...props} />
})

const CreatedLinkComponent = createLink(MantineLinkComponent)

export const CustomLink: LinkComponent<typeof MantineLinkComponent> = (
  props,
) => {
  return <CreatedLinkComponent preload="intent" {...props} />
}
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

<!-- ::start:framework -->

# Solid

### Some Library example

<!-- ::start:tabs variant="files" -->

```tsx title="UntitledLink.tsx"
// TODO: Add this example.
```

<!-- ::end:tabs -->

<!-- ::end:framework -->
