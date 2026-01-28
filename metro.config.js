// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for framer-motion/tslib compatibility issues on web
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
