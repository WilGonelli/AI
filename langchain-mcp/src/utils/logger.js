const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LEVELS[process.env.LOG_LEVEL || "info"];

function formatMessage(level, context, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
}

export function createLogger(context) {
  return {
    debug(message) {
      if (currentLevel <= LEVELS.debug) {
        console.debug(formatMessage("debug", context, message));
      }
    },
    info(message) {
      if (currentLevel <= LEVELS.info) {
        console.info(formatMessage("info", context, message));
      }
    },
    warn(message) {
      if (currentLevel <= LEVELS.warn) {
        console.warn(formatMessage("warn", context, message));
      }
    },
    error(message) {
      if (currentLevel <= LEVELS.error) {
        console.error(formatMessage("error", context, message));
      }
    },
  };
}
