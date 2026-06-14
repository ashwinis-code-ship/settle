/**
 * SDK 55 can install a duplicate react-native-worklets@0.8.x under expo/.
 * Reanimated 4.2 requires 0.7.4 — remove the stray copy after every install.
 */
const fs = require('fs');
const path = require('path');

const duplicate = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  'react-native-worklets',
);

if (fs.existsSync(duplicate)) {
  fs.rmSync(duplicate, { recursive: true, force: true });
}
