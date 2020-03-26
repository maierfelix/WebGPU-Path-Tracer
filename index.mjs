import WebGPU from "webgpu";

import fs from "fs";
import tolw from "tolw";
import glMatrix from "gl-matrix";

import {
  keyCodeToChar,
  loadShaderFile,
  readImageFile,
  readBinaryFile
} from "./utils.mjs"

import Camera from "./Camera.mjs";
import LightBuffer from "./LightBuffer.mjs";
import GeometryBuffer from "./GeometryBuffer.mjs";
import InstanceBuffer from "./InstanceBuffer.mjs";
import TextureArrayBuffer from "./TextureArrayBuffer.mjs";

Object.assign(global, WebGPU);
Object.assign(global, glMatrix);

(async function main() {

  await tolw.init();

  let window = new WebGPUWindow({
    width: 1280,
    height: 768,
    title: "WebGPU RT",
    resizable: false
  });
  global["window"] = window;

  let adapter = await GPU.requestAdapter({
    window,
    preferredBackend: "Vulkan"
  });

  let device = await adapter.requestDevice();

  let camera = new Camera({ device });
  global["camera"] = camera;

  let queue = device.getQueue();

  let context = window.getContext("webgpu");

  let swapChainFormat = await context.getSwapChainPreferredFormat(device);

  let swapChain = context.configureSwapChain({
    device: device,
    format: swapChainFormat
  });

  let images = [
    readImageFile(`assets/textures/meetmat/02_Body_Base_Color.png`),
    readImageFile(`assets/textures/meetmat/02_Body_Normal_DirectX.png`),
    readImageFile(`assets/textures/meetmat/02_Body_MetallicRoughness.png`),
    readImageFile(`assets/textures/meetmat/01_Head_Base_Color.png`),
    readImageFile(`assets/textures/meetmat/01_Head_Normal_DirectX.png`),
    readImageFile(`assets/textures/meetmat/01_Head_MetallicRoughness.png`),
    readImageFile(`assets/textures/stringy-marbel/stringy_marble_albedo.png`),
    readImageFile(`assets/textures/stringy-marbel/stringy_marble_Normal-dx.png`),
    readImageFile(`assets/textures/stringy-marbel/stringy_marble_metallic_roughness.png`)
  ];

  let geometries = [
    tolw.loadObj(readBinaryFile(`assets/models/plane.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/box.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/meetmat/body.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/meetmat/head.obj`)),
  ];

  let vertexShaderModule = device.createShaderModule({        code: loadShaderFile(`shaders/screen.vert`) });
  let fragmentShaderModule = device.createShaderModule({      code: loadShaderFile(`shaders/screen.frag`) });
  let rayGenShaderModule = device.createShaderModule({        code: loadShaderFile(`shaders/ray-generation.rgen`) });
  let rayCHitModule = device.createShaderModule({             code: loadShaderFile(`shaders/ray-closest-hit.rchit`) });
  let rayMissShaderModule = device.createShaderModule({       code: loadShaderFile(`shaders/ray-miss.rmiss`) });
  let rayShadowCHitShaderModule = device.createShaderModule({ code: loadShaderFile(`shaders/shadow-ray-closest-hit.rchit`) });
  let rayShadowMissShaderModule = device.createShaderModule({ code: loadShaderFile(`shaders/shadow-ray-miss.rmiss`) });

  let pixelBufferByteLength = window.width * window.height * 4 * Float32Array.BYTES_PER_ELEMENT;
  let pixelBuffer = device.createBuffer({ usage: GPUBufferUsage.STORAGE, size: pixelBufferByteLength });
  pixelBuffer.byteLength = pixelBufferByteLength;

  let accumulationBufferByteLength = window.width * window.height * 4 * Float32Array.BYTES_PER_ELEMENT;
  let accumulationBuffer = device.createBuffer({ usage: GPUBufferUsage.STORAGE, size: accumulationBufferByteLength });
  accumulationBuffer.byteLength = accumulationBufferByteLength;

  let geometryBuffer = new GeometryBuffer({ device, geometries });

  let faceBuffer = geometryBuffer.getFaceBuffer();
  let attributeBuffer = geometryBuffer.getAttributeBuffer();
  let bottomContainers = geometryBuffer.getBottomLevelContainers();

  let materials = [
    {
      color: [0, 0, 0],
      metalness: 0.001,
      roughness: 0.028,
      specular: 0.0317,
      albedo: images[6],
      normal: images[7],
      metalRoughness: images[8],
      textureScaling: 8.0,
    },
    {
      color: [0, 0, 0],
      metalness: 0.3,
      roughness: -0.2,
      specular: 0.95,
      albedo: images[0],
      normal: images[1],
      metalRoughness: images[2],
    },
    {
      color: [0, 0, 0],
      metalness: 0.3,
      roughness: -0.2,
      specular: 0.95,
      albedo: images[3],
      normal: images[4],
      metalRoughness: images[5],
    },
    {
      color: [21768, 22832, 21768],
    }
  ];

  let instances = [
    // box
    {
      material: materials[0],
      geometry: bottomContainers[1],
      transform: {
        translation: { x: 0, y: 384, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 384, y: 384, z: 384 }
      }
    },
    // body
    {
      material: materials[1],
      geometry: bottomContainers[2],
      transform: {
        translation: { x: -32, y: 0, z: 128 },
        rotation: { x: 0, y: -80, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // head
    {
      material: materials[2],
      geometry: bottomContainers[3],
      transform: {
        translation: { x: -32, y: 0, z: 128 },
        rotation: { x: 0, y: -80, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // body
    {
      material: materials[1],
      geometry: bottomContainers[2],
      transform: {
        translation: { x: 64, y: 0, z: 128 },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // head
    {
      material: materials[2],
      geometry: bottomContainers[3],
      transform: {
        translation: { x: 64, y: 0, z: 128 },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // body
    {
      material: materials[1],
      geometry: bottomContainers[2],
      transform: {
        translation: { x: 32, y: 0, z: 256 - 32 },
        rotation: { x: 0, y: 180 + 70, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // head
    {
      material: materials[2],
      geometry: bottomContainers[3],
      transform: {
        translation: { x: 32, y: 0, z: 256 - 32 },
        rotation: { x: 0, y: 180 + 70, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // light plane
    {
      material: materials[3],
      geometry: bottomContainers[0],
      transform: {
        translation: { x: 0, y: 64, z: 256 + 16 },
        rotation: { x: 90, y: 0, z: 0 },
        scale: { x: 128, y: 14, z: 0.0001 }
      }
    }
  ];

  let lights = [
    {
      instance: instances[instances.length - 1]
    }
  ];

  let instanceBuffer = new InstanceBuffer({ device, instances, materials, images, geometryBuffer });
  instanceBuffer.build();

  let materialBuffer = instanceBuffer.getMaterialBuffer();
  let instancesBuffer = instanceBuffer.getInstanceBuffer();
  let instanceContainer = instanceBuffer.getTopLevelContainer();

  let textureArray = new TextureArrayBuffer({ device, images });
  let textureView = textureArray.getTextureView();
  let textureSampler = textureArray.getTextureSampler();

  let lightBuffer = new LightBuffer({ device, instances, lights });
  let lightsBuffer = lightBuffer.getLightBuffer();

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

  let rtBindGroupLayout = device.createBindGroupLayout({
    bindings: [
      { binding: 0, type: "acceleration-container", visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 1, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 2, type: "uniform-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 3, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION },
      { binding: 4, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 5, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 6, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 7, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 8, type: "storage-buffer",         visibility: GPUShaderStage.RAY_GENERATION | GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 9, type: "sampler",                visibility: GPUShaderStage.RAY_CLOSEST_HIT },
      { binding: 10, type: "sampled-texture",       visibility: GPUShaderStage.RAY_CLOSEST_HIT, textureDimension: "2d-array" },
    ]
  });

  let rtBindGroup = device.createBindGroup({
    layout: rtBindGroupLayout,
    bindings: [
      { binding: 0,  size: 0,                             accelerationContainer: instanceContainer.instance },
      { binding: 1,  size: pixelBuffer.byteLength,        buffer: pixelBuffer },
      { binding: 2,  size: camera.buffer.byteLength,      buffer: camera.buffer },
      { binding: 3,  size: accumulationBuffer.byteLength, buffer: accumulationBuffer },
      { binding: 4,  size: attributeBuffer.byteLength,    buffer: attributeBuffer },
      { binding: 5,  size: faceBuffer.byteLength,         buffer: faceBuffer },
      { binding: 6,  size: instancesBuffer.byteLength,    buffer: instancesBuffer },
      { binding: 7,  size: materialBuffer.byteLength,     buffer: materialBuffer },
      { binding: 8,  size: lightsBuffer.byteLength,       buffer: lightsBuffer },
      { binding: 9,  size: 0,                             sampler: textureSampler },
      { binding: 10, size: 0,                             textureView: textureView },
    ]
  });

  let rtPipeline = device.createRayTracingPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [rtBindGroupLayout]
    }),
    rayTracingState: {
      shaderBindingTable,
      maxRecursionDepth: 1
    }
  });

  let blitBindGroupLayout = device.createBindGroupLayout({
    bindings: [
      { binding: 0, type: "storage-buffer", visibility: GPUShaderStage.FRAGMENT },
    ]
  });

  let blitBindGroup = device.createBindGroup({
    layout: blitBindGroupLayout,
    bindings: [
      { binding: 0, size: pixelBuffer.byteLength, buffer: pixelBuffer },
    ]
  });

  let blitPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [blitBindGroupLayout]
    }),
    sampleCount: 1,
    vertexStage: {
      module: vertexShaderModule,
      entryPoint: "main"
    },
    fragmentStage: {
      module: fragmentShaderModule,
      entryPoint: "main"
    },
    primitiveTopology: "triangle-list",
    vertexState: {
      indexFormat: "uint32",
      vertexBuffers: []
    },
    rasterizationState: {
      frontFace: "CCW",
      cullMode: "none"
    },
    colorStates: [{
      format: swapChainFormat,
      alphaBlend: {},
      colorBlend: {}
    }]
  });

  let isLeftMousePressed = false;
  window.onmousedown = e => {
    isLeftMousePressed = true;
  };
  window.onmouseup = e => {
    isLeftMousePressed = false;
  };
  window.onmousemove = e => {
    if (!isLeftMousePressed) return;
    camera.deltaMovement.x = e.movementX * 0.25;
    camera.deltaMovement.y = e.movementY * 0.25;
  };

  let keys = {};
  window.onkeydown = function(e) {
    let {keyCode} = e;
    let key = keyCodeToChar(keyCode);
    keys[key] = 1;
  };
  window.onkeyup = function(e) {
    let {keyCode} = e;
    let key = keyCodeToChar(keyCode);
    keys[key] = 0;
  };
  global.isKeyPressed = function isKeyPressed(key) {
    return keys[key] === 1;
  };

  let delta = 0;
  let last = Date.now();
  function onFrame(now = Date.now()) {
    delta = (now - last) / 1e3;
    last = now;

    camera.update(delta);

    let backBufferView = swapChain.getCurrentTextureView();

    // ray tracing pass
    {
      let commandEncoder = device.createCommandEncoder({});
      let passEncoder = commandEncoder.beginRayTracingPass({});
      passEncoder.setPipeline(rtPipeline);
      passEncoder.setBindGroup(0, rtBindGroup);
      passEncoder.traceRays(
        0, 1, 3,
        window.width, window.height, 1
      );
      passEncoder.endPass();
      queue.submit([ commandEncoder.finish() ]);
    }
    // raster pass
    {
      let commandEncoder = device.createCommandEncoder({});
      let passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          clearColor: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
          attachment: backBufferView
        }]
      });
      passEncoder.setPipeline(blitPipeline);
      passEncoder.setBindGroup(0, blitBindGroup);
      passEncoder.draw(3, 1, 0, 0);
      passEncoder.endPass();
      queue.submit([ commandEncoder.finish() ]);
    }

    swapChain.present();

    window.pollEvents();
    if (window.shouldClose()) return;

    setImmediate(() => onFrame());
  };

  setTimeout(() => onFrame(), 1e3 / 60);

})();
