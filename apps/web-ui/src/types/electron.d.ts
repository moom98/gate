declare global {
  interface Window {
    gateDesktop?: {
      notifyPermissionRequest: (payload: {
        requestId: string;
        summary: string;
        command: string;
        cwd: string;
      }) => Promise<boolean>;
      notifyClaudeIdlePrompt: (payload: { project?: string }) => Promise<boolean>;
      onNotificationDecision: (
        callback: (data: { requestId: string; decision: "allow" | "deny" }) => void
      ) => () => void;
    };
  }
}

export {};
