var cloudfiles_mirror = require('./cloudfiles-mirror/core');

// Load package information using `pkginfo`.
require('pkginfo')(module, 'version');


// Export module
module.exports = cloudfiles_mirror;