import {
  loadShaderFile
} from "../utils.mjs"

import GeometryBuffer from "../buffers/GeometryBuffer.mjs";
import InstanceBuffer from "../buffers/InstanceBuffer.mjs";
import TextureArrayBuffer from "../buffers/TextureArrayBuffer.mjs";

export default class RayTracingPass {
  constructor({ device, scene } = _) {
    this.device = device || null;
    this.pipeline = null;
    this.bindGroup = null;
    this.pixelBuffer = null;
    this.commandBuffer = null;
    this.init(scene);
  }
};

RayTracingPass.prototype.getPipeline = function() {
  return this.pipeline || null;
};

RayTracingPass.prototype.getBindGroup = function() {
  return this.bindGroup || null;
};

RayTracingPass.prototype.getPixelBuffer = function() {
  return this.pixelBuffer || null;
};

RayTracingPass.prototype.getInstanceBuffer = function() {
  return this.instanceBuffer || null;
};

RayTracingPass.prototype.getCommandBuffer = function() {
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

RayTracingPass.prototype.init = function(scene) {
  let {device} = this;

  let {textures, materials, geometries} = scene.objects;

  let instances = scene.getInstancesFlattened();
  let lights = scene.getLightsFlattened();

  let geometryBuffer = new GeometryBuffer({ device, geometries });

  let faceBuffer = geometryBuffer.getFaceBuffer();
  let attributeBuffer = geometryBuffer.getAttributeBuffer();

  let instanceBuffer = new InstanceBuffer({ device, instances, geometries, materials, textures, lights });

  let materialBuffer = instanceBuffer.getMaterialBuffer();
  let instancesBuffer = instanceBuffer.getInstanceBuffer();
  let lightsBuffer = instanceBuffer.getLightBuffer();

  let instanceContainer = instanceBuffer.getAccelerationContainer();

  let textureArray = new TextureArrayBuffer({ device, textures });
  let textureView = textureArray.getTextureView();
  let textureSampler = textureArray.getTextureSampler();

  let pixelBufferByteLength = window.width * window.height * 4 * Float32Array.BYTES_PER_ELEMENT;
  let pixelBuffer = device.createBuffer({ usage: GPUBufferUsage.STORAGE, size: pixelBufferByteLength });
  pixelBuffer.byteLength = pixelBufferByteLength;

  let accumulationBufferByteLength = window.width * window.height * 4 * Float32Array.BYTES_PER_ELEMENT;
  let accumulationBuffer = device.createBuffer({ usage: GPUBufferUsage.STORAGE, size: accumulationBufferByteLength });
  accumulationBuffer.byteLength = accumulationBufferByteLength;

  let rayGenShaderModule = device.createShaderModule({        code: loadShaderFile(`shaders/shading/ray-generation.rgen`) });
  let rayCHitModule = device.createShaderModule({             code: loadShaderFile(`shaders/shading/ray-closest-hit.rchit`) });
  let rayMissShaderModule = device.createShaderModule({       code: loadShaderFile(`shaders/shading/ray-miss.rmiss`) });
  let rayShadowCHitShaderModule = device.createShaderModule({ code: loadShaderFile(`shaders/shading/shadow-ray-closest-hit.rchit`) });
  let rayShadowMissShaderModule = device.createShaderModule({ code: loadShaderFile(`shaders/shading/shadow-ray-miss.rmiss`) });

  let shaderBindingTable = device.createRayTracingShaderBindingTable({
    stages: [
      { module: rayGenShaderModule,        stage: GPUShaderStage.RAY_GENERATION },
      { module: rayCHitModule,             stage: GPUShaderStage.RAY_CLOSEST_HIT },
      { module: rayShadowCHitShaderModule, stage: GPUShaderStage.RAY_CLOSEST_HIT },
      { module: rayMissShaderModule,       stage: GPUShaderStage.RAY_MISS },
      { module: rayShadowMissShaderModule, stage: GPUShaderStage.RAY_MISS },
    ],
    groups: [
      { type: "general",             generalIndex:    0 },
      { type: "triangles-hit-group", closestHitIndex: 1 },
      { type: "triangles-hit-group", closestHitIndex: 2 },
      { type: "general",             generalIndex:    3 },
      { type: "general",             generalIndex:    4 },
    ]
  });

  let bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0,  type: "acceleration-container", visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 1,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 2,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 3,  type: "uniform-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 4,  type: "uniform-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 5,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 6,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 7,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 8,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 9,  type: "storage-buffer",         visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 10, type: "sampler",                visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 11, type: "sampled-texture",        visibility: GPUShaderStage.RAY_CLOSEST_HIT, viewDimension: "2d-array" },
    ]
  });

  let bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0,  size: 0,                               accelerationContainer: instanceContainer },
      { binding: 1,  size: pixelBuffer.byteLength,          buffer: pixelBuffer },
      { binding: 2,  size: accumulationBuffer.byteLength,   buffer: accumulationBuffer },
      { binding: 3,  size: camera.getBuffer().byteLength,   buffer: camera.getBuffer() },
      { binding: 4,  size: settings.getBuffer().byteLength, buffer: settings.getBuffer() },
      { binding: 5,  size: attributeBuffer.byteLength,      buffer: attributeBuffer },
      { binding: 6,  size: faceBuffer.byteLength,           buffer: faceBuffer },
      { binding: 7,  size: instancesBuffer.byteLength,      buffer: instancesBuffer },
      { binding: 8,  size: materialBuffer.byteLength,       buffer: materialBuffer },
      { binding: 9,  size: lightsBuffer.byteLength,         buffer: lightsBuffer },
      { binding: 10, size: 0,                               sampler: textureSampler },
      { binding: 11, size: 0,                               textureView: textureView },
    ]
  });

  let pipeline = device.createRayTracingPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    }),
    rayTracingState: {
      shaderBindingTable,
      maxRecursionDepth: 2
    }
  });

  this.pipeline = pipeline;
  this.bindGroup = bindGroup;
  this.pixelBuffer = pixelBuffer;
  this.instanceBuffer = instanceBuffer;
};
