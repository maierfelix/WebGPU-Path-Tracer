import {
  calculateTangentsAndBitangents
} from "../utils.mjs";

export default class GeometryBuffer {
  constructor({ device, geometries } = _) {
    this.device = device || null;
    this.buffers = {
      face: null,
      attribute: null
    };
    this.init(geometries);
  }
};

GeometryBuffer.prototype.getFaceBuffer = function() {
  return this.buffers.face || null;
};

GeometryBuffer.prototype.getAttributeBuffer = function() {
  return this.buffers.attribute || null;
};

GeometryBuffer.prototype.init = function(geometries) {
  let {device} = this;
  let {buffers} = this;

  let faceBufferStride = 3;
  let attributeBufferStride = 16;

  // find total geometry buffer sizes
  let faceBufferTotalLength = 0;
  let attributeBufferTotalLength = 0;
  for (let geometry of geometries) {
    let {indices, vertices, normals, uvs} = geometry.data;
    faceBufferTotalLength += indices.length / 3 * faceBufferStride;
    attributeBufferTotalLength += indices.length * attributeBufferStride;
  };

  let faceBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.RAY_TRACING,
    size: faceBufferTotalLength * 4
  });
  faceBuffer.byteLength = faceBufferTotalLength * 4;
  buffers.face = faceBuffer;

  let attributeBuffer = device.createBuffer({
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.RAY_TRACING,
    size: attributeBufferTotalLength * 4
  });
  attributeBuffer.byteLength = attributeBufferTotalLength * 4;
  buffers.attribute = attributeBuffer;

  let faceBufferData = new Uint32Array(faceBufferTotalLength);
  let attributeBufferData = new Float32Array(attributeBufferTotalLength);
  let faceBufferOffset = 0;
  let attributeBufferOffset = 0;
  for (let geometry of geometries) {
    let {indices, vertices, normals, uvs} = geometry.data;

    let {tangents, bitangents} = calculateTangentsAndBitangents(geometry.data);

    // copy each face into the continuous face buffer
    for (let ii = 0; ii < indices.length / 3; ++ii) {
      let index = ii * 3;
      let offset = faceBufferOffset + ii * faceBufferStride;
      faceBufferData[offset++] = index + 0;
      faceBufferData[offset++] = index + 1;
      faceBufferData[offset++] = index + 2;
    };

    // copy each attribute into the continuous attribute buffer
    for (let ii = 0; ii < indices.length; ++ii) {
      let index = indices[ii];
      let offset = attributeBufferOffset + ii * attributeBufferStride;
      attributeBufferData[offset++] = vertices[index * 3 + 0];
      attributeBufferData[offset++] = vertices[index * 3 + 1];
      attributeBufferData[offset++] = vertices[index * 3 + 2];
      attributeBufferData[offset++] = 0.0; // padding
      attributeBufferData[offset++] = normals[index * 3 + 0];
      attributeBufferData[offset++] = normals[index * 3 + 1];
      attributeBufferData[offset++] = normals[index * 3 + 2];
      attributeBufferData[offset++] = 0.0; // padding
      attributeBufferData[offset++] = tangents[index * 3 + 0];
      attributeBufferData[offset++] = tangents[index * 3 + 1];
      attributeBufferData[offset++] = tangents[index * 3 + 2];
      attributeBufferData[offset++] = 0.0; // padding
      attributeBufferData[offset++] = 0.0 + uvs[index * 2 + 0];
      attributeBufferData[offset++] = 1.0 - uvs[index * 2 + 1]; // flip vertical
      attributeBufferData[offset++] = 0.0; // padding
      attributeBufferData[offset++] = 0.0; // padding
    };

    // create acceleration container
    // we can already link the face and attribute buffers
    // even though their data didnt got uploaded yet
    let container = device.createRayTracingAccelerationContainer({
      level: "bottom",
      flags: GPURayTracingAccelerationContainerFlag.PREFER_FAST_TRACE,
      geometries: [
        {
          flags: GPURayTracingAccelerationGeometryFlag.OPAQUE,
          type: "triangles",
          index: {
            buffer: faceBuffer,
            format: "uint32",
            offset: faceBufferOffset * Uint32Array.BYTES_PER_ELEMENT,
            count: indices.length
          },
          vertex: {
            buffer: attributeBuffer,
            format: "float3",
            stride: attributeBufferStride * Float32Array.BYTES_PER_ELEMENT,
            offset: attributeBufferOffset * Float32Array.BYTES_PER_ELEMENT,
            count: vertices.length
          }
        }
      ]
    });

    geometry.setAccelerationContainer({
      instance: container,
      faceOffset: faceBufferOffset,
      faceCount: indices.length,
      attributeOffset: attributeBufferOffset / attributeBufferStride
    });

    faceBufferOffset += indices.length / 3 * faceBufferStride;
    attributeBufferOffset += indices.length * attributeBufferStride;
  };

  // upload
  faceBuffer.setSubData(0, faceBufferData);
  attributeBuffer.setSubData(0, attributeBufferData);

  // build bottom-level containers
  let commandEncoder = device.createCommandEncoder({});
  for (let geometry of geometries) {
    let {accelerationContainer} = geometry;
    commandEncoder.buildRayTracingAccelerationContainer(accelerationContainer.instance);
  };
  device.getQueue().submit([ commandEncoder.finish() ]);
};
