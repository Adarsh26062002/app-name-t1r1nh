/**
 * TestReporter/index.ts
 * Main entry point for the TestReporter module that orchestrates comprehensive test reporting functionality
 * including HTML report generation, result exporting in multiple formats, and coverage metric calculations.
 * 
 * Implements requirements:
 * - Comprehensive Test Reporting (system_architecture/core_testing_components)
 * - Test Results Visualization (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version lodash: 4.17.21
 */

import { generateHTMLReport } from './htmlGenerator';
import { exportResults } from './resultExporter';
import { calculateCoverage } from './coverageCalculator';
import { logInfo, logError } from '../../utils/logger';
import { ITestFlow } from '../../types/test.types';

// Global constants from specification
const REPORT_CONFIG = {
    formats: ['HTML', 'CSV', 'JSON'],
    coverage_thresholds: {
        line: 80,
        branch: 70,
        function: 75,
        statement: 80
    }
};

/**
 * Interface for report options configuration
 */
export interface IReportOptions {
    title?: string;
    includeMetrics?: boolean;
    exportFormats?: string[];
    outputDir?: string;
    prettify?: boolean;
    coverageThresholds?: {
        [key: string]: number;
    };
}

/**
 * Interface for comprehensive report result
 */
export interface IReportResult {
    htmlReportPath?: string;
    exportPaths: { [key: string]: string };
    coverageMetrics: {
        line: number;
        branch: number;
        function: number;
        statement: number;
        overall: number;
    };
    status: 'success' | 'failure';
    timestamp: Date;
    error?: string;
}

/**
 * Decorator for error handling in reporting functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in test reporting', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Initializes and orchestrates the test reporting process
 * Implements requirement: Comprehensive Test Reporting
 */
@tryCatch
export async function initializeTestReporting(
    testFlows: ITestFlow[],
    options: IReportOptions = {}
): Promise<IReportResult> {
    logInfo('Initializing test reporting process', {
        flowCount: testFlows.length,
        options
    });

    // Validate inputs
    if (!Array.isArray(testFlows) || testFlows.length === 0) {
        throw new Error('Invalid or empty test flows array provided');
    }

    if (!validateReportingConfig(options)) {
        throw new Error('Invalid reporting configuration');
    }

    try {
        const result: IReportResult = {
            exportPaths: {},
            coverageMetrics: {
                line: 0,
                branch: 0,
                function: 0,
                statement: 0,
                overall: 0
            },
            status: 'success',
            timestamp: new Date()
        };

        // Step 1: Generate HTML report
        logInfo('Generating HTML report');
        result.htmlReportPath = await generateHTMLReport(testFlows, {
            title: options.title || 'Test Execution Report',
            includeMetrics: options.includeMetrics
        });

        // Step 2: Export results in specified formats
        logInfo('Exporting results in multiple formats');
        const exportFormats = options.exportFormats || REPORT_CONFIG.formats;
        const exportResult = await exportResults(
            testFlows.map(flow => flow.id),
            exportFormats,
            {
                outputDir: options.outputDir,
                prettify: options.prettify
            }
        );

        // Map export paths to result
        exportResult.forEach(exp => {
            if (exp.status === 'success') {
                result.exportPaths[exp.format] = exp.path;
            }
        });

        // Step 3: Calculate coverage metrics
        logInfo('Calculating coverage metrics');
        const coverageResults = await calculateCoverage(testFlows);
        
        // Aggregate coverage metrics
        let totalMetrics = {
            line: 0,
            branch: 0,
            function: 0,
            statement: 0
        };

        coverageResults.forEach(coverage => {
            Object.entries(coverage.metrics).forEach(([key, value]) => {
                totalMetrics[key as keyof typeof totalMetrics] += value.percentage;
            });
        });

        // Calculate averages
        const flowCount = coverageResults.length;
        result.coverageMetrics = {
            line: totalMetrics.line / flowCount,
            branch: totalMetrics.branch / flowCount,
            function: totalMetrics.function / flowCount,
            statement: totalMetrics.statement / flowCount,
            overall: (totalMetrics.line + totalMetrics.branch + 
                     totalMetrics.function + totalMetrics.statement) / (4 * flowCount)
        };

        // Validate coverage against thresholds
        const thresholds = options.coverageThresholds || REPORT_CONFIG.coverage_thresholds;
        const coveragePassed = Object.entries(thresholds).every(([metric, threshold]) => {
            const actualCoverage = result.coverageMetrics[metric as keyof typeof result.coverageMetrics];
            return actualCoverage >= threshold;
        });

        if (!coveragePassed) {
            result.status = 'failure';
            result.error = 'Coverage thresholds not met';
        }

        logInfo('Test reporting completed successfully', {
            status: result.status,
            coverageMetrics: result.coverageMetrics
        });

        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error in test reporting';
        logError('Test reporting failed', error as Error, {
            testFlowCount: testFlows.length
        });

        return {
            exportPaths: {},
            coverageMetrics: {
                line: 0,
                branch: 0,
                function: 0,
                statement: 0,
                overall: 0
            },
            status: 'failure',
            timestamp: new Date(),
            error: errorMessage
        };
    }
}

/**
 * Validates the reporting configuration and options
 * Implements requirement: Test Results Visualization
 */
export function validateReportingConfig(options: IReportOptions): boolean {
    // Validate export formats if specified
    if (options.exportFormats) {
        const validFormats = REPORT_CONFIG.formats;
        const invalidFormats = options.exportFormats.filter(
            format => !validFormats.includes(format)
        );
        
        if (invalidFormats.length > 0) {
            logError('Invalid export formats specified', new Error('Invalid formats'), {
                invalidFormats
            });
            return false;
        }
    }

    // Validate coverage thresholds if specified
    if (options.coverageThresholds) {
        const validMetrics = Object.keys(REPORT_CONFIG.coverage_thresholds);
        const invalidMetrics = Object.keys(options.coverageThresholds).filter(
            metric => !validMetrics.includes(metric)
        );

        if (invalidMetrics.length > 0) {
            logError('Invalid coverage metrics specified', new Error('Invalid metrics'), {
                invalidMetrics
            });
            return false;
        }

        // Validate threshold values
        const invalidThresholds = Object.entries(options.coverageThresholds).filter(
            ([_, value]) => typeof value !== 'number' || value < 0 || value > 100
        );

        if (invalidThresholds.length > 0) {
            logError('Invalid threshold values specified', new Error('Invalid thresholds'), {
                invalidThresholds
            });
            return false;
        }
    }

    // Validate output directory if specified
    if (options.outputDir && typeof options.outputDir !== 'string') {
        logError('Invalid output directory specified', new Error('Invalid output dir'), {
            outputDir: options.outputDir
        });
        return false;
    }

    return true;
}

// Export test reporting functionality
export const TestReporter = {
    initializeTestReporting,
    validateReportingConfig
};