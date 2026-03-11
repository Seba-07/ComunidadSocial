// Configuracion de municipalidad (tenant)
// Cada deploy lee sus propios valores desde variables de entorno TENANT_*
// Ver PLAN_MULTI_TENANCY.md para la lista completa de variables

const communeName = process.env.TENANT_COMMUNE_NAME || '';
const regionName = process.env.TENANT_REGION_NAME || 'Metropolitana';

const tenant = {
  // Identidad
  communeName,
  regionName,
  municipalityName: process.env.TENANT_MUNICIPALITY_NAME || (communeName ? `Municipalidad de ${communeName}` : 'Municipalidad'),
  municipalityFullName: process.env.TENANT_MUNICIPALITY_FULL_NAME || (communeName ? `Ilustre Municipalidad de ${communeName}` : 'Ilustre Municipalidad'),

  // Contacto
  address: process.env.TENANT_ADDRESS || '',
  phone: process.env.TENANT_PHONE || '',
  website: process.env.TENANT_WEBSITE || '',
  adminEmail: process.env.TENANT_ADMIN_EMAIL || '',

  // PDF / Legal
  pdfHeaderText: process.env.TENANT_PDF_HEADER || `REPÚBLICA DE CHILE – I. MUNICIPALIDAD DE ${communeName.toUpperCase()}`,
  pdfHeaderSubtitle: process.env.TENANT_PDF_SUBTITLE || 'SECRETARÍA MUNICIPAL',
  dissolutionEntity: process.env.TENANT_DISSOLUTION_ENTITY || (communeName ? `Corporación Municipal de ${communeName}` : ''),

  // Branding
  platformName: process.env.TENANT_PLATFORM_NAME || (communeName ? `Comunidad Social ${communeName}` : 'Comunidad Social'),
  platformShortName: process.env.TENANT_PLATFORM_SHORT_NAME || (communeName ? `Comunidad ${communeName}` : 'Comunidad Social'),
};

// Validacion: en produccion, TENANT_COMMUNE_NAME es obligatorio
const isDeployed = process.env.NODE_ENV === 'production' ||
                   !!process.env.RAILWAY_ENVIRONMENT ||
                   !!process.env.RAILWAY_PROJECT_ID;

if (isDeployed && !tenant.communeName) {
  console.error('FATAL: TENANT_COMMUNE_NAME is required in deployed environments.');
  console.error('Set it in Railway environment variables. Example: TENANT_COMMUNE_NAME=Renca');
  process.exit(1);
}

export default tenant;
