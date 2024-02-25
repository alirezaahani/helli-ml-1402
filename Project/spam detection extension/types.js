/**
 * @typedef {object} Message
 * @property {'classify'|'options'} type
 * @property {object} arguments 
 */

/**
 * @typedef {object} BatchItem
 * @property {string} url
 * @property {string} text 
 */

/**
 * @typedef {object} Prediction
 * @property {number} index 
 * @property {string} text
 * @property {"LABEL_0"|"LABEL_1"} label
 * @property {number} score
 */

/**
 * @typedef {number[]} RGBColor
 * @typedef {string} HEXColor
 */