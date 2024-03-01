/**
 * @typedef {import('../types.js').Message} Message
 * @typedef {import('../types.js').BatchItem} BatchItem
 * @typedef {import('../types.js').Prediction} Prediction
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.storage.local.set({
    server_origin: "http://127.0.0.1:8000",
    spam_color: [255, 0, 0],
  });

  chrome.contextMenus.create({
    id: "report-text-feedback-spam",
    title: "Feedback: Report text as spam",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "report-text-feedback-ham",
    title: "Feedback: Report text as ham",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "report-link-feedback-spam",
    title: "Feedback: Report link title as spam",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    id: "report-link-feedback-ham",
    title: "Feedback: Report link title as ham",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    id: "report-all-feedback-ham",
    title: "Feedback: Report all links as ham",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: "report-all-feedback-spam",
    title: "Feedback: Report all links as spam",
    contexts: ["all"],
  });

  chrome.contextMenus.create({
    id: "toggle-labels",
    title: "Visual: Toggle spam reports",
    contexts: ["all"],
  });
})


/** @type {chrome.runtime.Port} */
let contentPort;

/**
 * @param {Message} response
 */
const contentPortResponse = async ({ type, arguments }) => {
  if (type === "classify") {
    onClassifyRequest(arguments['batch']);
  }
}

/**
 * @param {chrome.runtime.Port} p
 */
chrome.runtime.onConnect.addListener(async (p) => {
  if (p.name === "distil-bert-port") {
    contentPort = p;
    contentPort.onMessage.addListener(contentPortResponse);

    const { spam_color } = await chrome.storage.local.get(["spam_color"]);
    contentPort.postMessage({ type: "options", arguments: { spam_color: spam_color } })
  }
});

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [maxRetries=10]
 * @param {number} [retryDelay=1000]
 * @return {?Response} 
 */
const fetchWithRetries = async (url, options, maxRetries = 10, retryDelay = 1000) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      console.error(`Attempt ${attempt + 1}: Server responded with status ${response.status}`);
    } catch (error) {
      console.error(`Attempt ${attempt + 1}: Fetch error: ${error.message}`);
    }
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  return null;
}

/**
 * @param {BatchItem[]} batch
 */
const onClassifyRequest = async (batch) => {
  /** @type {{server_origin: string}} */
  const { server_origin } = await chrome.storage.local.get(["server_origin"]);

  const query = new URLSearchParams(batch.map(({ text }) => ['q', text]));

  const headers = new Headers({ "ngrok-skip-browser-warning": "anyvalue" });

  /** @type {?Response} */
  const response = await fetchWithRetries(`${server_origin}/classify?${query}`, { headers });
  if (response === null) {
    return;
  }

  /** @type {Prediction[]} */
  const predictions = await response.json();

  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i]["label"] == "LABEL_0") {
      continue;
    }

    contentPort.postMessage({
      type: "classify",
      arguments: {
        url: batch[i]["url"],
        score: predictions[i]["score"],
      }
    });
  }
};

const toggleLabels = () => {
  document.querySelectorAll(`a[distilbert-spam="true"]`).forEach((link) => {
    if (link.style.backgroundColor == link.getAttribute('distilbert-detected-color')) {
      link.style.backgroundColor = link.getAttribute('distilbert-original-color');
    } else if (link.style.backgroundColor == link.getAttribute('distilbert-original-color')) {
      link.style.backgroundColor = link.getAttribute('distilbert-detected-color');
    }
  });
}

/**
 * @param {string} url
 * @param {number} maxSteps
 * @return {string|null}
 */
const searchForLink = (url, maxSteps = 10) => {
  const anchor = Array.from(document.querySelectorAll('a')).find((a) => a.href === url);

  for (let iterations = 0; anchor && iterations < maxSteps && !anchor.innerText.trim(); iterations++) {
    anchor = anchor.parentElement;
  }

  return anchor ? anchor.innerText.trim() : null;
};

/**
 * @param {"ham"|"spam"} label
 * @param {string} text
 * @returns {boolean}
 */
const sendFeedback = async (label, text) => {
  /** @type {{server_origin: string}} */
  const { server_origin } = await chrome.storage.local.get(["server_origin"]);

  /** @type {URLSearchParams} */
  const query = new URLSearchParams({ text, label });
  const headers = new Headers({ "ngrok-skip-browser-warning": "anyvalue" });

  const response = await fetchWithRetries(`${server_origin}/feedback?${query}`, { headers });
  if (response === null) {
    return false;
  }

  return response.ok;
};

/**
 * @param {string} menuItemId
 * @returns {FeedbackType}
 */
function extractFeedbackType(menuItemId) {
  return menuItemId.replace(/^report-(?:text|link|all)-feedback-/, "");
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "report-text-feedback-ham":
    case "report-text-feedback-spam":
      feedbackType = extractFeedbackType(info.menuItemId);
      await sendFeedback(feedbackType, info.selectionText);
      break;
    case "report-link-feedback-ham":
    case "report-link-feedback-spam":
      feedbackType = extractFeedbackType(info.menuItemId);
      const linkResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: searchForLink,
        args: [info.linkUrl],
      });
      await sendFeedback(feedbackType, linkResults[0]['result']);
      break;
    case "report-all-feedback-spam":
    case "report-all-feedback-ham":
      feedbackType = extractFeedbackType(info.menuItemId);
      const allResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => Array.from(document.querySelectorAll("a"))
          .map(anchor => anchor.innerText)
          .filter(text => text.split(" ").length >= 3)
          .filter((item, pos, self) => self.indexOf(item) == pos),
      });
      for (const text of allResults[0]['result']) {
        await sendFeedback(feedbackType, text);
      }
      break;
    case "toggle-labels":
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: toggleLabels,
      });
      break;
    default:
      break;
  }
});
