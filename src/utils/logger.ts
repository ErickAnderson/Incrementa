/**
 * Logging levels for the framework
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Interface for logger drivers that handle actual log output
 */
export interface LoggerDriver {
    /**
     * Write a log message at the specified level
     * @param level - The log level
     * @param message - The message to log
     * @param timestamp - ISO timestamp of the log entry
     */
    write(level: LogLevel, message: string, timestamp: string): void;
}

/**
 * Web console driver that uses globalThis.console for browser/Node.js environments
 */
export class WebConsoleDriver implements LoggerDriver {
    write(level: LogLevel, message: string, timestamp: string): void {
        if (typeof (globalThis as unknown as { console?: Console }).console?.log !== 'function') {
            return; // Silent fallback if console unavailable
        }

        const console = (globalThis as unknown as { console: Console }).console;
        const logMessage = `[${timestamp}] ${message}`;

        switch (level) {
            case LogLevel.DEBUG:
                if (console.debug) {
                    console.debug(logMessage);
                } else {
                    console.log(`[DEBUG] ${logMessage}`);
                }
                break;
            case LogLevel.INFO:
                console.log(`[INFO] ${logMessage}`);
                break;
            case LogLevel.WARN:
                if (console.warn) {
                    console.warn(`[WARN] ${logMessage}`);
                } else {
                    console.log(`[WARN] ${logMessage}`);
                }
                break;
            case LogLevel.ERROR:
                if (console.error) {
                    console.error(`[ERROR] ${logMessage}`);
                } else {
                    console.log(`[ERROR] ${logMessage}`);
                }
                break;
        }
    }
}

/**
 * File driver configuration
 */
export interface FileDriverConfig {
    filePath: string;
    fileWriter: (path: string, data: string) => void | Promise<void>;
}

/**
 * File driver that writes logs to a file using dependency injection
 */
export class FileDriver implements LoggerDriver {
    private config: FileDriverConfig;
    private logBuffer: string[] = [];
    private flushTimer: number | null = null;

    constructor(config: FileDriverConfig) {
        this.config = config;
    }

    write(level: LogLevel, message: string, timestamp: string): void {
        const levelName = LogLevel[level];
        const logEntry = `[${timestamp}] [${levelName}] ${message}\n`;
        
        this.logBuffer.push(logEntry);
        
        // Flush logs every 1 second or when buffer reaches 10 entries
        if (this.logBuffer.length >= 10 || !this.flushTimer) {
            this.scheduleFlush();
        }
    }

    private scheduleFlush(): void {
        if (this.flushTimer) {
            this.clearTimer(this.flushTimer);
        }

        this.flushTimer = this.scheduleTimer(() => {
            this.flush();
        }, 1000);
    }

    private flush(): void {
        if (this.logBuffer.length === 0) return;

        const logsToWrite = this.logBuffer.join('');
        this.logBuffer = [];
        this.flushTimer = null;

        try {
            this.config.fileWriter(this.config.filePath, logsToWrite);
        } catch {
            // Silent fallback - don't create recursive logging errors
        }
    }

    private scheduleTimer(callback: () => void, delay: number): number {
        if (typeof (globalThis as unknown as { setTimeout?: typeof setTimeout }).setTimeout === 'function') {
            return (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout(callback, delay);
        } else {
            callback();
            return 0;
        }
    }

    private clearTimer(timerId: number): void {
        if (typeof (globalThis as unknown as { clearTimeout?: typeof clearTimeout }).clearTimeout === 'function') {
            (globalThis as unknown as { clearTimeout: typeof clearTimeout }).clearTimeout(timerId);
        }
    }
}

/**
 * Node.js specific console driver with enhanced formatting
 */
export class NodeConsoleDriver implements LoggerDriver {
    write(level: LogLevel, message: string, timestamp: string): void {
        if (typeof (globalThis as unknown as { process?: { stdout?: { write?: (data: string) => boolean } } }).process?.stdout?.write !== 'function') {
            // Fallback to regular console if process.stdout unavailable
            new WebConsoleDriver().write(level, message, timestamp);
            return;
        }

        const stdout = (globalThis as unknown as { process: { stdout: { write: (data: string) => boolean; isTTY?: boolean } } }).process.stdout;
        const levelName = LogLevel[level].padEnd(5);
        const logMessage = `[${timestamp}] [${levelName}] ${message}\n`;

        // Add basic color coding if TTY supports it
        let colorCode = '';
        let resetCode = '';
        
        if ((globalThis as unknown as { process?: { stdout?: { isTTY?: boolean } } }).process?.stdout?.isTTY) {
            resetCode = '\x1b[0m';
            switch (level) {
                case LogLevel.DEBUG:
                    colorCode = '\x1b[36m'; // Cyan
                    break;
                case LogLevel.INFO:
                    colorCode = '\x1b[32m'; // Green
                    break;
                case LogLevel.WARN:
                    colorCode = '\x1b[33m'; // Yellow
                    break;
                case LogLevel.ERROR:
                    colorCode = '\x1b[31m'; // Red
                    break;
            }
        }

        stdout.write(`${colorCode}${logMessage}${resetCode}`);
    }
}

/**
 * Driver type union for configuration
 */
export type LoggerDriverType = 'web' | 'file' | 'node';

/**
 * Singleton Logger class with configurable drivers and debug mode
 */
export class Logger {
    private static instance: Logger;
    private driver: LoggerDriver;
    private debugMode: boolean = false;
    private minLevel: LogLevel = LogLevel.INFO;

    private constructor() {
        // Default to web console driver for maximum compatibility
        this.driver = new WebConsoleDriver();
    }

    /**
     * Get the singleton Logger instance
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Set the debug mode - when false, no logs are output
     * @param enabled - Whether debug mode should be enabled
     */
    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    /**
     * Get the current debug mode state
     */
    public getDebugMode(): boolean {
        return this.debugMode;
    }

    /**
     * Set the minimum log level to output
     * @param level - Minimum level to log
     */
    public setLogLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Set the logger driver type
     * @param driverType - Type of driver to use
     * @param config - Optional configuration for file driver
     */
    public setDriver(driverType: LoggerDriverType, config?: FileDriverConfig): void {
        switch (driverType) {
            case 'web':
                this.driver = new WebConsoleDriver();
                break;
            case 'file':
                if (!config) {
                    throw new Error('FileDriverConfig required for file driver');
                }
                this.driver = new FileDriver(config);
                break;
            case 'node':
                this.driver = new NodeConsoleDriver();
                break;
            default:
                throw new Error(`Unknown driver type: ${driverType}`);
        }
    }

    /**
     * Set a custom driver instance
     * @param driver - Custom driver implementation
     */
    public setCustomDriver(driver: LoggerDriver): void {
        this.driver = driver;
    }

    /**
     * Log a debug message
     * @param message - Message to log
     */
    public debug(message: string): void {
        this.log(LogLevel.DEBUG, message);
    }

    /**
     * Log an info message
     * @param message - Message to log
     */
    public info(message: string): void {
        this.log(LogLevel.INFO, message);
    }

    /**
     * Log a warning message
     * @param message - Message to log
     */
    public warn(message: string): void {
        this.log(LogLevel.WARN, message);
    }

    /**
     * Log an error message
     * @param message - Message to log
     */
    public error(message: string): void {
        this.log(LogLevel.ERROR, message);
    }

    /**
     * Internal log method that handles filtering and output
     * @private
     */
    private log(level: LogLevel, message: string): void {
        // Skip if debug mode disabled or level below minimum
        if (!this.debugMode || level < this.minLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        this.driver.write(level, message, timestamp);
    }
}

// Export a convenient singleton instance
export const logger = Logger.getInstance();