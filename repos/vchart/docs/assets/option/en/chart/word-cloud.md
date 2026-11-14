{{ target: chart-word-cloud }}

# wordCloudChart

Word Cloud Chart

The word cloud chart is implemented into two parts on the bottom layer: "word cloud" and "shape word cloud".  
When `maskShape` is not configured or configured as a built-in shape, it is regarded as "word cloud"; otherwise, it is "shape word cloud".  
Due to the different underlying algorithms, "word cloud" and "shape word cloud" have slightly different configurations. The different configurations are reflected in `wordCloudConfig` and `wordCloudShapeConfig`.  

Note: The built-in shapes include:
- `'triangleForward'`: Right arrow
- `'triangle'`: Triangle
- `'diamond'`: Diamond
- `'square'`: Square
- `'star'`: Star
- `'cardioid'`: Heart-shaped
- `'circle'`: Circle
- `'pentagon'`: Pentagon
- `'rect'`: Rect (supported since 1.9.3)

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'wordCloud'
) }}

{{ use: series-word-cloud(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}