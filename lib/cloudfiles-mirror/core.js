
var Cloudfiles = require('cloudfiles'),
  Walker = require('walker'),
  mime = require('mime'),
  watch = require("watch"),
  _ = require("underscore"),
  chainGang = require('chain-gang'),
  EventEmitter = require('eventemitter2').EventEmitter2,
  log = console.log,
  escapeRegExp,

  CloudfilesMirror = function (options) {
    if (!(this instanceof CloudfilesMirror)) {
      return new CloudfilesMirror(options);
    }
    EventEmitter.call(this, {
      wildcard: true
    });

    this.init(options);
    return this;
  };

CloudfilesMirror.prototype = Object.create(EventEmitter.prototype);

_.extend(CloudfilesMirror.prototype, {
  client: null,
  chain: null,
  localPath: null,
  container: null,
  monitor: true,
  monitorInstance: null,
  pushOnBoot: false,
  verbose: false,
  remoteBase: '',
  mime: mime,
  defaults: {},
  remote_files: [],

  init: function (options) {
    var self = this;
    self.setOptions(options);
    self.getCloudFilesClient(options);
    self.loadChain(options);
    _.defer(function () {
      self.remoteSetup();
      self.bindEvents(options);
    });
  },

  bindEvents: function (options) {
    var self = this;
    this.on("remote.authenticated", this.createContainer);
    this.on("local.file.found", this.addLocalFileToUploadChain);
    if (options.monitor) {
      this.enableMonitor();
    }
    if (options.pushOnBoot) {
      this.once("ready", self.pushDirectory);
    }
  },

  enableMonitor: function () {
    if (this.monitorInstance === null) {
      this.on("local.file.changed", this.addLocalFileToUploadChain);
      this.on("local.file.created", this.addLocalFileToUploadChain);
      this.on("local.file.removed", this.addLocalFileToRemoveChain);
      this.runMonitor();
    }
  },

  getCloudFilesClient: function (options) {
    if (this.client === null) {
      this.client = Cloudfiles.createClient(options);
    }
    return this.client;
  },

  setOptions: function (options) {
    this.setDefaultLocalPath(options);
    this.setDefaultBucket(options);
    this.remoteBase = options.remoteBase || this.remoteBase;
    this.verbose = options.verbose || this.verbose;
    if (!this.verbose) {
      log = function () {};
    }
    this.headers = options.headers || {};
  },

  setDefaultBucket: function (options) {
    if (!options.container) {
      throw new Error ('options.container is required');
    } else {
      this.container = options.container;
    }
  },

  setDefaultLocalPath: function (options) {
    if (!options.localPath) {
      throw new Error ('options.localPath is required');
    } else {
      this.localPath = options.localPath;
    }
  },

  loadChain: function (options) {
    var self = this;
    this.chain = chainGang.create(_.defaults(options, { workers: 20 }));
    this.chain.on('starting', function(name) {
      log(name, "has started running.")
    });

    this.chain.on('finished', function(err, name) {
      log(name, "has finished.  Error:", err);
      self.fileCount = self.fileCount - 1;
      if (!self.fileCount){
        log(name, "All files completed.");
        self.emit('end');
      }
    });
  },

  remoteSetup: function () {
    var self = this;
    self.client.setAuth(function (err) {
      if (err) {
        throw err;
      }
      self.emit("remote.authenticated");
    });
  },

  createContainer: function () {
    var self = this;
    self.client.createContainer(self.container, function (err) {
      if (err) {
        throw err;
      }
      self.emit("remote.container.ready", self.container);
      self.emit("ready", self.container);
    });
  },

  loadRemoteFileList: function () {
    var self = this;

    self.client.getFiles(self.container, function (err, files) {
      if (err) {
        throw err;
      }
      self.remote_files = files;
      log("Got files", files);
      self.emit("remote.container.files", self.remote_files);
    });
  },

  pushDirectory: function () {
    var self = this;
    self.fileCount = 0;
    Walker(self.localPath)
      .on('file', function (file, stats) {
        var file_details = self.getFileDetails(file);
        self.fileCount += 1;
        self.emit("local.file.found", file, file_details.mime, file_details.extension, stats);
      });
  },

  getRemotePath: function (file_path) {
    var baseRegex = escapeRegExp(this.localPath.replace(/^[\.]*[\/]*/, '')),
      remoteBase = this.remoteBase.replace(/^[\/]*/, '').replace(/[\/]*$/, '');
    log("remoteBase %s\nbaseRegex %s\nFile %s", remoteBase, baseRegex, file_path);
    return (remoteBase !== '' ? remoteBase + "/" : '') +
      file_path.replace(new RegExp(baseRegex), '').replace(/^[\/]*/, '');
  },

  addLocalFileToUploadChain: function (file, type, extension) {
    var self = this,
      remotePath = self.getRemotePath(file);
    self.chain.add(function (job) {
      self.uploadFileJob(job, file, remotePath);
    }, "upload/" + remotePath);
  },

  addLocalFileToRemoveChain: function (file, type, extension) {
    var self = this,
      remotePath = self.getRemotePath(file);
    self.chain.add(function (job) {
      self.removeFileJob(job, file, remotePath);
    }, "remove/" + remotePath);
  },

  getHeaders: function (local) {
    var extraHeaders = {};
    _.each(this.headers, function(headers, regex){
      if (local.match(regex)){
        _.each(headers, function(header){
          var headerData = header.split(': ');
          if (headerData.length === 2){
            extraHeaders['x-object-meta-' + headerData[0]] = headerData[1];
          }
        });
      }
    });
    return extraHeaders;
  },

  uploadFileJob: function (job, local, remote) {
    var self = this;
      doUpload = (function (job, local, remote) {
        return function () {
          self.client.addFile(self.container, {
            remote: remote,
            local: local,
            headers: self.getHeaders(local)
          }, function (err) {
            if (err) {
              return self.handleError(err, job, doUpload);
            }
            self.emit("remote.added", remote, local);
            log("Pushed file from %s to %s", local, remote);
            job.finish(err, remote);
          });
        };
      }(job, local, remote));
      doUpload();
  },

  removeFileJob: function (job, local, remote) {
    var self = this;
      doRemove = (function (job, local, remote) {
        return function () {
          self.client.destroyFile(self.container, remote, function (err) {
            if (err) {
              return self.handleError(err, job, doRemove);
            }
            self.emit("remote.removed", remote, local);
            log("Removed file from %s to %s", local, remote);
            job.finish(err, remote);
          });
        };
      }(job, local, remote));
      doRemove();
  },

  runMonitor: function () {
    var self = this;
    if (self.monitorInstance === null) {
      watch.createMonitor(self.localPath, function (monitor) {
        self.monitorInstance = monitor;
        monitor.on("created", function (path, stats) {
          self.handleChange('created', path, stats);
        });
        monitor.on("changed", function (path, stats) {
          self.handleChange('changed', path, stats);
        });
        monitor.on("removed", function (path, stats) {
          self.handleChange('removed', path, stats);
        });
      });
    }
  },

  handleChange: function (event_type, file, stats) {
    var file_details;
    try {
      if ((!stats || !stats.isFile) || (_.isFunction(stats.isFile) && !stats.isFile())) {
        return;
      }
      file_details = this.getFileDetails(file);
      this.emit("local.file." + event_type, file, file_details.mime, file_details.extension, stats);
    } catch (e) {
      this.emit("error", e);
    }
  },

  getFileDetails: function (file) {
    var type = this.mime.lookup(file),
      dotified_type = type.replace(/\//, '.'),
      extension = this.mime.extension(type);
    return {mime: type, dotified_type: dotified_type, extension: extension};
  },

  handleError: function (err, job, callback) {
    var self = this;
    // User no longer authenticated, need to re-issue authentication token
    if (err.message.match(/401/) || err.message.match(/Auth/)) {
      self.remoteSetup();
      self.once("ready", callback);
      return;
    }
    return job.finish(err);
  }

});

// Utility functions

// http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
escapeRegExp = (function () {
  var specials = [
     // order matters for these
      "-",
      "[",
      "]",
     // order doesn't matter for any of these
      "/" ,
      "{" ,
      "}" ,
      "(" ,
      ")" ,
      "*" ,
      "+" ,
      "?" ,
      "." ,
      "\\",
      "^" ,
      "$" ,
      "|"
   ], 
   regex = RegExp('[' + specials.join('\\') + ']', 'g');

   return function (str) {
     return str.replace(regex, "\\$&");
   };
}());

module.exports = CloudfilesMirror;
