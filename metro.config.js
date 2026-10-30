const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optional dynamic imports that Metro still tries to resolve
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@opentelemetry/api': require.resolve('@opentelemetry/api'),
};

module.exports = config;
