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
})


/** @type {chrome.runtime.Port} */
let contentPort;

/**
 * Receives responses from content script 
 * @param {Message} response
 */
const contentPortResponse = async ({ type, arguments }) => {
  if(type === "classify") {
    onClassifyRequest(arguments['batch']);
  }
}

/**
 * Setups initial channel to background script and sends the related options. 
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
 * Sends feedback to the server, handles ngrok warning by sending a value with the request.
 * @param {"ham"|"spam"} label
 * @param {string} text
 * @returns {boolean}
 */
const sendFeedback = async (label, text) => {
  /** @type {{server_origin: string}} */
  const { server_origin } = await chrome.storage.local.get(["server_origin"]);

  /** @type {URLSearchParams} */
  const query = new URLSearchParams({ text, label });

  try {
    return (await fetch(`${server_origin}/feedback?${query}`, {
      headers: new Headers({
        "ngrok-skip-browser-warning": "anyvalue",
      }),
    })).ok;
  } catch (e) {
    return false;
  }
};


/**
 * Classifies the batch of links send by content script
 * @param {BatchItem[]} batch
 */
const onClassifyRequest = async (batch) => {
  /** @type {{server_origin: string}} */
  const { server_origin } = await chrome.storage.local.get(["server_origin"]);
  
  let query = new URLSearchParams();

  batch.forEach((item) => query.append("q", item["text"]));

  /** @type {?Response} */
  let request = null;

  for (let i = 0; i < 10; i++) {
    request = await fetch(`${server_origin}/classify?${query}`, {
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


  /** @type {Prediction[]} */
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

chrome.contextMenus.create(
  {
    id: "report-all-feedback-ham",
    title: "Feedback: Report all links as ham",
    contexts: ["all"],
  },
  () => void chrome.runtime.lastError
);

chrome.contextMenus.create(
  {
    id: "report-all-feedback-spam",
    title: "Feedback: Report all links as spam",
    contexts: ["all"],
  },
  () => void chrome.runtime.lastError
);


/**
 * Toggles the labels set by the content script, injected in the website
 */
const toggle_labels = () => {
  document.querySelectorAll(`a[distilbert-spam="true"]`).forEach((link) => {
      if(link.style.backgroundColor == link.getAttribute('distilbert-detected-color')) {
          link.style.backgroundColor = link.getAttribute('distilbert-original-color');
      } else if (link.style.backgroundColor == link.getAttribute('distilbert-original-color')) {
          link.style.backgroundColor = link.getAttribute('distilbert-detected-color'); 
      }
  });
} 


/**
 * Searches for a link's text in the DOM
 * @param {string} url
 * @return {string} 
 */
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
    case "report-all-feedback-spam":
    case "report-all-feedback-ham":
      chrome.scripting
        .executeScript({
          target: { tabId : tab.id },
          func: () => Array.from(document.querySelectorAll("a"))
              .map(anchor => anchor.innerText)
              .filter(text => text.split(" ").length >= 3)
              .filter((item, pos, self) => self.indexOf(item) == pos),
        })
        .then(results => {
          results[0]['result']
          .forEach(text =>
            sendFeedback(info.menuItemId.replace("report-all-feedback-", ""), text)
          )
        })
        break;
    default:
      break;
  }
});
