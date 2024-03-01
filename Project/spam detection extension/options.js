/**
 * @typedef {import('types.js').HEXColor} HEXColor
 * @typedef {import('types.js').RGBColor} RGBColor
 */

/**
 * @param {HEXColor} hex
 * @returns {RGBColor}
 */
const HEX2RGB = hex =>
hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i,(m, r, g, b) => '#' + r + r + g + g + b + b)
  .substring(1).match(/.{2}/g)
  .map(x => parseInt(x, 16));

/**
 * @param {RGBColor} rgb
 * @returns {HEXColor}
 */
const RGB2HEX = rgb => '#' + rgb.map(x => {
  const hex = x.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}).join('')

/**
 * @param {Event} e
 * @async
 */
const saveOptions = async (e) => {
  e.preventDefault();
  chrome.storage.local.set({
    server_origin: new URL(document.querySelector("#web_server").value).origin,
    spam_color: HEX2RGB(document.querySelector("#spam_color").value),
  });
};
document.querySelector("form").addEventListener("submit", saveOptions);

/**
 * @async
 */
const restoreOptions = async () => {
  /** @type {{server_origin: URL}} */
  const { server_origin } = await chrome.storage.local.get(['server_origin']);
  document.querySelector('#web_server').value = server_origin;

  /** @type {{spam_color: RGBColor}} */
  const { spam_color } = await chrome.storage.local.get(['spam_color']);
  document.querySelector('#spam_color').value = RGB2HEX(spam_color);

  const response_log = document.querySelector('#web_server_response');
  response_log.innerText = "Sending to server ...";
  const headers = new Headers({ "ngrok-skip-browser-warning": "anyvalue" });
  
  fetch(`${server_origin}/test`, { headers }).then(res => {
    if (res.ok) {
      response_log.innerText = "Tested connection to server: Success";
    } else {
      response_log.innerText = "Tested connection to server: Failure";
    }
  }).catch(err => { 
    response_log.innerText = "Tested connection to server: Failure"; 
  })

};
document.addEventListener("DOMContentLoaded", restoreOptions);