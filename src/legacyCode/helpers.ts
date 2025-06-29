// Logging types and helper function
export type LogLevel = 'info' | 'warn' | 'error' | 'success';

/**
 * Reusable logging helper function
 */
export function log(portal: string | null, level: LogLevel, message: string, logInstance?: any): void {
  const portalTag = portal ? `[${portal.toUpperCase()}]` : '';
  const emoji = {
    info: '📄',
    warn: '⚠️',
    error: '❌',
    success: '✅'
  };
  
  const formattedMessage = `${emoji[level]} ${portalTag} ${message}`;
  
  // Use the provided log instance if available (for Playwright crawler logs)
  if (logInstance && typeof logInstance.info === 'function') {
    switch (level) {
      case 'info':
        logInstance.info(formattedMessage);
        break;
      case 'warn':
        // Playwright logs might not have warn method, use info instead
        if (typeof logInstance.warn === 'function') {
          logInstance.warn(formattedMessage);
        } else {
          logInstance.info(formattedMessage);
        }
        break;
      case 'error':
        logInstance.error(formattedMessage);
        break;
      case 'success':
        logInstance.info(formattedMessage);
        break;
    }
  } else {
    // Fallback to console for server-side logs
    switch (level) {
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
      case 'success':
        console.log(formattedMessage);
        break;
    }
  }
}

/**
 * Specialized logging functions for each level
 */
export function logInfo(message: string, logInstance?: any, portal: string | null = null): void {
  log(portal, 'info', message, logInstance);
}

export function logWarn(message: string, logInstance?: any, portal: string | null = null): void {
  log(portal, 'warn', message, logInstance);
}

export function logError(message: string, logInstance?: any, portal: string | null = null): void {
  log(portal, 'error', message, logInstance);
}

export function logSuccess(message: string, logInstance?: any, portal: string | null = null): void {
  log(portal, 'success', message, logInstance);
} 