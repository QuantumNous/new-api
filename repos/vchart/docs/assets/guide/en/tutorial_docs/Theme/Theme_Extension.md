# VChart Theme Extensions

- Repository Address: [https://github.com/VisActor/vchart-theme](https://github.com/VisActor/vchart-theme)

VChart provides a set of ready-to-use theme extensions as separate packages. These themes are not bundled with VChart by default; you can import and register them on demand to quickly achieve attractive, scenario-appropriate chart styles with minimal effort.

In addition, VChart offers dedicated theme packages for popular UI component libraries. These are introduced below.

## Extension Package @visactor/vchart-theme

The `vchart-theme` package includes several extended themes, provided as `ITheme` objects or static JSON assets.

### Demo

Visit [codesandbox](https://vv67jn.csb.app/) for a live preview.

### Installation

[@visactor/vchart-theme](https://www.npmjs.com/package/@visactor/vchart-theme)

```bash
# npm
npm install @visactor/vchart-theme

# yarn
yarn add @visactor/vchart-theme
```

### Usage

Register and use themes included in `vchart-theme`:

```typescript
import { allThemeMap } from '@visactor/vchart-theme';
import VChart from '@visactor/vchart';

// register themes
allThemeMap.forEach((theme, name) => {
  VChart.ThemeManager.registerTheme(name, theme);
});

// apply a theme
VChart.ThemeManager.setCurrentTheme('vScreenVolcanoBlue');
```

If you only need a specific theme, you can import its JSON file directly from the package:

```typescript
import vScreenVolcanoBlue from '@visactor/vchart-theme/public/vScreenVolcanoBlue.json';
import VChart from '@visactor/vchart';

// register the theme
VChart.ThemeManager.registerTheme('vScreenVolcanoBlue', vScreenVolcanoBlue);

// apply the theme
VChart.ThemeManager.setCurrentTheme('vScreenVolcanoBlue');
```

This package mainly includes the following theme JSON assets:

- [light](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/light.json)
- [dark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/dark.json)
- [mobileLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/mobileLight.json) light theme for mobile devices
- [mobileDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/mobileDark.json) dark theme for mobile devices
- [legacyLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/legacyLight.json) legacy light theme with simple legend style
- [legacyDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/legacyDark.json) legacy dark theme with simple legend style
- [vScreenVolcanoBlue](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenVolcanoBlue.json) Large Screen – Volcano Blue
- [vScreenClean](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenClean.json) Large Screen – Clean Crayon
- [vScreenOutskirts](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenOutskirts.json) Large Screen – Outskirts
- [vScreenBlueOrange](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenBlueOrange.json) Large Screen – Automotive Blue-Orange
- [vScreenFinanceYellow](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenFinanceYellow.json) Large Screen – Finance Yellow
- [vScreenWenLvCyan](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenWenLvCyan.json) Large Screen – Culture & Tourism Cyan
- [vScreenElectricGreen](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenElectricGreen.json) Large Screen – Electric Green
- [vScreenECommercePurple](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenECommercePurple.json) Large Screen – E-commerce Purple
- [vScreenRedBlue](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenRedBlue.json) Large Screen – Red-Blue
- [vScreenPartyRed](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/vScreenPartyRed.json) Large Screen – Party Red
- [semiDesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/semiDesignLight.json) Semi Design – light
- [semiDesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/semiDesignDark.json) Semi Design – dark
- [arcoDesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/arcoDesignLight.json) Arco Design – light
- [arcoDesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/arcoDesignDark.json) Arco Design – dark
- [ttPlatformLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/ttPlatformLight.json) TT Platform – light
- [ttPlatformDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/ttPlatformDark.json) TT Platform – dark
- [chartHubLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/chartHubLight.json) chartHub – light
- [veODesignLight](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLight.json) O Design – light
- [veODesignLightFinance](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightFinance.json) O Design – light – Financial industry palette
- [veODesignLightGovernment](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightGovernment.json) O Design – light – Government industry palette
- [veODesignLightConsumer](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightConsumer.json) O Design – light – Consumer industry palette
- [veODesignLightAutomobile](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightAutomobile.json) O Design – light – Automobile industry palette
- [veODesignLightCulturalTourism](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightCulturalTourism.json) O Design – light – Cultural tourism industry palette
- [veODesignLightMedical](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightMedical.json) O Design – light – Medical industry palette
- [veODesignLightNewEnergy](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignLightNewEnergy.json) O Design – light – New energy industry palette
- [veODesignDark](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDark.json) O Design – dark
- [veODesignDarkFinance](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkFinance.json) O Design – dark – Financial industry palette
- [veODesignDarkGovernment](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkGovernment.json) O Design – dark – Government industry palette
- [veODesignDarkConsumer](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkConsumer.json) O Design – dark – Consumer industry palette
- [veODesignDarkAutomobile](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkAutomobile.json) O Design – dark – Automobile industry palette
- [veODesignDarkCulturalTourism](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkCulturalTourism.json) O Design – dark – Cultural tourism industry palette
- [veODesignDarkMedical](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkMedical.json) O Design – dark – Medical industry palette
- [veODesignDarkNewEnergy](https://raw.githubusercontent.com/VisActor/vchart-theme/main/packages/vchart-theme/public/veODesignDarkNewEnergy.json) O Design – dark – New energy industry palette
