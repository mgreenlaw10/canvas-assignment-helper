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

async function analyzeAssignment(payload) {
  if (!payload?.courseId) {
    throw new Error("Missing course ID.");
  }

  let assignmentDocumentText = "";

  if (payload.assignmentPdfUrl) {
    try {
      assignmentDocumentText = await fetchAndExtractText(payload.assignmentPdfUrl);
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
    scannedFileCount: analyzedFiles.length
  };

  chrome.storage.local.set({
    lastAnalysis: {
      assignmentTitle: payload.assignmentTitle || "Assignment",
      matchCount: relevantFiles.length,
      scannedFileCount: analyzedFiles.length
    }
  });

  return result;
}

async function fetchCourseFiles(courseId) {
  const filesUrl = `https://psu.instructure.com/courses/${courseId}/files`;
  const filesPage = await fetchCoursePage(filesUrl);

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

async function fetchCoursePage(url) {
  try {
    const response = await fetch(url, {
      credentials: "include"
    });

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
    fileEntries.push({
      name: (link.text || "").trim() || getFileNameFromUrl(url),
      url
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
  let nextUrl =
    `https://psu.instructure.com/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      credentials: "include"
    });

    if (!response.ok) {
      return entries;
    }

    const modules = await response.json();
    for (const moduleEntry of modules) {
      const items = Array.isArray(moduleEntry.items) ? moduleEntry.items : [];

      for (const item of items) {
        const fileEntry = moduleItemToFileEntry(item, courseId);
        if (!fileEntry || seen.has(fileEntry.url)) {
          continue;
        }

        seen.add(fileEntry.url);
        entries.push(fileEntry);
      }
    }

    nextUrl = getNextLink(response.headers.get("link"));
  }

  return entries;
}

function moduleItemToFileEntry(item, courseId) {
  if (!item || item.type !== "File") {
    return null;
  }

  let url = item.html_url || item.url || "";

  if (!url && item.content_id) {
    url = `https://psu.instructure.com/courses/${courseId}/files/${item.content_id}`;
  }

  if (!url) {
    return null;
  }

  const absoluteUrl = new URL(url, "https://psu.instructure.com").toString();

  if (!isLikelyReadableFileLink(absoluteUrl, courseId)) {
    return null;
  }

  return {
    name: (item.title || item.page_url || "").trim() || getFileNameFromUrl(absoluteUrl),
    url: absoluteUrl
  };
}

function isLikelyReadableFileLink(url, courseId) {
  return (
    url.includes(`/courses/${courseId}/files/`) ||
    url.includes(`/files/${courseId}`) ||
    url.includes("/download?")
  );
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
    const fileText = await readSingleFile(file);
    if (!fileText) {
      continue;
    }

    results.push({
      ...file,
      text: fileText
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
    const response = await fetch(file.url, {
      credentials: "include"
    });

    if (!response.ok) {
      return "";
    }

    return await response.text();
  } catch (_error) {
    return "";
  }
}

async function fetchAndExtractText(url) {
  const response = await fetch(url, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Could not read file (${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  return extractPdfText(buffer);
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
    const fileKeywords = extractKeywords(file.text);
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
