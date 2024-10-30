/**
 * htmlGenerator.ts
 * Generates comprehensive HTML reports from test results with interactive charts,
 * detailed metrics, and visual representations of test outcomes.
 * 
 * Implements requirements:
 * - HTML Report Generation (system_architecture/core_testing_components)
 * - Test Results Visualization (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version fs-extra: 10.0.0
 * @version handlebars: 4.7.7
 * @version chart.js: 3.7.0
 */

import { promises as fs } from 'fs-extra'; // v10.0.0
import * as Handlebars from 'handlebars'; // v4.7.7
import { Chart } from 'chart.js/auto'; // v3.7.0
import { Canvas } from 'canvas';
import { 
    trackExecution,
    executionEmitter 
} from '../../core/TestManager/executionTracker';
import {
    formatSuccessMessage,
    formatErrorMessage,
    formatTestFlowMessage
} from '../../utils/formatters';
import {
    logInfo,
    logError,
    logDebug
} from '../../utils/logger';
import { ITestResults, IReportOptions, ITestMetrics } from '../../types/test.types';

// Global constants from specification
const HTML_REPORT_DIRECTORY = process.env.HTML_REPORT_DIR || './reports/html';
const HTML_TEMPLATE_FILE = process.env.HTML_TEMPLATE_FILE || './templates/report.hbs';
const CHART_CONFIG = {
    responsive: true,
    maintainAspectRatio: false,
    animation: true
};

/**
 * Decorator for error handling in HTML generation functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in HTML report generation', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Generates a comprehensive HTML report from test results with interactive charts
 * Implements requirement: HTML Report Generation
 */
@tryCatch
export async function generateHTMLReport(
    testResults: ITestResults,
    options: IReportOptions
): Promise<string> {
    logInfo('Starting HTML report generation', {
        resultId: testResults.id,
        options
    });

    // Subscribe to execution updates
    executionEmitter.on('executionCompleted', (data) => {
        logDebug('Received execution update for report', data);
    });

    try {
        // Format test results using formatters
        const formattedResults = testResults.flows.map(flow => ({
            ...flow,
            status: formatTestFlowMessage(
                flow.id,
                flow.status === 'completed' ? 'completed' : 'started',
                flow.executionDetails
            )
        }));

        // Generate charts and visualizations
        const charts = await generateCharts({
            successRate: testResults.metrics.successRate,
            executionTime: testResults.metrics.executionTime,
            coverage: testResults.metrics.coverage,
            performance: testResults.metrics.performance
        });

        // Load and compile HTML template
        const templateContent = await fs.readFile(HTML_TEMPLATE_FILE, 'utf-8');
        const template = Handlebars.compile(templateContent);

        // Generate HTML content
        const htmlContent = template({
            title: options.title || 'Test Execution Report',
            timestamp: new Date().toISOString(),
            summary: {
                total: testResults.summary.total,
                passed: testResults.summary.passed,
                failed: testResults.summary.failed,
                duration: testResults.summary.duration
            },
            results: formattedResults,
            charts,
            metrics: testResults.metrics,
            options
        });

        // Save the report
        const reportPath = await saveReport(htmlContent, `report-${Date.now()}.html`);

        logInfo('HTML report generated successfully', {
            path: reportPath,
            resultId: testResults.id
        });

        return reportPath;

    } catch (error) {
        const errorMessage = formatErrorMessage(
            'Failed to generate HTML report',
            'HTML_GENERATION_ERROR',
            error
        );
        throw new Error(errorMessage.message);
    }
}

/**
 * Generates interactive charts and visualizations for test metrics
 * Implements requirement: Test Results Visualization
 */
@tryCatch
export async function generateCharts(metrics: ITestMetrics): Promise<object> {
    // Create virtual canvas for server-side chart generation
    const canvas = new Canvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Generate pie chart for test result distribution
    const resultDistribution = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Passed', 'Failed', 'Skipped'],
            datasets: [{
                data: [
                    metrics.successRate.passed,
                    metrics.successRate.failed,
                    metrics.successRate.skipped
                ],
                backgroundColor: [
                    '#4CAF50',
                    '#F44336',
                    '#FFC107'
                ]
            }]
        },
        options: {
            ...CHART_CONFIG,
            plugins: {
                title: {
                    display: true,
                    text: 'Test Result Distribution'
                }
            }
        }
    });

    // Generate timeline chart for execution duration
    const executionTimeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: metrics.executionTime.timestamps,
            datasets: [{
                label: 'Execution Duration (ms)',
                data: metrics.executionTime.durations,
                borderColor: '#2196F3'
            }]
        },
        options: {
            ...CHART_CONFIG,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Generate bar chart for performance metrics
    const performanceMetrics = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(metrics.performance),
            datasets: [{
                label: 'Response Time (ms)',
                data: Object.values(metrics.performance),
                backgroundColor: '#9C27B0'
            }]
        },
        options: {
            ...CHART_CONFIG,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    return {
        resultDistribution: resultDistribution.toBase64Image(),
        executionTimeline: executionTimeline.toBase64Image(),
        performanceMetrics: performanceMetrics.toBase64Image()
    };
}

/**
 * Saves the generated HTML report to the file system
 */
@tryCatch
async function saveReport(htmlContent: string, fileName: string): Promise<string> {
    // Ensure report directory exists
    await fs.ensureDir(HTML_REPORT_DIRECTORY);

    // Generate full file path
    const filePath = `${HTML_REPORT_DIRECTORY}/${fileName}`;

    // Write HTML content to file
    await fs.writeFile(filePath, htmlContent, {
        encoding: 'utf-8',
        mode: 0o644 // Read/write for owner, read for others
    });

    logInfo('Report file saved successfully', {
        path: filePath
    });

    return filePath;
}

// Export HTML report generation functionality
export const HTMLReportGenerator = {
    generateHTMLReport,
    generateCharts
};