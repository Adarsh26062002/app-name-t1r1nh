/**
 * Authentication and Authorization Middleware
 * Implements secure authentication and role-based access control for the API
 * 
 * This implements the following requirements:
 * 1. Authentication and Authorization - security_considerations/authentication_and_authorization
 * 2. Role-Based Access Control - security_considerations/role-based_access_control
 * 
 * @version jsonwebtoken: 8.5.1
 * @version express: 4.17.1
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logError } from '../../utils/logger';
import { MESSAGES } from '../../constants/messages';
import { apiConfig } from '../../config/api.config';

// Define interfaces for type safety
interface UserPayload {
  id: string;
  role: string;
  environment?: string;
}

interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

// Global configuration for authentication
const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'defaultSecret',
  tokenExpiry: process.env.TOKEN_EXPIRY || '1h',
  ssoEnabled: process.env.SSO_ENABLED === 'true',
  apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key'
};

// Role definitions for access control
const ROLES = {
  TEST_ADMIN: 'test_admin',
  TEST_DEVELOPER: 'test_developer',
  TEST_EXECUTOR: 'test_executor',
  REPORT_VIEWER: 'report_viewer'
} as const;

/**
 * Authentication middleware that verifies JWT tokens, SSO tokens, or API keys
 * Implements requirement: Authentication and Authorization
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers[authConfig.apiKeyHeader.toLowerCase()];

    // Check for API key authentication first
    if (apiKey && typeof apiKey === 'string') {
      const isValidApiKey = await validateApiKey(apiKey);
      if (isValidApiKey) {
        req.user = {
          id: 'service-account',
          role: ROLES.TEST_EXECUTOR
        };
        return next();
      }
    }

    // Validate Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];

    // Handle SSO token validation if enabled
    if (authConfig.ssoEnabled) {
      try {
        // Validate SSO token against SSO service
        const response = await fetch(apiConfig.graphql.endpoint + '/validate-sso', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('SSO token validation failed');
        }

        const ssoData = await response.json();
        req.user = {
          id: ssoData.userId,
          role: ssoData.role,
          environment: ssoData.environment
        };
        return next();
      } catch (error) {
        logError('SSO validation failed', error as Error, {
          component: 'auth.middleware',
          token: token.substring(0, 10) + '...'
        });
        return res.status(401).json({ message: MESSAGES.UNAUTHORIZED });
      }
    }

    // Verify JWT token
    const decoded = jwt.verify(token, authConfig.jwtSecret) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    logError('Authentication failed', error as Error, {
      component: 'auth.middleware'
    });
    res.status(401).json({ message: MESSAGES.UNAUTHORIZED });
  }
};

/**
 * Authorization middleware that implements role-based access control
 * Implements requirement: Role-Based Access Control
 */
export const authorize = (allowedRoles: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Verify role authorization
      if (!allowedRoles.includes(user.role)) {
        logError('Unauthorized access attempt', new Error('Invalid role'), {
          component: 'auth.middleware',
          userId: user.id,
          role: user.role,
          requiredRoles: allowedRoles
        });
        return res.status(403).json({ message: MESSAGES.FORBIDDEN });
      }

      // Check environment-specific permissions
      if (user.environment) {
        const hasEnvironmentAccess = await validateEnvironmentAccess(
          user.role,
          user.environment
        );
        if (!hasEnvironmentAccess) {
          throw new Error('Environment access denied');
        }
      }

      next();
    } catch (error) {
      logError('Authorization failed', error as Error, {
        component: 'auth.middleware'
      });
      res.status(403).json({ message: MESSAGES.FORBIDDEN });
    }
  };
};

/**
 * Helper function to validate API keys for service authentication
 * @param apiKey - The API key to validate
 */
async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    // Check API key format
    if (!apiKey.match(/^[a-zA-Z0-9-_]{32,64}$/)) {
      return false;
    }

    // Validate against stored service credentials
    const response = await fetch(apiConfig.graphql.endpoint + '/validate-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authConfig.apiKeyHeader]: apiKey
      }
    });

    if (!response.ok) {
      throw new Error('API key validation failed');
    }

    const validationData = await response.json();
    return validationData.valid && !validationData.expired;
  } catch (error) {
    logError('API key validation failed', error as Error, {
      component: 'auth.middleware'
    });
    return false;
  }
}

/**
 * Helper function to validate environment-specific access permissions
 * @param role - User role
 * @param environment - Target environment
 */
async function validateEnvironmentAccess(
  role: string,
  environment: string
): Promise<boolean> {
  // Environment access matrix
  const environmentAccess: Record<string, string[]> = {
    [ROLES.TEST_ADMIN]: ['development', 'staging', 'production'],
    [ROLES.TEST_DEVELOPER]: ['development', 'staging'],
    [ROLES.TEST_EXECUTOR]: ['development', 'staging', 'production'],
    [ROLES.REPORT_VIEWER]: ['development', 'staging', 'production']
  };

  return environmentAccess[role]?.includes(environment) || false;
}