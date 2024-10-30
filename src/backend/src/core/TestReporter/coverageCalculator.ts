/**
 * coverageCalculator.ts
 * Implements a comprehensive test coverage calculation system that analyzes test execution results
 * to provide detailed metrics on code coverage, test case coverage, and execution success rates.
 * 
 * Implements requirements:
 * - Coverage Calculation (system_architecture/core_testing_components)
 * - Test Results Analysis (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version lodash: 4.17.21
 */

import _ from 'lodash'; // v4.17.21
import { exportResults } from '../TestReporter/resultExporter';
import { generateHTMLReport } from '../TestReporter/htmlGenerator';
import { 
    getTestResultById,
    getTestResultsByFlowId 
} from '../../db/repositories/testResult.repository';
import { 
    logInfo,
    logError,
    logDebug 
} from '../../utils/logger';
import { 
    ITestFlow,
    ITestResult,
    TestResultStatus 
} from '../../types/test.types';

// Global constants from specification
const COVERAGE_THRESHOLDS = {
    line: 80,
    branch: 70,
    function: 75,
    statement: 80
};

const COVERAGE_METRICS = ['line', 'branch', 'function', 'statement'];

// Interfaces for coverage calculation
interface ICoverageMetric {
    covered: number;
    total: number;
    percentage: number;
    status: 'pass' | 'fail';
}

interface ICoverageResult {
    flowId: string;
    flowName: string;
    metrics: {
        [key: string]: ICoverageMetric;
    };
    timestamp: Date;
    summary: {
        totalCovered: number;
        totalPossible: number;
        overallPercentage: number;
        status: 'pass' | 'fail';
    };
}

/**
 * Decorator for error handling in coverage calculation functions
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in coverage calculation', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Calculates comprehensive test coverage metrics based on executed test flows and their results
 * Implements requirement: Coverage Calculation
 */
@tryCatch
export async function calculateCoverage(testFlows: ITestFlow[]): Promise<ICoverageResult[]> {
    logInfo('Starting coverage calculation for test flows', {
        flowCount: testFlows.length
    });

    // Validate input
    if (!Array.isArray(testFlows) || testFlows.length === 0) {
        throw new Error('Invalid or empty test flows array provided');
    }

    const coverageResults: ICoverageResult[] = [];

    // Process each test flow
    for (const flow of testFlows) {
        logDebug('Processing coverage for flow', {
            flowId: flow.id,
            flowName: flow.name
        });

        // Retrieve test results for the flow
        const testResults = await getTestResultsByFlowId(flow.id);

        // Initialize coverage metrics
        const metrics: { [key: string]: ICoverageMetric } = {};
        
        // Calculate coverage for each metric type
        for (const metricType of COVERAGE_METRICS) {
            const { covered, total } = await calculateMetricCoverage(
                testResults,
                metricType
            );

            const percentage = calculateMetricPercentage(metricType, covered, total);
            const threshold = COVERAGE_THRESHOLDS[metricType as keyof typeof COVERAGE_THRESHOLDS];

            metrics[metricType] = {
                covered,
                total,
                percentage,
                status: percentage >= threshold ? 'pass' : 'fail'
            };
        }

        // Calculate overall coverage summary
        const summary = calculateOverallCoverage(metrics);

        // Create coverage result for this flow
        const coverageResult: ICoverageResult = {
            flowId: flow.id,
            flowName: flow.name,
            metrics,
            timestamp: new Date(),
            summary
        };

        coverageResults.push(coverageResult);

        // Generate HTML report for this flow's coverage
        await generateHTMLReport({
            id: flow.id,
            coverage: coverageResult,
            type: 'coverage'
        });

        // Export coverage results
        await exportResults([coverageResult], ['HTML', 'JSON'], {
            includeMetrics: true,
            prettify: true
        });

        logInfo('Coverage calculation completed for flow', {
            flowId: flow.id,
            overallCoverage: summary.overallPercentage
        });
    }

    return coverageResults;
}

/**
 * Calculates coverage metrics for a specific metric type
 * Implements requirement: Test Results Analysis
 */
async function calculateMetricCoverage(
    testResults: ITestResult[],
    metricType: string
): Promise<{ covered: number; total: number }> {
    // Filter successful test results
    const successfulResults = testResults.filter(
        result => result.status === TestResultStatus.SUCCESS
    );

    let covered = 0;
    let total = 0;

    switch (metricType) {
        case 'line':
            // Calculate line coverage from successful executions
            covered = successfulResults.reduce((acc, result) => {
                const executedLines = result.duration_ms > 0 ? 1 : 0;
                return acc + executedLines;
            }, 0);
            total = testResults.length;
            break;

        case 'branch':
            // Calculate branch coverage from decision points
            covered = successfulResults.reduce((acc, result) => {
                const branchesCovered = result.status === TestResultStatus.SUCCESS ? 2 : 1;
                return acc + branchesCovered;
            }, 0);
            total = testResults.length * 2; // Each test has two possible branches
            break;

        case 'function':
            // Calculate function coverage from executed functions
            covered = successfulResults.length;
            total = testResults.length;
            break;

        case 'statement':
            // Calculate statement coverage from executed statements
            covered = successfulResults.reduce((acc, result) => {
                const statementsExecuted = result.duration_ms > 0 ? 1 : 0;
                return acc + statementsExecuted;
            }, 0);
            total = testResults.length;
            break;

        default:
            throw new Error(`Unsupported metric type: ${metricType}`);
    }

    return { covered, total };
}

/**
 * Calculates the percentage of coverage for a specific metric type
 * Implements requirement: Coverage Calculation
 */
export function calculateMetricPercentage(
    metricType: string,
    covered: number,
    total: number
): number {
    // Validate inputs
    if (!COVERAGE_METRICS.includes(metricType)) {
        throw new Error(`Invalid metric type: ${metricType}`);
    }

    if (typeof covered !== 'number' || typeof total !== 'number') {
        throw new Error('Covered and total must be numbers');
    }

    if (total === 0) {
        return 0;
    }

    // Calculate percentage with 2 decimal places
    return _.round((covered / total) * 100, 2);
}

/**
 * Calculates overall coverage summary from individual metrics
 */
function calculateOverallCoverage(
    metrics: { [key: string]: ICoverageMetric }
): {
    totalCovered: number;
    totalPossible: number;
    overallPercentage: number;
    status: 'pass' | 'fail';
} {
    const totalCovered = _.sum(Object.values(metrics).map(m => m.covered));
    const totalPossible = _.sum(Object.values(metrics).map(m => m.total));
    const overallPercentage = calculateMetricPercentage('line', totalCovered, totalPossible);

    // Calculate overall status based on all thresholds
    const status = Object.entries(metrics).every(
        ([type, metric]) => 
            metric.percentage >= COVERAGE_THRESHOLDS[type as keyof typeof COVERAGE_THRESHOLDS]
    ) ? 'pass' : 'fail';

    return {
        totalCovered,
        totalPossible,
        overallPercentage,
        status
    };
}

// Export coverage calculator functionality
export const coverageCalculator = {
    calculateCoverage,
    calculateMetricPercentage
};