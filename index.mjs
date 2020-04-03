import WebGPU from "webgpu";

import fs from "fs";
import tolw from "tolw";
import glMatrix from "gl-matrix";
import { performance } from "perf_hooks";

import {
  keyCodeToChar,
  loadShaderFile
} from "./utils.mjs"

import Camera from "./Camera.mjs";
import Settings from "./Settings.mjs";

import RayTracingPass from "./passes/RayTracingPass.mjs";
import RayPickingPass from "./passes/RayPickingPass.mjs";

import Scene from "./Scene.mjs";

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

  let scene = new Scene();

  let MeetMatBodyAlbedo = scene.createTexture().fromPath(`assets/textures/meetmat/02_Body_Base_Color.jpg`);
  let MeetMatBodyNormal = scene.createTexture().fromPath(`assets/textures/meetmat/02_Body_Normal_DirectX.jpg`);
  let MeetMatBodyMetallicRoughness = scene.createTexture().fromPath(`assets/textures/meetmat/02_Body_MetallicRoughness.jpg`);

  let MeetMatHeadAlbedo = scene.createTexture().fromPath(`assets/textures/meetmat/01_Head_Base_Color.jpg`);
  let MeetMatHeadNormal = scene.createTexture().fromPath(`assets/textures/meetmat/01_Head_Normal_DirectX.jpg`);
  let MeetMatHeadMetallicRoughness = scene.createTexture().fromPath(`assets/textures/meetmat/01_Head_MetallicRoughness.jpg`);

  let Fabric19Albedo = scene.createTexture().fromPath(`assets/textures/Fabric19/Fabric19_col.jpg`);
  let Fabric19Normal = scene.createTexture().fromPath(`assets/textures/Fabric19/Fabric19_nrm.jpg`);
  let Fabric19MetallicRoughness = scene.createTexture().fromPath(`assets/textures/Fabric19/Fabric19_met_rgh.jpg`);

  let Plane = scene.createGeometry().fromPath(`assets/models/plane.obj`);
  let MeetMatBody = scene.createGeometry().fromPath(`assets/models/meetmat/body.obj`);
  let MeetMatHead = scene.createGeometry().fromPath(`assets/models/meetmat/head.obj`);
  let Box = scene.createGeometry().fromPath(`assets/models/box.obj`);

  let FloorMaterial = scene.createMaterial({
    color: [0, 0, 0],
    metalness: 0.001,
    roughness: 0.068,
    specular: 0.0117,
    albedoMap: Fabric19Albedo,
    normalMap: Fabric19Normal,
    metalRoughnessMap: Fabric19MetallicRoughness,
    textureScaling: 5.5
  });

  let MeetMatBodyMaterial = scene.createMaterial({
    color: [0, 0, 0],
    metalness: 0.0,
    roughness: 0.0,
    specular: 0.95,
    albedoMap: MeetMatBodyAlbedo,
    normalMap: MeetMatBodyNormal,
    metalRoughnessMap: MeetMatBodyMetallicRoughness,
    metalnessIntensity: 1.0,
    roughnessIntensity: 0.1125,
  });

  let MeetMatHeadMaterial = scene.createMaterial({
    color: [0, 0, 0],
    metalness: 0.0,
    roughness: 0.0,
    specular: 0.95,
    albedoMap: MeetMatHeadAlbedo,
    normalMap: MeetMatHeadNormal,
    metalRoughnessMap: MeetMatHeadMetallicRoughness,
    metalnessIntensity: 1.0,
    roughnessIntensity: 0.1125,
  });

  let LightMaterial0 = scene.createMaterial({
    color: [14600, 14600, 14600]
  });

  let LightMaterial1 = scene.createMaterial({
    color: [12900, 12990, 12800]
  });

  MeetMatBody.addMeshInstance({
    material: MeetMatBodyMaterial,
    transform: {
      translation: { x: -32, y: 0, z: 128 },
      rotation: { x: 0, y: 100, z: 0 },
      scale: { x: 512, y: 512, z: 512 }
    }
  });
  MeetMatHead.addMeshInstance({
    material: MeetMatHeadMaterial,
    transform: {
      translation: { x: -32, y: 0, z: 128 },
      rotation: { x: 0, y: 100, z: 0 },
      scale: { x: 512, y: 512, z: 512 }
    }
  });

  MeetMatBody.addMeshInstance({
    material: MeetMatBodyMaterial,
    transform: {
      translation: { x: 64, y: 0, z: 128 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 512, y: 512, z: 512 }
    }
  });
  MeetMatHead.addMeshInstance({
    material: MeetMatHeadMaterial,
    transform: {
      translation: { x: 64, y: 0, z: 128 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 512, y: 512, z: 512 }
    }
  });

  MeetMatBody.addMeshInstance({
    material: MeetMatBodyMaterial,
    transform: {
      translation: { x: 32, y: 0, z: 256 - 32 },
      rotation: { x: 0, y: 180 + 70, z: 0 },
      scale: { x: 512, y: 512, z: 512 }
    }
  });
  MeetMatHead.addMeshInstance({
    material: MeetMatHeadMaterial,
    transform: {
      translation: { x: 32, y: 0, z: 256 - 32 },
      rotation: { x: 0, y: 180 + 70, z: 0 },
      scale: { x: 512, y: 512, z: 512 }
    }
  });

  Box.addMeshInstance({
    material: FloorMaterial,
    transform: {
      translation: { x: 0, y: 384, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 384, y: 384, z: 384 }
    }
  });

  Plane.addEmitterInstance({
    material: LightMaterial0,
    transform: {
      translation: { x: 0, y: 768 - 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 32, y: 32, z: 32 }
    }
  });

  Plane.addEmitterInstance({
    material: LightMaterial1,
    transform: {
      translation: { x: 0, y: 128, z: 256 + 48 },
      rotation: { x: 116, y: 0, z: 0 },
      scale: { x: 18, y: 12, z: 12 }
    }
  });

  Plane.addEmitterInstance({
    material: LightMaterial1,
    transform: {
      translation: { x: 0, y: 128, z: -128 },
      rotation: { x: -116, y: 0, z: 0 },
      scale: { x: 18, y: 12, z: 12 }
    }
  });

  let rtPass = new RayTracingPass({ device, scene });

  let pixelBuffer = rtPass.getPixelBuffer();
  let instanceContainer = rtPass.getInstanceBuffer().getAccelerationContainer();

  let rpPass = new RayPickingPass({ device, instanceContainer });

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
      module: device.createShaderModule({ code: loadShaderFile(`shaders/blit/screen.vert`) }),
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
  let pickedInstance = null;

  let isLeftMousePressed = false;
  window.onmousedown = e => {
    isLeftMousePressed = e.button === 0;
    // execute ray picking
    if (e.button === 1) {
      rpPass.setMousePickingPosition(e.x, e.y);
      queue.submit([ rpPass.getCommandBuffer() ]);
      rpPass.getPickingResult().then(({ x, y, z, instanceId } = _) => {
        pickedInstanceId = instanceId - 1;
        if (pickedInstanceId >= 0) {
          let instance = scene.getInstanceTransformById(pickedInstanceId);
          pickedInstance = instance;
        }
      });
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
      scene.getLightsFlattened().length,
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

    if (pickedInstanceId >= 0 && pickedInstance) {
      // update instance data
      pickedInstance.data.transform.rotation.y += 0.25;
      instanceContainer.updateInstance(pickedInstanceId, {
        flags: GPURayTracingAccelerationInstanceFlag.NONE,
        mask: 0xFF,
        instanceId: pickedInstanceId,
        instanceOffset: 0x0,
        geometryContainer: pickedInstance.parent.accelerationContainer.instance,
        transform: pickedInstance.data.transform
      });
      // update instance container
      let commandEncoder = device.createCommandEncoder({});
      commandEncoder.updateRayTracingAccelerationContainer(instanceContainer);
      queue.submit([ commandEncoder.finish() ]);
      resetAccumulation = true;
    }

    window.pollEvents();
    if (window.shouldClose()) return;

    setImmediate(drawLoop);
  })();

})();
