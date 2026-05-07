// Stub — the redaction implementation is intentionally absent to drive the
// next red→green pair.

export type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

export interface LoggerOptions {
  sink?: (line: string) => void;
}

export interface Logger {
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));

  function emit(level: LogLevel, event: string, context: LogContext = {}): void {
    sink(JSON.stringify({ level, event, time: new Date().toISOString(), ...context }));
  }

  return {
    info: (event, context) => emit('info', event, context),
    warn: (event, context) => emit('warn', event, context),
    error: (event, context) => emit('error', event, context),
  };
}
