const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("node:path");

const DEFAULT_DEV_SERVER_URL = "http://localhost:3001";

function getDevServerUrl() {
  const envUrl = process.env.GATE_WEB_UI_DEV_URL;
  if (!envUrl) {
    return DEFAULT_DEV_SERVER_URL;
  }

  try {
    const parsed = new URL(envUrl);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (isLocalhost && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
      return parsed.toString();
    }

    console.warn(`[Electron] Ignoring untrusted dev server URL: ${envUrl}`);
  } catch (error) {
    console.warn(`[Electron] Invalid GATE_WEB_UI_DEV_URL: ${envUrl}`, error);
  }

  return DEFAULT_DEV_SERVER_URL;
}

const DEV_SERVER_URL = getDevServerUrl();

function resolveDistPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "..", "out");
  }
  return path.join(process.resourcesPath, "app", "out");
}

function isTrustedExternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function loadWindowContents(mainWindow) {
  if (!app.isPackaged) {
    await mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    const distPath = resolveDistPath();
    await mainWindow.loadFile(path.join(distPath, "index.html"));
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "Gate Desktop",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
    await loadWindowContents(mainWindow);
  } catch (error) {
    console.error("[Electron] Failed to load Gate UI:", error);
    const message = app.isPackaged
      ? "Failed to load the local Gate UI. Please reinstall or rebuild Gate Desktop."
      : `Failed to load the development server at ${DEV_SERVER_URL}. Is it running?`;
    dialog.showErrorBox("Gate Desktop Error", message);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedExternalUrl(url)) {
      console.warn(`[Electron] Blocked untrusted URL: ${url}`);
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });
}

function handleWindowCreationError(error) {
  console.error("[Electron] Failed to create window:", error);
  dialog.showErrorBox("Gate Desktop Error", "An unexpected error occurred while creating the application window.");
}

app.whenReady().then(() => {
  createWindow().catch(handleWindowCreationError);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(handleWindowCreationError);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
