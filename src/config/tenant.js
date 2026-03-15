// Configuracion de municipalidad (tenant) — Frontend
// Cada deploy lee sus propios valores desde variables de entorno VITE_TENANT_*
// Ver PLAN_MULTI_TENANCY.md para la lista completa de variables

const communeName = import.meta.env.VITE_TENANT_COMMUNE_NAME || '';

const tenant = {
  // Identidad
  communeName,
  municipalityName: import.meta.env.VITE_TENANT_MUNICIPALITY_NAME || (communeName ? `Municipalidad de ${communeName}` : 'Municipalidad'),
  platformName: import.meta.env.VITE_TENANT_PLATFORM_NAME || (communeName ? `Comunidad Social ${communeName}` : 'Comunidad Social'),
  platformShortName: import.meta.env.VITE_TENANT_PLATFORM_SHORT_NAME || (communeName ? `Comunidad ${communeName}` : 'Comunidad Social'),

  // Contacto
  adminEmail: import.meta.env.VITE_TENANT_ADMIN_EMAIL || '',
  website: import.meta.env.VITE_TENANT_WEBSITE || '',
  address: import.meta.env.VITE_TENANT_ADDRESS || '',
  phone: import.meta.env.VITE_TENANT_PHONE || '',

  // Branding
  logoPath: import.meta.env.VITE_TENANT_LOGO_PATH || '/icons/logo.png',
  colorPrimary: import.meta.env.VITE_TENANT_COLOR_PRIMARY || '',
  colorSecondary: import.meta.env.VITE_TENANT_COLOR_SECONDARY || '',

  // PDF / Legal (frontend genera PDFs tambien)
  pdfHeaderText: import.meta.env.VITE_TENANT_PDF_HEADER || `REPÚBLICA DE CHILE – I. MUNICIPALIDAD DE ${communeName.toUpperCase()}`,
  municipalityFullName: import.meta.env.VITE_TENANT_MUNICIPALITY_FULL_NAME || (communeName ? `Ilustre Municipalidad de ${communeName}` : 'Ilustre Municipalidad'),
  municipalityRut: import.meta.env.VITE_TENANT_MUNICIPALITY_RUT || '',
  dissolutionEntity: import.meta.env.VITE_TENANT_DISSOLUTION_ENTITY || (communeName ? `Corporación Municipal de ${communeName}` : ''),
};

export default tenant;
