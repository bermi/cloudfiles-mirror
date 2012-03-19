// Tests mirroring a local directory to a rackspace cloud files container

var path = require('path'),
    vows = require('vows'),
    fs = require('fs'),
    assert = require('assert'),
    helpers = require('./helpers'),
    config = helpers.loadConfig(),
    mirror = helpers.createMirror();

vows.describe(
  'cloudfiles-mirror/fresh-sync'
).addBatch({
  "This test requires Rackspace authorization and a remote container": {
    topic: function () {
      var self = this;
      mirror.on("ready", function () {
        return self.callback();
      });
    },
    "the client is now authorized": function () {
      assert.isTrue(mirror.client.authorized);
    }
  }
}).export(module);
