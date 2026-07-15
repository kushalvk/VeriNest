import { useEffect, useRef, useState } from 'react';

interface Props {
  /** receives a base64 PNG data URL of the drawn signature */
  onConfirm: (signatureBase64: string) => void;
}

/**
 * Minimal canvas signature pad (mouse + touch). Confirm is blocked until
 * something has actually been drawn — an empty canvas can never be
 * submitted as a "signature".
 */
export default function SignatureCapture({ onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    // white background so the exported PNG matches the PDF stamp styling
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current!.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current!.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pointFrom(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
    setWarning('');
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setWarning('');
  };

  const confirm = () => {
    if (!hasDrawn) {
      setWarning('Please draw your signature first.');
      return;
    }
    onConfirm(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <div data-testid="signature-capture">
      <canvas ref={canvasRef} width={480} height={160}
        data-testid="signature-canvas"
        className="w-full cursor-crosshair touch-none rounded-md border-2 border-dashed border-line-strong bg-white"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
      <p className="mt-1 text-xs text-ink-faint">Draw your signature above with mouse or finger.</p>
      {warning && <p className="mt-1 text-sm text-red-600" data-testid="signature-warning">{warning}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={confirm} data-testid="signature-confirm"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          Confirm signature
        </button>
        <button type="button" onClick={clear} data-testid="signature-clear"
          className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted">
          Clear
        </button>
      </div>
    </div>
  );
}
