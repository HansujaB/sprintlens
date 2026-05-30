export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function format(level: LogLevel, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info(message: string): void {
    console.log(format('info', message));
  },
  warn(message: string): void {
    console.warn(format('warn', message));
  },
  error(message: string): void {
    console.error(format('error', message));
  },
  debug(message: string): void {
    if (process.env.SPRINTLENS_DEBUG) {
      console.debug(format('debug', message));
    }
  },
};
