function getFlagValue(argument) {
  const [, rawValue = ""] = argument.split("=", 2)
  return rawValue.trim()
}

export function parseOpsAlertDrillArgs(argv) {
  const options = {
    severity: "warn",
    message: "Operator-triggered alert drill.",
    reason: null,
    requestedBy: "ops-alert-drill",
  }

  for (const argument of argv) {
    if (argument === "--help") {
      continue
    }

    if (argument.startsWith("--severity=")) {
      const value = getFlagValue(argument).toLowerCase()

      if (value !== "warn" && value !== "error") {
        throw new Error("severity must be one of: warn, error.")
      }

      options.severity = value
      continue
    }

    if (argument.startsWith("--message=")) {
      const value = getFlagValue(argument)
      options.message = value || options.message
      continue
    }

    if (argument.startsWith("--reason=")) {
      const value = getFlagValue(argument)
      options.reason = value || null
      continue
    }

    if (argument.startsWith("--requested-by=")) {
      const value = getFlagValue(argument)
      options.requestedBy = value || options.requestedBy
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}
