export default class TextureArrayBuffer {
  constructor({ device, textures } = _) {
    this.device = device || null;
    this.sampler = null;
    this.texture = null;
    this.textureView = null;
    this.init(textures);
  }
};

TextureArrayBuffer.prototype.getTextureSampler = function() {
  return this.sampler || null;
};

TextureArrayBuffer.prototype.getTextureView = function() {
  return this.textureView || null;
};

TextureArrayBuffer.prototype.init = function(textures) {
  let {device} = this;

  let queue = device.getQueue();

  let initialWidth = textures[0] ? textures[0].data.width : 16;
  let initialHeight = textures[0] ? textures[0].data.height : 16;
  for (let ii = 1; ii < textures.length; ++ii) {
    let {data, width, height} = textures[ii].data;
    if (width !== initialWidth) {
      throw new Error(`Expected image width of '${initialWidth}' but got '${width}'`);
    }
    else if (height !== initialHeight) {
      throw new Error(`Expected image height of '${initialHeight}' but got '${height}'`);
    }
    else if (width !== height) {
      throw new Error(`Image width '${width}' match image height ${height}`);
    }
  };

  // create copy and insert placeholder image
  let placeHolderTexture = {
    data: {
      data: new Uint8ClampedArray(initialWidth * initialHeight * 4),
      width: initialWidth,
      height: initialHeight
    }
  };
  textures = [placeHolderTexture, ...textures];

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
    arrayLayerCount: textures.length,
    mipLevelCount: 1,
    sampleCount: 1,
    dimension: "2d",
    format: "rgba8unorm-srgb",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED
  });

  let textureView = texture.createView({
    dimension: "2d-array",
    baseArrayLayer: 0,
    arrayLayerCount: textures.length,
    format: "rgba8unorm-srgb"
  });

  let bytesPerRow = Math.ceil(initialWidth * 4 / 256) * 256;
  let textureData = new Uint8Array(bytesPerRow * initialHeight);
  let textureCopyBuffer = device.createBuffer({
    size: textureData.byteLength,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  });
  for (let ii = 0; ii < textures.length; ++ii) {
    let {data, width, height} = textures[ii].data;

    // copy image data into buffer
    textureCopyBuffer.setSubData(0, data);

    let commandEncoder = device.createCommandEncoder({});
    commandEncoder.copyBufferToTexture(
      {
        buffer: textureCopyBuffer,
        bytesPerRow: bytesPerRow,
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
        width: width,
        height: height,
        depth: 1
      }
    );
    queue.submit([ commandEncoder.finish() ]);
  };

  this.sampler = sampler;
  this.texture = texture;
  this.textureView = textureView;
};
