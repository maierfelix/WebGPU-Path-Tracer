export default class LightBuffer {
  constructor({ device, instances, lights } = _) {
    this.device = device || null;
    this.buffers = {
      light: null
    };
    this.init(instances, lights);
  }
};

LightBuffer.prototype.getLightBuffer = function() {
  return this.buffers.light || null;
};

LightBuffer.prototype.init = function(instances, lights) {
  let {device} = this;
  let {buffers} = this;

  // create copy and insert placeholder light
  let placeHolderLight = {
    instance: 0
  };
  lights = [placeHolderLight, ...lights];

  // create light buffer
  let lightBufferStride = 4;
  let lightBufferTotalLength = lights.length * lightBufferStride;
  let lightBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    size: lightBufferTotalLength * Uint32Array.BYTES_PER_ELEMENT
  });
  lightBuffer.byteLength = lightBufferTotalLength * Uint32Array.BYTES_PER_ELEMENT;
  buffers.light = lightBuffer;

  let lightBufferDataBase = new ArrayBuffer(lightBufferTotalLength * 4); 
  let lightBufferDataF32 = new Float32Array(lightBufferDataBase);
  let lightBufferDataU32 = new Uint32Array(lightBufferDataBase);
  for (let ii = 0; ii < lights.length; ++ii) {
    let light = lights[ii];
    let {instance} = light;
    let offset = ii * lightBufferStride;
    lightBufferDataU32[offset++] = instances.indexOf(instance);
    lightBufferDataF32[offset++] = 0.0; // padding
    lightBufferDataF32[offset++] = 0.0; // padding
    lightBufferDataF32[offset++] = 0.0; // padding
  };
  lightBuffer.setSubData(0, lightBufferDataU32);
};
