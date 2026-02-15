import AuditLog from '../models/AuditLog.js';

/**
 * Middleware that automatically logs actions to the AuditLog model.
 * The audit log is written asynchronously after the response finishes,
 * so it never blocks the request pipeline.
 *
 * @param {string} action - The action being performed (e.g. 'CREATE', 'UPDATE', 'DELETE')
 * @param {string} resource - The resource type (e.g. 'ORGANIZATION', 'USER', 'MINISTRO')
 * @returns {Function} Express middleware function
 *
 * @example
 * router.post('/', authenticate, auditLog('CREATE', 'ORGANIZATION'), async (req, res) => {
 *   const newOrg = await Organization.create(req.body);
 *   res.locals.auditResourceId = newOrg._id;
 *   res.locals.auditResourceName = newOrg.organizationName;
 *   res.status(201).json(newOrg);
 * });
 */
export function auditLog(action, resource) {
  return (req, res, next) => {
    res.on('finish', () => {
      // Only log successful operations (status < 400)
      if (res.statusCode >= 400) {
        return;
      }

      const userId = req.userId;
      const userName = req.userName || 'Sistema';
      const userRole = req.userRole || 'SYSTEM';
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Determine resourceId from multiple sources
      const resourceId =
        res.locals.auditResourceId ||
        req.params.id ||
        req.params.orgId ||
        undefined;

      // Determine resourceName from audit context
      const resourceName = res.locals.auditResourceName || undefined;

      // Fire and forget - do not await
      AuditLog.logAction({
        userId,
        userName,
        userRole,
        action,
        resource,
        resourceId,
        resourceName,
        ipAddress,
        userAgent
      });
    });

    // Do not block the request pipeline
    next();
  };
}

/**
 * Helper to set audit context from within a route handler.
 * Call this to provide resourceId and resourceName for the audit log entry.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} resourceId - The ID of the resource being acted upon
 * @param {string} resourceName - A human-readable name for the resource
 *
 * @example
 * const org = await Organization.create(req.body);
 * setAuditContext(res, org._id, org.organizationName);
 * res.status(201).json(org);
 */
export function setAuditContext(res, resourceId, resourceName) {
  res.locals.auditResourceId = resourceId;
  res.locals.auditResourceName = resourceName;
}
