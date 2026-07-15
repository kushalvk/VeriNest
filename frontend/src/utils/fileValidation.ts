export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Fast client-side pre-check to avoid wasted uploads. UX only — the
 * backend re-validates type (via magic bytes) and size regardless.
 * Returns an error message, or null when the file looks acceptable.
 */
export const checkFile = (
  file: File,
  { allowPdf = false }: { allowPdf?: boolean } = {}
): string | null => {
  const allowed = ['image/jpeg', 'image/png', ...(allowPdf ? ['application/pdf'] : [])];
  if (!allowed.includes(file.type)) {
    return allowPdf
      ? 'Only JPG, PNG and PDF files are allowed.'
      : 'Only JPG and PNG images are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File exceeds the 5MB limit.';
  }
  return null;
};
