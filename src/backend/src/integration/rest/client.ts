/**
 * REST client implementation for making HTTP requests to external REST APIs
 * with built-in retry logic, timeout handling, and comprehensive error management.
 * 
 * This implements the following requirements:
 * 1. REST Client Implementation - system_design/api_design.rest_client_configuration
 * 2. Integration Layer Component - system_architecture/high-level_architecture_overview
 * 
 * @version axios: 1.4.0
 * @version axios-retry: 3.5.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import axiosRetry from 'axios-retry';
import { API } from '../../constants/config';
import { logInfo, logError } from '../../utils/logger';

// Interfaces as per technical specification
export interface RESTClientConfig {
    baseUrl: string;
    headers: Record<string, string>;
    timeout: number;
    retryConfig: {
        attempts: number;
        backoff: number;
    };
    validateStatus: (status: number) => boolean;
    maxConcurrentRequests: number;
}

export interface RESTResponse<T> {
    status: number;
    data: T;
    headers: Record<string, string>;
}

export interface RequestError {
    message: string;
    status: number;
    code: string;
    response?: any;
}

// Default configuration aligned with system specifications
const defaultConfig: RESTClientConfig = {
    baseUrl: process.env.REST_API_BASE_URL || '',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: API.TIMEOUT,
    retryConfig: {
        attempts: API.RETRY_ATTEMPTS,
        backoff: API.RETRY_BACKOFF
    },
    validateStatus: API.validateStatus,
    maxConcurrentRequests: API.MAX_CONCURRENT_REQUESTS
};

// Global axios instance
let restClient: AxiosInstance;

/**
 * Initializes the REST client with the specified configuration and sets up retry interceptors
 * @param config - Partial configuration to override defaults
 */
export const initializeRESTClient = (config: Partial<RESTClientConfig> = {}): void => {
    // Merge provided config with defaults
    const mergedConfig: RESTClientConfig = {
        ...defaultConfig,
        ...config,
        headers: { ...defaultConfig.headers, ...config.headers },
        retryConfig: { ...defaultConfig.retryConfig, ...config.retryConfig }
    };

    // Create axios instance with merged configuration
    restClient = axios.create({
        baseURL: mergedConfig.baseUrl,
        headers: mergedConfig.headers,
        timeout: mergedConfig.timeout,
        validateStatus: mergedConfig.validateStatus,
        maxRedirects: 5
    });

    // Configure retry mechanism
    axiosRetry(restClient, {
        retries: mergedConfig.retryConfig.attempts,
        retryDelay: (retryCount) => {
            return retryCount * mergedConfig.retryConfig.backoff;
        },
        retryCondition: (error) => {
            // Retry on network errors and 5xx responses
            return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
                   (error.response?.status >= 500 && error.response?.status <= 599);
        }
    });

    // Request interceptor for logging
    restClient.interceptors.request.use(
        (config) => {
            logInfo('Outgoing REST request', {
                method: config.method?.toUpperCase(),
                url: config.url,
                headers: config.headers
            });
            return config;
        },
        (error) => {
            logError('REST request configuration error', error, {
                config: error.config
            });
            return Promise.reject(error);
        }
    );

    // Response interceptor for error handling
    restClient.interceptors.response.use(
        (response) => {
            logInfo('REST response received', {
                status: response.status,
                url: response.config.url,
                method: response.config.method?.toUpperCase()
            });
            return response;
        },
        (error) => {
            const errorContext = {
                url: error.config?.url,
                method: error.config?.method?.toUpperCase(),
                status: error.response?.status,
                data: error.response?.data
            };
            logError('REST request failed', error, errorContext);
            return Promise.reject(error);
        }
    );
};

/**
 * Makes an HTTP request using the REST client with comprehensive error handling and logging
 * @param method - HTTP method
 * @param url - Request URL
 * @param data - Request payload
 * @param config - Request-specific configuration
 * @returns Promise resolving to typed response
 */
export const makeRequest = async <T>(
    method: string,
    url: string,
    data?: any,
    config: Partial<RESTClientConfig> = {}
): Promise<RESTResponse<T>> => {
    try {
        // Validate input parameters
        if (!method || !url) {
            throw new Error('Method and URL are required');
        }

        // Prepare request configuration
        const requestConfig: AxiosRequestConfig = {
            method: method as Method,
            url,
            ...config,
            headers: { ...defaultConfig.headers, ...config.headers }
        };

        // Add data for appropriate methods
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && data) {
            requestConfig.data = data;
        } else if (data) {
            requestConfig.params = data;
        }

        // Make the request
        const response: AxiosResponse<T> = await restClient.request(requestConfig);

        // Transform response to RESTResponse format
        return {
            status: response.status,
            data: response.data,
            headers: response.headers as Record<string, string>
        };
    } catch (error: any) {
        // Transform error to RequestError format
        const requestError: RequestError = {
            message: error.message || 'Request failed',
            status: error.response?.status || 500,
            code: error.code || 'REQUEST_ERROR',
            response: error.response?.data
        };

        throw requestError;
    }
};

// Initialize REST client with default configuration
initializeRESTClient();