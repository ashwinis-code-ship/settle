const path = require('path');

const workletsVersion = require('react-native-worklets/package.json').version;
const workletsPlugin = path.join(
  __dirname,
  'node_modules/react-native-worklets/plugin/index.js',
);

module.exports = function (api) {
  // Bust babel cache when worklets version changes (avoids stale 0.7.x plugin paths).
  api.cache.using(() => workletsVersion);
  return {
    presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
    plugins: [workletsPlugin],
  };
};
