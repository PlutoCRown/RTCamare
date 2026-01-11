import { useNavigate } from '@tanstack/react-router';
import styles from './index.module.css';

interface ErrorStateProps {
  errorMessage: string;
  onRetry?: () => void;
  showBackButton?: boolean;
}

export function ErrorState({ errorMessage, onRetry, showBackButton = true }: ErrorStateProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.errorState}>
      <div className={styles.statusIcon}>❌</div>
      <div className={styles.statusText}>连接失败</div>
      <div className={styles.statusDetail}>{errorMessage}</div>
      <div className={styles.buttonGroup}>
        {onRetry && (
          <button onClick={onRetry} className={styles.retryBtn}>
            重试
          </button>
        )}
        {showBackButton && (
          <button onClick={() => navigate({ to: '/' })} className={styles.backBtn}>
            返回首页
          </button>
        )}
      </div>
    </div>
  );
}
