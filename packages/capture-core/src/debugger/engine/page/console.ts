import type { ConsoleLevel, Reporter } from "./types"

interface ConsoleCaptureInput {
  reporter: Reporter
  postConsole: (level: ConsoleLevel, args: unknown[]) => void
}

export function installConsoleCapture(input: ConsoleCaptureInput): void {
  const { reporter, postConsole } = input

  const consoleLevels: ConsoleLevel[] = [
    "log",
    "info",
    "warn",
    "error",
    "debug",
  ]

  for (const level of consoleLevels) {
    installConsoleLevelCapture({
      level,
      postConsole,
      reporter,
    })
  }

  window.addEventListener(
    "error",
    (event) => {
      try {
        postConsole("error", [
          event.message || "Uncaught error",
          event.error ?? {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        ])
      } catch (error) {
        reporter.reportNonFatalError(
          "Failed to post window error event in debugger instrumentation",
          error
        )
      }
    },
    {
      capture: true,
    }
  )

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      try {
        postConsole("error", ["Unhandled promise rejection", event.reason])
      } catch (error) {
        reporter.reportNonFatalError(
          "Failed to post unhandled rejection event in debugger instrumentation",
          error
        )
      }
    },
    {
      capture: true,
    }
  )
}

function installConsoleLevelCapture(input: {
  level: ConsoleLevel
  postConsole: (level: ConsoleLevel, args: unknown[]) => void
  reporter: Reporter
}): void {
  const { level, postConsole, reporter } = input
  const descriptor = Object.getOwnPropertyDescriptor(console, level)
  let current =
    typeof console[level] === "function"
      ? console[level].bind(console)
      : undefined
  let isForwardingToConsole = false

  const wrapped = (...args: unknown[]) => {
    if (isForwardingToConsole) {
      return
    }

    try {
      postConsole(level, args)
    } catch (error) {
      reporter.reportNonFatalError(
        "Failed to post console event in debugger instrumentation",
        error
      )
    }

    if (!current) {
      return
    }

    isForwardingToConsole = true
    try {
      current(...args)
    } finally {
      isForwardingToConsole = false
    }
  }

  try {
    Object.defineProperty(console, level, {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get() {
        return wrapped
      },
      set(nextValue: unknown) {
        current =
          typeof nextValue === "function"
            ? nextValue.bind(console)
            : undefined
      },
    })
  } catch (error) {
    reporter.reportNonFatalError(
      `Failed to install resilient console.${level} capture`,
      error
    )

    try {
      console[level] = wrapped
    } catch (assignmentError) {
      reporter.reportNonFatalError(
        `Failed to assign console.${level} capture`,
        assignmentError
      )
    }
  }
}
