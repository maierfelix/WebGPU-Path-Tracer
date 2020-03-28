import {
  fixateToZero
} from "./utils.mjs";

export default class Settings {
  constructor({ device } = _) {
    this.device = device || null;
    this.buffer = null;
    this.init();
  }
};

Settings.prototype.getBuffer = function() {
  return this.buffer || null;
};

Settings.prototype.init = function() {
  let {device} = this;
  let settingsBufferByteLength = 8 * Float32Array.BYTES_PER_ELEMENT;
  let settingsBuffer = device.createBuffer({
    size: settingsBufferByteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
  });
  settingsBuffer.byteLength = settingsBufferByteLength;
  this.buffer = settingsBuffer;
};
