const HEX2RGB = hex =>
hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i
            ,(m, r, g, b) => '#' + r + r + g + g + b + b)
  .substring(1).match(/.{2}/g)
  .map(x => parseInt(x, 16));

const RGB2HEX = color => '#' + color.map(x => {
  const hex = x.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}).join('')

const saveOptions = async (e) => {
  e.preventDefault();
  chrome.storage.local.set({
    web_server_url: document.querySelector("#web_server").value,
    spam_color: HEX2RGB(document.querySelector("#spam_color").value),
  });
};

const restoreOptions = async () => {
  const { web_server_url } = await chrome.storage.local.get(["web_server_url"]);
  document.querySelector("#web_server").value = web_server_url || "http://127.0.0.1:5000";
  
  const { spam_color } = await chrome.storage.local.get(["spam_color"]);
  document.querySelector("#spam_color").value = RGB2HEX(spam_color || [255, 0, 0]);
};

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
