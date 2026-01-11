import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { WebRTCManager } from '../../utils/webrtc';
import { WebSocketManager } from '../../utils/websocket';
import { StateManager, ErrorHandler } from '../../utils/state-manager';
import styles from './index.module.css';

export function Viewer() {
  const params = useParams({ strict: false });
  const room = (params as any).room || 'demo';
  const navigate = useNavigate();
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const stateManagerRef = useRef<StateManager | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const waitingDialogRef = useRef<HTMLDialogElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<'init' | 'error' | 'active' | 'waiting'>('init');
  const [statusIcon, setStatusIcon] = useState('⏳');
  const [statusText, setStatusText] = useState('等待发送方');
  const [statusDetail, setStatusDetail] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [stats, setStats] = useState({ resolution: '-', framerate: '-', bitrate: '-', latency: '-' });
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWaitingDialog, setShowWaitingDialog] = useState(false);
  const [isWaitingForNewSender, setIsWaitingForNewSender] = useState(false);

  useEffect(() => {
    webrtcRef.current = new WebRTCManager();
    wsManagerRef.current = new WebSocketManager();
    stateManagerRef.current = new StateManager();

    const stateManager = stateManagerRef.current;
    const webrtc = webrtcRef.current;
    const wsManager = wsManagerRef.current;

    stateManager.onState(StateManager.STATES.INIT, () => {
      setState('init');
      setStatusIcon('⏳');
      setStatusText('等待发送方');
      setStatusDetail(`房间: ${room}`);
    });

    stateManager.onState(StateManager.STATES.ERROR, (data: any) => {
      setState('error');
      setErrorDetail(data.message);
    });

    stateManager.onState(StateManager.STATES.ACTIVE, () => {
      setState('active');
    });

    stateManager.onState(StateManager.STATES.WAITING, () => {
      setShowWaitingDialog(true);
      setIsWaitingForNewSender(true);
    });

    startViewer();

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyboard(e);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cleanup();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [room]);

  const startViewer = async () => {
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    try {
      stateManager.setState(StateManager.STATES.INIT);

      const pc = await webrtc.createPeerConnection();

      pc.ontrack = (event) => {
        console.log('Received remote stream', event);
        if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = event.streams[0];
          stateManager.setState(StateManager.STATES.ACTIVE);
          autoPlayVideo().catch(() => {
            console.log('Auto-play blocked, waiting for user interaction');
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (remoteVideoRef.current?.srcObject) {
            stateManager.setState(StateManager.STATES.ACTIVE);
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsManager.send({
            type: 'ice-candidate',
            candidate: event.candidate,
          });
        }
      };

      await wsManager.connect('viewer', room);

      wsManager.onMessage((msg: any) => {
        handleWebSocketMessage(msg);
      });

      webrtc.startStatsMonitoring((statsData) => {
        setStats(statsData);
      });

      wsManager.send({ type: 'ready' });
    } catch (error: any) {
      console.error('Viewer initialization failed:', error);
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
        console.log('Joined room as viewer');
        break;
      case 'offer':
        handleOffer(msg.sdp);
        break;
      case 'ice-candidate':
        handleIceCandidate(msg.candidate);
        break;
      case 'sender-left':
        handleSenderLeft();
        break;
      case 'error':
        stateManager.setState(StateManager.STATES.ERROR, {
          message: ErrorHandler.handleServerError(msg.reason),
        });
        break;
    }
  };

  const handleOffer = async (sdp: RTCSessionDescriptionInit) => {
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    try {
      await webrtc.pc!.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await webrtc.pc!.createAnswer();
      await webrtc.pc!.setLocalDescription(answer);

      wsManager.send({
        type: 'answer',
        sdp: answer,
      });

      const hasReceivers = webrtc.pc!.getReceivers().length > 0;
      if (hasReceivers && remoteVideoRef.current?.srcObject) {
        stateManager.setState(StateManager.STATES.ACTIVE);
      }
    } catch (error: any) {
      console.error('Failed to handle offer:', error);
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

  const handleSenderLeft = () => {
    setIsWaitingForNewSender(true);
    const stateManager = stateManagerRef.current!;
    stateManager.setState(StateManager.STATES.WAITING);
  };

  const autoPlayVideo = async () => {
    if (remoteVideoRef.current) {
      try {
        await remoteVideoRef.current.play();
        console.log('Video started playing');
      } catch (error) {
        console.error('Failed to auto-play video:', error);
      }
    }
  };

  const handleVideoClick = () => {
    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
      remoteVideoRef.current.play().catch((err) => {
        console.error('Failed to play video on click:', err);
      });
    }
  };

  const toggleControlPanel = () => {
    setIsPanelExpanded(!isPanelExpanded);
  };

  const hideControlPanel = () => {
    setIsPanelExpanded(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && videoContainerRef.current) {
      videoContainerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const toggleMute = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsMuted(remoteVideoRef.current.muted);
    }
  };

  const cancelWaitingForSender = () => {
    setShowWaitingDialog(false);
    setIsWaitingForNewSender(false);
    navigate({ to: '/' });
  };

  const retry = () => {
    cleanup();
    startViewer();
  };

  const stopViewing = () => {
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
    if (waitingDialogRef.current) {
      waitingDialogRef.current.close();
    }
  };

  const handleKeyboard = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'Escape':
        if (isPanelExpanded) {
          hideControlPanel();
        } else if (showWaitingDialog && waitingDialogRef.current?.open) {
          cancelWaitingForSender();
        }
        break;
    }
  };

  return (
    <div className={styles.container}>
      <div ref={videoContainerRef} className={styles.videoContainer} onClick={handleVideoClick}>
        <video ref={remoteVideoRef} className={styles.remoteVideo} autoPlay playsInline />
      </div>

      {state === 'init' && (
        <div className={styles.overlayState}>
          <div className={styles.statusIcon}>{statusIcon}</div>
          <div className={styles.statusText}>{statusText}</div>
          <div className={styles.statusDetail}>{statusDetail}</div>
        </div>
      )}

      {state === 'error' && (
        <div className={styles.overlayState}>
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
        <div ref={controlPanelRef} className={`${styles.controlPanel} ${isPanelExpanded ? styles.expanded : ''}`}>
          <button onClick={toggleControlPanel} className={styles.toggleBtn}>
            📊
          </button>
          <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
              <h3>接收方控制台</h3>
              <button onClick={hideControlPanel} className={styles.closeBtn}>
                ×
              </button>
            </div>
            <div className={styles.statsGrid}>
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
              <div className={styles.statItem}>
                <span className={styles.statLabel}>延迟:</span>
                <span className={styles.statValue}>{stats.latency}</span>
              </div>
            </div>
            <div className={styles.controlButtons}>
              <button onClick={toggleFullscreen} className={styles.controlBtn}>
                {isFullscreen ? '退出全屏' : '全屏'}
              </button>
              <button onClick={toggleMute} className={styles.controlBtn}>
                {isMuted ? '取消静音' : '静音'}
              </button>
              <button onClick={stopViewing} className={`${styles.controlBtn} ${styles.stop}`}>
                停止接收
              </button>
            </div>
          </div>
        </div>
      )}

      {showWaitingDialog && (
        <dialog ref={waitingDialogRef} className={styles.waitingDialog} open={showWaitingDialog}>
          <div className={styles.dialogContent}>
            <div className={styles.statusIcon}>⏳</div>
            <div className={styles.statusText}>发送方已离开</div>
            <div className={styles.statusDetail}>正在等待新的发送方加入...</div>
            <button onClick={cancelWaitingForSender} className={styles.cancelBtn}>
              取消等待
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
