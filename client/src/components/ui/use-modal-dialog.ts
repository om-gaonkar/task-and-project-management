import { useEffect, useRef, type MouseEvent } from 'react';

/**
 * Drives a native <dialog> from React state. showModal() gives us focus trapping, Escape to
 * close, inert background content and top-layer stacking without extra code.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // "close" fires for Escape as well as for dialog.close(). Only report it while still open
    // in React state, so closing from the parent does not call onClose a second time.
    const handleClose = () => {
      if (openRef.current) onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  // The dialog element itself only receives clicks that land on its backdrop (the panel has no padding).
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onCloseRef.current();
  };

  return { ref, onBackdropClick };
}
