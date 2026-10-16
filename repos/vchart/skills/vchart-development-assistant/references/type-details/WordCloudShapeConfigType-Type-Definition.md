```typescript
export type WordCloudShapeConfigType = {
  /** Filling words - color channel field */
  fillingSeriesField?: string;
  /** Filling words - color list */
  fillingColorList?: string[];
  /** Filling words - font family field */
  fillingFontFamilyField?: string;
  /** Filling words - font weight field */
  fillingFontWeightField?: string;
  /** Filling words - font style field */
  fillingFontStyleField?: string;
  /** Filling words - direct hex color field */
  fillingColorHexField?: string;
  /** Filling words - rotatable angles random range */
  fillingRotateAngles?: number[];
  /** Overall layout - expected ratio for core words auto-calculation */
  ratio?: number;
  /** Overall layout - whether to remove white borders from input image */
  removeWhiteBorder?: boolean;
  /** Overall layout - layout mode */
  layoutMode?: 'default' | 'ensureMapping' | 'ensureMappingEnlarge';
  /** Filling layout - filling text iteration count */
  fillingTimes?: number;
  /** Filling layout - x advancement range during filling */
  fillingXStep?: number;
  /** Filling layout - y advancement range during filling */
  fillingYStep?: number;
  /** Filling layout - x advancement range as width ratio */
  fillingXRatioStep?: number;
  /** Filling layout - y advancement range as height ratio */
  fillingYRatioStep?: number;
  /** Filling layout - initial font size for filling text */
  fillingInitialFontSize?: number;
  /** Filling layout - font size reduction value per iteration */
  fillingDeltaFontSize?: number;
  /** Filling layout - initial opacity for filling text */
  fillingInitialOpacity?: number;
  /** Filling layout - opacity reduction value per iteration */
  fillingDeltaOpacity?: number;
  /** Filling layout - word layout attempt count */
  textLayoutTimes?: number;
  /** Filling layout - font size shrink factor after layout failure */
  fontSizeShrinkFactor?: number;
  /** Filling layout - layout step factor coefficient */
  stepFactor?: number;
  /** Filling layout - important word count */
  importantWordCount?: number;
  /** Filling layout - global font size shrink limit */
  globalShinkLimit?: number;
  /** Filling layout - font size enlarge factor after layout success */
  fontSizeEnlargeFactor?: number;
  /** Filling layout - font size reduction factor per iteration for auto-calculated filling words */
  fillingDeltaFontSizeFactor?: number;
  /** Filling layout - expected ratio for filling words auto-calculation */
  fillingRatio?: number;
};
```
