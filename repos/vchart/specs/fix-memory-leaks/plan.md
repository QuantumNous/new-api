## Summary
Fix memory leaks in Player component and BaseComponent release logic.

## Technical Context
- Update `@visactor/vrender` related packages to `1.0.41`.
- In `BaseComponent`, call `release(true)` when removing child components.
- In `Player`, properly unbind `autoPlayCallback` event listener on release.
- Fix `_autoSize` logic in `VChart`.

### Source Code (repository root)
- packages/vchart/
