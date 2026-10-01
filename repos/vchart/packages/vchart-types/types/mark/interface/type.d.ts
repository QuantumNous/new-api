export type MarkType = keyof typeof MarkTypeEnum | string;
export declare const enum MarkTypeEnum {
    group = "group",
    symbol = "symbol",
    rule = "rule",
    line = "line",
    text = "text",
    rect = "rect",
    image = "image",
    path = "path",
    area = "area",
    arc = "arc",
    polygon = "polygon",
    boxPlot = "boxPlot",
    linkPath = "linkPath",
    cell = "cell",
    ripple = "ripple",
    liquid = "liquid",
    component = "component",
    dataLabel = "dataLabel",
    label = "label",
    pictogram = "pictogram"
}
