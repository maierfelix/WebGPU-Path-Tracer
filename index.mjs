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

import GeometryBuffer from "./GeometryBuffer.mjs";

import RayTracingPass from "./RayTracingPass.mjs";
import RayPickingPass from "./RayPickingPass.mjs";

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
    readImageFile(`assets/textures/meetmat/02_Body_Base_Color.jpg`),
    readImageFile(`assets/textures/meetmat/02_Body_Normal_DirectX.jpg`),
    readImageFile(`assets/textures/meetmat/02_Body_MetallicRoughness.jpg`),
    readImageFile(`assets/textures/meetmat/01_Head_Base_Color.jpg`),
    readImageFile(`assets/textures/meetmat/01_Head_Normal_DirectX.jpg`),
    readImageFile(`assets/textures/meetmat/01_Head_MetallicRoughness.jpg`),
    readImageFile(`assets/textures/Fabric19/Fabric19_col.jpg`),
    readImageFile(`assets/textures/Fabric19/Fabric19_nrm.jpg`),
    readImageFile(`assets/textures/Fabric19/Fabric19_met_rgh.jpg`)
  ];

  let geometries = [
    tolw.loadObj(readBinaryFile(`assets/models/plane.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/sphere.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/meetmat/body.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/meetmat/head.obj`)),
    tolw.loadObj(readBinaryFile(`assets/models/box.obj`)),
  ];

  let geometryBuffer = new GeometryBuffer({ device, geometries });
  let bottomContainers = geometryBuffer.getBottomLevelContainers();

  let materials = [
    {
      color: [0, 0, 0],
      metalness: 0.001,
      roughness: 0.068,
      specular: 0.0117,
      albedo: images[6],
      normal: images[7],
      metalRoughness: images[8],
      textureScaling: 5.5,
    },
    {
      color: [0, 0, 0],
      metalness: 0.5,
      roughness: -0.1634,
      specular: 0.95,
      albedo: images[0],
      normal: images[1],
      metalRoughness: images[2],
    },
    {
      color: [0, 0, 0],
      metalness: 0.5,
      roughness: -0.1634,
      specular: 0.95,
      albedo: images[3],
      normal: images[4],
      metalRoughness: images[5],
    },
    {
      color: [1460000, 1460000, 1460000],
    },
    {
      color: [1290000, 1299000, 1280000],
    }
  ];

  let instances = [
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
    // floor
    {
      material: materials[0],
      geometry: bottomContainers[4],
      transform: {
        translation: { x: 0, y: 384, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 384, y: 384, z: 384 }
      }
    },
    // light plane
    {
      material: materials[3],
      geometry: bottomContainers[0],
      transform: {
        translation: { x: 0, y: 768 - 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 32, y: 32, z: 32 }
      }
    },
    // light plane
    {
      material: materials[4],
      geometry: bottomContainers[0],
      transform: {
        translation: { x: 0, y: 128, z: 256 + 48 },
        rotation: { x: 116, y: 0, z: 0 },
        scale: { x: 32, y: 8, z: 8 }
      }
    },
    // light plane
    {
      material: materials[4],
      geometry: bottomContainers[0],
      transform: {
        translation: { x: 0, y: 128, z: -256 - 48 },
        rotation: { x: -116, y: 0, z: 0 },
        scale: { x: 64, y: 12, z: 12 }
      }
    },
  ];

  let lights = [
    {
      instance: instances[instances.length - 3]
    },
    {
      instance: instances[instances.length - 2]
    },
    {
      instance: instances[instances.length - 1]
    }
  ];

  let rtPass = new RayTracingPass({
    device, instances, materials, images, lights, geometryBuffer
  });

  let pixelBuffer = rtPass.getPixelBuffer();
  let settingsBuffer = rtPass.getSettingsBuffer();
  let topLevelContainer = rtPass.getInstanceBuffer().getTopLevelContainer();

  let rpPass = new RayPickingPass({ device, topLevelContainer });

  let blitBindGroupLayout = device.createBindGroupLayout({
    bindings: [
      { binding: 0, type: "storage-buffer", visibility: GPUShaderStage.FRAGMENT },
      { binding: 1, type: "uniform-buffer", visibility: GPUShaderStage.FRAGMENT },
    ]
  });

  let blitBindGroup = device.createBindGroup({
    layout: blitBindGroupLayout,
    bindings: [
      { binding: 0, size: pixelBuffer.byteLength, buffer: pixelBuffer },
      { binding: 1, size: settingsBuffer.byteLength, buffer: settingsBuffer },
    ]
  });

  let blitPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [blitBindGroupLayout]
    }),
    sampleCount: 1,
    vertexStage: {
      module: device.createShaderModule({   code: loadShaderFile(`shaders/screen.vert`) }),
      entryPoint: "main"
    },
    fragmentStage: {
      module: device.createShaderModule({ code: loadShaderFile(`shaders/screen.frag`) }),
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

  let pickingState = {
    mouseX: 0,
    mouseY: 0,
    needsPicking: false
  };

  let isLeftMousePressed = false;
  window.onmousedown = e => {
    isLeftMousePressed = true;
    if (e.button === 0) {
      pickingState.mouseX = e.x;
      pickingState.mouseY = e.y;
      pickingState.needsPicking = true;
    }
  };
  window.onmouseup = e => {
    isLeftMousePressed = false;
  };
  window.onmousemove = e => {
    if (!isLeftMousePressed) return;
    camera.deltaMovement.x = e.movementX * 0.25;
    camera.deltaMovement.y = e.movementY * 0.25;
  };
  let rofl = false;
  window.onmousewheel = e => {
    // aperture
    if (isKeyPressed("Ŕ")) { // shift key
      camera.settings.aperture += e.deltaY * 0.01;
      rofl = true;
      console.log(`Camera: Aperture: '${camera.settings.aperture}'`);
    }
    // focus distance
    else {
      camera.settings.focusDistance += e.deltaY * 0.125;
      camera.settings.focusDistance = Math.max(0.1, camera.settings.focusDistance);
      rofl = true;
      console.log(`Camera: Focus-Distance: '${camera.settings.focusDistance}'`);
    }
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
  (function onFrame(now = Date.now()) {
    delta = (now - last) / 1e3;
    last = now;

    camera.update(delta);

    // accumulation
    if (camera.hasMoved) camera.resetAccumulation();
    else camera.increaseAccumulation();

    if (rofl) {
      camera.resetAccumulation();
      rofl = false;
    }

    // upload sample stats
    settingsBuffer.setSubData(0, new Uint32Array([
      camera.settings.sampleCount,
      camera.settings.totalSampleCount
    ]));

    let backBufferView = swapChain.getCurrentTextureView();

    let commands = [];

    // ray tracing pass
    commands.push(rtPass.getCommandBuffer());

    // blit pass
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
      commands.push(commandEncoder.finish());
    }

    // execute ray picking
    if (pickingState.needsPicking) {
      commands.push(rpPass.getCommandBuffer());
      pickingState.needsPicking = false;
      queue.submit(commands);
      let pickingResult = rpPass.getPickingResult();
    } else {
      queue.submit(commands);
    }

    swapChain.present();

    window.pollEvents();
    if (window.shouldClose()) return;

    setImmediate(() => onFrame());
  })();

})();
