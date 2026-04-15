import type { ReactNode } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import {
  CARD_ITEM_VARIANTS,
  CARD_STAGGER_VARIANTS,
  MOTION_TRANSITION,
  MOTION_VARIANTS,
  STAGGER_ITEM_VARIANTS,
  STAGGER_VARIANTS,
  TABLE_ROW_VARIANTS,
  TABLE_STAGGER_VARIANTS,
} from '@/lib/motion'

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export function PageTransition(props: PageTransitionProps) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={props.className}>{props.children}</div>
  }

  return (
    <motion.div
      initial={MOTION_VARIANTS.pageEnter.initial}
      animate={MOTION_VARIANTS.pageEnter.animate}
      transition={MOTION_TRANSITION.default}
      className={props.className}
    >
      {props.children}
    </motion.div>
  )
}

export function AnimatedOutlet() {
  const shouldReduce = useReducedMotion()
  const routeKey = useRouterState({
    select: (s) => s.location.pathname,
  })

  if (shouldReduce) {
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <Outlet />
      </div>
    )
  }

  return (
    <motion.div
      key={routeKey}
      initial={MOTION_VARIANTS.pageEnter.initial}
      animate={MOTION_VARIANTS.pageEnter.animate}
      transition={MOTION_TRANSITION.fast}
      className='flex min-h-0 flex-1 flex-col'
    >
      <Outlet />
    </motion.div>
  )
}

interface StaggerContainerProps {
  children: ReactNode
  className?: string
  variants?: Variants
}

export function StaggerContainer(props: StaggerContainerProps) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={props.className}>{props.children}</div>
  }

  return (
    <motion.div
      variants={props.variants ?? STAGGER_VARIANTS}
      initial='initial'
      animate='animate'
      className={props.className}
    >
      {props.children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
  variants?: Variants
}

export function StaggerItem(props: StaggerItemProps) {
  return (
    <motion.div
      variants={props.variants ?? STAGGER_ITEM_VARIANTS}
      className={props.className}
    >
      {props.children}
    </motion.div>
  )
}

export function TableStaggerContainer(props: StaggerContainerProps) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <>{props.children}</>
  }

  return (
    <motion.tbody
      variants={TABLE_STAGGER_VARIANTS}
      initial='initial'
      animate='animate'
      className={props.className}
    >
      {props.children}
    </motion.tbody>
  )
}

export function TableStaggerRow(props: StaggerItemProps) {
  return (
    <motion.tr variants={TABLE_ROW_VARIANTS} className={props.className}>
      {props.children}
    </motion.tr>
  )
}

export function CardStaggerContainer(props: StaggerContainerProps) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={props.className}>{props.children}</div>
  }

  return (
    <motion.div
      variants={CARD_STAGGER_VARIANTS}
      initial='initial'
      animate='animate'
      className={props.className}
    >
      {props.children}
    </motion.div>
  )
}

export function CardStaggerItem(props: StaggerItemProps) {
  return (
    <motion.div variants={CARD_ITEM_VARIANTS} className={props.className}>
      {props.children}
    </motion.div>
  )
}

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function FadeIn(props: FadeInProps) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) {
    return <div className={props.className}>{props.children}</div>
  }

  return (
    <motion.div
      initial={MOTION_VARIANTS.fadeIn.initial}
      animate={MOTION_VARIANTS.fadeIn.animate}
      transition={{
        ...MOTION_TRANSITION.default,
        delay: props.delay,
      }}
      className={props.className}
    >
      {props.children}
    </motion.div>
  )
}
