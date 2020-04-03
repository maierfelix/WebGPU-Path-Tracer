import {
  clamp,
  getTransformMatrix
} from "../utils.mjs";

export default class InstanceBuffer {
  constructor({ device, instances, materials, textures, lights } = _) {
    this.device = device || null;
    this.buffers = {
      instance: null,
      material: null,
      light: null
    };
    this.accelerationContainer = null;
    this.init(instances, materials, textures, lights);
  }
};

InstanceBuffer.prototype.getInstanceBuffer = function() {
  return this.buffers.instance || null;
};

InstanceBuffer.prototype.getMaterialBuffer = function() {
  return this.buffers.material || null;
};

InstanceBuffer.prototype.getLightBuffer = function() {
  return this.buffers.light || null;
};

InstanceBuffer.prototype.getAccelerationContainer = function() {
  return this.accelerationContainer || null;
};

InstanceBuffer.prototype.updateInstance = function(instanceId, instance) {
  let {device} = this;
  let {buffers, accelerationContainer} = this;
  let {transform} = instance.data;

  let matrices = getTransformMatrix(transform);

  // transform matrix
  // padding
  // normal matrix
  let buffer = new ArrayBuffer(
    (3 * 4) * 4 +
    (4)     * 4 +
    (4 * 4) * 4
  );
  let viewF32 = new Float32Array(buffer);

  viewF32.set(matrices.transform, 0x0);
  viewF32.set(matrices.normal, 3 * 4 + 4);

  buffers.instance.setSubData(
    instance.instanceBufferByteOffset,
    viewF32
  );

  accelerationContainer.updateInstance(instanceId, {
    flags: GPURayTracingAccelerationInstanceFlag.NONE,
    mask: 0xFF,
    instanceId: instanceId,
    instanceOffset: 0x0,
    geometryContainer: instance.parent.accelerationContainer.instance,
    transform: transform
  });

};

InstanceBuffer.prototype.init = function(instances, materials, textures, lights) {
  let {device} = this;
  let {buffers} = this;

  // create copy and insert placeholder material
  let placeHolderMaterial = { data: {} };
  materials = [placeHolderMaterial, ...materials];

  // create material buffer
  let materialBufferStride = 20;
  let materialBufferTotalLength = materials.length * materialBufferStride;
  let materialBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    size: materialBufferTotalLength * 4
  });
  materialBuffer.byteLength = materialBufferTotalLength * 4;
  buffers.material = materialBuffer;

  let materialBufferDataBase = new ArrayBuffer(materialBufferTotalLength * 4); 
  let materialBufferDataF32 = new Float32Array(materialBufferDataBase);
  let materialBufferDataU32 = new Uint32Array(materialBufferDataBase);
  for (let ii = 0; ii < materials.length; ++ii) {
    let material = materials[ii].data;
    let {color, emission} = material;
    let {metalness, roughness, specular} = material;
    let {textureScaling} = material;
    let {albedoMap, normalMap, emissionMap, metalRoughnessMap} = material;
    let {emissionIntensity, metalnessIntensity, roughnessIntensity} = material;
    let offset = ii * materialBufferStride;
    materialBufferDataF32[offset++] = color !== void 0 ? Math.pow(color[0] / 255.0, 1.0 / 2.2) : 0.0;
    materialBufferDataF32[offset++] = color !== void 0 ? Math.pow(color[1] / 255.0, 1.0 / 2.2) : 0.0;
    materialBufferDataF32[offset++] = color !== void 0 ? Math.pow(color[2] / 255.0, 1.0 / 2.2) : 0.0;
    materialBufferDataF32[offset++] = 0.0; // alpha
    materialBufferDataF32[offset++] = emission !== void 0 ? Math.pow(emission[0] / 255.0, 1.0 / 2.2) : 0.0;
    materialBufferDataF32[offset++] = emission !== void 0 ? Math.pow(emission[1] / 255.0, 1.0 / 2.2) : 0.0;
    materialBufferDataF32[offset++] = emission !== void 0 ? Math.pow(emission[2] / 255.0, 1.0 / 2.2) : 0.0;
    materialBufferDataF32[offset++] = 0.0; // alpha
    materialBufferDataF32[offset++] = clamp(parseFloat(metalness), 0.001, 0.999);
    materialBufferDataF32[offset++] = clamp(parseFloat(roughness), 0.001, 0.999);
    materialBufferDataF32[offset++] = clamp(parseFloat(specular),  0.001, 0.999);
    materialBufferDataF32[offset++] = textureScaling !== void 0 ? parseFloat(textureScaling) : 1.0;
    materialBufferDataU32[offset++] = albedoMap ? textures.indexOf(albedoMap) + 1 : 0;
    materialBufferDataU32[offset++] = normalMap ? textures.indexOf(normalMap) + 1 : 0;
    materialBufferDataU32[offset++] = emissionMap ? textures.indexOf(emissionMap) + 1 : 0;
    materialBufferDataU32[offset++] = metalRoughnessMap ? textures.indexOf(metalRoughnessMap) + 1 : 0;
    materialBufferDataF32[offset++] = emissionIntensity !== void 0 ? parseFloat(emissionIntensity) : 1.0;
    materialBufferDataF32[offset++] = metalnessIntensity !== void 0 ? parseFloat(metalnessIntensity) : 1.0;
    materialBufferDataF32[offset++] = roughnessIntensity !== void 0 ? parseFloat(roughnessIntensity) : 1.0;
    materialBufferDataF32[offset++] = 0.0; // padding
  };
  materialBuffer.setSubData(0, materialBufferDataU32);

  // create instance buffer
  let instanceBufferStride = 36;
  let instanceBufferTotalLength = instances.length * instanceBufferStride;
  let instanceBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    size: instanceBufferTotalLength * 4
  });
  instanceBuffer.byteLength = instanceBufferTotalLength * 4;
  buffers.instance = instanceBuffer;

  let instanceBufferDataBase = new ArrayBuffer(instanceBufferTotalLength * 4); 
  let instanceBufferDataF32 = new Float32Array(instanceBufferDataBase);
  let instanceBufferDataU32 = new Uint32Array(instanceBufferDataBase);
  for (let ii = 0; ii < instances.length; ++ii) {
    let instance = instances[ii];
    let geometry = instance.parent;
    let {accelerationContainer} = geometry;
    let {material, transform} = instance.data;
    let matrices = getTransformMatrix(transform);
    let offset = ii * instanceBufferStride;
    instance.instanceBufferByteOffset = offset * 4;
    // transform matrix
    instanceBufferDataF32[offset++] = matrices.transform[0];
    instanceBufferDataF32[offset++] = matrices.transform[1];
    instanceBufferDataF32[offset++] = matrices.transform[2];
    instanceBufferDataF32[offset++] = matrices.transform[3];
    instanceBufferDataF32[offset++] = matrices.transform[4];
    instanceBufferDataF32[offset++] = matrices.transform[5];
    instanceBufferDataF32[offset++] = matrices.transform[6];
    instanceBufferDataF32[offset++] = matrices.transform[7];
    instanceBufferDataF32[offset++] = matrices.transform[8];
    instanceBufferDataF32[offset++] = matrices.transform[9];
    instanceBufferDataF32[offset++] = matrices.transform[10];
    instanceBufferDataF32[offset++] = matrices.transform[11];
    instanceBufferDataF32[offset++] = 0.0; // padding
    instanceBufferDataF32[offset++] = 0.0; // padding
    instanceBufferDataF32[offset++] = 0.0; // padding
    instanceBufferDataF32[offset++] = 0.0; // padding
    // normal matrix
    instanceBufferDataF32[offset++] = matrices.normal[0];
    instanceBufferDataF32[offset++] = matrices.normal[1];
    instanceBufferDataF32[offset++] = matrices.normal[2];
    instanceBufferDataF32[offset++] = matrices.normal[3];
    instanceBufferDataF32[offset++] = matrices.normal[4];
    instanceBufferDataF32[offset++] = matrices.normal[5];
    instanceBufferDataF32[offset++] = matrices.normal[6];
    instanceBufferDataF32[offset++] = matrices.normal[7];
    instanceBufferDataF32[offset++] = matrices.normal[8];
    instanceBufferDataF32[offset++] = matrices.normal[9];
    instanceBufferDataF32[offset++] = matrices.normal[10];
    instanceBufferDataF32[offset++] = matrices.normal[11];
    instanceBufferDataF32[offset++] = matrices.normal[12];
    instanceBufferDataF32[offset++] = matrices.normal[13];
    instanceBufferDataF32[offset++] = matrices.normal[14];
    instanceBufferDataF32[offset++] = matrices.normal[15];
    // offsets
    instanceBufferDataU32[offset++] = accelerationContainer.attributeOffset;
    instanceBufferDataU32[offset++] = accelerationContainer.faceOffset;
    instanceBufferDataU32[offset++] = accelerationContainer.faceCount;
    instanceBufferDataU32[offset++] = materials.indexOf(material);
  };
  instanceBuffer.setSubData(0, instanceBufferDataU32);

  // create light buffer
  let lightBufferStride = 4;
  let lightBufferTotalLength = lights.length * lightBufferStride;
  let lightBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    size: lightBufferTotalLength * 4
  });
  lightBuffer.byteLength = lightBufferTotalLength * 4;
  buffers.light = lightBuffer;

  let lightBufferDataBase = new ArrayBuffer(lightBufferTotalLength * 4); 
  let lightBufferDataF32 = new Float32Array(lightBufferDataBase);
  let lightBufferDataU32 = new Uint32Array(lightBufferDataBase);
  for (let ii = 0; ii < lights.length; ++ii) {
    let light = lights[ii];
    let {instance} = light;
    let offset = ii * lightBufferStride;
    lightBufferDataU32[offset++] = instances.indexOf(light);
    lightBufferDataF32[offset++] = 0.0; // padding
    lightBufferDataF32[offset++] = 0.0; // padding
    lightBufferDataF32[offset++] = 0.0; // padding
  };
  lightBuffer.setSubData(0, lightBufferDataU32);

  // create acceleration container
  let geometryInstances = [];
  for (let ii = 0; ii < instances.length; ++ii) {
    let instance = instances[ii];
    let geometry = instance.parent;
    let {accelerationContainer} = geometry;
    let {material, transform} = instance.data;
    let instanceEntry = {};
    instanceEntry.flags = GPURayTracingAccelerationInstanceFlag.FORCE_OPAQUE;
    instanceEntry.mask = 0xFF;
    instanceEntry.instanceId = ii;
    instanceEntry.instanceOffset = 0x0;
    instanceEntry.geometryContainer = accelerationContainer.instance;
    if (transform) instanceEntry.transform = transform;
    geometryInstances.push(instanceEntry);
  };

  let accelerationContainer = device.createRayTracingAccelerationContainer({
    level: "top",
    flags: GPURayTracingAccelerationContainerFlag.ALLOW_UPDATE | GPURayTracingAccelerationContainerFlag.PREFER_FAST_TRACE,
    instances: geometryInstances
  });

  // build top-level containers
  let commandEncoder = device.createCommandEncoder({});
  commandEncoder.buildRayTracingAccelerationContainer(accelerationContainer);
  device.getQueue().submit([ commandEncoder.finish() ]);

  this.accelerationContainer = accelerationContainer;
};
