import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { WebRTCManager } from "../../utils/webrtc";
import { WebSocketManager } from "../../utils/websocket";
import { StateManager, ErrorHandler } from "../../utils/state-manager";
import { PageState } from "../../types/enums";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { BackButton } from "../shared/BackButton";
import {
  SocketEventType,
  createSocketMessage,
} from "../../../../shared/types/socket-events";
import styles from "./index.module.css";

export function Sender() {
  const params = useParams({ strict: false });
  const room = (params as any).room || "demo";
  const navigate = useNavigate();
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const stateManagerRef = useRef<StateManager | null>(null);

  const [state, setState] = useState<PageState>(PageState.INIT);
  const [statusIcon, setStatusIcon] = useState("📹");
  const [statusText, setStatusText] = useState("正在申请摄像头权限...");
  const [statusDetail, setStatusDetail] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [stats, setStats] = useState({
    resolution: "-",
    framerate: "-",
    bitrate: "-",
  });

  useEffect(() => {
    webrtcRef.current = new WebRTCManager();
    wsManagerRef.current = new WebSocketManager();
    stateManagerRef.current = new StateManager();

    const stateManager = stateManagerRef.current;

    stateManager.onState(PageState.INIT, () => {
      setState(PageState.INIT);
      setStatusIcon("📹");
      setStatusText("正在申请摄像头权限...");
      setStatusDetail("");
    });

    stateManager.onState(PageState.ERROR, (data: any) => {
      setState(PageState.ERROR);
      setErrorDetail(data.message);
    });

    stateManager.onState(PageState.ACTIVE, () => {
      setState(PageState.ACTIVE);
      setStatusIcon("📡");
      setStatusText("正在推流");
      setStatusDetail(`房间: ${room}`);
    });

    stateManager.onState(PageState.WAITING, () => {
      setState(PageState.ACTIVE);
      setStatusIcon("📡");
      setStatusText("等待接收方");
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
          wsManager.send(
            createSocketMessage(SocketEventType.ICE_CANDIDATE, {
              candidate: event.candidate,
            })
          );
        }
      };

      await wsManager.connect("sender", room);

      // 使用类型安全的消息处理
      wsManager.on(SocketEventType.JOINED, (msg) => {
        console.log("Joined room as sender", msg.role, msg.room);
      });

      wsManager.on(SocketEventType.VIEWER_READY, () => {
        makeAndSendOffer();
      });

      wsManager.on(SocketEventType.ANSWER, (msg) => {
        handleAnswer(msg.sdp);
      });

      wsManager.on(SocketEventType.ICE_CANDIDATE, (msg) => {
        handleIceCandidate(msg.candidate);
      });

      wsManager.on(SocketEventType.VIEWER_LEFT, () => {
        stateManager.setState(StateManager.STATES.WAITING);
      });

      wsManager.on(SocketEventType.ERROR, (msg) => {
        stateManager.setState(StateManager.STATES.ERROR, {
          message: ErrorHandler.handleServerError(msg.reason),
        });
      });

      wsManager.startListening();

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
      console.error("Sender initialization failed:", error);
      stateManager.setState(StateManager.STATES.ERROR, {
        message: ErrorHandler.handleWebRTCError(error),
      });
    }
  };

  const makeAndSendOffer = async () => {
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    try {
      const offer = await webrtc.pc!.createOffer();
      await webrtc.pc!.setLocalDescription(offer);

      wsManager.send(
        createSocketMessage(SocketEventType.OFFER, {
          sdp: offer,
        })
      );

      stateManager.setState(StateManager.STATES.ACTIVE);
    } catch (error: any) {
      console.error("Failed to create offer:", error);
    }
  };

  const handleAnswer = async (sdp: RTCSessionDescriptionInit) => {
    const webrtc = webrtcRef.current!;
    try {
      await webrtc.pc!.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error("Failed to handle answer:", error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const webrtc = webrtcRef.current!;
    try {
      await webrtc.pc!.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  };

  const switchCamera = async (deviceId: string) => {
    if (!deviceId) return;
    const webrtc = webrtcRef.current!;
    try {
      await webrtc.switchCamera(deviceId);
      console.log("Camera switched successfully");
    } catch (error: any) {
      console.error("Failed to switch camera:", error);
    }
  };

  const retry = () => {
    cleanup();
    startSender();
  };

  const stopStreaming = () => {
    cleanup();
    navigate({ to: "/" });
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
        {state === PageState.INIT && (
          <LoadingState
            icon={statusIcon}
            text={statusText}
            detail={statusDetail}
          />
        )}

        {state === PageState.ERROR && (
          <ErrorState
            errorMessage={errorDetail}
            onRetry={retry}
            showBackButton={true}
          />
        )}

        {state === PageState.ACTIVE && (
          <div className={styles.stateSection}>
            <div className={styles.statusIcon}>{statusIcon}</div>
            <div className={styles.statusText}>{statusText}</div>
            <div className={styles.statusDetail}>{statusDetail}</div>

            {cameras.length > 0 && (
              <div className={styles.cameraSelection}>
                <label
                  htmlFor="cameraSelect"
                  className={styles.cameraSelectionLabel}
                >
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

            <div className={styles.buttonGroup}>
              <button onClick={stopStreaming} className={styles.stopBtn}>
                停止推流
              </button>
              <BackButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
