let pdfjsLib = null;

try {
  importScripts("vendor/pdf.legacy.js");
  if (typeof globalThis.pdfjsLib !== "undefined") {
    pdfjsLib = globalThis.pdfjsLib;
  }
} catch (_error) {
  try {
    importScripts("vendor/pdf.js");
    if (typeof globalThis.pdfjsLib !== "undefined") {
      pdfjsLib = globalThis.pdfjsLib;
    }
  } catch (_innerError) {
    pdfjsLib = null;
  }
}

const STOP_WORDS = new Set([
  "action",
  "actions",
  "about",
  "after",
  "again",
  "also",
  "answer",
  "answers",
  "because",
  "before",
  "between",
  "could",
  "denote",
  "every",
  "from",
  "have",
  "homework",
  "into",
  "just",
  "more",
  "problem",
  "problems",
  "question",
  "questions",
  "should",
  "smok",
  "some",
  "such",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "through",
  "under",
  "using",
  "with",
  "your"
]);

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "tex",
  "latex",
  "bib",
  "html",
  "htm",
  "js",
  "ts",
  "tsx",
  "jsx",
  "css",
  "py",
  "java",
  "c",
  "cpp",
  "h"
]);

const MAX_FILES_TO_ANALYZE = 40;
const MAX_DEEP_READ_FILES = 4;
const FILE_READ_TIMEOUT_MS = 8000;
const ANALYSIS_TIMEOUT_MS = 20000;
const PDF_RAW_SCAN_CHAR_LIMIT = 250000;
const PDF_STREAM_SCAN_LIMIT = 12;
const PDF_STREAM_BYTE_LIMIT = 750000;
const MIN_USEFUL_PDF_TEXT_CHARS = 120;
const MIN_USEFUL_FILE_TEXT_CHARS = 80;
const PDF_JS_PAGE_LIMIT = 6;
const ALGORITHM_FEEDBACK_KEY = "algorithmFeedback";

const SPECIFIC_TOPIC_CATALOG = [
  { label: "integrals", terms: ["integral", "integrals", "integration", "antiderivative"] },
  { label: "derivatives", terms: ["derivative", "derivatives", "differentiate", "differentiation"] },
  { label: "limits", terms: ["limit", "limits", "continuity"] },
  { label: "series", terms: ["series", "sequence", "taylor", "maclaurin", "convergence"] },
  { label: "matrices", terms: ["matrix", "matrices", "determinant", "eigenvalue", "eigenvector"] },
  { label: "vectors", terms: ["vector", "vectors", "dot product", "cross product"] },
  { label: "probability", terms: ["probability", "probabilities", "random variable", "expected value"] },
  { label: "distributions", terms: ["distribution", "normal distribution", "binomial", "poisson"] },
  { label: "point estimation", terms: ["estimator", "estimators", "estimate", "point estimate", "point estimation", "standard error", "bias", "unbiased"] },
  { label: "sampling distributions", terms: ["sampling distribution", "sampling distributions", "standard error", "sample mean", "sample proportion"] },
  { label: "hypothesis testing", terms: ["hypothesis test", "p-value", "null hypothesis", "alternative hypothesis"] },
  { label: "regression", terms: ["regression", "linear regression", "residual", "least squares"] },
  { label: "correlation", terms: ["correlation", "covariance", "pearson", "spearman"] },
  { label: "sampling", terms: ["sampling", "sample mean", "sample size", "confidence interval"] },
  { label: "algorithms", terms: ["algorithm", "algorithms", "runtime", "complexity", "big o"] },
  { label: "data structures", terms: ["array", "linked list", "stack", "queue", "tree", "graph"] },
  { label: "recursion", terms: ["recursion", "recursive", "base case"] },
  { label: "sorting", terms: ["sorting", "quicksort", "mergesort", "heap sort"] },
  { label: "databases", terms: ["database", "sql", "schema", "query", "join"] },
  { label: "networking", terms: ["network", "tcp", "udp", "http", "latency"] },
  { label: "physics mechanics", terms: ["velocity", "acceleration", "force", "newton", "kinematics"] },
  { label: "energy", terms: ["energy", "work", "potential energy", "kinetic energy"] },
  { label: "electricity", terms: ["voltage", "current", "resistance", "circuit", "ohm"] },
  { label: "chemistry stoichiometry", terms: ["mole", "molar", "stoichiometry", "reactant", "product"] },
  { label: "equilibrium", terms: ["equilibrium", "le chatelier", "reaction quotient"] },
  { label: "acid base", terms: ["acid", "base", "ph", "pka", "buffer"] },
  { label: "cell biology", terms: ["cell", "membrane", "organelle", "mitosis", "meiosis"] },
  { label: "genetics", terms: ["gene", "genetics", "allele", "genotype", "phenotype"] },
  { label: "evolution", terms: ["evolution", "selection", "adaptation", "fitness"] },
  { label: "literary analysis", terms: ["thesis", "theme", "symbolism", "character", "motif"] },
  { label: "rhetorical analysis", terms: ["rhetoric", "audience", "ethos", "pathos", "logos"] },
  { label: "historical analysis", terms: ["primary source", "secondary source", "historical context", "periodization"] },
  { label: "microeconomics", terms: ["supply", "demand", "elasticity", "marginal cost"] },
  { label: "macroeconomics", terms: ["gdp", "inflation", "unemployment", "fiscal policy", "monetary policy"] }
];

const DOMAIN_TOPIC_CATALOG = [
  {
    label: "mathematics",
    terms: ["math", "mathematics", "equation", "function", "calculus", "algebra", "geometry"],
    related: ["integrals", "derivatives", "limits", "series", "matrices", "vectors"]
  },
  {
    label: "statistics",
    terms: [
      "statistics",
      "statistical",
      "probability",
      "inference",
      "variance",
      "distribution",
      "estimator",
      "estimate",
      "standard error",
      "sample",
      "population",
      "parameter"
    ],
    related: [
      "probability",
      "distributions",
      "point estimation",
      "sampling distributions",
      "hypothesis testing",
      "regression",
      "correlation",
      "sampling"
    ]
  },
  {
    label: "computer science",
    terms: ["programming", "computer science", "code", "software", "computing", "algorithm"],
    related: ["algorithms", "data structures", "recursion", "sorting", "databases", "networking"]
  },
  {
    label: "physics",
    terms: ["physics", "motion", "force", "energy", "electric", "circuit"],
    related: ["physics mechanics", "energy", "electricity"]
  },
  {
    label: "chemistry",
    terms: ["chemistry", "chemical", "reaction", "molecule", "compound", "solution"],
    related: ["chemistry stoichiometry", "equilibrium", "acid base"]
  },
  {
    label: "biology",
    terms: ["biology", "biological", "organism", "cell", "genetics", "evolution"],
    related: ["cell biology", "genetics", "evolution"]
  },
  {
    label: "writing",
    terms: ["essay", "paper", "argument", "analysis", "draft", "citation"],
    related: ["literary analysis", "rhetorical analysis", "historical analysis"]
  },
  {
    label: "economics",
    terms: ["economics", "economic", "market", "consumer", "inflation", "gdp"],
    related: ["microeconomics", "macroeconomics"]
  }
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "saveAlgorithmFeedback") {
    saveAlgorithmFeedback(message.payload)
      .then(() => {
        safeSendResponse(sendResponse, { ok: true });
      })
      .catch((error) => {
        safeSendResponse(sendResponse, {
          ok: false,
          error: error?.message || "Could not save algorithm feedback."
        });
      });

    return true;
  }

  if (message?.type !== "analyzeAssignment") {
    return false;
  }

  const tabId = sender?.tab?.id;
  const requestId = message.requestId;

  safeSendResponse(sendResponse, {
    ok: true,
    accepted: true
  });

  Promise.resolve()
    .then(() => analyzeAssignment(message.payload))
    .then((result) => {
      sendAnalysisResult(tabId, requestId, {
        ok: true,
        result
      });
    })
    .catch((error) => {
      sendAnalysisResult(tabId, requestId, {
        ok: false,
        error: error?.message || "Canvas Helper failed during analysis."
      });
    });

  return false;
});

function safeSendResponse(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (_error) {
    // Ignore closed-channel errors; the content script retries transient failures.
  }
}

function sendAnalysisResult(tabId, requestId, payload) {
  if (typeof tabId !== "number") {
    return;
  }

  try {
    chrome.tabs.sendMessage(tabId, {
      type: "assignmentAnalysisResult",
      requestId,
      ...payload
    });
  } catch (_error) {
    // Ignore delivery failures if the user navigated away or the content script reloaded.
  }
}

function getStoredValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (data) => {
      if (chrome.runtime.lastError) {
        resolve("");
        return;
      }

      resolve(data[key] || "");
    });
  });
}

function getStoredItem(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (data) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      resolve(data[key] ?? null);
    });
  });
}

async function getAlgorithmFeedback() {
  const stored = await getStoredItem(ALGORITHM_FEEDBACK_KEY);
  return normalizeAlgorithmFeedback(stored);
}

function normalizeAlgorithmFeedback(value) {
  const raw = value && typeof value === "object" ? value : {};
  const irrelevantFiles = Array.isArray(raw.irrelevantFiles) ? raw.irrelevantFiles : [];
  const irrelevantKeywords = Array.isArray(raw.irrelevantKeywords) ? raw.irrelevantKeywords : [];

  return {
    irrelevantFiles: irrelevantFiles
      .map((entry) => ({
        url: normalizeFeedbackUrl(entry?.url || ""),
        name: normalizeFeedbackToken(entry?.name || "")
      }))
      .filter((entry) => entry.url || entry.name)
      .slice(0, 200),
    irrelevantKeywords: irrelevantKeywords
      .map((keyword) => normalizeFeedbackToken(keyword))
      .filter(Boolean)
      .slice(0, 200)
  };
}

async function saveAlgorithmFeedback(payload) {
  const current = await getAlgorithmFeedback();
  const next = {
    irrelevantFiles: [...current.irrelevantFiles],
    irrelevantKeywords: [...current.irrelevantKeywords]
  };

  if (payload?.irrelevantFile) {
    const entry = {
      url: normalizeFeedbackUrl(payload.irrelevantFile.url || ""),
      name: normalizeFeedbackToken(payload.irrelevantFile.name || "")
    };

    if (entry.url || entry.name) {
      const exists = next.irrelevantFiles.some((item) => {
        return (
          (entry.url && item.url === entry.url) ||
          (!entry.url && entry.name && item.name === entry.name)
        );
      });

      if (!exists) {
        next.irrelevantFiles.unshift(entry);
      }
    }
  }

  if (payload?.irrelevantKeyword) {
    const keyword = normalizeFeedbackToken(payload.irrelevantKeyword);
    if (keyword && !next.irrelevantKeywords.includes(keyword)) {
      next.irrelevantKeywords.unshift(keyword);
    }
  }

  next.irrelevantFiles = next.irrelevantFiles.slice(0, 200);
  next.irrelevantKeywords = next.irrelevantKeywords.slice(0, 200);

  await new Promise((resolve, reject) => {
    chrome.storage.local.set({ [ALGORITHM_FEEDBACK_KEY]: next }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function normalizeFeedbackToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeFeedbackUrl(value) {
  return String(value || "").trim().toLowerCase();
}

async function fetchCanvas(url, options = {}) {
  const token = await getStoredValue("canvasToken");
  const requestOptions = {
    ...options,
    credentials: options.credentials || "include"
  };

  let response = await fetch(url, requestOptions);

  if (response.ok || !token || !shouldRetryWithToken(response.status)) {
    return response;
  }

  return fetch(url, {
    ...requestOptions,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
}

function shouldRetryWithToken(status) {
  return status === 401 || status === 403;
}

async function analyzeAssignment(payload) {
  return withTimeout(
    performAssignmentAnalysis(payload),
    ANALYSIS_TIMEOUT_MS,
    "Canvas Helper analysis timed out. Partial or smaller-file support is needed for this course."
  );
}

async function performAssignmentAnalysis(payload) {
  if (!payload?.courseId) {
    throw new Error("Missing course ID.");
  }

  let assignmentDocumentText = "";
  let assignmentDocumentHeaderText = "";
  let assignmentPdfParsed = false;
  let assignmentPdfFallbackUsed = false;
  let assignmentPdfDebug = null;

  if (payload.assignmentPdfUrl) {
    try {
      const assignmentPdfFile = await buildAssignmentPdfFile(payload);
      const assignmentPdfResult = await fetchAndExtractTextWithDebug(assignmentPdfFile);
      assignmentDocumentText = assignmentPdfResult.text;
      assignmentDocumentHeaderText = assignmentPdfResult.headerText || "";
      assignmentPdfParsed = Boolean(assignmentDocumentText.trim());
      assignmentPdfDebug = assignmentPdfResult.debug;
    } catch (_error) {
      assignmentDocumentText = "";
      assignmentDocumentHeaderText = "";
      assignmentPdfDebug = {
        requestedUrl: resolveAssignmentPdfUrl(payload),
        error: _error?.message || "Assignment PDF read failed."
      };
    }
  }

  const assignmentPdfFallbackText = synthesizeTextFromFilename(
    payload.assignmentPdfName || getFileNameFromUrl(payload.assignmentPdfUrl || payload.assignmentUrl)
  );

  if (assignmentPdfFallbackText) {
    if (!assignmentDocumentText.trim()) {
      assignmentDocumentText = assignmentPdfFallbackText;
      assignmentPdfFallbackUsed = true;
    } else if (assignmentDocumentText.trim().length < MIN_USEFUL_PDF_TEXT_CHARS) {
      assignmentDocumentText = `${assignmentDocumentText}\n${assignmentPdfFallbackText}`.trim();
      assignmentPdfFallbackUsed = true;
    }
  }

  const assignmentText = [payload.assignmentTitle, payload.assignmentText, assignmentDocumentText]
    .filter(Boolean)
    .join("\n\n");

  if (!assignmentText.trim()) {
    throw new Error("No assignment content was available to analyze.");
  }

  const files = (await fetchCourseFiles(payload.courseId)).slice(0, MAX_FILES_TO_ANALYZE);
  const analyzedFiles = await readCourseFiles(files, assignmentText);
  const algorithmFeedback = await getAlgorithmFeedback();
  const ranking = rankRelevantFiles(assignmentText, analyzedFiles, {
    courseTitle: payload.courseTitle || "",
    assignmentHeaderText: assignmentDocumentHeaderText,
    feedback: algorithmFeedback,
    pdfJsAvailable: Boolean(pdfjsLib),
    assignmentPdfParsed,
    assignmentPdfFallbackUsed,
    assignmentTextLength: assignmentText.length,
    assignmentPdfTextLength: assignmentDocumentText.length,
    assignmentPdfHeaderTextLength: assignmentDocumentHeaderText.length,
    assignmentPdfDebug
  });
  const result = {
    relevantFiles: ranking.relevantFiles,
    scannedFileCount: files.length,
    debug: ranking.debug
  };

  chrome.storage.local.set({
    lastAnalysis: {
      assignmentTitle: payload.assignmentTitle || "Assignment",
      matchCount: ranking.relevantFiles.length,
      scannedFileCount: files.length
    }
  });

  return result;
}

async function fetchCourseFiles(courseId) {
  const filesUrl = `https://psu.instructure.com/courses/${courseId}/files`;
  const filesPage = await fetchCoursePage(filesUrl);
  const apiEntries = await fetchCourseFilesFromApi(courseId);

  if (apiEntries.length) {
    return apiEntries;
  }

  if (filesPage.ok) {
    const fileEntries = parseCourseFileLinks(filesPage.html, filesUrl, courseId);
    if (fileEntries.length && !pageSuggestsFilesDisabled(filesPage.html)) {
      return fileEntries;
    }
  }

  const moduleEntries = await fetchModuleFiles(courseId);
  if (moduleEntries.length) {
    return moduleEntries;
  }

  if (!filesPage.ok) {
    throw new Error(
      `Could not load course files (${filesPage.status}) and no file links were found in modules.`
    );
  }

  throw new Error("No course file links were found in files or modules.");
}

async function fetchModuleFiles(courseId) {
  const modulesUrl = `https://psu.instructure.com/courses/${courseId}/modules`;
  const modulesPage = await fetchCoursePage(modulesUrl);
  const htmlEntries = modulesPage.ok
    ? parseCourseFileLinks(modulesPage.html, modulesUrl, courseId)
    : [];

  if (htmlEntries.length) {
    return htmlEntries;
  }

  return fetchModuleFilesFromApi(courseId);
}

async function fetchCourseFilesFromApi(courseId) {
  const entries = [];
  const seen = new Set();
  let nextUrl =
    `https://psu.instructure.com/api/v1/courses/${courseId}/files?per_page=100`;

  while (nextUrl) {
    const response = await fetchCanvas(nextUrl);

    if (!response.ok) {
      return entries;
    }

    const files = await response.json();
    for (const file of files) {
      const fileEntry = canvasApiFileToEntry(file, courseId);
      if (!fileEntry || seen.has(fileEntry.url)) {
        continue;
      }

      seen.add(fileEntry.url);
      entries.push(fileEntry);
    }

    nextUrl = getNextLink(response.headers.get("link"));
  }

  return entries;
}

async function fetchCoursePage(url) {
  try {
    const response = await fetchCanvas(url);

    return {
      ok: response.ok,
      status: response.status,
      html: response.ok ? await response.text() : ""
    };
  } catch (_error) {
    return {
      ok: false,
      status: 0,
      html: ""
    };
  }
}

function parseCourseFileLinks(html, baseUrl, courseId) {
  if (!html) {
    return [];
  }

  const seen = new Set();
  const fileEntries = [];
  const links = extractAnchorLinks(html);

  for (const link of links) {
    const href = link.href || "";
    if (!isCourseFileLink(href, courseId)) {
      continue;
    }

    const url = new URL(href, baseUrl).toString();
    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    const normalizedUrl = coerceCanvasFileDownloadUrl(url, courseId);
    fileEntries.push({
      courseId,
      name: (link.text || "").trim() || getFileNameFromUrl(normalizedUrl),
      url: normalizedUrl
    });
  }

  return fileEntries;
}

function extractAnchorLinks(html) {
  const links = [];
  const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1] || match[2] || match[3] || "";
    const text = stripHtml(match[4] || "");

    links.push({
      href,
      text
    });
  }

  return links;
}

function stripHtml(value) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function isCourseFileLink(href, courseId) {
  return href.includes(`/courses/${courseId}/files/`);
}

function pageSuggestsFilesDisabled(html) {
  if (!html) {
    return false;
  }

  const normalized = html.toLowerCase();

  return (
    normalized.includes("the files page is disabled") ||
    normalized.includes("files are disabled") ||
    normalized.includes("page not authorized") ||
    normalized.includes("unauthorized")
  );
}

async function fetchModuleFilesFromApi(courseId) {
  const entries = [];
  const seen = new Set();
  let nextUrl = `https://psu.instructure.com/api/v1/courses/${courseId}/modules?per_page=100`;

  while (nextUrl) {
    const response = await fetchCanvas(nextUrl);

    if (!response.ok) {
      return entries;
    }

    const modules = await response.json();
    for (const moduleEntry of modules) {
      const items = await fetchModuleItems(courseId, moduleEntry.id);

      for (const item of items) {
        const fileEntry = moduleItemToFileEntry(item, courseId);
        const dedupeKey = fileEntry ? `id:${fileEntry.id}` : "";

        if (!fileEntry || seen.has(dedupeKey)) {
          continue;
        }

        seen.add(dedupeKey);
        entries.push(fileEntry);
      }
    }

    nextUrl = getNextLink(response.headers.get("link"));
  }

  return entries;
}

async function fetchModuleItems(courseId, moduleId) {
  if (!moduleId) {
    return [];
  }

  const items = [];
  let nextUrl =
    `https://psu.instructure.com/api/v1/courses/${courseId}/modules/${moduleId}/items?per_page=100`;

  while (nextUrl) {
    const response = await fetchCanvas(nextUrl);

    if (!response.ok) {
      return items;
    }

    const pageItems = await response.json();
    if (Array.isArray(pageItems)) {
      items.push(...pageItems);
    }

    nextUrl = getNextLink(response.headers.get("link"));
  }

  return items;
}

function moduleItemToFileEntry(item, courseId) {
  if (!item || item.type !== "File") {
    return null;
  }

  if (!item.content_id) {
    return null;
  }

  return {
    courseId,
    id: item.content_id,
    name: (item.title || item.page_url || "").trim() || `File ${item.content_id}`
  };
}

function isLikelyReadableFileLink(url, courseId) {
  return (
    url.includes(`/courses/${courseId}/files/`) ||
    url.includes(`/api/v1/courses/${courseId}/files/`) ||
    url.includes(`/files/${courseId}`) ||
    url.includes("/download?")
  );
}

function canvasApiFileToEntry(file, courseId) {
  if (!file || !file.id) {
    return null;
  }

  const directApiUrl = file.url
    ? new URL(file.url, "https://psu.instructure.com").toString()
    : "";
  const shouldTrustApiUrl = directApiUrl &&
    !directApiUrl.includes("/api/v1/") &&
    !directApiUrl.endsWith(`/files/${file.id}`) &&
    (directApiUrl.includes("/download") || directApiUrl.includes("download_frd=1"));
  const url = shouldTrustApiUrl
    ? directApiUrl
    : coerceCanvasFileDownloadUrl(
        file.html_url ||
          `https://psu.instructure.com/courses/${courseId}/files/${file.id}`,
        courseId
      );

  return {
    courseId,
    id: file.id,
    name: (file.display_name || file.filename || "").trim() || getFileNameFromUrl(url),
    url
  };
}

function getNextLink(linkHeader) {
  if (!linkHeader) {
    return "";
  }

  const parts = linkHeader.split(",");

  for (const part of parts) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match && match[2] === "next") {
      return match[1];
    }
  }

  return "";
}

async function readCourseFiles(files, assignmentText = "") {
  const hydratedFiles = await Promise.all(
    files.map(async (file) => {
      try {
        return await withTimeout(ensureFileHasDownloadUrl(file), FILE_READ_TIMEOUT_MS, "");
      } catch (_error) {
        return null;
      }
    })
  );

  const readableFiles = hydratedFiles.filter((file) => file?.url);
  const seededFiles = readableFiles.map((file) => {
    const fallbackText = synthesizeTextFromFilename(file.name || "");
    return {
      ...file,
      filenameText: fallbackText,
      text: fallbackText,
      extractedTextLength: 0,
      filenameFallbackUsed: Boolean(fallbackText)
    };
  });

  const deepReadIndexes = prioritizeFilesForDeepRead(seededFiles, assignmentText);
  const deepReadIndexSet = new Set(deepReadIndexes);

  for (const index of deepReadIndexes) {
    const file = seededFiles[index];
    if (!file) {
      continue;
    }

    try {
      const fileReadResult = await withTimeout(readSingleFile(file), FILE_READ_TIMEOUT_MS, {
        text: "",
        debug: {
          requestedUrl: file.url,
          error: "Timed out while reading file."
        }
      });
      const extractedText = fileReadResult?.text || "";
      const normalizedText = mergeExtractedAndFallbackText(extractedText, file.text);

      seededFiles[index] = {
        ...file,
        filenameText: file.filenameText,
        headerText: fileReadResult?.headerText || "",
        text: normalizedText,
        extractedTextLength: extractedText.length,
        headerTextLength: (fileReadResult?.headerText || "").length,
        filenameFallbackUsed: Boolean(file.text) && normalizedText !== extractedText,
        attemptedDeepRead: true,
        debug: fileReadResult?.debug || null
      };
    } catch (_error) {
      seededFiles[index] = {
        ...file,
        filenameText: file.filenameText,
        headerText: "",
        headerTextLength: 0,
        attemptedDeepRead: true,
        debug: {
          requestedUrl: file.url,
          error: _error?.message || "File read failed."
        }
      };
    }
  }

  for (let index = 0; index < seededFiles.length; index += 1) {
    if (deepReadIndexSet.has(index)) {
      continue;
    }

    const file = seededFiles[index];
    seededFiles[index] = {
      ...file,
      filenameText: file.filenameText,
      attemptedDeepRead: false,
      debug: {
        requestedUrl: file.url,
        note: "Not deep-read in this pass."
      }
    };
  }

  return seededFiles;
}

async function buildAssignmentPdfFile(payload) {
  const baseUrl = resolveAssignmentPdfUrl(payload);
  const fileId = extractCanvasFileId(baseUrl, payload.courseId);

  if (fileId) {
    const hydrated = await fetchFileEntryById(payload.courseId, fileId);
    if (hydrated?.url) {
      return {
        ...hydrated,
        courseId: payload.courseId,
        id: fileId,
        name: payload.assignmentPdfName || hydrated.name
      };
    }
  }

  return {
    courseId: payload.courseId,
    id: fileId || 0,
    name: payload.assignmentPdfName || getFileNameFromUrl(baseUrl),
    url: baseUrl
  };
}

function synthesizeTextFromFilename(fileName) {
  const raw = String(fileName || "").replace(/\.[a-z0-9]+$/i, "");
  if (!raw) {
    return "";
  }

  let text = raw
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(
    /\bchapter\s+(\d+)\s+(\d+)\b/gi,
    (_match, whole, part) => `chapter ${whole}.${part}`
  );

  text = text.replace(
    /\bsection\s+(\d+)\s+(\d+)\b/gi,
    (_match, whole, part) => `section ${whole}.${part}`
  );

  const tokens = text.split(" ");
  const filtered = tokens.filter((token) => {
    const normalized = token.toLowerCase();
    return !/^math$|^stat$|^\d{2,4}$/.test(normalized);
  });

  return filtered.join(" ").trim();
}

function mergeExtractedAndFallbackText(extractedText, fallbackText) {
  const cleanExtracted = String(extractedText || "").trim();
  const cleanFallback = String(fallbackText || "").trim();

  if (!cleanExtracted) {
    return cleanFallback;
  }

  if (!cleanFallback) {
    return cleanExtracted;
  }

  if (cleanExtracted.length < MIN_USEFUL_FILE_TEXT_CHARS) {
    return `${cleanExtracted} ${cleanFallback}`.trim();
  }

  return cleanExtracted;
}

function prioritizeFilesForDeepRead(files, assignmentText) {
  const chapterTargets = extractChapterTargets(assignmentText);
  const assignmentKeywords = extractKeywords(assignmentText);
  const scored = files.map((file, index) => {
    const fallbackText = file.text || synthesizeTextFromFilename(file.name || "");
    const fallbackKeywords = extractKeywords(fallbackText);
    const chapterMatch = scoreFileAgainstChapters(fallbackText, file.name || "", chapterTargets);
    const keywordOverlap = getKeywordOverlap(assignmentKeywords, fallbackKeywords);
    const extension = getFileExtension(file.name || file.url || "");

    let score = chapterMatch.score + (keywordOverlap.length * 0.08);

    // Prioritize formats we can parse meaningfully.
    if (extension === "pdf") {
      score += 0.15;
    } else if (extension === "pptx") {
      score += 0.1;
    } else if (TEXT_EXTENSIONS.has(extension)) {
      score += 0.12;
    }

    return {
      index,
      score
    };
  });

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_DEEP_READ_FILES)
    .map((entry) => entry.index);
}

async function readSingleFile(file) {
  const extension = getFileExtension(file.name || file.url);

  if (extension === "pdf") {
    return fetchAndExtractTextWithDebug(file);
  }

  if (extension === "pptx") {
    return fetchAndExtractPptxText(file);
  }

  if (!TEXT_EXTENSIONS.has(extension)) {
    return {
      text: "",
      debug: {
        requestedUrl: file.url,
        note: `Skipped unsupported extension: ${extension || "unknown"}`
      }
    };
  }

  try {
    const response = await fetchResolvedFileResponse(file);
    const baseDebug = buildResponseDebug(file.url, response);

    if (!response.ok) {
      return {
        text: "",
        debug: {
          ...baseDebug,
          error: `HTTP ${response.status}`
        }
      };
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") && getFileExtension(file.name || "") !== "html") {
      return {
        text: "",
        debug: {
          ...baseDebug,
          error: "Received HTML instead of a text file."
        }
      };
    }

    const buffer = await response.arrayBuffer();
    return {
      text: decodeTextBuffer(buffer),
      debug: {
        ...baseDebug,
        byteLength: buffer.byteLength,
        extractedBy: "text"
      }
    };
  } catch (_error) {
    return {
      text: "",
      debug: {
        requestedUrl: file.url,
        error: _error?.message || "Text file read failed."
      }
    };
  }
}

async function fetchAndExtractText(fileOrUrl) {
  const result = await fetchAndExtractTextWithDebug(fileOrUrl);
  return result.text;
}

async function fetchAndExtractTextWithDebug(fileOrUrl) {
  const response = await fetchResolvedFileResponse(fileOrUrl);
  const requestedUrl = typeof fileOrUrl === "string" ? fileOrUrl : fileOrUrl?.url;
  const baseDebug = buildResponseDebug(requestedUrl, response);

  if (!response.ok) {
    return {
      text: "",
      debug: {
        ...baseDebug,
        error: `Could not read file (${response.status}).`
      }
    };
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    return {
      text: "",
      debug: {
        ...baseDebug,
        error: "File request returned HTML instead of a PDF."
      }
    };
  }

  const buffer = await response.arrayBuffer();
  try {
    const extraction = await extractPdfText(buffer);
    return {
      text: extraction.text,
      headerText: extraction.headerText || "",
      debug: {
        ...baseDebug,
        byteLength: buffer.byteLength,
        extractedBy: extraction.extractedBy || (pdfjsLib ? "pdfjs" : "fallback"),
        extractedTextLength: extraction.text.length,
        headerTextLength: (extraction.headerText || "").length
      }
    };
  } catch (_error) {
    return {
      text: "",
      debug: {
        ...baseDebug,
        byteLength: buffer.byteLength,
        error: _error?.message || "PDF extraction failed."
      }
    };
  }
}

async function fetchAndExtractPptxText(file) {
  const response = await fetchResolvedFileResponse(file);
  const baseDebug = buildResponseDebug(file.url, response);

  if (!response.ok) {
    return {
      text: "",
      debug: {
        ...baseDebug,
        error: `HTTP ${response.status}`
      }
    };
  }

  const buffer = await response.arrayBuffer();
  const slideXmlEntries = await unzipSelectedEntries(buffer, (name) => {
    return (
      /^ppt\/slides\/slide\d+\.xml$/i.test(name) ||
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name)
    );
  });

  if (!slideXmlEntries.length) {
    return {
      text: "",
      debug: {
        ...baseDebug,
        byteLength: buffer.byteLength,
        error: "No PPTX slide XML entries found."
      }
    };
  }

  const texts = slideXmlEntries
    .map((entry) => extractXmlText(entry.text))
    .filter(Boolean);

  const text = texts.join(" ").replace(/\s+/g, " ").trim();

  return {
    text,
    debug: {
      ...baseDebug,
      byteLength: buffer.byteLength,
      extractedBy: "pptx",
      extractedTextLength: text.length
    }
  };
}

async function fetchResolvedFileResponse(fileOrUrl) {
  const file = typeof fileOrUrl === "string" ? { url: fileOrUrl } : fileOrUrl;
  let response = await fetchCanvas(file.url);

  if (!response.ok) {
    return response;
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const resolvedUrl = await resolveDirectFileUrlFromHtml(html, response.url || file.url, file);

  if (!resolvedUrl || resolvedUrl === (response.url || file.url)) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  return fetchCanvas(resolvedUrl);
}

async function resolveDirectFileUrlFromHtml(html, baseUrl, file) {
  const links = extractAnchorLinks(html);

  for (const link of links) {
    const href = link.href || "";
    const absoluteUrl = new URL(href, baseUrl).toString();
    const normalizedLinkText = (link.text || "").trim().toLowerCase();

    if (
      normalizedLinkText.includes("download") ||
      absoluteUrl.includes("/download") ||
      absoluteUrl.includes("download_frd=1")
    ) {
      return absoluteUrl;
    }
  }

  const metaRefreshMatch = html.match(
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i
  );
  if (metaRefreshMatch?.[1]) {
    return new URL(metaRefreshMatch[1], baseUrl).toString();
  }

  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch?.[1]) {
    const iframeUrl = new URL(iframeMatch[1], baseUrl).toString();
    if (iframeUrl.includes("/download") || iframeUrl.includes("download_frd=1")) {
      return iframeUrl;
    }
  }

  if (file?.courseId && file?.id) {
    const hydrated = await fetchFileEntryById(file.courseId, file.id);
    if (hydrated?.url) {
      return hydrated.url;
    }
  }

  const inferredUrl = inferCanvasDownloadUrlFromHtml(html, baseUrl, file?.courseId || "");
  return inferredUrl || "";
}

function inferCanvasDownloadUrlFromHtml(html, baseUrl, courseId) {
  const patterns = [
    /\/courses\/\d+\/files\/\d+\/download(?:\?[^"' \t<>]*)?/gi,
    /\/courses\/\d+\/files\/\d+(?:\?[^"' \t<>]*)?/gi,
    /\/files\/\d+\/download(?:\?[^"' \t<>]*)?/gi,
    /\/files\/\d+(?:\?[^"' \t<>]*)?/gi
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[0]) {
      const candidate = new URL(match[0], baseUrl).toString();
      if (candidate.includes("/download")) {
        return candidate;
      }

      if (courseId) {
        return coerceCanvasFileDownloadUrl(candidate, courseId);
      }

      return candidate;
    }
  }

  return "";
}

function decodeTextBuffer(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  } catch (_error) {
    return new TextDecoder("latin1").decode(buffer);
  }
}

function buildResponseDebug(requestedUrl, response) {
  const contentType = response?.headers?.get("content-type") || "";
  const finalUrl = response?.url || requestedUrl || "";

  return {
    requestedUrl: requestedUrl || "",
    finalUrl,
    status: response?.status ?? 0,
    contentType,
    looksLikePdf: finalUrl.toLowerCase().includes(".pdf") || contentType.toLowerCase().includes("pdf")
  };
}

async function ensureFileHasDownloadUrl(file) {
  const extension = getFileExtension(file?.name || file?.url || "");
  const shouldForceHydrate =
    Boolean(file?.id) &&
    (extension === "pdf" || extension === "pptx" || extension === "ppt");

  if (!shouldForceHydrate && file?.url && isLikelyReadableFileLink(file.url, file.courseId || "")) {
    return file;
  }

  if (!file?.id) {
    if (file?.url) {
      return {
        ...file,
        url: coerceCanvasFileDownloadUrl(file.url, file.courseId || "")
      };
    }

    return file;
  }

  const hydrated = await fetchFileEntryById(file.courseId, file.id);
  if (!hydrated) {
    if (file?.url) {
      return {
        ...file,
        url: coerceCanvasFileDownloadUrl(file.url, file.courseId || "")
      };
    }

    return file;
  }

  return {
    ...file,
    ...hydrated
  };
}

async function fetchFileEntryById(courseId, fileId) {
  if (!courseId || !fileId) {
    return null;
  }

  const response = await fetchCanvas(
    `https://psu.instructure.com/api/v1/courses/${courseId}/files/${fileId}`
  );

  if (!response.ok) {
    return null;
  }

  const file = await response.json();
  return canvasApiFileToEntry(file, courseId);
}

function resolveAssignmentPdfUrl(payload) {
  return coerceCanvasFileDownloadUrl(payload.assignmentPdfUrl, payload.courseId);
}

function coerceCanvasFileDownloadUrl(url, courseId) {
  const absoluteUrl = new URL(url, "https://psu.instructure.com");
  const pathname = absoluteUrl.pathname;
  absoluteUrl.searchParams.delete("wrap");

  if (pathname.endsWith("/download")) {
    if (!absoluteUrl.searchParams.has("download_frd")) {
      absoluteUrl.searchParams.set("download_frd", "1");
    }
    return absoluteUrl.toString();
  }

  const courseMatch = pathname.match(new RegExp(`/courses/${courseId}/files/(\\d+)`));
  if (courseMatch) {
    absoluteUrl.pathname = `/courses/${courseId}/files/${courseMatch[1]}/download`;
    absoluteUrl.searchParams.set("download_frd", "1");
    return absoluteUrl.toString();
  }

  if (absoluteUrl.pathname.includes("/files/") && !absoluteUrl.searchParams.has("download_frd")) {
    absoluteUrl.searchParams.set("download_frd", "1");
  }

  return absoluteUrl.toString();
}

function extractCanvasFileId(url, courseId) {
  const absoluteUrl = new URL(url, "https://psu.instructure.com");
  const patterns = [
    new RegExp(`/courses/${courseId}/files/(\\d+)`),
    /\/files\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = absoluteUrl.pathname.match(pattern);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
  }

  return 0;
}

async function extractPdfText(buffer) {
  if (pdfjsLib) {
    try {
      const pdfJsExtraction = await extractPdfTextWithPdfJs(buffer);
      if (pdfJsExtraction.text && pdfJsExtraction.text.trim().length >= 20) {
        return {
          text: pdfJsExtraction.text.trim(),
          headerText: pdfJsExtraction.headerText.trim(),
          extractedBy: "pdfjs"
        };
      }
    } catch (_error) {
      // Fall through to the lightweight parser below.
    }
  }

  const bytes = new Uint8Array(buffer);
  const pdfSource = new TextDecoder("latin1").decode(
    bytes.slice(0, Math.min(bytes.length, PDF_RAW_SCAN_CHAR_LIMIT))
  );
  const textBlocks = [];

  const rawText = extractPdfTextOperators(pdfSource);
  if (rawText) {
    textBlocks.push(rawText);
  }

  const streamContents = await extractPdfStreams(bytes);
  for (const streamContent of streamContents) {
    const text = extractPdfTextOperators(streamContent);
    if (text) {
      textBlocks.push(text);
    }
  }

  return {
    text: textBlocks.join(" ").replace(/\s+/g, " ").trim(),
    headerText: "",
    extractedBy: "fallback"
  };
}

async function extractPdfTextWithPdfJs(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
    stopAtErrors: false
  });

  const pdfDocument = await loadingTask.promise;
  const texts = [];
  const headerTexts = [];
  const pageCount = Math.min(pdfDocument.numPages, PDF_JS_PAGE_LIMIT);

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const textItems = textContent.items
        .map((item) => normalizePdfTextItem(item))
        .filter((item) => item.text);
      const headerItems = selectHeaderLikePdfItems(textItems);
      const pageText = textItems.map((item) => item.text).join(" ");
      const pageHeaderText = headerItems.map((item) => item.text).join(" ");

      if (pageText) {
        texts.push(pageText);
      }

      if (pageHeaderText) {
        headerTexts.push(pageHeaderText);
      }
    }
  } finally {
    await pdfDocument.destroy();
  }

  return {
    text: texts.join(" ").replace(/\s+/g, " ").trim(),
    headerText: headerTexts.join(" ").replace(/\s+/g, " ").trim()
  };
}

function normalizePdfTextItem(item) {
  const text = typeof item?.str === "string"
    ? item.str.replace(/\s+/g, " ").trim()
    : "";
  const transform = Array.isArray(item?.transform) ? item.transform : [];
  const scaleX = Number(transform[0]) || 0;
  const scaleY = Number(transform[3]) || 0;
  const fontSize = Math.max(Math.abs(scaleX), Math.abs(scaleY), Number(item?.height) || 0);
  const y = Number(transform[5]) || 0;

  return {
    text,
    fontSize,
    y
  };
}

function selectHeaderLikePdfItems(items) {
  if (!items.length) {
    return [];
  }

  const fontSizes = items
    .map((item) => item.fontSize)
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((left, right) => left - right);
  const medianFontSize = fontSizes.length
    ? fontSizes[Math.floor(fontSizes.length / 2)]
    : 0;
  const maxY = items.reduce((highest, item) => Math.max(highest, item.y), Number.NEGATIVE_INFINITY);

  return items.filter((item) => {
    if (!item.text || item.text.length > 120) {
      return false;
    }

    if (/^\d+$/.test(item.text)) {
      return false;
    }

    const largeEnough = item.fontSize >= Math.max(medianFontSize * 1.2, medianFontSize + 1);
    const nearTop = maxY !== Number.NEGATIVE_INFINITY && item.y >= (maxY - 140);
    return largeEnough || nearTop;
  });
}

function decodePdfString(value) {
  return value
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => {
      const charCode = Number.parseInt(octal, 8);
      return Number.isNaN(charCode) ? " " : String.fromCharCode(charCode);
    })
    .trim();
}

function extractPdfTextOperators(content) {
  const matches = [];
  const singleTextRegex = /\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g;
  const arrayTextRegex = /\[(.*?)\]\s*TJ/gs;
  const quoteTextRegex = /\(([^()]*(?:\\.[^()]*)*)\)\s*['"]/g;
  const hexTextRegex = /<([0-9a-fA-F\s]+)>\s*Tj/g;
  const blockRegex = /BT([\s\S]*?)ET/g;

  const blocks = [];
  let blockMatch;

  while ((blockMatch = blockRegex.exec(content)) !== null) {
    blocks.push(blockMatch[1]);
  }

  if (!blocks.length) {
    blocks.push(content);
  }

  for (const block of blocks) {
    let match;

    while ((match = singleTextRegex.exec(block)) !== null) {
      const decoded = decodePdfString(match[1]);
      if (decoded) {
        matches.push(decoded);
      }
    }

    while ((match = quoteTextRegex.exec(block)) !== null) {
      const decoded = decodePdfString(match[1]);
      if (decoded) {
        matches.push(decoded);
      }
    }

    while ((match = hexTextRegex.exec(block)) !== null) {
      const decoded = decodePdfHexString(match[1]);
      if (decoded) {
        matches.push(decoded);
      }
    }

    while ((match = arrayTextRegex.exec(block)) !== null) {
      const segments = [];
      const arrayBody = match[1];

      for (const stringMatch of arrayBody.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)|<([0-9a-fA-F\s]+)>/g)) {
        const literalValue = stringMatch[1];
        const hexValue = stringMatch[2];

        if (typeof literalValue === "string") {
          const decoded = decodePdfString(literalValue);
          if (decoded) {
            segments.push(decoded);
          }
        } else if (typeof hexValue === "string") {
          const decoded = decodePdfHexString(hexValue);
          if (decoded) {
            segments.push(decoded);
          }
        }
      }

      if (segments.length) {
        matches.push(segments.join(" "));
      }
    }
  }

  return matches.join(" ");
}

function decodePdfHexString(value) {
  const compact = value.replace(/\s+/g, "");
  const normalized = compact.length % 2 === 0 ? compact : `${compact}0`;
  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < normalized.length; index += 2) {
    const hexByte = normalized.slice(index, index + 2);
    const parsed = Number.parseInt(hexByte, 16);
    bytes[index / 2] = Number.isNaN(parsed) ? 0x20 : parsed;
  }

  return decodeTextBuffer(bytes.buffer).trim();
}

async function extractPdfStreams(bytes) {
  const contents = [];
  let offset = 0;
  let streamCount = 0;

  while (offset < bytes.length && streamCount < PDF_STREAM_SCAN_LIMIT) {
    const streamIndex = indexOfToken(bytes, "stream", offset);
    if (streamIndex < 0) {
      break;
    }

    const dictionaryBytes = readPdfDictionaryPrefix(bytes, streamIndex);
    const dictionaryText = dictionaryBytes ? decodeTextBuffer(dictionaryBytes.buffer) : "";
    const dataStart = getPdfStreamDataStart(bytes, streamIndex);
    const endstreamIndex = indexOfToken(bytes, "endstream", dataStart);

    if (dataStart < 0 || endstreamIndex < 0 || endstreamIndex <= dataStart) {
      offset = streamIndex + 6;
      continue;
    }

    const streamEnd = trimPdfStreamEnd(bytes, dataStart, endstreamIndex);
    const boundedEnd = Math.min(streamEnd, dataStart + PDF_STREAM_BYTE_LIMIT);
    const streamBytes = bytes.slice(dataStart, boundedEnd);
    const decoded = await decodePdfStream(streamBytes, dictionaryText);

    if (decoded) {
      contents.push(decoded);
    }

    streamCount += 1;
    offset = endstreamIndex + 9;
  }

  return contents;
}

function readPdfDictionaryPrefix(bytes, streamIndex) {
  const start = Math.max(0, streamIndex - 2048);
  const prefix = bytes.slice(start, streamIndex);
  const prefixText = decodeTextBuffer(prefix.buffer);
  const dictStart = prefixText.lastIndexOf("<<");

  if (dictStart < 0) {
    return new Uint8Array();
  }

  return prefix.slice(dictStart);
}

function getPdfStreamDataStart(bytes, streamIndex) {
  let start = streamIndex + 6;

  if (bytes[start] === 0x0d && bytes[start + 1] === 0x0a) {
    start += 2;
  } else if (bytes[start] === 0x0a || bytes[start] === 0x0d) {
    start += 1;
  }

  return start;
}

function trimPdfStreamEnd(bytes, start, end) {
  let trimmedEnd = end;

  while (trimmedEnd > start && (bytes[trimmedEnd - 1] === 0x0a || bytes[trimmedEnd - 1] === 0x0d)) {
    trimmedEnd -= 1;
  }

  return trimmedEnd;
}

async function decodePdfStream(streamBytes, dictionaryText) {
  const filters = extractPdfStreamFilters(dictionaryText);
  let data = streamBytes;

  for (const filter of filters) {
    if (filter === "FlateDecode") {
      const inflated = await inflatePdfBytes(data);
      if (!inflated) {
        return "";
      }
      data = inflated;
      continue;
    }

    return "";
  }

  const decoded = decodeTextBuffer(data.buffer);
  if (!looksLikePdfTextContent(decoded)) {
    return "";
  }

  return decoded;
}

function extractPdfStreamFilters(dictionaryText) {
  const filters = [];
  const arrayMatch = dictionaryText.match(/\/Filter\s*\[([^\]]+)\]/);

  if (arrayMatch) {
    for (const match of arrayMatch[1].matchAll(/\/([A-Za-z0-9]+)/g)) {
      filters.push(match[1]);
    }
    return filters;
  }

  const singleMatch = dictionaryText.match(/\/Filter\s*\/([A-Za-z0-9]+)/);
  if (singleMatch) {
    filters.push(singleMatch[1]);
  }

  return filters;
}

async function inflatePdfBytes(data) {
  if (typeof DecompressionStream === "undefined") {
    return null;
  }

  for (const format of ["deflate", "deflate-raw"]) {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream(format));
      const inflated = await new Response(stream).arrayBuffer();
      return new Uint8Array(inflated);
    } catch (_error) {
      continue;
    }
  }

  return null;
}

function looksLikePdfTextContent(value) {
  const text = String(value || "");
  return (
    text.includes("BT") ||
    text.includes("Tj") ||
    text.includes("TJ") ||
    text.includes("Tf") ||
    text.includes("Tm")
  );
}

function indexOfToken(bytes, token, startOffset) {
  const tokenBytes = new TextEncoder().encode(token);

  for (let offset = startOffset; offset <= bytes.length - tokenBytes.length; offset += 1) {
    let found = true;

    for (let index = 0; index < tokenBytes.length; index += 1) {
      if (bytes[offset + index] !== tokenBytes[index]) {
        found = false;
        break;
      }
    }

    if (found) {
      return offset;
    }
  }

  return -1;
}

async function unzipSelectedEntries(buffer, shouldInclude) {
  const bytes = new Uint8Array(buffer);
  const centralDirectoryOffset = findZipCentralDirectoryOffset(bytes);

  if (centralDirectoryOffset < 0) {
    return [];
  }

  const entries = [];
  let offset = centralDirectoryOffset;

  while (offset + 46 <= bytes.length && readUint32LE(bytes, offset) === 0x02014b50) {
    const compressionMethod = readUint16LE(bytes, offset + 10);
    const compressedSize = readUint32LE(bytes, offset + 20);
    const fileNameLength = readUint16LE(bytes, offset + 28);
    const extraLength = readUint16LE(bytes, offset + 30);
    const commentLength = readUint16LE(bytes, offset + 32);
    const localHeaderOffset = readUint32LE(bytes, offset + 42);
    const fileName = decodeZipText(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    if (shouldInclude(fileName)) {
      const entryData = bytes.slice(
        getZipEntryDataOffset(bytes, localHeaderOffset),
        getZipEntryDataOffset(bytes, localHeaderOffset) + compressedSize
      );
      const decompressed = await decompressZipEntry(entryData, compressionMethod);

      if (decompressed) {
        entries.push({
          name: fileName,
          text: decodeTextBuffer(decompressed.buffer)
        });
      }
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (typeof timeoutMessage === "string" && timeoutMessage.length) {
        reject(new Error(timeoutMessage));
        return;
      }

      resolve(timeoutMessage);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function findZipCentralDirectoryOffset(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 65557);

  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (readUint32LE(bytes, offset) === 0x06054b50) {
      return readUint32LE(bytes, offset + 16);
    }
  }

  return -1;
}

function getZipEntryDataOffset(bytes, localHeaderOffset) {
  if (readUint32LE(bytes, localHeaderOffset) !== 0x04034b50) {
    return localHeaderOffset;
  }

  const fileNameLength = readUint16LE(bytes, localHeaderOffset + 26);
  const extraLength = readUint16LE(bytes, localHeaderOffset + 28);
  return localHeaderOffset + 30 + fileNameLength + extraLength;
}

async function decompressZipEntry(data, compressionMethod) {
  if (compressionMethod === 0) {
    return data;
  }

  if (compressionMethod !== 8 || typeof DecompressionStream === "undefined") {
    return null;
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const inflated = await new Response(stream).arrayBuffer();
  return new Uint8Array(inflated);
}

function decodeZipText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (_error) {
    return new TextDecoder("latin1").decode(bytes);
  }
}

function extractXmlText(xml) {
  return decodeHtmlEntities(
    String(xml || "")
      .replace(/<a:br\s*\/?>/gi, " ")
      .replace(/<\/a:p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function rankRelevantFiles(assignmentText, files, analysisMeta = {}) {
  const ignoredKeywords = new Set(
    (analysisMeta.feedback?.irrelevantKeywords || []).map((keyword) => normalizeFeedbackToken(keyword))
  );
  const chapterTargets = extractChapterTargets(assignmentText);
  const topicContext = buildTopicHierarchyFromContext(
    analysisMeta.courseTitle || "",
    assignmentText,
    analysisMeta.assignmentHeaderText || "",
    ignoredKeywords
  );
  const topicHierarchy = topicContext.hierarchy;
  const assignmentKeywords = extractKeywords(assignmentText, ignoredKeywords);
  const relevantFiles = [];
  const debug = {
    chapters: chapterTargets,
    topicHierarchy: topicHierarchy.map((level) => ({
      label: level.label,
      topics: level.topics.map((topic) => topic.label)
    })),
    topKeywords: topicContext.debugKeywords,
    pdfJsAvailable: Boolean(analysisMeta.pdfJsAvailable),
    assignmentPdfParsed: Boolean(analysisMeta.assignmentPdfParsed),
    assignmentPdfFallbackUsed: Boolean(analysisMeta.assignmentPdfFallbackUsed),
    assignmentTextLength: analysisMeta.assignmentTextLength || 0,
    assignmentPdfTextLength: analysisMeta.assignmentPdfTextLength || 0,
    assignmentPdfHeaderTextLength: analysisMeta.assignmentPdfHeaderTextLength || 0,
    assignmentPdfDebug: analysisMeta.assignmentPdfDebug || null,
    ignoredKeywordCount: ignoredKeywords.size,
    ignoredFileCount: Array.isArray(analysisMeta.feedback?.irrelevantFiles)
      ? analysisMeta.feedback.irrelevantFiles.length
      : 0,
    filesWithExtractedText: files.filter((file) => (file.extractedTextLength || 0) > 0).length,
    filesUsingFilenameFallback: files.filter((file) => Boolean(file.filenameFallbackUsed)).length,
    deepReadFiles: files.filter((file) => Boolean(file.attemptedDeepRead)).length,
    fileExtractionSamples: files
      .slice()
      .sort((left, right) => {
        const leftDeep = left.attemptedDeepRead ? 1 : 0;
        const rightDeep = right.attemptedDeepRead ? 1 : 0;

        if (leftDeep !== rightDeep) {
          return rightDeep - leftDeep;
        }

        const leftExtracted = left.extractedTextLength || 0;
        const rightExtracted = right.extractedTextLength || 0;

        if (leftExtracted !== rightExtracted) {
          return rightExtracted - leftExtracted;
        }

        return (right.text || "").length - (left.text || "").length;
      })
      .slice(0, 8)
      .map((file) => ({
      name: file.name,
      textLength: (file.text || "").length,
      extractedTextLength: file.extractedTextLength || 0,
      headerTextLength: file.headerTextLength || 0,
      filenameFallbackUsed: Boolean(file.filenameFallbackUsed),
      attemptedDeepRead: Boolean(file.attemptedDeepRead),
      debug: file.debug || null
    }))
  };

  for (const file of files) {
    if (isFeedbackExcludedFile(file, analysisMeta.feedback)) {
      continue;
    }

    const searchableText = [file.name, file.filenameText, file.text].filter(Boolean).join(" ");
    const fileKeywords = extractKeywords(searchableText, ignoredKeywords);
    const headerText = String(file.headerText || "");
    const chapterMatch = scoreFileAgainstChapters(
      searchableText,
      [file.name, file.filenameText].filter(Boolean).join(" "),
      chapterTargets
    );
    const topicMatch = scoreFileAgainstTopics(searchableText, fileKeywords, topicHierarchy, headerText);
    const keywordOverlap = getKeywordOverlap(assignmentKeywords, fileKeywords);

    if (!chapterMatch.score && !topicMatch.score && !keywordOverlap.length) {
      continue;
    }

    const keywordScore = assignmentKeywords.size
      ? keywordOverlap.length / assignmentKeywords.size
      : 0;
    const score = (
      (chapterMatch.score * 0.6) +
      (topicMatch.score * 0.3) +
      (keywordScore * 0.1)
    );
    const reasonParts = [];

    if (chapterMatch.reason) {
      reasonParts.push(chapterMatch.reason);
    }

    if (topicMatch.reason) {
      reasonParts.push(topicMatch.reason);
    }

    if (keywordOverlap.length) {
      reasonParts.push(`Shared terms: ${keywordOverlap.slice(0, 4).join(", ")}`);
    }

    relevantFiles.push({
      name: file.name,
      url: file.url,
      score,
      reason: reasonParts.join(" | ")
    });
  }

  const sortedFiles = relevantFiles
    .sort((left, right) => right.score - left.score)
    .filter((file) => file.score >= 0.12);

  if (sortedFiles.length >= 3) {
    return {
      relevantFiles: sortedFiles.slice(0, 8),
      debug
    };
  }

  const relaxedFiles = relevantFiles
    .sort((left, right) => right.score - left.score)
    .filter((file) => file.score >= 0.06);

  return {
    relevantFiles: relaxedFiles.slice(0, 8),
    debug
  };
}

function extractKeywords(text, ignoredKeywords = null) {
  const tokens = (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
    .filter((token) => !ignoredKeywords || !ignoredKeywords.has(token))
    .filter((token) => !isLowSignalToken(token));

  const counts = new Map();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 30)
    .map(([token]) => token);

  return new Set(sorted);
}

function isLowSignalToken(token) {
  if (!token) {
    return true;
  }

  if (/^\d+$/.test(token)) {
    return true;
  }

  if (token.length <= 3) {
    return true;
  }

  return false;
}

function getKeywordOverlap(assignmentKeywords, fileKeywords) {
  const shared = [];

  for (const keyword of assignmentKeywords) {
    if (fileKeywords.has(keyword)) {
      shared.push(keyword);
    }
  }

  return shared;
}

function extractChapterTargets(text) {
  const normalized = String(text || "").toLowerCase();
  const patterns = [
    /\bchapters?\s+((?:\d+(?:\.\d+)?[a-z]?(?:\s*(?:,|and|through|to|-)\s*)?)+)/gi,
    /\bch\.?\s+((?:\d+(?:\.\d+)?[a-z]?(?:\s*(?:,|and|through|to|-)\s*)?)+)/gi,
    /\bchapter\s+(\d+(?:\.\d+)?[a-z]?)\b/gi,
    /\bsections?\s+((?:\d+(?:\.\d+)?[a-z]?(?:\s*(?:,|and|through|to|-)\s*)?)+)/gi,
    /\bsec\.?\s+((?:\d+(?:\.\d+)?[a-z]?(?:\s*(?:,|and|through|to|-)\s*)?)+)/gi,
    /\bunit\s+((?:\d+(?:\.\d+)?[a-z]?(?:\s*(?:,|and|through|to|-)\s*)?)+)/gi
  ];
  const targets = new Set();

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(normalized)) !== null) {
      const fragment = match[1] || "";
      const values = expandNumericReferences(fragment);

      for (const value of values) {
        targets.add(value);
      }
    }
  }

  return Array.from(targets);
}

function scoreFileAgainstChapters(text, fileName, chapterTargets) {
  if (!chapterTargets.length) {
    return {
      score: 0,
      reason: ""
    };
  }

  const normalizedText = ` ${String(text || "").toLowerCase()} `;
  const normalizedFileName = ` ${String(fileName || "").toLowerCase()} `;
  const matchedChapters = [];

  for (const chapter of chapterTargets) {
    const chapterPatterns = [
      `chapter ${chapter}`,
      `chapters ${chapter}`,
      `ch ${chapter}`,
      `ch. ${chapter}`,
      `section ${chapter}`,
      `sections ${chapter}`,
      `sec ${chapter}`,
      `sec. ${chapter}`,
      `unit ${chapter}`,
      `chapter-${chapter}`,
      `chapter_${chapter}`,
      `section-${chapter}`,
      `section_${chapter}`
    ];

    const found = chapterPatterns.some((pattern) => {
      return normalizedText.includes(pattern) || normalizedFileName.includes(pattern);
    });

    if (found) {
      matchedChapters.push(chapter);
    }
  }

  if (!matchedChapters.length) {
    return {
      score: 0,
      reason: ""
    };
  }

  const coverage = matchedChapters.length / chapterTargets.length;

  return {
    score: Math.min(1, 0.9 + (coverage * 0.1)),
    reason: `Reference match: ${matchedChapters.map((chapter) => `#${chapter}`).join(", ")}`
  };
}

function expandNumericReferences(fragment) {
  const normalized = String(fragment || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const values = new Set();
  const segments = normalized.split(/\s*,\s*|\s+and\s+/);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const rangeMatch = trimmed.match(
      /^(\d+(?:\.\d+)?[a-z]?)\s*(?:-|through|to)\s*(\d+(?:\.\d+)?[a-z]?)$/
    );

    if (rangeMatch) {
      const expanded = expandReferenceRange(rangeMatch[1], rangeMatch[2]);
      for (const value of expanded) {
        values.add(value);
      }
      continue;
    }

    const singles = trimmed.match(/\d+(?:\.\d+)?[a-z]?/g) || [];
    for (const value of singles) {
      values.add(value);
    }
  }

  return Array.from(values);
}

function expandReferenceRange(start, end) {
  if (/[a-z]/i.test(start) || /[a-z]/i.test(end) || start.includes(".") || end.includes(".")) {
    return [start, end];
  }

  const startNumber = Number.parseInt(start, 10);
  const endNumber = Number.parseInt(end, 10);

  if (
    Number.isNaN(startNumber) ||
    Number.isNaN(endNumber) ||
    endNumber < startNumber ||
    endNumber - startNumber > 25
  ) {
    return [start, end];
  }

  const values = [];

  for (let current = startNumber; current <= endNumber; current += 1) {
    values.push(String(current));
  }

  return values;
}

function scoreFileAgainstTopics(text, fileKeywords, topicHierarchy, headerText = "") {
  const normalizedText = ` ${String(text || "").toLowerCase()} `;
  const normalizedHeaderText = ` ${String(headerText || "").toLowerCase()} `;

  for (const level of topicHierarchy) {
    let bestMatch = null;

    for (const topic of level.topics) {
      const matchedTerms = topic.terms.filter((term) => {
        const normalizedTerm = term.toLowerCase();
        return (
          normalizedText.includes(` ${normalizedTerm} `) ||
          fileKeywords.has(normalizedTerm)
        );
      });

      if (!matchedTerms.length) {
        continue;
      }

      const coverage = matchedTerms.length / topic.terms.length;
      const headerMatchedTerms = topic.terms.filter((term) => {
        const normalizedTerm = term.toLowerCase();
        return normalizedHeaderText.includes(` ${normalizedTerm} `);
      });
      const headerCoverage = topic.terms.length
        ? (headerMatchedTerms.length / topic.terms.length)
        : 0;
      const reasonLabel = headerMatchedTerms.length && !level.label.startsWith("Header")
        ? `Header ${level.label}`
        : level.label;
      const candidate = {
        score: Math.min(1, (level.weight * coverage) + (headerCoverage * 0.35)),
        reason: `${reasonLabel} topic match: ${topic.label}`
      };

      if (!bestMatch || candidate.score > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  return {
    score: 0,
    reason: ""
  };
}

function buildTopicHierarchy(assignmentText) {
  return buildTopicHierarchyFromContext("", assignmentText, "", new Set());
}

function buildTopicHierarchyFromContext(
  courseTitle,
  assignmentText,
  assignmentHeaderText = "",
  ignoredKeywords = new Set()
) {
  const domainSourceText = [
    String(courseTitle || ""),
    String(assignmentHeaderText || ""),
    String(assignmentText || "")
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const domainKeywordSet = extractKeywords(domainSourceText, ignoredKeywords);
  const seedSpecificTopics = inferSpecificTopics(domainSourceText, domainKeywordSet);
  const domainTopics = inferDomainTopics(domainSourceText, domainKeywordSet, seedSpecificTopics);

  const normalizedText = String(assignmentText || "").toLowerCase();
  const normalizedHeaderText = String(assignmentHeaderText || "").toLowerCase();
  const keywordSet = extractKeywords(normalizedText, ignoredKeywords);
  const headerKeywordSet = extractKeywords(normalizedHeaderText, ignoredKeywords);
  const combinedKeywordSet = mergeKeywordSets(headerKeywordSet, keywordSet);
  const allowedSpecificLabels = new Set(
    inferDomainDerivedTopics(domainTopics, []).map((topic) => topic.label)
  );
  const headerSpecificTopics = inferSpecificTopics(
    normalizedHeaderText,
    headerKeywordSet,
    allowedSpecificLabels
  );
  const specificTopics = mergeTopicLists(
    headerSpecificTopics,
    inferSpecificTopics(normalizedText, combinedKeywordSet, allowedSpecificLabels)
  );
  const domainDerivedTopics = inferDomainDerivedTopics(domainTopics, specificTopics);

  const hierarchy = [];

  if (headerSpecificTopics.length) {
    hierarchy.push({
      label: "Header Specific",
      weight: 1,
      topics: headerSpecificTopics
    });
  }

  if (specificTopics.length) {
    hierarchy.push({
      label: "Specific",
      weight: headerSpecificTopics.length ? 0.92 : 1,
      topics: specificTopics
    });
  }

  if (domainDerivedTopics.length) {
    hierarchy.push({
      label: "Derived Specific",
      weight: 0.78,
      topics: domainDerivedTopics
    });
  }

  if (domainTopics.length) {
    hierarchy.push({
      label: "Domain",
      weight: 0.55,
      topics: domainTopics
    });
  }

  const genericTopics = inferGenericTopics(
    combinedKeywordSet,
    specificTopics,
    domainTopics,
    domainDerivedTopics
  );
  if (genericTopics.length) {
    hierarchy.push({
      label: "General",
      weight: 0.28,
      topics: genericTopics
    });
  }

  return {
    hierarchy,
    specificTopics,
    domainTopics,
    domainDerivedTopics,
    genericTopics,
    debugKeywords: selectDebugKeywords(
      combinedKeywordSet,
      specificTopics,
      domainTopics,
      domainDerivedTopics,
      genericTopics
    )
  };
}

function mergeKeywordSets(...sets) {
  const merged = new Set();

  for (const set of sets) {
    for (const value of set || []) {
      merged.add(value);
    }
  }

  return merged;
}

function mergeTopicLists(...lists) {
  const merged = [];
  const seen = new Set();

  for (const list of lists) {
    for (const topic of list || []) {
      if (!topic?.label || seen.has(topic.label)) {
        continue;
      }

      seen.add(topic.label);
      merged.push(topic);
    }
  }

  return merged;
}

function isFeedbackExcludedFile(file, feedback) {
  const ignoredFiles = Array.isArray(feedback?.irrelevantFiles) ? feedback.irrelevantFiles : [];
  if (!ignoredFiles.length) {
    return false;
  }

  const fileUrl = normalizeFeedbackUrl(file?.url || "");
  const fileName = normalizeFeedbackToken(file?.name || "");

  return ignoredFiles.some((entry) => {
    return (
      (entry.url && fileUrl && entry.url === fileUrl) ||
      (entry.name && fileName && entry.name === fileName)
    );
  });
}

function inferSpecificTopics(text, keywordSet, allowedLabels = null) {
  return SPECIFIC_TOPIC_CATALOG.filter((topic) => {
    if (allowedLabels && allowedLabels.size && !allowedLabels.has(topic.label)) {
      return false;
    }

    return topic.terms.some((term) => topicTermAppears(text, keywordSet, term));
  });
}

function inferDomainTopics(text, keywordSet, specificTopics) {
  const specificLabels = new Set(specificTopics.map((topic) => topic.label));

  return DOMAIN_TOPIC_CATALOG.filter((domain) => {
    const matchedDirectly = domain.terms.some((term) => topicTermAppears(text, keywordSet, term));
    const matchedBySpecific = domain.related.some((label) => specificLabels.has(label));
    return matchedDirectly || matchedBySpecific;
  }).map((domain) => ({
    label: domain.label,
    terms: domain.terms
  }));
}

function inferDomainDerivedTopics(domainTopics, specificTopics) {
  const specificLabels = new Set(specificTopics.map((topic) => topic.label));
  const derivedLabels = new Set();

  for (const domainTopic of domainTopics) {
    const domainDefinition = DOMAIN_TOPIC_CATALOG.find((entry) => entry.label === domainTopic.label);
    if (!domainDefinition) {
      continue;
    }

    for (const relatedLabel of domainDefinition.related) {
      if (!specificLabels.has(relatedLabel)) {
        derivedLabels.add(relatedLabel);
      }
    }
  }

  return SPECIFIC_TOPIC_CATALOG.filter((topic) => derivedLabels.has(topic.label));
}

function inferGenericTopics(keywordSet, specificTopics, domainTopics, domainDerivedTopics = []) {
  const excluded = new Set();

  for (const topic of [...specificTopics, ...domainTopics, ...domainDerivedTopics]) {
    for (const term of topic.terms) {
      excluded.add(term.toLowerCase());
    }
  }

  const genericTerms = Array.from(keywordSet).filter((term) => !excluded.has(term));

  // Once we know the domain, arbitrary leftover nouns are usually context noise, not useful topics.
  if (domainTopics.length) {
    return [];
  }

  return genericTerms.slice(0, 6).map((term) => ({
    label: term,
    terms: [term]
  }));
}

function selectDebugKeywords(
  keywordSet,
  specificTopics,
  domainTopics,
  domainDerivedTopics,
  genericTopics
) {
  const prioritized = [];
  const seen = new Set();

  const addTerms = (terms) => {
    for (const term of terms) {
      const normalized = term.toLowerCase();
      if (normalized.includes(" ")) {
        continue;
      }
      if (!keywordSet.has(normalized) || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      prioritized.push(normalized);
    }
  };

  for (const topic of [...specificTopics, ...domainDerivedTopics, ...domainTopics, ...genericTopics]) {
    addTerms(topic.terms);
  }

  if (prioritized.length) {
    return prioritized.slice(0, 10);
  }

  return Array.from(keywordSet).slice(0, 10);
}

function topicTermAppears(text, keywordSet, term) {
  const normalizedTerm = term.toLowerCase();
  if (normalizedTerm.includes(" ")) {
    return text.includes(normalizedTerm);
  }

  return keywordSet.has(normalizedTerm);
}

function getFileExtension(value) {
  const match = value.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
  return match ? match[1] : "";
}

function getFileNameFromUrl(url) {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/");
  return parts[parts.length - 1] || "Course File";
}
