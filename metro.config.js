// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const workletsVersion = require('react-native-worklets/package.json').version;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Invalidate Metro transform cache when worklets version changes.
config.cacheVersion = `worklets-${workletsVersion}`;

module.exports = config;
