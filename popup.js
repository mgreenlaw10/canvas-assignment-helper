const tokenInput = document.getElementById("canvas-token");
const saveTokenButton = document.getElementById("save-token");
const status = document.getElementById("status");

chrome.storage.local.get(["lastAnalysis", "canvasToken"], (data) => {
  if (chrome.runtime.lastError) {
    status.textContent = "Recent activity is unavailable.";
    return;
  }

  tokenInput.value = data.canvasToken || "";

  if (!data.lastAnalysis) {
    status.textContent = data.canvasToken
      ? "Canvas token saved. Open an assignment page to analyze it."
      : status.textContent;
    return;
  }

  const { assignmentTitle, matchCount, scannedFileCount } = data.lastAnalysis;
  status.textContent =
    `Last analysis: ${assignmentTitle} (${matchCount} matches from ${scannedFileCount} files)`;
});

saveTokenButton.addEventListener("click", () => {
  const canvasToken = tokenInput.value.trim();

  chrome.storage.local.set({ canvasToken }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = "Could not save token.";
      return;
    }

    status.textContent = canvasToken
      ? "Canvas token saved."
      : "Canvas token cleared.";
  });
});
