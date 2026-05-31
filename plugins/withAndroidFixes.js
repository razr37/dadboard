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
    return mod;
  });
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

module.exports = (config) => {
  config = withOrangeColors(config);
  config = withBlankSplashLogo(config);
  return config;
};
