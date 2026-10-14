/* Metro: bindet den gemeinsamen Kern aus dem Repo ein (../src: core, domain, sync/convert,
   migrate, seed) sowie die 3D-Clips (../public). Kein npm-Workspace – deshalb hier von Hand:
   - watchFolders: Dateien außerhalb von mobile/ dürfen gebündelt werden
   - Paket-Importe aus dem geteilten Code (z. B. 'react') werden aus mobile/node_modules
     aufgelöst, nie aus dem node_modules des Servers – sonst zwei React-Instanzen */
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')
const shared = [path.join(repoRoot, 'src'), path.join(repoRoot, 'public')]

const config = getDefaultConfig(projectRoot)
config.watchFolders = [...(config.watchFolders ?? []), ...shared]

const isBare = name => !name.startsWith('.') && !name.startsWith('/') && !name.startsWith('@lever/')
const fromShared = origin => shared.some(dir => origin.startsWith(dir + path.sep))
const appEntry = path.join(projectRoot, 'package.json')

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // @lever/* → Repo-src (gemeinsamer Kern), z. B. '@lever/core/logic.ts'
  if (moduleName.startsWith('@lever/')) {
    return context.resolveRequest(context, path.join(repoRoot, 'src', moduleName.slice('@lever/'.length)), platform)
  }
  if (isBare(moduleName) && fromShared(context.originModulePath)) {
    return context.resolveRequest({ ...context, originModulePath: appEntry }, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
