(() => {
  const WIDGET_ID = "canvas-helper-widget";
  const TITLE_ID = "canvas-helper-title";
  const BODY_ID = "canvas-helper-body";
  const URL_CHECK_INTERVAL_MS = 1000;

  let activeAssignmentSignature = null;

  function parseAssignmentLocation(url) {
    const match = url.match(/\/courses\/(\d+)\/assignments\/(\d+)/);
    if (!match) {
      return null;
    }

    return {
      courseId: match[1],
      assignmentId: match[2]
    };
  }

  function getAssignmentRoot() {
    return (
      document.querySelector("#assignment_show .description") ||
      document.querySelector(".assignment-description") ||
      document.querySelector("#content")
    );
  }

  function findAssignmentPdfUrl() {
    const root = getAssignmentRoot();
    if (!root) {
      return null;
    }

    const links = Array.from(root.querySelectorAll("a[href]"));

    for (const link of links) {
      const href = link.href || "";
      const text = (link.textContent || "").trim().toLowerCase();
      if (
        href.toLowerCase().includes(".pdf") ||
        text.endsWith(".pdf") ||
        (href.includes("/files/") && text.includes("pdf"))
      ) {
        return href;
      }
    }

    return null;
  }

  function getAssignmentTitle() {
    const heading =
      document.querySelector(".assignment-title") ||
      document.querySelector("h1.title") ||
      document.querySelector("h1");

    return heading ? heading.textContent.trim() : "Assignment";
  }

  function getAssignmentText() {
    const root = getAssignmentRoot();
    if (!root) {
      return "";
    }

    return root.innerText.trim();
  }

  function ensureWidget() {
    let widget = document.getElementById(WIDGET_ID);
    if (widget) {
      return widget;
    }

    widget = document.createElement("section");
    widget.id = WIDGET_ID;
    widget.setAttribute("role", "status");
    widget.setAttribute("aria-live", "polite");

    Object.assign(widget.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      width: "320px",
      maxHeight: "70vh",
      overflow: "auto",
      zIndex: "99999",
      padding: "14px",
      borderRadius: "12px",
      border: "1px solid #d0d7e2",
      background: "#ffffff",
      color: "#1f2937",
      boxShadow: "0 10px 25px rgba(15, 23, 42, 0.16)",
      fontFamily: "Arial, sans-serif"
    });

    const title = document.createElement("div");
    title.id = TITLE_ID;
    title.textContent = "Canvas Helper";
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "700",
      marginBottom: "8px"
    });

    const body = document.createElement("div");
    body.id = BODY_ID;
    Object.assign(body.style, {
      fontSize: "13px",
      lineHeight: "1.5"
    });

    widget.appendChild(title);
    widget.appendChild(body);
    document.body.appendChild(widget);
    return widget;
  }

  function removeWidget() {
    const widget = document.getElementById(WIDGET_ID);
    if (widget) {
      widget.remove();
    }
  }

  function setWidgetLoading(details) {
    ensureWidget();
    const title = document.getElementById(TITLE_ID);
    const body = document.getElementById(BODY_ID);

    title.textContent = "Canvas Helper";
    body.innerHTML = [
      `<strong>${escapeHtml(details.assignmentTitle)}</strong>`,
      "<div>Analyzing assignment resources...</div>",
      details.assignmentPdfUrl
        ? "<div>Found assignment PDF. Scanning course files.</div>"
        : "<div>No PDF attachment found. Using page content.</div>"
    ].join("");
  }

  function setWidgetError(message) {
    ensureWidget();
    const body = document.getElementById(BODY_ID);
    body.innerHTML = `<div>${escapeHtml(message)}</div>`;
  }

  function setWidgetResults(result) {
    ensureWidget();
    const title = document.getElementById(TITLE_ID);
    const body = document.getElementById(BODY_ID);

    title.textContent = "Relevant Course Files";

    if (!result.relevantFiles.length) {
      body.innerHTML = [
        "<div>No clearly relevant files were found.</div>",
        `<div>Scanned ${result.scannedFileCount} files.</div>`
      ].join("");
      return;
    }

    const items = result.relevantFiles
      .map((file) => {
        const scoreLabel = file.score.toFixed(2);
        return [
          "<li style=\"margin-bottom:8px;\">",
          `<a href="${escapeAttribute(file.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.name)}</a>`,
          `<div style="color:#475569;">Match score: ${scoreLabel}</div>`,
          file.reason ? `<div style="color:#64748b;">${escapeHtml(file.reason)}</div>` : "",
          "</li>"
        ].join("");
      })
      .join("");

    body.innerHTML = [
      `<div>Scanned ${result.scannedFileCount} files and found ${result.relevantFiles.length} likely matches.</div>`,
      "<ul style=\"padding-left:18px; margin:10px 0 0;\">",
      items,
      "</ul>"
    ].join("");
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function startAnalysisIfNeeded() {
    const assignment = parseAssignmentLocation(window.location.href);

    if (!assignment) {
      activeAssignmentSignature = null;
      removeWidget();
      return;
    }

    const payload = {
      assignmentUrl: window.location.href,
      assignmentTitle: getAssignmentTitle(),
      assignmentText: getAssignmentText(),
      assignmentPdfUrl: findAssignmentPdfUrl(),
      courseId: assignment.courseId
    };
    const assignmentSignature = [
      assignment.courseId,
      assignment.assignmentId,
      payload.assignmentTitle,
      payload.assignmentPdfUrl || "",
      payload.assignmentText.slice(0, 200)
    ].join("|");

    if (assignmentSignature === activeAssignmentSignature) {
      return;
    }

    activeAssignmentSignature = assignmentSignature;

    setWidgetLoading(payload);

    chrome.runtime.sendMessage(
      {
        type: "analyzeAssignment",
        payload
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setWidgetError(`Canvas Helper failed: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (!response || !response.ok) {
          setWidgetError(response?.error || "Canvas Helper could not analyze this assignment.");
          return;
        }

        if (activeAssignmentSignature !== assignmentSignature) {
          return;
        }

        setWidgetResults(response.result);
      }
    );
  }

  function syncPageState() {
    startAnalysisIfNeeded();
  }

  window.setInterval(syncPageState, URL_CHECK_INTERVAL_MS);
  startAnalysisIfNeeded();
})();
