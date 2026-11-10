import fs from "fs-extra"
import os from "os"
import path, { dirname } from "path"
import { Readable, Stream } from "stream"
import type { ReadableStream as WebReadableStream } from "stream/web"
import unzipper from "unzipper"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const packageConfig = fs.readJSONSync(path.join(__dirname, "../package.json"))
const version = packageConfig.version

const URL = `https://latest-github-release.eryn.io/evaera/moonwave/v${version}`

interface Asset {
  name: string
  content_type: string
  browser_download_url: string
}

interface Release {
  name: string
  created_at: string
  assets: Asset[]
}

export function promisifyStream(
  stream: Stream
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    stream.on("close", resolve)
    stream.on("finish", resolve)
    stream.on("end", resolve)
    stream.on("error", reject)
  })
}

function getBinaryExtension(): string {
  if (os.platform() === "win32") {
    return ".exe"
  }

  return ""
}

function getBinaryName(): string {
  return `moonwave-extractor${getBinaryExtension()}`
}

const OS_NAMES: Record<string, string> = {
  win32: "windows",
  darwin: "macos",
  linux: "linux",
}

const LEGACY_OS_NAMES: Record<string, string> = {
  win32: "win64",
  darwin: "macos",
  linux: "linux",
}

const ARCH_NAMES: Record<string, string> = {
  x64: "x86_64",
  arm64: "aarch64",
}

const assetPattern = (suffix: string) =>
  new RegExp(`^moonwave-extractor(?:-|-.*-)${suffix}\\.zip$`)

// Release assets are named like `moonwave-extractor-v1.2.3-linux-x86_64.zip`
// so Rokit can pick the right one. Older releases used `-win64`, `-macos` and
// `-linux` with no arch (all x86_64 builds), which we still accept.
// Patterns are in order of preference.
function getBinaryZipPatterns(): RegExp[] | undefined {
  const osName = OS_NAMES[os.platform()]
  const archName = ARCH_NAMES[os.arch()]

  if (!osName || !archName) {
    return undefined
  }

  const patterns = [assetPattern(`${osName}-${archName}`)]

  // Apple Silicon and Windows on ARM can both run x86_64 builds
  if (archName === "aarch64" && osName !== "linux") {
    patterns.push(assetPattern(`${osName}-x86_64`))
  }

  if (archName === "x86_64" || osName !== "linux") {
    patterns.push(assetPattern(LEGACY_OS_NAMES[os.platform()]))
  }

  return patterns
}

async function downloadBinary(binaryPath: string) {
  const result = await fetch(URL)

  if (!result.ok) {
    console.error("Raw response from API:", await result.text())
    throw new Error(
      `${result.status} ${result.statusText} - Could not fetch Moonwave binary`
    )
  }

  const release = (await result.json()) as Release

  console.log(
    `Downloading moonwave-extractor from release ${release.name} released at ${release.created_at}`
  )

  const assets = release.assets
  const zipPatterns = getBinaryZipPatterns()

  if (!zipPatterns) {
    throw new Error(
      `Your platform is unsupported: ${os.platform()} ${os.arch()}`
    )
  }

  const targetAsset = zipPatterns
    .map((pattern) => assets.find((asset) => pattern.test(asset.name)))
    .find((asset) => asset !== undefined)

  if (!targetAsset) {
    throw new Error("Release does not contain a binary for this platform")
  }

  const download = await fetch(targetAsset.browser_download_url)

  if (!download.body) {
    throw new Error("Asset download body is null")
  }

  const writeStream = fs.createWriteStream(binaryPath)

  const unzip = Readable.fromWeb(download.body as WebReadableStream).pipe(
    unzipper.ParseOne(new RegExp(getBinaryName()), {})
  )

  const file = unzip.pipe(writeStream)

  await promisifyStream(file)

  if (file.bytesWritten === 0) {
    file.close()
    fs.removeSync(binaryPath)

    throw new Error("Write stream closed but zero bytes were written")
  } else {
    if (os.platform() !== "win32") {
      fs.chmod(binaryPath, 0o755)
    }
  }
}

export async function getBinaryPath() {
  // Use your own extractor instead of downloading one, e.g. one installed
  // with Rokit: MOONWAVE_EXTRACTOR_PATH=moonwave-extractor moonwave build
  const customPath = process.env.MOONWAVE_EXTRACTOR_PATH
  if (customPath) {
    console.log(`Moonwave: Using extractor at: ${customPath}`)
    return customPath
  }

  if (process.env.MOONWAVE_DEV) {
    console.log("Moonwave: Using development extractor: moonwave-extractor")
    return "moonwave-extractor"
  }

  const binFolder = path.join(__dirname, "bin")
  const binaryPath = path.join(
    binFolder,
    `moonwave-extractor-${version}${getBinaryExtension()}`
  )

  if (fs.existsSync(binaryPath)) {
    return binaryPath
  }

  fs.ensureDirSync(binFolder)

  await downloadBinary(binaryPath)

  return binaryPath
}
