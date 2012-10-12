var vows = require('vows'),
    path = require('path'),
    assert = require('assert'),
    helpers = require('./helpers'),
    fs = require('fs'),
    config = helpers.loadConfig();

vows.describe('cloudfiles mirror with headers option').addBatch({

  "With a header and a regex that matches a remotely added file": {

    topic: function () {
      var self = this;
      var newJsFile = 'matching_file_' + Math.random() * 1000 + '.js';
      var newJsFilePath = path.join(__dirname, 'fixtures', 'headers_test', newJsFile);
      var mirror;

      fs.writeFileSync(newJsFilePath, 'alert("test!");');

      mirror = helpers.createMirror({
        localPath: path.join(__dirname, 'fixtures', 'headers_test'),
        remoteBase: '',
        pushOnBoot: true,
        headers: {
          ".*\.js": [
            'Access-Control-Allow-Origin: *',
            'custom-header: value'
          ]
        }
      });

      mirror.on('remote.added', function(remote, local){
        if (local === newJsFilePath){
          mirror.client.getFile(config.container, remote, function(err, file){
            if (err) return self.callback(err);
            // XXX there is a bug in node-cloudefiles implementation of 
            // getMetadata. Until a fix is implemented you should updated,
            // package.json should be updated with:
            // "node-cloudfiles": "git://github.com/bxjx/node-cloudfiles.git#metadata"
            file.getMetadata(function(err, metadata){
              fs.unlinkSync(newJsFilePath);
              self.callback(err, metadata);
            });
          });
        }
      });
    },

    "the metadata for the remotely added file should have the header": function (err, metadata) {
      assert.isNull(err);
      assert.include(metadata['access-control-allow-origin'], '*');
      assert.include(metadata['custom-header'], 'value');
    }
  }

}).export(module);
