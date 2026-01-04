---
category: Getting Started
title: Change Log
subTitle: Change Log
icon: doc-changelog
localeCode: en-US
order: 15
brief: About Semi Design For React Optimization and Updat. We provide Changelog Diff between versions, you can call out the Diff control by hovering the version number. If you want to view the change history of a single component, you can view it through the Version Diff button of the corresponding component documentation
---

Version：Major.Minor.Patch (follow the **Semver** specification)

-   **Major version**: Significant performance / usage changes
-   **Minor version**: Semi releases a minor version every two weeks, including changes of the following types: new components/features added, or style changes: New component added / new feature
-   **Patch version**: Only include bug fix, the release time is not limited

---

#### 🎉 2.88.2 (2025-11-18)
- 【Fix】
    - fixed The problems in the use of Tooltip in components in React v19  [#2743 ](https://github.com/DouyinFE/semi-design/issues/2743)

#### 🎉 2.88.1 (2025-11-17)
- 【Docs】
    - Add React v19 compatibility documentation [#3028](https://github.com/DouyinFE/semi-design/pull/3028)
- 【Feat】
    - A new package for adapting to React v19 logic has been added: @douyinfe/semi-ui-19 [#2996](https://github.com/DouyinFE/semi-design/pull/2996)
- 【Fix】
    - Fixed the issue where there was no upload failure message in the Chat input box. [#3035](https://github.com/DouyinFE/semi-design/pull/3035)
    - Fixed the issue where sending was allowed before the file upload was completed in the Chat input box. [#3035](https://github.com/DouyinFE/semi-design/pull/3035)
    - Fixed a hotkey conflict issue between the send hotkey and sub-definition extensions in AIChatInput [#3033](https://github.com/DouyinFE/semi-design/issues/3033)

#### 🎉 2.88.0 (2025-11-12)
- 【Fix】
    - Fixed an issue with the incorrect definition of the defaultContent type in AIChatInput.
    - Fixed an issue where onSkillChange was not working properly when skills changed in AIChatInput.
    - Fixed an issue where skillSlot data was missing in the onContentChange conversion result in AIChatInput.
    - update chatInputToChatCompletion return value to fit user use
    - add chat dialogue & input all interface export
    
#### 🎉 2.88.0-beta.1 (2025-11-10)
- 【Feat】
    - Added 10 filled icons and 33 linear icons [#3016](https://github.com/DouyinFE/semi-design/pull/3016)
    - Add supports to 34 new languages, including Azerbaijan (az), Bulgaria (bg), Catalonia (ca), Czech Republic (cs_CZ), Cebu (ceb_PH), Denmark (da), Greece (el_GR), Spain (Latin America) (es_419), Estonia (et), Persia (fa_IR), Philippines (fil_PH), Finland (fi_FI), French (Canada) (fr_CA), Ireland (ga), Hebrew (he_IL), Hindi (hi_IN), Croatia (hr), Hungary (hu_HU), Iceland (is), Javanese (jv_ID), Kazakhstan (kk), Khmer (km_KH), Lithuania (lt), Latvia (lv), Myanmar (my_MM), Norway (nb), Portugal (pt), Slovakia (sk), Slovenia (sl), Albania (sq), Swahili (sw), Ukraine (uk_UA), Urdu (ur), and Uzbekistan (uz).[#3018](https://github.com/DouyinFE/semi-design/pull/3018)
- 【Style】
    - Modify IconHourglass icon，UI style has changed [#3016](https://github.com/DouyinFE/semi-design/pull/3016)

#### 🎉 2.88.0-beta.0 (2025-10-30)
- 【New Component】
    - Added AI Chat Input component AIChatInput [#2997](https://github.com/DouyinFE/semi-design/pull/2997)
    - Added AI Chat Dialogue component AIChatDialogue [#2997](https://github.com/DouyinFE/semi-design/pull/2997)
    - Added FloatButton component FloatButton [#2997](https://github.com/DouyinFE/semi-design/pull/2997)
    - Added Feedback component Feedback [#2997](https://github.com/DouyinFE/semi-design/pull/2997)
- 【Feat】
    - Added AI Token and AI ICON [#2997](https://github.com/DouyinFE/semi-design/pull/2997)
    - Added colorful API to Tag/Button [#2997](https://github.com/DouyinFE/semi-design/pull/2997)

#### 🎉 2.87.1 (2025-10-16)
- 【Fix】
    - Fixed an issue in Chrome V140 and 141 where an error would occur when expanding Tree/TreeSelect after collapsing it [#3005](https://github.com/DouyinFE/semi-design/issues/3005)
    - Fixed the issue where the Collapsible animation did not work in some Chrome versions 140 and 141. [#3006](https://github.com/DouyinFE/semi-design/pull/3006)

#### 🎉 2.87.0 (2025-10-15)
- 【Style】
    - Dropdown, Modal, SideSheet, Popover, Tooltip add backdrop-filter to set related tokens [#2981](https://github.com/DouyinFE/semi-design/issues/2981)

#### 🎉 2.87.1 (2025-10-16)
- 【Fix】
    - Fixed an issue in Chrome V140 and 141 where an error would occur when expanding Tree/TreeSelect after collapsing it [#3005](https://github.com/DouyinFE/semi-design/issues/3005)
    - Fixed the issue where the Collapsible animation did not work in some Chrome versions 140 and 141. [#3006](https://github.com/DouyinFE/semi-design/pull/3006)

#### 🎉 2.87.0 (2025-10-15)
- 【Style】
    - Dropdown, Modal, SideSheet, Popover, Tooltip add backdrop-filter to set related tokens [#2981](https://github.com/DouyinFE/semi-design/issues/2981)

#### 🎉 2.87.0-beta.0 (2025-09-08)
- 【Fix】
    - JsonViewer keyboard events are compatible with window [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)

#### 🎉 2.86.0 (2025-09-01)
- 【Fix】
    - Fixed folding model initialization issue [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2972](https://github.com/DouyinFE/semi-design/pull/2972)
    - Fixed the problem of missing prefix JsonViewer style when custom theme is passed in [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2926](fix: resolve jsonviewer dsm style loss issue by anjiazhuyouxing · Pull Request #2926 · DouyinFE/semi-design)
    - Fixed an issue where the content of a multi-select, searchable Cascader was not correctly ellipsised when the content was too long [#2967](https://github.com/DouyinFE/semi-design/issues/2967) [#2970](Fix/2967 by YyumeiZhang · Pull Request #2970 · DouyinFE/semi-design)
    - Fixed an issue where the content of a draggable tag in a TagInput was not correctly ellipsised when the content was too long [#2970](Fix/2967 by YyumeiZhang · Pull Request #2970 · DouyinFE/semi-design)
    - Fixed the issue where clicking on TreeSelect when it is disabled would cause unexpected focus style issues [#2968](https://github.com/DouyinFE/semi-design/issues/2968)
- 【Style】
    - Add a background color token for disabled TagInput, $color-tagInput_disabled-bg [#2973](https://github.com/DouyinFE/semi-design/pull/2973)

#### 🎉 2.86.0-beta.0 (2025-08-19)
- 【Fix】
    - Fixed InputNumber component filtering currency/internal parameters when passing props through to avoid defaultCurrency and other polluting native DOM properties.

#### 🎉 2.85.0 (2025-08-11)
- 【Fix】
    - fix the issue that the style of the light theme badge does not meet expectations when used alone [#2929](https://github.com/DouyinFE/semi-design/issues/2929) [#2930](https://github.com/DouyinFE/semi-design/pull/2930)
    - Fixed the problem that AutoComplete did not highlight matching items when searching after data update [#2952](https://github.com/DouyinFE/semi-design/pull/2952)
    - Fixed the problem of no hover background color when the fixed column in Table is hovered, affecting version 2.79.0-2.84.0 [#2953](https://github.com/DouyinFE/semi-design/pull/2953)

#### 🎉 2.85.0-beta.0 (2025-08-05)
- 【Feat】
    - Input and TextArea adds callback function for onCompositionStart/onCompositionEnd/onCompositionUpdate [#2922](https://github.com/DouyinFE/semi-design/pull/2922)
    - webpack and rspack plugins in semi add built-in silenceDeprecations options ('import', 'legacy-js-api', 'global-builtin') to sass-loader to silence sass-related deprecation warnings [#2944](https://github.com/DouyinFE/semi-design/pull/2944)
    - Image component add renderCloseIcon/renderLeftIcon/renderRightIcon API [@rubbishmaker](https://github.com/rubbishmaker)[#2919](https://github.com/DouyinFE/semi-design/pull/2919)
- 【Fix】
    - Fixed the issue that tooltip has updateState warning in some scenarios [#2682](https://github.com/DouyinFE/semi-design/issues/2682)
    - fixed the error message display issue [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)[#2943](https://github.com/DouyinFE/semi-design/pull/2943)


#### 🎉 2.84.0 (2025-07-29)
- 【Fix】
    - fix the problem that InputNumber calculation is incorrect due to js precision
    - fixed the problem that the handle position of Slider is incorrect when clicking or dragging under scrollable conditions
- 【Style】
    - Fixed the issue that the close icon of a tag with type solid and color white has incorrect color

#### 🎉 2.84.0-beta.0 (2025-07-21)
- 【Fix】
    - fix collapsible Tabs causing abnormal scrolling behavior of pages not triggered within the viewport
- 【Feat】
    - Supports configuring global Spin indicators, Added $animation_duration-button_icon_loading, $animation_duration-button_icon_customIcon_loading design token used to configure the animation duration of different types of loading in the button  [#2695 ](https://github.com/DouyinFE/semi-design/issues/2695)

#### 🎉 2.83.0 (2025-07-14)
- 【Fix】
    - Fixed the error problem of JsonViewer continuing to delete after selecting all [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fixed the error problem of JsonViewer initial cursor deletion behavior [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fixed the JsonViewer selection boundary problem [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fixed the JsonViewer code completion cannot be clicked [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fixed the JsonViewer code completion Boolean type prompt problem [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fixed the JsonViewer drag selection copy deletion incomplete problem [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fix the problem that the height setting in Modal does not take effect, affecting version 2.82.0-2.82.1  [#2899 ](https://github.com/DouyinFE/semi-design/issues/2899)

#### 🎉 2.83.0-beta.0 (2025-07-09)
- 【Style】
    - Fix the style problem of BreadCrumb's item in noLink mode [#2883](https://github.com/DouyinFE/semi-design/issues/2883)

#### 🎉 2.82.1 (2025-07-02)
- 【Fix】
    - Fix the problem that Modal does not cover the entire screen when fullScreen is true. Affected version: v2.82.0 [#2880](https://github.com/DouyinFE/semi-design/issues/2880)
- 【Style】
    - When the length of the placeholder of the Input exceeds the length, the content exceeding the length will be omitted [#2869](https://github.com/DouyinFE/semi-design/issues/2869)


#### 🎉 2.82.0 (2025-06-27)
- 【Style】
    - Fixed the problem that when Select is in multiple/small size, if the token of border is not set to 1, the minimum height will be incorrect. Abandon the default size minimum width setting token $height-select_multiple_content_wrapper-minHeight  [#2877](https://github.com/DouyinFE/semi-design/issues/2877)[#2878](https://github.com/DouyinFE/semi-design/pull/2878)


#### 🎉 2.82.0-beta.0 (2025-06-23)
- 【Feat】
    - Modal supports modalRender parameter to customize rendering [#2655](https://github.com/DouyinFE/semi-design/issues/2655)
- 【Fix】
  - fix the issue that DatePicker cannot automatically scroll to non-disabled items when clicking on the month in monthRange and multi-language  [#2870](https://github.com/DouyinFE/semi-design/issues/2870) [#2871](https://github.com/DouyinFE/semi-design/pull/2871)

#### 🎉 2.81.0 (2025-06-16)
- 【Fix】
    - Fixed the problem that when maxLength and getValueLength are set at the same time in the Input、TextArea  component, the Chinese input will be truncated before the input is completed  [#2858](https://github.com/DouyinFE/semi-design/issues/2858)
- 【Style】
    - For range-type DatePicker, increase the priority of the input background color set in the hover/active state [#2856](https://github.com/DouyinFE/semi-design/pull/2856)
- 【Design Token】
    - Add $color-button_disabled_outline_text-default to set the disabled state text color of Button in outline mode  [#2861](https://github.com/DouyinFE/semi-design/issues/2861) 


#### 🎉 2.81.0-beta.0 (2025-06-10)
- 【Style】
    - Adjust the height of the input-wrapper layer in the range type DatePicker to center the content
- 【Fix】
    - Modify the timing of getting the container's position in Tooltip to improve the performance of component initialization


#### 🎉 2.80.0 (2025-05-19)
- 【Fix】
    - Fixed the display problem of cascader with single selection, controlled value and value undefined, asynchronous loading, and showNext set to hover when loading multiple projects at the same time.  [#2831](https://github.com/DouyinFE/semi-design/issues/2831)  [#2832](https://github.com/DouyinFE/semi-design/pull/2832)

#### 🎉 2.80.0-beta.0 (2025-05-14)
- 【Feat】
    - add VideoPlayer component support

#### 🎉 2.79.0 (2025-05-08)
- 【Feat】
    - Upload Added a pop-up file name prompt function when the file name is too long [@yatbfm](https://github.com/yatbfm)
- 【Fix】
    - Fix Switch component loading and disabled state hover style issue [@LonelySnowman](https://github.com/LonelySnowman)
    - Fixed the issue that when the Table component sets the header background color through style in onHeaderCell, the fixed header does not take effect [#2814](https://github.com/DouyinFE/semi-design/issues/2814)
- 【Style】
    - Dropdown adds $radius-dropdown_item token to set the radius of each option in the panel [#2817](https://github.com/DouyinFE/semi-design/pull/2817)
    - Add overflow: hidden style setting to the outermost layer of ScrollList [#2818](https://github.com/DouyinFE/semi-design/pull/2818)
    - Fixed the problem that the color of the checkbox inside the selected Checkbox component is not controlled by the correct token when it is in the hovering state. [#2819](https://github.com/DouyinFE/semi-design/pull/2819)
    - Added $color-radio_checked-icon-disabled token to allow users to configure the origin color of the Radio in the selected and disabled states [#2820](https://github.com/DouyinFE/semi-design/pull/2820)
- 【Chore】
   - The web components loader of the Webpack/Rspack plugin adds style insertion support for other components. The added components are AudioPlayer, Chat, CodeHighlight, ColorPicker, Cropper, HotKeys, JsonViewer, MarkdownRender, PinCode, Resizable, UserGuide, ButtonGroup, SplitButton, List, and TimePicker.[#2812](https://github.com/DouyinFE/semi-design/pull/2812)
    - Throws a warning when the Tree component key is incorrectly passed as a number [@LonelySnowman](https://github.com/LonelySnowman) [#2773](https://github.com/DouyinFE/semi-design/pull/2773)


#### 🎉 2.79.0-beta.0 (2025-04-23)
- 【Style】
    - Modify the implementation of background color and progress color in Progress to ensure that the design theme configuration takes effect [#2808](https://github.com/DouyinFE/semi-design/pull/2808)
    - Fixed the problem that the width of the Chat content area was stretched by the table in the content, and the scrolling area was the entire content. After modification, the scrolling area is inside the table [#2776](https://github.com/DouyinFE/semi-design/issues/2776)
- 【Design Token】
    - Chat adds $width-chat_chatBox_avatar to set avatar width [#2775](https://github.com/DouyinFE/semi-design/pull/2775)
    - Added Cascader padding token settings in large/small sizes, including $spacing-cascader_small_selection-paddingLeft, $spacing-cascader_small_selection-paddingRight, etc. [#2809](https://github.com/DouyinFE/semi-design/pull/2809)
    - Added font setting tokens for Button in small/large sizes, including $font-button_small-fontSize, $font-button_small-lineHeight, $font-button_small-fontWeight, etc. [#2809](https://github.com/DouyinFE/semi-design/pull/2809)
    - Modify the implementation of the background color and border color of the arrow in Popover to ensure that the background color and border color of the arrow in Popover can be modified through the theme configuration in DSM configuration, Added two arrow-related tokens: $color-popover-arrow-border and $color-popover-arrow-bg. [#2806](https://github.com/DouyinFE/semi-design/pull/2806)
    - Added inputNumber stepper rounded corner token $radius-inputNumber_inner in innerButton mode [#2809](https://github.com/DouyinFE/semi-design/pull/2809)
- 【Fix】
    - Fixed the problem that when the hot area for sorting is the entire table header, an unexpected sorting problem will be triggered after the expansion is completed.  [#2802](https://github.com/DouyinFE/semi-design/issues/2802)

#### 🎉 2.78.0 (2025-04-08)
- 【Fix】
    - A fallback operation to avoid TypeError when target does not exist in BackTop component
    - Fixed the issue that markdownRenderProps did not take effect when parsing text in Chat when the content of the message is an array
    - fix the issue that Collapse Tabs cannot scroll activeTab into the viewport when first loaded
- 【Style】
    - Fixed the problem that the header cells with sorting in Table flicker when switching between light and dark
- 【Design Token】
    - ScrollList adds $color-scrollList_header-bg to control header color

#### 🎉 2.78.0-beta.0 (2025-04-01)
- 【Feat】
    - Cropper adds preview API to support real-time preview of cropping effects  [#2783](https://github.com/DouyinFE/semi-design/issues/2783)
#### 🎉 2.77.0 (2025-03-25)
- 【Fix】
    - Fixed the issue of click-through when the UserGuide is in the bubble mode [#2764](https://github.com/DouyinFE/semi-design/pull/2764)
    - Fixed the problem that the icon in the header of the Navigation is not centered in the collapsed mode.  [#2675](https://github.com/DouyinFE/semi-design/issues/2675)
    - Fixed the problem that the search box of JsonViewer does not support i18n multilingual adaptation. [#2766](https://github.com/DouyinFE/semi-design/pull/2766)
    - Fixed the problem of long text folding when the auto-wrap function of JsonViewer is not enabled, and fixed the issue of line number display. [#2756](https://github.com/DouyinFE/semi-design/pull/2756)

#### 🎉 2.77.0-beta.0 (2025-03-18)
- 【New Component】
    - support new component UserGuide
- 【Feat】
    - InputNumber supports currency mode
- 【Fix】
    - fix MarkdownRender table duplicate column elements when header containing more than two components or bold texts [@ByteLan](https://github.com/ByteLan)
    - Correct locale codes for Netherlands, Poland and Sweden (nl_NL -> nl-NL, pl_PL -> pl-PL, sv_SE -> sv-SE)

#### 🎉 2.76.1 (2025-03-17)
- 【Style】
    - Style: For input type components, the styles of insetLabel and prefix remain consistent. Removed unnecessary tokens related to insetLabel, Added $font-cascader_prefix_suffix_fontWeight, $spacing-input_prefix_suffix-marginX, $font-input_prefix_suffix-fontWeight, $font-select_prefix_suffix-fontWeight, $spacing-tagInput_prefix_suffix-marginX, $font-tagInput_prefix_suffix-fontWeight, $font-treeSelect_prefix_suffix_fontWeight to manage prefix and suffix weights and margins.[#2752](https://github.com/DouyinFE/semi-design/issues/2752)

#### 🎉 2.76.0 (2025-03-07)
- 【Fix】
    - Fix JsonViewer type error issue [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2748](https://github.com/DouyinFE/semi-design/pull/2748)

#### 🎉 2.76.0-beta.0 (2025-03-04)
- 【Feat】
    - Chat supports enableUpload API to support users to set upload behavior  [#2735](https://github.com/DouyinFE/semi-design/issues/2735)
    - Allow RadioGroup options passing addonStyles/addonClassName/addonId/extraId option to Radio component [@SaltyfishEd](https://github.com/SaltyfishEd)
    - JsonViewer adds custom rendering function [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
- 【Fix】
    - Nav adds a new selector style to provide hover style for renderWrapper scenes
    - adjust jsonviewer search box popup positioning [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - fix when TimePicker does not fill in the default value, users in different time zones open the template and select different default values
    - fix the problem that Nav.item does not prompt ts error when passing non-recommended attribute Children
- 【Style】
    - Style: Fixed the issue of incorrect spacing between action buttons in the Chat component's dialog box (affected versions 2.71.1-2.75.0)
    - Modify Cascader's default empty data display style to be consistent with TreeSelect/Select  [#2703](https://github.com/DouyinFE/semi-design/issues/2703)

#### 🎉 2.75.0 (2025-02-21)
- 【Design Token】
    - Select adds $color-select_prefix_suffix_text-default, Cascader adds $color-cascader_prefix_suffix_text-default, and TreeSelect adds $color-treeSelect_prefix_text-default to control the prefix and suffix colors. In addition, keep the font-size and font-weight settings of the prefix and suffix consistent with the settings of insetLabal (**Note: There are changes in styles before and after modification**)  [#2721](https://github.com/DouyinFE/semi-design/issues/2721)
- 【Fix】
    - Fixed the bug where the accessibility rendering of aria attributes in Chrome v133 caused Chrome to crash after clicking the month selector of the DatePicker [#2723](https://github.com/DouyinFE/semi-design/pull/2723)
    - Fixed the issue that Resizable could not be used on touchscreens [#2697](https://github.com/DouyinFE/semi-design/issues/2697) [#2712](https://github.com/DouyinFE/semi-design/pull/2712)
    - Removed the use of the outdated React syntax ReactDOM.render() in Typography and replaced it with other methods to clear the container used for testing the appropriate ellipsis length  [#2699](https://github.com/DouyinFE/semi-design/issues/2699)
    - Fixed the problem that when using formApi.scrollToField in Form, if there are multiple Forms on the page and the fields have the same name, only the DOM of the first field with the same name can be scrolled to [#2719](https://github.com/DouyinFE/semi-design/pull/2719)
    - Fixed the problem that when only extraText is configured in Form.InputGroup and extraPosition is not configured, extraText cannot be displayed correctly [#2719](https://github.com/DouyinFE/semi-design/pull/2719)
- 【Chore】
    - Fix the problem of the TypeScript type definition error of Form formApi.scrollToError.[#2719](https://github.com/DouyinFE/semi-design/pull/2719)


#### 🎉 2.75.0-beta.1 (2025-02-19)
- 【Docs】
    - List component drag demo updated to use dnd-kit
- 【Feat】
    - add renderPicClose to custom close icon under listType picture
    - Tree/TreeSelect supports expandIcon API for customizing the expand icon  [#2704](https://github.com/DouyinFE/semi-design/issues/2704)
- 【Fix】
    - Fixed the problem that Pagination's page capacity switcher cannot switch languages ​​correctly in multi-language scenarios  [#2696](https://github.com/DouyinFE/semi-design/issues/2696)
    - fix iOS input interruption in PinCode component with format='number' (switches from number/character to letter keyboard after input a digit) [@SaltyfishEd](https://github.com/SaltyfishEd)


#### 🎉 2.74.0 (2025-02-07)
- 【Fix】
    - Fix the issue where the List component's dataSource is empty and it is covered by the Spin component. [@LonelySnowman](https://github.com/LonelySnowman)
    - Fix the TypeError when closing the panel of the TreeSelect component when search is enabled and treeData is undefined
    - fixed the issue that the Steps icon and title of type basic were not centered with the line  [#2688 ](https://github.com/DouyinFE/semi-design/issues/2688)
    - Fixed the problem that after the single-select and searchable Select loses focus when the panel is open, it cannot be focused again by clicking the trigger.
    - Fixed the white edge issue of the AudioPlayer speed pop-up box style [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - The internal ref usage of the AudioPlay component is modified to be compatible with other frameworks [@rashagu](https://github.com/rashagu)

#### 🎉 2.74.0-beta.0 (2025-01-20)
- 【Feat】
  - The Chat component supports the markdownRenderProps API, which is used to set the MarkdownRender component for message rendering.  [#2640 ](https://github.com/DouyinFE/semi-design/issues/2640)
- 【Fix】
  - fixed the issue that the lowercase z input in JsonViewer is invalid [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)

#### 🎉 2.73.0 (2025-01-13)
- 【Fix】
    - Fix the problem that JsonViewer is not configured with default parameters [@anjiazhuyouxing](https://github.com/anjiazhuyouxing)
    - Fix JsonViewer the judgment condition for whether to re-init. [@rashagu](https://github.com/rashagu)

#### 🎉 2.73.0-beta.0 (2025-01-07)
- 【New Component】
    - Added audio player component [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2650](https://github.com/DouyinFE/semi-design/pull/2650)
    - Added Cropper component [#2642](https://github.com/DouyinFE/semi-design/pull/2642)
- 【Feat】
    - Added read-only mode to JsonViewer [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2658](https://github.com/DouyinFE/semi-design/pull/2658)
    - JsonViewer supports hidden search icon [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2658](https://github.com/DouyinFE/semi-design/pull/2658)
    - JsonViewer adds Json format error information prompt function [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2638](https://github.com/DouyinFE/semi-design/pull/2638)
    - JsonViewer Core package hot update problem [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2638](https://github.com/DouyinFE/semi-design/pull/2638)
- 【Fix】
    - Fix the cursor problem when clicking on the non-content area of ​​JsonViewer [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2658](https://github.com/DouyinFE/semi-design/pull/2658)
    - Fix JsonViewer cursor problem after automatic indentation [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2658](https://github.com/DouyinFE/semi-design/pull/2658)
    - Fix the missing content problem after JsonViewer folding [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2658](https://github.com/DouyinFE/semi-design/pull/2658)
    - Fix the Chinese input method input problem in the JsonViewer search box [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2651](https://github.com/DouyinFE/semi-design/pull/2651)
    - Fix the JsonViewer Undo&Redo text model out of sync problem [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2638](https://github.com/DouyinFE/semi-design/pull/2638)
    - After setting the handler in DragMove, the child elements of DragMove can still be dragged [#2661](https://github.com/DouyinFE/semi-design/issues/2661) [#2662](https://github.com/DouyinFE/semi-design/pull/2662)
    - Fixed the display problem of Loading when there is no Spin component in the project of Button [#2664](https://github.com/DouyinFE/semi-design/pull/2664)
- 【Chore】
    - JsonViewer refactors the underlying data structure of the folding model [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2658](https://github.com/DouyinFE/semi-design/pull/2658)
    - Add JsonViewer E2E test [@anjiazhuyouxing](https://github.com/anjiazhuyouxing) [#2626](https://github.com/DouyinFE/semi-design/pull/2626)

#### 🎉 2.72.2 (2025-01-06)
- 【Fix】
    - Fix the problem that Cascader's placeHolder and searchPlaceholder cannot be updated dynamically

#### 🎉 2.72.1 (2025-01-02)
- 【Fix】
    - Fixed the problem of Typography’s JS omitting calculation error when display is none [#2656](https://github.com/DouyinFE/semi-design/pull/2656)

#### 🎉 2.72.0 (2024-12-20)
- 【Fix】
  - Fix the problem of JsonViewer using Chinese input method incorrectly [#2616](https://github.com/DouyinFE/semi-design/pull/2616)
  - Fix The problem that the code prompt box cannot be hidden when clicked [#2616](https://github.com/DouyinFE/semi-design/pull/2616)
  - Fixed the rendering problem caused by multiple carriage returns [#2616](https://github.com/DouyinFE/semi-design/pull/2616)
  - Fixed the abnormal display of the scroll bar [#2623](https://github.com/DouyinFE/semi-design/pull/2623)

#### 🎉 2.72.0-beta.0 (2024-12-16)
- 【Feat】
    - Table onChange add extra.changeType API to idetify the type of changing  [#1238](https://github.com/DouyinFE/semi-design/issues/1238)
- 【Fix】
    - fix render state value in Carousel children always get the init one

#### 🎉 2.71.3 (2024-12-17)
- 【Fix】
    - Fixed the problem of incorrect onChange callback result in Tree component treeDataSimpleJson mode  [#2508 ](https://github.com/DouyinFE/semi-design/issues/2508)
    - fixed the issue that the display of disabled subNavItem in vertical Navigation does not meet expectations when it is collapsed

#### 🎉 2.71.2 (2024-12-13)
- 【Fix】
    - Remove redundant calculations to determine whether the properties have changed when the Collapsible component is updated. [#2631](https://github.com/DouyinFE/semi-design/pull/2631)
    - Fixed the issue where in react18, regardless of whether animation is on or not, when the mouse is quickly moved over the tooltip trigger, the DOM would become transparent but not disappear, causing the page element to be unclickable [#2605](https://github.com/DouyinFE/semi-design/pull/2605)
    - Fixed the problem that the dynamic mode change of the Chat component did not take effect [#2625](https://github.com/DouyinFE/semi-design/pull/2625)
    - Set the max-width of the img node of the image preview to none to avoid enlargement display errors when using tailwind at the same time. [#2624](https://github.com/DouyinFE/semi-design/pull/2624)

#### 🎉 2.71.1 (2024-12-11)
- 【Feat】
    - Button icon mode add $height-button_iconOnly_small $width-button_iconOnly_small $height-button_iconOnly_default $width-button_iconOnly_default $height-button_iconOnly_large $width-button_iconOnly_large token [#2618](https://github.com/DouyinFE/semi-design/pull/2618)

#### 🎉 2.71.0 (2024-12-06)
- 【Fix】
    - For invisible Tooltips, position calculation is not performed when resizing [#2606](https://github.com/DouyinFE/semi-design/pull/2606)

#### 🎉 2.70.2 (2024-12-04)
- 【Fix】
    - Fixed the issue that when the Datepicker type is monthRange, the default selected year and month in the panel cannot be selected across the year

#### 🎉 2.71.0-beta.0 (2024-12-02)

- 【New Component】
    - Add `DragMove` Component，Change the positioning by dragging. [#2595](https://github.com/DouyinFE/semi-design/pull/2595)
    - Add `JsonViewer` Component，support the display and editing of JSON data at the million-line level. [#2561](https://github.com/DouyinFE/semi-design/pull/2561)
- 【Feat】
    - Table added shouldCellUpdate API, which is used to customize whether cells need to be re-rendered or not. [#2584](https://github.com/DouyinFE/semi-design/pull/2584)
    - Cascader supports the checkRelation API for setting the relevance of options  [#2582](https://github.com/DouyinFE/semi-design/issues/2582)
    - Highlight supports using different highlight styles for different keywords [#2600](https://github.com/DouyinFE/semi-design/pull/2600)
    - `@douyinfe/semi-icons-lab` add new color icons： IconChart、IconChat、IconCodeHighlight、IconLottie、IconMarkdown、IconPincode、IconVersionOne、IconWebComponents、IconJsonViewer [#2583](https://github.com/DouyinFE/semi-design/pull/2583)
- 【Chore】
    - The digital precision of the SVG path in `@douyinfe/semi-icons` has been modified, keeping two decimal places. The volume of the minimized package for all icons has been reduced from 450 kb to 278 kb [#2583](https://github.com/DouyinFE/semi-design/pull/2583)
    - The digital precision of the SVG path in `@douyinfe/semi-illustrations` has been modified, keeping two decimal places. The volume of the minimized package for all icons has been reduced from 283k -> 165k [#2602](https://github.com/DouyinFE/semi-design/pull/2602)
    - Fixed type error reporting for the Lottie component [#2593](https://github.com/DouyinFE/semi-design/pull/2593)
- 【Perf】
    - The logic related to Select's renderOption will be postponed until after the candidate options are displayed. Reduce unnecessary rendering. [#2598](https://github.com/DouyinFE/semi-design/issues/2598)
- 【Fix】
    - Fixed the problem of incorrect ellipsis calculation when the width of `Typography` with ellipsis in JavaScript is not set. [#2591](https://github.com/DouyinFE/semi-design/issues/2591)
    - Fix the error reporting of the `table` in `MarkdownRender` when the syntax of some markdown content is incorrect, and add a fallback attempt. [#2590](https://github.com/DouyinFE/semi-design/pull/2590)


#### 🎉 2.70.1 (2024-11-25)
- 【Fix】
    - Fixed the problem that the URL of the file attachment in the Chat component's dialog box was incorrect, causing the file to fail to open when clicking on the file [#2589](https://github.com/DouyinFE/semi-design/pull/2589)

#### 🎉 2.70.0 (2024-11-22)
- 【Fix】
    - Fixed an issue where the placement area was incorrectly displayed when dragging the internal files of the Chat component [#2569](https://github.com/DouyinFE/semi-design/issues/2569)

#### 🎉 2.70.0-beta.0 (2024-11-18)
- 【Fix】
    - When all items except the disabled item in the left panel of transfer are selected, the operation button should display Cancel all selections  [#2575](https://github.com/DouyinFE/semi-design/issues/2575)
    - fix resizeItem size offset caused by float，invalid min/max setting caused by browser resizing and incorrect behavior in react strictMode  [@Nathon2Y](https://github.com/Nathon2Y)
    - Fix the problem that the placeholder of TreeSelect is blocked when single selection and search box are in trigger,  affecting versions v2.61.0 - 2.69.0
- 【Feat】
    - direction in ResizeGroup can be dynamic [@Nathon2Y](https://github.com/Nathon2Y)
    - MarkdownRender adds the remarkGfm switch to prevent errors reported by lower versions of Safari that do not support lookaround assertions

#### 🎉 2.69.2 (2024-11-19)
- 【Fix】
    - Fixed the problem that the covered content will be revealed in the table header that can be clicked to trigger sorting，Affected versions 2.65.0-2.69.1

#### 🎉 2.69.1 (2024-11-15)
- 【Fix】
    - fix the issue that MonthRange DatePicker does not jump when clicking on a non-disabled year when there is a disabledDate
    - Fixed the problem that when ArrayField is conditionally rendered, the first click of add fails to add rows correctly.
    - fixed incorrect translation of Table pageText in Japanese scenarios

#### 🎉 2.69.0 (2024-11-08)
- 【Fix】
    - The clip-rule & stroke-width in the @douyinfe/semi-illustrations package are modified to clipRule & strokeWidth

#### 🎉 2.69.0-beta.0 (2024-11-04)
- 【Feat】
    - In Chat's custom rendering message box, renderChatBoxAvatar adds message parameter. [#2557](https://github.com/DouyinFE/semi-design/pull/2557)
    - Add defaultActionsObj parameter to renderChatBoxContent in Chat's custom rendering session box to reveal detailed node parameter information [#2557](https://github.com/DouyinFE/semi-design/pull/2557)
    - Chat's custom rendering input box adds the detailProps parameter to transmit detailed node parameter information [#2557](https://github.com/DouyinFE/semi-design/pull/2557)
    - Navigation adds subDropdownProps support [#2555](https://github.com/DouyinFE/semi-design/pull/2555)
- 【Fix】
    - Fixed a TypeError in Chat's message comparison logic when the previous and later messages are different empty arrays [#2557](https://github.com/DouyinFE/semi-design/pull/2557)

#### 🎉 2.68.4 (2024-11-04)
- 【Fix】
    - Fixed the issue with Chat Foundation where the React-specific event.persist call causes compatibility problems with adapters for other frameworks. [#2543](https://github.com/DouyinFE/semi-design/pull/2543) [@rashagu](https://github.com/rashagu)
- 【Style】
    - Fixed the issue where the placeholder opacity is incorrect after clicking the clearIcon and losing focus when both filter and showClear are enabled in Select. [#2547](https://github.com/DouyinFE/semi-design/pull/2547)
    - Modified the align-items property of the Chat component styles from start/end to flex-start/flex-end to avoid potential CSS compilation warnings in some projects. [2546](https://github.com/DouyinFE/semi-design/pull/2546)

#### 🎉 2.68.3 (2024-10-23)
- 【Fix】
    - Fixed the issue of incorrect option text display after clicking the expand button in the search state when `keyMaps` is set for `TreeSelect`.[#2541](https://github.com/DouyinFE/semi-design/pull/2541) 

#### 🎉 2.68.2 (2024-10-21)
- 【Fix】
    - fix `$z-resizable_handler` token undefined issue, affecting versions v2.68.0-beta.0 - 2.68.1  [#2539](https://github.com/DouyinFE/semi-design/issues/2539) 

#### 🎉 2.68.0 (2024-10-18)
- 【Fix】
    - fix IllustrationFailure and IllustrationNoContent curves are not completely closed in light mode
    - fixed Table typings not work bug caused by react-window dependency  [#2477](https://github.com/DouyinFE/semi-design/issues/2477)

#### 🎉 2.68.0-beta.0 (2024-10-16)
- 【New Component】
    - Added a resizable box component that adjusts its size based on user mouse drag actions. **Component adds Token `z-resizable_handler` (if the user uses a custom theme, they need to republish the theme to obtain the token)**[@Nathon2Y](https://github.com/Nathon2Y) [#2458](https://github.com/DouyinFE/semi-design/pull/2458)
- 【Feat】
    - Datepicker's onClickoutSide adds event parameter [#2531](https://github.com/DouyinFE/semi-design/pull/2531)
    - Cascader adds expandIcon API to support user-defined expansion icons  [#2513](https://github.com/DouyinFE/semi-design/issues/2513)

#### 🎉 2.67.2 (2024-10-16)
- 【Fix】
    - Fixed the phenomenon that the background color does not match expectations in some special theme package configurations when Select disabled and focus is disabled [#2532](https://github.com/DouyinFE/semi-design/pull/2532)
    - fix icon Spin uses a fixed id, resulting in an unexpected display in Tabs [#2526](https://github.com/DouyinFE/semi-design/pull/2526)
    - Fixed the issue of incorrect width of Cascader panel icon, affecting versions 2.67.0～2.67.1 [#2529](https://github.com/DouyinFE/semi-design/pull/2529)
- 【Design Token】
    - Select add token： `$color-select_input_disabled-border-focus`、`$color-select_input_disabled-border-focus`
     - Newly added $width-cascader-option-icon is used to represent the width of the icon in the panel[#2529](https://github.com/DouyinFE/semi-design/pull/2529)

#### 🎉 2.67.1 (2024-10-11)
- 【Fix】
    - Fixed the issue that after closing the Select popup using the close method, clicking the outer area cannot remove the focus style
    - Fixed Datepicker selected value does not show when value is controlled （affects v2.64 ~ v2.67）  [#2521](https://github.com/DouyinFE/semi-design/issues/2521)
    - Fixed the issue that Rspack plugin does not work on win32 platform

#### 🎉 2.67.0 (2024-09-27)
- 【Fix】
    - Fix Typography error in omitting calculation when the strong attribute is true [@pandoralink](https://github.com/pandoralink) [#2506](https://github.com/DouyinFE/semi-design/pull/2506)

#### 🎉 2.67.0-beta.0 (2024-09-23)
- 【Feat】
    - Form adds onErrorChange callback [#2484](https://github.com/DouyinFE/semi-design/pull/2484)
    - Feat: The Chat component supports custom rendering of dividing lines through renderDivider [#2471](https://github.com/DouyinFE/semi-design/issues/2474)
- 【Fix】
    - Fixed the issue where onChange does not trigger in PinCode in uncontrolled mode [#2509](https://github.com/DouyinFE/semi-design/pull/2509)
    - fix the issue where onChange does not trigger when PinCode value is empty string [#2502](https://github.com/DouyinFE/semi-design/issues/2502) [@koderx](https://github.com/koderx)
    - Fixed AutoComplete option when more than one page, when using keyboard ArrowUp, ArrowDown switch can not automatically scroll to view issue [#1530](https://github.com/DouyinFE/semi-design/issues/1530)
    - Fix the problem that the case of the child component className of AutoComplete is inconsistent with the parent component, and the consistent is changed to lowercase (`.semi-autoComplete-option` - > `.semi-autocompelte-option`)[#2501](https://github.com/DouyinFE/semi-design/pull/2501)
    - Modify the behavior of Cascader, TreeSelect when emptyContent is null, consistent with Select [#2476](https://github.com/DouyinFE/semi-design/pull/2476)
    - Fixed the issue that Select fails to automatically scroll to view after using the keyboard up and down keys to select options when using IrenderOptionItem [#2263](https://github.com/DouyinFE/semi-design/issues/2263)
    - Fixed Upload in React StrictMode request can not be post correctly (impact v2.64.0-2.66.1) [#2410](https://github.com/DouyinFE/semi-design/issues/2410)
    - Fixed the problem that when Cascader has suffix and showClear is set, the position of the clear icon and the position of the clear icon are different [#2493](https://github.com/DouyinFE/semi-design/pull/2493)
- 【Style】
    - Modify the image display in the Chat component chat box and the uploaded image display effect in the input box, from filling to maintaining width-to-height ratio filling (object-fit from fill -> cover), prevent image deformation [#2496](https://github.com/DouyinFE/semi-design/pull/2496)
    - Keep the content area and icon spacing in Cascader's trigger consistent with select/treeSelect  [#2472](https://github.com/DouyinFE/semi-design/issues/2472)
    - Fixed the issue where the style of Cascader panel options does not meet expectations in rtl mode [#2475](https://github.com/DouyinFE/semi-design/pull/2475)
    - Modify the unreasonable naming of style names in Cascader, undisabled -> enable [#2494](https://github.com/DouyinFE/semi-design/pull/2494)
    - Modify the problem that when suffix is ​​set in Select, the positional relationship between the suffix and the drop-down icon is not consistent with TreeSelect/Cascader. (If you have other position requirements, you can adjust the position by setting the order attribute of flex) [#2493](https://github.com/DouyinFE/semi-design/pull/2493)
    - Fixed the problem that the rounded corners of InputNumber, DatePicker, Time Pick, and AutoComplete located in the middle of the InputGroup are not 0 [#2489](https://github.com/DouyinFE/semi-design/issues/2489)

#### 🎉 2.66.1 (2024-09-12)
- 【Fix】
  - Optimized Datepicker Copywriting in Malay (ms_MY), Russian(ru_RU), Vietnamese(vi_VN), Arabic(ar) Monday - Sunday. Optimize the display of text in Japanese, Indonesian, and Vietnamese in the lower left corner of the Table. [#2486](https://github.com/DouyinFE/semi-design/pull/2486)

#### 🎉 2.66.0 (2024-09-10)
- 【Fix】
  - Fixed the issue where the Tooltip quickly slides in and out when the animation is on, and the tooltip disappears normally but the dom is not unloaded
  - Fixed Upload addOnPasting in Sidesheet could not be uploaded  [#2478](https://github.com/DouyinFE/semi-design/issues/2478)
  - Fixed single-select Cascader, under React18, the expansion behavior is abnormal when loading data asynchronously  [#2212](https://github.com/DouyinFE/semi-design/issues/2212)
  - **Made some API tweaks for the Hotkeys component added in the previous Beta to make it more suitable for actual usage scenarios** [#2463](https://github.com/DouyinFE/semi-design/issues/2463)
- 【Chore】
  - Added ConfigConsumer export for manually obtaining ConfigProvider [#2468](https://github.com/DouyinFE/semi-design/pull/2468)
  - HotKeys adds static `Keys` property [@Nathon2Y](https://github.com/Nathon2Y) [#2463](https://github.com/DouyinFE/semi-design/pull/2463)


#### 🎉 2.66.0-beta.0 (2024-09-02)
- 【New Component】
    - create Hotkeys component，user can define shortcut key combinations and trigger callbacks. [@Nathon2Y](https://github.com/Nathon2Y)
- 【Feat】
    - Tabs add slash type
    - renderArrow of Tabs support defaultNode param
    - All types of Tabs support closable (previously only the card type supported closable)
    - Tabs supports setting dropdown parameters in collapsible mode through dropdownProps API
- 【Fix】
    - Fixed the issue that the error style was blocked in Form.Upload image wall mode
    - Fixed the issue that Collapse Tabs crashes when the tab is set to jsx (affected range: 2.65.0 )
    - Fixed the issue that Dropdown onVisibleChange reported an error when it was not defined in some scenarios
    - Fixed SyntaxError when parsing unescaped characters in Chat component message box
    - Fixed the issue where the Chat component scrolls the message list while the message is being updated streaming. The streaming update of message will cause the list to unexpectedly scroll to the bottom.
- 【Chore】
    - The size API type of Avatar and AvatarGroup has been changed to string #2443  [#2446](https://github.com/DouyinFE/semi-design/issues/2446)

#### 🎉 2.65.0 (2024-08-23)
- 【Fix】
    - Fixed the problem that when Slider is in range controlled mode, dragging one handle may cause another handle to shake [#2438](https://github.com/DouyinFE/semi-design/issues/2438)
    - Fixed the problem that when Slider is in range mode, the min handler can be dragged to the right of the max handler, accidentally swapping the two handlers [#2438](https://github.com/DouyinFE/semi-design/issues/2438)
    - Fixed the issue that Button is not vertically centered when icon is passed directly to children [#2402](https://github.com/DouyinFE/semi-design/issues/2402)
    - fix ui crash when render markdown data only  only includes heading definitions [#2436](https://github.com/DouyinFE/semi-design/pull/2436) [@tgz](https://github.com/tgz) 

#### 🎉 2.65.0-beta.0 (2024-08-20)
- 【Feat】
  - MarkdownRender now supports RemarkPlugin and RehypePlugins plugins. [#2433](https://github.com/DouyinFE/semi-design/pull/2433)
  - The renderLabel API of Tree and TreeSelect has added a searchWord parameter to expose the currently input value in the search box. [#2412](https://github.com/DouyinFE/semi-design/pull/2412)
  - Optimize the sorting interaction of Table. When there is only sorting function, click on the entire table header column to trigger sorting. Column supports the showSortTooltip API to set whether to display the tooltip, and the default is true [#2413](https://github.com/DouyinFE/semi-design/pull/2413)
  - Datepicker supports leftSlot and rightSlot. [@LuyangFE](https://github.com/LuyangFE) [#2409](https://github.com/DouyinFE/semi-design/pull/2409)
  - Typograph support custom render copy trigger [@sylingd](https://github.com/sylingd) [#2408](https://github.com/DouyinFE/semi-design/pull/2408)
- 【Perf】
  - Optimized the judgment times of getValueLength for Input and TextArea. [#2432](https://github.com/DouyinFE/semi-design/pull/2432)
- 【Chore】
  - The Image component interface supports native img element attributes. [#2427](https://github.com/DouyinFE/semi-design/pull/2427)
- 【Fix】
  - Fixed the type error after sending a message when the messages in Chat are an empty array. [#2411](https://github.com/DouyinFE/semi-design/pull/2411)
  - Fixed the incorrect problem of Table aria-level when tree data is empty. [#2359](https://github.com/DouyinFE/semi-design/issues/2359)
  - Fixed the incorrect disabling of arrows in Collapse Tabs when quickly clicking left and right arrows. [#2415](https://github.com/DouyinFE/semi-design/issues/2415)
  - Fixed the problem that when showStopGenerate of Chat component is true and the status of a message is error, the stop button is displayed. [#2422](https://github.com/DouyinFE/semi-design/pull/2422)
  - Fixed the problem that in Cascader, after searching and in multiple selection scenarios, the position of the pop-up layer is not recalculated, resulting in a long panel being blocked. [#2417](https://github.com/DouyinFE/semi-design/pull/2417)
  - Fixed the problem that in Cascader's multiple selection scenario, when unselecting by clicking the close icon of an existing option in the trigger, the position of the pop-up layer is not recalculated. [#2417](https://github.com/DouyinFE/semi-design/pull/2417)
  - Fixed the loss of the selected state color after clicking the selected date twice in DatePicker. [#2389](https://github.com/DouyinFE/semi-design/pull/2389)

#### 🎉 2.64.0 (2024-08-12)
- 【Fix】
  - Fix Tooltip triggerDOM not defined in some case  [commit](https://github.com/DouyinFE/semi-design/commit/05878dd7b7c20f2e924f8e0b3cf71ad0eaa3aaf3)

#### 🎉 2.64.0-beta.0 (2024-08-05)
- 【Feat】
    - Events with exactly the same start and end times in Calendar day view are displayed side by side without covering each other
    - Added the ColorPicker component, which allows users to quickly select colors and supports eyedropper screen color selection.
- 【Fix】
    - Fixed an issue where after the mouse wheel zoomed the picture, dragging the picture would reset to the center position after zooming again.[@l123wx](https://github.com/l123wx) [#2293](https://github.com/DouyinFE/semi-design/pull/2293)
    - fix modal 'document not defined' in ssr. (Bug version 2.62.0~2.63.0)
    - fixed DatePicker selected value is not reset after close panel  [#2387](https://github.com/DouyinFE/semi-design/issues/2387)
    - When the searchRender of the Tree is false, remove the excess height at the top
    - Fixed the issue that onChange, onError, and onSuccess callbacks may still be triggered by asynchronous upload requests after the component is uninstalled 

#### 🎉 2.63.0 (2024-07-26)
- 【Fix】
    - fix the issue that when TimePicker selects a later time first, the invalid time value will be caused when onChangeWithDateFirst is false [#2376](https://github.com/DouyinFE/semi-design/pull/2376)
- 【Style】
    - Fixed the problem that when Cascader has no options and the emptyContent is hovering, the background color will exceed the popup layer area.
    - fixed the problem that the use of declarations after nested rules is currently deprecated in Sass(version >= 1.77.7)  [#2366](https://github.com/DouyinFE/semi-design/issues/2366)
    - Increase the priority of the font-size settings of uploaded wrong icons in the Upload component to prevent font-size inconsistencies in effect due to the order of compiled css files.
- 【Chore】
    - Fix the problem of missing getFormProps type definition in formAPI in Form[#2367](https://github.com/DouyinFE/semi-design/pull/2367)

#### 🎉 2.63.0-beta.0 (2024-07-22)
- 【New Component】
    - Added `Chat` component for rendering conversation list [#2248](https://github.com/DouyinFE/semi-design/pull/2248)
- 【Feat】
    - Form adds stopPropagation to prevent the issue of submit and reset events triggering in multiple levels of containers at the same time in nested Form scenarios [#2355](https://github.com/DouyinFE/semi-design/issues/2355)
    - Upload support afterUpload return url modification preview link [#2346](https://github.com/DouyinFE/semi-design/pull/2346)
- 【Fix】
    - Fixed Form ArrayField addWithInitValue without scope isolation for imported parameter cloning  [#2351](https://github.com/DouyinFE/semi-design/issues/2351)
    - Fixed the problem that the width and height are constant when using renderThumbnail with the Image component in Upload  [#2343](https://github.com/DouyinFE/semi-design/issues/2343)

#### 🎉 2.62.1 (2024-07-16)
- 【Fix】
  - Fixed the issue that when TreeSelect enables showFilteredOnly and the search box is in the trigger, the treeSelect panel does not display correctly when it is opened again after searching [#2345](https://github.com/DouyinFE/semi-design/pull/2345)
  - Fixed the issue that when Upload uses renderThumbnail with the Image component, the width and height remain constant [#2343](https://github.com/DouyinFE/semi-design/issues/2343) 
  - Fixed the issue that Form does not pass the id attribute to the form element DOM

#### 🎉 2.62.0 (2024-07-12)
- 【Fix】
  - When the carousel has only one child and autoPlay is true, no switching operation is performed [#2334](https://github.com/DouyinFE/semi-design/pull/2334)
  - Fixed the issue that Modal returns document.body exception in getPopupContainer
  - Fix Table has unexpected borderRadius when dataSource is empty
- 【Chore】
  - Table Column support RecordType  [#2314](https://github.com/DouyinFE/semi-design/issues/2314)

#### 🎉 2.62.0-beta.0 (2024-07-05)
- 【New Component】
    - Added new verification code input component `pinCode` for quickly and conveniently entering verification codes  [#2130 ](https://github.com/DouyinFE/semi-design/issues/2130)
    - Added `Lottie` component for convenient rendering of Lottie animations
    - Added `CodeHighlight` code highlighting component, used to highlight code displayed in web pages
- 【Feat】
    - TreeSelect, Cascader supports closing the popup layer through the esc key
- 【Style】
    - Fix the problem of wrong style of ButtonGroup with theme as outline
- 【Fix】
    - Fixed the issue that when Select value is controlled, if multiple label texts are the same, it cannot be selected correctly when using reactNode writing  [#2284 ](https://github.com/DouyinFE/semi-design/issues/2284)
- 【Chore】
    - update Table getCheckboxProps and rowSelection typings  [#2234](https://github.com/DouyinFE/semi-design/issues/2234)

#### 🎉 2.61.0 (2024-06-24)
- 【Docs】
  - Add web components adaptation docs  [#2313](https://github.com/DouyinFE/semi-design/pull/2313)

#### 🎉 2.61.1 (2024-06-19)
- 【Fix】
    - Fixed the problem in Typography that icon size and size settings are not consistent, affecting version 2.59.0-2.60.1 [#2308](https://github.com/DouyinFE/semi-design/pull/2308)


#### 🎉 2.61.0-beta.0 (2024-06-18)
- 【Feat】
  - Breadcrumb supports controlling the current highlighted navigation item through activeIndex [#2301](https://github.com/DouyinFE/semi-design/pull/2301)
  - Select supports searchPosition configuration [#2298](https://github.com/DouyinFE/semi-design/pull/2298)
  - Form component formApi adds scrollToError to support manual scrolling to the validation error [#2294](https://github.com/DouyinFE/semi-design/pull/2294)
  - Tree, TreeSelect add autoMergeValue API [@LuyangFE](https://github.com/LuyangFE) [#2233](https://github.com/DouyinFE/semi-design/pull/2233)
  - Tabs adds arrowPosition to set the rendering position of the arrow switch in scroll collapse mode [#2288](https://github.com/DouyinFE/semi-design/pull/2288)
  - Tabs adds renderArrow to customize the rendering of the arrow left and right switch in scroll collapse mode [#2288](https://github.com/DouyinFE/semi-design/pull/2288)
  - Tabs adds visibleTabsStyle to set the scroll area style [#2288](https://github.com/DouyinFE/semi-design/pull/2288)
  - Tabs adds onVisibleTabsChange to get unhidden items when tabs overflow [#2288](https://github.com/DouyinFE/semi-design/pull/2288)
  - Tabs adds showRestInDropdown is used to control the visibility of the collapsible Tabs Dropdown panel [#2289](https://github.com/DouyinFE/semi-design/pull/2289)
  - OverflowList adds onVisibleStateChange in scroll mode to get non-hidden items when overflowing [#2288](https://github.com/DouyinFE/semi-design/pull/2288)
  - Avatar size supports passing in legal width attribute values ​​such as "10px" [#2290](https://github.com/DouyinFE/semi-design/pull/2290)
- 【Fix】
  - Fix the problem of Tooltip not hide when cursor quickly moving [#2306](https://github.com/DouyinFE/semi-design/pull/2306)
  - Fixed the issue where the position of the drop-down menu in Pagination did not change due to position changes [2307](https://github.com/DouyinFE/semi-design/pull/2307)
  - Fixed ths issue that align not work when Table is virtualized [@icwoker](https://github.com/icwoker) [#2300](https://github.com/DouyinFE/semi-design/pull/2300)
  - Fixed the issue that the tooltip cannot be triggered when the selected item in the trigger wants to display the tooltip (for example, the label is ReactNode and there is a tooltip, or renderSelectedItem is used to customize the rendering of the selected item, which has a tooltip) in the single-select, searchable, search box in the trigger TreeSelect [#2291](https://github.com/DouyinFE/semi-design/issues/2291) [#2292](https://github.com/DouyinFE/semi-design/pull/2292)

#### 🎉 2.60.0 (2024-06-07)
- 【Docs】
    - update filter API defination In Tranfer
- 【Fix】
    - fixed the issue where AutoComplete throws a warning in the development environment due to autofocus spelling errors
    - Fixed the problem that when Form labelAlign is set to right, the alignment style does not take effect when the label has extra


#### 🎉 2.60.0-beta.0 (2024-06-04)
- 【Fix】
    - Fixed the problem that the text was slightly offset downwards when the input was in small size [@lmsccc](https://github.com/lmsccc)
    - Fix the problem of incomplete tab display after scrollIntoView [@l123wx](https://github.com/l123wx) (https://github.com/DouyinFE/semi-design/pull/2247)
- 【Style】
    - Explicitly set the display attribute of the svg under Spin to inline to prevent the tailwind default svg setting from affecting Spin.

#### 🎉 2.59.1 (2024-05-29)
- 【Fix】
    - Fixed the problem that the data-* attributes passed into Select Option did not render [#2258](https://github.com/DouyinFE/semi-design/pull/2258)
    - Fixed the problem that Toast is not centered but aligned to the left when multiple toasts with different lengths [#2257](https://github.com/DouyinFE/semi-design/pull/2257)
    - Fixed the problem that when TreeSelect is in defaultOpen mode, the pop-up layer cannot be closed when clicking outside. [#2254](https://github.com/DouyinFE/semi-design/pull/2254)
    - Fixed the problem that Avatar cannot trigger onClick, onMouseEnter, and onMouseLeave events when the border/topSlot/bottomSlot API is set. [#2255](https://github.com/DouyinFE/semi-design/pull/2255)
    - Fixed the problem that Badge className function aligns other components and acts on the outermost layer of DOM
    - Revised Badge API definition, added a more semantic countStyle API, and made it consistent with the existing style API (the old API `props.style` can still be used, and the effect remains unchanged, but it is no longer recommended in the documentation)
- 【Chore】
    - Fixed the problem that when FormApi does not pass in generics, there will be a type error that string type cannot be assigned to never when calling setValue (affected scope, v2.59.0) [#2259](https://github.com/DouyinFE/semi-design/pull/2259)
    - Optimize FormApi getValue type hints for nested paths and align setValue behavior [#2259](https://github.com/DouyinFE/semi-design/pull/2259)
    - Fixed onBlur/onFocus type define error in TextArea [#2261](https://github.com/DouyinFE/semi-design/pull/2261)
    - Fixed webComponentPath parameter type error in Semi webpack plugin [#2260](https://github.com/DouyinFE/semi-design/pull/2260)

#### 🎉 2.59.0 (2024-05-24)
- 【Chore】
    - FormApi setValue update interface define, optimizing nested paths  [#1737 ](https://github.com/DouyinFE/semi-design/issues/1737)
    - Remove inappropriate dependency declarations in `@douyinfe/semi-theme-default` [#2252](https://github.com/DouyinFE/semi-design/pull/2252)
- 【Fix】
    - Fixed the problem that the Form validate result cannot be returned normally in the dev environment when StrictMode is turn on [@nekocode](https://github.com/nekocode) [#2210](https://github.com/DouyinFE/semi-design/pull/2211)


#### 🎉 2.59.0-beta.0 (2024-05-20)
- 【Feat】
  - Typography's size API supports inherit attribute
  - Tree's icon API supports function types  [#2236 ](https://github.com/DouyinFE/semi-design/issues/2236)
  - Implement Webpack & Rspack plugins for style insertion of semi components in web components
  - Provide best practices when mixing TailwindCSS to solve a series of style problems.
  - Tabs has added more API, which is used to collapse some tabs into drop-down menus.
  - Button adds outline border mode theme
- 【Fix】
  - Fixed the issue where the overflow tab did not scroll into view when the activeKey changed. [#2241](https://github.com/DouyinFE/semi-design/pull/2241)  [@l123wx](https://github.com/l123wx)
  - Fixed Slider triggers events at abnormal timing in special scenarios [@zzc6332](https://github.com/zzc6332)
  - Fixed the issue that the transparent className style of renderFulllabel in the Tree component is restricted by the li tag
- 【Chore】
  - WebpackPlugin add cssLayer config

#### 🎉 2.58.1 (2024-05-22)
- 【Design Token】
  - Tabs add `$font-tabs_bar_large-fontSize` `$font-tabs_bar_medium-fontSize` `$font-tabs_bar_small-fontSize`


#### 🎉 2.58.0 (2024-05-11)
- 【Fix】
    - Fixed the problem that after adding the scale style to Slider, dragging is not normal and clicking on the track jumps abnormally.
    - Fix the style error in dark mode in safari/firefox browser (affected versions: 2.56.0-2.57.0)  [#2225 ](https://github.com/DouyinFE/semi-design/issues/2225)

#### 🎉 2.58.0-beta.0 (2024-05-06)
- 【Feat】
    - Nav.Item support pass data-* attribute to dom [@meixg](https://github.com/meixg)[#2217](https://github.com/DouyinFE/semi-design/pull/2217)
    - Table compatible with dnd-kit and update sorting demo in dnd-kit [#997](https://github.com/DouyinFE/semi-design/issues/997) 
- 【Style】
    - fixed TagInput insetLabel style not align with other component such as Input、Select [#2216](https://github.com/DouyinFE/semi-design/pull/2216)
- 【Design Token】
    - TagInput add Tokens：$color-tagInput_prefix-text-default、$spacing-tagInput_insetLabel-marginRight、$font-tagInput_insetLabel-fontWeight [#2216](https://github.com/DouyinFE/semi-design/pull/2216)
- 【Fix】
    - Fixed Table header text-align bug in RTL mode  [#2172](https://github.com/DouyinFE/semi-design/issues/2172)
    - Fixed Table onGroupedRow className not work bug  [#2185](https://github.com/DouyinFE/semi-design/issues/2185)


#### 🎉 2.57.0 (2024-04-26)
- 【Fix】
    - Fixed the issue where the asynchronous verification results will still be written to formState after Field is uninstalled [@sylingd](https://github.com/sylingd) [#2206](https://github.com/DouyinFE/semi-design/pull/2206)
    - Fixed the problem of TreeSelect controlled value, defaultExpandedKeys is set, and when loading treeData remotely, defaultExpandedKeys does not take effect (affects version 2.49.2-2.56.3) [#2191](https://github.com/DouyinFE/semi-design/pull/2191)
    - Remove invalid css rules in Banner `.semi-banner-content` [#2204](https://github.com/DouyinFE/semi-design/pull/2204)
    - Fixed the problem that when the Tooltip is mounted, if the Cursor is already on the trigger's dom, and React reuses the trigger dom as the children of the tooltip, the tooltip will not be displayed [#2199](https://github.com/DouyinFE/semi-design/pull/2199)
    - Fixed the problem that the selected items are not exposed through triggerRender in TreeSelect when multi-select, custom trigger, and checkRelation is unRelated  [#2188](https://github.com/DouyinFE/semi-design/issues/2188)
    - Fixed the issue where the autoFocus cursor does not scroll to the end when setting defaultValue in Input and TextArea in the case of long text [#2193](https://github.com/DouyinFE/semi-design/issues/2193)
- 【Design Token】
    - Checkbox add `$color-checkbox_cardType-border-default` [#2208](https://github.com/DouyinFE/semi-design/pull/2208)


#### 🎉 2.57.0-beta.0 (2024-04-22)
- 【Fix】
    - Fixed the issue where the text would flash once after selecting Option in the controlled and filter-enabled mode during Select radio selection and then corrected.
- 【Feat】
    - Modal support modalContentClass to set content 的 props [#2162](https://github.com/DouyinFE/semi-design/pull/2162) [@18852819321](https://github.com/18852819321)
    - TreeSelect's onSearch method add `filteredNodes` which represents the list of nodes displayed after the search [@Hokori23](https://github.com/Hokori23)
    - Form's formApi add getFormProps function

#### 🎉 2.56.3 (2024-04-19)
- 【Fix】
    - Fixed the issue where the Cancel button has a left margin after Modal footerFill is opened.[#2177](https://github.com/DouyinFE/semi-design/pull/2177)
    - Fix abnormal expansion status of TreeSelect which is single selection, searchable,  loaded data from remote [#2178](https://github.com/DouyinFE/semi-design/issues/2178)
    - Fixed the problem that after Upload switches addOnPasting to false, paste upload is still triggered.[#2176](https://github.com/DouyinFE/semi-design/pull/2176)
    - Fixed the problem that TreeSelect options changed after searching and the panel position was not automatically adjusted.[#2181](https://github.com/DouyinFE/semi-design/pull/2181)
    - Modify inaccurate expressions in locale vi-VN translation [@ruaruababa](https://github.com/ruaruababa)[#2154](https://github.com/DouyinFE/semi-design/pull/2154)
- 【Docs】
    - Data visualization documentation updates

#### 🎉 2.56.2 (2024-04-17)
- 【Design Token】
  - Button change splitButton radius token name to `$radius-button_splitButtonGroup_first_topLeft`、`$radius-button_splitButtonGroup_first_bottomLeft`、`$radius-button_splitButtonGroup_last_topRight`、`$radius-button_splitButtonGroup_last_bottomRight` Token


#### 🎉 2.56.1 (2024-04-15)
- 【Design Token】
  - Button Add `$radius-splitButtonGroup_first_topLeft`、`$radius-splitButtonGroup_first_bottomLeft`、`$radius-splitButtonGroup_last_topRight`、`$radius-splitButtonGroup_last_bottomRight` Token



#### 🎉 2.56.0 (2024-04-12)
- 【Fix】
    - fix the problem of inconsistency between Locale ro language type definition and other languages
    - Fix the display exception and omission exception when the Typography component is omitted by js and children is a template string  [#2167 ](https://github.com/DouyinFE/semi-design/issues/2167)
    - Fixed Select filter height not as expected when empty.  (Affected version v2.56.0-beta.0)
    - fix Typography single-line css omission accuracy issue  [#1731 ](https://github.com/DouyinFE/semi-design/issues/1731)

#### 🎉 2.56.0-beta.0 (2024-04-03)
- 【Feat】
    - WebComponent Support：clickOutSide add support for Shadow DOM scenarios，involving components: AutoComplete、Calendar、Cascader、DatePicker、Select、TagInput、TimePicker、Tooltip、TreeSelect [@changlin2569](https://github.com/changlin2569)  [#1381](https://github.com/DouyinFE/semi-design/issues/1381) 
    - WebComponent Support：Inject the css variable into the shadow dom through the :host, :host-context pseudo-class selectors to ensure that the Semi component style under the shadow dom is correct. [#2142](https://github.com/DouyinFE/semi-design/issues/2142) 
    - Backtop click to increase throttle to prevent repeated triggering within duration. [@OnlyWick](https://github.com/OnlyWick)
- 【Fix】
    - Fixed Typography single-line css omission accuracy issue  [#1731](https://github.com/DouyinFE/semi-design/issues/1731) 
    - Fixed the issue where the label of the last row is vertically spaced differently from other rows after selecting multiple rows when Select is multi-selected and filter is turned on. [#1667](https://github.com/DouyinFE/semi-design/issues/1667)
- 【Style】
    - Fixed the style issue where the height of Form.RadioGroup is inconsistent with that of the normal RadioGroup when type=button/card  [@nekocode](https://github.com/nekocode) [#1954](https://github.com/DouyinFE/semi-design/issues/1954) 
    - Fixed the style issue where the style of RadioGroup is incorrect after being selected if the parent has overflow:hidden [@nekocode](https://github.com/nekocode) [#2126](https://github.com/DouyinFE/semi-design/issues/2126) 
- 【Design token】
    - Select add `$height-select_multiple_input_small`、`$height-select_multiple_input_default`、`$height-select_multiple_input_large`  used to specify the height of the input when searching is enabled [#2151](https://github.com/DouyinFE/semi-design/pull/2151)


#### 🎉 2.55.5 (2024-04-02)
- 【Fix】
  - Fixed a type error caused by value not being in treeData when checkRelation in the Tree component is unRelated. [#2147](https://github.com/DouyinFE/semi-design/pull/2147)
  - Fix type error in controlled Cascader where value is not in TreeData [#2146](https://github.com/DouyinFE/semi-design/pull/2146)
  - Fixed the problem of slider tooltip not automatically hiding when the mouse is moved in some scenarios (Affected version 2.49.0 ~ 2.55.4) [#2148](https://github.com/DouyinFE/semi-design/pull/2148)

#### 🎉 2.55.3 (2024-04-01)
- 【Fix】
  - Fixed the problem that when onChangWithObject is turned on for Select multi-selection and value is controlled, the current value does not exist in the optionList, and the rendering is not re-executed after updating other properties in the value. [#2139](https://github.com/DouyinFE/semi-design/pull/2139)


#### 🎉 2.55.1 (2024-03-25)
- 【Fix】
  - Fix: Fix collapse & collapsible keepDOM failure problem (affects versions 2.54.0-beta.0 ~ 2.55.0) [#2140](https://github.com/DouyinFE/semi-design/pull/2140)
  - Fix: Correct the default value of lazyRender for collapse, from true set in 2.54.0 to a more appropriate false, keeping the use cases where lazyRender is not set consistent with the behavior before 2.54 (affects versions 2.54.0-beta.0 ~ 2.55.0) [#2140](https://github.com/DouyinFE/semi-design/pull/2140)

#### 🎉 2.55.0 (2024-03-22)
- 【Fix】
  - Fix the problem that the Table header selection state is incorrectly selected when the data is empty (affects v2.51 ~ v2.54)  [#2128](https://github.com/DouyinFE/semi-design/issues/2128)
  - Fix the problem of Split Button losing style when children Button className changes

#### 🎉 2.55.0-beta.0 (2024-03-18)
- 【Fix】
    - fix TabBar rendering as empty in SSR [@nekocode](https://github.com/nekocode)
    - Fixed the problem that Transfer failed to drag during fast drag due to Sortable's default drag sensing delay time being too long.
    - Fixed the problem of openKeys not saving the last state after Nav changed selectedKeys (Affects v2.54.1)  [#2115](https://github.com/DouyinFE/semi-design/issues/2115)
- 【Chore】
    - Upgraded webpack and rspack build plug-ins to support consuming custom css configuration configured in Semi DSM, which can be used to aggregate overridden CSS or any css unrelated to Semi components into theme package styles
  
#### 🎉 2.54.1 (2024-03-11)
- 【Fix】
    - fixed Navigation component selectedKeys bug in react 17
    - fixed Navigation component openKeys does not work after selectedKeys is updated
  
#### 🎉 2.54.0 (2024-03-08)
- 【Fix】
    - Fix the problem that the width occupied by the expand button is not taken into account in js truncation calculation, The scope of impact is 2.54.0-beta.0.
- 【Chore】
  - Upload adds FileItemStatus TS interface export

#### 🎉 2.54.0-beta.0 (2024-03-04)
- 【Feat】
    - Toast component supports theme global configuration [@LonelySnowman](https://github.com/LonelySnowman) [#2099](https://github.com/DouyinFE/semi-design/issues/2099)
    - Collapsible adds lazyRender API [@changlin2569](https://github.com/changlin2569) [#2100](https://github.com/DouyinFE/semi-design/issues/2100)
    - Descriptions component supports horizontal layout [@LonelySnowman](https://github.com/LonelySnowman) [#1534](https://github.com/DouyinFE/semi-design/issues/1534) 
    - Cascader supports calling the search method through ref  [#2098](https://github.com/DouyinFE/semi-design/issues/2098)
    - ImagePreview adds onDownLoadError callback API [#2093](https://github.com/DouyinFE/semi-design/pull/2093)
- 【Fix】
    - Fixed the problem that Table expandedRowKeys and defaultExpandAllGroupRows do not take effect when used at the same time [#2085](https://github.com/DouyinFE/semi-design/issues/2085)
    - Fixed the problem of Typography's Ellipsis function flickering on first hover in some special scenarios [#2107](https://github.com/DouyinFE/semi-design/pull/2107)


#### 🎉 2.53.3 (2024-02-26)
- 【Fix】
  - Fix Avatar border type error

#### 🎉 2.53.2 (2024-02-26)
- 【Fix】
  - Fixed the error accessing empty element in React ResizeObserver [@nekocode](https://github.com/nekocode)
  
#### 🎉 2.53.1 (2024-02-26)
- 【Fix】
    - Fixed the problem that when using timeZone and disabledHours at the same time in TimePicker, the displayed value does not meet the expectations [#2083](https://github.com/DouyinFE/semi-design/pull/2083)
    - Fixed Badge component prop-types check error when type is success [@matozz](https://github.com/matozz) [#2091](https://github.com/DouyinFE/semi-design/pull/2091)

#### 🎉 2.53.0 (2024-02-23)
- 【Fix】
  - Fixed the issue where Sidesheet Portal is still mounted when visible is not displayed [#2094](https://github.com/DouyinFE/semi-design/pull/2094)
  - Fixed the problem of incorrect definition of onKeyDown parameter type of TagInput
- 【Docs】
  - Fixed tabPosition parameter type error in Tabs component documentation [@miyuesc](https://github.com/miyuesc) [#2090](https://github.com/DouyinFE/semi-design/pull/2090)

####  🎉 2.52.3 (2024-02-22)
- 【Fix】
    - Fixed the problem that the panel does not display the selection if the value type is number in Cascader's treeData (Affected version range v2.51.0-v2.53.2)

#### 🎉 2.52.2 (2024-02-19)
- 【Fix】
  - Fixed the problem that ResizeObsever does not exist in non-browser environments. (Affected version range 2.52.1, 2.53.0-beta.0)

#### 🎉 2.52.1 (2024-02-18)
- 【Fix】
  - Fixed the problem of using themes on vite to report errors (Affected version range 2.52.0)
- 【Chore】
  - remove ResizeObserver polyfill

#### 🎉 2.53.0-beta.0 (2024-02-08)
- 【Perf】
  - Improve the performance of Typography when Ellipsis is turned on, and reduce the number of renders and calculations [#1970](https://github.com/DouyinFE/semi-design/pull/1970)
  - Remove redundant clone operations; for necessary clone operations, use fast-copy's copy call to replace lodash's cloneDeep call. Involved components: DatePicker, Table, OverflowList, Form, Tree, TreeSelect, Cascader [#2002](https://github.com/DouyinFE/semi-design/pull/2002)
- 【Feat】
  - Support global setting of default Props for some components [#2029](https://github.com/DouyinFE/semi-design/pull/2029)

#### 🎉 2.52.0 (2024-02-06)
- 【Fix】
  - Add overflow-y:auto to Dropdown to prevent incorrect styling when setting border-radius
  - Fixed the problem that onBlur is not triggered when clicking outside the Select button after clicking the clear button.  [#1989](https://github.com/DouyinFE/semi-design/issues/1989)
  - Fixed Image request undefined url in some case. [#2063](https://github.com/DouyinFE/semi-design/issues/2063) [@nekocode](https://github.com/nekocode)
  - Fixed timepicker value props give undefined cause type error. [#2066](https://github.com/DouyinFE/semi-design/issues/2066)
  - Fixed the issue where Cascader's options panel displays all options when search content is English commas
  - Fixed the problem of multi-selection and showClear's Cascader. After clicking the clear button, the options panel did not switch from the search state to the normal state.
  - Fixed the issue of incorrect border width token in Select part
  - Fixed the problem of inaccurate positioning when the popupCountainer of the floating layer component or its parent is scaled
  - Fixed rowSelection hidden bug in resizable Table  [#2036](https://github.com/DouyinFE/semi-design/issues/2036)
  - Fixed the problem that after clicking the clear button in Datepicker, the year and month values of the panel would not be restored to the initial state.
  - Fixed infinite update bug triggered by passing illegal value NaN in DatePicker prop value  [#1846](https://github.com/DouyinFE/semi-design/issues/1846)
  - Fixed the problem that there is no className of Option in the renderOptionItem input parameter of Select
  - Fixed the issue where the original overflow: hidden on the body will be deleted when modal is uninstalled without opening it. (version range 2.51.0~2.51.3)
- 【Chore】
  - Form withField introduces the type declaration of utility-types from import to import type (which has no impact)

#### 🎉 2.52.0-beta.0 (2024-01-31)
- 【Fix】
  - Fixed Table getCurrentPageData type  [@marshcat0](https://github.com/marshcat0)
  - Fixed the problem that the onClick function of the Dropdown click submenu event is executed too early, which may cause the user to be unable to focus on the Dropdown external element and trigger the Blur of the external element within the onClick function. The scope of impact is 2.43.0-beta.0 ~ 2.50.0-beta .0.
- 【Feat】
  - Avatar adds `border` `bottomSlot` `topSlot` to control the border and add additional top and bottom content, and adds `contentMotion` and border `motion` to enable additional motion effects.
  - Added `footerFill` API to the Modal configuration item, which is used to control whether the default bottom buttons of Modal are fully arranged.
  - Slider add `handleDot` api to whether to show the dot inside the slider handle.
  - Table support renderFilterDropdown  [#2015](https://github.com/DouyinFE/semi-design/issues/2015)
  - RowSelection of Table component adds renderCell to render selection  [@changlin2569](https://github.com/changlin2569)
  - TreeSelect component support onClear API  [#1331 ](https://github.com/DouyinFE/semi-design/issues/1331) [@changlin2569](https://github.com/changlin2569)
  - DatePicker support presets start and end function type  [#2038](https://github.com/DouyinFE/semi-design/issues/2038)


#### 🎉 2.51.4 (2024-01-31)
- 【Fix】
    - Fixed the problem that after Cascader's key generation rules in keyEntities changed, the value parameter in triggerRender's parameters was inconsistent with the original one (Affected Scope 2.51.0~2.51.3) [#2051](https://github.com/DouyinFE/semi-design/pull/2051)

#### 🎉 2.51.3 (2024-01-19)
- 【Fix】
    - Fixed Table propTypes is removed in prod mode

#### 🎉 2.51.2 (2024-01-19)
- 【Fix】
    - Fixed TextArea autoSize is not work when textarea resize [#2026](https://github.com/DouyinFE/semi-design/issues/2026)
    - Fixed controlled DatePicker input value is wrong when type is dateTimeRange and needConfirm is opened [#2024](https://github.com/DouyinFE/semi-design/issues/2024)
    - Fixed the problem of triggering onClose/onPreview twice when clicking the edge of the close button in the preview state in the ImagePreview component [#2027](https://github.com/DouyinFE/semi-design/pull/2027)

#### 🎉 2.51.1 (2024-01-18)
- 【Fix】
    - Unloading the Modal directly when the Modal is not collapsed may cause the page to scroll abnormally. [#2023](https://github.com/DouyinFE/semi-design/pull/2023)

#### 🎉 2.51.0 (2024-01-12)
- 【Fix】
    - Fixed the problem that when a TextArea with maxLength is input in Chinese, clicking outside triggers blur, and the echoed content does not comply with the maxLength setting  [#2005](https://github.com/DouyinFE/semi-design/issues/2005)
    - Fixed typeError in Cascader when autoMergeValue is false and value is [] [#2017](https://github.com/DouyinFE/semi-design/pull/2017)
- 【Style】
    - The default zIndex value of ImagePreview's preview layer is adjusted from 1000 to 1070

#### 🎉 2.51.0-beta.0 (2024-01-09)
- 【Feat】
    - Dropdown.Item supports transparent transmission of data-* attributes to dom
    - ImagePreview adds previewCls and previewStyle for setting the preview style
    - Image adds onClick API
- 【Perf】
    - Optimize Cascader's stuck problem when thousand-level leaf nodes are selected under multi-selection, leafOnly, searchable, and controlled conditions [#1999](https://github.com/DouyinFE/semi-design/pull/1999)
- 【Fix】
    - Fixed the problem that the table header is not selected when all rows of Table are selected and disabled [#2001](https://github.com/DouyinFE/semi-design/issues/2001)
    - Fixed the issue where the controlled AutoComplete configured with onSelectWithObject reported an error when clicking the clear button [#2013](https://github.com/DouyinFE/semi-design/issues/2013)
    - Fixed the problem of creating portal DOM node by default when Image is not displayed [#2004](https://github.com/DouyinFE/semi-design/issues/2004)
    - Fixed the problem that the closable parameter of Image does not take effect

#### 🎉 2.50.1 (2024-01-04)
- 【Fix】
    - Fixed the indentation error problem when renderingFullLabel after Tree supports showLine（scope of impact: v2.50.0）[#2007](https://github.com/DouyinFE/semi-design/pull/2007)
    - After Tree supports showLine, the connection line and option text partially overlap in rtl mode (scope of impact: v2.50.0) [#2007](https://github.com/DouyinFE/semi-design/pull/2007)
- 【Style】
    - Fixed the font-weight error of the active item in BreadCrumb(scope of impact: v2.47-2.50) [#2008](https://github.com/DouyinFE/semi-design/pull/2008)

#### 🎉 2.50.0 (2024-01-02)
- 【Fix】
  - When opening a preview in ImagePreview and switching preview images, Zoom changes do not need to be exposed through onZoomIn/onZoomOut
    callbacks  [#2000 ](https://github.com/DouyinFE/semi-design/issues/2000)
  - Fixed the issue of unexpected onRotateLeft callback being triggered when switching images during image preview


#### 🎉 2.50.0-beta.0 (2023-12-26)
- 【Feat】
    - Tree, TreeSelect add showLine api.  [#1801 ](https://github.com/DouyinFE/semi-design/issues/1801) [@Yan-XiaoMing](https://github.com/Yan-XiaoMing)
    - Table column support sortIcon
- 【Style】
    - Modify the CSS implementation of the indentation of each line of the Tree/TreeSelect option. There is no limit to the indentation level greater than 20 levels. [@Yan-XiaoMing](https://github.com/Yan-XiaoMing)
- 【Fix】
    - Fixed the problem that types of Id in Notification is not correct.
    - 
#### 🎉 2.49.2 (2023-12-26)
- 【Fix】
    - Fixed the problem of Select failing to select option after clicking outside when the selection is radio (scope of impact v2.49.0)
    - Fixed the problem that showFilteredOnly does not take effect in TreeSelect controlled expandedKeys  [#1542 ](https://github.com/DouyinFE/semi-design/issues/1542)
    - Fixed the problem that when the DatePicker type is monthRange, the limited date range does not meet the expectations.
    - Fixed vertical basic step style error when setting box-sizing to border-box globally.  [#1985 ](https://github.com/DouyinFE/semi-design/issues/1985)
    - Remove the optional type setting of props of triggerRender of TreeSelect/Select  [#532 ](https://github.com/DouyinFE/semi-design/issues/532)
    - Fixed an issue where `Notification.addNotice()` did not use the global configuration set via `Notification.config()` [@lideming](https://github.com/lideming)

#### 🎉 2.49.0 (2023-12-15)
- 【Fix】
    - Image supports zooming via panel and mouse scrolling anywhere on the preview page [#1890](https://github.com/DouyinFE/semi-design/pull/1890)
    - The initial size of the Image preview has been adjusted. Before adjustment, the initial size of the preview is to fit the width and height of the page; after adjustment, if the width and height of the image are smaller than the width and height of the page, the initial width and height of the preview will be the same as the width and height of the image, otherwise the preview will be scaled to fit the width and height of the page.[#1890](https://github.com/DouyinFE/semi-design/pull/1890)
    - fixed the problem that after selecting a radio option, clicking outside does not trigger the onblur event [#1977](https://github.com/DouyinFE/semi-design/pull/1977)

#### 🎉 2.49.0-beta.0 (2023-12-11)
- 【Feat】
    - Table supports keepDOM and does not destroy folded rows when folding [#1969](https://github.com/DouyinFE/semi-design/pull/1969)
    - Calendar adds the minEventHeight api to support the display of the event dom structure with a minimum height when the event start and end are very close in day, multi-day and week views [#702](https://github.com/DouyinFE/semi-design/issues/702)
    - Timepicker adds stopPropagation to determine whether to prevent click events on the popup layer from bubbling [#1966](https://github.com/DouyinFE/semi-design/pull/1966)
    - The SideSheet component supports custom closeIcon [@LonelySnowman](https://github.com/LonelySnowman) [#1948](https://github.com/DouyinFE/semi-design/issues/1948)
- 【Fix】
    - Fixed the issue where the tooltip on the Slider handle occasionally flickers when dragging [#1935](https://github.com/DouyinFE/semi-design/pull/1935)
    - Fixed typography JS truncation calculation error for non-wrapped text [@marshcat0](https://github.com/marshcat0)
    - Fixed the issue where Radio pure card clicks on the hotspot incorrectly under Safari [@nekocode](https://github.com/nekocode) [#1959](https://github.com/DouyinFE/semi-design/issues/1959)
- 【Docs】
    - Add VChart chart introduction


#### 🎉 2.48.0 (2023-12-01)
- 【Fix】
    - fixed the issue of incorrect defaultValue setting when TimePicker format is HH. (Note: If the value type originally passed in default or value is illegal, for example, a timestamp in numeric format is passed in in string form, type conversion will no longer be attempted)
- 【Docs】
    - add @douyinfe/semi-icons-lab description


#### 🎉 2.48.0-beta.0 (2023-11-27)
- 【Feat】
    - Slider adds `showMarkLabel` to control the visibility of the label, `tooltipOnMark` to display the tooltip on the mark, and `showArrow` to control the visibility of the tooltip triangle.
    - String type avatar, the character length can be automatically adjusted according to the width of the avatar [#1917](https://github.com/DouyinFE/semi-design/issues/1917) [@LonelySnowman](https://github.com/LonelySnowman )
- 【Fix】
    - fixed virtualized Table showHeader bug [#726](https://github.com/DouyinFE/semi-design/issues/726)
   

#### 🎉 2.47.1 (2023-11-28)
- 【Fix】
    - Fixed the problem of incorrect list filtering after filter when Option is used in Select Group grouping scenario and the key attribute is not explicitly declared. Effect version range: v2.46.0 ~ v2.47.0 [#1939](https://github.com/DouyinFE/semi-design/pull/1939)
    - Fixed the problem of clicking on Dropdown item when there is no onClick. Effect version v2.47.0 [#1936](https://github.com/DouyinFE/semi-design/issues/1936)


#### 🎉 2.47.0 (2023-11-17)
- 【Fix】
    - fixed Table pagination bug when given pageSize and showSizeChanger at same time  [#1885](https://github.com/DouyinFE/semi-design/issues/1885)
    - Fixed the problem that the right and middle click of Dropdown Item will also trigger onClick [#1914](https://github.com/DouyinFE/semi-design/pull/1914) (Effect version range: 2.43.0-beta.0 ~ 2.46.1)

#### 🎉 2.47.0-beta.0 (2023-11-15)
- 【Feat】
    - Tree/TreeSelect supports keyMaps API for customizing fields in nodes [#1274](https://github.com/DouyinFE/semi-design/issues/1274) [#316](https://github.com/DouyinFE/semi-design/issues/316)
    - The DatePicker `insetInput` type supports pasting a legal date string into the first input box and automatically splitting the date and time and selecting the corresponding date  [#1787](https://github.com/DouyinFE/semi-design/issues/1787)
    - Table sorter supports sortOrder parameter [#1897](https://github.com/DouyinFE/semi-design/pull/1897)
     - add popconfirm api showCloseIcon [#1898](https://github.com/DouyinFE/semi-design/issues/1898) [@Yan-XiaoMing](https://github.com/Yan-XiaoMing)
- 【Design token】
    - Typography add $font-typography_normalText-regular-fontWeight $font-typography_smallText-regular-fontWeight $font-typography_normalParagraph-regular-fontWeight $font-typography_smallParagraph-regular-fontWeight [#1878](https://github.com/DouyinFE/semi-design/pull/1878)
    - Add `$color-button_disabled-bg-primary`  `$color-button_disabled-bg-secondary` `$color-button_disabled-bg-danger` `$color-button_disabled-bg-warning` `$color-button_disabled-bg-tertiary`  `$color-button_disabled_light-bg-primary` `$color-button_disabled_light-bg-secondary` `$color-button_disabled_light-bg-danger` `$color-button_disabled_light-bg-warning` `$color-button_disabled_light-bg-tertiary` [#1904](https://github.com/DouyinFE/semi-design/pull/1904)
    - Add `--semi-color-data-0` series css variables [#1907](https://github.com/DouyinFE/semi-design/pull/1907)
   

#### 🎉 2.46.1 (2023-11-07)
- 【Fix】
    - Fixed the problem that Pagination popoverZIndex does not take effect on SizeChanger

#### 🎉 2.46.0 (2023-11-03)
- 【Fix】
    - Fixed the problem that "x more" is not displayed after updating the event when the Calendar height is not enough to accommodate an event.
    - Fixed the inconsistent order of onBlur callback and onSelect callback in AutoComplete  [#1880](https://github.com/DouyinFE/semi-design/issues/1880)
    - Fixed the problem that when Select uses JSX to pass in Option, the key passed in Option does not take effect during rendering.


#### 🎉 2.46.0-beta.0 (2023-10-30)
- 【Feat】
    - Typography's showTooltip API adds renderTooltip to support custom rendering pop-up layer components  [#1853](https://github.com/DouyinFE/semi-design/issues/1853)
- 【Fix】
    - Fixed formatter error issue when InputNumber is in controlled mode and focused [#1870](https://github.com/DouyinFE/semi-design/pull/1870)
    - Fixed ide dom error in ssr [#1875](https://github.com/DouyinFE/semi-design/pull/1875) [@tank0317](https://github.com/tank0317)
    - Fixed an issue in Cascader that loads data asynchronously due to untimely updating of loadingKeys resulting in incorrect node status when loading is completed.  [#1867](https://github.com/DouyinFE/semi-design/issues/1867)
    - Fixed the problem of TypeError caused by the destructured data in TreeSelect being null
- 【Design Token】
    - Select Add color-select-option-bg-selected [#1871](https://github.com/DouyinFE/semi-design/pull/1871)


#### 🎉 2.45.0 (2023-10-20)
- 【Fix】
    - resizable Table width reset to initial bug（Affected v2.32~v2.44）
    - Fixed the problem of incorrect update of select ellipsisTrigger under certain boundary conditions
    - Fixed the problem of asynchronous loading of data in Tree/TreeSelect where checkRelation is unRelated, causing the selected status to be lost.
    - Fixed the issue of selecting ellipsisTrigger displaying more quantities incorrectly [#1560](https://github.com/DouyinFE/semi-design/issues/1560) [@Jon-Millent](https://github.com/Jon-Millent)

#### 🎉 2.45.0-beta.0 (2023-10-13)
- 【Fix】
    - Fixed the problem that when Select virtualization and renderCreateItem are used at the same time, the display position of custom creation options is incorrect.  [#1856](https://github.com/DouyinFE/semi-design/issues/1856)
    - Remove the redundant comparison of whether TreeData has changed in getDerivedState of TreeSelect/Tree
- 【Design Token】
    - Anchor add $color-anchor_title_active-text-hover $color-anchor_title-bg $color-anchor_title_active-bg
    - Datepicker Add $color-datepicker_range_trigger-border-focus
- 【Feat】
    - Notification support modify exist notification content.
    - Tooltip API spacing supports defining distances on two axes
    - Textarea `autosize` support object prop `{minRows: number, maxRows: number}` [@hehehai](https://github.com/hehehai)

#### 🎉 2.44.0 (2023-09-22)
- 【Fix】
    - Fixed the problem of incomplete display/non-display of Image  when the height is very small [#1838](https://github.com/DouyinFE/semi-design/issues/1838)
    - Fixed the issue of incorrect styles of some Step pseudo-classes [#1836](https://github.com/DouyinFE/semi-design/pull/1836)

#### 🎉 2.44.0-beta.0 (2023-09-19)
- 【Feat】
  - Cascader's search results panel supports virtualization [#1815](https://github.com/DouyinFE/semi-design/pull/1815)
  - Tag added API: suffixIcon, prefixIcon [#1832](https://github.com/DouyinFE/semi-design/pull/1832)
- 【Fix】
  - Fixed the problem of abbreviated text failure when the display of wrapped span is set to inline-block when the default text content of Tooltip is set [#1831](https://github.com/DouyinFE/semi-design/issues/1831)
  - Update tooltip autoAdjustOverflow strategy. When there is insufficient space in the original direction of the viewport and sufficient reverse space, it will be uniformly converted to the reverse direction [#1812](https://github.com/DouyinFE/semi-design/pull/1812)
  
#### 2.43.2 (2023-09-15)
- 【Style】
  - When the Popconfirm icon is null, the body part does not retain the marginLeft left spacing. [#1828](https://github.com/DouyinFE/semi-design/pull/1828)
  - Table column filter Dropdown increases the default maximum height to 290px [#1647](https://github.com/DouyinFE/semi-design/issues/1647)
- 【Design Token】
  - Table add new token： $height-table_column_filter_dropdown
- 【Fix】
  - Fixed the problem that the rendering result of Calendar month view event does not meet expectations [#1825](https://github.com/DouyinFE/semi-design/issues/1825) 

#### 2.43.1 (2023-09-11)
- 【Fix】
  - Fixed Popover Trigger  ContextMenu dts error [#1819](https://github.com/DouyinFE/semi-design/issues/1819)
  - Fixed portal not popup in React18 strict mode [#1769](https://github.com/DouyinFE/semi-design/issues/1769)

#### 2.43.0 (2023-09-08)
- 【Fix】
  - Fixed the problem that Chinese input cannot be displayed normally in the Firefox browser (affecting versions 2.26.0~2.42.4)  [#1810](https://github.com/DouyinFE/semi-design/issues/1810)
  - Fixed the problem of ImagePreview scrolling container and viewport images not loading in lazyLoad mode [#1817](https://github.com/DouyinFE/semi-design/pull/1817)

#### 🎉 2.43.0-beta.0 (2023-09-04)
- 【Feat】
    - The renderFullLabel callback of Tree and TreeSelect adds filtered and searchWord parameters
    - Upload new API: addOnPasting,  supports reading the pictures in the pasteboard and automatically adding to fileList [@ChuTingzj](https://github.com/ChuTingzj)  [#1612](https://github.com/DouyinFE/semi-design/issues/1612)
- 【Fix】
    - Fixed an issue where the Item click did not take effect in very few scenarios when nesting Dropdowns.
    - Fixed resizable table onHeaderCell bug  [#1796](https://github.com/DouyinFE/semi-design/issues/1796)

#### 🎉 2.42.3 (2023-09-01)
- 【Fix】
    - Fixed Table baseRow onMouseLeave error [#1794](https://github.com/DouyinFE/semi-design/pull/1794)

#### 🎉 2.42.2 (2023-08-28)
- 【Fix】
    - Fixed the problem that when the image file name has a query parameter, the image cannot be opened due to the wrong file name after downloading [@nekocode](https://github.com/nekocode) [#1782](https://github.com/DouyinFE/semi-design/pull/1784)
    - Fixed Typography under the Js ellipsis strategy. When it is judged not to truncate, an unexpected tooltip will still appear when the mouse moves into the content [#1788](https://github.com/DouyinFE/semi-design/pull/1788)
    - Fixed the problem that the OverflowList component reports a warning in some scene keys [#1786](https://github.com/DouyinFE/semi-design/pull/1786)
    - Fixed the problem of memory leaks in some scenes of pop-up layer components and Navigation Thanks [@boliangleung](https://github.com/boliangleung) [#1785](https://github.com/DouyinFE/semi-design/pull/1785)

#### 🎉 2.42.1 (2023-08-25)
- 【Style】
    - Set the font-family of the inset label of datePicker to $font-family-regular, consistent with the inset label of other components [#1780](https://github.com/DouyinFE/semi-design/pull/1780)

#### 🎉 2.42.0-beta.0 (2023-08-21)
- 【Feat】
    - Form add API: stopValidateWithError 、trigger，allow unified configuration of stopValidateWithError and trigger properties of all Fields  [#640](https://github.com/DouyinFE/semi-design/issues/640)
    - Tooltip、Popover、Dropdown add trigger=contextMenu support right click to show  [#396](https://github.com/DouyinFE/semi-design/issues/396)
    - Table column support resize prop #1762  [#1650](https://github.com/DouyinFE/semi-design/issues/1650)
    - Upload adds picWidth and picHeight to quickly set the width and height of pictures in picture wall mode  [#1757](https://github.com/DouyinFE/semi-design/issues/1757)
    - Split Button supports deep nested Button [#487](https://github.com/DouyinFE/semi-design/issues/487)
    - Toast add stack mode, improve the display experience when multiple toasts at the same time [#1746](https://github.com/DouyinFE/semi-design/pull/1746)
- 【Fix】
    - Fixed InputNumber formatter error in controlled mode  [#1672](https://github.com/DouyinFE/semi-design/issues/1672)
    - Fixed collapse aria-owns in SSR not match with server result.  [#1763](https://github.com/DouyinFE/semi-design/issues/1763)
    - When Upload preview is true, add previews for other types of files to prevent pdf and other types of files from displaying x-cracked images when loading fails
- 【Style】
    - When Tree/TreeSelect enables search and treeNodeFilterProp is not label, only the search content is highlighted  instead of the entire line  [#1711](https://github.com/DouyinFE/semi-design/issues/1711)
    - Typography when ellipsis showTooltip is set to popover, remove the default 240px width, which is consistent with popover alone  [#1766](https://github.com/DouyinFE/semi-design/issues/1766)

#### 🎉 2.41.3 (2023-08-17)
- 【Style】
  - Select loading wrapper adds an explicit box-sizing statement to prevent the loading display height from being incorrect in some special cases（for example, when the box-sizing of all DOMs is globally reset to border-box [#1507](https://github.com/DouyinFE/semi-design/issues/1507)
- 【Chore】
  - Table dependence: react-resizable version update from v1 to v3 [#1768](https://github.com/DouyinFE/semi-design/pull/1768) [#1683](https://github.com/DouyinFE/semi-design/issues/1683)

#### 🎉 2.41.2 (2023-08-14)
- 【Fix】
  - fixed Table column not aligned when header is sticky [#1760](https://github.com/DouyinFE/semi-design/issues/1760)


#### 🎉 2.41.1 (2023-08-11)
- 【Feat】
  - Slider Add onMouseUp API
- 【Fix】
  - Fixed the problem that the handle always follows the mouse in the scene where the Slider mouse moves out of the window and then lets go and then moves back [#1412](https://github.com/DouyinFE/semi-design/issues/1412)
  - SideSheet adds automatic calculation of scroll bar width logic to prevent the content behind the mask from shaking when it pops up
  - Fixed the incorrect case of Input and TextArea autoFoucs

#### 🎉 2.41.0-beta.0 (2023-08-07)
- 【Refactor】
    - change react-sortable-hoc to @dnd-kit/sortable for Transfer/Taginput drag & drop [#1683](https://github.com/DouyinFE/semi-design/issues/1683)
- 【Style】
    - The interaction of the Taginput dragging process has been modified, from the change of the tag position in the original dragging to the vertical line in front of the tag to mark the position where the tag in the dragging can be dropped. TagInput adds drag-related tokens, $width-tagInput_sortable_item_over, $color-tagInput_sortable_item_over-bg [#1738](https://github.com/DouyinFE/semi-design/pull/1738)
- 【Fix】
    - Fixed wrong type definition for defaultCurrentIndex in ImagePreview
    - Fixed document is not defined error [@nekocode](https://github.com/nekocode)

#### 🎉 2.40.0 (2023-07-28)
- 【Style】
    - Remove unnecessary margin in button component [#1732](https://github.com/DouyinFE/semi-design/pull/1732)
    - Skeleton's default rounded corners changed from 4px to --semi-border-radius-small(3px) [#1739](https://github.com/DouyinFE/semi-design/pull/1739)

#### 🎉 2.40.0-beta.0 (2023-07-25)
- 【Feat】
    - Form onSubmit, onSubmitFail add event parameters to reveal [#1728](https://github.com/DouyinFE/semi-design/issues/1728)
    - Image's renderPreview Menu API supports menuItems parameter
    - Image, ImagePreview provide setDownloadName API to support setting the download file name
- 【Fix】
    - Fixed the problem that all pop-up components mount Children to delay a macro task [#1703](https://github.com/DouyinFE/semi-design/issues/1703)
    - Fixed the problem that when TimePicker is controlled and the type is timeRange, the start time is automatically filled with the current time after selecting the end time twice [#1716](https://github.com/DouyinFE/semi-design/issues/1716)
    - Fixed the problem that TimePicker set the value to undefined under controlled conditions but displayed the current time
    - Fixed the problem that Upload will upload the submitted files repeatedly when calling the ref method to upload manually [@nekocode](https://github.com/nekocode) [#1720](https://github.com/DouyinFE/semi-design/issues/1720)
- 【Style】
    - Adjust the spacing between Radio addon and extra from 0 to 4px
- 【Design Token】
    - New Token for Radio: $spacing-radio_content-rowGap
#### 🎉 2.39.3 (2023-07-25)
- 【Fix】
    - Fixed the problem that the Tree component will re-render every time it is rendered in the virtual environment [#1725](https://github.com/DouyinFE/semi-design/issues/1725)

#### 🎉 2.39.2 (2023-07-19)
- 【Fix】
  - Fixed the problem that the size check was not performed correctly when using replace to replace the new file after uploading a legal file during Upload showReplace [#1712](https://github.com/DouyinFE/semi-design/issues/1712)
- 【Perf】
  - Optimize the Pagination small size to show the problem of lag when the data is at the level of 100 million [#1714](https://github.com/DouyinFE/semi-design/pull/1714)
- 【Chore】
  - Unify the case of the imported type ScrollIntoViewOptions in Form Foundation [#1713](https://github.com/DouyinFE/semi-design/pull/1713) [@rashagu](https://github.com/rashagu)

#### 🎉 2.39.1 (2023-07-18)
- 【Fix】
    - Fixed the problem that the values input parameter in Form validate.then() is not scope isolated and will be affected by Field DOM mount and unmount [#1710](https://github.com/DouyinFE/semi-design/pull/1710)

#### 🎉 2.39.0 (2023-07-14)
- 【Fix】
  - Semi Webpack Plugin modifies the logic related to animation.scss referenced by theme loader, which is compatible with some special directory organizations in pnpm scenarios [#1704](https://github.com/DouyinFE/semi-design/pull/1704)
  - Remove the flex-wrap on the outermost side of the Checkbox [#1700](https://github.com/DouyinFE/semi-design/pull/1700)
- 【Style】
  - Remove disabled switch knob transformX when in active status [#1697](https://github.com/DouyinFE/semi-design/pull/1697)

#### 🎉 2.39.0-beta.0 (2023-07-10)
- 【Style】
    - Fixed the problem that the content exceeds the trigger box when displaying a long label in TreeSelect  [#623](https://github.com/DouyinFE/semi-design/issues/623)
- 【Fix】
    - Fixed the problem that Anchor cannot jump when clicked in some scenarios [#1688](https://github.com/DouyinFE/semi-design/pull/1688)
#### 🎉 2.38.2 (2023-07-10)
- 【Fix】
    - Fixed the problem that the height was not recalculated when the TextArea placeholder was dynamically updated [@nekocode](https://github.com/nekocode) [#1690](https://github.com/DouyinFE/semi-design/pull/1690)
- 【Docs】
    - Fixed the links to the zh-CN version in english docs [@ederzz](https://github.com/ederzz) [#1691](https://github.com/DouyinFE/semi-design/pull/1691)

#### 🎉 2.38.1 (2023-07-05)
- 【Fix】
    - Fixed the problem that when the AutoComplete panel is open, the option panel cannot be closed by clicking outside, the scope of influence (2.38.0)

#### 🎉 2.38.0 (2023-06-30)
- 【Fix】
    - Fixed the problem that AutoComplete cannot be selected by long pressing, and onSelect is not triggered [#1665](https://github.com/DouyinFE/semi-design/issues/1665)
    - Fixed Cascader disabled tag bg color [#1651](https://github.com/DouyinFE/semi-design/pull/1651)
    - Fixed the warning caused by the misspelling of the min-Width attribute, the scope of influence (2.37.0-beta.0 - 2.38.0-beta.0) [#1680](https://github.com/DouyinFE/semi-design/issues/1680)
    - Fixed the problem that the tooltip does not disappear with a small probability in special scenes under the condition of custom trigger [#1676](https://github.com/DouyinFE/semi-design/pull/1676)
    - Fixed the problem in the value value of the onChange callback that the id item in the treeData data cannot appear in the Select when changeWithObject [#1678](https://github.com/DouyinFE/semi-design/issues/1678)
- 【Design Token】
    - Toast padding token is split into 4. $spacing-toast_content-paddingY is split into $spacing-toast_content-paddingTop, $spacing-toast_content-paddingBottom, and $spacing-toast_content-paddingX is split into $spacing-toast_content-paddingLeft, $spacing-toast_content-paddingRight [#1674](https://github.com/DouyinFE/semi-design/pull/1674)

#### 🎉 2.37.1 (2023-06-28)
- 【Design Token】
    - Card type Radio adds 3 new tokens: $color-radio_cardRadioGroup-bg-default is used to control the background color in the default state, $color-radio_cardRadioGroup_border-default is used to control the border background color in the default state, $color-radio_cardRadioGroup_disabled-bg -active is used to control the background color of the disabled state and pressed. [#1675](https://github.com/DouyinFE/semi-design/pull/1675)

#### 🎉 2.38.0-beta.0 (2023-06-26)
- 【Feat】
  - Tree add filterExpandedKeys parameter for onSearch
  - Badge add succss type
- 【Fix】
  - Fixed toast useToast return value no effect when user function component re render.
  - Fixed the problem that the disabled Cascader cannot display redundant Tags by hovering the +N part
  - Fixed the problem that className does not take effect in ImagePreview  [#1657](https://github.com/DouyinFE/semi-design/issues/1657)
- 【Chore】
  - Fixed formApi.reset params type define error
- 【Style】
  - In the disabled case, clicking the Cascader does not trigger the focus style

#### 🎉 2.37.0 (2023-06-09)
- 【Fix】
    - Fixed the problem that preventScroll of TreeSelect searchAutoFocus does not take effect
    - Fixed the problem that preventScroll does not take effect when autofocus is true in Input
    - Fixed the problem that the thumbnail rendering is not updated after Upload updates the fileInstance in beforeUpload

#### 🎉 2.37.0-beta.0 (2023-06-05)
- 【Feat】
    - Pagination support disabled API [#1641](https://github.com/DouyinFE/semi-design/pull/1641)
    - DatePicker insetInput input box supports clearing input box content through trigger [#1638](https://github.com/DouyinFE/semi-design/issues/1638)
    - Add the function of transparently passing data-* class attributes to all components [#1597](https://github.com/DouyinFE/semi-design/issues/1597)
- 【Fix】
    - DatePicker preset panel title supports i18n [#1643](https://github.com/DouyinFE/semi-design/pull/1643)
    - Fixed DatePicker insetInput input box placeholder placeholder text error [#1638](https://github.com/DouyinFE/semi-design/issues/1638)
    - Fixed DatePicker range input clear icon color bug [#1638](https://github.com/DouyinFE/semi-design/issues/1638)
    - the stopPropagation and preventDefault of the up and down arrow press events are triggered only when the Dropdown panel is visible[#1640](https://github.com/DouyinFE/semi-design/pull/1640)
- 【Style】
    - Set the default line break rules for content in Tooltip, Toast, and Notification [#1623](https://github.com/DouyinFE/semi-design/pull/1623)

#### 🎉 2.36.0 (2023-05-26)
- 【Fix】
  - Fixed the problem that in the multi-day mode of the Calander, the non-full-day schedule is not displayed when the range includes time [@sylingd](https://github.com/sylingd)
  - Fixed the problem that the event parameter in Upload customRequest onSuccess is optional, but the ts type declaration is required
  - Fixed the problem that ImagePreview IntersectionObserver throw error when using under SSR（effect version 2.34.1 ~ 2.36.0-beta.0）[#1595](https://github.com/DouyinFE/semi-design/issues/1595)

#### 🎉 2.36.0-beta.0 (2023-05-22)
- 【Feat】
  - DatePicker support startYear and endYear  [#1620](https://github.com/DouyinFE/semi-design/issues/1620)
  - add custom top events area rendering for calendar. [@sylingd](https://github.com/sylingd)
  - add custom date rendering or calendar. [@sylingd](https://github.com/sylingd)
  - The showTooltip API of Anchor supports object type
  - Typography.Title added weight API to set font weight.
  - Select add new ref method search
  - Nav add expandIcon to replace default arrow icon；Nav.Footer add onClick callback  [#1611](https://github.com/DouyinFE/semi-design/issues/1611)
- 【Fix】
  - Fixed TimePicker timeZone conversion problem when date-fns-tz version >= 1.3.8
  - Fixed the wrong style of Radio and Checkbox in ReactNode passed in through the tab API in Tabs  [#1615 ](https://github.com/DouyinFE/semi-design/issues/1615)
  - When calendar's displayValue changed, the results of events rendering is wrong. [@sylingd](https://github.com/sylingd)
  - Remove the ellipsis warning when omitting is not enabled in Typography
  - Fixed Table header column align bug（v2.34 ~ 2.35 affected）  [#1599](https://github.com/DouyinFE/semi-design/issues/1599)
  - remove the outermost vertical-align top style of DatePicker  [#1561](https://github.com/DouyinFE/semi-design/issues/1561)
  - Fixed the problem that select the parameter type of handleInputChange does not match the parameter type of Input onChange
- 【Design Token】
  - Typography Add  `$font-typography_title1-fontWeight` `$font-typography_title2-fontWeight` `$font-typography_title3-fontWeight` `$font-typography_title4-fontWeight` `$font-typography_title5-fontWeight` `$font-typography_title6-fontWeight` tokens. Used to control the font weight of different levels of Header respectively
- 【Docs】
  - Tabs、Typography update notice tips
  - Fixed some wrong spell of Slider [@inottn](https://github.com/inottn)

#### 🎉 2.35.0 (2023-05-12)
- 【Fix】
    - Fixed the problem that the Dropdown item is abnormal after switching tabs in collapsible Tabs
    - Fixed select is single select and renderSelectedItem, the placeholder is not displayed when the value is null
    - Fixed the problem that the vertical slider click jump value is wrong in some situations

#### 🎉 2.35.0-beta.0 (2023-05-10)
- 【Fix】
    - Avatar Cascader form input font weight use $font-weight-bold

#### 🎉 2.34.2 (2023-05-09)
- 【Fix】
    - When Input type=search and showClear is true, the original clear button and the Semi clear button are displayed at the same time  [#1598](https://github.com/DouyinFE/semi-design/issues/1598)
    - Fixed DatePicker disabledDate cannot select disabled border dates  [#1592 ](https://github.com/DouyinFE/semi-design/issues/1592)

#### 🎉 2.34.1 (2023-05-06)
- 【Fix】
  - Fixed the problem that when BreadCrumb sets moreType to popover and MaxItem to a non-default value, the number of contents in the popup layer is incorrect [#1590](https://github.com/DouyinFE/semi-design/pull/1590)
  - Fixed the judgment logic when DatePicker timeZone is an integer value, and replace the IANA region identifier with IANA Etc/GMT [#1585](https://github.com/DouyinFE/semi-design/issues/1585)

#### 🎉 2.34.0 (2023-04-28)
- 【Fix】
  - Fixed the issue where Table SSR was not rendering correctly [#1466](https://github.com/DouyinFE/semi-design/issues/1466)
  - Fixed the issue where Form.InputGroup was not controlled by Form disabled [#1575](https://github.com/DouyinFE/semi-design/pull/1575) [@xiaoqqchen](https://github.com/xiaoqqchen)
  - Fixed the issue where Typography was truncating incorrectly when the parent or itself was set to white-space: nowrap [#1577](https://github.com/DouyinFE/semi-design/issues/1577)
  - Fixed the issue where Image src changes in lazy loading mode, and the image cannot be loaded normally [#1526](https://github.com/DouyinFE/semi-design/issues/1526)

#### 🎉 2.34.0-beta.0 (2023-04-25)
- 【Feat】
  - Table column supports text content abbreviation by configuring ellipsis or ellipsis.showTitle API  [#1318](https://github.com/DouyinFE/semi-design/issues/1318)
  - Cascader add  focus blur methods  [#566 ](https://github.com/DouyinFE/semi-design/issues/566) [@meakle](https://github.com/meakle)
  - add rspack plugin, feature align webpack plugin [@Asuka109](https://github.com/Asuka109)
- 【Fix】
  - Fixed the problem that if the TimePicker range mode selects the end time first, it will cause an error  [#1563 ](https://github.com/DouyinFE/semi-design/issues/1563)
  - Steps is changed to display the hover state only when Steps is passed to onChange or Steps.Step is passed to onClick.
  - Fixed the problem that the height of the RadioGroup parent container will change with the RadioGroup option  [#1573 ](https://github.com/DouyinFE/semi-design/issues/1573)
  - Fixed last week got wrong style in Calendar component with `month` mode [@sylingd](https://github.com/sylingd)
  - Typography ellipsis disappear when resize to larger and back [@marshcat0](https://github.com/marshcat0)
  - Typography expanded may change to true after resize [@marshcat0](https://github.com/marshcat0)
  - Typography  expand may show when not overflow [@marshcat0](https://github.com/marshcat0)
- 【Style】
  - The default word wrap style of Table text is changed from break-all to break-word  [#1318](https://github.com/DouyinFE/semi-design/issues/1318)
  - Changed the spacing between icon and text in BreadCrumb from 8px to 4px（Affects v2.0.0～v2.33.1）
- 【Breaking Change】
  - **In order to solve the word wrapping problem, the Table word break style is modified from break-all to break-word. If a column of a non-fixed table is set to a fixed width, the cell text in this column will originally be folded, but will now be stretched and displayed, causing the width of other columns to be reduced** [#1318](https://github.com/DouyinFE/semi-design/issues/1318)


#### 🎉 2.33.1 (2023-04-21)
- 【Fix】
    - Fixed the issue that Popover StopPropagation did not stop the bubbling of the focus and blur triggered in the Portal layer [#1557](https://github.com/DouyinFE/semi-design/pull/1559)
    - Fixed the problem of Input reporting error about noBg props, the scope of influence is 2.33.0-beta.0 - 2.33.0
    - Fixed the indent problem when Table hideExpandedColumn is false [#1556](https://github.com/DouyinFE/semi-design/issues/1556)

#### 🎉 2.33.0 (2023-04-14)
- 【Fix】
    - Fixed the problem that items with the same label cannot be dragged when the draggable item in Transfer uses the label as the key of the SortableItem
    - Fixed the problem that the prefixCls configured by Webpack plugin does not take effect when using cjs lib [#1544](https://github.com/DouyinFE/semi-design/pull/1544)
    - Fixed the problem that the background content of the mask cannot be clicked when the Sidesheet is set to mask=false, and the impact range is 2.32.0-beta.0 ~ 2.33.0-beta.0 [#1550](https://github.com/DouyinFE/semi-design/pull/1550)
    - Fixed rangeStart and rangeEnd in DatePicker disabledDate callback using cached values [#777](https://github.com/DouyinFE/semi-design/issues/777)

#### 🎉 2.33.0-beta.0 (2023-04-10)
- 【Fix】
    - Change the vertical-align of copy/copied icon in Typography from text-bottom to middle [#1533](https://github.com/DouyinFE/semi-design/pull/1533)
    - Align hover and active states of form input components Input TextArea Select Cascader TimePicker DatePicker TreeSelect [#1537](https://github.com/DouyinFE/semi-design/pull/1537)
    - Fixed Typography copyable type [@baranwang](https://github.com/baranwang) [#1546](https://github.com/DouyinFE/semi-design/pull/1546)
- 【Feat】
    - Form input class components Input TextArea Select Cascader TimePicker DatePicker TreeSelect Added borderless api for displaying borderless components [#1537](https://github.com/DouyinFE/semi-design/pull/1537)
    - Collapse Added clickHeaderToExpand for setting click response hotspots [#1537](https://github.com/DouyinFE/semi-design/pull/1537)

#### 🎉 2.32.1 (2023-04-06)
- 【Fix】
    - Fixed the problem that an error may be reported when Tooltip is used in conjunction with the loading button in the production environment [#1540](https://github.com/DouyinFE/semi-design/pull/1540)
    - Fixed the problem that Navigation uses JSX to configure Footer and Header, which may not be correctly recognized in the production environment [#1540](https://github.com/DouyinFE/semi-design/pull/1540)
    - Fixed the problem that the Column may not be recognized correctly in the production environment when the Table uses the JSX Children notation to configure Columns
 [#1540](https://github.com/DouyinFE/semi-design/pull/1540)
    - Fixed the problem that there are extra spaces in the Tab Pane classname [#1536](https://github.com/DouyinFE/semi-design/pull/1536)
-  【Docs】
    - Modify the wrong type definition of the filteredValue parameter in the onFilter API of Table [#1538](https://github.com/DouyinFE/semi-design/pull/1538)

#### 🎉 2.32.0 (2023-03-31)
- 【Fix】
    - Fixed Spin because the height of the .semi-spin-wrapper div is incorrect, causing the position to move up
    - Fixed the problem of using resizable Table and form at the same time in the dev environment to report an error [#1506](https://github.com/DouyinFE/semi-design/issues/1506)
    - Fixed the problem that the Table setting zebra pattern is invalid(Range of influence: v2.29 - 2.32)
    - Fixed the problem that the execution timing of Modal getPopupContainer is incorrect, it is expected to be executed when Modal is opened

#### 🎉 2.32.0-beta.0 (2023-03-28)
- 【Design Token】
  - Modal provides `$spacing-modal_content_fullscreen-top` to control the top height of the full screen, Sidesheet adds `$color-sideSheet_header-borderBottom` and `$width-sideSheet_header-borderBottom` to add a dividing line under the header, `$width-sideSheet_size-small` `$width-sideSheet_size-medium` `$width-sideSheet_size-large` controls the default expanded width
- 【Feat】
  - DatePicker added type monthRange
  - The TriggerRender API parameters of TreeSelect、 Cascader and Select support onSearch and onRemove respectively to support custom triggers to start searching and delete a single selected item
  - TreeSelect has added a clickTriggerToHide parameter to support setting whether to click the Trigger part to trigger the panel to close when the panel is open
  - DatePicker support open, close, focus, blur methods and onClickOutside callback  [#566](https://github.com/DouyinFE/semi-design/issues/566)
- 【Fix】
  - Fixed the problem that the style of the shortcut selection panel for DatePicker type month is not as expected, fix the problem that inconsistent panel width before and after enabling insetInput
  - Change the initial setting of the state in the constructor in Switch to avoid unexpected animations when used in other components

#### 🎉 2.31.3 (2023-03-31)
- 【Fix】
    - Fixed DatePicker timeZone conversion problem when date-fns-tz version >= 1.3.8  [#1522](https://github.com/DouyinFE/semi-design/issues/1522)
#### 🎉 2.31.2 (2023-03-24)
- 【Fix】
    - Fixed the problem that the delay props related to Nav tooltip does not take effect  [#1454](https://github.com/DouyinFE/semi-design/issues/1454)
    - Fixed When selecting remote and autoClearSearchValue is false, the optionList is not displayed correctly after updating, (range of impact: v2.28 - 2.31) [#1386](https://github.com/DouyinFE/semi-design/issues/1386)

#### 🎉 2.31.1 (2023-03-22)
- 【Chore】
    - Semi Webpack Plugin adds logic to directly retrieve NormalModule from the Compiler Instance [#1503](https://github.com/DouyinFE/semi-design/pull/1503)

#### 🎉 2.31.0 (2023-03-17)
- 【Fix】
    - Fixed the problem that the ratio of the new picture is incorrect after switching the ratio state of the preview picture and switching the picture in ImagePreview  [#1494 ](https://github.com/DouyinFE/semi-design/issues/1494)
    - Fixed the problem that the component is not re-updated after Carousel props.children is updated  [#1482 ](https://github.com/DouyinFE/semi-design/issues/1482)
    - Fixed the conflict between the Carousel ref method play and the mouseEnter event of autoPlay.hoverToPause, which does not have the highest priority
    - Fixed the wrong state of the selection box in the header of the second page after selecting all the Table  [#325](https://github.com/DouyinFE/semi-design/issues/325)
    - Select onSearch provides a second input parameter to solve the problem of indistinguishable 1. Automatically clear the input after selection to trigger onSearch, 2. Actively use backspace to clear the input to trigger onSearch 3. Click the clear icon to trigger onSearch and other different scenarios  [#867](https://github.com/DouyinFE/semi-design/issues/867)
    - Fixed confirmation button and cancel button not displaying the loading icon when returning promise (2.30 ~ 2.31 versions are affected)  [#1489](https://github.com/DouyinFE/semi-design/issues/1489)
    - Fixed the problem that the user needs to click the option twice to select it for single selection, searchable and search box in Trigger, virtualized TreeSelect  [#1487 ](https://github.com/DouyinFE/semi-design/issues/1487)
    
#### 🎉 2.31.0-beta.0 (2023-03-13)

- 【Feat】
    - Table fixed columns support RTL and Table support direction prop  [#1471](https://github.com/DouyinFE/semi-design/issues/1471)
    - Copy nodes in Typograpy support customization  [#1420](https://github.com/DouyinFE/semi-design/issues/1420)
    -  Popover Tooltip and other pop-up components support keepDOM, and support setting whether to keep internal components from being destroyed when they are closed [#1481](https://github.com/DouyinFE/semi-design/pull/1481)
- 【Fix】
    - Fixed the problem that Table column align does not automatically switch when RTL  [#1471](https://github.com/DouyinFE/semi-design/issues/1471)
    - Fixed the problem that  for the single-select, searchable, and Value-controlled Cascader in the search state, the value change causes the search value to change  [#1472](https://github.com/DouyinFE/semi-design/issues/1472)
    - Replace redundant type definitions with the optional operator [@thinkasany](https://github.com/thinkasany) [#1464](https://github.com/DouyinFE/semi-design/pull/1464)
- 【Style】
    - Process the content style in the Tag component according to the type of children, if the children are String, they can be omitted automatically, otherwise the styles will be aligned [#1475](https://github.com/DouyinFE/semi-design/pull/1475)
    - Fixed the problem that the cursor position of the input box is incorrect when the size is small or large in the single-choice, searchable Cascader  [#1468](https://github.com/DouyinFE/semi-design/issues/1468)

#### 🎉 2.30.2 (2023-03-09)
- 【Fix】
    - When a Form has an id passed in, x-form-id will use the passed id first
    - Fixed the problem that Tags cannot be gathered through the keyboard under Tooltip
    - Fixed the problem that the color of the button at the bottom of the danger type is incorrect when Modal is called imperatively

#### 🎉 2.30.1 (2023-02-27)
- 【Fix】
  - Fixed showTick bug in Dropdown(the bug affects 2.27.1 ~ 2.30.0) [#1457](https://github.com/DouyinFE/semi-design/issues/1457)

#### 🎉 2.30.0 (2023-02-23)
- 【Fix】
  - Fixed the problem that Modal did not delete the redundant div after the imperative call was closed  [#1415](https://github.com/DouyinFE/semi-design/issues/1415)
  - TreeSelect fixes the problem that the border color is abnormal when hovering in some scenes [#1416](https://github.com/DouyinFE/semi-design/pull/1446)
  - Fixed the wrong timing of onBlur/onFocus calls in TreeSelect [#1414](https://github.com/DouyinFE/semi-design/pull/1444)
  - Fixed the problem that preventScroll is not declared and not transparently transmitted in TreeSelect [#1414](https://github.com/DouyinFE/semi-design/pull/1444)
  - Fixed when the Tooltip is blocked on the right side, the floating layer drifts to the left side of the viewport [#1449](https://github.com/DouyinFE/semi-design/pull/1449)
- 【Design Token】
  - Select Add `$color-select-bg-focus` [#1416](https://github.com/DouyinFE/semi-design/pull/1446)

#### 🎉 2.30.0-beta.0 (2023-02-20)
- 【Breaking Change】
    - **Modify the calculation rules when the rule in the Numeral component is percentages**
- 【Feat】
    - Popconfirm supports A11y keyboard and focus  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Cascader supports calling the open/close method through ref
    - Optimize the display format of the date at the bottom of the DatePicker panel, and configure it according to different locale language habits [@jacob-lcs](https://github.com/jacob-lcs)
- 【Style】
    - Solid Tag close button adds hover state color var(--semi-color-white) and active state color var(--semi-color-white)(opacity 0.9), default color from var(--semi-color-white) Change to var(--semi-color-white)(opacity 0.8).
- 【Fix】
    - Fixed DatePicker panel moving in multiple mode  [#1422](https://github.com/DouyinFE/semi-design/issues/1422)
    - Fixed the wrong localeCode of nl-NL language pack, the scope of influence (v2.29.0-beta.0) [@jacob-lcs](https://github.com/jacob-lcs)

#### 🎉 2.29.0 (2023-02-10)
- 【Feat】
    - Locale add Swedish: sv_SE、 Polish: pl_PL、Dutch: nl_NL [#1410](https://github.com/DouyinFE/semi-design/issues/1410)
- 【Fix】
    - Optimize the display of singular and plural texts in Russian, Arabic, and Romanian
    - Fixed the dateTimeRange input display error of DatePicker component in insetInput controlled mode [#1413](https://github.com/DouyinFE/semi-design/issues/1413)
- 【Design Token】
    - Table Design Token changes before modification, modify the following Token default values: $color-table_body-bg-default, $color-table-bg-default, from var(--semi-color-bg-2) to var(-- semi-color-bg-1), $color-table_th-bg-default value changed from transparent to var(--semi-color-bg-1) [#1418](https://github.com/DouyinFE/semi-design/pull/1418)

#### 🎉 2.29.0-beta.0 (2023-02-06)
- 【Feat】
    - Form.InputGroup support extraText, extraTextPosition,  [#1313 ](https://github.com/DouyinFE/semi-design/issues/1313)
    - DatePicker insetInput supports passing placeholder  [#1343](https://github.com/DouyinFE/semi-design/issues/1343)
    - Transfer added renderSourceHeader and renderSelectedHeader APIs to allow users to customize the header information of the left and right panels [#1403](https://github.com/DouyinFE/semi-design/issues/1403)
    - Locale add Swedish: sv_SE、 Polish: pl_PL、Dutch: nl_NL [#1410](https://github.com/DouyinFE/semi-design/issues/1410)
- 【Fix】
    - Fixed the problem that the DatePicker panel is not updated after entering the date  [#1398](https://github.com/DouyinFE/semi-design/issues/1398)
    - Fixed when the visible prop changes, tooltips whose trigger is not hover/focus also delay showing/hiding [@marshcat0](https://github.com/marshcat0)
    - Optimize the problem of displaying singular and plural text in Russian, Arabic, and Romanian, involving components Pagination, Transfer, and Calendar [#1411](https://github.com/DouyinFE/semi-design/pull/1411)
- 【Docs】
    - Improve Form english document 
- 【Design Token】
    - Slider add ` $spacing-slider_handle-translateY`、`$spacing-slider_vertical_handle-translateX`、`$spacing-slider_dot-translateX`、`$spacing-slider_vertical_dot-translateY` Token，which is used to control the horizontal and vertical state handles and value scale lines horizontal and vertical offset [#1391](https://github.com/DouyinFE/semi-design/pull/1391)
#### 🎉 2.28.1 (2023-01-31)
- 【Fix】
    - Fixed DatePicker panel shifting bug when selecting date range [#1221](https://github.com/DouyinFE/semi-design/issues/1221)
    - Fixed the problem that OverflowList does not display normally in React18 strict mode [#1393](https://github.com/DouyinFE/semi-design/issues/1393)
    - Fixed the scroll bar that does not meet expectations when Select appears under the InputGroup [#1395](https://github.com/DouyinFE/semi-design/issues/1395)
    - Fixed the problem that Select loading spin not align vertical
-  【Docs】
    - Update LocaleProvider Demo，add Form、Image、Transfer usage [@jacob-lcs](https://github.com/jacob-lcs)

#### 🎉 2.28.0 (2023-01-18)
- 【Fix】
    - Fixed the incomplete type of TagInput showContentTooltip
    - Fixed the problem that the scroll bar behaves inconsistently when the TimePicker selection mode is normal and wheel [@frowhy](https://github.com/frowhy)
-  【Docs】
    - Update NextJs Project getting started
    - Update Remix Project getting started

#### 🎉 2.28.0-beta.1 (2023-01-17)
- 【Feat】
    - Select adds expandRestTagsOnClick API, the default value is false, in the case of multiple selection and maxTagCount exists, the remaining tags can be displayed when the panel is opened [#1353](https://github.com/DouyinFE/semi-design/pull/1353)
    - Added TabItem component for generating TabItem variants in C2D [#1374](https://github.com/DouyinFE/semi-design/pull/1374)
    - Cascader adds filterSorter API to support sorting search results [#1355](https://github.com/DouyinFE/semi-design/issues/1355)
    - Cascader adds filterRender API for custom rendering of search results [#1350](https://github.com/DouyinFE/semi-design/issues/1350)
    - Cascader / TreeSelect / Tree's filterTreeNode API adds data parameter [#1104](https://github.com/DouyinFE/semi-design/issues/1104)
    - The webpack plugin adds an overrideLoaderList option to support finer-grained customization of the loaders used in semi-related styles [#1353](https://github.com/DouyinFE/semi-design/pull/1353)
    - When using Modal declaratively, you can automatically control the loading state of the corresponding button by returning a promise through onOK and onCancel [#1369](https://github.com/DouyinFE/semi-design/issues/1369)
    - Select adds the ellipsisTrigger API, the default value is false, and the overflow tag can be adaptively processed when maxTagCount is set. When the width is insufficient, the last tag content will be truncated. After enabling this function, there will be a certain performance loss, and it is not recommended to use it in a large form scenario [#1353](https://github.com/DouyinFE/semi-design/pull/1353)
- 【Fix】
    - Fixed the problem that OverflowList does not display under the display flex layout [#1353](https://github.com/DouyinFE/semi-design/pull/1353)
    - Fixed the problem that the onOverflow callback is not triggered when the first item of OverflowList overflows [#1353](https://github.com/DouyinFE/semi-design/pull/1353)
    - Fixed the problem that the number of items in the overflow part near the top after the OverflowList items are changed is not as expected  [#1362 ](https://github.com/DouyinFE/semi-design/issues/1362)
    - Fixed the problem that select autoClearSearchValue=false not work under control mode [#1386](https://github.com/DouyinFE/semi-design/issues/1386)
    - Fixed the problem that Layout mount has-sider className is slow by one task cycle [#1361](https://github.com/DouyinFE/semi-design/issues/1361)
- 【Design Token】
    - Toast adds a new token for customizing different background colors in multi-color styles `$color-toast_warning_light-icon` `$color-toast_success_light-icon` `$color-toast_info_light-icon` `$color-toast_danger_light-icon` [#1371](https://github.com/DouyinFE/semi-design/pull/1371)

#### 🎉 2.27.1 (2023-01-12)
- 【Fix】
    - Fixed Form Field level validation. When using props.rules, there is a race condition asynchronous, and the validation performed later will be overwritten by the validation performed before  [#1375](https://github.com/DouyinFE/semi-design/issues/1375) [@SyMind](https://github.com/SyMind)
    - Fixed Form Field level validation. When using props.validate, there is a race condition asynchronous, and the validation performed later will be overwritten by the validation performed before,  [#1375 ](https://github.com/DouyinFE/semi-design/issues/1375)
- 【Docs】
    - Modify the treeData API type name in the Cascader / TreeSelect / Tree documentation to make it consistent with the code

#### 🎉 2.27.0 (2023-01-06)
- 【Fix】
    - Fixed the problem that after Select is configured with outerBottomSlot, outTopSlot, innerBottomSlot, and innerTopSlot, when hovering to the slot, the Option still maintains the focus style, which easily confuses users [#1370](https://github.com/DouyinFE/semi-design/pull/1370)
    - Fixed Tabs collapsible  has a probability of failure problem [#693](https://github.com/DouyinFE/semi-design/issues/693)
    - Fixed the problem that the internal variable prefixcls of Transfer does not use a small camel, which is different from other components (no impact on the usage side)[@MarchYuanx](https://github.com/MarchYuanx) [#1365](https://github.com/DouyinFE/semi-design/pull/1365)


#### 🎉 2.27.0-beta.0 (2023-01-03)
- 【Design Token】
    - Form Add top margin token `$spacing-form_label-marginTop` `$spacing-form_section_text-paddingTop` `$spacing-form_section_text-marginTop` in the label section of Form,
    - DatePicker add trigger border related token in range mode (width `$width -datepicker_range_trigger-border`, colors in various states `$color-datepicker_range_trigger-border` `$color-datepicker_range_trigger-border-hover` `$color-datepicker_range_trigger-border-active`)
    - Steps modify `$color-steps_item_left_number_icon- bg` `$color-steps_item_left_number_icon-icon` `$color-steps_item_process_left_number-icon` Description.
    - Breadcrumb add `$font-breadcrumb_loose-fontSize` `$font-breadcrumb_compact-fontSize`
    - Descriptions add `$font-descriptions_key_small-fontSize` `$font-descriptions_value_small-fontSize` `$font-descriptions_key_medium-fontSize` `$font-descriptions_value_medium-fontSize` `$font-descriptions_key_large-fontSize` `$font-descriptions_value_large-fontSize`，SideSheet add `$font-sideSheet_title-fontSize` tokens.
- 【Fix】
    - Fixed uuid mismatch warning in TabBar under SSR scenario [#1351](https://github.com/DouyinFE/semi-design/issues/1351) 

#### 🎉 2.26.0 (2022-12-27)
- 【Fix】
    - Fixed the problem that when TagInput is input in Chinese, the length of pinyin will be used to judge whether it exceeds maxLength  [#1347](https://github.com/DouyinFE/semi-design/issues/1347)

#### 🎉 2.26.0-beta.0 (2022-12-19)
- 【Fix】
    - An empty string that has not reached its maximum width shows an "expand/collapse" button and an ellipsis [@weeqe](https://github.com/weeqe) [#621](https://github.com/DouyinFE/semi-design/issues/621)
    - Fixed TypeError in TreeSelect when checkRelation = unRelated, value is not in treeData  [#1206](https://github.com/DouyinFE/semi-design/issues/1206)
    - Fixed the problem that the Grid component span is set to 0 and displays abnormally in response mode [@edc-hui](https://github.com/edc-hui) [#1314](https://github.com/DouyinFE/semi-design/issues/1314)
- 【Feat】
    - Table filter function supports not passing filters, and the filtering function is controlled by filteredValue  [#1201](https://github.com/DouyinFE/semi-design/issues/1201)

#### 🎉 2.25.2 (2022-12-19)
- 【Fix】
    - Fixed the problem that the automatic adjustment position is incorrect when the Tooltip position is topLeft [#1344](https://github.com/DouyinFE/semi-design/pull/1344)
    - Fixed the wrong style of TagInput when it is draggable [#1339](https://github.com/DouyinFE/semi-design/pull/1339)
    - Fixed the problem that the same element id in different svgs in semi-icons and semi-illustration display incorrectly when used at the same time [#1337](https://github.com/DouyinFE/semi-design/pull/1337)
    - Fixed the problem that there is still a drop-down box when the option in Select is empty and emptyContent=null [#1340](https://github.com/DouyinFE/semi-design/pull/1340)
    - Fixed the problem that react exceeds the maximum update depth when the number of items in OverflowList collapse mode is greater than 50


#### 🎉 2.25.0 (2022-12-09)
- 【Fix】
   - Fixed the problem that when the disabled switch is wrapped by Tooltip or Popover and the trigger is hover, it cannot be hidden correctly after the mouse is moved under the chrome browser [#1333](https://github.com/DouyinFE/semi-design/pull/1333)
   - Fixed the problem that the redundant parameters of Image are not transparently transmitted to the img node [#1334](https://github.com/DouyinFE/semi-design/pull/1334)
   - Fixed the problem of animation flickering of some components under React18 [#1270](https://github.com/DouyinFE/semi-design/pull/1270), [#1257](https://github.com/DouyinFE/semi-design/issues/1257)
   - Fixed the problem that Timepicker、TagInput with wrong borderRadius and height when using in InputGroup [#1268](https://github.com/DouyinFE/semi-design/issues/1268) [@edc-hui](https://github.com/edc-hui)

#### 🎉 2.25.0-beta.0 (2022-12-06)
- 【Feat】
  - Select、Cascader、Input、InputNumber、TreeSelect、AutoComplete、Datepicker、TImepicker add clearIcon, allow override default clear icon,  [#1309](https://github.com/DouyinFE/semi-design/issues/1309)
  - Cascader、Select、DatePicker、TimePicker、TreeSelect add dropdownMargin ，Dropdown、Popover add margin ，use same as tooltip margin
  - The TimePicker component whose type is timeRange supports passing in panelHeader and panelFooter in array format to set different headers and bottoms. [#1316](https://github.com/DouyinFE/semi-design/issues/1316) [@zk8080](https://github.com/zk8080)
  - TreeSelect adds a position parameter to control the direction of the pop-up layer 
- 【Fix】
  - Fixed the problem that the height display is incorrect when the virtualized Table has no data
  - Fixed tooltip flush when setting opacity through style
- 【Style】
  - Tag close button add hover and active color
  - Optimize the display method of Tag when the content exceeds the length, and automatically omit it [@SyMind](https://github.com/SyMind)

#### 🎉 2.24.3 (2022-12-05)
- 【Chore】
    - Improve type define of Form HOC : `withFormState`、`withFormApi`  [#1323](https://github.com/DouyinFE/semi-design/pull/1323)
    - Improve TS type define of Nav, add optional for callback params
#### 🎉 2.24.1 (2022-11-25)
- 【Fix】
    - Fixed DatePicker disabledDate interaction is not easy to use when type is month [#520](https://github.com/DouyinFE/semi-design/issues/520)

#### 🎉 2.24.0 (2022-11-25)
- 【Fix】
    - Fixed the page scrolling problem caused by opening the option panel when searchAutoFocus is true and searchPosition is in dropdown in TreeSelect  [#1306 ](https://github.com/DouyinFE/semi-design/issues/1306)
    - Fixed the excessive page scrolling interference caused by the scrollIntoView parameter when Tabs is collapsed and scrolled
    - Fixed other components derived from Input that click prefix/suffix will not focus Input properly  [#1237 ](https://github.com/DouyinFE/semi-design/issues/1237)
    - Fixed focus style issue when InputNumber sets innerButtons to true  [#1144 ](https://github.com/DouyinFE/semi-design/issues/1144)

#### 🎉 2.23.7 (2022-11-23)
- 【Fix】
    - Fixed the problem that the custom Header cannot be displayed when previewing a single image

#### 🎉 2.23.6 (2022-11-23)
- 【Fix】
    - Fixed the problem when trigger be blocked the wrapper did not offset in Tooltip

#### 🎉 2.24.0-beta.1 (2022-11-22)
- 【Style】
    - Adjust Highlight style, default highlight background
- 【Design Token】
    - Design Token : `@douyinfe/semi-theme-default` add global design Token `--semi-color-highlight-bg`、`--semi-color-highlight`

#### 🎉 2.24.0-beta.0 (2022-11-21)
- 【New Component】
    - Add Highlight Component [#1281](https://github.com/DouyinFE/semi-design/pull/1281)
- 【Feat】
    - Nav add getPopupContainer, can be used to specify a popover container in partial dark mode [#1277 ](https://github.com/DouyinFE/semi-design/issues/1277)
    - ImagePreview added crossOrigin parameter  [#1284 ](https://github.com/DouyinFE/semi-design/issues/1284)
    - The Form Field component transparently transmitting props.name to the underlying component for consumption, and no longer intercepts. The original influence on the field wrapper classname remains  [#1266](https://github.com/DouyinFE/semi-design/issues/1266)
    - Navigation adds renderWrapper API for easier use of routing libraries such as react-router [#1249](https://github.com/DouyinFE/semi-design/pull/1249)
- 【Perf】
    - Cache the FieldComponent component in the withField HOC to avoid repeated calculation of components in the default shouldMemo scenario and reduce repeated performance consumption in complex form scenarios [#1228](https://github.com/DouyinFE/semi-design/pull/1228)
- 【Style】
    - Modify the style of TagInput used in Cascader/TreeSelect [#1278](https://github.com/DouyinFE/semi-design/pull/1278)
- 【Fix】
    - Fixed the problem that when the Image component is previewing the image, the mouse wheel event will penetrate the popup layer, causing the content scrolling problem under the popup layer [#1289](https://github.com/DouyinFE/semi-design/pull/1289) [@edc-hui](https://github.com/edc-hui)
    - Remove TimePicker console.log [@jukrb0x](https://github.com/jukrb0x)
    - Fixed the issue that in the Select radio mode, when the filter is enabled, when you click to select to close the list, it will flash once  [#1207](https://github.com/DouyinFE/semi-design/issues/1207)

#### 🎉 2.23.3 (2022-11-15)
- 【Style】
    - Form Design Token is updated，`$spacing-form_label_extra_posBottom-marginTop`、`$spacing-form_label_extra_posMid-marginBottom`、`$spacing-form_label_extra_posMid-marginTop` is corrected to more semantically `$spacing-form_extra_posBottom-marginTop`、`$spacing-form_extra_posMid-marginBottom`、`$spacing-form_extra_posMid-marginTop` [#1272](https://github.com/DouyinFE/semi-design/pull/1272)
- 【Fix】
    - When selecting multiple selections, deleting Tag does not trigger aggregation but has aggregation style problems

#### 🎉 2.23.2 (2022-11-14)
- 【Fix】
    - Fixed the problem of the `Input` component reporting style props error in React 18 + NextJS SSR environment [#1262](https://github.com/DouyinFE/semi-design/issues/1262) [#1181](https://github.com/DouyinFE/semi-design/issues/1181)
- 【Style】
    - Fixed the problem that the spacing between the last line and other lines was inconsistent when there were multiple lines of content in `TagInput` [#1263](https://github.com/DouyinFE/semi-design/pull/1263)
    - Fixed the problem that  Form Label lost padding right（effect version v2.23.1） [#1258](https://github.com/DouyinFE/semi-design/pull/1258)
    - The Switch component Design Token is updated, adding `$spacing-switch_knob-left`; `$motion-switch_unchecked-translateX` is corrected to more semantically `$spacing-switch_unchecked-translateX` [#1267](https://github.com/DouyinFE/semi-design/pull/1267)

#### 🎉 2.23.1 (2022-11-11)
- 【Fix】
    - Fixed the problem that Transfer in Popover caused Popover to close unexpectedly when dragging [#1226](https://github.com/DouyinFE/semi-design/issues/1226)
    - Fixed the issue that the Transfer/ TagInput in the pop-up layer disappeared when the dragged item was dragged  [#1149](https://github.com/DouyinFE/semi-design/issues/1149)
    - Correct the translation error of the Table pager when it is displayed in Vietnamese (vi_VN) [@MrFatMeow](https://github.com/MrFatMeow) [#1252](https://github.com/DouyinFE/semi-design/pull/1252)
    - Fixed the case that the Select and Tooltip components did not process the incoming NaN [@edc-hui](https://github.com/edc-hui)[#763](https://github.com/DouyinFE/semi-design/issues/763) 
    - fixed the issue that Dropdown would trigger the screen to scroll to the top when the trigger is click
- 【Style】
    - Updated Form component Design Token, `$spacing-form_label_small-paddingTop` is corrected to `$spacing-form_switch_rating_marginY`, and the useless `$spacing-form_label-paddingRight` is removed; Correct the more accurate description [#1258](https://github.com/DouyinFE/semi-design/pull/1258)
    - Updated Tabs component Design Token, adding the Token related to the collapsed arrow button, allowing to customize the style of the arrow buttons in Tabs separately [#1251](https://github.com/DouyinFE/semi-design/pull/1251)

#### 🎉 2.23.0-beta.1 (2022-11-08)
- 【Feat】
    - Tooltip adds a margin parameter to calculate the increased redundancy value when overflowing, and autoAdjustOverflow provides a more intelligent position adjustment strategy when it is blocked
    - added IconConnectionPoint1、IconConnectionPoint2、 IconCalendarStroked、IconConfigStroked 、IconIssueStroked 、IconStoryStroked 、IconVersionStroked and other icons.
- 【Style】
    - The right icon in the Cascader menu item increases the left margin

#### 🎉 2.23.0-beta.0 (2022-11-07)
- 【Fix】
  - Fixed the inconsistency between the jump link hotspot and the onSelect hotspot when the Navigation item has a parameter link
  - Corrected Saturday, Sunday translated text of DatePicker when displayed in Turkish (tr_TR) [@habibokumus](https://github.com/habibokumus)
  - Fixed the scroll bar position not as expected when Table has fixed columns.
- 【Feat】
  - Add the onClose parameter to the renderTagItem API of TagInput to support deleting tags  [#1219 ](https://github.com/DouyinFE/semi-design/issues/1219)
  - Transfer provides a search method to allow users to manually trigger searches
- 【Chore】
  - Update Form interface, add generic pass to define values type [@Hokori23](https://github.com/Hokori23)
  - Add test case for Image component  [#1216 ](https://github.com/DouyinFE/semi-design/issues/1216)

#### 🎉 2.22.3 (2022-11-02)
- 【Docs】
    - Added accessibility (A11y) support to Semi site

#### 🎉 2.22.2 (2022-10-31)
- 【Fix】
    - Fixed the flickering problem when Tooltip and Popover components are closed (affecting v2.22) [#1225](https://github.com/DouyinFE/semi-design/issues/1225)

#### 🎉 2.22.0 (2022-10-28)
- 【Fix】
    - Fixed the issue of inconsistent width when the year-month selection mode is normal and wheel under DatePicker type="month"

#### 🎉 2.22.0-beta.2 (2022-10-26)
- 【Fix】
  - Fixed the problem that the restTagsPopoverProps API in Select is not set as optional, causing ts to report an error

#### 🎉 2.22.0-beta.1 (2022-10-26)
- 【Feat】
  - Typography adds a new Numeral component, based on the Text component, and adds attributes: rule, precision, truncate, parser, to provide the ability to process numerical values ​​in text separately [@uiuing](https://github.com/uiuing) [#1136](https://github.com/DouyinFE/semi-design/issues/1136)
  - TreeSelect adds showRestTagsPopover and restTagsPopoverProps parameters to support displaying redundant tags through popover [#1210](https://github.com/DouyinFE/semi-design/pull/1210)
  - Select added showRestTagsPopover and restTagsPopoverProps to support displaying redundant tags through popover [#1212](https://github.com/DouyinFE/semi-design/pull/1212)
  - Navigation add a11y support [#1195](https://github.com/DouyinFE/semi-design/pull/1195)
  - Modal SideSheet Tabs and Popover Tooltip and other pop-up layer components animation effects are changed from javascript to css. Added animation Token, which can support custom animation in DSM in the form of themes [#1150](https://github.com/DouyinFE/semi-design/pull/1150)
  - Optimize the animation effect of ScrollList in wheel mode [#1211](https://github.com/DouyinFE/semi-design/pull/1211)
  - The yearAndMonthOpts API has been added to DatePicker, which can be used to control the ScrollListItem of the year-month picker [#1211](https://github.com/DouyinFE/semi-design/pull/1211)
  - The second parameter of DatePicker disabledDate API adds the rangeInputFocus parameter to dynamically disable the date based on the current selection state [#1198](https://github.com/DouyinFE/semi-design/pull/1198)
  - Export LocaleConsumer Component [@Hokori23](https://github.com/Hokori23) [#1196](https://github.com/DouyinFE/semi-design/pull/1196)
- 【Fix】
  - Fixed hooks Modal motion=false not take effect bug [#1217](https://github.com/DouyinFE/semi-design/pull/1217)
  - Update the type of render of the Columns property of the Table component [@Assone](https://github.com/Assone) [#1209](https://github.com/DouyinFE/semi-design/pull/1209)
  - Fixed when motion is false in Cascader, after searching for the selected value, the panel display is still the searched option after the panel is collapsed and then opened  [#1199 ](https://github.com/DouyinFE/semi-design/issues/1199) 
  - Fixed an issue with React-specific API calls in Foundation code [#1189](https://github.com/DouyinFE/semi-design/issues/1189)
  - Fixed Table defaultFiltertedValue and defaultSortOrder not included in onChange  [#1188](https://github.com/DouyinFE/semi-design/issues/1188)
  - Fixed the issue that Children display would be triggered twice when popover, ToolTip, Dropdown and other popup components were set to true [#1174](https://github.com/DouyinFE/semi-design/issues/1174)
  - Change the component that implements the expand/collapse animation in NodeList from the Collapse component in the Tree to the public Collapsible component [#1182](https://github.com/DouyinFE/semi-design/pull/1182)
  - Fixed an issue where the removal of the Collapsible ancestor element from the render tree caused the height calculation to be abnormal and unable to expand [#1174](https://github.com/DouyinFE/semi-design/issues/1174)
  - Fixed that when the Collapsible content area was removed from the render tree, the height calculation was abnormal and it could not be expanded [#1174](https://github.com/DouyinFE/semi-design/issues/1174)
  - Fixed the height change of the Collapsible content area causing the collapse animation of the height change area to not be displayed when collapsed [#1174](https://github.com/DouyinFE/semi-design/issues/1174)
- 【Style】
  - Fixed the problem that some packaging strategies caused the padding of NavItem in Dropdown to not meet expectations [#1204](https://github.com/DouyinFE/semi-design/pull/1204)
- 【Docs】
  - Update the documentation of the Columns property of the Table component [@Assone](https://github.com/Assone) [#1209](https://github.com/DouyinFE/semi-design/pull/1209)
- 【Breaking Change】
  - Changed the ScrollListItem used in TimePicker and DatePicker from mode wheel to mode normal to make it more suitable for PC [#1211](https://github.com/DouyinFE/semi-design/pull/1211)


#### 🎉 2.21.1 (2022-10-13)
- 【Fix】
  - Fixed Modal esc key trigger event callback after closed


#### 🎉 2.21.0 (2022-10-12)
- 【Fix】
  - Fixed the problem that the timer is not updated when carousel switches the index through the left and right buttons or methods
- 【Docs】
  - Update docsite homepage, add showcase

#### 🎉 2.21.0-beta.1 (2022-10-10)
- 【Fix】
  - Fixed AutoComplete e.target is null in onBlur callback

#### 🎉 2.21.0-beta.0 (2022-10-08)
- 【Feat】
  - Table adds header sticky API
  - AutoComplete add new API onKeyDown
  - the Upload component exposes the openFileDialog method so that the user can manually open the file selection dialog.
  - LocaleProvider added Romanian(ro) [@jacob-lcs](https://github.com/jacob-lcs)
- 【Fix】
  - Fixed the problem that children onKeydown cannot get events under Dropdown
  - Fixed the problem that the timer is not updated when Carousel switches the index through the left and right buttons or methods
  - Fixed Select when the filter is true and the input box is empty, after closing panel trigger onSearch function issue
- 【Style】
  - add rounded corners to square avatars
#### 🎉 2.20.8 (2022-10-11)
- 【Fix】
  - Fixed the problem that the position of the first Option option is offset when the Select is virtualized  [#1178](https://github.com/DouyinFE/semi-design/pull/1178)
- 【Style】
  - The default maxHeight value of Select (the max height of the Option floating layer), the default height of virtualization is `300px` -> `270px`
  - Select Design Token changed, abandoned `$spacing-select_option_first-marginTop`、`$spacing-select_option_last-marginBottom` ；
Change ：`$spacing-select_option_list-paddingTop` 、`$spacing-select_option_list-paddingBottom` ， from 0 to `$spacing-extra-tight` (4px)
- 【Chore】
    - Form export RuleItem Interface  



#### 🎉 2.20.7 (2022-10-10)
- 【Fix】
  - Fixed the problem that the style is lost when only ImagePreview is introduced and used alone, and the Image component is not introduced[#1175](https://github.com/DouyinFE/semi-design/pull/1175)

#### 🎉 2.20.3 (2022-09-28)
- 【Fix】
  - Fixed the ButtonGroup key warning problem
  - Fixed SSR setting withField、Form Field related problem with useLayoutEffect warning [#1140](https://github.com/DouyinFE/semi-design/pull/1140)
  - Fixed the problem of some type errors under typescript 4.8.3
  - Modify the modal focus logic to automatically focus on the first focusable element in the pop-up window

#### 🎉 2.20.2 (2022-09-27)
- 【Fix】
  - Fixed warning about corejs in @douyinfe/semi-icons 

#### 🎉 2.20.1 (2022-09-27)
- 【Style】
  - Image global variable plus !default is used for theme configuration fault tolerance [#1151](https://github.com/DouyinFE/semi-design/pull/1151)

#### 🎉 2.20.0 (2022-09-23)
- 【Fix】
  - Fixed the issue that Form.InputGroup does not support FormProps.wrapperCol , labelCol layout
  - Fixed the drag and drop problem after the Image preview is enlarged
  - Fixed DataPicker component foundation contains React related type definitions [@rashagu](https://github.com/rashagu)
  - Fixed the problem that the foundation of Navigation and Tree components reports errors in high versions of typescript [@rashagu](https://github.com/rashagu)
  - Fixed the expansion of the controlled tree when the data was loaded remotely unsuccessfully [#1124](https://github.com/DouyinFE/semi-design/issues/1124)
  - Fixed ButtonGroup does not support style API issue
  - Fixed the problem that when the virtualized Table has a fixed column on the left, the first rendering of the fixed column on the left will have an extra box-shadow [#1134](https://github.com/DouyinFE/semi-design/issues/1134)


#### 🎉 2.20.0-beta.1 (2022-09-20)
- 【Fix】
    - Fixed the issue that `@douyinfe/semi-foundation` Image relative file not export

#### 🎉 2.20.0-beta.0 (2022-09-19)

- 【New Component】
    - Add Image Component(Added basic sass, global sass variables, need to republish if using a custom theme) [#344](https://github.com/DouyinFE/semi-design/issues/344)
- 【Feat】
    - Tag add shape property, supports `square`、`circle` [#89](https://github.com/DouyinFE/semi-design/issues/89)
    - Progress supports automatically filling gradient colors according to progress, and automatically switching colors according to progress presets [#1092](https://github.com/DouyinFE/semi-design/issues/1092) [@uiuing](https://github.com/uiuing)
    - Toast supports dynamic modification of content by ID [#1035](https://github.com/DouyinFE/semi-design/issues/1035) [@gwsbhqt](https://github.com/gwsbhqt)
    - Skeleton.Avatar supports shape property [#1117](https://github.com/DouyinFE/semi-design/issues/1117) [@MuxinFeng](https://github.com/MuxinFeng)
- 【Chore】
    - Remove the ts source code in the package product of @douyinfe/semi-ui, leaving only the lib and dist directories
    - Modify the writing of some components scss, convert division into multiplication and math.div syntax, to avoid the problem of repeatedly throwing warnings when compiling higher versions of sass
  
#### 🎉 2.19.0 (2022-09-09)
- 【Fix】
    - Fixed the issue that the keyboard focus style is blocked after the Anchor spacing can trigger the selection
    - Fixed the issue that the Select onblur event was not triggered when the panel was closed
    - Fixed Anchor spacing in front of anchor text cannot trigger selection [@edc-hui](https://github.com/edc-hui)
    - Fixed the problem that the location of event rendering did not change after Calendar weekStartsOn was changed
    - Fixed the problem that Input onEnterPress event does not take effect when using Input in DropDown
    - Fixed the problem that tagGroup pollutes incoming tagList data  [#1107 ](https://github.com/DouyinFE/semi-design/issues/1107)
    - Fixed DatePicker time will be set 8:00 when switch month and type is dateTime [@rojer95](https://github.com/rojer95)
- 【Chore】
    - Remove corejs deps in semi-foundation semi-ui.


#### 🎉 2.19.0-beta.0 (2022-09-05)
- 【Feat】
  - Popconfirm's onOk and onCancel support Promise type return value and close asynchronously [#1056](https://github.com/DouyinFE/semi-design/issues/1056)
- 【Fix】
  - Fixed Popconfirm multiline content style bug [#868](https://github.com/DouyinFE/semi-design/issues/868)
  - Fixed DefaultTabBar type error [#1077](https://github.com/DouyinFE/semi-design/pull/1077)
  - Fixed the TS error when the Form level is set to autoComplete to false
  - Fixed an issue where Slider was incorrectly positioned when passing in partial steps values [#1043](https://github.com/DouyinFE/semi-design/issues/1043)
  - Fixed Tag tagKey type definition error problem [#1081](https://github.com/DouyinFE/semi-design/pull/1081)
  - Fixed incorrect value when RadioGroup was first rendered [#1060](https://github.com/DouyinFE/semi-design/pull/1060)
- 【Style】
  - Add overflow: auto default style to Sidesheet body, you no longer need to add overflow related styles through props.bodyStyle when the content exceeds [#1098](https://github.com/DouyinFE/semi-design/pull/1098)
- 【Refactor】
  - Replace margin layout in Checkbox with flex layout and gap [#1073](https://github.com/DouyinFE/semi-design/pull/1073)
  - Dividers in ButtonGroup use span tags instead of border-right [#1065](https://github.com/DouyinFE/semi-design/pull/1065)
  - Refactored Radio's layout, removed some absolute positioning, and used flex layout instead [#1060](https://github.com/DouyinFE/semi-design/pull/1060)
- 【Breaking Change】
  - When using CheckboxGroup, if the child Checkbox is nested with a layer of elements such as div or span, then the Checkbox will not have margin-bottom. Styling each Checkbox nested element individually is unaffected [#1073](https://github.com/DouyinFE/semi-design/pull/1073)
  
#### 🎉 2.18.2 (2022-08-31)

- 【Fix】
    - Update @douyinfe/semi-webpack-plugin to fix the error that animation.scss cannot be processed when using a custom theme  [#1072](https://github.com/DouyinFE/semi-design/issues/1072)
- 【Docs】
    -  Added [Global content guidelines](/en-US/), Component content guidelines

#### 🎉 2.18.0 (2022-08-26)
- 【Feat】
    - Add type API for Checkbox & Radio
- 【Chore】
    - Remove semi-animation-react's peerDependences : react-dom, react, prop-type
- 【Fix】
    - Fixed tabs collapse mode will flush in some screen  [#1039 ](https://github.com/DouyinFE/semi-design/issues/1039)
    - Fixed the left of the emptyContent parameter of Transfer does not take effect  [#1068 ](https://github.com/DouyinFE/semi-design/issues/1068)
    - Fixed use useFormApi to get null value problem under React 18 createRoot + strictMode  [#1063 ](https://github.com/DouyinFE/semi-design/issues/1063)
- 【Docs】
    -  Popover / Popconfirm / Dropdown added FAQ

#### 🎉2.18.0-beta.0（2022-08-24）
- 【Feat】
    - Anchor、AutoComplete、Breadcrumb、Carousel、Cascader、Checkbox、DatePicker、Dropdown、Input、InputNumber、Navigation、Pagination、Radio、Rating、ScrollList、Select、SideSheet、Slider、Steps、Switch、Table、Tabs、TagInput、TimePicker、Transfer、Tree add animation token [#984](https://github.com/DouyinFE/semi-design/issues/984)
    - Anchor add A11y focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Form Label add optional config，if true, will auto append optional mark after label text  [#869](https://github.com/DouyinFE/semi-design/issues/869)
    - Calendar support weekStartsOn  [#1020](https://github.com/DouyinFE/semi-design/issues/1020)
    - Tree adds support for scrollTo method in virtualization scenarios  [#1024](https://github.com/DouyinFE/semi-design/issues/1024)
    - TagGroup adds onTagClose callback
- 【Fix】
    - Fixed the issue that the Select check icon will flicker [@linjunc](https://github.com/linjunc)
    - Fixed the problem that the quantity indicator does not change after TagGroup closable is closed [#945](https://github.com/DouyinFE/semi-design/issues/945) [@linjunc](https://github.com/linjunc)
    - Fixed  the problem that centered Modal was blurry on a few 1080p monitors
- 【Style】
    - Table increases the click hot area of the sorting button (from the icon area only to the area containing the title and sorting, if the title is fully custom rendered, it will not be affected)[#1031](https://github.com/DouyinFE/semi-design/pull/1031)


#### 🎉2.17.1 (2022-08-17)

- 【Fix】
    - Fixed Table filter affects original order of data [#1036](https://github.com/DouyinFE/semi-design/issues/1036)
    - Fixed the issue that AutoComplete did not open the panel after the input value was changed after focusing by tab or autoFocus (effect version: v2.14 - 2.17)

#### 🎉2.17.0 (2022-08-12)

- 【Fix】
    - Fixed the popover style issue caused by Chromium 104 breakchange fit-content css [#1022](https://github.com/DouyinFE/semi-design/issues/1022) [Chromium Issue](https://bugs.chromium.org/p/chromium/issues/detail?id=1350958)
    - Fixed AvatarGroup component size attribute has no default in TS define [@AnoyiX](https://github.com/AnoyiX)
    - Fixed TimePicker set to undefined is unresponsive [#918](https://github.com/DouyinFE/semi-design/issues/918) [@linjunc](https://github.com/linjunc)
    - Fixed the problem that Tree's renderFullLabel uses checkbox

#### 🎉 2.17.0-beta.1 (2022-08-09)
- 【Fix】
    - Fixed the problem that the Empty component is unexpectedly judged as dark mode when the body theme-mode attribute is unexpected [#1023](https://github.com/DouyinFE/semi-design/issues/1023)
    - Fixed the problem that the treeData and value of cascader are dynamically updated, and the selected value is not displayed correctly [#703](https://github.com/DouyinFE/semi-design/issues/703)

#### 🎉 2.17.0-beta.0 (2022-08-09)
- 【Feat】
    - Select add A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - DatePicker preset support presetPosition  [#895 ](https://github.com/DouyinFE/semi-design/issues/895)
    - TagInput supports drag and drop sorting.
    - Collapse.Panel add two API: disabled and showArrow  [#188 ](https://github.com/DouyinFE/semi-design/issues/188)
- 【Fix】
    - Fixed the problem that when the Tooltip trigger is hover, click on children and then click on the pop-up layer, the pop-up layer will be hidden  [#977 ](https://github.com/DouyinFE/semi-design/issues/977)

#### 🎉 2.16.1 (2022-08-05)
- 【Fix】
    - Fixed the problem that letters and numbers cannot be entered when using input class components in Dropdown
    - Fixed the problem of default icon of password input in windows edge browser [@linjunc](https://github.com/linjunc)
    - Fixed click on the edge of the switch can not trigger the change problem [@linjunc](https://github.com/linjunc)
    - Fixed handle misspelling[@linjunc](https://github.com/linjunc)

#### 🎉 2.16.0 (2022-07-29)
- 【Fix】
    - Fixed the problem of wrong color in the pressed state of Input, and fix the problem that the colors of Input and TextArea are not uniform in the pressed state under validateStatus [#662](https://github.com/DouyinFE/semi-design/issues/662)
- 【Chore】
    - move prop-types to dependencies and remove @types/react and @types/react-dom [#993](https://github.com/DouyinFE/semi-design/issues/993)

#### 🎉 2.16.0-beta.0 (2022-07-25)
- 【Feat】
    - Cascader adds position API to control the direction of the bullet layer
    - Slider adds A11y focus and keyboard adaptation [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Fix】
    - Fixed the problem that it does not take effect when the noHorizontalPadding parameter type of Button is string
    - Fixed the issue that the item in the right panel can still be deleted and cannot be dragged after the item is disabled in the draggable Transfer
    - allows users to customize the type and theme of the Button individually through the parameters of the Button in the ButtonGroup
    - Fixed the problem that the width of TreeSelect arrows is not uniform after wrapping when multiple selections are made
- 【Docs】
    - Icon update custom icon example
#### 🎉 2.15.1 (2022-07-19)
- 【Fix】
    - Fixed the problem that @douyinfe/semi-illustrations failed to shaking [#961](https://github.com/DouyinFE/semi-design/issues/961)
    - Fixed the warning that the name of the custom attribute data-popupId is not lowercase [#969](https://github.com/DouyinFE/semi-design/issues/969)（影响范围 2.15.0）

#### 🎉 2.15.0 (2022-07-15)
- 【Fix】
    - Fixed the problem that when TreeSelect/Tree in multi-select state is wrapped by CheckboxGroup, clicking any option will cause all options to be displayed as selected [#750](https://github.com/DouyinFE/semi-design/issues/750)
    - Fixed DatePicker in triggerRender range selection scene to select date interaction issue [#676](https://github.com/DouyinFE/semi-design/issues/676)

#### 🎉 2.15.0-beta.0 (2022-07-11)
- 【Feat】
    - Support German, Italian and French [@jacob-lcs](https://github.com/jacob-lcs)
    - Dropdown add A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Components such as Cascader add the preventScroll property to prevent the focus method in the component from causing the page to scroll
    - Rating adds A11y focus and keyboard adaptation
    - Tooltip returnFocusOnClose supports trigger hover and focus
- 【Fix】
    - Fixed the problem that when the TreeSelect search box is in the trigger and there is a value in the search box, the second click will cause the search box to collapse and clear the search value.
    - Fixed the Cascader display error of single selection when setting filterTreeNode & displayRender at the same time
    - Fixed list empty padding [@rojer95](https://github.com/rojer95)
    - Fixed InputGroup setting disabled to false in the child does not take effect
    - Fixed the case-sensitive issue of tree search highlighting result
    - Fixed the virtual list occupying problem when virtualizing Table empty data [#942](https://github.com/DouyinFE/semi-design/issues/942)
    - Fixed the ts type check error when some Form Field components (such as Form.Upload, Form.Switch) pass in ref, indicating that there is no ref attribute

#### 🎉 2.14.0 (2022-07-01)
- 【Fix】
    - Fixed the issue that the Spin component has black rectangles in some scene contents in dark mode
- 【Chore】
    - Optimize Form interface BaseFormApi type definetion [#933](https://github.com/DouyinFE/semi-design/issues/933)


#### 🎉 2.14.0-beta.0 (2022-06-28)
- 【Feat】
    - Input Added A11y keyboard adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Avatar adds A11y focus and keyboard adaptation [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Radio adds A11y focus and keyboard adaptation [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - AutoComplete optimize A11y keyboard adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Fix】
    - Fixed Input passing defaultValue will report an error [#537](https://github.com/DouyinFE/semi-design/issues/537)
    - Fixed when setting collapsible = true, TabBar appears arrow when Tabs is scrolled out of viewport
    - Fixed some component foundation contains React related type definition problem  [#923](https://github.com/DouyinFE/semi-design/issues/923)
    - Tooltip and Popover no longer automatically wraps span on disabled elements when trigger is custom [#919](https://github.com/DouyinFE/semi-design/issues/919)
- 【Breaking Change】
    - The password button in Input is changed to be always displayed, and it was displayed when the input was hover or focus  [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Style】
    - Fixed TagInput suffix text color, changed from --semi-color-text-1 to --semi-color-text-2
    - Updated the secondary global color variable, and changed the referenced color scale from blue to light-blue. Before the modification, the secondary color variable was the same as the primary. After the modification, the visual contrast was weaker than the primary. Button, Badge, Steps, Dropdown components are affected.
    - Updating Select, Cascader, TreeSelect size='large', placeholder and radio text size, 14px -> 16px. Align with Input component [#859](https://github.com/DouyinFE/semi-design/issues/859)

#### 🎉 2.13.0 (2022-06-20)
- 【Fix】
    - Fixed the problem that Cascader crashes when the value passed in is undefined after setting onChange WithObject, multiple,  [#905](https://github.com/DouyinFE/semi-design/issues/905)
    - Fixed the issue that scroll bar style is invalid in some scenes
- 【Style】
    - Modal, TanPane, Upload add color text declaration to solve the problem of insufficient text color contrast in dark mode when color is not uniformly declared in the body container
    - Solve TimePicker range mode, border-radius is not displayed correctly in dark mode
    - The disabled TagInput can display the content of the +N part of the popover
- 【Design Token】
    - Tabs adds $color-tabs_tab-pane-text-default, Upload adds several tokens such as $color-upload_drag_area_main-text
- 【Docs】
    - Added example of searchRender API and search method

#### 🎉 2.13.0-beta.0 (2022-06-14)
- 【Feat】
    - `InputNumber` adds A11y keyboard and focus adaptation. which supports holding shift and up and down arrows at the same time in the input box to adjust a larger number range [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - `Checkbox` add A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - TagInput Click prefix, suffix to automatically focus to the internal Input [#874](https://github.com/DouyinFE/semi-design/issues/874) [@yykoypj](https://github.com/yykoypj)
    - Form.TagInput supports labelPosition: 'inset' inline label [#874](https://github.com/DouyinFE/semi-design/issues/874) [@yykoypj](https://github.com/yykoypj)
- 【Fix】
    - Fixed the problem that when Select filter and showClear are true, when clicking the clear icon, only onClear is triggered, but onSearch is not triggered, and after clearing the search item through the clear icon, the candidate Option list is not reset  [#867](https://github.com/DouyinFE/semi-design/issues/867)
    - Fixed the problem that onSearch is not triggered when Select filter is true, lose focus, and input input is reset automatically  [#867](https://github.com/DouyinFE/semi-design/issues/867)
    - Fixed the issue that if InputNumber is set to require validation, validation will be triggered when it is initialized in the form, and the behavior is inconsistent with other field component [@rojer95](https://github.com/rojer95)
    - Fixed AutoComplete defaultActiveFirstOption not taking effect in some scenarios [#892](https://github.com/DouyinFE/semi-design/issues/892)
- 【Breaking Change】
    - Adjust the default value of `InputNumber` shiftStep, from 1 to 10
- 【Design Token】
    - Update the color white in the style files of Avatar, Button, Radio, Steps, Switch, Tag and other components to --semi-white
    - Button component adds text color token in borderless mode [#898](https://github.com/DouyinFE/semi-design/pull/898)

#### 🎉 2.12.0 (2022-06-06)
- 【Fix】
    - Fixed the issue that the last item style is abnormal when Timeline is nested [#865](https://github.com/DouyinFE/semi-design/issues/865)
    - Fixed the problem that the height of emptyContent is incorrect when Select is virtualized and there is no data [#839](https://github.com/DouyinFE/semi-design/pull/839) [@tianenpang](https://github.com/tianenpang)

#### 🎉 2.12.0-beta.5 (2022-05-31)
- 【Fix】
    - Fixed the problem that Tooltip, Popover, Select and other components with floating layers will flicker when they are used under React 1 [#715](https://github.com/DouyinFE/semi-design/issues/715)
    - Fixed FocusHandle referencing lodash-es error (effects v2.12.0-beta.0 - v2.12.0-beta.2)

#### 🎉 2.12.0-beta.0 (2022-05-30)
- 【Feat】
    - `Modal` adds A11y keyboard and focus adaptation.  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - `Tabs` add A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - `Tag` add A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - `Progress` stroke support linear color  [#456](https://github.com/DouyinFE/semi-design/issues/456) [@vecpeng](https://github.com/vecpeng)
    - `Slider` supports clicking `marks` to change the slider position  [#618](https://github.com/DouyinFE/semi-design/issues/618) [@huruji](https://github.com/huruji)
- 【Fix】
    - Fixed `TreeSelect` TypeError when `checkRelation` is `unRelated` and `treeData` is `[]`
    - Fixed `InputNumber` `value` can be changed via stepper in `readonly` mode [@zwlafk](https://github.com/zwlafk)
- 【Design Token】
    - `Tag` solid `closable` icon token `$color-tag_close-icon_deep-default`

#### 🎉 2.11.2 (2022-05-24)
- 【Chore】
    - Fixed the problem that ts type check reported an error when Nav.Item configures the href attribute through linkOptions [#856](https://github.com/DouyinFE/semi-design/issues/856) [@SunriseFox](https://github.com/SunriseFox)

#### 🎉 2.11.0 (2022-05-23)
- 【Fix】
    - Fixed the problem that the return type of useModal typescript is not strict [#833](https://github.com/DouyinFE/semi-design/issues/833)
- 【Chore】
    - Simplify some types [#838](https://github.com/DouyinFE/semi-design/pull/838) [@huruji](https://github.com/huruji)

#### 🎉 2.11.0-beta.1 (2022-05-20)
- 【Fix】
  -  Fixed the issue that DatePicker incorrectly referenced the _utils/parse ts source file, resulting in an error

#### 🎉 2.10.2 (2022-05-20)
- 【Fix】
    - Fixed  Table onHeaderRow does not take effect when setting scroll prop  [#849](https://github.com/DouyinFE/semi-design/issues/849)
    - Fixed Select aria-controls are inconsistent in SSR scenarios  [#840](https://github.com/DouyinFE/semi-design/issues/840)

#### 🎉 2.11.0-beta.0 (2022-05-18)
- 【Feat】
    - After entering the full date in the DatePicker inset input box, the time input box automatically fills the default time  [#294](https://github.com/DouyinFE/semi-design/issues/294)
    - DatePicker range type supports entering start date or end date, the panel displays the specified date  [#294](https://github.com/DouyinFE/semi-design/issues/294)
- 【Fix】
    - Fixed the problem of needConfirm DatePicker that the date will be directly selected without confirmation after entering the date in the inset input box  [#742](https://github.com/DouyinFE/semi-design/issues/742)
    - Fixed the problem that `can't get properties of undefined` is prompted when using Form, Tabs, and Nav components in React 18 createRoot + strictMode strict mode #745  [#795 ](https://github.com/DouyinFE/semi-design/issues/795)
    - Fixed the problem that the upload list file does not meet expectations when the directory and draggable are true for the Upload component  [#827 ](https://github.com/DouyinFE/semi-design/issues/827)
    - Fixed a warning prompt on the console due to the parameter type problem when using a single Checkbox
    - Fixed Checkbox, Radio, Tooltip ARIA id inconsistency in SSR  [#719](https://github.com/DouyinFE/semi-design/issues/719)
    - Specification TagGroup tagList props type

#### 🎉 2.10.1 (2022-05-10)
- 【Fix】
    - Fixed the problem that when Select is inside the Popover, clicking Option will cause the outer Popover to be collapsed (the issue affects v2.5-v2.10) [#818](https://github.com/DouyinFE/semi-design/issues/818)

#### 🎉 2.10.0 (2022-05-07)
- 【Fix】
    - Fixed the error that `x-form-id` does not match on the server side and the client side when the Form component is used in `Nextjs`  [#808](https://github.com/DouyinFE/semi-design/issues/808) [@xuerzong](https://github.com/xuerzong)
    - Fixed the problem that when InputNumber is configured with precision, the input illegal characters will not be blank [#786](https://github.com/DouyinFE/semi-design/issues/786) [@MuxinFeng](https://github.com/MuxinFeng)
    - Fixed an issue where clicking the arrow switch or the indicator switch did not respond instantly when Carousel autoplayed
    - Fixed InputNumber controlled use and set the minimum value, the problem of not notifyChange when formatting the incoming value into the range  [#812](https://github.com/DouyinFE/semi-design/issues/812)
    - Fixed the problem of ts type checking error when ButtonGroup passes in multiple children [#811](https://github.com/DouyinFE/semi-design/issues/811)
- 【Docs】
    - A11y：Switch, Banner added keyboard and focus behavior description
    - Update Tabs component FAQ
- 【Chore】
    - Update the typo problem of some function names in `@douyinfe/semi-foundation`, which has no effect on users [#660](https://github.com/DouyinFE/semi-design/pull/660)

#### 🎉 2.10.0-beta.0 (2022-4-29)
- 【New Component】
    - new component Carousel  [#678](https://github.com/DouyinFE/semi-design/issues/678)
- 【Fix】
    - Fixed cascader's displayProp error when multiple selection
- 【Feat】
    - Switch adds A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Banner adds A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Chore】
  - @douyinfe/semi-icons, @douyinfe/semi-illustrations update react version statement in peerDependency: 16/17 -> 16/17/18

#### 🎉 2.9.1 (2022-04-26)
- 【Fix】
    - Fixed the Tooltip flickering when there is a probability that the overlay is opened when there is animation
    - Fixed the problem that pm/am could not be set correctly under the TimePicker component use12Hours [#776](https://github.com/DouyinFE/semi-design/issues/776), fix the problem that the TimePicker component could not return to the expected position after selecting the option upwards and clicking clear
    - Fixed the problem that the old value is used internally in the special case of Form Field validate [#796](https://github.com/DouyinFE/semi-design/issues/796)
- 【Style】
    - Fixed the problem that the border color is not right when Select focus and hover are applied at the same time

#### 🎉 2.9.0 (2022-04-22)
- 【Fix】
    - Fixed the issue that when TagInput is used in a Form, hitting enter would cause the submit event to be triggered  [#767](https://github.com/DouyinFE/semi-design/issues/767)
    - Fixed the problem that the useless div is left behind after the Modal imperative call
    - Fixed the problem that Collapse DOM has useless attributes
    - Remove Form label `user-select:none`， allow user select
    - Fixed Cascader clear button keyboard event not responding

#### 🎉 2.9.0-beta.0 (2022-04-18)
- 【New Component】
    - New Component Divider. [#721](https://github.com/DouyinFE/semi-design/issues/721) [@ZeroCodeLin](https://github.com/ZeroCodeLin)
- 【Feat】
    - Added support for ReactNode as key value for Descriptions' data prop [#734](https://github.com/DouyinFE/semi-design/issues/734) [@oddguan](https://github.com/oddguan)
- 【Fix】
    - Fixed controlled slider component can still trigger value change by clicking track. [#768](https://github.com/DouyinFE/semi-design/issues/768)
    - Fixed an issue where Badge could not be used with Tooltip [#761](https://github.com/DouyinFE/semi-design/issues/761) 
    - Fixed validateStatus type check lack success [#746](https://github.com/DouyinFE/semi-design/issues/746) [@rojer95](https://github.com/rojer95)
- 【Style】
    - **Update the centering method of Avatar text content from absolute positioning to centering by flex layout. If you override the style display to inline-block, then the text centering will not work** [#774](https://github.com/DouyinFE/semi-design/issues/774)


#### 🎉 2.8.1 (2022-04-19)
- 【Fix】
    - Update the ts type definition of the component to solve the type check error caused by @types/react v18 removing the default children declaration [#755](https://github.com/DouyinFE/semi-design/issues/755)

#### 🎉 2.8.0 (2022-04-08)
- 【Fix】
    - Upgrade the react-sortable-hoc version (v1.11.0 -> v2.0.0) that @douyinfe/semi-ui depends on, to solve the problem of unmeet peerDependency when using react 17 in the pnpm scenario, the react version is not satisfie,  [#747](https://github.com/DouyinFE/semi-design/issues/747)

#### 🎉 2.8.0-beta.1 (2022-04-03)
- 【Fix】
    - Fixed error throw due to unescaped characters during Select search [#734](https://github.com/DouyinFE/semi-design/issues/734) [@boenfu](https://github.com/boenfu)
#### 🎉 2.8.0-beta.0 (2022-04-02)
- 【Fix】
    - Fixed the problem that useNotification gets the same ID every time
    - Fixed InputNumber value be formated when precision is set and defaultvalue is empty [@rojer95](https://github.com/rojer95)
    - Fixed the panel rendering error when DatePicker defaultPickerValue passes numbers  [#735](https://github.com/DouyinFE/semi-design/issues/735)
- 【Feat】
    - Popover adds A11y keyboard and focus adaptation  [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Style】
    - Adjust the CSS style of the extra element of Form Label: display: block -> flex, fix the problem of not centering alignment when placing Icon in extra [#324](https://github.com/DouyinFE/semi-design/issues/324)


#### 🎉 2.7.1 (2022-03-30)
- 【Fix】
    - Fixed focus style issue after Button is clicked (Affects 2.5.0 ~ 2.7.0, there is a problem with Safari compatibility, its behavior is the same as before 2.5.0) [#730](https://github.com/DouyinFE/semi-design/pull/730)
    - Fixed Tooltip still execute `setState` after component unmounted  [#727](https://github.com/DouyinFE/semi-design/issues/727)

#### 🎉 2.7.0 (2022-03-25)
- 【Chore】
    - useFormApi add generic support [@so2liu](https://github.com/so2liu)
- 【Perf】
    - Optimized the number of executions of renderSelectedItem when multiple selection is selected and maxTagCount is configured [#709](https://github.com/DouyinFE/semi-design/issues/709)
- 【Fix】
    - Fixed the problem that when radio-group's value is NaN, "Maimum update depth exceeded" is triggered  [#712](https://github.com/DouyinFE/semi-design/issues/712) [@oddguan](https://github.com/oddguan)
    - Fixed the problem that if the remaining space in the vertical direction is insufficient after TreeSelect expands the node, the expansion direction is not automatically adjusted

#### 🎉 2.7.0-beta.0 (2022-03-18)
- 【Feat】
    - DatePicker supports inset input in panel  [#294](https://github.com/DouyinFE/semi-design/issues/294)
    - TreeSelect add filterExpandedKeys parameter for onSearch  [#328](https://github.com/DouyinFE/semi-design/issues/328)
- 【Fix】
    - Fixed the problem where the trigger unexpectedly display [object object] when Cascader was in single-select and non-search mode, and the label was ReactNode.  [#592](https://github.com/DouyinFE/semi-design/issues/592)
    - ButtonGroup support calssName props  [#704](https://github.com/DouyinFE/semi-design/issues/704) [@yaogengzhu](https://github.com/yaogengzhu)
    - Fixed that the value of the Tree component will affect the expansion of the node at the beginning, but after updating the treeData, it will no longer affect the expansion of the node  [#257](https://github.com/DouyinFE/semi-design/issues/257)
    - Fixed expandedKeys of TreeSelect is not completely controlled  [#328](https://github.com/DouyinFE/semi-design/issues/328)

#### 🎉 2.6.0 (2022-03-11)
- 【Fix】
    - Fixed the problem that when Table expands any row, other expanded rows will be rendered repeatedly  [#686](https://github.com/DouyinFE/semi-design/issues/686)
    - Fixed navigation lacking key warning, when limitIndent is false [#679](https://github.com/DouyinFE/semi-design/issues/679)
    - Fixed the problem that the parent element has 3px blank space when the Tag has a parent package [#518](https://github.com/DouyinFE/semi-design/issues/518) [@yangjiaxin1995](https://github.com/yangjiaxin1995)

#### 🎉 2.5.1 (2022-03-08)
- 【Fix】
    - Fixed Tooltip content autoFocus unexpected behavior [#675](https://github.com/DouyinFE/semi-design/issues/675)

#### 🎉 2.6.0-beta.0 (2022-03-04)
- 【Feat】
    - A11y: Calendar, ScrollList, Cascader, DatePicker accessibility semantic adaptation [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Style】
    - Tweaked default theme's 5 CSS tokens and Table empty text color to better support WCAG standard [#205](https://github.com/DouyinFE/semi-design/issues/205)
    - Fixed the label alignment problem in Cascader when wrapping in multi-select mode [@chenc041](https://github.com/chenc041)
    - Added focus style for Button [#205](https://github.com/DouyinFE/semi-design/issues/205)
- 【Design Token】
   - Cascader component-level token: remove $spacing-cascader_selection_tag-marginX, add $spacing-cascader_selection_tag-marginLeft and $spacing-cascader_selection_tag-marginRight [#636](https://github.com/DouyinFE/semi-design/issues/636)
- 【Fix】
    - Fixed `Table` header text does not support selection [#638](https://github.com/DouyinFE/semi-design/issues/638) [@chenc041](https://github.com/chenc041 )
    - Fixed the height inconsistency between Form.RadioGroup and RadioGroup when type=button, remove redundant padding [#677](https://github.com/DouyinFE/semi-design/issues/677)
    - Fixed the problem that the Form component does not meet expectations after assigning an item to the array fieldPath using formApi setValue/setError/setTouched [#604](https://github.com/DouyinFE/semi-design/issues/604)
    - Fixed the problem that disabled text cannot be displayed in safari when the text color of disabled Input is customized by custom CSS or theme, and it is set to some specific color
    - Fixed the problem that the for attribute of the label does not take the id first when the id is configured in the Form Field component [#683](https://github.com/DouyinFE/semi-design/issues/683)
- 【Docs】
    - A11y: Button adds keyboard and focus behavior description
#### 🎉 2.5.0 (2022-02-24)
- 【Fix】
    - Fixed resizable `Table` columns width bug when update `columns`  [#650](https://github.com/DouyinFE/semi-design/issues/650)
    - `Select` component automatically scrolls when the keyboard up and down keys are used to adjust the relative position of the focused option  [#607](https://github.com/DouyinFE/semi-design/issues/607) [@chenzn1](https://github.com/chenzn1)
    - Fixed the problem that the configuration of `webpack.resolve.alias` is invalid after the `@douyinfe/semi-next` plugin is used in the `next.js` project  [#630](https://github.com/DouyinFE/semi-design/issues/630)
    - Fixed the issue that the focus state of the input box was not cleared after closing the panel when `DatePicker` open was controlled  [#528](https://github.com/DouyinFE/semi-design/issues/528)
    - Fixed `Tooltip` in React17 if the parent prevents the click event from bubbling and the pop-up layer is collapsed will fail **(Tooltip, Popover's event judgment on clickOutSide behavior monitoring is changed from click to mousedown )**  [#593](https://github.com/DouyinFE/semi-design/issues/593) [@chenc041](https://github.com/chenc041)

#### 🎉 2.5.0-beta.0 (2022-02-18)
- 【Fix】
    - Fixed slider throw error in shadowDOM or other DocumentFragment env
    - Fixed Table header merge bug when using JSX columns  [#619](https://github.com/DouyinFE/semi-design/issues/619)
    - Fixed that checked value will be unexpectedly cleared in multiple mode when treeData was updated  [#622 ](https://github.com/DouyinFE/semi-design/issues/622)
- 【Feat】
    - Upload component upgrade [#556](https://github.com/DouyinFE/semi-design/issues/556)
        - photo wall supports display mask and supports custom preview icon customization
        - upload supports hot area of the photo wall to move to the head
        - file list supports custom operation area
    - Table supports the defaultFilteredValue API for the default filtered value for a given column
    - TreeSelect supports parent-child node selection relationship detachment  [#522](https://github.com/DouyinFE/semi-design/issues/522)
    - Tree supports parent-child node selection relationship detachment  [#522](https://github.com/DouyinFE/semi-design/issues/522)
    - Tooltip `leftTopOver` and `rightTopOver` position supports `autoAdjustOverflow`
- 【Style】
    - Update hover Sass token in Cascader component [@Carlosfengv](https://github.com/Carlosfengv

#### 🎉 2.4.1 (2022-02-16)
- 【Fix】
    - `@douyinfe/semi-ui` Add dependency declaration: `@douyinfe/semi-animation` to avoid the problem of missing dependency declarations that may exist in pnpm scenarios [#626](https://github.com/DouyinFE/semi-design/issues/626)
    - Avoid waring about passing insetLabelId/onChangeWithDateFirst to origin input/text dom in component Form.Input/TextArea/TimePicker [#624](https://github.com/DouyinFE/semi-design/issues/624)
- 【Style】
    - Optimize TagInput component Sass variable reference relationship [@Carlosfengv](https://github.com/Carlosfengv)

#### 🎉 2.4.0 (2022-02-11)
- 【Fix】
    - TimePicker crash issue  [#585](https://github.com/DouyinFE/semi-design/issues/585)
    - Fixed Nav limitIndent in the collapsed state, when the submenu is displayed in the form of dropdown, it is also consumed, which leads to the problem of redundant blank space
    - Fixed Typograph ellipsis error when set whiteSpace 'pre-line' and expandable
    - Fixed TreeSelect When treeData is large, update becomes very slow due to redundant operations of converting to Set  [#521 ](https://github.com/DouyinFE/semi-design/issues/521)
    - Fixed that when TreeSelect is uncontrolled single-selection mode, after treeData is updated, the selected value will be emptied unexpectedly  [#515](https://github.com/DouyinFE/semi-design/issues/515)
- 【Style】
    - Update some Sass variables in Button, Input, Modal, Select, ScrollList and TreeSelect components. Extract the default style as a Sass variable to facilitate DSM to modify the default style of these components [#570](https://github.com/DouyinFE/semi-design/pull/570)

#### 🎉 2.4.0-beta.0 (2022-01-28)
- 【Feat】
    - TimePicker add support for `onChangeWithDateFirst` API  [#555](https://github.com/DouyinFE/semi-design/issues/555)
- 【Fix】
    - Fixed the problem that when Select is customized using `renderCreateItem`, the new option needs to be clicked twice  [#574](https://github.com/DouyinFE/semi-design/issues/574)
    - Fixed InputNumber button right click bug  [#540](https://github.com/DouyinFE/semi-design/issues/540)
    - Fixed page back to one when Table `columns` change bug  [#381](https://github.com/DouyinFE/semi-design/issues/381)
    - Fixed the jitter of scrolling items when Tree uses both `virtualize` and `renderFullLabel`  [#527](https://github.com/DouyinFE/semi-design/issues/527)
- 【Style】
    - Fixed TextArea `readonly` hover cursor style bug [@chenc041](https://github.com/chenc041) [#535](https://github.com/DouyinFE/semi-design/issues/535)
    - Fixed the problem that the `z-index` level of the fixed column of Table is too high

#### 🎉 2.3.0 (2022-01-14)
- 【Fix】
    - Fixed Notification display collapsing order [#531](https://github.com/DouyinFE/semi-design/pull/531)
    - Fixed the problem that the edge click of the remove button is not available in Upload when `listType='picture'` [@pdsuwwz](https://github.com/pdsuwwz) [#525](https://github.com/DouyinFE/semi-design/pull/525)
    - Removed useless `aria-label` in Collapse, SideSheet, Avatar, Spin components [#536](https://github.com/DouyinFE/semi-design/pull/536)

#### 🎉 2.3.0-beta.0 (2022-01-07)
- 【Fix】
    - Fixed the problem that when Form uses the parent fieldPath in formApi.setValue, setError, and setTouch to perform batch assignment to multiple nested fields, there may be a problem of stuck (affecting versions v1.32~v2.2) 
    - Fixed the inaccurate trigger range of Form formApi.validate partial verification [#510](https://github.com/DouyinFE/semi-design/issues/510)
    - Fixed the problem that Tooltip did not include spacing when calculating adjustOverflow, which caused the content to exceed (but not exceed 8px) and still not automatically switch the direction.  [#491](https://github.com/DouyinFE/semi-design/issues/491)
    - Fixed Tooltip showing that the default direction of the floating layer is insufficient, and it will flicker when adjustOverflow is triggered to automatically switch the direction.   [#69](https://github.com/DouyinFE/semi-design/issues/69)
    - Fixed Tree handleNodeDragOver internal event parameters are not properly passed  [#345 ](https://github.com/DouyinFE/semi-design/issues/345)
    - Fixed TreeSelect when searchPosition is trigger, maxTagCount does not take effect  [#498 ](https://github.com/DouyinFE/semi-design/issues/498)
    - Fixed TagInput setting value to undefined does not take effect  [#483 ](https://github.com/DouyinFE/semi-design/issues/483)
    - Fixed Slider step marks click not working
    - Fixed Table uncontrolled paging after turning the page, updating state will reset the paging state and jump to the first page  [#348](https://github.com/DouyinFE/semi-design/issues/348) [@chenc041](https://github.com/chenc041)
- 【Feat】
    - Select supports autoClearSearchValue, allowing the current search keywords to be retained after selection Checklist
    - Slider add cursor grabbing style when drag Checklist
    - A11y: 40+ components add accessibility semantic support [#205](https://github.com/DouyinFE/semi-design/issues/205)
        - Button adds aria-label attribute, when disabled, Button has aria-disabled attribute
        - The role of Checkbox is checkbox, the role of CheckboxGroup is list, its direct child element is listitem, and the aria-label attribute is added to explain the function of the selection box; aria-disabled means the current disabled state; aria-checked means the current selected state
        - aria-hidden is true for Empty illustrations
        - Form adds label and error message accessibility support for Form.Field
        - Icon component role is img, and its aria-label defaults to the component's file name; the svg element inside Icon is a decorative element, and aria-hidden is set by default to prevent it from being read by screen readers
        - InputGroup adds a default value of name to Label to associate the corresponding field
        - Modal adds focus position processing before and after opening, focusing on the pop-up layer after opening, and focusing on the focused position before opening after closing
        - Radio's aria-labelledby points to the addon node by default, which is used to explain the content of Radio, and aria-describedby points to the extra node by default, which is used to supplement and explain the content of Radio
        - The roles of the Select trigger and the pop-up layer are combobox and listbox, and the trigger is bound with some aria-* attributes to indicate the relationship with the pop-up layer; Option has aria-selected and aria-disabled attributes to indicate the selected state of the current item
        - The role of Slider is slider, and attributes such as aria-valuenow are set to describe its current state; aria-orientation is vertical when it is vertical; when the value of aria-valuenow is not easy to understand, it supports passing a string through API aria-valuetext To make it more friendly, you can also get the value of aria-valuetext through the geAriaValueText method. [#490](https://github.com/DouyinFE/semi-design/issues/490)
        - Added role and aria-* attributes to table rows and cells
        - Tooltip has a tooltip role, which follows the definition of Tooltip in the WAI-ARIA specification; the content wrapper will be automatically added with an id attribute to match children's aria-describedby and associate content with children
        - Tree supports passing in aria-label to indicate the role of the Tree, and the corresponding role and aria-* attributes are set for Tree and TreeNode inside the component. [#493](https://github.com/DouyinFE/semi-design/issues/493)
        - TreeSelect supports passing in attributes such as aria-label and aria-errormessage to indicate the role and current status of TreeSelect, and sets relevant aria-* attributes for child nodes. [#493](https://github.com/DouyinFE/semi-design/issues/493)
        - When the trigger of the Popover is hover, the content of the Popover has the tooltip role, and when the trigger is click, custom, the content of the Popover has the dialog role
        - For details of other components, please refer to the documentation of each component, click to view the [accessibility design guide](https://semi.design/en-US/start/accessibility)

#### 🎉 2.2.2 (2021-12-31)
- 【Fix】
    - Fixed Transfer In the groupList scenario, the title attribute is passed into the reactElement node, resulting in key-warning [@JontyyYang](https://github.com/JontyyYang)
    - Fixed DatePicker range selection preset date is set to `null` or `undefined`, the panel does not close after selecting the date  [#338](https://github.com/DouyinFE/semi-design/issues/338)
    - Fixed the issue that the dateRange type DatePicker, when triggerRender is passed in, the panel does not close after selecting the date  [#422](https://github.com/DouyinFE/semi-design/issues/422)
    - Fixed InputNumber precision format bug in controlled mode
    - Fixed spelling errors in IconFastForward [@clark-cui](https://github.com/clark-cui)

#### 🎉 2.2.1 (2021-12-29)

- 【Fix】
    - Fixed DatePicker input value is back to confirmed value bug when `needConfirm` is true [#457](https://github.com/DouyinFE/semi-design/issues/457)
    - **Optimize DatePicker interaction details, `needConfirm` mode click outside will no longer close the panel, you need to click cancel to close the panel** [#457](https://github.com/DouyinFE/semi-design/issues/457)
    - Fixed DatePicker `needConfirm` button margin bug in footer [#457](https://github.com/DouyinFE/semi-design/issues/457)
    - Fixed DatePicker year button direction bug when `direction='rtl'` [#457](https://github.com/DouyinFE/semi-design/issues/457)
    - Fixed Table head row paddingY not same with design draft bug and updated to 8px [#460](https://github.com/DouyinFE/semi-design/issues/460)

#### 🎉 2.2.0 (2021-12-24)

- 【Fix】
    - Fixed the problem that tabPlane tab props does not accept dynamic updates when Tabs are used in umd mode
- 【Docs】
    - Improve Navigation API documentation [#451](https://github.com/DouyinFE/semi-design/pull/451) [@linjunc](https://github.com/linjunc)

#### 🎉 2.2.0-beta.1 (2021-12-23)

- 【Fix】
     - Fixed DatePicker input illegal year causing component crash [#422](https://github.com/DouyinFE/semi-design/issues/422)
     - Fixed the content penetration caused by transparent background color in Notification when `theme='light'` [#430](https://github.com/DouyinFE/semi-design/issues/430)
     - Fixed the issue of `@charset utf-8` related warning when Vite builds CSS [#403](https://github.com/DouyinFE/semi-design/issues/403)
     - Fixed the problem that the data in the drop-down list is not displayed correctly after using `backSpace` to delete the selected item in Select multiple selection [#444](https://github.com/DouyinFE/semi-design/issues/444)
     - Fixed Empty display `this.updateMode` `undefined` problem when switching dark mode [#452](https://github.com/DouyinFE/semi-design/issues/452)
     - Fixed the responsive error reporting issue of `Safari<=13` version [#442](https://github.com/DouyinFE/semi-design/issues/442)

#### 🎉 2.2.0-beta.0 (2021-12-17)

- 【Feat】
    - Timeline.Item supports `onClick` [#402](https://github.com/DouyinFE/semi-design/issues/402)
    - Cascader
        - Support only echoing leaf nodes with `leafOnly` API [#256](https://github.com/DouyinFE/semi-design/issues/256)
        - Support click the leaf node to select it in multiple selection with `enableLeafClick` API [#302](https://github.com/DouyinFE/semi-design/issues/302) [@btea](https://github.com/btea)
        - Support custom separator with `separator` API [#408](https://github.com/DouyinFE/semi-design/issues/408)
    - Upload [#342](https://github.com/DouyinFE/semi-design/issues/342)
        - Support `ref.current.insert` method
        - Support props `showPicInfo`
        - Use `gap` to control FileCard interval
    - Icon [#260](https://github.com/DouyinFE/semi-design/issues/260)
        - Add `double_chevron_left`, `double_chevron_right` icons
        - Icon supports following the current context font size
    - LocaleProvider added `Spanish` language pack [@chenjunxyf](https://github.com/chenjunxyf)
    - Select added `inputProps`, which is convenient for users to realize some special functions when filter is true. For example, incoming `onCompositionEnd`, `onKeyDown` event monitoring, etc.
    - DatePicker [#260](https://github.com/DouyinFE/semi-design/issues/260)
        - Add year switch buttons
        - Optimize the scope selection interaction logic to avoid scenes where the two panels are the same month
- 【Fix】
    - Select
        - Fixed the issue of key warning when `isRenderInTag` returned by Select `renderSelectedItem` is `false` [#320](https://github.com/DouyinFE/semi-design/issues/320)
        - Fixed the problem that the `mark` tag `key` is missing when the warning prompts the mark when searching for the highlighted keyword in Select
    - Fixed that the label style does not match the design draft when Cascader is `multiple`+`disabled` [#400](https://github.com/DouyinFE/semi-design/issues/400)
    - Fixed the problem of incorrect rendering when the key or itemKey is node when Description `type='plain'` [#406](https://github.com/DouyinFE/semi-design/issues/406)
    - Fixed the issue that when Pagination uses `hideOnSingePage` and `showSizeChanger` at the same time, when the total number of pages is only 1, the `sizeChanger` will disappear and can no longer be switched [#252](https://github.com/DouyinFE/semi-design/issues/252)
    - Fixed the issue that the design token of the Select component does not take effect when defining the Select component through Webpack plugin variables [#375](https://github.com/DouyinFE/semi-design/issues/375) [@summerstream](https://github.com/summerstream)
    - Fixed the UI error after setting the `size` of the Rating component to `number`
    - Fixed the horizontal alignment of Timeline custom dot [#395](https://github.com/DouyinFE/semi-design/issues/395) [@chenc041](https://github.com/chenc041)
- 【Docs】
    - Improve `semi-ui` package.json [@chenc041](https://github.com/chenc041)

#### 🎉 2.1.5 (2021-12-10)

- 【Fix】
  - Timeline.time ts definition supports ReactNode type [#359](https://github.com/DouyinFE/semi-design/issues/359) [@chenc041](https://github.com/chenc041)
  - Fixed the problem of Tree component onContextMenu preventing bubbling [#364](https://github.com/DouyinFE/semi-design/issues/364) [@Nctdtman](https://github.com/Nctdtman)
  - Fixed the missing id of Select/Checkbox/Button [#353](https://github.com/DouyinFE/semi-design/issues/353)
  - Fixed the problem that the definitions of Nav footer and header dts are reversed
  - Fixed the problem that the z-index of Table fixed cell is too small, adjusted from 1 to 101 [#391](https://github.com/DouyinFE/semi-design/issues/391)
  - Fixed Form Field losing ref bug when it is not given filed prop
- 【Style】
  - Fixed the problem that the naming of --overlay-bg token is not standardized. Modified to --color-overlay-bg
#### 🎉 2.1.4 (2021-12-03)
- 【Fix】
  - Add nativeEvent.stopImmediatePropagation to the event input parameter of Checkbox onChange callback [#343](https://github.com/DouyinFE/semi-design/issues/343)
  - Fixed the problem that when Cascader is multi-selected, clicking Checkbox will trigger bubbling in some scenarios [#343](https://github.com/DouyinFE/semi-design/issues/343)
  - Fixed that ButtonGroup children are not ReactElement report errors [#318](https://github.com/DouyinFE/semi-design/issues/318) 
  - Fixed Rating component half star ui error, when parent element set line-height [#346](https://github.com/DouyinFE/semi-design/issues/346)
  - Checkbox/Radio
    - Fixed the style of the state switching of the mouse when the mouse is moved in/out of the checked button [#319](https://github.com/DouyinFE/semi-design/issues/319) 
    - Fixed the border of the checked button will appear when the checked button is hover/active [#319](https://github.com/DouyinFE/semi-design/issues/319) 
    - Optimize the style of the checked+disabled state of the card/pureCard type [#319](https://github.com/DouyinFE/semi-design/issues/319) 

#### 🎉 2.1.3 (2021-11-30)
- 【Fix】
  - Fixed the bug of replacing source in ImportDeclaration during source code building
  
#### 🎉 2.1.2 (2021-11-30)
- 【Feature】
  - Support Next.js [#153](https://github.com/DouyinFE/semi-design/issues/153)
  - Replace Feishu Logo icon
- 【Fix】
  - Fixed the style problem of AutoComplete
  - Fixed the problem that InputNumber does not have API syntax hints in the editor [#327](https://github.com/DouyinFE/semi-design/issues/327)
  - Fixed the wrong color of hover state border when Input focus [#332](https://github.com/DouyinFE/semi-design/issues/332)

#### 🎉 2.1.1 (2021-11-26)
- 【Fix】
  - Provide UMD products of semi-icons and semi-illustrations to solve the problem that icons cannot be used in UMD scenarios [#215](https://github.com/DouyinFE/semi-design/issues/215)

#### 🎉 2.1.0 (2021-11-26)
- 【Fix】
  - Fixed the issue that the Collapsible component is stuck when expanding/retracting when the content has a margin [@ChelesteWang](https://github.com/ChelesteWang)
- 【Style】
  - Timeline adds $color-timeline_item_content-text-default Sass variable, which is used to configure the timeline title text color
- 【Docs】
  - Add a demo example of applying dark mode and bright mode to some modules [#301](https://github.com/DouyinFE/semi-design/issues/301)
  - Update the Table sample, use sample code that is more suitable for the usage scenario, and add notes to some common problems [#315](https://github.com/DouyinFE/semi-design/issues/315)
  - Added demo examples for use with Checkbox, Radio, Input, Pagination; added demo examples for drag sorting; added demo examples for keyboard response events

#### 🎉 2.1.0-beta.3 (2021-11-24)
- 【Fix】
  - Update the ts type definitions of some components, and fix the problem that the build report error when strict: true is enabled and skipLibCheck is false in tscofnig.json [#283](https://github.com/DouyinFE/semi-design/issues/283)
#### 🎉 2.1.0-beta.1 (2021-11-24)
- 【Fix】
  - Select
    - Fixed the crash of virtualization. [#308](https://github.com/DouyinFE/semi-design/issues/308)
    - Fixed the rendering problem when Option children are not string.
  - Fixed an error when TreeSelect leafOnly and searchPosition='hover' are opened at the same time. [#306](https://github.com/DouyinFE/semi-design/issues/306)
  - Fixed that the value of triggerRender in the parameter is empty when Cascader is multi-selected. [259](https://github.com/DouyinFE/semi-design/issues/259)
  - Fixed the incorrect naming of the interface ExpanedOtherProps of Tree and amend it to ExpandedOtherProps. [297](https://github.com/DouyinFE/semi-design/issues/297)

#### 🎉 2.1.0-beta.0 (2021-11-19)
- 【Feature】
  - Tabs add close options closable API [@xieyezi](https://github.com/xieyezi)
  - TagInput added onKeyDown API [#255](https://github.com/DouyinFE/semi-design/issues/255)
  - Tooltip, Popover, and Popconfirm add onClickOutSide API, which makes it easier to implement the behavior of clicking the blank space to close when trigger='custom'[#268](https://github.com/DouyinFE/semi-design/issues/268)
- 【Fix】
  - Fixed the possible vertical misalignment of Radio under certain theme packages: the value of Radio $height-radio_inner_min is changed from inheriting $spacing-base-loose to fixed 20px to avoid being affected by different theme packages
  - Fixed the problem that onChange is still triggered when Tabs is clicked on the active tab [#208](https://github.com/DouyinFE/semi-design/issues/208)
  - Fixed the problem that the height of the Collapsible component is not fully expanded when the collapsible component is opened by default [#85](https://github.com/DouyinFE/semi-design/issues/85)
  - Fixed the problem that onAfterChange is not triggered when clicking on the track when the Slider value is controlled
  - Fixed Select, AutoComplete UMD CSS missing problem
- 【Chore】
  - Fixed the inaccurate definition of the renderSelectedItem ts of TreeSelect [#265](https://github.com/DouyinFE/semi-design/issues/265)
  - Typescript Interface related changes [#277](https://github.com/DouyinFE/semi-design/issues/277)
    - Form adds the export of WithFieldOption
    - Notification adds the export of ConfigProps
    - Toast adds the export of ConfigProps
    - Upload adds the export of BeforeUploadObjectResult and AfterUploadResult
    - Cascader adds CascaderType and ShowNextType export

#### 🎉 2.0.8 (2021-11-11)
- 【Fix】
  - Fixed Modal afterClose not work in some scenario.

#### 🎉 2.0.7 (2021-11-10)
- 【Fix】
  - semi-icons add dependencies `classnames` [#231](https://github.com/DouyinFE/semi-design/issues/231)
- 【Style】
  - Table Fixed the problem of table misalignment when there is a fixed column/header scenario, all columns are not set to width [#247](https://github.com/DouyinFE/semi-design/issues/247)


#### 🎉 2.0.6 (2021-11-10)
- 【Style】
  - Table removed scrollbar column when there is a fixed column/header scenario by using the `overflow-y` to simulate the scrollbar [#164](https://github.com/DouyinFE/semi-design/issues/164)

#### 🎉 2.0.5 (2021-11-09)
- 【Style】
   - Fixed the border style issue when the Input component is hover [#204](https://github.com/DouyinFE/semi-design/issues/204)
- 【Perf】
   - Modal uses CSS animation to optimize the animation effect when opening and closing [#236](https://github.com/DouyinFE/semi-design/issues/236)

#### 🎉 2.0.4 (2021-11-08)
- 【Fix】
   - Fixed Cascader single selection, the problem that the `defaultValue` is disabled when the node is selected will be filtered [#183](https://github.com/DouyinFE/semi-design/issues/183)
   - Fixed Cascader `multiple` and `onChangeWithObject` enabled, the `defaultValue` is `object[]` does not take effect [#184](https://github.com/DouyinFE/semi-design/issues/184)
   - Fixed the problem that the Select support cannot automatically scroll to the selected item after opening the drop-down box [#169](https://github.com/DouyinFE/semi-design/issues/169)
   - Fixed Table `resizable` table issue [#154](https://github.com/DouyinFE/semi-design/issues/154)
- 【Docs】
  - Optimized the contributing document [#224](https://github.com/DouyinFE/semi-design/issues/224) [@btea](https://github.com/btea)

#### 🎉 2.0.3 (2021-11-06)
- 【Fix】
  - Fixed the problem that the item height of Tree / TreeSelect becomes larger in the loading state [#181](https://github.com/DouyinFE/semi-design/issues/181)
  - Fixed the problem that the input value of TagInput will be cleared when separator is not string or array [#182](https://github.com/DouyinFE/semi-design/issues/182)
  - Fixed the issue that when Form resets ArrayField through setValues, formState has taken effect and UI rendering is not updated synchronously [#211](https://github.com/DouyinFE/semi-design/issues/211)
- 【Docs】
  - Introduction page adds pnpm installation method [#27](https://github.com/DouyinFE/semi-design/pull/27) [@Sepush](https://github.com//Sepush)
- 【Chore】
  - Japanese language locale sources optimizes two copywriting of Pagination and DatePicker components[#135](https://github.com/DouyinFE/semi-design/pull/135) [@Void-YY](https://github.com//Void-YY)


#### 🎉 2.0.2 (2021-11-04)
- 【Fix】
  - Fixed the type definition of Toast [#166](https://github.com/DouyinFE/semi-design/issues/166)
  - Fixed the type definition of Radio `value` and `defaultValue`, from `string` to `string | number` [#159](https://github.com/DouyinFE/semi-design/issues/159)
  - Fixed the problem of Transfer search under `treeList` `type` [#163](https://github.com/DouyinFE/semi-design/issues/163)
  - When DatePicker `type=month`, the computer is set to the US Eastern time zone and the date cannot be selected [#173](https://github.com/DouyinFE/semi-design/issues/173)
  - Fixed List type definition error [#156](https://github.com/DouyinFE/semi-design/issues/156)
  - Fixed the type definition issue of Select component `renderSelectedItems` [#160](https://github.com/DouyinFE/semi-design/issues/160)
  - Fixed Tooltip event callback is not removed correctly [#192](https://github.com/DouyinFE/semi-design/issues/192)
- 【Style】
  - New tokens for Switch: `$color-switch_disabled-bg-hover`, `$color-switch_disabled-bg-active`, custom disabled background color [#115](https://github.com/DouyinFE/semi-design/issues/115)
- 【Docs】
  - Optimize some document issues [#165](https://github.com/DouyinFE/semi-design/issues/165) [#175](https://github.com/DouyinFE/semi-design/issues/175) [@YufeeXing](https://github.com/YufeeXing) [@BestDingSheng](https://github.com/BestDingSheng)
- 【Chore】
  - Anchor adds `max-height`, `max-width` test cases [#151](https://github.com/DouyinFE/semi-design/issues/151) [@songjianet](https://github.com/songjianet)

#### 🎉 2.0.1 (2021-11-01)
- 【Fix】
  - Fixed TreeSelect will expand its child nodes and close them immediately after selecting a node, causing a visual flickering feeling [#78](https://github.com/DouyinFE/semi-design/issues/78)
  - Fixed the rendering error when the size of Progress component is changed [#94](https://github.com/DouyinFE/semi-design/issues/94)
  - Fixed the problem that the height of the component is not fully expanded when the Collapsible component is opened by default [#85](https://github.com/DouyinFE/semi-design/issues/85) [@Janlay884181317](https://github.com//Janlay884181317)
  - Fixed Navigation `items` type definition error issue [#35](https://github.com/DouyinFE/semi-design/issues/35)
  - Fixed Navigation.Header `linkOptions` upload target type error problem [#120](https://github.com/DouyinFE/semi-design/issues/120) [@boenfu](https://github.com//boenfu)
  - Fixed the error of Table `Column.render` `text` type, caused by `string` => `any` [#144](https://github.com/DouyinFE/semi-design/issues/144)
  - Fixed an error in the TextArea component `TextAreaProps` type definition [#149](https://github.com/DouyinFE/semi-design/issues/149)
- 【Style】
  - Update the Form component Token, the value of $spacing-form_label_posLeft-marginRight: 4px -> 0px, align the right margin of the Label when labelPosition='left' (regardless of whether it is in Form.InputGroup or not). And fix the problem that the Label in Form.InputGroup is not vertically centered when labelPosition='left' [#67](https://github.com/DouyinFE/semi-design/issues/67)
  - Anchor component modify Token spelling problem, update $radis-anchor_slide => $radius-anchor_slide [#92](https://github.com/DouyinFE/semi-design/issues/92) [@btea](https://github.com//btea)
- 【Docs】
  - Optimized the sample documents of Navigation, Upload, TreeSelect, TimePicker, Switch, Select, Rating, Form, DatePicker, Notification and other components, and fixed some spelling errors. [@songjianet](https://github.com//songjianet) [@wangzhitao](https://github.com//wangzhitao) [@pleiades-embers](https://github.com//pleiades-embers) [@jaydonyin](https://github.com//jaydonyin) [@jukrb0x](https://github.com//jukrb0x) [@GoldSubmarine](https://github.com//GoldSubmarine) [@wangzt-arch](https://github.com//wangzt-arch) [@ivan0525](https://github.com//ivan0525) [@Shigma](https://github.com//Shigma) [@GoldSubmarine](https://github.com//GoldSubmarine) [@WscatsWscats](https://github.com//WscatsWscats) [@oddguan](https://github.com//oddguan) (in no particular order, the same scenes may not be a batch of notes)
  - Helped to improve the README, CONTRIBUTING, introduction and other documents [@ChelesteWang](https://github.com//ChelesteWang) [@Timeless0911](https://github.com//Timeless0911) [@niexq](https://github.com//niexq) [@Pingren](https://github.com//Pingren) [@oddguan](https://github.com//oddguan) [@noahziheng](https://github.com//noahziheng) [@Aaron00101010](https://github.com//Aaron00101010) [@Faithree](https://github.com//Faithree)

#### 🎉 2.0.0 (2021-10-26)

- 【Breaking Change】
  - Component Changes
    - Icon related
      - Icon component no longer supports type = xxx using built-in icons
      - Custom svg no longer supports plug-in configuration srcSvgPaths
      - The Button `icon` and `iconType` property no longer supports passing built-in icon names through strings
      - Dropdown deletes the iconType attribute and unifies it into the icon attribute
      - Navigation icons no longer support incoming by string, ReactNode needs to be passed in
      - Notification icons are no longer passed in by string, please use ReactNode uniformly
    - AutoComplete officially discards the onChangeWithObject property
    - Remove onInputChange from Cascader triggerRender
    - Form no longer exports Label components from `semi-ui/index.js`
    - Tree onRightClick renamed onContextMenu
    - Upload dragable renamed draggable
    - Tooltip no longer supports the `disabled` attribute, and components that rely on Tooltip (such as Popover, Dropdown, etc.) transparently transmitted to Tooltip `disabled` will become invalid
    - Table
      - API that no longer responds when componentDidUpdate
        - DefaultExpandAllRows, please replace with expandAllRows
        - Default ExpandRowKeys, please replace with expandRowKeys
        - Default ExpandAllGroupRows, please replace with expandAllGroupRows
  - Style Changes
    - CSS variable with semi prefix, for example --color-primary = > --semi-color-primary
    - In 2.x, the unified set the width and height of the illustration to `200 * 200px`
    - Design Token Changes
      - Popconfirm
        - $color-popconfirm_body-text 由 --semi-color-tertiary => --semi-color-text-2
        - $color-popconfirm_header_alert-icon 由 #fa7500 => --semi-color-warning
      - Progress
        - $spacing-progress_line_text-marginLeft 由 15px => $spacing-base(16px)
        - $spacing-progress_line_text-marginRight 由 15px => $spacing-base(16px)
      - Radio
        - $spacing-radio_addon_buttonRadio_large-paddingY 由 6px => $spacing-base-tight / 2 (6px)
        - $radius-radio_cardRadioGroup 由 3px => --semi-border-radius-small(3px)
  - Plugin Changes
    - In 2.x, the iconLazyLoad, svgPaths, srcSvgPaths configurations are no longer supported
    - In 2.x, section dark mode and bright mode no longer need to configure themeScope attributes in the plug-in, and the default is built-in. The usage method is updated from adding id #semi-ways-xxx to adding class .semi-ways-xxx.
  - Other Changes
    - Due to the adjustment of the Icon, the way of using icons and illustrations for Icon and Empty components is different from before. Please see for [details](/en-US/start/update-to-v2)

#### 🎉 1.33.1 - 1.38.x (2021-10-23)
- 【Docs】
  - ByteDance users, if you need to query the changelog changes in this section, please access it through the internal domain and switch to the 1.x documentation site in the Header in the upper right corner. This part of Feature and Fixed changes coincide with v2.0 - 2.4, so it will not be listed here again

#### 🎉 1.33.0 (2021-10-22)
- 【Fix】
    - Fixed that when the Cascader uses changeOnSelect and loadData attributes at the same time, and the last level is not selected, the value can not reset  

#### 🎉 1.33.0-beta.3 (2021-10-19)
- 【Fix】
    - Fixed Cascader when the label is ReactNode type, and filterTreeNode is turned on, the search results are not rendered correctly. 
    - Fixed the problem that the propTypes of Steps type is missing the "nav" type.

#### 🎉 1.33.0-beta.2 (2021-10-18)
- 【Fix】
    - Fixed the problem When Cascader loads asynchronously, the defaultValue is abnormally cleared. 

#### 🎉 1.32.3 (2021-10-18)
- 【Fix】
    - Fixed the problem that Select typing similar unescaped characters '(' '/' will throw error

#### 🎉 1.33.0-beta.0 (2021-10-15)
- 【Fix】
    - Fixed Tooltip package Select, remote search out of focus. 
    - Fixed the problem of missing spaces before and after the highlighted string in the search results in Select search mode. 

#### 🎉 1.32.2 (2021-10-14)
- 【Fix】
    - Fixed the problem that the pop-up layer is not displayed when Tooltip motion is false (affects v1.30+) 
    - Fixed the problem that if the parent dom enters display none when the Slider is dragging, an error will be triggered 


#### 🎉 1.32.1 (2021-10-11)
- 【Fix】
    - Fixed the problem of triggering bubbling when Button is disabled.

#### 🎉 1.32.0 (2021-10-09)
- 【Fix】
     - Fixed the issue that Avatar update src does not take effect 
     - Fixed the issue that DatePicker displays incorrect dates in Russian and Vietnamese 
     - Fixed the size of avatar style is abnormal when Tag size is small and avatarShape is circle 

#### 🎉 1.32.0-beta.0 (2021-09-30)
- 【Feat】
     - TreeSelect supports support loadData/onLoad/loadedKeys 
     - Cascader supports disableStrictly 
     - Tooltip supports wrapperClassName
     - Form formApi.setValue, setError, and setTouched support the use of parent fieldPath to assign values to multiple fields in batches 
- 【Fix】
    - **Fixed the problem that when Form ArrayField sets initValue and its subordinate Field also sets initValue, the initial value configured by ArrayField Props has a higher weight than the initial value configured by Field Props. Align the priority rules of Form Props and Field Props, and follow the principle that the sub-level configuration has the highest weight**

#### 🎉 1.31.0 (2021-09-24)
- 【Fix】
     - Form fixes the problem that `validate` may be triggered by mistake due to the same field prefix when validate specifies the validation part of the fields 
     - DatePicker disabledTime callback parameter type error (affecting v1.26 ~ 1.31-beta) 


#### 🎉 1.31.0-beta.1 (2021-09-23)
- 【Fix】
    - When Pagination showQuickJumper is true and a negative number is entered, it will change from not valid to the first page
- 【Style】
    - Remove the padding on the left and right sides when the Pagination type is mini (that is, the default value of the component Token: $spacing-pagination_small-paddingX is changed from 8px to 0)
    - When Pagination showQuickJumper is true, when the total number of pages is only 1 page, styles of quickJumper are automatically disabled. New component Token: $color-pagination_quickjump_text-disabled

#### 🎉 1.31.0-beta.0 (2021-09-18)
- 【Feat】
  - Upload add beforeRemove (callback before deletion) and beforeClear (callback before emptying), which can be used to prevent file removal
  - Pagination adds showQuickJumper to quickly jump to a page
  - DatePicker added rangeSeparator API to support replacement range date separator
  - Table
    - Added the defaultSortOrder API to support setting a default sort order for columns 
    - Added expandRowByClick API to support click row expansion 
- 【Fix】
    - Fixed the problem that the width of the input box changes when the input width is not set and hideSuffix is true, and when the button hover is cleared 
#### 🎉 1.30.2 (2021-09-17)
- 【Style】
    - Fixed the problem of the height change style of the header on the right side of the Transfer component

#### 🎉 1.30.1 (2021-09-13)
- 【Fix】
    - Fixed the problem that Button prevents the event from bubbling in any situation, causing the Upload to be unavailable

#### 🎉 1.30.0 (2021-09-10)
- 【Fix】
  - Fixed Tooltip getPopupContainer error report
  - Fixed Pagination error when `total` is too large
  - In disabled Button, it is expected that the click event will not propagate
- 【Chore】
  - Update the type definition of TimePicker defaultValue and value
  - Fixed the dts of Card shadows, change'show' to'always'

#### 🎉 1.30.0-beta.1 (2021-09-06)
- 【Fix】
  - Fixed Cascader in the case of a long list, after clicking the clear button, the dropdown is misplaced.
- 【Docs】
  - Fixed the problem that the name is incorrectly written when introducing the api in the Table document. defaultExpandGroupRows is changed to defaultExpandAllGroupRows, expandGroupRows is changed to expandAllGroupRows.

#### 🎉 1.30.0-beta.0 (2021-09-03)
- 【Feat】
  - CheckboxGroup and RadioGroup support type='card' and type='pureCard' 
  - Tree supports expandAll 
  - Form Field supports incoming ref 
  - TextArea supports showClear and onClear 
  - Treeselect
     - Support disableStrictly 
     - Support expandAll 
  - The theme supports opening the partial dark/bright color mode through configuration. For details, click 
  - Table supports expandAllRows, defaultExpandAllGroupRows, expandAllGroupRows API 
- 【Fix】
  - Tooltip
    - When the container is body, if the body has margins, the position of the pop-up layer is wrong 
    - Fixed the issue that onVisibleChange does not occasionally trigger 
    - Fixed the problem that when mouseEnterDalay and mouseLeaveDelay are both 0, the mouse quickly swipes over the pop-up layer and cannot be hidden 
  - When DatePicker type is date, onFocus is not triggered when focusing again after losing focus 
  - Icon lazy loading icon not loaded fix 
  - Calendar fixes the problem of head misalignment 
  - Fixed the issue that the slider does not take effect in the controlled mode onAfterChange
- 【Style】
  - Tree and TreeSelect support search highlighting 
  - When CheckboxGroup direction='horizontal', the margin-right of the last checkbox is set to 0 to align with the vertical situation
  - Fixed the problem of upload photo wall mode, disabled pointer style is not prohibited
- 【Docs】
  - Fixed the problem that the TagGroup demo is not vertically aligned 

#### 🎉 1.29.1 (2021-08-30)
- 【Fix】
  - Fixed the problem of unregister error due to stringify exception when adding or deleting rows after onChangeWithObject is turned on using Form.Select in ArrayField 

#### 🎉 1.29.0 (2021-08-27)
- 【Feature】
  - Added Icon, layers
- 【Fix】
  - Fixed the issue that the columns cannot be aligned when Table column render returns rowSpan and there are fixed columns 
  - Fixed InputNumber formatter has different effects in controlled mode and uncontrolled mode 
  - Fixed DatePicker disabled start date cannot modify end date issue 
- 【Style】
  - Cascader search highlight color replaced with --color-primary 
  - Change the extra color of Checkbox and Radio when disabled from --color-text-2 to --color-disabled-text
  - When InputNumber is passed in the disabled prop, add a disabled color to the button 
- 【Chore】
  - Optimized the definition of 13 component types such as Avatar, Banner, DatePicker @xiezhiqiang
  - DatePicker disabledDate parameter exposes rangeEnd value 
  - Optimize Table type definition 

#### 🎉 1.29.0-beta.0 (2021-08-20)
- 【Feature】
    - TagInput
        - Support autoFocus 
        - separator supports array format, allowing multiple separators to be set 
    - Cascader
        - Support onClear 
        - Support showNext, allowing to set the expansion timing of the Dropdown submenu
    - TreeSelect supports searchPosition 
    - Steps support onChange 
    - Switch supports loading 
    - Slider vertical mode supports reverse direction, that is, up-large and down-small 
- 【Style】
    - **The spacing of Space is changed from margin to gap. After turning on wrap, the child element in the last line no longer has a bottom margin, and the last element of each line no longer has a right margin** 
    - The right margin of the selection of TreeSelect is set from 12px to 0 to align the Select component 
- 【Fix】
    - TreeSelect
        - Fixed the problem that the drop-down box will not be collapsed if the selected item is selected during single selection
        - Fixed the issue that size is invalid when multiple is used 
    - Slider
        - Fixed the problem that onAfterChange entered parameter values ​​incorrectly in special situations
    - Select
        - Fixed the problem of icon and text wrapping when the virtual list text is too long
    - DatePicker
        - Fixed that notifyChange causes an error in formatting date after selecting a date in dateRange controlled mode 
- 【Docs】
    - Introduction of treeData types in Cascader Supplementary Document 
- 【Chore】
    - TreeSelect supplements the dts type definition of triggerRender input parameter and the corresponding document description

#### 🎉 1.28.4 (2021-08-19)
- 【Fix】
    - DatePicker
        - In the dateTimeRange type, fix the problem when determining whether the date is disabled

#### 🎉 1.28.3 (2021-08-19)
- 【Fix】
    - Cascader
        - Fixed the error of forEach is not a function when autoMergeValue is false
        - Fixed the issue that clearBtn is displayed when the selected item is empty when multiple is true and showClear is true

#### 🎉 1.28.2 (2021-08-18)
- 【Fix】
    - Steps
        - Fixed the problem that Steps Component Design Token not work

#### 🎉 1.28.1 (2021-08-16)
- 【Feature】
    - The built-in copywriting of the component supports Traditional Chinese 
- 【Fix】
    - Select
        - Fixed the problem that the key is contained in the optionList when controlled multiple selection and onChangeWithObject is true, and the key is lost in the onChange callback when the first selection is made 
        - Fixed the issue that after onChangeWithObject is turned on, the option in onChange will additionally include certain internal Select states such as selected, show, etc. 
        - Fixed the problem of creating new options when the filter allowCreate is enabled at the same time and the search options are hit. 
    - Calendar
        - Fixed the problem of default locale error 
    - Fixed the problem that the icon of UMD product did not decolorize
    - DatePicker
        - **In dateRange and dateTimeRange types, the option of dynamic disable date is supported. For example, when startDate is selected, when endDate is selected, dates smaller than startDate are not selectable.**
        - **In the dateRange and dateTimeRange types, the highlight area of ​​the trigger when selecting a date has been optimized. The previously completed trigger is highlighted and switched to the input area. Contains background and borders. For example, when startDate is selected, the startInput area will be highlighted.**
            - **Note: The trigger of DatePicker has been adjusted to implement this function. Include a layer of div in the outer layer of the input.**
        - The notifyChange is triggered when the repair range selection date is not completed(from v1.26) 
    - TreeSelect error after double-clicking the dropdown box sub-item 
- 【Style】
  - Select.Option adds flex-wrap to avoid the problem of abnormally long text display in some cases when searching
- 【Chore】
  - Typography removes the dangerouslySetInnerHTML attribute in the type definition file
  - Notification type definition issue update, add open attribute, remove non-existent confirm attribute
- 【Docs】
  - Button added noHorizontalPadding documentation 


#### 🎉 1.28.0-beta.0 (2021-08-06)
- 【Feature】
    - Cascader supports  multiple、onExceed、max、maxTagcount、showRestTagsPopover、restTagsPopoverProps、autoMergeValue API 
    - DatePicker add API `syncSwitchMonth`, which allows the dual-panel month to be switched synchronously in the range selection scenario 
    - DatePicker add callback `onPanelChange`, which is triggered when the month is switched around 
- 【Style】
    - Fixed the difference between the horizontal margin of +N and the design draft in TagInput, and add 8px to the horizontal inner margin of +N
    - Radio
        - Fixed the difference between the default radio background color of the button type and the design draft, from var(--color-fill-1) to var(--color-fill-0)
        - Fixed the problem that the button type Radio is not aligned, add align-item: middle
    - Design Token
        - PopConfirm add new component sass token: $radius-popconfirm-popover , you can use it to modify border-radius of popConfirm
        - Add new CSS global token: --border-radius，can be used to create full-size rounded corners, such as capsule labels, etc.
- 【Fix】
    - Table
        - Fixed the problem of incorrect rendering of selectable cells disabled with controlled rowSelection
        - Fixed the problem that the table data is not sorted correctly with controlled columns.sortOrder
        - Fixed the problem that if the dataSource is updated when there are filtering items, all the dataSource will be displayed without filtering 
- 【Docs】
    - Add demo of autoExpandParent usage in Tree component documentation
#### 🎉 1.27.3 (2021-08-05)
- 【Fix】
    - Optimize the interactive experience of DatePicker dateRange and dateTimeRange scenes. Support in one selection, you can change startDate or endDate alone, or change at the same time
#### 🎉 1.27.0 (2021-07-30)
- 【Fix】
    - Fixed an issue where SideSheet does not display correctly when SideSheet mask is set to false and width is set to a percentage string 
    - Tag adds support for default size, fix the problem of using default size in InputGroup
- 【Style】
    - Tag adds white-space: nowrap, solving the incorrect display of the ultra-long wrap due to the highly fixed display (Tag recommended single line usage, long-content is recommended to use Typography)
- 【Chore】
    - Table dts adds RecordType generic, improve the column.render parameter definition
#### 🎉 1.27.0-beta.0 (2021-07-23)
- 【Feature】
    - Breadcrumb supports renderMore and moreType API, which can customize the rendering of ... area 
    - Select supports keyword highlighting when searching (only when option label/chilren is a pure string text) 
    - In Pagination mini mode, add hoverShowPageSelect API to support hover to quickly switch page numbers 
    - TreeSelect added searchAutoFocus API, which supports automatic focus of the search box in the search function
    - Cascader supports topSlot and bottomSlot API 
    - Modal supports automatically calculating the width of the scroll bar to prevent the content behind the mask from jittering when it pops up 
    - Navigation adds limitIndent API for indentation limit, and new toggleIconPosition API for control expand collapse icon position
    -   - Tree supports drag and drop in renderFullLabel scene
- 【Fix】
    - Fixed the problem that Notification has a small probability of failure when the same task queue is quickly displayed and hidden 
    - Fixed the logic problem of processing judgment of selecting all/deselecting all and emptying the Transfer components 
- 【Docs】
    - Fixed the jump link of the tooltip position in the Dropdown document

#### 🎉 1.26.1 (2021-07-20)
- 【Fix】
    - Fixed the problem that DatePicker directly reports an error when switching time 
- 【Style】
    - Fixed the problem that the disabled style does not meet expectations when DatePicker has defaultValue 
- 【Docs】
    - Modified and supplemented the content of triggerRender in the Cascader and Select component documents

#### 🎉 1.26.0 (2021-07-18)
- 【Fix】
  - Fixed the issue that RadioGroup reports errors when transmitting Radio between levels 
  - Fixed the problem that the React.Fragment display in Space does not meet expectations 
  - Fixed Collapsible does not keepDom, but renders the DOM during initial folding 
  - Fixed the issue that ArrayField was not reset to the initial state when Form reset 
  - Fixed an issue where the verification status was not updated correctly when the Form field rules were changed from a valid array to an empty array 
  - Fixed an issue where onValueChange was triggered by mistake when the initial value of Form ArrayField was configured through initValue 
  - Fixed column misalignment issue when rowSpan of Table header column is 0 
  - Fixed DatePicker calling onChange when the date has not changed 
  - Fixed the problem that DatePicker disabledDate and disabledTime pass parameters are not adapted to timeZone. 
- 【Style】
  - The color of the selected text in the navigation first-level directory is aligned with the design draft, updated from --color-primary to --color-text-0 
  - Navigation horizontal navigation bar optimizes the interaction details, removes the arrow flip animation 
  - The style of text color after hover in Radio unchecked state, remove var(--color-primary) text highlight
  - Adjusted the width of Table resize hot zone from 1px to 8px 
- 【Chore】
  - Supplement DatePicker triggerRender and renderFullDate type definition
  - Supplement the afterClose type definition of Select
  - Table adds row/column merge example


#### 🎉 1.26.0-beta.2 (2021-07-14)
- 【Fix】
    - Fixed the problem that ArrayField did not return to the initial state when Form reset
    - Fixed the problem that the verification status is not updated after Form Field rules is changed from a valid array to an empty array 

#### 🎉 1.26.0-beta.1 (2021-07-14)
- 【Fix】
    - Fixed DatePicker split input box is not compatible with triggerRender issue
    - Fixed the issue of calling onValueChange when the Form ArrayField is initialized 

#### 🎉 1.26.0-beta.0(2021-07-09)
- 【Feature】
    - Radio supports button style
    - TreeSelect supports renderSelectedItem API, can customize the selected item 
    - DatePicker dateRange and dateTimeRange scenes split the input box, and you can change the start or end separately to optimize the interactive experience 
    - Cascader added filterLeafOnly to support searching and selecting non-final data 
- 【Fix】
    - Fixed the problem that clicking the prefix/suffix of Input will not make the input box focus 
    - Fixed the problem that Input uses addonBefore and showClear styles at the same time 
- 【Style】
    - Fixed the problem that the indent of Tree and TreeSelect levels are inconsistent with the design draft, updated from 8-40-60-100 to 8-28-48-68
    - **Please pay attention to scenarios where the DatePicker type is dateRange or dateTimeRange, the input box DOM is modified, and one input box is split into two input boxes; the inputStyle property will be bound to the two input boxes; the blur behavior is determined by the monitoring input box OnBlur is called when blur is changed to closePanel.**
    - **Please pay attention to the new default height of the Input style. If you customize the padding for the Input, since the Input is a border-box, please set the height of the Input to the default height + custom padding**
- 【Docs】
    - Table supplement column.title description, explaining the influence of different parameter types on title rendering
#### 🎉 1.25.0 (2021-07-02)

- 【Fix】
    - Fixed DatePicker placeholder character string not working
    - Fixed height calculation error caused by complex content passed in Collapse
- 【Chore】
    - Update the type definition files of TreeSelect and Tree 
- 【Style】
    - Update Notification width from 320px to auto
#### 🎉 1.25.0-beta.3 (2021-07-01)

- 【Fix】
    - Fixed the issue that renderSelectedItem does not trigger execution when Select value=0 and there is no corresponding Option in optionList 

#### 🎉 1.25.0-beta.0 (2021-06-25)

- 【Chore】
    - Optimize the build volume, multi-language package supports tree shaking, this change involves components LocaleProvider, DatePicker, TimePicker, Calendar

#### 🎉 1.24.7 (2021-06-22)

- 【Chore】
    - Optimize build size, multi-language package supports tree shaking. This change involves components LocaleProvider, DatePicker, TimePicker, Calendar.

#### 🎉 1.24.4 (2021-06-21)

- 【Fix】
    - Fixed the problem that Navigation calls setState when it is not mounted 
#### 🎉 1.24.2 (2021-06-20)

- 【Fix】
    - Fixed the problem that the dropdown layer is too wide after the AutoComplete data changes and does not automatically switch positions 
    - Fixed Cascader, Tree internal state loadedKey is accidentally updated
- 【Chore】
    - We added the design tokens page，and all components have  design token part now;

#### 🎉 1.24.1 (2021-06-20)

- 【Fix】
    - Fixed DatePicker warning dateFnsLocale prop is marked as required

#### 🎉 1.24.0 (2021-06-18)

- 【Chore】
    - Update Column dts, complete useFullRender type.

#### 🎉 1.24.0-beta.2 (2021-06-17)

- 【Fix】
    - Fixed the problem that TimePicker uses Input to modify the time and the interaction is not smooth 

#### 🎉 1.24.0-beta.1 (2021-06-15)

- 【Feature】
    - DatePicker
        - DatePicker added onPresetClick API
    - Upload
        - Upload component added onAcceptInvalid API 
#### 🎉 1.23.5 (2021-06-11)

- 【Fix】
  - Fixed the problem that the header of the virtualized table cannot be aligned with the body


#### 🎉 1.23.4 (2021-06-09)

- 【Fix】
  - Fixed the issue that input dateStr after DatePicker format does not support multiple languages 

#### 🎉 1.23.1 (2021-06-07)

- 【Fix】
   - Fixed the error of prop columns and children JSX columns when Table is transmitted at the same time
   - Fixed the problem that the table header and body cannot be aligned in some usage scenarios (passing scroll.y) when the mouse and keyboard are plugged in and out of Table 
   - Fixed the problem that Slider does not support dragging on mobile 

#### 🎉 1.23.0 (2021-06-04)

- 【Fix】
  - Transfer
    - Fixed the issue that search results were not updated when dataSource was updated 
    - Fixed an issue where the removal icon was displayed on hover when disabled was selected 
  - Fixed the automatic scaling problem of Dropdown.Item icon
  - Removed the disabled attribute added by mistake in .d.ts on floating layer components such as Tooltip and Dropdown (in fact, the component does not provide this API)
  - Fixed the issue that uploading the same file for the second time would fail when replacing a single file 
- 【Style】
  - Optimize Modal animation parameters to reduce the feeling of lag

#### 🎉 1.23.0-beta.0 (2021-05-28)

- 【Feature】
  - AutoComplete
    - Added onChange API, which is triggered when the input box changes / candidates are selected, and always returns the string type
    - **The value type no longer supports the object type (because AutoComplete is an input-enhanced component, non-selection-enhanced)**
  - Toast
    - Add ToastFactory, produce Toast through ToastFactory.create(), solve the problem that getPopupContainer cannot be changed after configuration
  - Icon
    - Added resso brand icon
- 【Fix】
  - Fixed the problem of children rendering error caused by incorrect TabPane rendering timing caused by incorrect Tabs activeKey update 
  - Fixed the issue that DatePicker has daylight saving time offset in some time zones 
  - Fixed the problem of missing popover arrows (affecting version v1.22.0)
  - Fixed the transparent transmission of the Form.TextArea component to the insetLabel property of the native component
  - Fixed the problem that the input box can be changed when the value is controlled and equal to "" in AutoComplete
  - Fixed the problem of AutoComplete, the priority of defaultValue is higher than value
  - Fixed the problem of the wrong type of space .d.ts

#### 🎉 1.22.2 (2021-05-24)
- 【Fix】
  - AutoComplete
    - Fixed the problem that the AutoComplete option cannot be selected when clicking on the padding


#### 🎉 1.22.0 (2021-05-21)
- 【Fix】
  - Table
    - Fixed Table Column JSX writing method update data table behavior abnormal problem 
   - Fixed the problem that Table warning that each item in the array needs to be given a separate key
   - Fixed the problem that the replacement function of Upload fails when limit=1
   - Fixed Error caused by defaultValue/value is invalid when Select dynamically switches multiple
   - Fixed DatePicker did not clear the panel date behavior after clicking the clear button
   - Fixed the issue that dateTime cannot be used when setting the time zone in DatePicker 
   - Fixed Pagination's built-in paging capacity Select selector value display does not match after dynamically changing pageSize 

#### 🎉 1.22.0-beta.0 (2021-05-14)
- 【Feature】
  - DatePicker
    - Added topSlot/bottomSlot API to render additional top and bottom areas 
    - format adapts to multiple languages ​​and is consistent with the language provided by LocaleProvider 
  - Transfer
    - Newly added sortableHandle parameter for renderSelectedItem, which is used for draggable scene configuration to customize the selected option rendering
- 【Fix】
  - Form
    - Fixed the situation where the error object in errors may be swallowed and become {} when the submit verification fails 
    - Fixed the problem that when trigger includes mount and validate is asynchronous verification, the initial verification is not triggered after mounting 
  - Table
    - Fixed the problem that all rows of disabled can select the second page data 
    - Fixed the problem of sorting failure when using function components (affecting version v1.21) 
    - Fixed the issue that the column did not update when dynamically switching rowSelection (affecting version v1.21)
    - Update Table reverse order sorting logic, from ascending order first + reverse => reverse order sorting 
    - Fixed the column alignment problem caused by the vertical scroll bar when the table is configured with scroll.y and the current page data is not enough 
  - Radio fixes the problem that advanced will not take effect if div or other tags are nested between group and radio when mode='advanced' 
  - Fixed the problem that the className passed into the Card component does not work
  - Fixed the problem that the defaultValue not work in Transfer
  - Fixed an issue where the Calendar component displayed an abnormal number of events
  - Fixed the issue that the clear button clicked invalid under conditional rendering of Input 
  - Fixed the problem that InputNumber step is set to 0.1, min is 0, max is 1, and cannot be reached by the plus sign on the right side 
  - Select
    - Fixed the problem that ref.selectAll does not take effect when Select onChangeWithObject is true; fix the problem that onChange is not triggered after calling ref.selectAll 
    - Fixed the problem of updating the optionList after Select search and changing the number of options, in some cases directly hitting Enter will throw Uncaught TypeError: Cannot read property'_inputCreateOnly' of undefined
  - Fixed the problem that propType check warning was thrown when the Description data key was passed into ReactNode
- 【Style】
  - Radio and Checkbox border color are aligned with the design draft, unified update to var(--color-text-3) 
  - Fixed the incorrect color of Radio disabled border 
  - Fixed the problem that the Avatar label is not vertically centered 
  - Refactor component-based design tokens in order for customization through theme

#### 🎉 1.21.0 (2021-04-30)
- [Fix]
   - Fixed the problem that the calendar component displays the time abnormally across months 
   - Fixed the error of nested label of title and description of Banner component
   - Fixed the problem that the buttons are not highlighted when the Table component is sorted when customizing prefixCls
   - Fixed the comma problem in Typography copy, compatible with array type children
- [Chore]
   - Fixed the circular dependency problem of Typography component 
- [Style]
   - Typography Paragraph margin is set to 0. **Please note that the default value of margin has changed if you did not introduce [reset.css] (https://www.npmjs.com/package/reset-css), its margin will inherit from the browser (1em), and now the default margin is 0**.
- [Docs]
   - Supplement Typography component API, component can support custom Typography rendering elements

#### 🎉 1.21.0-beta.2 (2021-04-27)
- 【New Component】
  - New Card component
- 【Feature】
  - TagInput supports max, showRestTagsPopover, restTagsPopoverProps, showContentTooltip
  - Support Form.TagInput
  - Table supports expandedRowRender, modify it to return null, then the expanded row will not be rendered 
  - Upload component supports single file replacement
  - Icon component added onMouseDown onMouseUp onMouseMove api
- 【Fix】
  - The maxTagCount behavior of TagInput is corrected, aligning to other components (display +N after exceeding)
  - Fixed the error of nested tag of title and description of Banner component
- 【Perf】
  - Table rendering times are optimized, row selection single-select scene and global refresh issues are optimized 
- 【Chore】
  - Fixed the circular dependency problem of the Typography component 
- 【Docs】
  - Update Typography component docs, component prop can support custom Typography rendering elements
- 【Style】
  - --color-disabled-bg down a color scale, quote -grey-1, improve the contrast between background and text, improve readability
  - Use --color-text-1 for the text color of tietrary button, which also improves contrast + readability
  - For borderless + split button, the hover state of the button body and the drop-down arrow are separated to clarify the hot zone


#### 🎉 1.20.3 (2021-04-29)
-【Fix】
  - Add open, close and other instance call methods to the Class type of Select
  - Fixed an issue where Progress called setState when it was unmounted, causing React to report an error
  - Cascader does not display child nodes when there is an unmatched initial value 
  - Breadcrumb noLink style fix
  - The Upload progress bar is adjusted to reach 100% after receiving a clear response from the server
  - Fixed DatePicker can enter the disabled date issue in controlled mode 
  - Fixed the problem that Table sorter is not highlighted when clicking on the custom prefixCls scene


#### 🎉 1.20.0-beta.4 (2021-04-12)
- 【Feature】
  - Upload support upload directory 
  - Transfer supports tree shuttle box 
  - TagInput added addOnBlur and allowDuplicates api
  - Table adds an interface to get the virtualized table ref 
  - Anchor adds default anchor point 
  - Anchor.Link added disabled 
- 【Fix】
  - Fixed Navigation item font-weight error (introduced in version 1.18)
  - After using prefixCls, Tabs is set to collapsible, and there is an error when switching tabs
  - Fixed the RTL problem of Form label and Table filter dropdown item
  - Fixed that when the Anchor has a scroll container, click on the anchor and the scroll container will scroll 
  - Fixed the problem of displaying all data when the Table filter result is empty 
- 【Style】
  - Display ToolTip when TagInput tag is too long and truncated 
  - Add 2px margin between title and description in Banner non-full screen mode 
  - Form label font-weight update from 700 to 600, the corresponding Scss variable font-weight-bold is also adjusted from 700 to 600 


#### 🎉 1.19.0 (2021-04-02)
- 【Fix】
  - Fixed the issue where the second-level selectedKeys was set when Navigation was initialized, and the first-level title did not have an activated style
  - Fixed the problem that the dynamic modification of Avatar does not take effect in hoverMask
  - Fixed the problem that the second filter in setState becomes invalid after clicking the first filter in Table 
  - TagInput
    - Fixed the space interaction problem of TagInput 
    - Fixed TagInput setInputValue('') invalidation 
  - InputNumber
    - Fixed the problem that the input box of ⬆️ and ⬇️ buttons in InputNumber controlled mode is not updated 
    - Fixed the problem that there is no response when the illegal value is passed in InputNumber under controlled mode 
- 【Style】
  - Removed the border style in Modal fullScreen
  - Fixed the problem that when Tabs type='line' and size is small, setting tabBarExtraContent will cause the bottom border of the tabBar to be incorrectly styled when the height is stretched
  - TagInput
    - Fixed TagInput label length exceeding problem 
    - Fixed the width problem of TagInput wrapped with withField 

#### 🎉 1.19.0-beta.0 (2021-03-26)
- 【New Component】
    - TagInput 
- 【Fix】
    - Fixed error when pressing enter in AutoComplete 
    - Fixed null error in Description DataItem
    - Fixed incorrectly execution of uploading new fileInstance when calling Upload beforeUpload  
    - Fixed Navigation selected and disabled style 
- 【Style】
    - If DatePicker popup position is set to top, week panel will be fixed to show 6 weeks 
#### 🎉 1.18.0 (2021-03-17)
- 【Fix】
   - Fixed the problem that the onChange function is not bind when the Select multi-select is controlled. Clicking the x on the tag can still delete the selected item 
   - Fixed the issue that onNumberChange is triggered after the input value exceeds max when InputNumber is controlled 
   - Fixed the problem that the Select can be actived by clicking or through the tab button when the Select is disabled
- 【Style】
   - Select clear icon adds flex-shrink to solve the problem of setting mulitple+showClear, and in some cases the length jitter when the mouse is hovered 
- 【Chore】
   - Update the Table component type definition file and add children to column

#### 🎉 1.18.0-beta.0 (2021-03-12)
- 【Feature】
   - New methods for Select ref: clearInput to clear the Input box, selectAll to select all, deselectAll to deselect all
   - The Steps component has been revised and added a new type with connecting lines and navigation 
   - Upload component supports onRetry, onOpenFileDialog and onError return native xhr objects 
   - Tree component supports leafOnly attribute
   - SideSheet added keepDOM api
   - Modal adds fullScreen api
- 【Fix】
   - Fixed the error when the Tree component uses loadedKeys
#### 🎉 1.17.0 (2021-03-05)
- 【Feature】
  -  Added `dislike_thumb` and `unlink` icons
- 【Fix】
  -  Fixed that the sourcePanelProps type declaration exported by Transfer is missing selectedItems 
  -  Fixed the upload component renderFileItem parameter is inconsistent with the declaration 
  -  Fixed the problem that SideSheet closeOnEsc only takes effect when it gets the focus
  -  Fixed the filling color problem of scan icon
- 【Docs】
  -  Upgrade the official website live demo editor

#### 🎉 1.17.0-beta.0 (2021-02-26)
- 【New Component】
  - Added Space component
- 【Feature】
  - DatePicker adds small size 
  - Navigation supports disabling the navigation bar 
  - Added Portuguese-Brazil (pt-BR) language pack 
  - Added support for Descriptions JSX writing 
- 【Fix】
  - Fixed resizable usage problem in Table rowSelection controlled mode 
  - Fixed the overlap between Input suffix icon and clear icon 
  - Fixed the problem that ArrayField cannot be removed, affected version 1.16.0-beta-1.16.3 
  - Fixed the style problem caused by Tooltip icon update 
  - Fixed an issue where the Avatar could not display the floating layer correctly when it was wrapped by Dropdown, Popover and other components
  - Fixed the problem of Tabs reporting errors in cases where children are empty 
- 【Style】
  - Navigation adds press status, select hover and other statuses 
  - Fixed the problem of missing the right border when there is no data after setting the bordered property of Table 
  - Removed the text display of hours, minutes and seconds in TimePicker in Russian, Thai, Turkish, and Vietnamese, that is, only the number is retained, but the unit is not retained
- 【Docs】
  - Fixed the problem that the input type of the document is inconsistent with the type definition file, type boolean => string, the default value is false => text

#### 🎉 1.16.0 (2021-02-20)
- 【Fix】
  - Timeline component, report an error when children are not compliant 
  - Fixed DatePicker dynamically disabled date reporting error 
  - Fixed the problem that Radio mode=advanced mode introduced in version 1.16.0-beta is not available 
- 【Style】
  - Fixed the style when Modal has no title but header 
- 【Chore】
  - Lock the svgo version (v1.2.2), svgo-loader version

#### 🎉 1.16.0-beta.0 (2021-02-05)
- 【Feature】
  - Select onExceed adds Option as input parameter 
  - Dropdown adds icon and iconType API, which makes it easier to configure icons 
  - Radio added addonStyle, addonClassName 
  - DatePicker added onClear API, this callback is triggered when the clear button is clicked
  - AutoComplete added emptyContent and autoFocus API 
  - Modal adds afterClose callback, which will be executed after the animation ends
  - Timeline added dataSource API, which supports passing in as an array 
  - Cascader supports onChangeWithObject 
  - Breadcrumb.Item 
    - Support setting noLink to remove the effect of hover and active
    - Support setting the separator of the child to override the parent
- 【Fix】
  - Fixed the problem that you need to click twice to select Option after Select is enabled for virtualization 
  - Fixed the error report that the incoming fileList is undefined in the controlled scenario of Form.Upload of version v1.15
  - Fixed an issue where Modal closeOnEsc must be focused to exit
  - Fixed the problem of incorrect target tabs when scrolling multiple Tabs scenarios
  - Table
    - Fixed sortOrder invalidation and sort invalidation problem after dataSource update 
    - Fixed the problem that the header of the virtualized list cannot be aligned with the column when there is no fixed column 
  - DatePicker
    - Fixed the problem that the second time selector cannot be used when the minuteStep step is large 
    - Fixed the issue that the needConfirm cannot use the input box to change the selected date 
- 【Perf】
  - Cascader/TreeSelect/Tree single selection Clicking on the selected option always triggers onSelect 
- 【Style】
  - Fixed the issue that the border would shift down by 1px and the box-shadow was incorrect when the button was clicked on the Slider 
  - Fixed the problem of incorrect insetLabel spacing when Cascader was in RTL
  - Modal optimize the style when there is no title 
- 【Chore】
  - Cascader Data.value PropTypes verification alignment d.ts statement 
  - Update the DateInput / Cascader type declaration and add the input parameters of the callback function
  - Fixed the error of BaseForm autoScrollToError type

#### 🎉 1.15.0 (2021-01-29)

- 【Fix】
  - AutoComplete auto expand option list in out of focus 
  - Upload controlled mode not rendered according to fileList 
  - Fixed the issue of expansion logic when using onLoad and search together in Tree component 
  - Fixed the problem that when selecting autoFocus, directly clicking on the external out of focus does not trigger the onBlur event 
  - Fixed Table functional component rowSelection failure when using literal value 
- 【Style】
  - Solve the problem that Form.Section does not reference CSS variables and displays abnormal in dark mode
  - Description Add an explicit line-height declaration to prevent inheritance when the parent sets the line-height
- 【Chore】
  - Update Form autoScrollToError type definition to supplement object type

#### 🎉 1.15.0-beta.0 (2021-01-24)

- 【Feat】
    - Cascader cascading menu `onListScroll` monitoring function is implemented to realize drop-down paging, etc. 
    - Added `fieldStyle` to Form Field component props, allowing to define the inline style of the entire field block 
    - Add the `arrowIcon` API for Select, Cascader, and TreeSelect to allow customizing the right drop-down arrow Icon 
    - Align the components (AutoComplete, Cascader, DatePicker, Select, TimePicker, TreeSelect) with the `triggerRender` API into the parameters 
- 【Fix】
  - Fixed an issue where Form declared labelAlign invalid when using wrapperCol and labelCol 
  - Fixed the issue that if the pure digital field under the array path exceeds the boundary of the JS array during Form submit, the key will be cleared during submission 
  - Fixed the issue that DatePicker can select the disabled date through the Input box
  - Fixed TreeSelect reporting an error when treeData is an empty array and value is empty string array 
  - Fixed the problem that the extra content and the tabs-bar are not aligned in the vertical direction when the tabs are in type='button'/'card' mode 
- 【Style】
  - **Body font-family adds `Inter` font as a priority option** 
  - **Modal adds border shadow style by default** 
  - **Adjust the spacing between various Radio, Checkbox and Form Labels in the form** 
  - Tabs remove the padding-left of the first Tab bar when type='line' (4px=>0px), which makes it easier to align left with other Title level elements 
- 【Docs】
  - Table component added 📚 Semi Table FAQ & Self-Check Manual
  - Add Typography.Title to support omitted Tooltip content customization example #973; Add the use example of link text button
- 【Chore】
  - Update Typography dts，extends HTMLParagraphElement、HTMLSpanElement、HTMLHeadingElement 

#### 🎉 1.14.0 (2021-01-15)
- 【Fix】
  - Fixed Empty Illustration not centered in FireFox 
  - Fixed autoAdjustOverflow positioning problem in Tooltip  
- 【Docs】
  - Add content api documentation to Modal 
  - Add documentation for how to use Semi with create-react-app


#### 🎉 1.14.0-beta.0 (2021-01-10)

- 【Feat】
    - Add validateStatus prop to AutoComplete component 
- 【Fix】
    - Fixed the problem of displaying state when Cascader is controlled and dynamically loading data
    - Fixed the problem of Form.AutoComplete embedded label does not show correctly
- 【Style】
    - Fixed the problem of missing color-info series color variables in dark mode

#### 🎉 1.13.0 (2021-01-04)

- 【Fix】
    - Fixed the problem that Navigation initializes data at incorrect timing in SSR scenarios, and unified the data initialization operation by componentDidMount => constructor function.

- 【Chore】
  - Update the CheckEvent interface parameter type in the Checkbox dts file, from optional => mandatory
  - Improve the type definition of the data parameter in the Descriptions dts file
  - Export the Field type definition and the type definition of the Transfer component Item in the Form dts file


#### 🎉 1.13.0-beta.0 (2020-12-25)

- 【Feat】
    - DatePicker 
        - Supports dropdownClassName and dropdownStyle
        - Supports autoSwitchDate prop. When changing the year and month through the left and right buttons at the top of the panel and the drop-down menu, the date will not be automatically switched
    - Table supports using renderPagination custom pagination
    - Empty
        - Added `idle` illustration
        - Add dark mode matching illustrations, and support the introduction of illustrations that need to be used in dark mode through `darkModeImage` to better adapt to dark mode
    - added some icons
- 【Fix】
    - Fixed Anchor anchorID failure in SSR scenarios causing the current Link not to be highlighted
    - Fixed the problem that the doubleClick event of Tree fails
    - Fixed Upload error if file is not in fileList
    - Fixed an error when Tabs uses a single TabPane and keepDOM = \{false\}
- 【Style】
    - Tooltip text color and floating layer color modification to better adapt to dark mode
    - Checkbox adds a corresponding className to the checked checkbox
- 【Chore】
    - Update Checkbox dts to improve the type of onChange input parameter e
    - Update DatePicker dts, increase spacing
- 【Docs】
    - DatePicker adds a closed time list infinite loop example

#### 🎉 1.12.0 (2020-12-18)

-   【Fix】
    -   Fixed the warning of value required in the Cascader Trigger console
    -   Fixed the problem of abnormal verification of PropTypes of BreadCrumb.Item
    -   Fixed the missing problem of Tree onDoubleClick dts

#### 🎉 1.12.0-beta.0 (2020-12-11)

-   【New Component】
    -   Semi adds a component named SplitButtonGroup 
-   【Feat】
    -   Collapse supports setting the position of the expand / collapse button 
    -   Descriptions provide a hidden prop to hide rows 
    -   Dropdown adds the menu prop to configure the content in JSON format
-   【Perf】
    -   Optimization of Tree virtualization full selection performance problem 
-   【Fix】
    -   Fixed that the data was not updated normally when Tree's treeData and expandedKeys were dynamically updated at the same time 
    -   Fixed that Cascader custom triggeRrender did not send out onInputChange
-   【Style】
    -   **The default icon with error meaning is replaced from "clear" to "alert circle" (x => !), involving the components Form, Toast, Notification, Banner, Modal and Upload** 
    -   Modify the border style of disabled Select focus state
    -   Table header displays asymmetry in dark / light mode 
-   【Chore】
    -   Standardize the internal code filename, and change .js =>. jsx with React content (only rename, export unchanged, no impact on external use) 

#### 🎉 1.11.0 (2020-12-04)

-   【Fix】
    -   When uploading multiple files, the Upload component retains the accept format file to continue uploading 
    -   The icon property of BreadcrumbItem updates d.ts to keep the ts type consistent with the protoType type 
-   【Style】
    -   Added the style of the drag-and-drop Upload disabled state; fixed the problem that the drag area is still highlighted after the drag-and-drop Upload is dragged and released
-   【Chore】

#### 🎉 1.11.0-beta.0 (2020-11-27)

-   【Feature】
    -   New language packs: Indonesian, Russian, Vietnamese, Malay, Thai, Turkish 
    -   Upload onRemove adds currentFileItem as third parameter
    -   Transfer
        -   Added draggable sorting 
        -   Added renderSourcePanel and renderSelectedPanel functions, allowing complete customization of component rendering structure 
    -   Select
        -   Added onListScroll scroll callback 
        -   ref added focus() method 
    -   Avatar added size `default`（40x40）
    -   Grid supports gutter to pass in arrays, while defining vertical and horizontal intervals 
    -   Tabs support small, medium and large size
    -   TreeSelect supports searchRender, search and close methods
    -   Typography link supports the use with disabled
-   【Fix】
    -   Fixed that all rows are not expanded when defaultExpandAllRowKeys and groupBy are used at the same time 
    -   Fixed the problem that the parameters onExpand and onExpandedRowsChange were not passed correctly when clicking the collapsed buttons of the group 
    -   Fixed the problem of inaccurate definition of Table empty and pagination d.ts 
    -   Tree/TreeSelect fixed the issue that renderFullLabel could not turn on virtualization because it did not transfer out style
-   【Perf】
    -   Table
        -   Improve the stuttering problem of the virtualization list 
        -   Improve the freeze problem when clicking the selection box in a large data scenario 
-   【Style】
    -   **The maxCount of TextArea is limited by the multi-line input box below => internal**
    -   **Add --color-info variables: if you are using custom theme, you need to publish a new version**
    -   Enforce the ability of .semi-light-scrollbar to take effect on all decendants elements

#### 🎉 1.10.0 (2020-11-20)

-   【Fix】
    -   Upgrade the async-validator version (3.2.4 = > 3.5.0) for the verification dependency of Form rules, and fix the problem of incorrect verification results returned under the deep-rules writing method 
    -   Fixed the problem of error number of files in the input parameter fileList of Upload afterUpload API 
    -   Select
        -   Fixed the issue of not rerendering when value changed from value to undefined in select controlled mode 
        -   Fixed a problem where Select option list were not rendered when filter and defaultOpen used together
    -   Fixed the problem that overlap doesn't work when Avatar size=extra-extra-small 
    -   Fixed the error display of InputNumber keepfocus value in controlled case 
-   【Perf】
    -   Optimize dts of formApi and support passing generics @wangqinhong

#### 🎉 1.10.0-beta.0 (2020-11-13)

-   【Feature】
    -   Select add renderOptionItem API, highly customized option rendering 
    -   DatePicker
        -   Support single click selection range, which can be used for weekly selection and biweekly selection 
        -   Support autoFocus API which can control focus status of input box 
    -   InputNumber supports keeping the input box focused when you click add or minus button 
-   【Fix】
    -   Fixed a problem in which the Form field rules validation rules do not work when they are dynamically switched from null or empty arrays to arrays with length, such as `[{requried: true}]` 
    -   Fixed the problem that when the Form field configuration rules returns a string array, onsubmit will be triggered without onSubmitFail if the verification result is a string array 
    -   Fixed disableDate invalid for year when datepicker type = month 
    -   Fixed column scrolling error caused by rowSpan calculation error in Table with mouse 

#### 🎉 1.9.0 (2020-11-08)

-   【Feature】
    -   RadioGroup supports mode=advanced, allowing single-select combination to uncheck 
-   【Fix】
    -   Fixed the positioning problem of Tooltip in Edge browser in Windows environment 
    -   Fixed the problem that Option styles are lost in the production environment when only AutoComplete is used without Selec
    -   Fixed the problem that window getComputedStyle is wrong when used with gar codesandbox
    -   Fixed the problem that Select autoFocus does not take effect
    -   Fixed the problem that InputNumber keeps triggering onChange when clicking the up button to dynamically switch disabled 

#### 🎉 1.9.0-beta.0 (2020-10-30)

-   【Refactor】
    -   **Spin optimizes the DOM structure, used alone in hidden state no longer render**
-   【Feature】
    -   Form、Field support extraTextPosition 
    -   TreeSelect supports outerTopSlot 
    -   Breadcrumb supports maxItemCount and autoCollapse 
    -   Upload supports onDrop 
    -   InputNumber supports onNumberChange 
    -   Anchor supports targetOffset API to customize offset from top 
    -   DatePicker
        -   Optimize date selection order to allow users to switch year or month update dates in radio mode 
        -   Support dynamic disable date in range mode 
        -   Adds support to spacing
    -   InputGroup supports DatePicker 
-   【Fix】
    -   Fixed no callback on PreviewClick in Upload wall mode
    -   Fixed the status of the eye button when switching password mode dynamically 
    -   Fixed an issue where type does not match expectations when DatePicker format contains Hms 
    -   Spin
        -   Fixed an issue where you can click on table contents when nesting tables in Spin 
        -   Fixed Spin not clearTimeout when unmount
    -   Fixed Popconfirm position not working properly in v1.8.x
-   【Docs】
    -   Update DatePicker disabledDate and disabledTime api documentation
-   【Style】
    -   Fixed left icon height issue in Banner non-full screen mode 
    -   Apply font-size:14px, line-height: 20, color: tertiary when Form.Field extraText is ReactNode

#### 🎉 1.8.0 (2020-10-23)

-   【Feat】
    -   TreeSelect supports optionListStyle API 
-   【Fix】
    -   Fixed the problem of Table selecting all logic errors in filter selected scenarios
    -   Fixed Table columns.onCell can't get style of undefined 
    -   Fixed the problem that the Slider could not slide to 0 when the step of the slider was not 1 
    -   Fixed an issue where clicking the button also triggers the onChange event when the Inputnumber value reaches min or max
    -   Fixed the error of input box id not unique in TimePicker
    -   Fixed Layout Sider Context.Provider warning
    -   Fixed warning when Breadcrumb icon passes into ReactNode
    -   Fixed Step dts description attribute cannot be ReactNode
    -   Fixed the problem that when Step title or description is ReacNode, hover prompts [object object object]
-   【Style】
    -   The corresponding decrease and increase buttons will turn gray when the Inputnumber value reaches min or max
    -   **Treeselect/Tree support labelElipsis, which is enabled by default in virtualization state, and the default value of other states is unified to false. And fix the incomplete display of label.** See more 
-   【Docs】
    -   The component API list is sorted in dictionary order to improve search efficiency

#### 🎉 1.8.0-beta.0 (2020-10-16)

-   【Feat】
    -   Tree supports drag and drop (when virtualization is used at the same time, drag and drop is temporarily not supported)
    -   Cascader supports asynchronous loading of data
    -   Tree supports labelEllipsis, which is turned on by default, and can be turned off if there are special omission requirements
    -   Upload add onPreviewClick to customize the click operation of the file card preview 
    -   Support international RTL/LTR, suitable for switching the direction of component text in multilingual scenarios 
    -   LocalProvider adds Arabic language support
-   【Fix】
    -   Fixed the problem of wrong memo when withField encapsulates Functional Component
    -   Fixed the problem of tabs keepDOM failure and breadcrumb reporting warning caused by react-hot-loader
    -   Fixed the warning that no key was passed in the map operation when TagGroup showPopover 
    -   Fixed the invalid status of Upload customRequest onError
-   【Perf】
    -   Form component dts optimization: withField dts add generics, export the type definition of formApi
-   【Docs】
    -   Add usage document of upload component customRequest custom request method
    -   Add 🧾Semi Form FAQ & Self-Inspection Manual
    -   UMD version removes code comments

#### 🎉1.7.0 (2020-10-10)

-   【Fix】
    -   Fixed the issue of dynamic update of Resizable Table header
    -   Fixed the dts return type of Toast and Notification static methods
    -   Fixed the problem that onClick does not exist in Step's .d.ts
-   【Style】
    -   Fixed the center alignment of TreeSelect multi-select label

#### 🎉 1.7.0-beta (2020-09-18)

-   【Feat】
    -   Tree and Treeselect support renderFullLabel API, which can meet various highly customized rendering requirements of the label, such as the logical separation of parent node and child node 
    -   Semi supports global prefixCls replacement 
    -   List grid property supports passing grid's justify, type and align attributes 
    -   Typography adds success type
-   【Fix】
    -   Fixed Form formApi.validate(['a', 'b']) when manually triggering partial verification, the verification results are not based on the input parameters, and the problem of full judgment is still adopted 
    -   Fixed the problem that failed to reset Form.Checkbox after reset Form
    -   Fixed the problem where the parent node was refreshed due to the dynamic deletion of child nodes when Tree was animated 
    -   Fixed display behavior of select all button in Table header 
-   【Perf】
    -   Tree，TreeSelect
        -   Optimize performance issue of Tree and TreeSelect 
        -   Tree and Treeselect support data structures that do not transfer value. The data structures need to be consistent 
-   【Style】
    -   Optimize the spin style of Tree loading state
    -   Select
        -   Optimize the height of small size and large size in multi selection
    -   Tag
        -   Align the height of all color Tag, and align the height of Tag when it is closed or not

#### 🎉 1.6.0 (2020-09-18)

-   【Fix】
    -   Fixed the problem that the input parameter type of Transfer d.ts onChange is not correct with the actual type 
    -   Fixed Slider marks not including boundary value issue; Fixed the height problem caused by Slider vertical-align baseline 
    -   Fixed the height problem of the Table selection button. The vertical align of the button was changed from the default value to bottom 
-   【Docs】
    -   Increase the display of related materials to make it easier for users to find material resources related to components

#### 🎉 1.6.0-beta (2020-09-11)

-   【Feat】
    -   Select add innerTopSlot and outerTopSlot API (MR)
    -   Tag add avatar Tag, including avatarSc and avatarShape API 
    -   description data supports function type 
    -   Tree, tree Select supports renderLabel to customize label 
    -   Dropdown.Menu supports props passing down, Dropdown.Item supports onContextMenu event binding 
-   【Fix】
    -   Fixed error when InputGroup children have null nodes
    -   Fixed error when clearing Transfer entered filtered content
    -   Fixed Pagination's pageSize dynamic change when Select selected value does not follow change 
    -   Fixed Typography truncation without overflow still showing tooltip 
    -   Fixed the result of the intersection was incorrect during Table multi-column filtering 
    -   Fixed the error report caused by circular dependency in the production environment when the usage of RadioGroup and CheckboxGroup options are used with Form 
    -   Fixed the problem that disabled does not take effect when CheckboxGroup jsx declares children usage 
    -   Fixed DatePicker allow input date when needConfirm 
-   【Style】
    -   Modal title Icon aligned with text by center => flex-start 
    -   Fixed List card-style empty state centered style
    -   Tree, Tree Select
        -   Default Label long text omitted after virtualize is turned on 
        -   Interactive update when clicking Action = "click" to click the leaf node can click ToHide
    -   Tableheader's sorter and filter icon, their margin left by 8px => 4px 

#### 🎉 1.5.0 (2020-09-04)

-   【Fix】
-   Fixed Form.Switch disabled property is not updated when the Form dynamically switches the disabled property 
-   Fixed stack overflow after infinite compression in response state of Typography ellipsis
-   Fixed searching status in virtualize Tree causing selection not responde first time 
-   Fixed dts file loss problem of Modal, Notification and Toast
-   【Perf】
-   Removed full import of TimePicker, DatePicker and Table to optimize packing size
-   Removed the sourcemap of UMD package

#### 🎉 1.5.0-beta.0 (2020-08-31)

-   【Feat】
    -   Calendar day view supports displaying multiple days 
    -   Avatar
        -   Support `imgAttr` to pass through HTML attributes of img tag 
        -   Add the truncation function and overlapfrom, maxcount, rendermore API 
    -   Treeselect supports clickToHide, and radio mode is valid 
    -   Upload
        -   If limit is set to 1, after a file has been uploaded, the current file will be automatically replaced when the file is uploaded again 
        -   Support custom request method
    -   InputNumber supports hovering display buttons; press shift and click button to increase or decrease larger step size 
-   【Style】
    -   The default height of the external button of InputNumber is changed from 30px to 32px
-   【Fix】
-   Fixed missing second parameter for InputNumber onChange function
-   Fixed missing TextArea onResize .d.ts type definition
-   Fixed missing Table virtualized.onScroll .d.ts type definition
-   【Docs】
-   Updated formApi.validate() field validation doc

#### 🎉 1.4.0 (2020-08-21)

-   【Style】
-   Fixed hover color in datePicker range mode: blue-0 => primary-light-default
-   【Fix】
    -   Fixed missing key warning and animation when Tree label is ReactNode 
-   Fixed autoComplete getPopupContainer props not working
-   Fixed InputGroup onFocus, onBlur on child component overwritten problem 
-   Fixed some dts props typo in Upload and Select；remove BreadcrumbItem from index.d.ts

#### 🎉 1.4.0-beta.0 (2020-08-14)

-   【Feat】
    -   DatePicker supports custom rendering of date content and date box 
    -   TreeSelect supports onVisibleChange API 
    -   Tree supports disableStrictly API 
    -   Collapse supports motion parameter
-   【Style】
    -   Change Table thead borderWidth from 1px to 2px
    -   DatePicker current date adds gray background to make it more prominent
-   【Fix】
    -   Fixed click the clear button does not trigger the validator problem in Form.TimePicker 1.3 version
    -   Update DatePicker and TimePicker onBlur event trigger time from input blur to panel close 
    -   Fixed the style problem of CSS selector with right margin added to all icons in Tree label
-   【Docs】
    -   Icon component adds stroked icon list
    -   Update the document of Table component and fix the problem of some props default value description error

#### 🎉 1.3.0 (2020-08-07)

-   【New Component】
-   Added `Anchor` 
-   【Feat】
    -   Added stroked icon to the Semi official icon library, which needs to be used as user-defined way
-   【Style】
-   Adjust Subtext alignment of dragable `Upload` component from left to center
-   Alignment of Sidesheet's close button and title from center to flex-start
-   【Fix】
-   Fixed Input component size syntax prompts error
-   Fixed the incorrect display of icon when upload failed/validate failed in Upload listType=picture
-   Fixed TextArea autosize mode passing ref error #714
-   【Perf】
    -   Replace Table dependency from lodash to lodash-es, remove the full lodash imported by Avatar and optimize the packing volume
    -   Breadcrumb routes support passing custom key

#### 🎉 1.3.0-beta.0 (2020-07-31)

-   【Feat】
    -   Semi provides UMD version 
    -   `Input` provides password mode 
    -   `SideSheet` adds support to footer，**containing changes in padding, margin, etc** 
    -   `Upload` adds support to promt, promptPosition for listType=picture mode 
-   【Fix】
    -   Fixed value always empty using `Tree` TriggerRender in multiple mode
-   【Perf】
    -   Fixed unquoted variables warning for interpolation in sass-loader 9.x 

#### 🎉 1.2.2 (2020-07-26)

-   【Perf】
    -   Optimize the SVG animation in `Icon` to CSS animation, and fix the problem of page redrawing. If you need to use loading `Icon` alone, please add CSS animation
    -   `OverflowList` does not reset the state of the render function any more. If you need to reset, you can refresh the component by updating the `key`
    -   Optimize the status reset of text dynamic update in `Typography` `ellipsis` mode
-   【Fix】
    -   Fixed `Button` height style bug
    -   Fixed style loss in `Descriptions` `row` with different sizes

#### 🎉 1.2.0-beta.0 (2020-07-17)

-   【Feat】
    -   Imperative Modal component supports use with configProvider 
    -   Notification, Toast supports usage of useHooks
    -   Typography supports tertiary and quaternary types
-   【Style】
    -   Adjust the transparency of color-text-3 from 0.2 to 0.35
    -   Checkbox border transparency adjusted from 0.08 to 0.2
    -   Provide custom scroll-bar style class name, use through .semi-light-scrollbar
-   【Fix】
    -   Fixed modal to cover the overflow style of body
    -   Fixed the problem that the last column of the table with fixed head may not be aligned when the mouse is inserted
    -   Fixed the problem that the filter is true in the case of multiple selections in Select, and an error is reported when the search has no data 

#### 🎉 1.1.0 (2020-07-14)

-   【Fix】
    -   Fixed the problem that Form.TimePicker does not trigger validator judgment after clicking the clear button 

#### 🎉 1.1.0-beta.0 (2020-07-03)

-   【New Component】
    -   Added `OverflowList`
-   【Feat】
    -   `Tabs` component folding function support 
    -   `TreeSelect` component supports outerBottomSlot 
    -   `Modal` non-command call supports setting title icon 
    -   `DatePicker` supports transparent transmission of TimePickerOpts parameters to TimePicker 
    -   `Table` merge table header function support 
    -   `Table` supports custom rendering of each item of floating layer 
    -   `Table` supports incoming default page number 
    -   `Table` supports automatic scrolling to the first row when cutting pages 
    -   `Upload` adds onClear callback 
    -   `Form` `Field` supports pure switch to only take over the data stream without inserting Label, ErrorMessage and related DOM structures 
-   【Fix】
    -   Fixed tree flickering abnormality in the state-controlled state filter search value animation 
    -   Fixed the problem that the copy with empty data cannot be displayed correctly in the middle when there are many `Table` headers 
    -   Fixed the problem that the sorter configuration is incorrect when the `Table` is switching page 
    -   Fixed the problem that `Table` still displays selected columns when rowSelection is false 
    -   Fixed `Tooltip`'s getPopupContainer using configProvider is invalid 
-   【Performance】
    -   Optimized displayName of withField HOC to facilitate positioning related elements in React devtool 
-   【Style】
    -   `Modal` imperative content and header add 8px spacing
    -   Fixed the center alignment problem of `Banner` close button

#### 🎉 1.0.0 (2020-06-24)

-   【Fix】
    -   Fixed `Tree` animation flashes etc. when in controlled expandedKeys mode and using with showFiltereOnly 
    -   `Icon` loading on demand path changed
-   【Feat】
    -   `List` renderItem method supports custom key 
-   【Style】
    -   Tertiary `Button` light and borderless mode change text color from `color-tertiary` to `color-text-2`

#### 🎉 1.0.0 - beta.0 (2020-06-12)

-   【Fix】
    -   Fixed the problem that the empty value in `Cascader` is not returned to placeholder under the controlled state
    -   Fixed an issue where `Tree`'s expandedKeys disappeared after manually emptying 
    -   Fixed the problem that `Table` cannot display empty status when virtualization is enabled
    -   Fixed `Form.Upload` when uploadTrigger is custom, onChange will not be triggered after the file is selected, and the corresponding file list is not synchronized to formState 
-   【Performance】
    -   Optimized `Form.Select` to enable onChangeWithObject, external calls to formApi.getValues and setValues are likely to cause stuck problems
    -   Optimize `Spin` svg animation stuck issue when rendering with large amount of data 
-   【Feat】
    -   `Icon` supports loading on demand
    -   `Modal` supports keepDOM, the default behavior of lazyRender remains to be destroyed 
    -   `Paragraph` component supports less than n lines of text, does not display expanded and collapsed text 
    -   `ConfigProvider` supports getPopupContainer
    -   `Table` emptySlot outer layer changed from p to div component
-   【Style】
    -   `Typography` link is changed to no underline style by default, and underline can display underline in hover/active state
    -   In `Tab` card mode, the extra content is centered to support the card, which involves DOM structure adjustment
    -   Fixed styling issue when using `Radio` as dot in Timeline

#### 🎉 1.0.0 - alpha.0 (2020-05-29)

-   【API Adjustment】

    -   Banner removed the `target` attribute, please directly use the JSX wording
    -   Breadcrumb removed the usage of`BreadcrumbItem`, please use `Breadcrumb.Item` instead
    -   The order of the two parameters of the DatePicker `onChange` callback is reversed, changed from `string` and `Date` to `Date` and `string`, if you need to restore, please use `onChangeWithDateFirst={false}`
    -   Input, InputNumber removed the`clearable` attribute, DatePicker, TimePicker removed the `allowClear` attribute, please use`showClear` instead
    -   Select officially deprecated `labelInValue`, please use`onChangeWithObject` (available since 0.23.0) instead
    -   Select officially deprecated `optionLabelProp`, please use`renderSelectedItem` ( Available since 0.23.0) Custom function replacement
    -   TextArea removed `onPressEnter` property, please use`onEnterPress` instead
    -   Tree removed `labelInValue` property, please use`onChangeWithObject` instead
    -   TreeSelect removed `valueInArray` Properties, please get related node properties through `onChange` or`onChangeWithObject`
    -   TreeSelect removes the `allowSearchClear` attribute, please use`showSearchClear` instead
    -   Upload abolished `onXhrFinish` and added a more customized`afterUpload` instead The functions of the two are similar, but the value structure that needs to be returned is not equal. For breaking change
    -   Upload, the use method of `beforeUpload` is modified and aligned with`afterUpload`. The value structure of the return is not equivalent to the 0.x version. It is a breaking change. Note that compared with the 0.x version, the file that failed verification will still exist in the fileList and will not be automatically deleted.
    -   Component input parameters with `onBlur`,`onFocus` methods are unified as Function (e: Event) 

-   【Refactor】
    -   Banner: DOM structure / class name / api adjustment, style update
        -   remove `target` attribute
        -   default of`type` attribute changed to info, default value is info
        -   new api: `fullMode`,`title`, `description` , `icon`,`closeIcon`, `bordered`
-   【Feat】
    -   Avatar
        -   New size of `size`: extra-extra-small 20px, the original small size is adjusted to 24px
    -   Calendar
        -   Event Object It is required to pass`key` to control the update and redraw of events 
        -   Added: `dateGridRender` allows custom cell / column content and style 
    -   Collapsible
        -   Added: `collapseHeight` to support custom folded height
    -   Empty
        -   Added:`title`
        -   Original `description` style adjusted to 14px font, secondary font Color
    -   Form
        -   Form Props add `showValidateIcon`, automatically display red X icon before error message, the default is true
        -   Form adds Form.Upload module
        -   Form adds Form.Section module, used to quickly group Fields on the layout
        -   Field Props add
            -   `helpText` placement prompt information (share the same block display with the verification result, when both have values, the verification result is displayed first)
            -   `extraText` is used to place additional prompt information, often displayed and will not Overwritten by verification result
        -   error message supports ReactNode (return ReactNode in validate or rules in version 0.x will be considered to pass verification, and return to ReactNode after version 1.0 will be the same as the return of string, which is regarded as verification failure)
    -   InputNumber
        -   New: `hideButtons` is used to control the hiding of the" increase / decrease "buttons, ** discard the original suffix = {null} method **.
    -   List
        -   Added: `onRightClick`,`onClick` responds to corresponding mouse events 
    -   Modal
        -   Added `closeOnEsc`Support to close the popup window by keyboard Esc, add `closeIcon` to support custom close button
        -   add `size` support small, medium, large and full-width
    -   SideSheet
        -   add:`headerStyle`, `afterVisibleChange`, `closeOnEsc`
    -   Spin
        -   Added:`childStyle`
    -   Table
        -   Two types of information density `"middle"` and `"small"` have been added.
    -   Tabs
        -   Added `keepDOM`, which supports the destruction of non-active panels in jsx writing 
        -   Added `tabPosition` to support tab at the top or left ('left', 'top'),
        -   Added`lazyRender` to support lazy loading of tabPane 
    -   Toast / Notification
        -   Added: `theme`('light', 'normal') Support notification message with background color
    -   Tree
        -   Added `loadData`, `loadedKeys`,`isLeaf` Support dynamic loading of data
        -   New: `onChangeWithObject` Support to return with node information The object is the input parameter of onChange
        -   `searchRender` supports false to hide the search box
    -   TreeSelect
        -   New:`onChangeWithObject` supports returning the object with node information is the input parameter of onChange
        -   New: `showClear` supports clearing Options
    -   Typography
        -   copyable Supports `copyTip`，to customize copy tooltip text
    -   Progress
        -   Added: `orbitStroke` allows custom track colors
    -   Skeleton
        -   Skeleton.Avatar Added:`size`, supports the corresponding size of Avatar components 
    -   Upload
        -   add `renderFileItem` custom file card rendering structure, add`itemStyle` to quickly change the inline style of fileItem
        -   add `showClear`,`ShowRetry`, add manual retry mechanism, add file list to quickly clear
        -   add `transformFile`, support to convert files after file selection, before file upload
        -   add`onChange` callback, callback for file upload status change, uploading , If it fails, the callback will be called after completion
        -   add `validateMessage`,`validateStatus` to customize the overall verification status of Upload and display the verification information
        -   after selecting the file, the file with illegal file size will also be displayed in fileList ( It is shown in red but uploading will not be activated), and it is clearer which specific files are illegal. Similarly, files that are not uploaded in `beforeUpload` will also be displayed in the fileList
        -   add`afterUpload`, support After the upload is complete, update the status of the corresponding file in the fileList and support automatic file removal
        -   Fixed the problem of the wrong second parameter of `onExceed`
        -   Support the controlled`fileList`
        -   Drag-and-drop Upload supports incoming `children` More freedom Customize the content of the drag zone in degrees
        -   in the photo wall mode, when the number of uploaded files reaches the limit, it will be automatically hidden + Trigger
-   【Performance】
    -   TextArea removes life-cycle method of componentWillReceiveProps 
    -   Modal removes life-cycle method of componentWillMount 
-   【Style】
    -   Breadcrumb
        -   Text color adjustment
        -   The default position of the tooltip is changed to top
        -   Adjust the class name structure, icon text alignment
    -   Button
        -   Remove the default margin-right
        -   Remove the fixed height of buttons of different sizes, add padding corresponding to different sizes
        -   Iconbutton The default theme is the same as the button theme (theme = "light")
        -   IconButton is no longer recommended but still exported
    -   Checkbox
        -   Adjust the margin-bottom of Checkbox in CheckboxGroup: 16px => 12px, remove the margin of last-of-type -bottom
    -   Collapse
        -   Added hover, active effect in header area
    -   Empty
        -   Illustrations update
    -   Form
        -   Automatically added when error message is displayed ❌ icon (if not required, you can close it with showValidateIcon)
    -   Input prefix / suffix / addonBefore / addonAfter style adjustment 
        -   prefix / suffix is no longer processed as Icon when passing in a string, and is directly mapped into a string; Icon needs to be passed in the form of React.Node
        -   there will be no padding when passing in a custom ReactNode, only the String and Icon have their own padding
    -   InputNumber
        -"Up / Down" button is adjusted to the right of Input
    -   Modal
        -   Adjust the head and title style, unified declarative and imperative styles
    -   Popover / Tooltip
        -   Change default value of arrowPointAtCenter from false to true
    -   Progress
        -   LineProgress bar progress bar percentage text color is fixed to color-text-0 black , No longer consistent with the fill color of the progress bar
    -   Pagination
        -   increase the style declaration of margin-block-start: 0, margin-block-end: 0
    -   Radio
        -   adjust the margin-right / margin of Radio in RadioGroup (horizontal / vertical) -bottom: 16px => 12px, remove margin-right / margin-bottom of last-of-type-horizontal RadioGroup display is adjusted to inline-block
    -   Select
        -   adjust display logic of clear icon, only display when expanded or hover , And share the same display area with the arrow icon
    -   SideSheet
        -   Support width and height settings for percentage (involving DOM structure adjustment) 
    -   Steps
        -   adjusted the size of the status icon, 32px => 24px, fine-tuned other styles, increased the waring status
    -   Spin
        -   the original DOM size when used normally 0 x 0 => corresponding width, height
    -   Tree
        -   remove the minWidth restriction
    -   TreeSelect
        -   remove the default maxHeight restriction
    -   Table
        -   change table header background color to white
    -   Tag
        -   light type text color darkens, changed to Color No.8
        -   remove the margin-bottom and margin-right that comes with 8px by default
    -   Typography
        -   Typography.Title default font-weight to 700
        -   strong props change font-weight 600 => 700

#### 0.37.0 (2020-05-22)

-   【Fix】
    -   Fixed the issue that only allowEmpty was not consumed when `Form` register / remounted and allowEmptyString was not consumed
    -   Fixed `Casacader` error when using triggerRender 
    -   Fixed the problem that `TextArea` cannot input Chinese in controlled state 
    -   Fixed the stuck issue when the `Nav.Item` is clicked 
    -   Fixed the problem that the fixed `Column.width` is a percentage failure 
    -   Fixed the problem that the `itemSize` value of the virtualized `Table` is too small when the row is displayed 
-   【Perf】
    -   `Select` supports virtualize and optimizes performance in large data scenarios 
    -   Optimize the virtual table rendering mechanism to improve the experience when the data changes frequently 

#### 0.37.0-beta.0 (2020-05-15)

-   【Feat】
    -   `TextArea` supports onResize callback 
    -   `Modal` supports destroyAll 
    -   `Table` virtualization supports data grouping 
    -   `Table` supports getting current page data
-   【Fix】
    -   Fixed the problem that `Textarea` does not have autosize in the second tabPane of tabs 
    -   Fixed `Cascader` crashing when opening Google Translate for selection 
    -   Fixed the problem that the `Table` virtualization itemSize is too small and the rows cannot be displayed normally 
    -   Fixed the problem that the incoming percentage of `Table` virtualization Column.width cannot be normal and realistic 
    -   Fixed the problem that the file is still displayed after onError is triggered when `Upload` action 4xx / 5xx 
-   【Perf】
    -   Optimized the performance of `Table`virtualization when rendering when the frequency of data changes is high 

#### 0.36.0 (2020-05-08)

-   【Feat】
    -   Form.Slot supports individual customized abelPosition
    -   Select defaultActiveFirstOption supports to be consumed again after updating optionList in remote search 
-   【Fix】
    -   Form ArrayField
        -   Inner ArrayField not updated after setValues in nested usage
        -   A value under ArrayFields is set with initValue. If setValues + isOverride at this time, the value will not be set successfully 
        -   After removing a row, leaving a null 
    -   Fixed Table fixed column + virtualized horizontal scrollbar positioning issue 
-   【Style】

    -   Fixed alignment issue of switch and rating in Form when labelPosition=left 

#### 0.36.0-beta.0 (2020-04-24)

-   【Feat】
    -   Add a unified prefix for the built-in icon of semi to prevent conflicts with variables of the same name in window 
    -   `Form` add stopValidateWithError switch at the `Field` level, short-circuit subsequent verification after error 
-   【Fix】
    -   Fixed the issue that when `Progress` percent is dynamically changed from N-> 99.98, the animation number will be rendered as 100 
    -   Fixed the problem that setting the value to null in the `Cascader` controlled mode is invalid and cannot be cleared
    -   Fixed an error when `Cascader`'s children's layer is an empty array
    -   Fixed the problem that the update of `DatePicker` will slow down one step when the time is selected 
-   【Perf】
    -   `Form` `ArrayField` aligns the field about the initial value behavior, which can be set either through initValue or initValues in Form props (newly added this time)
-   【Style】
    -   `Form`, adjust the upper and lower spacing of `Form.InputGroup` margin 16 => marign 0 && padding 12, align with `Field` 

#### 0.35.0 (2020-04-17)

-   【New Component】
    -   Add new component `Transfer`
-   【Feat】
    -   `Tree` adds support to following apis:
        -   expandAction supports expand logic including false, click, doubleClick 
        -   onRightClick 
        -   searchRender to render custom search box 
    -   `Cascader` add support to following apis:
        -   onDropDownVisibleChange
        -   showClear to clear value with clear button
        -   support disabled status for options 
        -   onBlur, onFocus
    -   `Rating` adds support to customize character size
    -   `Table` supports the custom display of the expand button 
    -   `Table` supports the usage of fixed columns and grouping data 
    -   `Navigation` supports the param "collapseText" to modify the title of the collapse button 
    -   `Form` formApi supported getValues() 
    -   `Form.Slot` supported noLabel 
    -   `Form` supports the configuration of disabled. When it is true, the internal fields automatically inherit the disabled attribute 
    -   `AutoComplete` supports onFocus, onBlur 
    -   `Form` field props support stopValidateWithError, after a certain rule test fails, it will not trigger subsequent rule verification 
-   【Fix】
    -   Fixed `Cascader` flashing problem when dropdown close 
    -   Fixed the problem that when `Form` uses array fieldPath (eg: panels [11]]. Start), the value is modified after verification, and the error information does not match 
    -   Fixed `Form` calls formApi.validate (), lack of required information triggers verification, after rejecting, add information and then validate, may still be rejected 
    -   Fixed `DatePicker` will jump to the month of the first selected date when selecting different month dates in multi-selection state 
    -   When `Form` ArrayField asynchronous setValues update, the value has changed, but the rendering has not been updated 
    -   Fixed the problem that the file list arrangement style is incorrect and the + sign is wrapped when `Upload` type = picture 
    -   Fixed `Form.Switch` error when using Safari browser 
    -   Fixed the issue that target in `BackTop` might have been removed when unmounting
-   【Style】
    -   Adjust styles for empty content for `Tree`、 `TreeSelect`、 `Cascader` 、`Select`
    -   Add animation to `Rating` 
    -   Fixed `Input` styles for:
        -   ValidateStatus with append / preprend
        -   Border-radius with only append or preprend
        -   Suffix overflow
-   【Perf】
    -   API adjustment and console warning: The original API will still be supported until 1.0, but it is no longer recommended
        -   `Tree` adds onChangeWithObject to replace labelInValue
        -   `Tree` adds showClear to replace clearable
        -   `TreeSelect` will remove valueInArray in v1.0.0-rc, it is recommended to get related node properties through onChange
        -   `TreeSelect` adds showSearchClear to replace allowSearchClear
        -   `Input`, InputNumber add showClear, replace clearable
        -   `DatePicker`, `TimePicker` add showClear, replace allowClear

#### 0.34.0 (2020-04-03)

-   【New Component】
    -   `Empty` component
-   【Feat】
    -   `Typography` ellipsis feature extension 
        -   Supports truncation of Text, Title and Paragraph
        -   Supports single-line, multi-line truncation; supports fixed suffix; supports truncated position from end or middle
        -   Supports for expandable, collapsible and custom text tip
        -   Supports properties to configure tooltip
    -   `Breadcrumb` truncation logic optimization 
        -   Changed from truncation at certain text length to width truncation.
        -   Supports showTooltip prop to configure truncation width, position, etc.
    -   `Modal` supports maskFixed
    -   `Toast`、`Notification` supports getPopupContainer 
    -   destroyAll method for `Toast`, `Notification` changed to destroy wrapper as well 
    -   `Tree` 、`TreeSelect` supports autoExpandParent 
    -   `TreeSelect` supports autoAdjustOverflow
    -   `Select` adds close () and open () methods, which can be used to manually control popup expansion / closing 
    -   `Select` to prevent a selected item from being deleted in the multiple selection mode; add onClear callback 
    -   `Form` onValueChange adds second parameter: changedValues, which specifically reflects the currently changed field 
    -   `TextArea` supports validateStatus
    -   `Table` supports setting scroll width without setting scroll.x and Column.width to set width automatically 
    -   `Table` supports rendering multiple contents into the same cell 
    -   Floating layer component supports custom Trigger 
    -   Floating layer components uniformly support the parameter stopPropagation to prevent element click events on the floating layer from bubbling
    -   `Tooltip`/`Popover`/`Popconfirm` supports small triangle pointing to the center of the element 
-   【Style】
    -   `DatePicker` date selection panel style update 
-   【Fix】
    -   Fixed `Tree` `TreeSelect` not recollecting value in single controlled mode when treeData changed
    -   Fixed conflict between expandedKeys in `Tree` controlled mode and automatic expansion in search status 
    -   Fixed searching results not updated when search input has a value and treeData is dynamically updated in `Tree` 
    -   Fixed clearing search value not triggering onSearch in `Tree` and `TreeSelect`
    -   Fixed the problem that the `Upload` progress bar is not displayed during the Upload process and the status bar in the defaultFileList is successful.
    -   Fixed the problem that `Col` with `Grid` span 0 does not reflect the display: none feature 
    -   Fixed the problem that `AutoComplete` is disabled when data is not empty; fix the problem that `Option` hover style only responds to keyboard events but not mouse events;
    -   Fixed `Select` still react enter keyboard events while loading
    -   Fixed a performance issue when the `Column.title` passed to multiple Tables was ReactNode 

#### 0.33.0 (2020-03-20)

-   【Fix】
    -   Fixed the situation where the component internal state is not updated under the `Navigation` selectedKeys controlled condition 
    -   Fixed the problem that dataSource cannot be displayed asynchronously in the `Table` component group rendering mode 
    -   Fixed an issue where `DatePicker` would skip the confirmation replacement when clicking the preset when confirmation is needed in the future
    -   Fixed the issue that when `Select` is used in `Popover` with trigger as click, and click on the clear button when showClear is true
-   【Feat】
    -   Support some features and optimization for `Table`
        -   Fixed column optimization, using "position: sticky;" positioning instead of rendering multiple tables in the old version
        -   Supports virtualization, covering large-scale data rendering scenarios 
        -   Supports infinite scrolling after enabling virtualization 
        -   Prohibit text selection in header 
        -   Optimized the problem that the hover state does not follow in the fixed column scenario 
        -   Supports custom elements such as div instead of elements such as table/tbody/tr 
        -   Expanded row adds extra className: semi-table-row-expanded
    -   `DatePicker` supports specifying default time selection 
    -   Support some features for `Form`
        -   Support autoScrollToError, which is used to automatically scroll to the first error field after validation finish， 
        -   formApi.validate / reset supports validation / reset of specific fields 
        -   Added formApi.scrollToField (field), which is used to manually trigger scroll to the specified field
        -   `Form.Label` adds extra attribute to add content after required identifier 
    -   `Typography` copyable supports successTip to customize tip when copied successfully 
    -   `Cascader` supports defaultValue directly rendered as string when not available in data list 
    -   `Modal` supports getPopupContainer 
-   【Style】
    -   Style changed for `Checkbox` & `Radio` : Secondary color related variables changed to Primary 
    -   Disabled style updated for all Input type components 

#### 0.32.0 (2020-03-06)

-   【Refactor】
    -   `Tree`, focus on optimizing the rendering performance of large amount of nodes 
        -   New api: disabled, emptyContent, showFilteredOnly 
    -   `TreeSelect`
        -   New api: allowSearchClear, defaultExpandAll, defaultExpandedKeys, defaultOpen 
        -   Support onFocus/onBlur method 
        -   Fixed issue that uncheck checkbox will lead to unexpected closing dropdown menu
-   【Feat】
    -   `DatePicker` supports disabling time selection 
    -   Add propTypes to some functional components 
    -   `Modal` function call supports destroy( ), and update( ) 
    -   `Upload` supports passing in data/headers in the manner of (file) => object 
    -   `Table` adds the disable effect of Checkbox, and cancels the logic that the checkbox of the table header is selected when the valid data item key array is empty. 
-   【Fix】
    -   Fixed the issue where onChange could not be triggered when a custom preset was clicked in the date picker 
    -   Fixed `Slider` position problems in range mode with min value set 
    -   Fixed `List.Item` used in jsx not supporting grid and layout 
    -   Fixed `Form.Select` throws error using group 
    -   Fixed the problem that when the checked `Checkbox` exists in Select outerBottomSlot, clicking causes the `Select` to collapse 
    -   Fixed the problem that UI rendering is not updated when `Form.CheckboxGroup` does not carry initValue 
-   【Style】
    -   `Navigation` text color changed to "--color-text-1" 
    -   `Form.Label`, when labelPosition is top, add explicit `display: block` declaration of label element to make sure the height of label is correct when using in systems without reset / normalize
    -   When `Form` layout = 'vertical', adjust the vertical spacing of the field. Forms arranged vertically will be more loose (marginTop / Bottom folded 16px => paddingTop / Bottom superimposed 24px). The height of Form will change. 

#### 0.31.0 (2020-02-21)

-   【feat】

    -   `Select` support grouping option via `OptGroup` 
    -   `Select` add `onFocus`/`onBlur` callback 
    -   Provide `ConfigProvider` component to support time zone configuration 
    -   `Form.Slot` supports use without`Form` 
    -   `Slider` supports`railStyle`, which can be used to implement segmented track colors 
    -   `RadioGroup` supports`direction` 
    -   `Step` Add `onClick` support and automatically add `cursor: pointer` 
    -   `TagGroup` supports`showPopover`, displaying the remaining `+ N` content through a floating layer 

-   【fix】

    -   Fixed `Select` allowCreate input non-existent label, click outSide without selecting any item, then click Select to expand, 'create xxx' candidate still exists 
    -   Fixed `Form` labelWidth not working for `Form.InpurGroup` 
    -   Fixed the problem that the date list may cause the year list to be misplaced when the month is selected by the `DatePicker` component 
    -   Fixed `DatePicker` crash when `format` and `type` conflict 
    -   Fixed the problem of incorrect padding of the first button when using multiple icon buttons in `ButtonGroup` 
    -   Fixed the issue that `import * as React` was not used in`.d.ts` 
    -   Fixed warning when `TagGroup` doesn't pass key
    -   Fixed `Slider` hint text is not centered and disable style 
    -   Fixed style of `InputGroup` parent pass through and override children's `style`
    -   Fixed the `Step` component's `className` not taking effect
    -   Fixed the problem of the `Upload` component `withCredentials`

-   【style】

    -   Update the size of `Select` Option Icon tick
    -   Update the interval of `Pagination` showTotal content, add a space around the number
    -   Fixed the left side of the input box when passes `multiple` and `filter` to `Select` 

-   【docs】
    -   emoved wrong visible in Modal imperative calls
    -   Added examples of Tooltip and Popconfirm / Popover nesting directly

#### 0.30.0 (2020-02-07)

-   【feat】

    -   `InputNumber` is also performed once if the content changes when losing focus. 
    -   `Dropdown` adds style name to trigger element. 
    -   `Table` When the row selection or expansion function is enabled, if there is no key attribute for each data item in the dataSource or the attribute name specified as the primary key with rowKey is not used, the console will report an error. 

-   【Fix】

    -   Fixed missing `Form` .d.ts onChange declaration.
    -   Fixed the issue that the `Table` dataless copy would be below the horizontal scroll axis of the table. 
    -   Fixed table header misalignment after fixed table. 
    -   Fixed using JSX column in `Table` leading to misalignment of fixed column with wrapping content 

*   【Perf】

    -   `Collapsible` optimization refactoring.
        -   Fixed warning issue when using keepDOM console. 
        -   Optimize the logic for nesting, no need to manually pass in animation nodes. 

*   【Style】

    -   `Table` component selection box resizing. 

#### 0.29.0 (2020-01-10)

-   【feat】

    -   `SideSheet`

        -   Added `size`,`disableScroll`, `getPopupContainer` 
        -   Allow external operations when setting `mask = {false}` 
        -   The class name of `SideSheet` has changed as follows:`semi-modal-wrap` => `semi-sidesheet-inner-wrap`,`semi-modal` => `semi-sidesheet-inner`, the rest `semi-modal-x` =>`semi-sidesheet-x`

    -   `Table`

        -   Support group display data 
        -   Support transparent pass parameter to filter floating layer 
        -   Pagination copy is not displayed when the number of data is 0 
        -   Support local filtering or sorting of child data 

    -   `Calendar`,`Typography` supports i18n
    -   `PopConfirm` added `okButtonProps`, `cancelButtonProps`

-   【Fix】
    -   `Modal`
        -   Fixed omission of d.ts declaration for properties such as content 
        -   Fixed the issue of default visible is true and scroll penetration when imperative call 
    -   Fixed `SideSheet` popping up when setting motion = {false} 
    -   Fixed the issue that DatePicker will change the date in "dateTimeRange" mode 
    -   Fixed missing className and style in `DatePicker` dts declaration 
    -   Fixed the issue that the expand button in Table is not centered vertically 
    -   Fixed `InputNumber` being unable to input after setting" max "parameter 
-   【Style】
    -   `Modal` keep footer bottom when changing height
    -   `Notification` content is the same width as the title
    -   When the `Select` component is multi-selectable and searchable, the input is automatically cleared after losing focus

#### 0.28.0 (2019-12-27)

-   【feat】

    -   Add `.d.ts` to provide more friendly syntax tips in IDEs such as vscode 
    -   `Form` New Form. AutoComplete 
    -   `Form.Slot` supports incoming error 
    -   The `Modal` component imperative calls onOk support Promise and then close the dialog box 
    -   `Cascader`, `TreeSelect` support insetLabel, prefix, collectix 
    -   `Cascader`, `TreeSelect` support validateStatus 
    -   The `Rating` component allowhalf attribute supports the display of decimals other than 0.5 
    -   `Upload` type detection and corresponding styles when removing the drag-and-drop upload component onDropEnter (file details are not available when dragging is not loose due to browser policy constraints) are detailed in 

-   【fix】

    -   Fixed the problem that `Select` multi-selection + maxTag Count + width width is insufficient and option content is too long, and the selected item location offset may not be displayed 
    -   Fixed an issue where the number of newly added Item entries may change when Field on Change in ArrayField is not set 
    -   Repair of abnormalities in the use of `ArrayField` in conjunction with `Collapse` 
    -   Fixed the issue of warning when the `Select` custom renderCreate Item, missing key 
    -   Fixed `DatePicker` After clicking the Clear button, then clicking the Date button will not be able to select the date 
    -   Fixed `DatePicker` Click on the Clear button and cannot trigger onChange 
    -   Fixed the `DatePicker` disable state `Popover` will give the DateInput package a layer of span that causes a change in display 
    -   Fixed the timestamp of the introduction of `Date Picker` before 1970 could not pass verification 
    -   Fixed the problem that the `DatePicker` floating layer selection bar is not centered and the bottom rounded corners are blurred 
    -   Fixed an issue where the calendar icon is not displayed in the focus state after `DatePicker` passes in allowClear = {false} 
    -   Fixed errors caused by null in `Input Group` 
    -   Fixed the `InputNumber` setting max min valid only for click changes, with no limit for input 
    -   Fixed the problem that `InputNumber` was not emptied at formreset 
    -   Fixed an issue where the `Checkbox` component outer div would have been triggered before the onChange in the inner layer if the onClick event had been defined 
    -   Fixed the entry of the `Collapse` component on Change callback. Should correspond to activeKey, not the itemKey for a single panel 
    -   Fixed `Collapsible 'cannot be expanded by default in Tablewalks Row Render 
    -   Fixed an issue where `Table` empties the selected row key array after a dataSource change 
    -   Fixed the problem of no vertical centering on the `Table` expansion button 
    -   Fixed an issue where the `Table` select expand button did not prevent bubbles when clicked 
    -   Fixed `TreeSelect` Controlled Value Full Selective Child Node No Automatically Selected Parent Node 
    -   Fixed the problem that some checkboxes need to be clicked twice to take effect after resetting values using formApi.setValues 
    -   Fixed an issue where the size style of `Spin` was overwritten in nested use 
    -   Fixed a `Upload`onError callback entry error; 
    -   Fixed the issue of `Form.Select` allow Create by pressing return, event bubbling triggering formsubmit 

-   【Performance】

    -   Resolves the Cotton problem that occurs when `Form.Select` customizes OptionNode rendering and opens onChangeWithObject 
    -   `InputNumber` component interaction optimization 
    -   After solving the column fixation of `Table`, the rolling Cotton is more serious 

-   【Style】
    -   In `Pagination`, the built-in Select default setting clickToHide, click to put it away. The user-select is changed to none 
    -   Popover position in `Breadcrumb` changed from bottom to bottom Left
    -   `TreeSelect`, `Cascader` hover when no data, active no style 
    -   Copable text of `Typorgraphy` with copy icons spacing changed to 4px

#### 0.27.0 (2019-12-13)

-   【New component】
    -   New `Typography` component 
-   【feat】

    -   `Nav` supports all parent SubNav (if the selected item is a subitem of SubNav) when the default OpenKeys openKeys is not passed in 
    -   The `Nav`Nav.Sub component supports incoming dropdown Style, controlling properties such as maxHeight and overflow 
    -   `Table` supports the internationalization of paging regional texts and the introduction of format PageText custom paging regional texts 
    -   `Table` supports tree data presentation 
    -   `Form` adds Form.ErrorMessage, Form.Slot export 
    -   `Form`Field supports incoming labelPosition, labelAlign, labelWidth properties to override Form settings 
    -   `Form` adds wrapper Col, label Col fast layout configuration
    -   `Form` with Field adds the should Memo configuration to support stateful component 
    -   The `Form` Fieldlabel attribute is compatible and supports incoming object 
    -   `Form` Field adds convert to allow for secondary modification of component values before UI updates 
    -   `Form` Fieldtrigger attribute, which supports simultaneous configuration of multiple trigger times 
    -   `Select`, `AutoComplete` Add AutoAdJust Overflow Floating Layer Adaptive Switch 
    -   The `Cascader` unfolds again and returns to the last unfolding state 
    -   `Notification`supports onClick notifications 
    -   `Breadcrumb` component style and code optimization 
        -   Truncated level to level two to bottom three.
        -   Add the renderItem attribute, which can be used in conjunction with the
        -   The onClick callback parameter is changed to function (item: route, e: Event)
        -   Routeobject supports href properties as link destinations

-   【fix】

    -   Fixed a possible memory leak in `DatePicker` 
    -   Fixed an issue where `DatePicker` could crash under the Safari browser 
    -   Fixed an issue where `DropdownItem` did not block a DOM event in a limited state 
    -   Fixed an issue where the incoming key console would alarm when `Table` defined Column using JSX syntax sugar 
    -   Fixed the problem that `Table` may have two rows in hover state at the same time 
    -   Fixed an issue where `Table` may not be able to expand additional lines
    -   Fixed the ineffectiveness of certain cases of `AutoComplete` default value 
    -   Fixed the `Banner` on Close callback parameter 
    -   Fixed the `Avatar` extra-small font size problem
    -   Fixed the `Breadcrumb` a tag nesting problem, rendering as a tag when passing href, otherwise as span tag 
    -   Repair of placeholder swaps for `Cascader` and `Tree Select` 
    -   Fixed `Cascader` component rendering data not in incoming order 
    -   Fixed `Icon` component custom icon hump naming is changed to lowercase and cannot be displayed 
    -   Fixed an issue where the corresponding check information on Field was not removed after the `Form`form level custom check validateFields returned the update (i.e. when some Field checks were illegal = > legal) 
    -   Fixed `FormField.rules required configuration update, actual not effective issue 
    -   Fixed the problem of `Pagination`popover Position not controlling all subordinate pop-up layers
    -   `Pagination` Clicking on the current page should not trigger onPageChange 
    -   When `Pagination`updates total asynchronously and is not used in controlled mode, it automatically sets the current page to 1 for compatibility
    -   The clearicon should not be displayed when `Select` is displayed; the clearicon should not be displayed when the input class component such as Input is displayed
    -   The `Input` component clearable button needs to prevent bubbling when clicked 

-   【Style】

    -   `DatePicker` type = dateTime, the bottom switch part active item removes the hover effect, removes the cursor: pointer effect

-   【Docs】
    -   Update `Form`, `AutoComplete` use documents
    -   Update the `Quick Start 'document

#### 0.26.0 (2019-11-29)

-   【refactor】

    -   Refactoring `AutoComplete`, no longer encapsulating based on Select, correcting the interaction details 

-   【feat】

    -   `Select`, `AutoComplete` position supports incoming configurations other than 'top' / 'bottom' (aligned with Popover, Tooltip)
    -   `Select` Add on Select, on Deselect callback 
    -   `Dropdown` adds Dropdown.Title, adds showTick; Dropdown.Item adds active, type 
    -   `Pagination 'adds hideOnSingle Page and automatically hides the page divider when the total number of pages is less than 2 

-   【fix】

    -   Fixed `AutoComplete` showClear not effective, document sample error problem 
    -   Fixed disbaled problem on the right when `Pagination`total is 0
    -   Fixed an issue with the `Popconfirm` component titled space occupancy 
    -   Fixed an issue where row selection could not be made when updating state within the `Table` component `onChange` callback 
    -   `Slider` component code optimization to fix an issue where onChange is called twice and can be dragged in a controlled state 
    -   Fixed an issue where the node state was not retained before switching value values in the controlled state of the `Tree` component 
    -   Fixed an unexported problem with `BreadcrumbItter`
    -   Fixed the problem that onChange was not triggered when `Select` clicked the clear button 
    -   Fixed the error problem thrown by `Select` direct offspring if null exists 
    -   Fixed the problem that the first Tab is not automatically activated after the Tab Pane is empty when the Tab Pane is installed and updated asynchronously 
    -   Fixed the problem that the value set by the `InputNumber` click on the stepper can be less than the min value 
    -   Fixed the Table` paging component pageSize change problem that did not trigger Table on Change 
    -   Fixed the problem that the table row cannot expand automatically when the `Table` component defaultExpandAllRows is true 
    -   Fixed an issue where `DatePicker` would report an error using format in controlled mode 
    -   Fixed the problem that Chinese copywriting will change lines when the `Popconfirm` component position is left 
    -   Fixed an issue where the `Popconfirm` component is not aligned with content when the title is empty 

-   【Style】

    -   Adjustments to the design of `Tree` and `TreeSelect` 
        -   The node style opens blockNode by default;
        -   Spread the arrow to increase the effect of hover and active;
        -   Spacing adjustment, first line left distance to 8px, indent to 20px, text and icon spacing to 8px
    -   Modify the border radius of `Tooltip` to 6px

-   【Docs】
    -   Supplementary AutoComplete documentation

#### 0.25.5 (2019-11-21)

-   【fix】
    -   Fixed the problem of `Slider` slow sliding in cladding 
    -   Fixed an issue where the Item component onClick of `Breadcrumb` did not work 
    -   Fixed a memory leak in the `BackTop` component 

#### 0.25.2 (2019-11-19)

-   【fix】
    -   Fixed an issue where the `Input` component disappeared by pressing the cleanup button 
    -   Fixed the problem that the `Input` component placeholder is not centered 
    -   Fixed an issue where the `Spin` component wrapper ClassName was not updated with the status

#### 0.25.0 (2019-11-15)

-   【feat】

    -   The `Table` component paging function supports the passing of custom `total` 
    -   `Collapse`, `Collapsible`supports keepDOM and does not destroy DOM nodes when hidden 
    -   `Toast`, `Notification`supports global configuration with location (top, bottom, left, right), duration 
    -   `Toast`, `Notification`support destroy All 
    -   `Toast`, `Notification`new showClose support does not display the Close button 
    -   `Toast` new icon, text Max Width
    -   `Radio`, `Checkbox` support extra incoming subtext 
    -   `Switch` supports checked Text unchecked Text on off status text incoming 

-   【fix】

    -   Fixed an issue where `Dropdown` passed clickToHide = true selection option floating layer cannot automatically close when trigger is hover 
    -   Fixed the issue that the `Tabs` component Tab Pane`props.tabs` was updated and the rendering of the tabs did not follow the update 
    -   Fixed the error reporting problem caused by the path of the non-true value of the `Breadcrumb` component
    -   Fixed an issue where the `Collapse` component `defaultActive Key` is string without corresponding panel expansion 
    -   Fixed the problem that the `Slider` component is covered when used in `Form` 
    -   Fixed the `Slider` component in range mode, using controlled value, component invocation stack problem 
    -   Fixed the issue of unupdated page numbers after updating dataSource in an uncontrolled situation with the `Table` component paging function 
    -   Fixed the error problem thrown by the transmitted prefix Clsprop when the 'Checkbox Group` component direct subelement is native DOM 
    -   Fixed an issue where row selection could not be made when `Table` was passed into both row Key and row Selection 

-   【Style】

    -   Change the info icons of `Toast`, `Notification`, `Modal` to blue 
    -   `Button` component copy is not selected by default 
    -   `Toast`, `Notification`interaction optimization, hover time does not disappear 
    -   `Select` multi-selection Tag left distance adjustment 12px = > 4px 
    -   The `TimePicker` option is added: active effect 
    -   `Checkbox Group` vertical spacing adjustment 
    -   `Pagination` Page divider drop-down menu style unified with Select 

-   【perf】

    -   Radio, Checkbox code optimization to remove the lifecycle-related logic of the soon-to-be-discarded unsafe 

-   【Docs】
    -   Supplementary use of `Table` component `on Row` 
    -   Fixed an issue where real-time edit boxes disappear when they exceed a certain width 

#### 0.24.3 (2019-11-03)

-   [fix] When the `Pagination`component total is less than 10, the button on the next page is not checked 
-   [fix] `Table` className affects the tr element 
-   [fix] sorting problem of `Calendar` components all-day event

#### 0.24.0 (2019-11-01)

-   [feat] `Select` component adds remote optimization remote search experience
-   [feat] `Form` Field adds fieldClassName configuration 
-   [feat] `Dropdown` component supports the automatic closing of the Floating Layer 
-   [feat] `TimePicker` adds inputStyle configuration 

-   [style] `Dropdown` component removes min Width limitation 
-   [style] `Select` clear button hover effect alignment `Input`, multi-choice placeholder color correction 

-   [fix] `Form. Input Group` is compatible with a direct sublevel null 
-   [fix] Fixed the problem of the `DatePicker` component input box emptying button click invalid 
-   [fix] Fixed the error reporting problem of dynamically updating optionList when the `Select` value is undefined
-   [fix] Fixed the `Select` initial optionList is an empty array, the value is controlled to pass in non-empty values, and after updating optionList asynchronously, the selected item rendering does not change with it 
-   [fix] Direct error problem when the `Form` Field level container does not pass in the required field attribute 

#### 0.23.0 (2019-10-28)

-   [feat] `Select` Adjustment 
    -   Add influx, prefix support
    -   Add showArrow to control whether to display the right drop-down arrow; add showClear to control whether the right side automatically displays clear Icon
    -   Add the clickToHide parameter to control whether or not Select is automatically put away when Select is expanded
    -   Increase on Mouse Enter, on Mouse Leave pullback
    -   Remove the limitation that the value must have the corresponding option in the option List
    -   Add renderCreate Item, customize the rendering content when creating a new label
    -   Add onCreate callback, triggering when creating a new tab
    -   Increase on Exceed callback, triggered when multiple selections exceed the number limit
    -   Add onChange With Object to replace the original label In Value (the original API will still be supported but is no longer recommended)
    -   Add renderSelected Item, customize the rendering of the selected label, and replace the original option Label Prop = 'children' / 'value' (the original API will still be supported, but is no longer recommended)
-   [feat] `TimePicker` supports time range selection mode 
-   [feat] `Tree` Component on Select adds callback entry to the selected node, function(selectedKey:string, selected: bool, selectedNode: object)
-   [fix] Fixed an issue where floating layer class components (`Popover` `Tooltip` `Select` `Dropdown`, etc.) were misplaced under the edge browser 
-   [fix] Fixed an issue where the selected item did not expand after the `Tree` component update node 
-   [fix] Fixed `Tabs` button mode hover state background flicker
-   [style] `Table` removes the hover effect 
-   [Style] `Date Picker` Year Selection Mode Dial Width Adjustment 

#### 0.22.0 (2019-10-18)

-   [feat] `Table` supports `on Row` `on Header Row` `on Cell` `on Header Cell` usage, and users can customize row or cell events 
-   [feat] `Tree` Component Supports Controlled LifeKeys 
-   [feat] `Tree` on Change obtains attributes other than value 
-   [feat] `Form` component formApi.setValues supports configuring isOverride, whether it is directly overwritten when assigning values to formState.values, and can be assigned in advance to fields that do not exist in the Form 
-   [feat] `Form` supports Tree Select, Cascader, Rating 
-   [feat] `Form` adds the allowEmpty attribute, and when set to true, the fieldkey with empty value also exists in formState.values 
-   [feat] `Select` Option supports showTick, className, style configuration
-   [fix] Fixed that ArrayField did not rerender after the `Form` call formApi.setValues to reassign ArrayField 
-   [fix] Fixed the problem of Cotton when the `Table` component `JSX` is written `title`as `ReactNode` 
-   [fix] Fixed `Tabs` dynamic modification pane error reporting
-   [fix] onPressEnter method for repairing `TextArea`
-   [fix] Fixed the pop-up window closed when `Modal` clicks and presses inside Modal and then moves to the outside of Modal to loosen the click
-   [Style] `Modal` Cancel Button Replace with Lightlight Button 
-   [style] `Radio` and `Checkbox` text support triggers: hover and: active 
-   [style] `Input`, `Input`, `Date Picker`, `Time Picker` ins et Label left distance adjustment 8 = > 12 
-   [doc] `Modal` component supports custom icon in imperative 

#### 0.21.0 (2019-10-12)

-   [feat] `DatePicker` support type = "month" for annual selection 
-   [feat] `Input Number` supports continuous addition and subtraction of long press times 
-   [feat] `Button Group` supports parameters for passing in specific buttons
-   [feat] `Upload` supports drag-and-drop upload 
-   [feat] `Tree`, `TreeSelect` update on Select, on Change callback entry reference 
-   [feat] `Modal` new header attribute 
-   [fix] Fixed the problem that `Input Number` passed in for matter and parser cannot be formatted properly under controlled conditions 
-   [fix] Fixed an issue where `InputNumber` could not use the back key after setting precision 
-   [fix] When fixing the `Table` fixed header, if extra-long text is passed, the column cannot be aligned 
-   [fix] Fixed the 'Select` option under the Safari browser when the drop-down menu overflows and does not scroll properly 
-   [fix] Fixed `Select` set width = '100%', used under `Tabs`, first rendered drop-down menu width error problem
-   [fix] Fixed the `Form` ArrayField did not make a deep Clone isolation problem for initValue, and this update has clone isolation for the values in onSubmit, onSubmit Fail, formApi.setValue, formApi.getValue
-   [fix] Fixed the error reporting problem caused by the foundation of dateInput in `DatePicker` not initialized at the time of the initial render
-   [fix] Default Expand All failure after fixes `Tree` component label as node type setState 
-   [fix] Fixed the problem of changing lines when `Input` prefix is in Chinese 
-   [Style] Fixed spacing at the bottom of `Modal` 
-   [style] rename the forward _ 1 icon in `Icon` as fast _ forward
-   [style] `Radio` adds active state 
-   [style] `Switch` design adjustment to add size property. Modified the default size 
-   [doc] Add a sample document for `Collapsible`nesting 

#### 0.20.0 (2019-09-26)

-   [feat] `Navigation` dynamic efficiency optimization, navigation item selected state style optimization 
-   [feat] `Tree` supports labelInValue 
-   [feat] `Tree` support defaultExpanded Keys 
-   [feat] `Tree`, `TreeSelect` add animation to control whether it is turned on or not via motion, motion Expand 
-   [fix] `Slider` location computing and interaction optimized to fix compatibility bugs
-   [fix] Slider offset when dragging vertically `Slider` 
-   [fix] `Slider` range dislocated invalid value of slider 
-   [fix] `Slider` cannot be used for direct error reporting in the Edge browser (part of 
-   [fix] Fixed an issue where a scrollbar flashes at the bottom when `Tabs` switches 

#### 0.19.0 (2019-09-22)

-   [feat] New `Collapsible 'component 
-   [feat] `Tree` component Add icon to support custom icons; Add directory to support directory tree style 
-   [feat] `Tree` component label attribute supports ReactNode type
-   [feat] `Cascader`, `TreeSelect` component supports second click to put away 
-   [feat] `Popover` support display small triangle 
-   [feat] `Popaffirm` Supports Controlled Showcase 
-   [feat] `Progress`bar progress bar supports display percentage text; showInfo default changed from true to false 
-   [refactor] optimizes and adjusts the DOM structure, style, className of the `Input` component
-   [fix] Fixed the problem of inaccurate computational width of the `Input` component prefix 
-   [style] Fixed the problem that `Avatar` component letters are not centered 
-   [style] Fixed the problem that the `Breadcrumb` component delimiter is not centered 
-   [Style] `Collapse` DOM Structural Adjustment, Increase Animation
-   [Style] `Progress`DOM Structural Adjustment, Increase Animation
-   [perf] `Button` Load Status Use New Icon (with Spin)
-   [perf] `Table` Scalable Column Interaction Optimization, Feedback More Significant 
-   [fix] Fixed an issue that `TimePicker` may not be displayed at focus 
-   [fix] Fixed 'Tooltip` Floating Layer Failure to Display Proper Causes Flicker when Input Box Switches 

#### 0.18.6 (2019-09-18)

-   [fix] Fixed an issue where the suboption did not take effect when the `RadioGroup` setting

#### 0.18.5

-   [fix] Fixed an invalid problem when the `Form` Field setting init Value is 0

#### 0.18 .4

-   [fix] Fixed the dislocation of the Input cursor when the `Select` multi-selection does not set maxTag Count
-   [fix] Fixed the `Grid` Col = 24 style failure problem

#### 0.18.0 (2019-09-16)

-   [feat] `Select` supports keyboard operation, supports second-click put away
-   [feat] `Select` new allowCreate supports creating entries in search
-   [feat] `Select` new maxTag Count support multi-selection beyond the limit display + N
-   [feat] `Tag` New Tag Group
-   [feat] Add the `List` component
-   [feat] `DatePicker`, `TimePicker`, `Input`, `InputNumber` and other components support error status and warning status display
-   [feat] `Date Picker` support `on Confirm` / `on Cancel` callback
-   [Feat] `Input Number` Input Format and Display Format Uniform
-   [Feat] Floating layer class components such as `Tooltip` / `Popover` support edge detection and automatic positioning in horizontal / vertical directions
-   [fix] Fixed an occasional unselected problem when `TimePicker` scrolling
-   [fix] After the number of selections in `Select` multi-selection mode reaches max, select again can't cancel the problem
-   [fix] Fixed placeholder display problem when `Select` multiple and filter are true
-   [Style] Modify the className of the `Select` embedded label, increase the left and right spacing of Inset Label, and unify the inset Label style of Input and Select. Optimize and adjust the DOM structure and style of Select multiple to true

#### 0.17.0

-   [Feat] `Button` supports `loading` state
-   [feat] `Cascader` component supports controlled
-   [feat] `Navigation` component `onSelect` callback supports the return of the original configuration object
-   [feat] `Upload` Add prompt, prompt Position configuration prompt text and location
-   [fix] `Upload` Fixed the limit limit failure problem when upload Trigger is' custom '
-   [perf] Dynamic effect adjustment of floating layer components such as `Popover` / `Tooltip`
-   [Style] Updated `--Color value of color-text-2`
-   [style] `Tab` Update Interactive Style

#### 0.16 .3

-   [Perf] Optimizing the performance of validate in the `Form` component set
-   [fix] Fixed the `Pagination`component, select the later page number, and then switch the capacity per page to a larger value. The rendering error problem caused by the current page has no corresponding value in the new page number table (the current page number is changed from constant to converted)
-   [fix] Fixed the `Select` component, when the label is ReactNode and the filter is turned on, the option is rendered as\ [ObjectObject\] problem
-   [Style] `Form` Component When the label Position is left, it automatically adds up and down `padding: 6px` to the label of each field to align with the first line of text of the field
-   [feat] The `Form` component has multiple fields. When reset, validate, setValues are called, the onValueChange, onChange trigger is adjusted several times to trigger only once

#### 0.16.0

-   [Feat] Add the `TimeLine` component
-   [feat] Semi global variable update
-   [feat] `Back Top` component adds animation, adds character attribute
-   [Feat] `Modal` component adds centered properties and updates the positioning of the default style
-   [feat] `Cascader` component supports dynamic update subnodes
-   [feat] `Badge` component adds position properties and supports custom node
-   [feat] The attributes of `Toast`, `Notification`support decimals
-   [Feat] `Navigation` Component Style Optimization, Functional Optimization
-   [Perf] Optimization and Adjustment of Floating Layer Dynamic Efficiency of `Select`, `Tooltip`, `Popover`
-   [perf] `Table` component bottom optimization, scrolling dislocation problem repair

#### 0.15.7

-   [fix] `Tree`, `TreeSelect` support dynamic update subnodes

#### 0.15.5

-   [fix] `Form` set Values to trigger multiple onChange, onValues Change to trigger only once

#### 0.15 .3

-   [style] Semi adds global font font-family statement

#### 0.15.1

-   [feat] `Table` Demo that supports column scaling, JSX description columns, document addition row drag sorting

#### 0.15.0

-   [feat] `Upload` Add upload Trigger to manually trigger upload; add onXhr Finish callback; add prompt text slot: prompt
-   [Feat] Add a `Tree` component
-   [style] `Select` removes min-width: 120px introduced by v0.10.0; fixes the problem of miscalculation of the width of the drop-down layer; modifies the definition of dropdown Match Select Width: whether the width of the drop-down menu is equal to the width of select = > whether the min-width of the drop-down menu is equal to the width of select
-   [fix] 'Form` initValues, initValue are not deeply cloned isolated and may affect the source data when the field is unloaded
-   [fix] `Select` option Label Prop is value, and controlled, option rendering error problem
-   [fix] `TextArea`cannot be reset in the Form and the initial state has no resize problem
-   [fix] Fixed the problem of style coverage when multiple `Spin` exist at the same time

#### 0.14.6

-   [fix] Fixed an unchecked problem that Checkbox Group Context packaging in a production environment may cause undefined

#### 0.14.5

-   [perf] Optimize `TreeSelect` render only the nodes displayed
-   [fix] Fixed the type of direction props of `Checkbox Group`

#### 0.14.0

-   [feat] `Select`, `AutoComplete` Increase label In Value, loading properties
-   [feat] `Checkbox Group`supports specified direction switching horizontal / vertical layout

#### 0.13.0

-   [feat] `Table` supports custom rendering expansion buttons.

#### 0.12.6

-   [fix] `Spin` is a package element to block the lower-level click event

#### 0.12.5

-   [fix] Fixed the noLabel attribute failure problem when `Form`labelPosition = 'inset'

#### 0.11.23

-   [fix] `TextArea`incoming className / style moved to the outer package element

#### 0.11.22

-   [fix] Fixed the error of `Notification`, `Toast` ref for null

#### 0.11.15

-   [fix] Fixed props loss when `Form` uses withField encapsulated functional components
-   [fix] Fixed the problem of placeholder invalidity in `Select` multiple mode

#### 0.11.11

-   [fix] Fixed the `Select` option List dynamic modification without rerendering problem
-   [fix] Fixed the input display value error problem after the optionList dynamically changes when the `Select` filter is true

#### 0.11.8

-   [feat] `Select`, `Input`, `DatePicker`, `TimePicker` support inset Label, `Form` label Position support inset

#### 0.10.2

-   [fix] `RadioGroup` incoming className / style invalid
-   [fix] `Form` Radio Group init Value is invalid when set to 0
-   [fix] `Switch` un controller = > controller component error reporting problem

#### 0.10.0

-   [feat] `Select`Add dropdown Match Select Width, the default drop-down box is the same width as the selection box, and change the minimum width to 120px

#### 0.9.5

-   [feat] `Form` New Form.Slot component, new label Col, wrapper Colprop
-   [feat] `Select` Add option List prop to support passing option in array
-   [fix] `Form` Fixed on Change / on Values Change callback value for undefined problem

#### 0.8.5

-   [fix] Fixed an issue where `TextArea` would report an error using maxCount in the Form

#### 0.8.3

-   [fix] Fixed the problem that the footer null value of `Modal` and bodyStyle are invalid

#### 0.8.2

-   [fix] Fixed locale error thrown when `DatePicker`, `TimePicker` is not wrapped by `LocaleProvider`

#### 0.8.1

-   [fix] Fixed the icon style of the `Tab` selected item

#### 0.8.0

-   [feat] `Select` BottomSlot split into inner BottomSlot and outer BottomSlot

#### 0.7.0

-   [feat] `DatePicker` props add class name, prefix
-   [feat] `Input`props new hide Suffix
-   [fix] Fixed padding calculation error when `Input` prefix is a node

#### 0.6.2

-   [fix] pageSize Changer is not updated when i18n Panigation switches locale

#### 0.6.1

-   [feat] `Select` supports dropdown ClassName, dropdown Style, support bottomSlot pop-up layer bottom slot
-   [feat] i18n support. Current support language: China, Britain, Japan and South Korea, have supported components `DatePicker`, `TimePicker`, `Modal`, `Pagination`, `Select`, `Table`, `Cascader`

#### 0.5.0

-   [feat] `ScrollList` supports scroll and infinite loop scroll mode
-   [perf] Optimize the `TimePicker` component style

#### 0.4.1

-   [fix] Fixed the problem that `Collapse.Panel` className is overwritten
-   [fix] Fixed the problem that the first date of the `Calendar` month view is not highlighted on the first day of each month

#### 0.4.0

-   [feat] Semi supports dark mode

#### 0.3.0

-   [feat] `Upload` new preview File allows custom previews

#### 0.2.1

-   [feat] Add the `Calendar` calendar component
-   [feat] Add a `rating` scoring component
-   [feat] `default Activekey` and `activeKey` support incoming string arrays for `Collapse` props

#### 0.1.7

-   [fix] calendar date-fns reference error

#### 0.1.6

-   [feat] `Form`form Api adds submit Form ()
-   [fix] `Upload` fix the problem that the onRemovefile object cannot get uid
-   [fix] `Form` Input Group error Message displays error problems, optimizes writing, no need to manually add noLabel properties
-   [fix] `Progress`sets upper and lower limits of 100%, 0%

#### 0.1.3

-   [Feat] Add the `Progress`progress bar component

#### 0.0.50

-   [Style] Cancel the maximum height limit for the drop-down menu optionlist of `Tree Select` and can be set freely through the dropDown Style attribute
-   [fix] Fixed the problem of not destroying the dom node after the `Banner` is closed

#### 0.0.49

-   [fix] Input Group automatically adds key attributes to the included element

#### 0.0.45

-   [feat] `Form` supports Input Group; custom check validate supports return ReactNode; Label supports incoming ReactNode

#### 0.0.43

-   [fix] Fixed the invalid problem of `Select` className

#### 0.0.37

-   [fix] fix the problem of random order of selected item labels in `TreeSelect` multi-selection mode, and when controlled, the drop-down menu will still expand automatically after folding

#### 0.0.35

-   [feat] `Tree Select` support controlled
-   [fix] whether the display is completely controlled by visible when `Tag` passes in the visible attribute
-   [feat] When `Upload` listType = 'picture' is not uploaded, display the progress bar and do not preview the picture directly
-   When `Form` is checked with rules, throw the wrong directly when there is an error in the rules syntax

#### 0.0.34

-   [fix] Fixed `Form` syncValidate when changing back from error to success, the error prompt is not cleared
-   [fix] Fixed `DatePicker` clear click is invalid

#### 0.0.33

-   [fix] Fixed `Datepicker` placeholder failure

#### 0.0.32

-   [fix] Fixed the `TreeSelect`drop-down option is displayed according to the data incoming, and the drop-down menu sets the maximum height

#### 0.0.31

-   [feat] `Avatar` props add onClick, onMouseEnter, onMouseLeave, hoverMask

#### 0.0.30

-   [fix] Fixed `Table` pagination pageSize failure

#### 0.0.28

-   [Feat] Add dynamic / animation to each component

#### 0.0.27

-   [feat] Add the `Side Sheet` component
-   [Feat] Add a `Skeleton` component

#### 0.0.26

-   [fix] Fixed the problem that the negative number can still be entered manually in front after the `Input Number` has set the upper and lower bounds of min and max

#### 0.0.23

-   [feat] Add the `Side Sheet` component
-   [feat] `DatePicker`, `TimePicker` increase the inputReadOnly attribute

#### 0.0.20

-   [feat] `Tree Select` props adds value In Array, supports callbacks to return an array of path value values at all levels of the current node
-   [Feat] Add the `Cascader` component
-   [Feat] Add the `Layout` component
-   [Feat] New `Avatar` component
-   [feat] Add the `Back Top` component

#### 0.0.18

-   [fix] Return value in `TreeSelect` Multiple Selection Mode When the parent node is selected, only the parent node is returned and not the parent child node is returned

#### 0.0.16

-   [fix] Fixed the problem that the `Upload` picture wall mode does not display the off icon, upload failure after the same file is deleted
-   [feat] `Upload` supports the creation of jump links for all file formats, props supports photography, name

#### 0.0.15

-   [fix] Fixed the problem that the `Input Number` status is invalid

#### 0.0.14

-   [feat] Add the `Tree Select` component
-   [Feat] New `Upload` component

#### 0.0.11

-   [fix] Fixed the problem that the `Table` render index is undefined

#### 0.0.10 - alpha.12

-   [fix] Fixed `Collapse` style invalid
-   [fix] Fixed type check error when `Checkbox` value is number

#### 0.0.10 - alpha.11

-   [fix] Fixed the problem that `Tabs` active Key is not controlled

#### 0.0.10 - alpha.10

-   [fix] When the same option is selected after the `Select` Options dynamic change, the error problem has been displayed by the option

#### 0.0.10 - alpha.9

-   [feat] `Nav` Increases Controlled Keys and Open Keys props
-   [Feat] All components uniformly support className, styleprops incoming

#### 0.0.10 - alpha.8

-   [Feat] Add the `Badge` component
-   [feat] `DatePicker` props new: on Open Change, allow Clear, open, defaultOpen

#### 0.0.10 - alpha.7

-   [Feat] Add the `Describement` component
-   [feat] Add the `Collapse` component
-   [fix] Fixed the `portal` pop-up layer z-index

#### 0.0.10 - alpha.6

-   [feat] Add Form. TextArea
-   [fix] `Notification`point-event penetration problem
-   [fix] mispositioning of the `porta`l pop-up layer in the scrolling container
-   [Feat] When `Modal` pops up, automatically prohibit the scroll of the body

#### 0.0.10 - alpha.5

-   [Style] `Button` Style Optimization

#### 0.0.10 - alpha.4

-   [fix] `Select` non-filter mode placeholder invalid
-   [fix] `Nav` selects the subitem, Sub is not highlighted
-   [Feat] `Button` abandoned ghost prop
