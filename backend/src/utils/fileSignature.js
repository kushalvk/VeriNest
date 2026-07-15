/**
 * Magic-number validation — the client-supplied mimetype only reflects the
 * filename/headers, so verify the actual file content before uploading.
 */
const matchesSignature = (buffer, mimetype) => {
  if (!buffer || buffer.length < 8) return false;
  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case 'application/pdf':
      return buffer.slice(0, 5).toString('ascii') === '%PDF-';
    default:
      return false;
  }
};

module.exports = { matchesSignature };
