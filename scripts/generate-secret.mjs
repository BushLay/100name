import { randomBytes } from "node:crypto"

const DEFAULT_LENGTH = 48
const MAX_LENGTH = 256

function parseLength(value) {
  if (!value) {
    return DEFAULT_LENGTH
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 16 || parsed > MAX_LENGTH) {
    throw new Error(`Length must be an integer between 16 and ${MAX_LENGTH}.`)
  }

  return parsed
}

function printUsage() {
  console.log(`Usage: npm.cmd run generate:secret -- [length]

Examples:
  npm.cmd run generate:secret
  npm.cmd run generate:secret -- 64`)
}

if (process.argv.includes("--help")) {
  printUsage()
  process.exit(0)
}

const length = parseLength(process.argv[2])
const bytesNeeded = Math.ceil((length * 3) / 4)
const secret = randomBytes(bytesNeeded)
  .toString("base64url")
  .slice(0, length)

console.log(secret)
