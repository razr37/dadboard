const { withAndroidColors } = require('@expo/config-plugins');

const ORANGE = '#F07C2A';

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

module.exports = (config) => {
  config = withOrangeColors(config);
  return config;
};
