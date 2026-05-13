import { useEffect } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [visible, onDismiss, duration]);

  if (!visible) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-icon">✓</span>
      <span>{message}</span>
    </div>
  );
}
