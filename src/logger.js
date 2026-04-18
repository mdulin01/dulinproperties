// Logger utility. Info/warn suppressed in prod to keep the console clean, but
// errors always log — silent save failures were getting swallowed in production.
const isDev = import.meta.env.DEV;

const logger = {
  log: (...args) => isDev && console.log(...args),
  warn: (...args) => isDev && console.warn(...args),
  error: (...args) => console.error(...args),
};

export default logger;
