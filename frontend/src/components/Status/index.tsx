import { useState, useEffect } from "react";
import { BackButton } from "../shared/BackButton";
import styles from "./index.module.css";

interface RoomStatus {
  roomId: string;
  sender: {
    connected: boolean;
    online: boolean;
    clientId: string | null;
  };
  viewer: {
    connected: boolean;
    online: boolean;
    clientId: string | null;
  };
}

interface StatusResponse {
  rooms: RoomStatus[];
}

export function Status() {
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError("");
      const protocol = location.protocol === "https:" ? "https" : "http";
      const response = await fetch(`${protocol}://${location.host}/api/status`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: StatusResponse = await response.json();
      setRooms(data.rooms || []);
    } catch (err: any) {
      console.error("Failed to fetch status:", err);
      setError(err.message || "获取状态失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (
    connected: boolean,
    online: boolean,
    clientId: string | null
  ) => {
    if (!connected) {
      return <span className={styles.badge}>未连接</span>;
    }
    const badgeContent = online ? "在线" : "离线";
    const badgeClass = online
      ? `${styles.badge} ${styles.online}`
      : `${styles.badge} ${styles.offline}`;
    return (
      <span className={badgeClass} title={clientId || undefined}>
        {badgeContent}
      </span>
    );
  };

  const handleKick = async (clientId: string) => {
    if (!confirm(`确定要踢出客户端 ${clientId} 吗？`)) {
      return;
    }

    try {
      const protocol = location.protocol === "https:" ? "https" : "http";
      const response = await fetch(`${protocol}://${location.host}/api/kick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "踢出失败");
      }

      // 刷新状态
      await fetchStatus();
    } catch (err: any) {
      console.error("Failed to kick client:", err);
      alert(err.message || "踢出失败");
    }
  };

  const renderClientCell = (
    connected: boolean,
    online: boolean,
    clientId: string | null
  ) => {
    if (!connected) {
      return <span className={styles.emptyCell}>-</span>;
    }

    return (
      <div className={styles.clientCell}>
        <div className={styles.clientInfo}>
          {getStatusBadge(connected, online, clientId)}
          {clientId && (
            <span className={styles.clientId} title={clientId}>
              {clientId.substring(0, 8)}...
            </span>
          )}
        </div>
        {clientId && (
          <button
            className={styles.kickBtn}
            onClick={() => handleKick(clientId)}
            title={`踢出 ${clientId}`}
          >
            🚫
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>房间状态监控</h1>

        <div className={styles.actions}>
          <button
            onClick={fetchStatus}
            className={styles.refreshBtn}
            disabled={loading}
          >
            {loading ? "刷新中..." : "🔄 刷新"}
          </button>
          <BackButton />
        </div>

        {error && <div className={styles.error}>{error}</div>}

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
                    <td>
                      {renderClientCell(
                        room.sender.connected,
                        room.sender.online,
                        room.sender.clientId
                      )}
                    </td>
                    <td>
                      {renderClientCell(
                        room.viewer.connected,
                        room.viewer.online,
                        room.viewer.clientId
                      )}
                    </td>
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
