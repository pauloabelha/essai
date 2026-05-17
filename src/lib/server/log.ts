const colors = {
  dim: "\x1b[2m",
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

type Level = "debug" | "info" | "warn" | "error";

const levelColor: Record<Level, string> = {
  debug: colors.gray,
  info: colors.blue,
  warn: colors.yellow,
  error: colors.red,
};

const enabled =
  process.env.ESSAI_LOG === "quiet"
    ? false
    : process.env.NODE_ENV === "test"
      ? process.env.ESSAI_LOG === "test"
      : true;

function stringify(value: unknown) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function write(level: Level, scope: string, message: string, data?: unknown) {
  if (!enabled) return;
  const stamp = new Date().toISOString();
  const label = level.toUpperCase().padEnd(5);
  const suffix = data === undefined ? "" : ` ${colors.dim}${stringify(data)}`;
  console.log(
    `${colors.gray}${stamp}${colors.reset} ${levelColor[level]}${label}${colors.reset} ${colors.magenta}${scope}${colors.reset} ${message}${suffix}${colors.reset}`,
  );
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, data?: unknown) =>
      write("debug", scope, message, data),
    info: (message: string, data?: unknown) =>
      write("info", scope, message, data),
    warn: (message: string, data?: unknown) =>
      write("warn", scope, message, data),
    error: (message: string, data?: unknown) =>
      write("error", scope, message, data),
    time<T>(message: string, fn: () => Promise<T>) {
      const started = performance.now();
      write("info", scope, `${message} started`);
      return fn()
        .then((result) => {
          write("info", scope, `${message} finished`, {
            ms: Math.round(performance.now() - started),
          });
          return result;
        })
        .catch((error: unknown) => {
          write("error", scope, `${message} failed`, {
            ms: Math.round(performance.now() - started),
            error: stringify(error),
          });
          throw error;
        });
    },
  };
}
