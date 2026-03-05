import path from 'path';

/**
 * Verifica que un file path esté dentro de un directorio permitido.
 * Previene ataques de path traversal (../../etc/passwd).
 * @param {string} filePath - Path del archivo a verificar
 * @param {string} allowedDir - Directorio base permitido
 * @returns {boolean} true si el path es seguro
 */
export function isPathWithinDir(filePath, allowedDir) {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  return resolvedFile.startsWith(resolvedDir + path.sep) || resolvedFile === resolvedDir;
}
