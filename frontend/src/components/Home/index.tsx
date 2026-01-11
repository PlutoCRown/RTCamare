import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import styles from './index.module.css';

export function Home() {
  const [room, setRoom] = useState('demo');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validateRoom = (roomValue: string): boolean => {
    if (!roomValue) {
      setError('请输入房间号');
      return false;
    }

    if (roomValue.length < 2 || roomValue.length > 20) {
      setError('房间号长度应在2-20个字符之间');
      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(roomValue)) {
      setError('房间号只能包含字母、数字、下划线和连字符');
      return false;
    }

    return true;
  };

  const navigateToSender = () => {
    const trimmedRoom = room.trim() || 'demo';
    if (validateRoom(trimmedRoom)) {
      navigate({ to: '/sender/$room', params: { room: trimmedRoom } });
    }
  };

  const navigateToViewer = () => {
    const trimmedRoom = room.trim() || 'demo';
    if (validateRoom(trimmedRoom)) {
      navigate({ to: '/viewer/$room', params: { room: trimmedRoom } });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigateToSender();
    }
  };

  // 3秒后自动隐藏错误信息
  if (error) {
    setTimeout(() => setError(''), 3000);
  }

  return (
    <div className={styles.container}>
      <div className={styles.homeContainer}>
        <h1 className={styles.title}>WebRTC 视频传输</h1>

        <div className={styles.roomInput}>
          <label htmlFor="roomInput" className={styles.roomInputLabel}>
            房间号
          </label>
          <input
            id="roomInput"
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入房间号"
            className={styles.roomInputField}
          />
        </div>

        <div className={styles.roleButtons}>
          <button
            onClick={navigateToSender}
            className={`${styles.roleBtn} ${styles.senderBtn}`}
          >
            📹 成为发送方
          </button>
          <button
            onClick={navigateToViewer}
            className={`${styles.roleBtn} ${styles.receiverBtn}`}
          >
            📺 成为接收方
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
