(() => {
  const ENABLE_DEBUG_TOPIC_WIDGET = false;
  const WIDGET_ID = "canvas-helper-widget";
  const HEADER_ID = "canvas-helper-header";
  const TITLE_ID = "canvas-helper-title";
  const TOGGLE_ID = "canvas-helper-toggle";
  const BODY_ID = "canvas-helper-body";
  const URL_CHECK_INTERVAL_MS = 1000;

  let activeAssignmentSignature = null;
  let activeRequestId = null;
  let requestCounter = 0;
  let lastRenderedResult = null;
  let feedbackMode = false;
  let widgetMinimized = false;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "assignmentAnalysisResult") {
      return;
    }

    if (!message.requestId || message.requestId !== activeRequestId) {
      return;
    }

    if (!message.ok) {
      setWidgetError(message.error || "Canvas Helper could not analyze this assignment.");
      return;
    }

    lastRenderedResult = message.result;
    setWidgetResults(message.result);
  });

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

  function findAssignmentPdfInfo() {
    const root = getAssignmentRoot();
    if (!root) {
      return {
        url: null,
        name: ""
      };
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
        return {
          url: href,
          name: (link.textContent || "").trim()
        };
      }
    }

    return {
      url: null,
      name: ""
    };
  }

  function getAssignmentTitle() {
    const heading =
      document.querySelector(".assignment-title") ||
      document.querySelector("h1.title") ||
      document.querySelector("h1");

    return heading ? heading.textContent.trim() : "Assignment";
  }

  function getCourseTitle() {
    const candidates = [
      document.querySelector(".ellipsible"),
      document.querySelector(".course-title"),
      document.querySelector("#courseMenuToggle"),
      document.querySelector(".ic-app-course-menu a.active")
    ];

    for (const candidate of candidates) {
      const text = candidate?.textContent?.trim();
      if (text) {
        return text;
      }
    }

    const breadcrumbLinks = Array.from(document.querySelectorAll(".ic-app-crumbs a, .breadcrumbs a"));
    for (const link of breadcrumbLinks) {
      const text = link.textContent?.trim();
      if (text && !/assignments?/i.test(text)) {
        return text;
      }
    }

    return "";
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
      width: "360px",
      maxHeight: "70vh",
      overflow: "auto",
      zIndex: "99999",
      padding: "16px",
      borderRadius: "18px",
      border: "1px solid #d8e4dc",
      background: "linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%)",
      color: "#173226",
      boxShadow: "0 18px 40px rgba(26, 54, 43, 0.14)",
      fontFamily: "\"Segoe UI\", \"Trebuchet MS\", sans-serif"
    });

    const header = document.createElement("div");
    header.id = HEADER_ID;
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      marginBottom: "10px"
    });

    const title = document.createElement("div");
    title.id = TITLE_ID;
    title.textContent = "Canvas Helper";
    Object.assign(title.style, {
      fontSize: "17px",
      fontWeight: "700",
      letterSpacing: "0.01em"
    });

    const toggle = document.createElement("button");
    toggle.id = TOGGLE_ID;
    toggle.type = "button";
    Object.assign(toggle.style, {
      border: "1px solid #cfded3",
      background: "#f4faf6",
      color: "#173226",
      borderRadius: "10px",
      padding: "4px 9px",
      fontSize: "12px",
      fontWeight: "700",
      cursor: "pointer",
      flex: "0 0 auto"
    });
    toggle.addEventListener("click", () => {
      widgetMinimized = !widgetMinimized;
      applyMinimizedState();
    });

    const body = document.createElement("div");
    body.id = BODY_ID;
    Object.assign(body.style, {
      fontSize: "13px",
      lineHeight: "1.5"
    });

    header.appendChild(title);
    header.appendChild(toggle);
    widget.appendChild(header);
    widget.appendChild(body);
    document.body.appendChild(widget);
    applyMinimizedState();
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
    lastRenderedResult = null;
    feedbackMode = false;

    title.textContent = "Canvas Helper";
    body.innerHTML = [
      renderStatusHero("working", "Searching your course resources", "I am checking this assignment and comparing it to course materials."),
      `<div style="margin-top:12px; padding:12px; border:1px solid #dce9df; border-radius:14px; background:#ffffff;"><div style="font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:#5a7868; margin-bottom:4px;">Assignment</div><div style="font-weight:700; color:#173226;">${escapeHtml(details.assignmentTitle)}</div></div>`,
      details.assignmentPdfUrl
        ? "<div style=\"margin-top:10px; color:#456557;\">Found the assignment PDF. Scanning course files now.</div>"
        : "<div style=\"margin-top:10px; color:#456557;\">No PDF attachment found, so I am using the page content.</div>"
    ].join("");
    applyMinimizedState();
  }

  function setWidgetError(message) {
    ensureWidget();
    const title = document.getElementById(TITLE_ID);
    const body = document.getElementById(BODY_ID);
    lastRenderedResult = null;
    title.textContent = "Canvas Helper";
    body.innerHTML = [
      renderStatusHero("error", "I hit a snag", "x_x"),
      `<div style="margin-top:12px; padding:12px; border:1px solid #f4c7c7; border-radius:14px; background:linear-gradient(180deg, #fff7f7 0%, #fff1f1 100%); color:#7a2e2e;">${escapeHtml(message)}</div>`,
      "<div style=\"margin-top:10px; color:#8b4a4a;\">Try reloading the page or reopening the extension after the current analysis finishes.</div>"
    ].join("");
    applyMinimizedState();
    bindWidgetActions();
  }

  function setWidgetResults(result) {
    ensureWidget();
    const title = document.getElementById(TITLE_ID);
    const body = document.getElementById(BODY_ID);

    title.textContent = "Relevant Resources";

    if (!result.relevantFiles.length) {
      body.innerHTML = [
        renderStatusHero("empty", "No strong matches yet", "I checked the course files, but nothing stood out as clearly relevant."),
        `<div style="margin-top:12px; padding:12px; border:1px solid #eadfcb; border-radius:14px; background:#fffdf8; color:#6f5a2c;">Scanned ${result.scannedFileCount} files.</div>`,
        renderFeedbackControls(result),
        renderDebugMarkup(result.debug)
      ].join("");
      applyMinimizedState();
      bindWidgetActions();
      return;
    }

    const items = result.relevantFiles
      .map((file) => {
        const scoreLabel = file.score.toFixed(2);
        const primaryMatch = getPrimaryMatchLabel(file.reason);
        return [
          "<li style=\"margin-bottom:10px; list-style:none; padding:12px; border:1px solid #dce9df; border-radius:14px; background:#ffffff; box-shadow:0 4px 12px rgba(23, 50, 38, 0.05);\">",
          "<div style=\"display:flex; align-items:flex-start; gap:10px;\">",
          "<div style=\"flex:0 0 auto; width:24px; height:24px; border-radius:999px; background:#e8f6ec; color:#18794e; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700;\">&#10003;</div>",
          "<div style=\"flex:1 1 auto; min-width:0;\">",
          `<a href="${escapeAttribute(file.url)}" target="_blank" rel="noopener noreferrer" style="color:#173226; font-weight:700; text-decoration:none; word-break:break-word;">${escapeHtml(file.name)}</a>`,
          primaryMatch
            ? `<div style="margin-top:4px; display:inline-block; padding:3px 8px; border-radius:999px; background:#eef8f1; color:#1c6b47; font-weight:700; font-size:12px;">${escapeHtml(primaryMatch)}</div>`
            : "",
          feedbackMode
            ? `<div style="margin-top:8px;"><button type="button" data-flag-file="${escapeAttribute(file.url)}" style="border:1px solid #e7c9c9; background:#fff6f6; color:#8a3434; border-radius:999px; padding:5px 10px; font-size:12px; font-weight:600; cursor:pointer;">Mark as not relevant</button></div>`
            : "",
          `<div style="margin-top:8px; color:#3d5b4e; font-weight:600;">Confidence score: ${scoreLabel}</div>`,
          file.reason ? `<div style="margin-top:4px; color:#587465;">${escapeHtml(file.reason)}</div>` : "",
          "</div>",
          "</div>",
          "</li>"
        ].join("");
      })
      .join("");

    body.innerHTML = [
      renderStatusHero("success", "Relevant resources found", "These are the course materials most likely to help with this assignment."),
      `<div style="margin-top:12px; padding:12px; border:1px solid #dce9df; border-radius:14px; background:#ffffff; color:#456557;">Scanned <strong>${result.scannedFileCount}</strong> files and found <strong>${result.relevantFiles.length}</strong> likely matches.</div>`,
      "<ul style=\"padding-left:0; margin:12px 0 0;\">",
      items,
      "</ul>",
      renderFeedbackControls(result),
      renderDebugMarkup(result.debug)
    ].join("");
    applyMinimizedState();
    bindWidgetActions();
  }

  function applyMinimizedState() {
    const toggle = document.getElementById(TOGGLE_ID);
    const body = document.getElementById(BODY_ID);
    const header = document.getElementById(HEADER_ID);

    if (!toggle || !body || !header) {
      return;
    }

    toggle.textContent = widgetMinimized ? "Expand" : "Minimize";
    body.style.display = widgetMinimized ? "none" : "block";
    header.style.marginBottom = widgetMinimized ? "0" : "10px";
  }

  function renderFeedbackControls(result) {
    const keywords = Array.isArray(result?.debug?.topKeywords) ? result.debug.topKeywords : [];
    const keywordMarkup = keywords.length
      ? keywords
        .map((keyword) => {
          const button = feedbackMode
            ? ` <button type="button" data-flag-keyword="${escapeAttribute(keyword)}" style="border:1px solid #e7c9c9; background:#fff6f6; color:#8a3434; border-radius:999px; padding:3px 8px; font-size:11px; font-weight:600; cursor:pointer;">Not relevant</button>`
            : "";
          return `<div style="margin-top:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid #e5efe8; border-radius:12px; background:#ffffff;"><span style="color:#264436;">${escapeHtml(keyword)}</span>${button}</div>`;
        })
        .join("")
      : "<div style=\"margin-top:6px; color:#64748b;\">No keywords extracted.</div>";

    return [
      "<div style=\"margin-top:14px; padding:12px; border:1px solid #dce9df; border-radius:16px; background:linear-gradient(180deg, #ffffff 0%, #f9fcfa 100%);\">",
      `<button type="button" data-feedback-toggle="1" style="width:100%; border:1px solid ${feedbackMode ? "#bfd7c6" : "#cfded3"}; background:${feedbackMode ? "#eaf6ee" : "#f4faf6"}; color:#173226; border-radius:12px; padding:10px 12px; font-size:12px; font-weight:700; cursor:pointer;">${feedbackMode ? "Done improving" : "Help improve the algorithm"}</button>`,
      feedbackMode
        ? "<div style=\"margin-top:8px; color:#456557; font-size:12px;\">Mark anything that is not actually helpful. I will remember those signals next time.</div>"
        : "",
      `<div style="margin-top:10px; font-size:12px;"><div style="font-weight:700; color:#173226; margin-bottom:6px;">Detected keywords</div>${keywordMarkup}</div>`,
      "</div>"
    ].join("");
  }

  function renderStatusHero(state, title, subtitle) {
    const themes = {
      working: {
        icon: "&hellip;",
        iconBg: "#eaf4ff",
        iconColor: "#275ea3",
        border: "#d9e7fb",
        background: "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)",
        title: "#1f4f8c",
        subtitle: "#4c6f98"
      },
      success: {
        icon: "&#10003;",
        iconBg: "#e8f6ec",
        iconColor: "#18794e",
        border: "#d7eedd",
        background: "linear-gradient(180deg, #f6fcf8 0%, #edf9f1 100%)",
        title: "#155c3b",
        subtitle: "#4d6e5f"
      },
      empty: {
        icon: "?",
        iconBg: "#fff3dd",
        iconColor: "#9b6a13",
        border: "#f3e1b8",
        background: "linear-gradient(180deg, #fffdf8 0%, #fff7e8 100%)",
        title: "#8a6115",
        subtitle: "#7b6b47"
      },
      error: {
        icon: "&#10005;",
        iconBg: "#ffe8e8",
        iconColor: "#b23a3a",
        border: "#f4c7c7",
        background: "linear-gradient(180deg, #fff7f7 0%, #fff0f0 100%)",
        title: "#8a2f2f",
        subtitle: "#8b4a4a"
      }
    };

    const theme = themes[state] || themes.working;

    return [
      `<div style="display:flex; gap:12px; align-items:flex-start; padding:14px; border:1px solid ${theme.border}; border-radius:16px; background:${theme.background};">`,
      `<div style="flex:0 0 auto; width:34px; height:34px; border-radius:12px; background:${theme.iconBg}; color:${theme.iconColor}; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800;">${theme.icon}</div>`,
      "<div style=\"flex:1 1 auto;\">",
      `<div style="font-weight:800; color:${theme.title};">${escapeHtml(title)}</div>`,
      `<div style="margin-top:3px; color:${theme.subtitle};">${escapeHtml(subtitle)}</div>`,
      "</div>",
      "</div>"
    ].join("");
  }

  function bindWidgetActions() {
    const body = document.getElementById(BODY_ID);
    if (!body) {
      return;
    }

    body.onclick = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const toggle = target.closest("[data-feedback-toggle]");
      if (toggle) {
        feedbackMode = !feedbackMode;
        if (lastRenderedResult) {
          setWidgetResults(lastRenderedResult);
        }
        return;
      }

      const fileButton = target.closest("[data-flag-file]");
      if (fileButton) {
        const url = fileButton.getAttribute("data-flag-file") || "";
        flagIrrelevantFile(url);
        return;
      }

      const keywordButton = target.closest("[data-flag-keyword]");
      if (keywordButton) {
        const keyword = keywordButton.getAttribute("data-flag-keyword") || "";
        flagIrrelevantKeyword(keyword);
      }
    };
  }

  function flagIrrelevantFile(url) {
    if (!lastRenderedResult || !url) {
      return;
    }

    const file = (lastRenderedResult.relevantFiles || []).find((entry) => entry.url === url);
    if (!file) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "saveAlgorithmFeedback",
      payload: {
        irrelevantFile: {
          url: file.url,
          name: file.name
        }
      }
    });

    lastRenderedResult = {
      ...lastRenderedResult,
      relevantFiles: (lastRenderedResult.relevantFiles || []).filter((entry) => entry.url !== url)
    };
    setWidgetResults(lastRenderedResult);
  }

  function flagIrrelevantKeyword(keyword) {
    if (!lastRenderedResult || !keyword) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "saveAlgorithmFeedback",
      payload: {
        irrelevantKeyword: keyword
      }
    });

    const nextKeywords = ((lastRenderedResult.debug && lastRenderedResult.debug.topKeywords) || [])
      .filter((entry) => entry !== keyword);
    lastRenderedResult = {
      ...lastRenderedResult,
      debug: {
        ...(lastRenderedResult.debug || {}),
        topKeywords: nextKeywords
      }
    };
    setWidgetResults(lastRenderedResult);
  }

  function getPrimaryMatchLabel(reason) {
    if (!reason) {
      return "";
    }

    const parts = reason
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      return "";
    }

    const preferredPrefixes = [
      "Reference match:",
      "Header Specific topic match:",
      "Header Derived Specific topic match:",
      "Header Domain topic match:",
      "Specific topic match:",
      "Derived Specific topic match:",
      "Domain topic match:"
    ];

    for (const prefix of preferredPrefixes) {
      const match = parts.find((part) => part.startsWith(prefix));
      if (match) {
        return match;
      }
    }

    return parts[0];
  }

  function renderDebugMarkup(debug) {
    if (!ENABLE_DEBUG_TOPIC_WIDGET) {
      return "";
    }

    if (!debug) {
      return [
        "<div style=\"margin-top:12px; padding-top:10px; border-top:1px dashed #cbd5e1;\">",
        "<div style=\"font-weight:700; margin-bottom:6px;\">Topic Debug</div>",
        "<div>No debug data.</div>",
        "</div>"
      ].join("");
    }

    const chapterLine = debug.chapters.length
      ? `Chapters: ${debug.chapters.join(", ")}`
      : "Chapters: none";
    const keywordLine = debug.topKeywords.length
      ? `Top keywords: ${debug.topKeywords.join(", ")}`
      : "Top keywords: none";
    const extractionLine = [
      `pdf.js loaded: ${debug.pdfJsAvailable ? "yes" : "no"}`,
      `Assignment text chars: ${debug.assignmentTextLength || 0}`,
      `Assignment PDF parsed: ${debug.assignmentPdfParsed ? "yes" : "no"}`,
      `Assignment PDF fallback: ${debug.assignmentPdfFallbackUsed ? "yes" : "no"}`,
      `Assignment PDF chars: ${debug.assignmentPdfTextLength || 0}`,
      `Assignment PDF headers: ${debug.assignmentPdfHeaderTextLength || 0}`,
      `Ignored keywords: ${debug.ignoredKeywordCount || 0}`,
      `Ignored files: ${debug.ignoredFileCount || 0}`,
      `Files with extracted text: ${debug.filesWithExtractedText || 0}`,
      `Files using filename fallback: ${debug.filesUsingFilenameFallback || 0}`,
      `Deep-read files: ${debug.deepReadFiles || 0}`
    ].join(" | ");
    const levels = debug.topicHierarchy
      .map((level) => {
        const topics = level.topics.length ? level.topics.join(", ") : "none";
        return `<div><strong>${escapeHtml(level.label)}:</strong> ${escapeHtml(topics)}</div>`;
      })
      .join("");
    const assignmentPdfDebug = renderRequestDebug("Assignment PDF", debug.assignmentPdfDebug);
    const samples = (debug.fileExtractionSamples || [])
      .map((sample) => {
        const suffix = [
          `${sample.textLength} chars`,
          `raw ${sample.extractedTextLength || 0}`,
          `headers ${sample.headerTextLength || 0}`,
          sample.attemptedDeepRead ? "deep-read" : "skipped",
          sample.filenameFallbackUsed ? "fallback" : "direct"
        ].join(", ");
        const detail = renderRequestDebug(sample.name, sample.debug);
        return [
          `<div>${escapeHtml(sample.name)} (${escapeHtml(suffix)})</div>`,
          detail ? `<div style="margin-left:8px; color:#475569;">${detail}</div>` : ""
        ].join("");
      })
      .join("");

    return [
      "<div style=\"margin-top:12px; padding-top:10px; border-top:1px dashed #cbd5e1; font-size:12px; line-height:1.45;\">",
      "<div style=\"font-weight:700; margin-bottom:6px; color:#0f172a;\">Topic Debug</div>",
      `<div>${escapeHtml(chapterLine)}</div>`,
      `<div style="margin:4px 0;">${escapeHtml(keywordLine)}</div>`,
      `<div style="margin:4px 0; color:#475569;">${escapeHtml(extractionLine)}</div>`,
      levels || "<div>No inferred topics.</div>",
      assignmentPdfDebug
        ? `<div style="margin-top:6px;"><strong>Assignment fetch:</strong><div style="margin-left:8px; color:#475569;">${assignmentPdfDebug}</div></div>`
        : "",
      samples
        ? `<div style="margin-top:6px;"><strong>File text samples:</strong>${samples}</div>`
        : "",
      "</div>"
    ].join("");
  }

  function renderRequestDebug(label, debug) {
    if (!debug) {
      return "";
    }

    const parts = [];

    if (debug.status) {
      parts.push(`status ${debug.status}`);
    }

    if (debug.contentType) {
      parts.push(`type ${debug.contentType}`);
    }

    if (typeof debug.byteLength === "number") {
      parts.push(`bytes ${debug.byteLength}`);
    }

    if (typeof debug.extractedTextLength === "number") {
      parts.push(`text ${debug.extractedTextLength}`);
    }

    if (typeof debug.headerTextLength === "number") {
      parts.push(`headers ${debug.headerTextLength}`);
    }

    if (debug.extractedBy) {
      parts.push(`via ${debug.extractedBy}`);
    }

    if (debug.note) {
      parts.push(debug.note);
    }

    if (typeof debug.looksLikePdf === "boolean") {
      parts.push(debug.looksLikePdf ? "pdf-like" : "not-pdf-like");
    }

    if (debug.error) {
      parts.push(`error ${debug.error}`);
    }

    const urlPart = debug.finalUrl || debug.requestedUrl || "";
    const compactUrl = urlPart.length > 120 ? `${urlPart.slice(0, 117)}...` : urlPart;

    return [
      escapeHtml(parts.join(" | ")),
      compactUrl ? `<div>${escapeHtml(compactUrl)}</div>` : ""
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

    const assignmentPdf = findAssignmentPdfInfo();
    const payload = {
      courseTitle: getCourseTitle(),
      assignmentUrl: window.location.href,
      assignmentTitle: getAssignmentTitle(),
      assignmentText: getAssignmentText(),
      assignmentPdfUrl: assignmentPdf.url,
      assignmentPdfName: assignmentPdf.name,
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
    activeRequestId = `assignment-${Date.now()}-${requestCounter++}`;

    setWidgetLoading(payload);

    chrome.runtime.sendMessage(
      {
        type: "analyzeAssignment",
        requestId: activeRequestId,
        payload
      },
      () => {
        if (chrome.runtime.lastError) {
          setWidgetError(`Canvas Helper failed: ${chrome.runtime.lastError.message}`);
        }
      }
    );
  }

  function syncPageState() {
    startAnalysisIfNeeded();
  }

  window.setInterval(syncPageState, URL_CHECK_INTERVAL_MS);
  startAnalysisIfNeeded();
})();
