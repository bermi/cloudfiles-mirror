var CloudfilesMirror = require("./lib/cloudfiles-mirror"),
  mirror;

mirror = CloudfilesMirror({
  // localPath: '/Users/bermi/work/lig/cms/site/assets/files/2883',
  localPath: './test/fixtures/source_files',
  remoteBase: 'images/',
  container: 'test_mirror',
  auth : {
    username: 'user',
    apiKey: 'key'
  },
  cdnEnabled: true,
  monitor: true,
  pushOnBoot: true,
  servicenet: false // only when running from the same datacenter
});

// Adding new mime types
mirror.mime.define({'text/markdown': ['md', 'markdown']});



