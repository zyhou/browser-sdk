'use strict'

const fs = require('fs')
const { executeCommand, getSecretKey, printLog, printError, logAndExit } = require('./utils')

async function main() {
  const coverageFile = fs.readFileSync('coverage/coverage-final.json').toString()
  if (!/"s":{[^}]+}/.exec(coverageFile)) {
    printError('Error: empty code coverage')
    return
  }

  const CODECOV_TOKEN = await getSecretKey('ci.browser-sdk.codecov_token')

  await executeCommand(`yarn codecov -t "${CODECOV_TOKEN}" -f coverage/coverage-final.json`)
  printLog('Code coverage done.')
}

main().catch(logAndExit)
