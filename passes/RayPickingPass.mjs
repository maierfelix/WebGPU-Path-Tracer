import {
  loadShaderFile
} from "../utils.mjs"

export default class RayPickingPass {
  constructor({ device, instanceContainer } = _) {
    this.device = device || null;
    this.pipeline = null;
    this.bindGroup = null;
    this.pickingBuffer = null;
    this.pickingReadBackBuffer = null;
    this.settingsBuffer = null;
    this.commandBuffer = null;
    this.init(instanceContainer);
  }
};

RayPickingPass.prototype.getPipeline = function() {
  return this.pipeline || null;
};

RayPickingPass.prototype.getBindGroup = function() {
  return this.bindGroup || null;
};

RayPickingPass.prototype.getCommandBuffer = function() {
  let {device} = this;
  let {pipeline, bindGroup} = this;
  // recorde one time, then reuse
  if (this.commandBuffer === null) {
    let commandEncoder = device.createCommandEncoder({});
    let passEncoder = commandEncoder.beginRayTracingPass({});
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.traceRays(
      0, 1, 2,
      1, 1, 1
    );
    passEncoder.endPass();
    this.commandBuffer = commandEncoder.finish();
  }
  return this.commandBuffer;
};

RayPickingPass.prototype.setMousePickingPosition = function(x, y) {
  let {pickingBuffer} = this;
  pickingBuffer.setSubData(0, new Float32Array([x | 0, y | 0]));
};

RayPickingPass.prototype.getPickingResult = async function() {
  let {device} = this;
  let {pickingBuffer, pickingReadBackBuffer} = this;

  let queue = device.getQueue();

  let commandEncoder = device.createCommandEncoder({});
  commandEncoder.copyBufferToBuffer(
    pickingBuffer, 0,
    pickingReadBackBuffer, 0,
    pickingBuffer.byteLength
  );
  queue.submit([ commandEncoder.finish() ]);

  let result = await pickingReadBackBuffer.mapReadAsync();
  let resultF32 = new Float32Array(result);

  let x = resultF32[4];
  let y = resultF32[5];
  let z = resultF32[6];
  let instanceId = resultF32[7];

  pickingReadBackBuffer.unmap();

  return {
    instanceId,
    x, y, z
  };
};

RayPickingPass.prototype.init = function(instanceContainer) {
  let {device} = this;

  let pickingBufferStride = 6;
  let pickingBufferByteLength = pickingBufferStride * 4 * Float32Array.BYTES_PER_ELEMENT;
  let pickingBuffer = device.createBuffer({ usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, size: pickingBufferByteLength });
  pickingBuffer.byteLength = pickingBufferByteLength;

  let pickingReadBackBuffer = device.createBuffer({ usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, size: pickingBuffer.byteLength });
  pickingReadBackBuffer.byteLength = pickingBuffer.byteLength;

  let rayGenShaderModule = device.createShaderModule({ code: loadShaderFile(`shaders/picking/ray-generation.rgen`) });
  let rayCHitModule = device.createShaderModule({      code: loadShaderFile(`shaders/picking/ray-closest-hit.rchit`) });

  let shaderBindingTable = device.createRayTracingShaderBindingTable({
    stages: [
      { module: rayGenShaderModule, stage: GPUShaderStage.RAY_GENERATION },
      { module: rayCHitModule,      stage: GPUShaderStage.RAY_CLOSEST_HIT },
    ],
    groups: [
      { type: "general",             generalIndex:    0 },
      { type: "triangles-hit-group", closestHitIndex: 1 },
    ]
  });

  let bindGroupLayout = device.createBindGroupLayout({
    bindings: [
      { binding: 0, type: "acceleration-container", visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 1, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 2, type: "uniform-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 3, type: "uniform-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
    ]
  });

  let bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    bindings: [
      { binding: 0, size: 0,                               accelerationContainer: instanceContainer },
      { binding: 1, size: pickingBuffer.byteLength,        buffer: pickingBuffer },
      { binding: 2, size: camera.getBuffer().byteLength,   buffer: camera.getBuffer() },
      { binding: 3, size: settings.getBuffer().byteLength, buffer: settings.getBuffer() },
    ]
  });

  let pipeline = device.createRayTracingPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    }),
    rayTracingState: {
      shaderBindingTable,
      maxRecursionDepth: 1
    }
  });

  this.pipeline = pipeline;
  this.bindGroup = bindGroup;
  this.pickingBuffer = pickingBuffer;
  this.pickingReadBackBuffer = pickingReadBackBuffer;
};
