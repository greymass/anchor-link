import * as pkg from './index'
const AnchorLink = pkg.default
for (const key of Object.keys(pkg)) {
    if (key === 'default') continue
    AnchorLink[key] = pkg[key]
}
export default AnchorLink
