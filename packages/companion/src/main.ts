import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
  type Rectangle,
} from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchCompanionSnapshot } from "./client.js";
import { resolveCompanionEndpoint } from "./endpoint.js";
import { deriveCompanionViewModel, type CompanionViewModel } from "./state.js";

const POLL_INTERVAL_MS = 2_000;
const WINDOW_MARGIN = 16;
const COMPACT_SIZE = { width: 360, height: 112 };
const EXPANDED_SIZE = { width: 420, height: 480 };
const outputDirectory = dirname(fileURLToPath(import.meta.url));
const endpoint = resolveCompanionEndpoint();

let companionWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let pollTimer: NodeJS.Timeout | undefined;
let polling = false;
let quitting = false;
let expanded = false;
let latestViewModel: CompanionViewModel = deriveCompanionViewModel(
  {
    kind: "offline",
    diagnostic: "Checking the local AgentPulse daemon.",
  },
  Date.now(),
);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampBounds(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const maximumX = Math.max(
    workArea.x,
    workArea.x + workArea.width - bounds.width,
  );
  const maximumY = Math.max(
    workArea.y,
    workArea.y + workArea.height - bounds.height,
  );
  return {
    width: bounds.width,
    height: bounds.height,
    x: clamp(bounds.x, workArea.x, maximumX),
    y: clamp(bounds.y, workArea.y, maximumY),
  };
}

function defaultWindowBounds(): Rectangle {
  const workArea = screen.getPrimaryDisplay().workArea;
  return {
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    x: workArea.x + workArea.width - COMPACT_SIZE.width - WINDOW_MARGIN,
    y: workArea.y + workArea.height - COMPACT_SIZE.height - WINDOW_MARGIN,
  };
}

function resizeCompanion(nextExpanded: boolean): void {
  const window = companionWindow;
  if (!window || window.isDestroyed()) {
    return;
  }

  expanded = nextExpanded;
  const current = window.getBounds();
  const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
  const proposed = {
    width: size.width,
    height: size.height,
    x: current.x + current.width - size.width,
    y: current.y + current.height - size.height,
  };
  const workArea = screen.getDisplayMatching(current).workArea;
  window.setBounds(clampBounds(proposed, workArea), true);
}

function showCompanion(): void {
  const window = companionWindow;
  if (!window || window.isDestroyed()) {
    return;
  }
  window.show();
  window.moveTop();
  rebuildTrayMenu();
}

function hideCompanion(): void {
  const window = companionWindow;
  if (!window || window.isDestroyed()) {
    return;
  }
  if (tray) {
    window.hide();
    rebuildTrayMenu();
  } else {
    quitting = true;
    app.quit();
  }
}

function setAlwaysOnTop(alwaysOnTop: boolean): boolean {
  const window = companionWindow;
  if (!window || window.isDestroyed()) {
    return false;
  }
  window.setAlwaysOnTop(alwaysOnTop);
  rebuildTrayMenu();
  return window.isAlwaysOnTop();
}

function rebuildTrayMenu(): void {
  if (!tray) {
    return;
  }

  const windowVisible = companionWindow?.isVisible() ?? false;
  const alwaysOnTop = companionWindow?.isAlwaysOnTop() ?? true;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: windowVisible ? "Hide Companion" : "Show Companion",
        click: () => {
          if (companionWindow?.isVisible()) {
            hideCompanion();
          } else {
            showCompanion();
          }
        },
      },
      {
        label: "Always on Top",
        type: "checkbox",
        checked: alwaysOnTop,
        click: (item) => {
          setAlwaysOnTop(item.checked);
        },
      },
      { type: "separator" },
      {
        label: "Open Dashboard",
        click: () => {
          void openDashboard();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray(): void {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<circle cx="16" cy="16" r="11" fill="none" stroke="#d7e3f4" stroke-width="4"/>',
    '<circle cx="16" cy="16" r="4" fill="#65d6ad"/>',
    "</svg>",
  ].join("");
  const icon = nativeImage
    .createFromDataURL(
      `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    )
    .resize({ width: 16, height: 16 });

  if (icon.isEmpty()) {
    throw new Error("Tray icon could not be created.");
  }
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip("AgentPulse Companion");
  tray.on("click", () => {
    if (companionWindow?.isVisible()) {
      hideCompanion();
    } else {
      showCompanion();
    }
  });
  rebuildTrayMenu();
  companionWindow?.setSkipTaskbar(true);
}

async function openDashboard(): Promise<void> {
  try {
    await shell.openExternal(endpoint.dashboardUrl);
  } catch {
    console.warn("AgentPulse companion could not open the dashboard.");
  }
}

function sendViewModel(): void {
  const window = companionWindow;
  if (!window || window.isDestroyed() || window.webContents.isLoading()) {
    return;
  }
  window.webContents.send("companion:view-model", latestViewModel);
}

async function pollDashboard(): Promise<void> {
  if (polling) {
    return;
  }

  polling = true;
  try {
    const result = await fetchCompanionSnapshot(endpoint);
    latestViewModel = deriveCompanionViewModel(result, Date.now());
    sendViewModel();
  } finally {
    polling = false;
  }
}

function startPolling(): void {
  void pollDashboard();
  pollTimer = setInterval(() => {
    void pollDashboard();
  }, POLL_INTERVAL_MS);
}

function registerIpc(): void {
  ipcMain.handle("companion:get-view-model", () => latestViewModel);
  ipcMain.on("companion:set-expanded", (_event, value: unknown) => {
    if (typeof value === "boolean") {
      resizeCompanion(value);
    }
  });
  ipcMain.on("companion:hide", hideCompanion);
  ipcMain.handle("companion:toggle-always-on-top", () =>
    setAlwaysOnTop(!(companionWindow?.isAlwaysOnTop() ?? true)),
  );
  ipcMain.on("companion:open-dashboard", () => {
    void openDashboard();
  });
  ipcMain.on("companion:quit", () => {
    quitting = true;
    app.quit();
  });
}

function createCompanionWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...defaultWindowBounds(),
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    frame: false,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(outputDirectory, "preload.cjs"),
      sandbox: true,
    },
  });

  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  window.webContents.on("did-finish-load", sendViewModel);
  window.once("ready-to-show", () => {
    window.show();
  });
  window.on("close", (event) => {
    if (!quitting && tray) {
      event.preventDefault();
      window.hide();
      rebuildTrayMenu();
    }
  });
  window.on("closed", () => {
    companionWindow = undefined;
  });
  void window.loadFile(join(outputDirectory, "index.html"));
  return window;
}

for (const issue of endpoint.issues) {
  console.warn(`AgentPulse companion: ${issue}`);
}

app.on("before-quit", () => {
  quitting = true;
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});

app.on("window-all-closed", () => {
  if (!tray) {
    app.quit();
  }
});

app.on("activate", () => {
  if (!companionWindow) {
    companionWindow = createCompanionWindow();
  } else {
    showCompanion();
  }
});

await app.whenReady();
Menu.setApplicationMenu(null);
registerIpc();
companionWindow = createCompanionWindow();
try {
  createTray();
} catch (error) {
  console.warn(
    `AgentPulse companion tray unavailable: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
startPolling();
