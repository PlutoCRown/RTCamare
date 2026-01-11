import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { WebRTCManager } from "../../utils/webrtc";
import { WebSocketManager } from "../../utils/websocket";
import { StateManager, ErrorHandler } from "../../utils/state-manager";
import { PageState } from "../../types/enums";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { PlayButton } from "../shared/PlayButton";
import { BackButton } from "../shared/BackButton";
import {
  SocketEventType,
  createSocketMessage,
} from "../../../../shared/types/socket-events";
import styles from "./index.module.css";

export function Viewer() {
  const params = useParams({ strict: false });
  const room: string = (params as any).room || "demo";
  const navigate = useNavigate();
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const stateManagerRef = useRef<StateManager | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const waitingDialogRef = useRef<HTMLDialogElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<string | undefined>(undefined);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<PageState>(PageState.INIT);
  const [statusIcon, setStatusIcon] = useState("⏳");
  const [statusText, setStatusText] = useState("等待发送方");
  const [statusDetail, setStatusDetail] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [stats, setStats] = useState({
    resolution: "-",
    framerate: "-",
    bitrate: "-",
    latency: "-",
  });
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWaitingDialog, setShowWaitingDialog] = useState(false);
  const [isWaitingForNewSender, setIsWaitingForNewSender] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    // 防止在严格模式下重复初始化
    if (isInitializedRef.current == room) {
      return;
    }
    isInitializedRef.current = room;

    webrtcRef.current = new WebRTCManager();
    wsManagerRef.current = new WebSocketManager();
    stateManagerRef.current = new StateManager();

    const stateManager = stateManagerRef.current;

    stateManager.onState(PageState.INIT, () => {
      setState(PageState.INIT);
      setStatusIcon("⏳");
      setStatusText("等待发送方");
      setStatusDetail(`房间: ${room}`);
    });

    stateManager.onState(PageState.ERROR, (data: any) => {
      setState(PageState.ERROR);
      setErrorDetail(data.message);
    });

    stateManager.onState(PageState.ACTIVE, () => {
      setState(PageState.ACTIVE);
    });

    stateManager.onState(PageState.WAITING, () => {
      setShowWaitingDialog(true);
      setIsWaitingForNewSender(true);
    });

    // 生成二维码
    generateQRCode();

    startViewer();

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyboard(e);
    };

    document.addEventListener("keydown", handleKeyDown);

    cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [room]);

  const generateQRCode = async () => {
    try {
      const QRCode = await import("qrcode");
      const senderUrl = `${location.origin}/sender/${room}`;
      const dataUrl = await QRCode.toDataURL(senderUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      setQrCodeUrl(dataUrl);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  };

  const startViewer = async () => {
    console.warn("接受方，启动！");
    const webrtc = webrtcRef.current!;
    const wsManager = wsManagerRef.current!;
    const stateManager = stateManagerRef.current!;

    try {
      stateManager.setState(StateManager.STATES.INIT);

      const pc = await webrtc.createPeerConnection();

      pc.ontrack = (event) => {
        console.log("Received remote stream", event);
        if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = event.streams[0];
          stateManager.setState(PageState.ACTIVE);
          autoPlayVideo();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          if (remoteVideoRef.current?.srcObject) {
            stateManager.setState(PageState.ACTIVE);
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsManager.send(
            createSocketMessage(SocketEventType.ICE_CANDIDATE, {
              candidate: event.candidate,
            })
          );
        }
      };

      await wsManager.connect("viewer", room);

      // 使用类型安全的消息处理
      wsManager.on(SocketEventType.JOINED, (msg) => {
        console.log("Joined room as viewer in", msg.room);
      });

      wsManager.on(SocketEventType.OFFER, (msg) => {
        handleOffer(msg.sdp);
      });

      wsManager.on(SocketEventType.ICE_CANDIDATE, (msg) => {
        handleIceCandidate(msg.candidate);
      });

      wsManager.on(SocketEventType.SENDER_LEFT, () => {
        handleSenderLeft();
      });

      wsManager.on(SocketEventType.ERROR, (msg) => {
        stateManager.setState(StateManager.STATES.ERROR, {
          message: ErrorHandler.handleServerError(msg.reason),
        });
      });

      wsManager.startListening();

      webrtc.startStatsMonitoring((statsData) => {
        setStats(statsData);
      });

      // 注意：不再需要发送 READY 事件
      // Viewer 加入房间后，服务器会自动发送 VIEWER_READY 给 Sender（如果 Sender 已存在）
    } catch (error: any) {
      console.error("Viewer initialization failed:", error);
      stateManager.setState(StateManager.STATES.ERROR, {
        message: ErrorHandler.handleWebRTCError(error),
      });
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

      wsManager.send(
        createSocketMessage(SocketEventType.ANSWER, {
          sdp: answer,
        })
      );

      const hasReceivers = webrtc.pc!.getReceivers().length > 0;
      if (hasReceivers && remoteVideoRef.current?.srcObject) {
        stateManager.setState(PageState.ACTIVE);
      }
    } catch (error: any) {
      console.error("Failed to handle offer:", error);
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

  const handleSenderLeft = () => {
    setIsWaitingForNewSender(true);
    const stateManager = stateManagerRef.current!;
    stateManager.setState(PageState.WAITING);
  };

  const autoPlayVideo = async () => {
    if (remoteVideoRef.current) {
      try {
        await remoteVideoRef.current.play();
        console.log("Video started playing");
        setShowPlayButton(false);
      } catch (error) {
        console.error("Failed to auto-play video:", error);
        setShowPlayButton(true);
      }
    }
  };

  const handlePlayButtonClick = async () => {
    if (remoteVideoRef.current) {
      try {
        await remoteVideoRef.current.play();
        setShowPlayButton(false);
      } catch (error) {
        console.error("Failed to play video:", error);
        // 保持播放按钮显示
      }
    }
  };

  const handleVideoClick = () => {
    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
      handlePlayButtonClick();
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
    navigate({ to: "/" });
  };

  const retry = () => {
    cleanup();
    startViewer();
  };

  const stopViewing = () => {
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
    if (waitingDialogRef.current) {
      waitingDialogRef.current.close();
    }
  };

  const handleKeyboard = (e: KeyboardEvent) => {
    switch (e.key) {
      case "f":
      case "F":
        toggleFullscreen();
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "Escape":
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
      <div
        ref={videoContainerRef}
        className={styles.videoContainer}
        onClick={handleVideoClick}
      >
        <video
          ref={remoteVideoRef}
          className={styles.remoteVideo}
          autoPlay
          playsInline
          onPlay={() => setShowPlayButton(false)}
          onPause={() => {
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              setShowPlayButton(true);
            }
          }}
        />
        {showPlayButton && state === PageState.ACTIVE && (
          <PlayButton onClick={handlePlayButtonClick} />
        )}
      </div>

      {state === PageState.INIT && (
        <div className={styles.overlayState}>
          <LoadingState
            icon={statusIcon}
            text={statusText}
            detail={statusDetail}
          />
          <div className={styles.waitingActions}>
            <div className={styles.qrSection}>
              <div className={styles.qrTitle}>扫码成为发送方</div>
              {qrCodeUrl ? (
                <div className={styles.qrCodeContainer}>
                  <img
                    src={qrCodeUrl}
                    alt="发送方二维码"
                    className={styles.qrCode}
                  />
                </div>
              ) : (
                <div className={styles.qrCodePlaceholder}>生成二维码中...</div>
              )}
              <div className={styles.qrHint}>使用手机扫描二维码成为发送方</div>
            </div>
            <button
              onClick={() => {
                cleanup();
                navigate({ to: "/" });
              }}
              className={styles.cancelBtn}
            >
              取消等待
            </button>
          </div>
        </div>
      )}

      {state === PageState.ERROR && (
        <div className={styles.overlayState}>
          <ErrorState
            errorMessage={errorDetail}
            onRetry={retry}
            showBackButton={true}
          />
        </div>
      )}

      {state === PageState.ACTIVE && (
        <div
          ref={controlPanelRef}
          className={`${styles.controlPanel} ${
            isPanelExpanded ? styles.expanded : ""
          }`}
        >
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
                {isFullscreen ? "退出全屏" : "全屏"}
              </button>
              <button onClick={toggleMute} className={styles.controlBtn}>
                {isMuted ? "取消静音" : "静音"}
              </button>
              <button
                onClick={stopViewing}
                className={`${styles.controlBtn} ${styles.stop}`}
              >
                停止接收
              </button>
              <BackButton />
            </div>
          </div>
        </div>
      )}

      {showWaitingDialog && (
        <dialog
          ref={waitingDialogRef}
          className={styles.waitingDialog}
          open={showWaitingDialog}
        >
          <div className={styles.dialogContent}>
            <div className={styles.statusIcon}>⏳</div>
            <div className={styles.statusText}>发送方已离开</div>
            <div className={styles.statusDetail}>正在等待新的发送方加入...</div>
            <button
              onClick={cancelWaitingForSender}
              className={styles.cancelBtn}
            >
              取消等待
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
