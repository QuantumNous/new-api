---
category: Getting Started
title:  Accessibility
icon: doc-a11y
localeCode: en-US
order: 7
brief: Accessible design is about making it easy for everyone to interact with products, including those with disabilities, to provide a better experience for everyone. The Semi design system is designed to remove barriers and create inclusive product experiences that work for all.
---

## Accessibility-specific themes
Semi has customized a set of accessibility friendly themes [@semi-bot/semi-theme-a11y](https://semi.design/dsm_store/theme?dsmID=2243)  
Compared with the default theme, the A11y theme increases the contrast of each color of the basic color wheel, and increases the font size of the font token. If there is a higher requirement for contrast, this theme is recommended.   

```
// install
npm i @semi-bot/semi-theme-a11y
```

Access steps for reference [Customized Themes](https://semi.design/en-US/start/customize-theme#When%20using%20webpack%20as%20a%20build%20tool)

## Understand user needs

To design and develop inclusive products, you first need to understand the different needs of different users and consider the aids and methods they use.

### Visual impairment

Blind users rely on screen readers to access websites and applications. Typically, screen reader users navigate pages by navigating through specific elements such as headings, links, or form elements.
So, you need to use semantic elements and check if the tags make sense out of context.

Low vision users have different needs depending on the nature of their vision impairment. Users may be unable to distinguish text or other content without magnification, especially small text, or have difficulty distinguishing text and images with low color contrast, etc.
These requirements mean that the interface should not rely on color to convey information, the color palette needs to have sufficient contrast, and the layout should be responsive as the font size increases.

### Device dependencies

Users who rely on the keyboard need to be able to access the focusable element on the screen through the keyboard.

Users who rely on mouse or touch need to have a target area large enough to hit easily.

### Cognitive Impairment

Users who struggle with information should benefit from well-written content.
Therefore, the application's information should be clear, concise, and easy to navigate; also consider visual hierarchy, break content into short, related sections, and avoid long paragraphs.

## Keyboard and focus

Many users, including the visually impaired, rely on keyboard navigation to use our products. Therefore, all focusable components should be keyboard accessible, including links, buttons, and form controls.

### Keyboard Shortcuts

- Tab key to switch focus: Tab order should follow a predictable sequential hierarchy, eg: top to bottom, left to right. When some key elements get the focus, the prompt information of the element should be displayed; when the focus is lost, the prompt disappears.
- Arrows: Navigate between related radio buttons, menu items or widget items.
- Enter: activate button, submit form, etc.
- Space: page down the screen.
- Esc: Exit from various bullet layers.
- Component detailed keyboard interactions are also provided in the documentation for each component.

### Focus Principle

Focus states are an important part of the design because they let the keyboard user know where the focus is currently. The focus needs to follow the following principles:

- Initial focus: To enable users to complete tasks efficiently, always set initial focus for tasks. Set focus to the first logical interactive element or the first element in the task. When the focus is switched, if the current focus control is covered, the focus needs to be automatically switched to the first focus area of ​​the new page.
- Navigation is reversible: when the user switches to the next focus through the [tab key], he must be able to switch to the previous focus through [shift + Tab];
- Returnable: If the currently focused element disappears, the focus state should always return to the previous position. For example, closing a modal might mean that your focus is on the close button; when the modal is closed, you should return focus to the button that opened the modal;

## Color and Contrast

### Multiple prompts

Don't use color as the only way to convey information. Use adding icons, text, underlines, etc. to ensure that all groups of people receive the same message.

<ImageBox alt="Multiple tips to do and don't example" url='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-do-and-donot.png' darkUrl ="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-do-and-donot-dark.png" />

### Text element comparison

According to WCAG recommended thresholds: the contrast between the text and background color of text elements should be at least 4.5:1 (including the text inside the component), and the contrast can be reduced to 3:1 for text 18px or larger, but can be used for disabled text. Not limited by contrast ratio requirements.

<ImageBox alt="Text element comparison example" url="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast.png" darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast-dark.png" />

### Component Status and Comparison

All operable components need to have a focus state. The active, hover, and focus states of the component all need to meet the 3:1 contrast ratio with the adjacent color. But there is no contrast requirement between the different states.

For a component with a stroke, it only needs to meet the 3:1 contrast between the stroke color and the base color. No contrast is required between the fill and stroke colors.

<ImageBox alt="Component state and contrast example" url="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-component-state-contrast.png" darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-component-state-contrast-dark.png" />


### exception

For some components that mainly focus on reading, such as: Message, banner, etc., it is not necessary to strictly follow the AA standard. However, the actionable items in the component still need to meet the contrast requirements.

<ImageBox alt="Example of exceptions" url="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast-special.png" darkUrl="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-color-contrast-special-dark.png" />

## Pictures and Videos

We provide a way to provide a text-based alternative to all images, icons, and SVGs so that screen readers can succinctly describe images and videos, such as avatars.


```jsx live=true
import React from 'react';
import { Avatar } from '@douyinfe/semi-ui';

() => (
    <div>
        <Avatar
            alt="Person Name"
            src="https://lf9-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/a11y-img-alt-avatar.png"
            style={{ margin: 4 }}
        />
    </div>
);
```
