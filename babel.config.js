const path = require('path');

// Pin the Worklets Babel plugin to the project's single install. Without this,
// babel-preset-expo can resolve expo-modules-core's optional 0.8.x copy and
// trigger "0.7.4 vs 0.8.3" mismatches with Reanimated 4.2.
const workletsPlugin = path.join(
  __dirname,
  'node_modules/react-native-worklets/plugin/index.js',
);

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
    plugins: [workletsPlugin],
  };
};
