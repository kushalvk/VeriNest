import { useRef, useState, type DragEvent } from 'react';
import * as documentApi from '../api/documentApi';
import { getApiError } from '../api/client';
import DocumentList from '../components/DocumentList';
import { FormAlert, inputClass, labelClass } from '../components/AuthCard';
import { DOCUMENT_TYPES, type DocumentType } from '../api/documentApi';
import { checkFile } from '../utils/fileValidation';

// Fast client-side pre-check to avoid wasted uploads. UX only — the
// backend re-validates type (via magic bytes) and size regardless.
const preCheck = (file: File): string | null => checkFile(file, { allowPdf: true });

export default function DocumentsPage() {
  const [documentType, setDocumentType] = useState<DocumentType>('aadhaar');
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBanner(null);

    const problem = preCheck(file);
    if (problem) {
      setBanner({ tone: 'error', message: problem });
      return;
    }

    setProgress(0);
    try {
      const doc = await documentApi.uploadDocument(file, documentType, setProgress);
      setBanner({ tone: 'success', message: `${file.name} uploaded.` });
      setRefreshKey((k) => k + 1);

      // Kick off OCR in the background; the card shows "Processing…" until
      // it settles, then the list refresh reflects the final status.
      setProcessingIds((ids) => new Set(ids).add(doc._id));
      documentApi
        .runOcr(doc._id)
        .catch(() => {/* status lands in ocrStatus either way */})
        .finally(() => {
          setProcessingIds((ids) => {
            const next = new Set(ids);
            next.delete(doc._id);
            return next;
          });
          setRefreshKey((k) => k + 1);
        });
    } catch (err) {
      setBanner({ tone: 'error', message: getApiError(err) });
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <main className="pb-16">
      <div className="mx-auto mt-8 max-w-3xl space-y-8 px-4">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h1 className="text-xl font-bold text-ink">Upload a document</h1>
          <p className="mt-1 text-sm text-ink-muted">
            JPG, PNG or PDF up to 4MB. Documents are reviewed by our team after upload.
          </p>

          {banner && (
            <div className="mt-4">
              <FormAlert tone={banner.tone} message={banner.message} />
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="documentType" className={labelClass}>Document type</label>
            <select
              id="documentType"
              className={inputClass}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div
            data-testid="dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
              dragOver ? 'border-primary-400 bg-primary-50' : 'border-line-strong bg-surface-muted hover:border-ink-faint'
            }`}
          >
            {progress !== null ? (
              <div className="w-full max-w-xs" data-testid="upload-progress">
                <p className="mb-2 text-sm font-medium text-ink-muted">Uploading… {progress}%</p>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-ink-muted">
                  Drag &amp; drop a file here, or click to browse
                </p>
                <p className="mt-1 text-xs text-ink-faint">JPG · PNG · PDF · max 4MB</p>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              data-testid="file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
        </section>

        <DocumentList refreshKey={refreshKey} processingIds={processingIds} />
      </div>
    </main>
  );
}
