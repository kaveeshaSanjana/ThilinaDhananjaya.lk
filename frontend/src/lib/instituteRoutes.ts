function normalizeSuffix(suffix = '') {
  return suffix
    ? suffix.startsWith('/')
      ? suffix
      : `/${suffix}`
    : '';
}

export function getInstitutePath(instituteId?: string | null, suffix = '') {
  const normalizedSuffix = normalizeSuffix(suffix);

  if (!instituteId) {
    return normalizedSuffix || '/';
  }

  return `/institute/${instituteId}${normalizedSuffix}`;
}

export function replaceInstitutePath(pathname: string, instituteId: string) {
  if (/^\/institute\/[^/]+(\/|$)/.test(pathname) && !/^\/institute\/[^/]+\/admin(\/|$)/.test(pathname)) {
    return pathname.replace(/^\/institute\/[^/]+/, `/institute/${instituteId}`);
  }

  return getInstitutePath(instituteId, pathname);
}

export function getInstituteAdminPath(instituteId?: string | null, suffix = '') {
  const normalizedSuffix = normalizeSuffix(suffix);

  if (!instituteId) {
    return `/admin${normalizedSuffix}`;
  }

  return `/institute/${instituteId}/admin${normalizedSuffix}`;
}

export function replaceInstituteAdminPath(pathname: string, instituteId: string) {
  if (/^\/institute\/[^/]+\/admin/.test(pathname)) {
    return pathname.replace(/^\/institute\/[^/]+\/admin/, `/institute/${instituteId}/admin`);
  }

  return getInstituteAdminPath(instituteId, pathname.replace(/^\/admin/, ''));
}