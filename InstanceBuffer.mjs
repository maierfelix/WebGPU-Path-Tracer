import {
  clamp,
  getTransformMatrix
} from "./utils.mjs";

export default class InstanceBuffer {
  constructor({ device, instances, materials, images, geometryBuffer } = _) {
    this.device = device || null;
    this.geometryBuffer = geometryBuffer || null;
    this.buffers = {
      instance: null,
      material: null
    };
    this.containers = [];
    this.init(instances, materials, images);
  }
};

InstanceBuffer.prototype.getInstanceBuffer = function() {
  return this.buffers.instance || null;
};

InstanceBuffer.prototype.getMaterialBuffer = function() {
  return this.buffers.material || null;
};

InstanceBuffer.prototype.getTopLevelContainer = function() {
  return this.containers[0] || null;
};

InstanceBuffer.prototype.build = function() {
  let {device} = this;
  let {containers, geometryBuffer} = this;

  let container = containers[0];

  // build bottom-level containers
  geometryBuffer.build();

  // build top-level containers
  let commandEncoder = device.createCommandEncoder({});
  for (let container of containers) {
    commandEncoder.buildRayTracingAccelerationContainer(container.instance);
  };
  device.getQueue().submit([ commandEncoder.finish() ]);
};

InstanceBuffer.prototype.init = function(instances, materials, images) {
  let {device} = this;
  let {buffers, containers} = this;
  let {geometryBuffer} = this;

  // create copy and insert placeholder material
  let placeHolderMaterial = {
    color: [0, 0, 0],
    metalness: 0.0,
    roughness: 0.0,
    specular: 0.0,
    albedo: null,
    normal: null,
    emission: null,
    metalRoughness: null
  };
  materials = [placeHolderMaterial, ...materials];

  // create material buffer
  let materialBufferStride = 12;
  let materialBufferTotalLength = materials.length * materialBufferStride;
  let materialBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    size: materialBufferTotalLength * Uint32Array.BYTES_PER_ELEMENT
  });
  materialBuffer.byteLength = materialBufferTotalLength * Uint32Array.BYTES_PER_ELEMENT;
  buffers.material = materialBuffer;

  let materialBufferDataBase = new ArrayBuffer(materialBufferTotalLength * 4); 
  let materialBufferDataF32 = new Float32Array(materialBufferDataBase);
  let materialBufferDataU32 = new Uint32Array(materialBufferDataBase);
  for (let ii = 0; ii < materials.length; ++ii) {
    let material = materials[ii];
    let {color} = material;
    let {metalness, roughness, specular} = material;
    let {albedo, normal, emission, metalRoughness} = material;
    let {textureScaling, emissionIntensity} = material;
    let offset = ii * materialBufferStride;
    materialBufferDataF32[offset++] = Math.pow(color[0] / 255.0, 1.0 / 2.2);
    materialBufferDataF32[offset++] = Math.pow(color[1] / 255.0, 1.0 / 2.2);
    materialBufferDataF32[offset++] = Math.pow(color[2] / 255.0, 1.0 / 2.2);
    materialBufferDataF32[offset++] = clamp(parseFloat(metalness), -0.999, 0.999);
    materialBufferDataF32[offset++] = clamp(parseFloat(roughness), -0.999, 0.999);
    materialBufferDataF32[offset++] = clamp(parseFloat(specular),  -0.999, 0.999);
    materialBufferDataF32[offset++] = textureScaling !== void 0 ? textureScaling : 1.0;
    materialBufferDataF32[offset++] = emissionIntensity !== void 0 ? emissionIntensity : 1.0;
    materialBufferDataU32[offset++] = albedo ? images.indexOf(albedo) + 1 : 0;
    materialBufferDataU32[offset++] = normal ? images.indexOf(normal) + 1 : 0;
    materialBufferDataU32[offset++] = emission ? images.indexOf(emission) + 1 : 0;
    materialBufferDataU32[offset++] = metalRoughness ? images.indexOf(metalRoughness) + 1 : 0;
  };
  materialBuffer.setSubData(0, materialBufferDataU32);

  // create instance buffer
  let instanceBufferStride = 16;
  let instanceBufferTotalLength = instances.length * instanceBufferStride;
  let instanceBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    size: instanceBufferTotalLength * Uint32Array.BYTES_PER_ELEMENT
  });
  instanceBuffer.byteLength = instanceBufferTotalLength * Uint32Array.BYTES_PER_ELEMENT;
  buffers.instance = instanceBuffer;

  let instanceBufferDataBase = new ArrayBuffer(instanceBufferTotalLength * 4); 
  let instanceBufferDataF32 = new Float32Array(instanceBufferDataBase);
  let instanceBufferDataU32 = new Uint32Array(instanceBufferDataBase);
  for (let ii = 0; ii < instances.length; ++ii) {
    let {material, geometry, transform} = instances[ii];
    let transformMatrix = getTransformMatrix(transform);
    let offset = ii * instanceBufferStride;
    // transform matrix
    instanceBufferDataF32[offset++] = transformMatrix[0];
    instanceBufferDataF32[offset++] = transformMatrix[1];
    instanceBufferDataF32[offset++] = transformMatrix[2];
    instanceBufferDataF32[offset++] = transformMatrix[3];
    instanceBufferDataF32[offset++] = transformMatrix[4];
    instanceBufferDataF32[offset++] = transformMatrix[5];
    instanceBufferDataF32[offset++] = transformMatrix[6];
    instanceBufferDataF32[offset++] = transformMatrix[7];
    instanceBufferDataF32[offset++] = transformMatrix[8];
    instanceBufferDataF32[offset++] = transformMatrix[9];
    instanceBufferDataF32[offset++] = transformMatrix[10];
    instanceBufferDataF32[offset++] = transformMatrix[11];
    // offsets
    instanceBufferDataU32[offset++] = geometry.attributeOffset;
    instanceBufferDataU32[offset++] = geometry.faceOffset;
    instanceBufferDataU32[offset++] = geometry.faceCount;
    instanceBufferDataU32[offset++] = materials.indexOf(material);
  };
  instanceBuffer.setSubData(0, instanceBufferDataU32);

  // create acceleration container
  let containerInstances = [];
  for (let ii = 0; ii < instances.length; ++ii) {
    let instance = instances[ii];
    let {material, geometry, transform} = instance;
    let instanceEntry = {};
    instanceEntry.flags = GPURayTracingAccelerationInstanceFlag.NONE;
    instanceEntry.mask = 0xFF;
    instanceEntry.instanceId = ii;
    instanceEntry.instanceOffset = 0x0;
    instanceEntry.geometryContainer = geometry.instance;
    if (transform) instanceEntry.transform = transform;
    containerInstances.push(instanceEntry);
  };

  let container = device.createRayTracingAccelerationContainer({
    level: "top",
    flags: GPURayTracingAccelerationContainerFlag.PREFER_FAST_TRACE,
    instances: containerInstances
  });
  containers.push({
    instance: container
  });

};
