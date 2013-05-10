# cloudfiles-mirror

Utility for keeping directories in sync with Rackspace Cloud Files

## Installation

``` bash
  $ npm install cloudfiles-mirror -g
```

### [Getting Rackspace Account][3]

## Usage

### Command line usage

``` bash 
  cloudfiles-mirror --help
```

      Usage: cloudfiles-mirror [options]

      Options:

      -h, --help            output usage information
      -V, --version         output the version number
      -c, --config [value]  Configuration file
      -l --local [value]    Local directory to mirror
      -r --remote [value]   Remote container
      -b --base [value]     Remote base directory
      -u --user [value]     Rackspace username
      -k --key [value]      Rackspace API key
      --cdn                 Enable CDN support when creating the container
      -m --monitor          Enable monitor the local directory
      -s --servicenet       Enable ServiceNet (unmetered, double throughput) Only within Rackpace servers
      -w --workers <n>      Number of symultaneous parallel workers interacting with the Cloud Servers API
      --show_config         Show current configuration and exits
      --sync_all            Pushes all local files on the first run.



### Programmatically

Require the module

``` js
    var CloudfilesMirror = require("cloudfiles-mirror");
```

Create a mirror instance

``` js
    var mirror = CloudfilesMirror({
      localPath: './test/fixtures/source_files',
      remoteBase: 'fixtures/',
      container: 'test_mirror',
      auth : {
        username: 'user',
        apiKey: 'key'
      },
      cdnEnabled: true,
      monitor: false,
      pushOnBoot: false,
      // Add headers to files matching regular expressions
      headers: {
        "*\.woff": ['Access-Control-Allow-Origin: *']
      },
      servicenet: false // only when running from the same datacenter
    });
```

#### Events

Once a cloudfiles-mirror instance is created, you can listen for these events:

``` js
    // You will probably want to wait for this event
    // before interacting with the remote Cloud Files account
    mirror.on("ready", function (container_name) {
        console.log(container_name, " is ready for accepting content");
    });

    mirror.on("remote.authenticated");

    // When received remote files
    mirror.on("remote.container.files", function (remote_files) { });

    // Triggered whenever a remote file is added
    mirror.on("remote.added", function (remote, local) { });

    // Triggered whenever a remote file is removed
    mirror.on("remote.removed", remote, local);


    // Triggered when scanning the directory when options.pushOnBoot is true
    mirror.on("local.file.found", file, mime, extension, stats);

    // File watcher events
    mirror.on("local.file.created", function (file, mime, extension, stats) {});
    mirror.on("local.file.changed", function (file, mime, extension, stats) {});
    mirror.on("local.file.removed", function (file, mime, extension, stats) {});

    // End event triggered when all files have been synced. This is only
    // trigged if monitoring is not enabled.
    mirror.on("end", function () {
        console.log("Sync complete");
    });
```

#### API Methods

    mirror.pushDirectory();

Pushes all the files on .localPath to the remote cloud


    mirror.enableMonitor();

Starts monitoring the .localPath and mirroring changes on the Cloud container

#### Bonus

You can define new mime types with

``` js
    mirror.mime.define({'text/markdown': ['md', 'markdown']});
```



## Roadmap

1. Enable verbose output.
1. Compare local and remote files before pushing them.
1. Enable deleting files not found on source.
1. Pre-processor support for optimizing or compiling assets.


## Run Tests

All of the cloudservers-mirror tests are written in [vows][2], and cover all of the use cases described above. You will need to add your Rackspace API username and API key to test/fixtures/test-config.json before running tests:

``` js
  {
    "auth": {
      "username": "your-username",
      "apiKey": "your-apikey"
    }
  }
```

Once you have valid Rackspace credentials you can run tests with [vows][2]:

``` bash 
  vows test/*-test.js --spec
```

#### Author: [Bermi Ferrer](http://bermi.org)

[0]: http://docs.rackspacecloud.com/files/api/cf-devguide-latest.pdf
[1]: https://github.com/nodejitsu/node-cloudfiles
[2]: http://vowsjs.org
[3]: http://www.rackspacecloud.com/3066-0-3-13.html
