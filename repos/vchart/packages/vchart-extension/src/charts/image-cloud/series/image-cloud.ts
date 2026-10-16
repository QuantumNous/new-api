import type { IImageCloudSeriesSpec } from './interface';
import { IMAGE_CLOUD_SERIES_TYPE, ImageCloudMarkNameEnum, imageCloudSeriesMark } from './constant';
import type { IPoint } from '@visactor/vchart';
import { isValid } from '@visactor/vchart';
import { imagecloudTransform, type GridLayoutConfig } from '@visactor/vchart';
import { registerImageCloudAnimation } from './animation';
import { ImageCloudTooltipHelper } from './tooltip-helper';
import { createImage } from '@visactor/vchart';
import type { Datum, IImageMark, IMark, IRectMark } from '@visactor/vchart';
import {
  animationConfig,
  AttributeLevel,
  BaseSeries,
  DEFAULT_DATA_KEY,
  Factory,
  registerImageMark,
  userAnimationConfig,
  vglobal
} from '@visactor/vchart';

export class ImageCloudSeries<T extends IImageCloudSeriesSpec> extends BaseSeries<T> {
  static readonly type: string = IMAGE_CLOUD_SERIES_TYPE;
  type = IMAGE_CLOUD_SERIES_TYPE;

  static readonly mark = imageCloudSeriesMark;

  protected _urlField: string;
  protected _nameField?: string;
  protected _valueField?: string;
  setValueField(field: string) {
    if (isValid(field)) {
      this._valueField = field;
    }
  }

  protected _imageMark?: IImageMark;
  protected _maskMark?: IRectMark;

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this._nameField = this._spec.nameField;
    this._valueField = this._spec.valueField;
    this._urlField = this._spec.urlField;
  }

  initMark() {
    if (this._spec.imageMask?.visible) {
      this._maskMark = this._createMark(imageCloudSeriesMark.imageMask, {
        dataView: false,
        skipBeforeLayouted: true
      }) as IRectMark;
    }

    this._imageMark = this._createMark(imageCloudSeriesMark.image, {
      key: datum => `${datum[DEFAULT_DATA_KEY]}-${datum.frequency}`,
      isSeriesMark: true,
      skipBeforeLayouted: true
    }) as IImageMark;
  }

  initMarkStyle() {
    this._initImageMarkStyle();
    this._initMaskMarkStyle();
  }

  protected _initImageMarkStyle() {
    if (!this._imageMark) {
      return;
    }

    this._imageMark.setTransform([
      {
        type: 'imagecloud',
        ...this._imageCloudTransformOption()
      }
    ]);

    this.setMarkStyle(
      this._imageMark,
      {
        x: (datum: Datum) => datum.x,
        y: (datum: Datum) => datum.y,
        width: (datum: Datum) => datum.width,
        height: (datum: Datum) => datum.height,
        visible: (datum: Datum) => datum.visible,
        angle: (datum: Datum) => datum.angle,
        clipConfig: (datum: Datum) => datum.clipConfig,
        image: (datum: Datum) => datum[this._urlField],
        scaleCenter: ['50%', '50%']
      },
      'normal',
      AttributeLevel.Series
    );

    const isMasked = (this._spec.layoutConfig as GridLayoutConfig)?.placement === 'masked';
    if (isMasked) {
      this.setMarkStyle(
        this._imageMark,
        {
          globalCompositeOperation: 'source-atop'
        },
        'normal',
        AttributeLevel.Series
      );
      this.setMarkStyle(
        this._rootMark,
        {
          width: () => this._region.getLayoutRect().width,
          height: () => this._region.getLayoutRect().height,
          globalCompositeOperation: 'destination-in',
          clip: true,
          drawMode: 1
        },
        'normal',
        AttributeLevel.Series
      );
    }

    if (this._spec.layoutConfig?.layoutMode === 'stack') {
      this.setMarkStyle(
        this._imageMark,
        {
          stroke: 'white',
          lineWidth: 2,
          shadowBlur: 6,
          shadowColor: 'grey'
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  protected isFillingImage(datum: Datum) {
    return datum._frequency > 1;
  }

  protected _initMaskMarkStyle() {
    if (!this._maskMark) {
      return;
    }
    this._maskMark.setMarkConfig({ interactive: false });
    this.setMarkStyle(
      this._maskMark,
      {
        width: () => {
          return this._region.getLayoutRect().width;
        },
        height: () => {
          return this._region.getLayoutRect().height;
        }
      },
      'normal',
      AttributeLevel.Series
    );
  }

  protected initTooltip(): void {
    this._tooltipHelper = new ImageCloudTooltipHelper(this);
    this._imageMark && this._tooltipHelper.activeTriggerSet.mark.add(this._imageMark);
  }

  protected _imageCloudTransformOption() {
    return {
      size: () => {
        const { width, height } = this._region.getLayoutRect();
        return [width, height];
      },
      image: { field: this._urlField },
      weight: { field: this._valueField },
      imageConfig: {
        imageSize: this._spec.imageSize,
        imageSizeRange: this._spec.imageSizeRange,
        padding: this._spec.image?.padding
      },
      ratio: this._spec.ratio,
      mask: this._spec.maskShape,
      maskConfig: this._spec.imageMask,
      layoutConfig: this._spec.layoutConfig,
      createCanvas: vglobal.createCanvas.bind(vglobal),
      createImage,
      onUpdateMaskCanvas: ((inputImage?: HTMLCanvasElement, maskImage?: HTMLCanvasElement) => {
        if (inputImage && this._maskMark) {
          this._maskMark
            .getProduct()
            .getChildren()
            .forEach((element: any) => {
              element.setAttribute('background', inputImage);
            });
        }
        if (maskImage && (this._spec.layoutConfig as GridLayoutConfig)?.placement === 'masked') {
          this._rootMark.getProduct().setAttribute('background', maskImage);
        }
      }).bind(this),
      onLayoutFinished: () =>
        this._option.globalInstance
          .getChart()
          .getOption()
          .performanceHook?.afterWordcloudShapeDraw?.(this._option.globalInstance)
    };
  }

  protected _buildMarkAttributeContext(): void {
    super._buildMarkAttributeContext();
    this._markAttributeContext.isFillingImage = this.isFillingImage.bind(this);
  }

  initAnimation(): void {
    [this._imageMark].forEach(mark => {
      if (mark) {
        const appearPreset = (this._spec?.animationAppear as any)?.preset;
        const params = {
          center: () => {
            const { width, height } = this._region.getLayoutRect();
            return { x: width / 2, y: height / 2 };
          },
          height: () => {
            const { height } = this._region.getLayoutRect();
            return height;
          }
        };
        mark.setAnimationConfig(
          animationConfig(
            Factory.getAnimationInKey('imageCloud')(params, appearPreset),
            userAnimationConfig(ImageCloudMarkNameEnum.image, this._spec, this._markAttributeContext)
          )
        );
      }
    });
  }

  getDimensionField(): string[] {
    return [this._nameField ?? this._spec.urlField];
  }

  getMeasureField(): string[] {
    return [this._valueField];
  }

  getStatisticFields() {
    const fields: { key: string; operations: Array<'max' | 'min' | 'values'> }[] = [];
    fields.push({ key: this._nameField, operations: ['values'] });
    fields.push({ key: this._valueField, operations: ['max', 'min'] });
    return fields;
  }

  getActiveMarks(): IMark[] {
    return [this._imageMark];
  }

  getMarkData(datum: Datum) {
    return datum?.datum ?? datum;
  }

  getGroupFields(): string[] {
    // do nothing
    return [];
  }

  dataToPosition(data: Datum): IPoint | null {
    return null;
  }

  dataToPositionX(data: Datum): number | null {
    return this.dataToPosition(data)?.x;
  }
  dataToPositionY(data: Datum): number | null {
    return this.dataToPosition(data)?.y;
  }

  valueToPosition(value1: any, value2?: any): null {
    return null;
  }

  getStackGroupFields(): string[] {
    // do nothing
    return [];
  }

  getStackValueField(): string {
    // do nothing
    return '';
  }
}

export const registerImageCloudSeries = () => {
  registerImageMark();
  registerImageCloudAnimation();
  Factory.registerSeries(ImageCloudSeries.type, ImageCloudSeries);
  Factory.registerGrammarTransform('imagecloud', {
    transform: imagecloudTransform
  });
};
