import { randomBytes } from 'node:crypto';

export type PrivateUploadKind = 'advertiser_logo' | 'proof';
const definitions = {
  advertiser_logo: { maximum: 5 * 1024 * 1024, types: ['image/png', 'image/jpeg'] },
  proof: { maximum: 10 * 1024 * 1024, types: ['image/png', 'image/jpeg', 'application/pdf'] },
} as const;

function magicMatches(bytes: Uint8Array, type: string) {
  if (type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

export async function validatePrivateUpload(file: File, kind: PrivateUploadKind) {
  const definition = definitions[kind];
  if (!definition.types.includes(file.type as never)) throw new Error('unsupported-file-type');
  if (file.size < 1 || file.size > definition.maximum) throw new Error('invalid-file-size');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!magicMatches(bytes, file.type)) throw new Error('file-signature-mismatch');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'pdf';
  const originalName = file.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || `upload.${extension}`;
  return { bytes: Buffer.from(bytes), contentType: file.type, extension, originalName, randomName: `${randomBytes(24).toString('hex')}.${extension}` };
}

export function privateFileHeaders(contentType: string, fileName: string, inline = false) {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `${inline && contentType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${fileName.replace(/["\\]/g, '_')}"`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:",
  };
}
