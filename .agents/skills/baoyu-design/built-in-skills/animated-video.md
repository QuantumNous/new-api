---
name: "animated-video"
description: "Animated video\nTimeline-based motion design"
---
Create an animated video or motion design piece rendered as an HTML page. Build a timeline-based animation with smooth transitions. Design frame-by-frame sequences with playback controls (play/pause, scrubber). Focus on visual storytelling with the Anthropic brand palette. Export-ready at a fixed aspect ratio (16:9 or 9:16). If you need to know the position of an element (eg to move a cursor or character between elements) use refs to grab the position.

START by calling `copy_starter_component` with `kind: "animations.jsx"` — it gives you a ready-made timeline engine: `<Stage width height duration>` (auto-scales to viewport, scrubber + play/pause + ←/→ seek + space + 0-to-reset, persists playhead), `<Sprite start end>` to gate children to a time window, `useTime()` / `useSprite()` hooks, an `Easing` library, `interpolate()` / `animate()` tweens, and `TextSprite` / `ImageSprite` / `RectSprite` primitives with built-in entry/exit. Read the file after copying and build YOUR scenes by composing Sprites inside a Stage; only fall back to Popmotion (https://unpkg.com/popmotion@11.0.5/dist/popmotion.min.js) if the starter genuinely can't do what you need.

Animations are complex code! Make reusable JSX components for each visual element and each scene. Invest in tweaking the timeline iteratively.

Need a character, prop, or background still? If an image backend is available, generate it — see [`generate-images.md`](generate-images.md) — then animate it with `ImageSprite`.

Animation tips:
- Storytelling is KEY! Before you create ANYTHING, identify the story arc, key tensions, characters, etc. Align on the message you want to convey. Run it by the user.
- Use good animation principles... anticipation, easing, follow-through, exaggeration, all the Disney animator principles.
- Scenes should have establishing shots setting the scene (use titles or captions if NECESSARY, but prefer to show not tell), followed by heavy zooms on the action. (either hard cuts, or ken-burns-style zooms, or mouse-follows.) Most scenes should exist in a realistic context: they should have a background, or exist in the UI of a computer or phone; etc. Elements should generally not float in the aether.
- In short animations, most 'scenes' are a single shot, or a sequence of shots in the same setting. Scenes may be slides (e.g. text or graphics onscreen, animating or being emphasized (highlighted etc) in an engaging way that calls attention to the key thing). Decide what the shot is going to be. Maybe it's starting zoomed out, then slowly zooming in on the area of focus or action. Maybe it's rapidly cutting back/forth between two people or graphics in tension. Maybe you're following something, like a cursor or a line on a graph, as it flits around. Be creative!
- Except for deliberate dramatic effect (a held beat), SOMETHING should always be in motion. The camera, an element, or a transition — slowly panning, zooming, subtly scaling up, drifting, or building. A truly static frame reads as a bug. Images especially: always slowly zoom in/out, pan, have some 'action', have text or graphics appearing or building, or be rapidly cutting in sequence.
- Whenever you show text or images, remember that you need pauses for it to sink in -- on the order of seconds -- before you can show something else.

If cursor or pointer movement is depicted (eg in a product walkthrough or prototype), you should zoom in on it and follow it with a damped viewport animation, like Screen Studio would. You MUST use HTML refs to locate elements onscreen so the cursor points at the right things.

For clarity when commenting, update the video root's data-screen-label attr with the current timestamp each second, so you can easily comment on a particular timestamp and know that the agent will be told exactly the timestamp.

## Export to a video file

When the animation looks right, render it to a real `.mp4` (or `.webm`/`.gif`) with the [export-as-video](export-as-video.md) skill — it drives the Stage frame-by-frame and encodes with ffmpeg. A Stage from this starter is export-ready with no extra work: it registers a `window.__animStage` bridge and strips its scrubber/letterboxing under `?capture`, so the export usually needs only the Stage's `width`/`height`.
