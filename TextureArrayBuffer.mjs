import {
  readPNGFile
} from "./utils.mjs"

export default class TextureArrayBuffer {
  constructor({ device, images } = _) {
    this.device = device || null;
    this.sampler = null;
    this.texture = null;
    this.textureView = null;
    this.init(images);
  }
};

TextureArrayBuffer.prototype.getTextureSampler = function() {
  return this.sampler;
};

TextureArrayBuffer.prototype.getTextureView = function() {
  return this.textureView;
};

TextureArrayBuffer.prototype.init = function(images) {
  let {device} = this;

  let queue = device.getQueue();

  let initialWidth = images[0].width;
  let initialHeight = images[0].height;
  for (let ii = 1; ii < images.length; ++ii) {
    let image = images[ii];
    if (image.width !== initialWidth) {
      throw new Error(`Expected image width of '${initialWidth}' but got '${image.width}'`);
    }
    else if (image.height !== initialHeight) {
      throw new Error(`Expected image height of '${initialHeight}' but got '${image.height}'`);
    }
    else if (image.width !== image.height) {
      throw new Error(`Image width '${image.width}' match image height ${image.height}`);
    }
  };

  // create copy and insert placeholder image
  let placeHolderImage = {
    data: new Uint8ClampedArray(initialWidth * initialHeight * 4),
    width: initialWidth,
    height: initialHeight
  };
  images = [placeHolderImage, ...images];

  let sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat",
    addressModeW: "repeat"
  });

  let texture = device.createTexture({
    size: {
      width: initialWidth,
      height: initialHeight,
      depth: 1
    },
    arrayLayerCount: images.length,
    mipLevelCount: 1,
    sampleCount: 1,
    dimension: "2d",
    format: "rgba8unorm-srgb",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED
  });

  let textureView = texture.createView({
    dimension: "2d-array",
    baseArrayLayer: 0,
    arrayLayerCount: images.length,
    format: "rgba8unorm-srgb"
  });

  let rowPitch = Math.ceil(initialWidth * 4 / 256) * 256;
  let textureData = new Uint8Array(rowPitch * initialHeight);
  let textureCopyBuffer = device.createBuffer({
    size: textureData.byteLength,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  for (let ii = 0; ii < images.length; ++ii) {
    let image = images[ii];

    // copy image data into buffer
    textureCopyBuffer.setSubData(0, image.data);

    let commandEncoder = device.createCommandEncoder({});
    commandEncoder.copyBufferToTexture(
      {
        buffer: textureCopyBuffer,
        rowPitch: rowPitch,
        arrayLayer: 0,
        mipLevel: 0,
        imageHeight: 0
      },
      {
        texture: texture,
        mipLevel: 0,
        arrayLayer: ii,
        origin: { x: 0, y: 0, z: 0 }
      },
      {
        width: image.width,
        height: image.height,
        depth: 1
      }
    );
    queue.submit([ commandEncoder.finish() ]);
  };

  this.sampler = sampler;
  this.texture = texture;
  this.textureView = textureView;
};
