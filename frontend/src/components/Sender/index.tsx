import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { WebRTCManager } from '../../utils/webrtc';
import { WebSocketManager } from '../../utils/websocket';
import { StateManager, ErrorHandler } from '../../utils/state-manager';
import styles from './index.module.css';

export function Sender() {
  const params = useParams({ strict: false });
  const room = (params as any).room || 'demo';
  const navigate = useNavigate();
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const stateManagerRef = useRef<StateManager | null>(null);

  const [state, setState] = useState<'init' | 'error' | 'active' | 'waiting'>('init');
  const [statusIcon, setStatusIcon] = useState('📹');
  const [statusText, setStatusText] = useState('正在申请摄像头权限...');
  const [statusDetail, setStatusDetail] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [stats, setStats] = useState({ resolution: '-', framerate: '-', bitrate: '-' });

  useEffect(() => {
    webrtcRef.current = new WebRTCManager();
    wsManagerRef.current = new WebSocketManager();
    stateManagerRef.current = new StateManager();

    const stateManager = stateManagerRef.current;
    const webrtc = webrtcRef.current;
    const wsManager = wsManagerRef.current;

    stateManager.onState(StateManager.STATES.INIT, () => {
      setState('init');
      setStatusIcon('📹');
      setStatusText('正在申请摄像头权限...');
      setStatusDetail('');
    });

    stateManager.onState(StateManager.STATES.ERROR, (data: any) => {
      setState('error');
      setErrorDetail(data.message);
    });

    stateManager.onState(StateManager.STATES.ACTIVE, () => {
      setState('active');
      setStatusIcon('📡');
      setStatusText('正在推流');
      setStatusDetail(`房间: ${room}`);
    });

    stateManager.onState(StateManager.STATES.WAITING, () => {
      setState('active');
      setStatusIcon('📡');
      setStatusText('等待接收方');
      setStatusDetail(`房间: ${room}`);
    });

    startSender();

    return () => {
      cleanup();
    };
  }, [room]);

  const startSender = async () => {
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    try {
      stateManager.setState(StateManager.STATES.INIT);

      await webrtc.getUserMedia();
      const pc = await webrtc.createPeerConnection();

      webrtc.localStream!.getTracks().forEach((track) => {
        pc.addTrack(track, webrtc.localStream!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsManager.send({
            type: 'ice-candidate',
            candidate: event.candidate,
          });
        }
      };

      await wsManager.connect('sender', room);

      wsManager.onMessage((msg: any) => {
        handleWebSocketMessage(msg);
      });

      const cameraList = await webrtc.getAvailableCameras();
      setCameras(cameraList);
      if (cameraList.length > 0) {
        setSelectedCamera(cameraList[0].deviceId);
      }

      webrtc.startStatsMonitoring((statsData) => {
        setStats(statsData);
      });

      stateManager.setState(StateManager.STATES.WAITING);
    } catch (error: any) {
      console.error('Sender initialization failed:', error);
      stateManager.setState(StateManager.STATES.ERROR, {
        message: ErrorHandler.handleWebRTCError(error),
      });
    }
  };

  const handleWebSocketMessage = (msg: any) => {
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    switch (msg.type) {
      case 'joined':
        console.log('Joined room as sender');
        break;
      case 'viewer-ready':
        makeAndSendOffer();
        break;
      case 'answer':
        handleAnswer(msg.sdp);
        break;
      case 'ice-candidate':
        handleIceCandidate(msg.candidate);
        break;
      case 'viewer-left':
        stateManager.setState(StateManager.STATES.WAITING);
        break;
      case 'error':
        stateManager.setState(StateManager.STATES.ERROR, {
          message: ErrorHandler.handleServerError(msg.reason),
        });
        break;
    }
  };

  const makeAndSendOffer = async () => {
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    try {
      const offer = await webrtc.pc!.createOffer();
      await webrtc.pc!.setLocalDescription(offer);

      wsManager.send({
        type: 'offer',
        sdp: offer,
      });

      stateManager.setState(StateManager.STATES.ACTIVE);
    } catch (error: any) {
      console.error('Failed to create offer:', error);
    }
  };

  const handleAnswer = async (sdp: RTCSessionDescriptionInit) => {
    const webrtc = webrtcRef.current!;
    try {
      await webrtc.pc!.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const webrtc = webrtcRef.current!;
    try {
      await webrtc.pc!.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  };

  const switchCamera = async (deviceId: string) => {
    if (!deviceId) return;
    const webrtc = webrtcRef.current!;
    try {
      await webrtc.switchCamera(deviceId);
      console.log('Camera switched successfully');
    } catch (error: any) {
      console.error('Failed to switch camera:', error);
    }
  };

  const retry = () => {
    cleanup();
    startSender();
  };

  const stopStreaming = () => {
    cleanup();
    navigate({ to: '/' });
  };

  const cleanup = () => {
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
    }
    if (wsManagerRef.current) {
      wsManagerRef.current.close();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.senderContainer}>
        {state === 'init' && (
          <div className={styles.stateSection}>
            <div className={styles.statusIcon}>{statusIcon}</div>
            <div className={styles.statusText}>{statusText}</div>
            <div className={styles.statusDetail}>{statusDetail}</div>
          </div>
        )}

        {state === 'error' && (
          <div className={styles.stateSection}>
            <div className={styles.statusIcon}>❌</div>
            <div className={styles.statusText}>连接失败</div>
            <div className={styles.statusDetail}>{errorDetail}</div>
            <button onClick={retry} className={styles.retryBtn}>
              重试
            </button>
            <button onClick={() => navigate({ to: '/' })} className={styles.backBtn}>
              返回首页
            </button>
          </div>
        )}

        {state === 'active' && (
          <div className={styles.stateSection}>
            <div className={styles.statusIcon}>{statusIcon}</div>
            <div className={styles.statusText}>{statusText}</div>
            <div className={styles.statusDetail}>{statusDetail}</div>

            {cameras.length > 0 && (
              <div className={styles.cameraSelection}>
                <label htmlFor="cameraSelect" className={styles.cameraSelectionLabel}>
                  选择摄像头:
                </label>
                <select
                  id="cameraSelect"
                  className={styles.cameraSelect}
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    switchCamera(e.target.value);
                  }}
                >
                  {cameras.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `摄像头 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.statsContainer}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>分辨率:</span>
                <span className={styles.statValue}>{stats.resolution}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>帧率:</span>
                <span className={styles.statValue}>{stats.framerate}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>码率:</span>
                <span className={styles.statValue}>{stats.bitrate}</span>
              </div>
            </div>

            <button onClick={stopStreaming} className={styles.stopBtn}>
              停止推流
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
