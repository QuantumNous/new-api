{{ target: chart-word-cloud3d }}

# wordCloud3dChart

3d Word Cloud

The underlying implementation of the word cloud is divided into: "word cloud" and "shape word cloud". The 3d word cloud is the projection of the word cloud onto surfaces such as spheres and cylinders under a 3d perspective.
When `maskShape` is not configured or configured as built-in shapes, it is regarded as "word cloud"; otherwise, it is regarded as "shape word cloud".  
Due to different underlying algorithms, "word cloud" and "shape word cloud" have slightly different configurations. Different configurations are reflected in `wordCloudConfig` and `wordCloudShapeConfig`.

Note: Built-in shapes include:

- `'triangleForward'`: right arrow
- `'triangle'`: triangle
- `'diamond'`: diamond
- `'square'`: square
- `'star'`: star
- `'cardioid'`: heart
- `'circle'`: circle
- `'pentagon'`: pentagon
- `'rect'`: Rect (supported since 1.9.3)

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'wordCloud3d'
) }}

{{ use: series-word-cloud3d(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}