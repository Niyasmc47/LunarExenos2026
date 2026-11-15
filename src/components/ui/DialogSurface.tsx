import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal semantics keep keyboard focus inside and make the page inert. */
export function DialogSurface({ label, onClose, className = '', children }: { label: string; onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={label} aria-modal="true" className={`mission-dialog ${className}`} onCancel={event => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}
