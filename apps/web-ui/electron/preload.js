const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gateDesktop", {
  notifyPermissionRequest: (payload) => ipcRenderer.invoke("notifications:permission", payload),
  notifyClaudeIdlePrompt: (payload) => ipcRenderer.invoke("notifications:idle", payload),
  onNotificationDecision: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, data) => {
      if (
        data &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, "requestId") &&
        Object.prototype.hasOwnProperty.call(data, "decision") &&
        typeof data.requestId === "string" &&
        (data.decision === "allow" || data.decision === "deny")
      ) {
        callback({ requestId: data.requestId, decision: data.decision });
      }
    };

    ipcRenderer.on("notifications:decision", listener);

    return () => {
      ipcRenderer.removeListener("notifications:decision", listener);
    };
  },
});
