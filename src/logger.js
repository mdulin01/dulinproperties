// Logger utility — only outputs in development mode
const isDev = import.meta.env.DEV;

const logger = {
  log: (...args) => isDev && console.log(...args),
  warn: (...args) => isDev && console.warn(...args),
  error: (...args) => isDev && console.error(...args),
};

export default logger;
