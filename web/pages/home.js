// 首页逻辑
import { StateManager } from "../utils/state-manager.js";
import { ErrorHandler } from "../utils/state-manager.js";

class HomePage {
  constructor() {
    this.stateManager = new StateManager();
    this.roomInput = document.getElementById("roomInput");
    this.senderBtn = document.getElementById("senderBtn");
    this.receiverBtn = document.getElementById("receiverBtn");
    this.errorMsg = document.getElementById("errorMsg");

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupStateHandlers();
  }

  bindEvents() {
    this.senderBtn.addEventListener("click", () => {
      this.navigateToSender();
    });

    this.receiverBtn.addEventListener("click", () => {
      this.navigateToViewer();
    });

    // 回车键支持
    this.roomInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.navigateToSender();
      }
    });
  }

  setupStateHandlers() {
    this.stateManager.onState(StateManager.STATES.ERROR, (data) => {
      this.showError(data.message);
    });
  }

  navigateToSender() {
    const room = this.roomInput.value.trim() || "demo";
    if (this.validateRoom(room)) {
      window.location.href = `pages/sender.html?room=${encodeURIComponent(
        room
      )}`;
    }
  }

  navigateToViewer() {
    const room = this.roomInput.value.trim() || "demo";
    if (this.validateRoom(room)) {
      window.location.href = `pages/viewer.html?room=${encodeURIComponent(
        room
      )}`;
    }
  }

  validateRoom(room) {
    if (!room) {
      this.showError("请输入房间号");
      return false;
    }

    if (room.length < 2 || room.length > 20) {
      this.showError("房间号长度应在2-20个字符之间");
      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(room)) {
      this.showError("房间号只能包含字母、数字、下划线和连字符");
      return false;
    }

    return true;
  }

  showError(message) {
    this.errorMsg.textContent = message;
    this.errorMsg.style.display = "block";

    // 3秒后自动隐藏错误信息
    setTimeout(() => {
      this.hideError();
    }, 3000);
  }

  hideError() {
    this.errorMsg.style.display = "none";
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  new HomePage();
});
