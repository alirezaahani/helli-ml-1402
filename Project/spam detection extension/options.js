/**
 * @typedef {import('types.js').HEXColor} HEXColor
 * @typedef {import('types.js').RGBColor} RGBColor
 */

/**
 * Converts a hex color to a rgb color
 * @param {HEXColor} hex
 * @returns {RGBColor}
 */
const HEX2RGB = hex =>
hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i,(m, r, g, b) => '#' + r + r + g + g + b + b)
  .substring(1).match(/.{2}/g)
  .map(x => parseInt(x, 16));


/**
 * Converts a rgb color to a hex color
 * @param {RGBColor} rgb
 * @returns {HEXColor}
 */
const RGB2HEX = rgb => '#' + rgb.map(x => {
  const hex = x.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}).join('')


/**
 * Saves the settings and options
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
 * Restores the options from the local storage
 * @async
 */
const restoreOptions = async () => {
  /** @type {{server_origin: URL}} */
  const { server_origin } = await chrome.storage.local.get(['server_origin']);
  document.querySelector('#web_server').value = server_origin;

  /** @type {RGBColor} */
  const spam_color = await chrome.storage.local.get(['spam_color'])['spam_color'] || [255, 0, 0];
  document.querySelector('#spam_color').value = RGB2HEX(spam_color);
};
document.addEventListener("DOMContentLoaded", restoreOptions);
