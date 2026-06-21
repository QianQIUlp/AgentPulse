import type { CompanionSessionView, CompanionViewModel } from "./state.js";

let expanded = false;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing companion element: ${id}`);
  }
  return element as T;
}

function setText(id: string, value: string): void {
  byId(id).textContent = value;
}

function renderMostImportant(session?: CompanionSessionView): void {
  if (!session) {
    setText("primary-session", "No current sessions");
    return;
  }
  setText("primary-session", `${session.source} · ${session.title}`);
}

function createSessionRow(session: CompanionSessionView): HTMLElement {
  const row = document.createElement("article");
  row.className = `session-row tone-${session.tone}`;

  const header = document.createElement("div");
  header.className = "session-row-header";
  const source = document.createElement("strong");
  source.textContent = session.source;
  const status = document.createElement("span");
  status.className = "session-status";
  status.textContent = session.statusLabel;
  header.append(source, status);

  const title = document.createElement("p");
  title.className = "session-title";
  title.textContent = session.title;

  const metadata = document.createElement("p");
  metadata.className = "session-meta";
  metadata.textContent = `${session.surface} · ${session.activity} · ${session.lastEventLabel}`;

  row.append(header, title, metadata);
  if (session.diagnosticHint) {
    const diagnostic = document.createElement("p");
    diagnostic.className = "session-diagnostic";
    diagnostic.textContent = session.diagnosticHint;
    row.append(diagnostic);
  }

  return row;
}

function render(viewModel: CompanionViewModel): void {
  document.body.dataset.state = viewModel.state;
  setText("summary", viewModel.summary);
  setText("running-count", String(viewModel.counts.running));
  setText("action-count", String(viewModel.counts.action));
  setText("failed-count", String(viewModel.counts.failed));
  renderMostImportant(viewModel.mostImportant);

  const diagnostic = byId("diagnostic");
  diagnostic.textContent = viewModel.diagnostic ?? "";
  diagnostic.hidden = !viewModel.diagnostic;

  const sessionList = byId("session-list");
  sessionList.replaceChildren(
    ...viewModel.sessions.map((session) => createSessionRow(session)),
  );
  byId("empty-sessions").hidden = viewModel.sessions.length !== 0;
}

function setExpanded(nextExpanded: boolean): void {
  expanded = nextExpanded;
  document.body.classList.toggle("expanded", expanded);
  const button = byId<HTMLButtonElement>("expand");
  button.textContent = expanded ? "−" : "+";
  button.setAttribute("aria-label", expanded ? "Collapse" : "Expand");
  button.setAttribute("aria-expanded", String(expanded));
  window.agentPulse.setExpanded(expanded);
}

byId("expand").addEventListener("click", () => {
  setExpanded(!expanded);
});
byId("hide").addEventListener("click", () => {
  window.agentPulse.hide();
});
byId("always-on-top").addEventListener("click", async () => {
  const enabled = await window.agentPulse.toggleAlwaysOnTop();
  const button = byId<HTMLButtonElement>("always-on-top");
  button.setAttribute("aria-pressed", String(enabled));
  button.textContent = enabled ? "Pinned" : "Pin";
});
byId("open-dashboard").addEventListener("click", () => {
  window.agentPulse.openDashboard();
});
byId("quit").addEventListener("click", () => {
  window.agentPulse.quit();
});

window.agentPulse.onViewModel(render);
void window.agentPulse.getViewModel().then(render);
