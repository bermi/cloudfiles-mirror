var util = require('util'),
    fs = require('fs'),
    path = require('path'),
    _ = require("underscore"),
    helpers = exports,
    CloudfilesMirror = require('../lib/cloudfiles-mirror'),
    testConfig,
    mirror;

helpers.loadConfig = function (testOptions) {
  try {
    var defaults = {
        localPath: path.join(__dirname, 'fixtures', 'source_files'),
        remoteBase: 'files/',
        container: 'test_mirror',
        auth : {
          username: 'test-username',
          apiKey: 'test-apiKey'
        },
        cdnEnabled: false,
        monitor: false,
        pushOnBoot: false
      },
      configFile = path.join(__dirname, 'fixtures', 'test-config.json'),
      stats = fs.statSync(configFile),
      config = JSON.parse(fs.readFileSync(configFile).toString());
      config = _.defaults(config, defaults);
      if (testOptions) config = _.extend(config, testOptions);

    if (config.auth.username === 'test-username'
        || config.auth.apiKey === 'test-apiKey') {
      util.puts('Config file test-config.json must be updated with valid data before running tests.');
      process.exit(0);
    }

    testConfig = config;
    return config;

  }
  catch (ex) {
    util.puts('Config file test/fixtures/test-config.json must be created with valid data before running tests.');
    throw ex;
  }
};

helpers.createMirror = function (options) {

  helpers.loadConfig(options);
  
  if (!mirror) {
    mirror = CloudfilesMirror(testConfig);
  }
  return mirror;
};
