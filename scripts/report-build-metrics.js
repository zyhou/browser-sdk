const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const { request } = require('https')
const querystring = require('querystring')
const { createGzip } = require('zlib')
const stream = require('stream')
const childProcess = require('child_process')

const pipeline = promisify(stream.pipeline)
const stat = promisify(fs.stat)
const readFile = promisify(fs.readFile)
const exec = promisify(childProcess.exec)

const BROWSER_SDK_ROOT = path.join(__dirname, '..')
const API_KEY = process.env.DD_API_KEY
const METRIC_PREFIX = 'dd.browser_sdk_test'

main().catch((error) => {
  console.log(error)
  process.exitCode = 1
})

async function main() {
  if (!API_KEY) {
    console.log('No DD_API_KEY defined')
    process.exitCode = 1
    return
  }

  const timestampResult = await exec(' git show -s HEAD --pretty="%ct"')
  const context = {
    timestamp: parseInt(timestampResult.stdout),

    buildTags: [
      formatTag('commit_ref_name', process.env.CI_COMMIT_REF_NAME),
      formatTag('commit_tag', process.env.CI_COMMIT_TAG),
      formatTag('commit_sha', process.env.CI_COMMIT_SHA),
      formatTag('pipeline_id', process.env.CI_PIPELINE_ID),
    ],
  }

  const series = (await Promise.all([computeCoverageMetrics(context), computeSizeMetrics(context)])).flat(1000)

  await sendMetrics(series)

  console.log('Metrics sent successfully')
}

function formatTag(name, value) {
  return `${name}:${value}`
}

async function computeCoverageMetrics(context) {
  const coverage = JSON.parse(
    await readFile(path.resolve(BROWSER_SDK_ROOT, 'coverage/coverage-final.json'), { encoding: 'utf-8' })
  )

  return ['core', 'logs', 'rum'].map((packageName) => {
    let total = 0
    let covered = 0

    for (const [filePath, fileCoverage] of Object.entries(coverage)) {
      if (filePath.includes(`packages/${packageName}/src/`)) {
        Object.values(fileCoverage.s).forEach(report)
        Object.values(fileCoverage.f).forEach(report)
        Object.values(fileCoverage.b).forEach((branches) => branches.forEach(report))
      }
    }

    function report(coverTimes) {
      if (coverTimes > 0) {
        covered += 1
      }
      total += 1
    }

    const percent = covered / total

    return formatMetric(context, 'coverage', packageName, percent)
  })
}

function computeSizeMetrics(context) {
  return Promise.all(
    ['logs', 'rum'].map(async (packageName) => {
      const bundlePath = path.resolve(BROWSER_SDK_ROOT, `packages/${packageName}/bundle/datadog-${packageName}.js`)
      return [
        formatMetric(context, 'size', packageName, await getSizeOf(bundlePath)),
        formatMetric(context, 'size_gzip', packageName, await getGzipSizeOf(bundlePath)),
      ]
    })
  )

  async function getSizeOf(filePath) {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      throw new Error(`${filePath} is not a file`)
    }

    return fileStat.size
  }

  async function getGzipSizeOf(filePath) {
    let sum = 0

    await pipeline(
      fs.createReadStream(filePath),
      createGzip(),
      new stream.Writable({
        write(chunk, _encoding, callback) {
          sum += chunk.length
          callback()
        },
      })
    )

    return sum
  }
}

function formatMetric(context, metricName, packageName, value) {
  console.log(`Metric: ${metricName} ${packageName}: ${value}`)
  return {
    metric: `${METRIC_PREFIX}.${metricName}`,
    points: [[context.timestamp, value]],
    type: 'gauge',
    tags: [...context.buildTags, formatTag('package', packageName)],
  }
}

function sendMetrics(series) {
  return new Promise((resolve, reject) => {
    const url = `https://app.datadoghq.com/api/v1/series?${querystring.stringify({ api_key: API_KEY })}`

    const req = request(url, { method: 'post' })
    req.on('error', reject)
    req.on('response', (response) => {
      if (response.statusCode >= 300) {
        reject(new Error(`API returned an invalid status code: ${response.statusCode}`))
      } else {
        resolve()
      }
    })
    req.write(JSON.stringify({ series }))
    req.end()
  })
}
