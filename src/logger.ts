// 1. Imports and Dependencies
import { FastifyLoggerInstance } from 'fastify';

// 2. Configuration and Setup
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export enum LogCategory {
  REQUEST = 'REQUEST',
  PORTAL = 'PORTAL',
  SCRAPING = 'SCRAPING',
  DATA = 'DATA',
  SYSTEM = 'SYSTEM',
  ERROR = 'ERROR'
}

interface LogContext {
  requestId?: string;
  portal?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

// 3. Entry Point / Main Execution
// (This module only exports functions, no main execution)

// 4. API Surface / Public Interface

export class Logger {
  private fastifyLogger?: FastifyLoggerInstance;
  private logLevel: LogLevel = LogLevel.INFO;
  private requestId?: string;

  constructor(fastifyLogger?: FastifyLoggerInstance, logLevel: LogLevel = LogLevel.INFO) {
    this.fastifyLogger = fastifyLogger;
    this.logLevel = logLevel;
  }

  setRequestId(requestId: string) {
    this.requestId = requestId;
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  // High-level operation logging
  startRequest(operation: string, params: Record<string, any>) {
    this.info(LogCategory.REQUEST, `🚀 ${operation} started`, {
      operation,
      ...params
    });
  }

  endRequest(operation: string, result: any, duration: number) {
    this.info(LogCategory.REQUEST, `✅ ${operation} completed in ${duration}ms`, {
      operation,
      duration,
      success: result.success,
      bundles: result.data?.flightData?.bundles?.length || 0,
      flights: result.data?.flightData?.flights?.length || 0,
      bookingOptions: result.data?.flightData?.bookingOptions?.length || 0
    });
  }

  // Portal-specific logging
  startPortal(portal: string, url: string) {
    this.info(LogCategory.PORTAL, `🌐 ${portal.toUpperCase()} portal started`, {
      portal,
      url: this.truncateUrl(url)
    });
  }

  portalSuccess(portal: string, stats: { bundles: number; flights: number; bookingOptions: number }) {
    this.info(LogCategory.PORTAL, `✅ ${portal.toUpperCase()} portal completed`, {
      portal,
      ...stats
    });
  }

  portalError(portal: string, error: any) {
    this.error(LogCategory.PORTAL, `❌ ${portal.toUpperCase()} portal failed`, {
      portal,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Scraping progress logging
  scrapingProgress(portal: string, pollCount: number, stats: { bundles: number; flights: number; bookingOptions: number }) {
    this.debug(LogCategory.SCRAPING, `📊 ${portal.toUpperCase()} poll ${pollCount}`, {
      portal,
      pollCount,
      ...stats
    });
  }

  scrapingComplete(portal: string, totalPolls: number, failedPolls: number, duration: number) {
    this.info(LogCategory.SCRAPING, `🏁 ${portal.toUpperCase()} scraping completed`, {
      portal,
      totalPolls,
      failedPolls,
      duration
    });
  }

  // Data processing logging
  dataExtraction(portal: string, itemsFound: number, itemsProcessed: number) {
    this.info(LogCategory.DATA, `📄 ${portal.toUpperCase()} data extracted`, {
      portal,
      itemsFound,
      itemsProcessed
    });
  }

  dataMerge(operation: string, before: any, after: any) {
    const added = {
      bundles: after.bundles.length - before.bundles.length,
      flights: after.flights.length - before.flights.length,
      bookingOptions: after.bookingOptions.length - before.bookingOptions.length
    };

    if (added.bundles > 0 || added.flights > 0 || added.bookingOptions > 0) {
      this.debug(LogCategory.DATA, `🔄 ${operation} merged`, added);
    }
  }

  // Error logging with context
  error(category: LogCategory, message: string, context?: LogContext) {
    if (this.logLevel >= LogLevel.ERROR) {
      this.log('error', category, message, context);
    }
  }

  warn(category: LogCategory, message: string, context?: LogContext) {
    if (this.logLevel >= LogLevel.WARN) {
      this.log('warn', category, message, context);
    }
  }

  info(category: LogCategory, message: string, context?: LogContext) {
    if (this.logLevel >= LogLevel.INFO) {
      this.log('info', category, message, context);
    }
  }

  debug(category: LogCategory, message: string, context?: LogContext) {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.log('debug', category, message, context);
    }
  }

  // 5. Implementation Details / Helper Functions

  private log(level: 'error' | 'warn' | 'info' | 'debug', category: LogCategory, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category,
      message,
      requestId: this.requestId,
      ...context
    };

    const formattedMessage = this.formatMessage(logEntry);
    
    if (this.fastifyLogger) {
      this.fastifyLogger[level](formattedMessage);
    } else {
      console[level](formattedMessage);
    }
  }

  private formatMessage(logEntry: any): string {
    const { timestamp, level, category, message, requestId, ...context } = logEntry;
    
    let formatted = `[${timestamp}] ${level} [${category}] ${message}`;
    
    if (requestId) {
      formatted += ` [req:${requestId}]`;
    }
    
    if (Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${this.formatValue(value)}`)
        .join(' ');
      formatted += ` | ${contextStr}`;
    }
    
    return formatted;
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).substring(0, 100);
    }
    return String(value);
  }

  private truncateUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url.length > 50 ? `${url.substring(0, 50)}...` : url;
    }
  }
}

// Global logger instance
export const logger = new Logger();

// Convenience functions for backward compatibility
export function logError(category: LogCategory, message: string, context?: LogContext) {
  logger.error(category, message, context);
}

export function logWarn(category: LogCategory, message: string, context?: LogContext) {
  logger.warn(category, message, context);
}

export function logInfo(category: LogCategory, message: string, context?: LogContext) {
  logger.info(category, message, context);
}

export function logDebug(category: LogCategory, message: string, context?: LogContext) {
  logger.debug(category, message, context);
} 