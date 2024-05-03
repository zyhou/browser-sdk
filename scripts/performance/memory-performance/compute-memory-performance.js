const puppeteer = require('puppeteer')
const { timeout } = require('../../lib/execution-utils')
const { fetchPR, LOCAL_BRANCH } = require('../../lib/git-utils')
const NUMBER_OF_RUNS = 40 // Rule of thumb: 30 runs should be enough to get a good average
const TASK_DURATION = 1000
const ACTION_NAMES = [
  'RUM - add global context',
  'RUM - add action',
  'RUM - add error',
  'RUM - add timing',
  'RUM - start view',
  'RUM - start/stop session replay recording',
  'Logs - log message',
]

async function computeMemoryPerformance() {
  const results = []
  const pr = await fetchPR(LOCAL_BRANCH)
  const bundleUrl = pr
    ? `https://www.datad0g-browser-agent.com/pull-request/${pr.number}/datadog-rum.js`
    : 'https://www.datadoghq-browser-agent.com/datadog-rum-canary.js'
  const benchmarkUrl = pr
    ? `https://datadoghq.dev/browser-sdk-test-playground/performance/?prNumber=${pr.number}`
    : 'https://datadoghq.dev/browser-sdk-test-playground/performance/'
  for (let i = 0; i < ACTION_NAMES.length; i++) {
    const sdkTask = ACTION_NAMES[i]
    const allBytesMeasurements = []
    const allPercentageMeasurements = []
    for (let j = 0; j < NUMBER_OF_RUNS; j++) {
      const { medianPercentage, medianBytes } = await runTest(sdkTask, bundleUrl, benchmarkUrl)
      allPercentageMeasurements.push(medianPercentage)
      allBytesMeasurements.push(medianBytes)
    }
    const sdkMemoryPercentage = average(allPercentageMeasurements)
    const sdkMemoryBytes = average(allBytesMeasurements)
    console.log(
      `Average percentage of memory used by SDK for ${sdkTask} over ${NUMBER_OF_RUNS} runs: ${sdkMemoryPercentage}%  for ${sdkMemoryBytes} bytes`
    )
    results.push({ sdkTask, sdkMemoryBytes, sdkMemoryPercentage })
  }
  return results
}

async function runTest(buttonName, bundleUrl, benchmarkUrl) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.goto(benchmarkUrl)

  // Start the Chrome DevTools Protocol session and enable the heap profiler
  const client = await page.target().createCDPSession()
  await client.send('HeapProfiler.enable')

  // Select the button to trigger the sdk task
  const buttonId = buttonName.replace(/\W+/g, '-').toLowerCase()
  await page.waitForSelector(`#${buttonId}`)
  const button = await page.$(`#${buttonId}`)

  await client.send('HeapProfiler.collectGarbage')

  // Start the heap profiler sampling
  await client.send('HeapProfiler.startSampling', {
    samplingInterval: 50,
  })

  console.log(`Running test for: ${buttonName}`)
  await button.click()
  await timeout(TASK_DURATION)
  const { profile } = await client.send('HeapProfiler.stopSampling')
  const measurementsPercentage = []
  const measurementsBytes = []
  const sizeForNodeId = new Map()
  for (const sample of profile.samples) {
    sizeForNodeId.set(sample.nodeId, (sizeForNodeId.get(sample.nodeId) || 0) + sample.size)
    let totalSize = 0
    let sdkConsumption = 0
    for (const node of children(profile.head)) {
      const consumption = sizeForNodeId.get(node.id) || 0
      totalSize += consumption
      if (isSdkBundleUrl(node.callFrame.url, bundleUrl)) {
        sdkConsumption += consumption
      }
    }
    const sdkPercentage = (sdkConsumption / totalSize) * 100
    measurementsBytes.push(sdkConsumption)
    measurementsPercentage.push(sdkPercentage)
  }

  const medianPercentage = median(measurementsPercentage)
  const medianBytes = median(measurementsBytes)
  await browser.close()
  return { medianPercentage, medianBytes }
}

function* children(node) {
  yield node
  for (const child of node.children || []) {
    yield* children(child)
  }
}
function isSdkBundleUrl(url, bundleUrl) {
  return url === bundleUrl
}

function average(values) {
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
}

function median(values) {
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}

module.exports = { computeMemoryPerformance }
