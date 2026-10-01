{{ target: mark-progressive-config }}

#${prefix} large(boolean) = false

Enable large data rendering mode, which will reduce the rendering accuracy.

#${prefix} largeThreshold(number)

Threshold for enabling large data rendering optimization, corresponding to the length of data; It is recommended that largeThreshold < progressiveThreshold.

#${prefix} progressiveStep(number)

Segment length.

#${prefix} progressiveThreshold(number)

Threshold for enabling progressive rendering, corresponding to the length of a single series data.