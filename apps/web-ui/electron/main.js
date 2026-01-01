const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const DEV_SERVER_URL = process.env.GATE_WEB_UI_DEV_URL || "http://localhost:3001";

function resolveDistPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", "out");
  }
  return path.join(process.resourcesPath, "app", "out");
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "Gate Desktop",
    webPreferences: {
      sandbox: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    const distPath = resolveDistPath();
    mainWindow.loadFile(path.join(distPath, "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
