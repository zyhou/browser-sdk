'use strict'

const { spawnCommand, getSecretKey, logAndExit } = require('./utils')

async function main() {
  const BS_USERNAME = await getSecretKey('ci.browser-sdk.bs_username')
  const BS_ACCESS_KEY = await getSecretKey('ci.browser-sdk.bs_access_key')
  const firstArgument = process.argv[2]

  await spawnCommand(`yarn`, [`${firstArgument}:bs`], { BS_USERNAME, BS_ACCESS_KEY })
}

main().catch(logAndExit)
