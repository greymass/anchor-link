let pkg = require('./index')
module.exports = pkg.default
for (const key of Object.keys(pkg)) {
    if (key === 'default') continue
    module.exports[key] = pkg[key]
}
