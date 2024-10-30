/**
 * resultExporter.ts
 * Implements a robust test result exporting system supporting multiple output formats
 * with proper error handling, logging, and progress tracking.
 * 
 * Implements requirements:
 * - Result Exporting (system_architecture/core_testing_components)
 * - Test Results Visualization (system_architecture/component_responsibilities)
 * 
 * @version typescript: 4.x
 * @version fs-extra: 10.0.0
 * @version csv-writer: 1.6.0
 * @version json2csv: 5.0.7
 */

import { promises as fs } from 'fs-extra'; // v10.0.0
import { createObjectCsvWriter } from 'csv-writer'; // v1.6.0
import { Parser as Json2CsvParser } from 'json2csv'; // v5.0.7
import { generateHTMLReport } from '../TestReporter/htmlGenerator';
import { getTestResultById } from '../../db/repositories/testResult.repository';
import { 
    formatSuccessMessage, 
    formatErrorMessage 
} from '../../utils/formatters';
import { 
    logInfo, 
    logError 
} from '../../utils/logger';

// Global constants from specification
const EXPORT_BASE_DIR = process.env.EXPORT_DIR || './exports';
const SUPPORTED_FORMATS = ['HTML', 'CSV', 'JSON', 'XML'];
const MAX_BATCH_SIZE = 1000;

// Interfaces for export functionality
interface IExportOptions {
    includeMetrics?: boolean;
    prettify?: boolean;
    batchSize?: number;
    outputDir?: string;
    filename?: string;
}

interface IExportResult {
    format: string;
    path: string;
    status: 'success' | 'error';
    message?: string;
}

/**
 * Decorator for error handling in export operations
 */
function tryCatch(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        try {
            return await originalMethod.apply(this, args);
        } catch (error) {
            logError('Error in export operation', error as Error, {
                method: propertyKey,
                args
            });
            throw error;
        }
    };
    return descriptor;
}

/**
 * Exports test results into specified formats with proper error handling
 * and batch processing for large datasets
 * 
 * @param testResultIds - Array of test result IDs to export
 * @param formats - Array of desired export formats
 * @param options - Export configuration options
 * @returns Promise<IExportResult[]> - Array of export results
 */
@tryCatch
export async function exportResults(
    testResultIds: string[],
    formats: string[],
    options: IExportOptions = {}
): Promise<IExportResult[]> {
    // Validate inputs
    if (!testResultIds?.length) {
        throw new Error('No test result IDs provided');
    }

    if (!formats?.length) {
        throw new Error('No export formats specified');
    }

    // Validate formats
    const invalidFormats = formats.filter(format => 
        !validateExportFormat(format.toUpperCase())
    );
    if (invalidFormats.length) {
        throw new Error(`Unsupported formats: ${invalidFormats.join(', ')}`);
    }

    // Initialize export directory
    const outputDir = options.outputDir || EXPORT_BASE_DIR;
    await fs.ensureDir(outputDir);

    const results: IExportResult[] = [];
    const batchSize = options.batchSize || MAX_BATCH_SIZE;

    // Process test results in batches
    for (let i = 0; i < testResultIds.length; i += batchSize) {
        const batchIds = testResultIds.slice(i, i + batchSize);
        
        // Fetch test results for current batch
        const testResults = await Promise.all(
            batchIds.map(id => getTestResultById(id))
        );

        // Filter out null results
        const validResults = testResults.filter(result => result !== null);

        logInfo('Processing batch of test results', {
            batchSize: validResults.length,
            startIndex: i
        });

        // Process each format
        for (const format of formats) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const baseFilename = options.filename || `test-results-${timestamp}`;
                
                let exportResult: IExportResult;

                switch (format.toUpperCase()) {
                    case 'HTML':
                        exportResult = await exportHTML(
                            validResults,
                            outputDir,
                            baseFilename,
                            options
                        );
                        break;

                    case 'CSV':
                        exportResult = await exportCSV(
                            validResults,
                            outputDir,
                            baseFilename,
                            options
                        );
                        break;

                    case 'JSON':
                        exportResult = await exportJSON(
                            validResults,
                            outputDir,
                            baseFilename,
                            options
                        );
                        break;

                    case 'XML':
                        exportResult = await exportXML(
                            validResults,
                            outputDir,
                            baseFilename,
                            options
                        );
                        break;

                    default:
                        throw new Error(`Unsupported format: ${format}`);
                }

                results.push(exportResult);
                
                logInfo('Export completed successfully', {
                    format,
                    path: exportResult.path
                });

            } catch (error) {
                const errorResult: IExportResult = {
                    format: format.toUpperCase(),
                    path: '',
                    status: 'error',
                    message: (error as Error).message
                };
                results.push(errorResult);

                logError('Export failed', error as Error, {
                    format,
                    batchSize: validResults.length
                });
            }
        }
    }

    return results;
}

/**
 * Validates if the requested export format is supported
 * @param format - Format to validate
 * @returns boolean indicating if format is supported
 */
export function validateExportFormat(format: string): boolean {
    return SUPPORTED_FORMATS.includes(format.toUpperCase());
}

/**
 * Exports test results to HTML format using htmlGenerator
 */
async function exportHTML(
    testResults: any[],
    outputDir: string,
    baseFilename: string,
    options: IExportOptions
): Promise<IExportResult> {
    const filePath = await generateHTMLReport(
        testResults,
        {
            title: 'Test Results Report',
            includeMetrics: options.includeMetrics
        }
    );

    return {
        format: 'HTML',
        path: filePath,
        status: 'success'
    };
}

/**
 * Exports test results to CSV format using csv-writer
 */
async function exportCSV(
    testResults: any[],
    outputDir: string,
    baseFilename: string,
    options: IExportOptions
): Promise<IExportResult> {
    const filePath = `${outputDir}/${baseFilename}.csv`;
    
    const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
            { id: 'id', title: 'Test ID' },
            { id: 'flow_id', title: 'Flow ID' },
            { id: 'status', title: 'Status' },
            { id: 'duration_ms', title: 'Duration (ms)' },
            { id: 'error', title: 'Error' },
            { id: 'created_at', title: 'Created At' }
        ]
    });

    await csvWriter.writeRecords(testResults);

    return {
        format: 'CSV',
        path: filePath,
        status: 'success'
    };
}

/**
 * Exports test results to JSON format with optional prettification
 */
async function exportJSON(
    testResults: any[],
    outputDir: string,
    baseFilename: string,
    options: IExportOptions
): Promise<IExportResult> {
    const filePath = `${outputDir}/${baseFilename}.json`;
    
    const jsonContent = options.prettify 
        ? JSON.stringify(testResults, null, 2)
        : JSON.stringify(testResults);

    await fs.writeFile(filePath, jsonContent, 'utf8');

    return {
        format: 'JSON',
        path: filePath,
        status: 'success'
    };
}

/**
 * Exports test results to XML format
 */
async function exportXML(
    testResults: any[],
    outputDir: string,
    baseFilename: string,
    options: IExportOptions
): Promise<IExportResult> {
    const filePath = `${outputDir}/${baseFilename}.xml`;
    
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<testResults>\n';
    
    for (const result of testResults) {
        xmlContent += '  <testResult>\n';
        for (const [key, value] of Object.entries(result)) {
            if (value !== null && value !== undefined) {
                xmlContent += `    <${key}>${escapeXml(String(value))}</${key}>\n`;
            }
        }
        xmlContent += '  </testResult>\n';
    }
    
    xmlContent += '</testResults>';

    await fs.writeFile(filePath, xmlContent, 'utf8');

    return {
        format: 'XML',
        path: filePath,
        status: 'success'
    };
}

/**
 * Escapes special characters for XML content
 */
function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

// Export the result exporter functionality
export const resultExporter = {
    exportResults,
    validateExportFormat
};