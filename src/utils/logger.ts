/**
 * File: logger.ts
 * Author: Wildflover
 * Description: Professional logging system with color-coded terminal output
 * Language: TypeScript
 */

export enum LogLevel {
  SYSTEM = 'SYSTEM',
  INIT = 'INIT',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  CACHE = 'CACHE',
  SKIN = 'SKIN',
  CHAMPION = 'CHAMPION',
}

interface LogConfig {
  level: LogLevel;
  color: string;
  prefix: string;
}

const LOG_CONFIGS: Record<LogLevel, LogConfig> = {
  [LogLevel.SYSTEM]: { level: LogLevel.SYSTEM, color: '#ff69b4', prefix: '[SYSTEM]' },
  [LogLevel.INIT]: { level: LogLevel.INIT, color: '#ba55d3', prefix: '[INIT]' },
  [LogLevel.SUCCESS]: { level: LogLevel.SUCCESS, color: '#10b981', prefix: '[SUCCESS]' },
  [LogLevel.ERROR]: { level: LogLevel.ERROR, color: '#ef4444', prefix: '[ERROR]' },
  [LogLevel.WARNING]: { level: LogLevel.WARNING, color: '#f59e0b', prefix: '[WARNING]' },
  [LogLevel.INFO]: { level: LogLevel.INFO, color: '#3b82f6', prefix: '[INFO]' },
  [LogLevel.DEBUG]: { level: LogLevel.DEBUG, color: '#6b7280', prefix: '[DEBUG]' },
  [LogLevel.CACHE]: { level: LogLevel.CACHE, color: '#06b6d4', prefix: '[CACHE]' },
  [LogLevel.SKIN]: { level: LogLevel.SKIN, color: '#a78bfa', prefix: '[SKIN]' },
  [LogLevel.CHAMPION]: { level: LogLevel.CHAMPION, color: '#f472b6', prefix: '[CHAMPION]' },
};

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = true;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): void {
    const config = LOG_CONFIGS[level];
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    
    console.log(
      `%c${config.prefix}%c ${timestamp} %c${message}`,
      `color: ${config.color}; font-weight: bold;`,
      'color: #6b7280;',
      'color: #e5e7eb;'
    );

    if (data) {
      console.log('%cData:', 'color: #9ca3af; font-weight: 600;', data);
    }
  }

  public system(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.SYSTEM, message, data);
  }

  public init(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.INIT, message, data);
  }

  public success(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.SUCCESS, message, data);
  }

  public error(message: string, error?: unknown): void {
    this.formatMessage(LogLevel.ERROR, message, error);
  }

  public warning(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.WARNING, message, data);
  }

  public info(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.INFO, message, data);
  }

  public debug(message: string, data?: unknown): void {
    if (this.isDevelopment) {
      this.formatMessage(LogLevel.DEBUG, message, data);
    }
  }

  public skin(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.SKIN, message, data);
  }

  public champion(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.CHAMPION, message, data);
  }

  public cache(message: string, data?: unknown): void {
    this.formatMessage(LogLevel.CACHE, message, data);
  }

  public printBanner(): void {
    const banner = [
      '',
      '  WILDFLOVER v1.0.0',
      '  Author: Wildflover',
      '  Build: 2026.01.06',
      '',
      '  Stack: Tauri + React + TypeScript',
      '  Runtime: Rust + Vite 6.x',
      '',
    ].join('\n');

    console.log(
      `%c${banner}`,
      'color: #ff69b4; font-family: monospace; font-size: 11px;'
    );
  }
}

export const logger = Logger.getInstance();
