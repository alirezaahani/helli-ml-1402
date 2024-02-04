const saveOptions = async (e) => {
  e.preventDefault();
  chrome.storage.local.set({
    web_server_url: document.querySelector("#web_server").value,
  });
};

const restoreOptions = async () => {
  const { web_server_url } = await chrome.storage.local.get(["web_server_url"]);
  document.querySelector("#web_server").value =
    web_server_url || "http://127.0.0.1:5000";
};

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
