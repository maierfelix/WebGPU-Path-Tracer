import WebGPU from "webgpu";

import fs from "fs";
import tolw from "tolw";
import glMatrix from "gl-matrix";
import { performance } from "perf_hooks";

import {
  keyCodeToChar,
  loadShaderFile,
  readImageFile,
  readBinaryFile
} from "./utils.mjs"

import Camera from "./Camera.mjs";
import Settings from "./Settings.mjs";

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

  let settings = new Settings({ device });
  global["settings"] = settings;

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
      albedoMap: images[6],
      normalMap: images[7],
      metalRoughnessMap: images[8],
      textureScaling: 5.5,
    },
    {
      color: [0, 0, 0],
      metalness: 0.0,
      roughness: 0.0,
      specular: 0.95,
      albedoMap: images[0],
      normalMap: images[1],
      metalRoughnessMap: images[2],
      metalnessIntensity: 1.0,
      roughnessIntensity: 0.1125,
    },
    {
      color: [0, 0, 0],
      metalness: 0.0,
      roughness: 0.0,
      specular: 0.95,
      albedoMap: images[3],
      normalMap: images[4],
      metalRoughnessMap: images[5],
      metalnessIntensity: 1.0,
      roughnessIntensity: 0.1125,
    },
    {
      color: [14600, 14600, 14600],
    },
    {
      color: [12900, 12990, 12800],
    }
  ];

  let instances = [
    // body
    {
      material: materials[1],
      geometry: bottomContainers[1],
      transform: {
        translation: { x: -32, y: 0, z: 128 },
        rotation: { x: 0, y: 100, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // head
    {
      material: materials[2],
      geometry: bottomContainers[2],
      transform: {
        translation: { x: -32, y: 0, z: 128 },
        rotation: { x: 0, y: 100, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // body
    {
      material: materials[1],
      geometry: bottomContainers[1],
      transform: {
        translation: { x: 64, y: 0, z: 128 },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // head
    {
      material: materials[2],
      geometry: bottomContainers[2],
      transform: {
        translation: { x: 64, y: 0, z: 128 },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // body
    {
      material: materials[1],
      geometry: bottomContainers[1],
      transform: {
        translation: { x: 32, y: 0, z: 256 - 32 },
        rotation: { x: 0, y: 180 + 70, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // head
    {
      material: materials[2],
      geometry: bottomContainers[2],
      transform: {
        translation: { x: 32, y: 0, z: 256 - 32 },
        rotation: { x: 0, y: 180 + 70, z: 0 },
        scale: { x: 512, y: 512, z: 512 }
      }
    },
    // floor
    {
      material: materials[0],
      geometry: bottomContainers[3],
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
        scale: { x: 18, y: 12, z: 12 }
      }
    },
    // light plane
    {
      material: materials[4],
      geometry: bottomContainers[0],
      transform: {
        translation: { x: 0, y: 128, z: -128 },
        rotation: { x: -116, y: 0, z: 0 },
        scale: { x: 18, y: 12, z: 12 }
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
  let topLevelContainer = rtPass.getInstanceBuffer().getTopLevelContainer();

  let rpPass = new RayPickingPass({ device, topLevelContainer });

  images = null;
  instances = null;
  materials = null;
  geometries = null;

  let blitBindGroupLayout = device.createBindGroupLayout({
    bindings: [
      { binding: 0, type: "storage-buffer", visibility: GPUShaderStage.FRAGMENT },
      { binding: 1, type: "uniform-buffer", visibility: GPUShaderStage.FRAGMENT },
    ]
  });

  let blitBindGroup = device.createBindGroup({
    layout: blitBindGroupLayout,
    bindings: [
      { binding: 0, size: pixelBuffer.byteLength,          buffer: pixelBuffer },
      { binding: 1, size: settings.getBuffer().byteLength, buffer: settings.getBuffer() },
    ]
  });

  let blitPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [blitBindGroupLayout]
    }),
    sampleCount: 1,
    vertexStage: {
      module: device.createShaderModule({   code: loadShaderFile(`shaders/blit/screen.vert`) }),
      entryPoint: "main"
    },
    fragmentStage: {
      module: device.createShaderModule({ code: loadShaderFile(`shaders/blit/screen.frag`) }),
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

  let pickedInstanceId = 0;

  let isLeftMousePressed = false;
  window.onmousedown = e => {
    isLeftMousePressed = e.button === 0;
    // execute ray picking
    if (e.button === 1) {
      rpPass.setMousePickingPosition(e.x, e.y);
      queue.submit([ rpPass.getCommandBuffer() ]);
      rpPass.getPickingResult().then(({ x, y, z, instanceId } = _) => {
        pickedInstanceId = instanceId;
        console.log("Picked Instance:", pickedInstanceId - 1);
      });
    }
  };
  window.onmouseup = e => {
    isLeftMousePressed = false;
  };
  let baseTransform = {
    translation: { x: -32, y: 0, z: 128 },
    rotation: { x: 0, y: -80, z: 0 },
    scale: { x: 512, y: 512, z: 512 }
  };
  window.onmousemove = e => {
    if (!isLeftMousePressed) return;
    camera.deltaMovement.x = e.movementX * 0.25;
    camera.deltaMovement.y = e.movementY * 0.25;
  };
  let resetAccumulation = false;
  window.onmousewheel = e => {
    // aperture
    if (isKeyPressed("Ŕ")) { // shift key
      camera.settings.aperture += e.deltaY * 0.01;
      resetAccumulation = true;
      console.log(`Camera: Aperture: '${camera.settings.aperture}'`);
    }
    // focus distance
    else {
      camera.settings.focusDistance += e.deltaY * 0.125;
      camera.settings.focusDistance = Math.max(0.1, camera.settings.focusDistance);
      resetAccumulation = true;
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

  let frames = 0;
  let then = performance.now();
  (function drawLoop() {
    let now = performance.now();
    let delta = (now - then);
    if (delta > 1.0 || frames === 0) {
      let fps = Math.floor((frames / delta) * 1e3);
      window.title = `WebGPU RT - FPS: ${fps} - SPP: ${camera.settings.sampleCount}`;
      frames = 0;
    }
    frames++;
    then = now;

    camera.update(delta / 1e3);

    // update settings buffer
    settings.getBuffer().setSubData(0, new Uint32Array([
      camera.settings.sampleCount,
      camera.settings.totalSampleCount,
      lights.length,
      window.width,
      window.height
    ]));

    // accumulation
    if (camera.hasMoved) camera.resetAccumulation();
    else camera.increaseAccumulation();

    if (resetAccumulation) {
      camera.resetAccumulation();
      resetAccumulation = false;
    }

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

    queue.submit(commands);

    swapChain.present();

    window.pollEvents();
    if (window.shouldClose()) return;

    setImmediate(drawLoop);
  })();

})();
