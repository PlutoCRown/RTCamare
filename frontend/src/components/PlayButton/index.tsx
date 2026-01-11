import styles from './index.module.css';

interface PlayButtonProps {
  onClick: () => void;
  className?: string;
}

export function PlayButton({ onClick, className }: PlayButtonProps) {
  return (
    <button onClick={onClick} className={`${styles.playButton} ${className || ''}`}>
      <span className={styles.playIcon}>▶</span>
      <span className={styles.playText}>播放</span>
    </button>
  );
}
