import type { ITooltipActual, ITooltipPositionActual } from '../../../typings/tooltip';
import { BaseTooltipHandler } from './base';
import { getDomStyle, getTextStyle, setStyleToDom } from './utils/style';
import {
  TOOLTIP_CONTAINER_EL_CLASS_NAME,
  DEFAULT_TOOLTIP_Z_INDEX,
  TOOLTIP_PREFIX,
  TOOLTIP_CONTENT_BOX_CLASS_NAME,
  TOOLTIP_TITLE_CLASS_NAME
} from './constants';
import { type Maybe, isValid } from '@visactor/vutils';
import type { IContainerSize } from '@visactor/vrender-components';
import { domDocument } from '../../../util/env';
import type { ITooltipSpec, TooltipHandlerParams } from '../../../component/tooltip';
import type { IComponentPluginService } from '../interface';
import { registerComponentPlugin } from '../register';
import type { ILayoutPoint } from '../../../typings';
import { TooltipHandlerType } from '../../../component/tooltip/constant';
import { getSvgHtml } from './utils/svg';
import { formatContent } from './utils/common';
import { token } from '../../../theme/token';
import { calcLayoutNumber } from '../../../util/space';
/**
 * The tooltip handler class.
 */
export class DomTooltipHandler extends BaseTooltipHandler {
  static readonly type = TooltipHandlerType.dom;
  readonly type = TooltipHandlerType.dom;

  protected _tooltipContainer = domDocument?.body;
  protected _domStyle: {
    panelPadding?: number[];
    panel: Partial<CSSStyleDeclaration>;
    row: Partial<CSSStyleDeclaration>;
    title: Partial<CSSStyleDeclaration>;
    shape: Partial<CSSStyleDeclaration>;
    key: Partial<CSSStyleDeclaration>;
    value: Partial<CSSStyleDeclaration>;
  };
  protected _rootDom?: HTMLElement;
  protected _tooltipActual?: ITooltipActual;
  protected declare _container: Maybe<HTMLDivElement>;

  /** 自定义 tooltip 的位置缓存 */
  protected _cacheCustomTooltipPosition: ILayoutPoint;

  getVisibility() {
    return this._rootDom ? this._rootDom.style.visibility === 'visible' : false;
  }

  setVisibility(_value: boolean) {
    // 这里做个节流
    if (_value !== this.getVisibility() && this._rootDom) {
      this._rootDom.style.visibility = _value ? 'visible' : 'hidden';
    }
  }

  getRootDom() {
    return this._rootDom;
  }

  constructor() {
    super(DomTooltipHandler.type);
  }

  onAdd(service: IComponentPluginService<any>): void {
    super.onAdd(service);
    this._initStyle();
    this.initEl();
  }

  initEl() {
    const tooltipSpec = this._component.getSpec() as ITooltipSpec;
    const parentElement = tooltipSpec.parentElement as HTMLElement | HTMLCanvasElement;
    if (domDocument && parentElement && parentElement.children && parentElement.children.length) {
      for (let i = 0; i < parentElement.children.length; i++) {
        if (parentElement.children[i].classList.contains(TOOLTIP_CONTAINER_EL_CLASS_NAME)) {
          this._container = parentElement.children[i] as HTMLDivElement;
          break;
        }
      }
      if (!this._container) {
        this._container = domDocument.createElement('div');
        this._container.style.position = 'relative';
        this._container.style.zIndex = DEFAULT_TOOLTIP_Z_INDEX;
        this._container.classList.add(TOOLTIP_CONTAINER_EL_CLASS_NAME);
        parentElement.appendChild(this._container);
      }
    }
  }

  initRootDom() {
    const tooltipSpec = this._component.getSpec() as ITooltipSpec;
    const tooltipElement = document.createElement('div');
    const themeFontFamily = this._chartOption?.getTheme('fontFamily');
    setStyleToDom(tooltipElement, {
      left: '0',
      top: '0',
      pointerEvents: 'none',
      padding: '12px',
      position: 'absolute',
      zIndex: DEFAULT_TOOLTIP_Z_INDEX,
      fontFamily: (themeFontFamily ?? token.fontFamily) as string,
      fontSize: '11px',
      borderRadius: '3px',
      borderStyle: 'solid',
      lineHeight: 'initial',
      background: '#fff',
      boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
      maxWidth: '100wh',
      maxHeight: '100vh',
      visibility: 'hidden',
      ...this._domStyle.panel
    } as CSSStyleDeclaration);
    tooltipElement.classList.add(tooltipSpec.className);
    tooltipElement.setAttribute('vchart-tooltip-id', `${this.id}`);
    this._container.appendChild(tooltipElement);
    this._rootDom = tooltipElement;
  }

  // 计算 tooltip 内容区域的宽高，并缓存结果
  protected _getTooltipBoxSize(actualTooltip: ITooltipActual, changePositionOnly: boolean): IContainerSize | undefined {
    if (!this._rootDom) {
      this.initRootDom();
    }
    if (!changePositionOnly) {
      this._updateDomStringByCol(actualTooltip);
    }

    this._updateDomStyle('height', changePositionOnly);

    const rect = this._rootDom?.getBoundingClientRect();

    return {
      width: rect?.width,
      height: rect?.height
    };
  }

  protected _removeTooltip() {
    if (this._rootDom && this._rootDom.parentNode) {
      this._rootDom.parentNode.removeChild(this._rootDom);
      this._rootDom = null;
    }
    this._container = null;
  }

  protected _updateTooltip(visible: boolean, params: TooltipHandlerParams) {
    if (!visible || !this._rootDom) {
      this.setVisibility(visible);
      this._cacheCustomTooltipPosition = undefined;
    } else {
      const { tooltipSpec, activeTooltipSpec } = params;

      if (!params.changePositionOnly) {
        this._tooltipActual = activeTooltipSpec;
      }
      // 位置
      const el = this._rootDom;
      if (el) {
        const { x = 0, y = 0 } = activeTooltipSpec.position ?? {};
        let position = { x, y };
        const currentVisible = this.getVisibility();
        if (tooltipSpec.updateElement) {
          // 此处先设定一次位置，防止页面暂时出现滚动条（优先设置上次的位置）
          this._updatePosition(this._cacheCustomTooltipPosition ?? { x, y });
          // 更新 tooltip dom
          tooltipSpec.updateElement(el, activeTooltipSpec, params);
          // 重新计算 tooltip 位置
          position = this._getActualTooltipPosition(activeTooltipSpec, params, {
            width: el.offsetWidth,
            height: el.offsetHeight
          });
          // 更新缓存
          this._cacheCustomTooltipPosition = position;
        }
        // 首次从false展示需要先设置一次位置，防止出现从一个非常远的初始位置进行动画
        if (!currentVisible && visible) {
          this._rootDom.style.transition = 'none';
          this._updatePosition(position, false);
          this._rootDom.getBoundingClientRect();
        }
        // 更新位置
        this._updatePosition(position);
      }
      this.setVisibility(visible);
    }
  }

  protected _initStyle() {
    const tooltipSpec = this._component.getSpec() as ITooltipSpec;

    this._domStyle = getDomStyle(tooltipSpec);
  }

  protected _updateDomStringByCol(actualTooltip?: ITooltipActual) {
    const { title = {}, content } = actualTooltip;
    const hasContent = content && content.length;
    const rowStyle = this._domStyle.row;
    const chilren = [...(this._rootDom.children as any)] as HTMLElement[];
    let titleDom = chilren.find(child => child.className.includes(TOOLTIP_TITLE_CLASS_NAME));
    let contentDom = chilren.find(child => child.className.includes(TOOLTIP_CONTENT_BOX_CLASS_NAME));

    if (!titleDom && title.visible !== false) {
      titleDom = document.createElement('h2');
      const span = document.createElement('span');
      titleDom.appendChild(span);

      titleDom.classList.add(TOOLTIP_TITLE_CLASS_NAME);

      // 将 titleDom 插入到 this._rootDom 中作为第一个节点
      if (this._rootDom.firstChild) {
        this._rootDom.insertBefore(titleDom, this._rootDom.firstChild);
      } else {
        this._rootDom.appendChild(titleDom);
      }
    }

    if (titleDom && title.visible !== false) {
      setStyleToDom(titleDom, {
        ...this._domStyle.title,
        ...(hasContent ? rowStyle : { marginBottom: '0px' }),
        marginTop: '0px'
      });
      (titleDom.firstChild as HTMLElement).innerHTML = `${title.value ?? ''}`;
    } else if (titleDom && title.visible === false) {
      titleDom.parentNode.removeChild(titleDom);
    }

    const columns = ['shape', 'key', 'value'];

    if (!contentDom && hasContent) {
      contentDom = document.createElement('div');

      columns.forEach(col => {
        const colDiv = document.createElement('div');

        colDiv.classList.add(`${TOOLTIP_PREFIX}-column`);
        colDiv.classList.add(`${TOOLTIP_PREFIX}-${col}-column`);
        colDiv.setAttribute('data-col', col);
        contentDom.appendChild(colDiv);
      });

      contentDom.classList.add(TOOLTIP_CONTENT_BOX_CLASS_NAME);
      this._rootDom.appendChild(contentDom);
    }

    if (contentDom && hasContent) {
      const columnDivs = [...(contentDom.children as any)] as HTMLElement[];
      setStyleToDom(contentDom, { whiteSpace: 'nowrap' });

      columnDivs.forEach((colDiv, index) => {
        const colName = colDiv.getAttribute('data-col');

        if (colName && columns.includes(colName)) {
          const hideColumn = colName === 'shape' && content.every(c => !c.hasShape || !c.shapeType);

          setStyleToDom(colDiv, {
            ...(this._domStyle as any)[colName],
            display: hideColumn ? 'none' : 'inline-block',
            verticalAlign: 'top'
          });
          const rows = [...(colDiv.children as any)] as HTMLElement[];

          // 删除多余的行
          rows.slice(content.length).forEach(extraRow => {
            extraRow.parentNode.removeChild(extraRow);
          });

          content.forEach((entry, index) => {
            let row = rows[index];

            if (!row) {
              row = document.createElement('div');
              row.classList.add(`${TOOLTIP_PREFIX}-${colName}`);
              colDiv.appendChild(row);
            }
            const styleByRow = {
              ...rowStyle
            };

            if (index === content.length - 1) {
              styleByRow.marginBottom = '0px';
            }

            styleByRow.display = entry.visible === false ? 'none' : 'block';
            // 每次更新，需要更新单元格的高度，防止同步高度的时候没有更新
            styleByRow.height = 'initial';

            if (colName === 'key') {
              row.innerHTML = formatContent(entry.key);
              if (entry.keyStyle) {
                getTextStyle(entry.keyStyle, styleByRow);
              }
            } else if (colName === 'value') {
              row.innerHTML = formatContent(entry.value);
              if (entry.valueStyle) {
                getTextStyle(entry.valueStyle, styleByRow);
              }
            } else if (colName === 'shape') {
              row.innerHTML = getSvgHtml(entry, `${this.id}_${index}`);
            }

            setStyleToDom(row, styleByRow);
          });
        }
      });
    } else if (contentDom && !hasContent) {
      contentDom.parentNode.removeChild(contentDom);
    }
  }
  protected _updateDomStyle(sizeKey: 'width' | 'height' = 'width', refreshSize: boolean) {
    const rootDom = this._rootDom;
    const contentDom = [...(rootDom.children as any)].find(child =>
      child.className.includes(TOOLTIP_CONTENT_BOX_CLASS_NAME)
    );
    const titleDom = [...(rootDom.children as any)].find(child => child.className.includes(TOOLTIP_TITLE_CLASS_NAME));

    if (contentDom) {
      const tooltipSpec = this._component.getSpec() as ITooltipSpec;
      const contentStyle: Partial<CSSStyleDeclaration> = {};
      const titleLabel = tooltipSpec.style?.titleLabel;
      const autoFixTitleWidth = titleLabel && titleLabel.autoWidth && titleLabel.multiLine !== false;

      if (autoFixTitleWidth && titleDom) {
        const maxWidth = [...(contentDom.children as any)].reduce((res, col) => {
          return sizeKey === 'height'
            ? res + col.getBoundingClientRect().width
            : Math.max(res, col.getBoundingClientRect().width);
        }, 0);

        if (maxWidth > 0) {
          titleDom.style.maxWidth = `${maxWidth}px`;
          // 需要再计算一次，因为之前可能因为没有设置maxWidth， content的dom被撑宽了
          titleDom.style.maxWidth = `${Math.ceil(contentDom.getBoundingClientRect().width)}px`;
        }
      }

      if (isValid(tooltipSpec?.style?.maxContentHeight)) {
        const titleHeight =
          titleDom && titleDom.className.includes(TOOLTIP_TITLE_CLASS_NAME)
            ? titleDom.getBoundingClientRect().height + (tooltipSpec.style.spaceRow ?? 0)
            : 0;
        const viewRect = (this._chartOption as any).getChartViewRect();
        const maxHeight = calcLayoutNumber(
          tooltipSpec.style.maxContentHeight,
          Math.min(viewRect.height, document.body.clientHeight) -
            titleHeight -
            (this._domStyle.panelPadding ? this._domStyle.panelPadding[0] + this._domStyle.panelPadding[1] : 0)
        );

        if (maxHeight > 0) {
          contentStyle.maxHeight = `${maxHeight}px`;
          contentStyle.overflowY = 'auto';
          // todo 让内容宽度往外阔一点，给滚动条留出位置
          contentStyle.width = `calc(100% + ${
            this._domStyle.panelPadding ? this._domStyle.panelPadding[1] + 'px' : '10px'
          })`;

          setStyleToDom(contentDom as HTMLElement, contentStyle);
        }
      }

      const rows = contentDom.children;
      const widthByCol: number[] = [];
      if (rows) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const cols = row.children ?? ([] as HTMLElement[]);

          for (let j = 0; j < cols.length; j++) {
            if (refreshSize) {
              // 每次更新，需要更新单元格的高度，防止同步高度的时候没有更新
              cols[j].style[sizeKey] = 'initial';
            }

            const width = cols[j].getBoundingClientRect()[sizeKey];
            if (widthByCol[j] === undefined || widthByCol[j] < width) {
              widthByCol[j] = width;
            }
          }
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const cols = row.children ?? ([] as HTMLElement[]);

          for (let j = 0; j < cols.length; j++) {
            (cols[j] as HTMLElement).style[sizeKey] = `${widthByCol[j]}px`;
          }
        }
      }
    }
  }

  protected _getParentElement(spec: ITooltipSpec): HTMLElement {
    return this._container ?? super._getParentElement(spec);
  }

  isTooltipShown() {
    return this.getVisibility();
  }

  reInit() {
    super.reInit();
    this._initStyle();
    if (this._rootDom) {
      setStyleToDom(this._rootDom, this._domStyle.panel);
    }

    if (this.getVisibility()) {
      this._updateDomStringByCol(this._tooltipActual);
      this._updateDomStyle('height', false);
    }
  }

  protected _updatePosition({ x, y }: ITooltipPositionActual, resetTransition = true) {
    if (this._rootDom) {
      // translate3d 性能较好：https://stackoverflow.com/questions/22111256/translate3d-vs-translate-performance
      this._rootDom.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (resetTransition && this._rootDom.style.transition !== '') {
        this._rootDom.style.transition = '';
        Object.assign(this._rootDom.style, this._domStyle.panel);
      }
    }
  }
}

export const registerDomTooltipHandler = () => {
  registerComponentPlugin(DomTooltipHandler);
};
