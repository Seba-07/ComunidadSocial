/**
 * Puppeteer Configuration for Railway Deployment
 * @see https://pptr.dev/guides/configuration
 */
const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip Chromium download in CI/production (use system Chrome if available)
  skipDownload: process.env.PUPPETEER_SKIP_DOWNLOAD === 'true',

  // Cache directory for Chromium
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),

  // Use environment variable for executable path if set
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
};
