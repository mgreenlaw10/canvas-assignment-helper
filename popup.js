const status = document.getElementById("status");

chrome.storage.local.get(["lastAnalysis"], (data) => {
  if (chrome.runtime.lastError) {
    status.textContent = "Recent activity is unavailable.";
    return;
  }

  if (!data.lastAnalysis) {
    return;
  }

  const { assignmentTitle, matchCount, scannedFileCount } = data.lastAnalysis;
  status.textContent =
    `Last analysis: ${assignmentTitle} (${matchCount} matches from ${scannedFileCount} files)`;
});
