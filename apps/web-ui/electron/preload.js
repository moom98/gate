const { contextBridge, ipcRenderer } = require("electron");

function validateNotificationPayload(payload) {
  if (payload === undefined || payload === null) {
    throw new TypeError("Notification payload must not be null or undefined");
  }

  const type = typeof payload;
  if (type === "function" || type === "symbol" || type === "bigint") {
    throw new TypeError("Invalid notification payload type");
  }

  if (type !== "object") {
    throw new TypeError("Notification payload must be an object");
  }

  return payload;
}

contextBridge.exposeInMainWorld("gateDesktop", {
  notifyPermissionRequest: (payload) =>
    ipcRenderer.invoke("notifications:permission", validateNotificationPayload(payload)),
  notifyClaudeIdlePrompt: (payload) =>
    ipcRenderer.invoke("notifications:idle", validateNotificationPayload(payload)),
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
