const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "between",
  "could",
  "every",
  "from",
  "have",
  "into",
  "just",
  "more",
  "should",
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "analyzeAssignment") {
    return false;
  }

  analyzeAssignment(message.payload)
    .then((result) => {
      sendResponse({
        ok: true,
        result
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

  return true;
});

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
  if (!payload?.courseId) {
    throw new Error("Missing course ID.");
  }

  let assignmentDocumentText = "";

  if (payload.assignmentPdfUrl) {
    try {
      assignmentDocumentText = await fetchAndExtractText(resolveAssignmentPdfUrl(payload));
    } catch (_error) {
      assignmentDocumentText = "";
    }
  }

  const assignmentText = [payload.assignmentTitle, payload.assignmentText, assignmentDocumentText]
    .filter(Boolean)
    .join("\n\n");

  if (!assignmentText.trim()) {
    throw new Error("No assignment content was available to analyze.");
  }

  const files = await fetchCourseFiles(payload.courseId);
  const analyzedFiles = await readCourseFiles(files);
  const relevantFiles = rankRelevantFiles(assignmentText, analyzedFiles);
  const result = {
    relevantFiles,
    scannedFileCount: files.length
  };

  chrome.storage.local.set({
    lastAnalysis: {
      assignmentTitle: payload.assignmentTitle || "Assignment",
      matchCount: relevantFiles.length,
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

  const url = file.url
    ? new URL(file.url, "https://psu.instructure.com").toString()
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

async function readCourseFiles(files) {
  const results = [];

  for (const file of files) {
    const hydratedFile = await ensureFileHasDownloadUrl(file);
    if (!hydratedFile?.url) {
      continue;
    }

    const fileText = await readSingleFile(hydratedFile);

    results.push({
      ...hydratedFile,
      text: fileText || ""
    });
  }

  return results;
}

async function readSingleFile(file) {
  const extension = getFileExtension(file.name || file.url);

  if (extension === "pdf") {
    return fetchAndExtractText(file.url);
  }

  if (!TEXT_EXTENSIONS.has(extension)) {
    return "";
  }

  try {
    const response = await fetchCanvas(file.url);

    if (!response.ok) {
      return "";
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") && getFileExtension(file.name || "") !== "html") {
      return "";
    }

    return await response.text();
  } catch (_error) {
    return "";
  }
}

async function fetchAndExtractText(url) {
  const response = await fetchCanvas(url);

  if (!response.ok) {
    throw new Error(`Could not read file (${response.status}).`);
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    throw new Error("File request returned HTML instead of a PDF.");
  }

  const buffer = await response.arrayBuffer();
  return extractPdfText(buffer);
}

async function ensureFileHasDownloadUrl(file) {
  if (file?.url && isLikelyReadableFileLink(file.url, file.courseId || "")) {
    return file;
  }

  if (!file?.id) {
    return file;
  }

  const hydrated = await fetchFileEntryById(file.courseId, file.id);
  if (!hydrated) {
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

  if (pathname.endsWith("/download")) {
    return absoluteUrl.toString();
  }

  const courseMatch = pathname.match(new RegExp(`/courses/${courseId}/files/(\\d+)`));
  if (courseMatch) {
    absoluteUrl.pathname = `/courses/${courseId}/files/${courseMatch[1]}/download`;
    return absoluteUrl.toString();
  }

  return absoluteUrl.toString();
}

function extractPdfText(buffer) {
  const pdfSource = new TextDecoder("latin1").decode(buffer);
  const matches = [];

  const singleTextRegex = /\(([^()]*)\)\s*Tj/g;
  const arrayTextRegex = /\[(.*?)\]\s*TJ/g;

  let match;

  while ((match = singleTextRegex.exec(pdfSource)) !== null) {
    const decoded = decodePdfString(match[1]);
    if (decoded) {
      matches.push(decoded);
    }
  }

  while ((match = arrayTextRegex.exec(pdfSource)) !== null) {
    const segments = Array.from(match[1].matchAll(/\(([^()]*)\)/g))
      .map((segment) => decodePdfString(segment[1]))
      .filter(Boolean);

    if (segments.length) {
      matches.push(segments.join(" "));
    }
  }

  return matches.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfString(value) {
  return value
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .trim();
}

function rankRelevantFiles(assignmentText, files) {
  const assignmentKeywords = extractKeywords(assignmentText);
  const relevantFiles = [];

  for (const file of files) {
    const searchableText = [file.name, file.text].filter(Boolean).join(" ");
    const fileKeywords = extractKeywords(searchableText);
    const shared = [];

    for (const keyword of assignmentKeywords) {
      if (fileKeywords.has(keyword)) {
        shared.push(keyword);
      }
    }

    if (!shared.length) {
      continue;
    }

    const score = shared.length / assignmentKeywords.size;

    relevantFiles.push({
      name: file.name,
      url: file.url,
      score,
      reason: `Shared keywords: ${shared.slice(0, 5).join(", ")}`
    });
  }

  return relevantFiles
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

function extractKeywords(text) {
  const tokens = (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));

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

function getFileExtension(value) {
  const match = value.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
  return match ? match[1] : "";
}

function getFileNameFromUrl(url) {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/");
  return parts[parts.length - 1] || "Course File";
}
