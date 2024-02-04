let classifyPort;
let linkRequestPort;

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const sendFeedback = async (label, text) => {
  const { web_server_url } = await chrome.storage.local.get(["web_server_url"]);

  const query = new URLSearchParams({ text, label });
  const request = await fetch(`${web_server_url}/feedback?${query}`, {
    headers: new Headers({
      "ngrok-skip-browser-warning": "anyvalue",
    }),
  });

  if (request.ok) {
    chrome.notifications.create({
      iconUrl: chrome.runtime.getURL("icons/link-48.png"),
      type: "basic",
      title: "DsitilBert feedback",
      message: `Reported as ${label}`,
    });
  }
};

const onClassifyRequest = async ({ batch }) => {
  const { web_server_url } = await chrome.storage.local.get(["web_server_url"]);

  let query = new URLSearchParams();

  batch.forEach((item) => query.append("q", item["text"]));

  let request = null;

  for (let i = 0; i < 10; i++) {
    request = await fetch(`${web_server_url}/classify?${query}`, {
      headers: new Headers({
        "ngrok-skip-browser-warning": "anyvalue",
      }),
    });

    if (request.ok) {
      break;
    }

    request = null;
    await timer(1000);
  }

  if (request === null) {
    return;
  }

  const results = await request.json();

  for (let i = 0; i < results.length; i++) {
    if (results[i]["label"] == "LABEL_0") {
      continue;
    }

    classifyPort.postMessage({
      url: batch[i]["url"],
      score: results[i]["score"],
    });
  }
};

const onLinkRequestResponse = async ({ text, label }) => {
  console.log(text, label)
  sendFeedback(label, text);
};

chrome.runtime.onConnect.addListener(async (p) => {
  if (p.name == "distil-bert-classify-port") {
    classifyPort = p;
    classifyPort.onMessage.addListener(onClassifyRequest);
  }
  if (p.name == "distil-bert-link-request-port") {
    linkRequestPort = p;
    linkRequestPort.onMessage.addListener(onLinkRequestResponse);
  }
});

chrome.contextMenus.create(
  {
    id: "report-text-feedback-spam",
    title: "Feedback: Report text as spam",
    contexts: ["selection"],
  },
  () => void chrome.runtime.lastError
);

chrome.contextMenus.create(
  {
    id: "report-text-feedback-ham",
    title: "Feedback: Report text as ham",
    contexts: ["selection"],
  },
  () => void chrome.runtime.lastError
);

chrome.contextMenus.create(
  {
    id: "report-link-feedback-spam",
    title: "Feedback: Report link title as spam",
    contexts: ["link"],
  },
  () => void chrome.runtime.lastError
);

chrome.contextMenus.create(
  {
    id: "report-link-feedback-ham",
    title: "Feedback: Report link title as ham",
    contexts: ["link"],
  },
  () => void chrome.runtime.lastError
);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "report-text-feedback-ham":
    case "report-text-feedback-spam":
      sendFeedback(
        info.menuItemId.replace("report-text-feedback-", ""),
        info.selectionText
      );
      break;
    case "report-link-feedback-ham":
    case "report-link-feedback-spam":
      linkRequestPort.postMessage({
        url: info.linkUrl,
        label: info.menuItemId.replace("report-link-feedback-", ""),
      });
      break;
    default:
      break;
  }
});
