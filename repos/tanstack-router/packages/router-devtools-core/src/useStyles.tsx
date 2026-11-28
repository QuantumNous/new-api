import * as goober from 'goober'
import { createSignal, useContext } from 'solid-js'
import { tokens } from './tokens'
import { ShadowDomTargetContext } from './context'
import type { Accessor } from 'solid-js'

const stylesFactory = (shadowDOMTarget?: ShadowRoot) => {
  const { colors, font, size, alpha, shadow, border } = tokens
  const { fontFamily, lineHeight, size: fontSize } = font
  const css = shadowDOMTarget
    ? goober.css.bind({ target: shadowDOMTarget })
    : goober.css

  return {
    devtoolsPanelContainer: css`
      direction: ltr;
      position: fixed;
      bottom: 0;
      right: 0;
      z-index: 99999;
      width: 100%;
      max-height: 90%;
      border-top: 1px solid ${colors.gray[700]};
      transform-origin: top;
    `,
    devtoolsPanelContainerVisibility: (isOpen: boolean) => {
      return css`
        visibility: ${isOpen ? 'visible' : 'hidden'};
      `
    },
    devtoolsPanelContainerResizing: (isResizing: Accessor<boolean>) => {
      if (isResizing()) {
        return css`
          transition: none;
        `
      }

      return css`
        transition: all 0.4s ease;
      `
    },
    devtoolsPanelContainerAnimation: (isOpen: boolean, height: number) => {
      if (isOpen) {
        return css`
          pointer-events: auto;
          transform: translateY(0);
        `
      }
      return css`
        pointer-events: none;
        transform: translateY(${height}px);
      `
    },
    logo: css`
      cursor: pointer;
      display: flex;
      flex-direction: column;
      background-color: transparent;
      border: none;
      font-family: ${fontFamily.sans};
      gap: ${tokens.size[0.5]};
      padding: 0px;
      &:hover {
        opacity: 0.7;
      }
      &:focus-visible {
        outline-offset: 4px;
        border-radius: ${border.radius.xs};
        outline: 2px solid ${colors.blue[800]};
      }
    `,
    tanstackLogo: css`
      font-size: ${font.size.md};
      font-weight: ${font.weight.bold};
      line-height: ${font.lineHeight.xs};
      white-space: nowrap;
      color: ${colors.gray[300]};
    `,
    routerLogo: css`
      font-weight: ${font.weight.semibold};
      font-size: ${font.size.xs};
      background: linear-gradient(to right, #84cc16, #10b981);
      background-clip: text;
      -webkit-background-clip: text;
      line-height: 1;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    `,
    devtoolsPanel: css`
      display: flex;
      font-size: ${fontSize.sm};
      font-family: ${fontFamily.sans};
      background-color: ${colors.darkGray[700]};
      color: ${colors.gray[300]};

      @media (max-width: 700px) {
        flex-direction: column;
      }
      @media (max-width: 600px) {
        font-size: ${fontSize.xs};
      }
    `,
    dragHandle: css`
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 4px;
      cursor: row-resize;
      z-index: 100000;
      &:hover {
        background-color: ${colors.purple[400]}${alpha[90]};
      }
    `,
    firstContainer: css`
      flex: 1 1 500px;
      min-height: 40%;
      max-height: 100%;
      overflow: auto;
      border-right: 1px solid ${colors.gray[700]};
      display: flex;
      flex-direction: column;
    `,
    routerExplorerContainer: css`
      overflow-y: auto;
      flex: 1;
    `,
    routerExplorer: css`
      padding: ${tokens.size[2]};
    `,
    row: css`
      display: flex;
      align-items: center;
      padding: ${tokens.size[2]} ${tokens.size[2.5]};
      gap: ${tokens.size[2.5]};
      border-bottom: ${colors.darkGray[500]} 1px solid;
      align-items: center;
    `,
    detailsHeader: css`
      font-family: ui-sans-serif, Inter, system-ui, sans-serif, sans-serif;
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: ${colors.darkGray[600]};
      padding: 0px ${tokens.size[2]};
      font-weight: ${font.weight.medium};
      font-size: ${font.size.xs};
      min-height: ${tokens.size[8]};
      line-height: ${font.lineHeight.xs};
      text-align: left;
      display: flex;
      align-items: center;
    `,
    maskedBadge: css`
      background: ${colors.yellow[900]}${alpha[70]};
      color: ${colors.yellow[300]};
      display: inline-block;
      padding: ${tokens.size[0]} ${tokens.size[2.5]};
      border-radius: ${border.radius.full};
      font-size: ${font.size.xs};
      font-weight: ${font.weight.normal};
      border: 1px solid ${colors.yellow[300]};
    `,
    maskedLocation: css`
      color: ${colors.yellow[300]};
    `,
    detailsContent: css`
      padding: ${tokens.size[1.5]} ${tokens.size[2]};
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: ${font.size.xs};
    `,
    routeMatchesToggle: css`
      display: flex;
      align-items: center;
      border: 1px solid ${colors.gray[500]};
      border-radius: ${border.radius.sm};
      overflow: hidden;
    `,
    routeMatchesToggleBtn: (active: boolean, showBorder: boolean) => {
      const base = css`
        appearance: none;
        border: none;
        font-size: 12px;
        padding: 4px 8px;
        background: transparent;
        cursor: pointer;
        font-family: ${fontFamily.sans};
        font-weight: ${font.weight.medium};
      `
      const classes = [base]

      if (active) {
        const activeStyles = css`
          background: ${colors.darkGray[400]};
          color: ${colors.gray[300]};
        `
        classes.push(activeStyles)
      } else {
        const inactiveStyles = css`
          color: ${colors.gray[500]};
          background: ${colors.darkGray[800]}${alpha[20]};
        `
        classes.push(inactiveStyles)
      }

      if (showBorder) {
        classes.push(css`
          border-right: 1px solid ${tokens.colors.gray[500]};
        `)
      }

      return classes
    },
    detailsHeaderInfo: css`
      flex: 1;
      justify-content: flex-end;
      display: flex;
      align-items: center;
      font-weight: ${font.weight.normal};
      color: ${colors.gray[400]};
    `,
    matchRow: (active: boolean) => {
      const base = css`
        display: flex;
        border-bottom: 1px solid ${colors.darkGray[400]};
        cursor: pointer;
        align-items: center;
        padding: ${size[1]} ${size[2]};
        gap: ${size[2]};
        font-size: ${fontSize.xs};
        color: ${colors.gray[300]};
      `
      const classes = [base]

      if (active) {
        const activeStyles = css`
          background: ${colors.darkGray[500]};
        `
        classes.push(activeStyles)
      }

      return classes
    },
    matchIndicator: (
      color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'purple',
    ) => {
      const base = css`
        flex: 0 0 auto;
        width: ${size[3]};
        height: ${size[3]};
        background: ${colors[color][900]};
        border: 1px solid ${colors[color][500]};
        border-radius: ${border.radius.full};
        transition: all 0.25s ease-out;
        box-sizing: border-box;
      `
      const classes = [base]

      if (color === 'gray') {
        const grayStyles = css`
          background: ${colors.gray[700]};
          border-color: ${colors.gray[400]};
        `
        classes.push(grayStyles)
      }

      return classes
    },
    matchID: css`
      flex: 1;
      line-height: ${lineHeight['xs']};
    `,
    ageTicker: (showWarning: boolean) => {
      const base = css`
        display: flex;
        gap: ${size[1]};
        font-size: ${fontSize.xs};
        color: ${colors.gray[400]};
        font-variant-numeric: tabular-nums;
        line-height: ${lineHeight['xs']};
      `

      const classes = [base]

      if (showWarning) {
        const warningStyles = css`
          color: ${colors.yellow[400]};
        `
        classes.push(warningStyles)
      }

      return classes
    },
    secondContainer: css`
      flex: 1 1 500px;
      min-height: 40%;
      max-height: 100%;
      overflow: auto;
      border-right: 1px solid ${colors.gray[700]};
      display: flex;
      flex-direction: column;
    `,
    thirdContainer: css`
      flex: 1 1 500px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      height: 100%;
      border-right: 1px solid ${colors.gray[700]};

      @media (max-width: 700px) {
        border-top: 2px solid ${colors.gray[700]};
      }
    `,
    fourthContainer: css`
      flex: 1 1 500px;
      min-height: 40%;
      max-height: 100%;
      overflow: auto;
      display: flex;
      flex-direction: column;
    `,
    routesContainer: css`
      overflow-x: auto;
      overflow-y: visible;
    `,
    routesRowContainer: (active: boolean, isMatch: boolean) => {
      const base = css`
        display: flex;
        border-bottom: 1px solid ${colors.darkGray[400]};
        align-items: center;
        padding: ${size[1]} ${size[2]};
        gap: ${size[2]};
        font-size: ${fontSize.xs};
        color: ${colors.gray[300]};
        cursor: ${isMatch ? 'pointer' : 'default'};
        line-height: ${lineHeight['xs']};
      `
      const classes = [base]

      if (active) {
        const activeStyles = css`
          background: ${colors.darkGray[500]};
        `
        classes.push(activeStyles)
      }

      return classes
    },
    routesRow: (isMatch: boolean) => {
      const base = css`
        flex: 1 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: ${fontSize.xs};
        line-height: ${lineHeight['xs']};
      `

      const classes = [base]

      if (!isMatch) {
        const matchStyles = css`
          color: ${colors.gray[400]};
        `
        classes.push(matchStyles)
      }

      return classes
    },
    routesRowInner: css`
      display: 'flex';
      align-items: 'center';
      flex-grow: 1;
      min-width: 0;
    `,
    routeParamInfo: css`
      color: ${colors.gray[400]};
      font-size: ${fontSize.xs};
      line-height: ${lineHeight['xs']};
    `,
    nestedRouteRow: (isRoot: boolean) => {
      const base = css`
        margin-left: ${isRoot ? 0 : size[3.5]};
        border-left: ${isRoot ? '' : `solid 1px ${colors.gray[700]}`};
      `
      return base
    },
    code: css`
      font-size: ${fontSize.xs};
      line-height: ${lineHeight['xs']};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,
    matchesContainer: css`
      flex: 1 1 auto;
      overflow-y: auto;
    `,
    cachedMatchesContainer: css`
      flex: 1 1 auto;
      overflow-y: auto;
      max-height: 50%;
    `,
    historyContainer: css`
      display: flex;
      flex: 1 1 auto;
      overflow-y: auto;
      max-height: 50%;
    `,
    historyOverflowContainer: css`
      padding: ${size[1]} ${size[2]};
      font-size: ${tokens.font.size.xs};
    `,
    maskedBadgeContainer: css`
      flex: 1;
      justify-content: flex-end;
      display: flex;
    `,
    matchDetails: css`
      display: flex;
      flex-direction: column;
      padding: ${tokens.size[2]};
      font-size: ${tokens.font.size.xs};
      color: ${tokens.colors.gray[300]};
      line-height: ${tokens.font.lineHeight.sm};
    `,
    matchStatus: (
      status: 'pending' | 'success' | 'error' | 'notFound' | 'redirected',
      isFetching: false | 'beforeLoad' | 'loader',
    ) => {
      const colorMap = {
        pending: 'yellow',
        success: 'green',
        error: 'red',
        notFound: 'purple',
        redirected: 'gray',
      } as const

      const color =
        isFetching && status === 'success'
          ? isFetching === 'beforeLoad'
            ? 'purple'
            : 'blue'
          : colorMap[status]

      return css`
        display: flex;
        justify-content: center;
        align-items: center;
        height: 40px;
        border-radius: ${tokens.border.radius.sm};
        font-weight: ${tokens.font.weight.normal};
        background-color: ${tokens.colors[color][900]}${tokens.alpha[90]};
        color: ${tokens.colors[color][300]};
        border: 1px solid ${tokens.colors[color][600]};
        margin-bottom: ${tokens.size[2]};
        transition: all 0.25s ease-out;
      `
    },
    matchDetailsInfo: css`
      display: flex;
      justify-content: flex-end;
      flex: 1;
    `,
    matchDetailsInfoLabel: css`
      display: flex;
    `,
    mainCloseBtn: css`
      background: ${colors.darkGray[700]};
      padding: ${size[1]} ${size[2]} ${size[1]} ${size[1.5]};
      border-radius: ${border.radius.md};
      position: fixed;
      z-index: 99999;
      display: inline-flex;
      width: fit-content;
      cursor: pointer;
      appearance: none;
      border: 0;
      gap: 8px;
      align-items: center;
      border: 1px solid ${colors.gray[500]};
      font-size: ${font.size.xs};
      cursor: pointer;
      transition: all 0.25s ease-out;

      &:hover {
        background: ${colors.darkGray[500]};
      }
    `,
    mainCloseBtnPosition: (
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    ) => {
      const base = css`
        ${position === 'top-left' ? `top: ${size[2]}; left: ${size[2]};` : ''}
        ${position === 'top-right' ? `top: ${size[2]}; right: ${size[2]};` : ''}
        ${position === 'bottom-left'
          ? `bottom: ${size[2]}; left: ${size[2]};`
          : ''}
        ${position === 'bottom-right'
          ? `bottom: ${size[2]}; right: ${size[2]};`
          : ''}
      `
      return base
    },
    mainCloseBtnAnimation: (isOpen: boolean) => {
      if (!isOpen) {
        return css`
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
        `
      }
      return css`
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      `
    },
    routerLogoCloseButton: css`
      font-weight: ${font.weight.semibold};
      font-size: ${font.size.xs};
      background: linear-gradient(to right, #98f30c, #00f4a3);
      background-clip: text;
      -webkit-background-clip: text;
      line-height: 1;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    `,
    mainCloseBtnDivider: css`
      width: 1px;
      background: ${tokens.colors.gray[600]};
      height: 100%;
      border-radius: 999999px;
      color: transparent;
    `,
    mainCloseBtnIconContainer: css`
      position: relative;
      width: ${size[5]};
      height: ${size[5]};
      background: pink;
      border-radius: 999999px;
      overflow: hidden;
    `,
    mainCloseBtnIconOuter: css`
      width: ${size[5]};
      height: ${size[5]};
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      filter: blur(3px) saturate(1.8) contrast(2);
    `,
    mainCloseBtnIconInner: css`
      width: ${size[4]};
      height: ${size[4]};
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `,
    panelCloseBtn: css`
      position: absolute;
      cursor: pointer;
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
      background-color: ${colors.darkGray[700]};
      &:hover {
        background-color: ${colors.darkGray[500]};
      }

      top: 0;
      right: ${size[2]};
      transform: translate(0, -100%);
      border-right: ${colors.darkGray[300]} 1px solid;
      border-left: ${colors.darkGray[300]} 1px solid;
      border-top: ${colors.darkGray[300]} 1px solid;
      border-bottom: none;
      border-radius: ${border.radius.sm} ${border.radius.sm} 0px 0px;
      padding: ${size[1]} ${size[1.5]} ${size[0.5]} ${size[1.5]};

      &::after {
        content: ' ';
        position: absolute;
        top: 100%;
        left: -${size[2.5]};
        height: ${size[1.5]};
        width: calc(100% + ${size[5]});
      }
    `,
    panelCloseBtnIcon: css`
      color: ${colors.gray[400]};
      width: ${size[2]};
      height: ${size[2]};
    `,
    navigateButton: css`
      background: none;
      border: none;
      padding: 0 0 0 4px;
      margin: 0;
      color: ${colors.gray[400]};
      font-size: ${fontSize.md};
      cursor: pointer;
      line-height: 1;
      vertical-align: middle;
      margin-right: 0.5ch;
      flex-shrink: 0;
      &:hover {
        color: ${colors.blue[300]};
      }
    `,
  }
}

export function useStyles() {
  const shadowDomTarget = useContext(ShadowDomTargetContext)
  const [_styles] = createSignal(stylesFactory(shadowDomTarget))
  return _styles
}
