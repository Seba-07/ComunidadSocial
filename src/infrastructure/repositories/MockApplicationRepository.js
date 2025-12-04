import { IApplicationRepository } from '../../domain/repositories/IApplicationRepository.js';

/**
 * MockApplicationRepository
 * Implementación en memoria del repositorio de solicitudes (sin Firebase)
 */
export class MockApplicationRepository extends IApplicationRepository {
  constructor() {
    super();
    this.applications = new Map();
    this.currentId = 1;
  }

  async create(application) {
    const id = `app-${this.currentId++}`;
    const appData = {
      ...application.toJSON(),
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.applications.set(id, appData);
    return appData;
  }

  async findById(id) {
    return this.applications.get(id) || null;
  }

  async update(id, updates) {
    const app = this.applications.get(id);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    const updatedApp = {
      ...app,
      ...updates,
      updatedAt: new Date()
    };

    this.applications.set(id, updatedApp);
    return updatedApp;
  }

  async delete(id) {
    return this.applications.delete(id);
  }

  async findAll(options = {}) {
    const { limit = 10, offset = 0, status } = options;
    let allApps = Array.from(this.applications.values());

    if (status) {
      allApps = allApps.filter(app => app.status === status);
    }

    const applications = allApps.slice(offset, offset + limit);

    return {
      applications,
      total: allApps.length
    };
  }

  async findByUser(userId) {
    const apps = Array.from(this.applications.values()).filter(
      app => app.userId === userId
    );
    return apps;
  }

  async findByOrganization(organizationId) {
    const apps = Array.from(this.applications.values()).filter(
      app => app.organizationId === organizationId
    );
    return apps;
  }

  async findByStatus(status) {
    const apps = Array.from(this.applications.values()).filter(
      app => app.status === status
    );
    return apps;
  }

  async findPendingReview() {
    const apps = Array.from(this.applications.values()).filter(
      app => ['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)
    );
    return apps;
  }

  async changeStatus(applicationId, newStatus, reviewedBy = null, reason = null) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.status = newStatus;
    app.updatedAt = new Date();

    if (newStatus === 'SUBMITTED') {
      app.submittedAt = new Date();
    }

    if (['APPROVED', 'REJECTED', 'REQUIRES_CHANGES'].includes(newStatus)) {
      app.reviewedAt = new Date();
      app.reviewedBy = reviewedBy;
    }

    if (newStatus === 'APPROVED') {
      app.approvalDate = new Date();
    }

    if (newStatus === 'REJECTED') {
      app.rejectionReason = reason;
    }

    this.applications.set(applicationId, app);
    return app;
  }

  async addDocument(applicationId, document) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.documents.push(document);
    app.updatedAt = new Date();
    this.applications.set(applicationId, app);
    return app;
  }

  async removeDocument(applicationId, documentId) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.documents = app.documents.filter(doc => doc.id !== documentId);
    app.updatedAt = new Date();
    this.applications.set(applicationId, app);
    return app;
  }

  async addReviewComment(applicationId, comment, author) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.reviewComments.push({
      text: comment,
      author: author,
      createdAt: new Date()
    });
    app.updatedAt = new Date();
    this.applications.set(applicationId, app);
    return app;
  }

  async updateCurrentStep(applicationId, step) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.currentStep = step;
    app.updatedAt = new Date();
    this.applications.set(applicationId, app);
    return app;
  }

  async setStatutes(applicationId, statutes) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.statutes = statutes;
    app.updatedAt = new Date();
    this.applications.set(applicationId, app);
    return app;
  }

  async setElectoralCommission(applicationId, commission) {
    const app = await this.findById(applicationId);
    if (!app) {
      throw new Error('Solicitud no encontrada');
    }

    app.electoralCommission = commission;
    app.updatedAt = new Date();
    this.applications.set(applicationId, app);
    return app;
  }
}
