// Karma config for headless CI/container runs.
// Resolves a Chromium binary (Puppeteer's download if present) and runs it
// with --no-sandbox, which is required inside containers without user namespaces.
const fs = require('fs');
const path = require('path');
const os = require('os');

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      const candidates = [
        path.join(base, dir, 'chrome-linux64', 'chrome'),
        path.join(base, dir, 'chrome-linux', 'chrome'),
      ];
      for (const bin of candidates) {
        if (fs.existsSync(bin)) return bin;
      }
    }
  }
  return undefined;
}

const chromeBin = findChrome();
if (chromeBin) process.env.CHROME_BIN = chromeBin;

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: { jasmine: {}, clearContext: false },
    jasmineHtmlReporter: { suppressAll: true },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
