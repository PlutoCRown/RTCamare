import { useNavigate } from '@tanstack/react-router';
import styles from './index.module.css';

interface BackButtonProps {
  label?: string;
  className?: string;
}

export function BackButton({ label = '返回首页', className }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate({ to: '/' })} className={`${styles.backButton} ${className || ''}`}>
      {label}
    </button>
  );
}
