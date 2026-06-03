const { withAndroidColors, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const ORANGE = '#F07C2A';

// 1×1 fully transparent PNG — satisfies the splashscreen_logo drawable reference
// that expo-splash-screen injects into Android XML even when no splash image is set.
// SplashScreen.hideAsync() in App.js dismisses the native splash immediately anyway,
// so this file is never actually visible to the user.
const TRANSPARENT_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function setColor(resources, name, value) {
  const colors = resources.resources.color || [];
  const existing = colors.find((c) => c.$.name === name);
  if (existing) {
    existing._ = value;
  } else {
    colors.push({ $: { name }, _: value });
  }
  resources.resources.color = colors;
  return resources;
}

function withOrangeColors(config) {
  return withAndroidColors(config, (mod) => {
    mod.modResults = setColor(mod.modResults, 'iconBackground', ORANGE);
    mod.modResults = setColor(mod.modResults, 'splashscreen_background', ORANGE);
    // colorPrimary / colorPrimaryDark default to a dark blue in Expo's template,
    // which causes a blue/green flash on the splash screen. Pin them to orange.
    mod.modResults = setColor(mod.modResults, 'colorPrimary', ORANGE);
    mod.modResults = setColor(mod.modResults, 'colorPrimaryDark', ORANGE);
    return mod;
  });
}

function withTargetSdk35(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const buildGradle = path.join(mod.modRequest.platformProjectRoot, 'build.gradle');
      const contents = fs.readFileSync(buildGradle, 'utf8');
      const patched = contents.replace(
        /targetSdkVersion = Integer\.parseInt\(findProperty\('android\.targetSdkVersion'\) \?: '\d+'\)/,
        "targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')"
      );
      fs.writeFileSync(buildGradle, patched);
      return mod;
    },
  ]);
}

function withBlankSplashLogo(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const drawableDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res/drawable'
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, 'splashscreen_logo.png'),
        TRANSPARENT_1X1_PNG
      );
      return mod;
    },
  ]);
}


function withOrangeColorsNight(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const nightDir = require('path').join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res/values-night'
      );
      fs.mkdirSync(nightDir, { recursive: true });
      fs.writeFileSync(
        require('path').join(nightDir, 'colors.xml'),
        `<resources>
  <color name="splashscreen_background">#F07C2A</color>
  <color name="iconBackground">#F07C2A</color>
  <color name="colorPrimary">#F07C2A</color>
  <color name="colorPrimaryDark">#F07C2A</color>
  <color name="notification_icon_color">#F07C2A</color>
</resources>`
      );
      return mod;
    },
  ]);
}

module.exports = (config) => {
  config = withOrangeColors(config);
  config = withOrangeColorsNight(config);
  config = withBlankSplashLogo(config);
  config = withTargetSdk35(config);
  return config;
};
