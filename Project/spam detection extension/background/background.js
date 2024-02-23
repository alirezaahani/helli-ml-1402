chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.storage.local.set({
    web_server_url: "http://127.0.0.1:8000",
    spam_color: [255, 0, 0],
  });
})

let contentPort;

const contentPortResponse = async ({ type, arguments }) => {
  if(type === "classify") {
    onClassifyRequest(arguments);
  }
}

chrome.runtime.onConnect.addListener(async (p) => {
  if (p.name === "distil-bert-port") {
    contentPort = p;
    contentPort.onMessage.addListener(contentPortResponse);

    const { spam_color } = await chrome.storage.local.get(["spam_color"]);
    contentPort.postMessage({ type: "options", arguments: { spam_color: spam_color } })
  }
});

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

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

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
  }

  if (request === null) {
    return;
  }

  const results = await request.json();

  for (let i = 0; i < results.length; i++) {
    if (results[i]["label"] == "LABEL_0") {
      continue;
    }

    contentPort.postMessage({
      type: "classify",
      arguments: {
        url: batch[i]["url"],
        score: results[i]["score"],
      }
    });
  }
};

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

chrome.contextMenus.create(
  {
    id: "toggle-labels",
    title: "Visual: Toggle spam reports",
    contexts: ["all"],
  },
  () => void chrome.runtime.lastError
);

const toggle_labels = () => {
  document.querySelectorAll(`a[distilbert-spam="true"]`).forEach((link) => {
      if(link.style.backgroundColor == link.getAttribute('distilbert-detected-color')) {
          link.style.backgroundColor = link.getAttribute('distilbert-original-color');
      } else if (link.style.backgroundColor == link.getAttribute('distilbert-original-color')) {
          link.style.backgroundColor = link.getAttribute('distilbert-detected-color'); 
      }
  });
} 

const search_for_link = (url) => {
  let anchor = Array.from(document.querySelectorAll("a")).filter(
    (anchor) => anchor.href === url
  )[0];

  for (let i = 0; i < 10 && anchor.innerText == ''; i++) {
    anchor = anchor.parentElement
  }

  return anchor.innerText
}

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
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: search_for_link,
          args: [info.linkUrl]
        }).then(results => {
          sendFeedback(
            info.menuItemId.replace("report-link-feedback-", ""),
            results[0]['result']
          );
        })
      break;
    case "toggle-labels":
      chrome.scripting
        .executeScript({
          target: { tabId : tab.id },
          func: toggle_labels,
        })
        break;
    default:
      break;
  }
});
