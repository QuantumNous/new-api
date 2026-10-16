# Player

Player's main purpose is to enhance dynamic narrative capabilities, supporting basic functions such as playing, pausing, fast forwarding, and rewinding, helping users dynamically display sequential data. It can be divided into two types of playback based on the supported data types: discrete and continuous. By using the Player component, users can trace back the changes in the data in the chart, which helps them to observe data changes more intuitively. This tutorial mainly introduces the concepts and components of Player, for more detailed configuration and examples of Player, please refer to the [Configuration Document](../../../option) and [Examples](../../../example) pages.

## Components

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c618.png" alt="Player Schematic">
</div>

The Player component consists of 2 modules:

- Controller
  - Play button/Pause button
  - Forward button
  - Reverse button
- Slider
  - Track
  - Slider track
  - Handle

## Categories

According to the presentation type of the player, Player can be divided into two categories:

1. Discrete: Data plays at discrete time points, such as sales data for a particular quarter.
2. Continuous: Data plays continuously on the timeline, such as the real-time change of stock prices.

## Examples

- [Basic Player (Discrete)](../../../demo/player/basic-player)
- [Basic Player (Continuous)](../../../demo/player/continuous-player)
- [ranking-bar](../../../demo/player/ranking-bar)
- [timeline-scatter](../../../demo/player/timeline-scatter)
