import {
  loadShaderFile
} from "./utils.mjs"

import LightBuffer from "./LightBuffer.mjs";
import InstanceBuffer from "./InstanceBuffer.mjs";
import TextureArrayBuffer from "./TextureArrayBuffer.mjs";

export default class RayPickingPass {
  constructor({ device, topLevelContainer } = _) {
    this.device = device || null;
    this.pipeline = null;
    this.bindGroup = null;
    this.pickingBuffer = null;
    this.pickingReadBackBuffer = null;
    this.settingsBuffer = null;
    this.commandBuffer = null;
    this.init(topLevelContainer);
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
      0, 1, 3,
      window.width, window.height, 1
    );
    passEncoder.endPass();
    this.commandBuffer = commandEncoder.finish();
  }
  return this.commandBuffer;
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
  let data = new Float32Array(new Float32Array(result));

  let [x, y, z, instanceId] = data;
  console.log("Position:", x, y, z);
  console.log("InstanceId:", instanceId);
  console.log("Result before:", result.byteLength);

  pickingReadBackBuffer.unmap();
  console.log("Result after:", result.byteLength);
  console.log("######");
};

RayPickingPass.prototype.init = function(topLevelContainer) {
  let {device} = this;

  let pickingBufferStride = 4;
  let pickingBufferByteLength = pickingBufferStride * 4 * Float32Array.BYTES_PER_ELEMENT;
  let pickingBuffer = device.createBuffer({ usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, size: pickingBufferByteLength });
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
    ]
  });

  let bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    bindings: [
      { binding: 0, size: 0,                        accelerationContainer: topLevelContainer.instance },
      { binding: 1, size: pickingBuffer.byteLength, buffer: pickingBuffer },
      { binding: 2, size: camera.buffer.byteLength, buffer: camera.buffer },
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
