import { useState, useEffect } from 'react';
import { BackButton } from '../shared/BackButton';
import styles from './index.module.css';

interface RoomStatus {
  roomId: string;
  sender: {
    connected: boolean;
    online: boolean;
  };
  viewer: {
    connected: boolean;
    online: boolean;
  };
}

interface StatusResponse {
  rooms: RoomStatus[];
}

export function Status() {
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const protocol = location.protocol === 'https:' ? 'https' : 'http';
      const response = await fetch(`${protocol}://${location.host}/api/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: StatusResponse = await response.json();
      setRooms(data.rooms || []);
    } catch (err: any) {
      console.error('Failed to fetch status:', err);
      setError(err.message || '获取状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (connected: boolean, online: boolean) => {
    if (!connected) {
      return <span className={styles.badge}>未连接</span>;
    }
    if (online) {
      return <span className={`${styles.badge} ${styles.online}`}>在线</span>;
    }
    return <span className={`${styles.badge} ${styles.offline}`}>离线</span>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>房间状态监控</h1>
        
        <div className={styles.actions}>
          <button onClick={fetchStatus} className={styles.refreshBtn} disabled={loading}>
            {loading ? '刷新中...' : '🔄 刷新'}
          </button>
          <BackButton />
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {loading && rooms.length === 0 ? (
          <div className={styles.loading}>加载中...</div>
        ) : rooms.length === 0 ? (
          <div className={styles.empty}>暂无房间</div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>房间ID</th>
                  <th>发送方 (Sender)</th>
                  <th>接收方 (Viewer)</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.roomId}>
                    <td className={styles.roomId}>{room.roomId}</td>
                    <td>{getStatusBadge(room.sender.connected, room.sender.online)}</td>
                    <td>{getStatusBadge(room.viewer.connected, room.viewer.online)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
