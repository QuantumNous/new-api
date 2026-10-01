# VChart Skill Usage

VChart and VTable are core components of VisActor's visualization solution. To improve AI-assisted development efficiency and reduce onboarding cost, VisActor provides a developer skill.

## Relationship with Quick Start

- [Quick Start](./Getting_Started) covers VChart basics.
- This guide focuses on using `vchart-skill` in AI editors.

## Installation

Use either command:

```bash
npx skills add VisActor/VChart
```

```bash
npx skills add VisActor/VChart --skill vchart-development-assistant
```

Installation preview:

![vchart-skill installation preview](https://p6-xtjj-sign.byteimg.com/tos-cn-i-73owjymdk6/030e176313614ac087853aca647b55df~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg546E6a2C:q75.awebp?rk3s=f64ab15b&x-expires=1773307752&x-signature=H2PzvppEZrBvra4nZh1fEo%2BiOJY%3D)

## Editor References

- Trae docs: `https://docs.trae.ai/ide/skills?_lang=zh`
- Cursor docs: `https://cursor.com/cn/docs/context/skills`

Skill directory preview:

![skills directory preview](https://p6-xtjj-sign.byteimg.com/tos-cn-i-73owjymdk6/e3cd80683fb34e21a02d371b1bc360c9~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg546E6a2C:q75.awebp?rk3s=f64ab15b&x-expires=1773307752&x-signature=wrXQJFCJd%2B6sMd05mYc1Ehu3fu8%3D)

## Demo Scenarios

### 1. Generate a simple chart

Suggested prompt:

```text
Use VChart to generate a basic bar chart with xField, yField, and a minimal runnable example.
```

Expected result:

- A runnable minimal spec is generated.
- The chart can render correctly.

![simple chart demo](https://p6-xtjj-sign.byteimg.com/tos-cn-i-73owjymdk6/fc55630c49a94d84bd3d7e3a5ca59da1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg546E6a2C:q75.awebp?rk3s=f64ab15b&x-expires=1773307752&x-signature=fcmQ6R0EEMPMDp8y%2Fw38OE4nNjY%3D)

### 2. Adjust chart styles

Suggested prompt:

```text
Optimize colors, label style, and legend readability for the existing bar chart while preserving the current data structure.
```

Expected result:

- Style changes are clearly visible.
- Existing chart structure and data mapping remain valid.

![style adjustment demo](https://p6-xtjj-sign.byteimg.com/tos-cn-i-73owjymdk6/3cec7ac8dc11486ca9a61eb157ac478d~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg546E6a2C:q75.awebp?rk3s=f64ab15b&x-expires=1773307752&x-signature=9ETSnU3R8KdgL%2Fl6bHV%2F70RoBDg%3D)

### 3. Fix spec/config issues

Suggested prompt:

```text
Review the current VChart spec, identify configuration errors, and provide fixes with explanations.
```

Expected result:

- Incorrect config locations are identified.
- A directly replaceable fixed config is provided.

![config fix demo](https://p6-xtjj-sign.byteimg.com/tos-cn-i-73owjymdk6/bb4911d4db814a7ca3b777f7549cf69e~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg546E6a2C:q75.awebp?rk3s=f64ab15b&x-expires=1773307752&x-signature=J1olPfoWsglwVMxCukVu1otSycU%3D)

## Notes

- Make sure the skill is installed in your project editor skill directory.
- If behavior differs by editor version, follow the latest official docs.
