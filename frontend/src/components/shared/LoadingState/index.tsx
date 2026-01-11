import styles from './index.module.css';

interface LoadingStateProps {
  icon?: string;
  text: string;
  detail?: string;
}

export function LoadingState({ icon = '⏳', text, detail }: LoadingStateProps) {
  return (
    <div className={styles.loadingState}>
      <div className={styles.statusIcon}>{icon}</div>
      <div className={styles.statusText}>{text}</div>
      {detail && <div className={styles.statusDetail}>{detail}</div>}
    </div>
  );
}
