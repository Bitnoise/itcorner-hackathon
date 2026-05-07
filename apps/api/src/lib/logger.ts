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

const REDACTED_FIELDS = new Set(['password', 'password_hash', 'token', 'authorization', 'jwt']);
const REDACTED_VALUE = '[REDACTED]';

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = REDACTED_FIELDS.has(key) ? REDACTED_VALUE : redact(child);
    }
    return out;
  }
  return value;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));

  function emit(level: LogLevel, event: string, context: LogContext = {}): void {
    const safeContext = redact(context) as LogContext;
    sink(JSON.stringify({ level, event, time: new Date().toISOString(), ...safeContext }));
  }

  return {
    info: (event, context) => emit('info', event, context),
    warn: (event, context) => emit('warn', event, context),
    error: (event, context) => emit('error', event, context),
  };
}
