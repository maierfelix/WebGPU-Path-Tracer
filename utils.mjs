import fs from "fs";
import path from "path";
import lodepng from "@cwasm/lodepng";
import jpegturbo from "@cwasm/jpeg-turbo";

export function clamp(value, min, max) {
  return Math.max(Math.min(max, value), min);
};

export function keyCodeToChar(code) {
  return String.fromCharCode((96 <= code && code <= 105) ? code - 48 : code);
};

export function readBinaryFile(path) {
  let buffer = fs.readFileSync(path);
  let {byteOffset, byteLength} = buffer;
  return new Uint8Array(buffer.buffer).subarray(byteOffset, byteOffset + byteLength);
};

export function readImageFile(path) {
  let buf = fs.readFileSync(path);
  if (isPNGFile(buf)) return readPNGFile(buf);
  if (isJPEGFile(buf)) return readJPEGFile(buf);
  throw new Error(`Cannot process image file '${path}'`);
};

export function readPNGFile(buf) {
  return lodepng.decode(buf);
};

export function readJPEGFile(buf) {
  return jpegturbo.decode(buf);
};

export function isPNGFile(buffer) {
  let viewU8 = new Uint8Array(buffer);
  let offset = 0x0;
  return (
    viewU8[offset++] === 0x89 &&
    viewU8[offset++] === 0x50 &&
    viewU8[offset++] === 0x4E &&
    viewU8[offset++] === 0x47
  );
};

export function isJPEGFile(buffer) {
  let viewU8 = new Uint8Array(buffer);
  let offset = 0x0;
  return (
    viewU8[offset++] === 0xFF &&
    viewU8[offset++] === 0xD8 &&
    viewU8[offset++] === 0xFF &&
    viewU8[offset++] === 0xE0
  );
};

function findIncludedFile(filePath, includes) {
  let matches = [];
  for (let ii = 0; ii < includes.length; ++ii) {
    let incl = includes[ii];
    let stats = fs.lstatSync(incl);
    if (!stats.isDirectory()) {
      throw new SyntaxError(`Include path '${incl}' is not a directory`);
    }
    let includeFilePath = path.join(incl, filePath);
    if (fs.existsSync(includeFilePath) && fs.lstatSync(includeFilePath).isFile()) {
      try {
        matches.push(fs.readFileSync(includeFilePath, "utf-8"));
      } catch (e) {
        throw new ReferenceError(`Cannot read included file from '${includeFilePath}'`);
      }
    } else {
      throw new ReferenceError(`Failed to resolve file include path for '${filePath}': '${includeFilePath}' is not a valid file path`);
    }
  };
  if (matches.length <= 0) {
    throw new ReferenceError(`Cannot inline included file '${filePath}'`);
  }
  if (matches.length > 1) {
    throw new ReferenceError(`Ambigious include directive for '${filePath}'. More than one match was found`);
  }
  return matches[0];
};

function flattenShaderIncludes(source, includeDirectories) {
  let rx = /#include ((<[^>]+>)|("[^"]+"))/g;
  let match = null;
  while (match = rx.exec(source)) {
    let filePath = match[1].slice(1, -1);
    let start = match.index;
    let length = match[0].length;
    let includedFile = flattenShaderIncludes(
      findIncludedFile(filePath, includeDirectories),
      includeDirectories
    );
    source = source.substr(0, start) + includedFile + source.substr(start + length);
  };
  return source;
};

export function loadShaderFile(srcPath) {
  let src = fs.readFileSync(srcPath, "utf-8");
  let flattened = flattenShaderIncludes(src, [path.dirname(srcPath)]);
  return flattened;
};

let mModel = null;
let mTransform = null;
export function getTransformMatrix(transform) {
  let {scale, rotation, translation} = transform;

  if (mModel === null) mModel = mat4.create();
  if (mTransform === null) mTransform = mat4.create().subarray(0, 12);

  mat4.identity(mModel);
  mat4.identity(mTransform);

  // translation
  mat4.translate(mModel, mModel, vec3.fromValues(translation.x, translation.y, translation.z));
  // rotation
  mat4.rotateX(mModel, mModel, rotation.x * (Math.PI / 180));
  mat4.rotateY(mModel, mModel, rotation.y * (Math.PI / 180));
  mat4.rotateZ(mModel, mModel, rotation.z * (Math.PI / 180));
  // scaling
  mat4.scale(mModel, mModel, vec3.fromValues(scale.x, scale.y, scale.z));

  // build transform matrix
  mTransform.set(mModel.subarray(0x0, 12), 0x0);
  mTransform[3] = mModel[12];
  mTransform[7] = mModel[13];
  mTransform[11] = mModel[14];

  return mTransform;
};

export function calculateTangentsAndBitangents(object) {
  let {vertices, normals, uvs, indices} = object;

  let tangents = new Float32Array(vertices.length);
  let bitangents = new Float32Array(vertices.length);
  for (let ii = 0; ii < indices.length; ii += 3) {
    let i0 = indices[ii + 0];
    let i1 = indices[ii + 1];
    let i2 = indices[ii + 2];

    let xv0 = vertices[i0 * 3 + 0];
    let yv0 = vertices[i0 * 3 + 1];
    let zv0 = vertices[i0 * 3 + 2];

    let xuv0 = uvs[i0 * 2 + 0];
    let yuv0 = uvs[i0 * 2 + 1];

    let xv1 = vertices[i1 * 3 + 0];
    let yv1 = vertices[i1 * 3 + 1];
    let zv1 = vertices[i1 * 3 + 2];

    let xuv1 = uvs[i1 * 2 + 0];
    let yuv1 = uvs[i1 * 2 + 1];

    let xv2 = vertices[i2 * 3 + 0];
    let yv2 = vertices[i2 * 3 + 1];
    let zv2 = vertices[i2 * 3 + 2];

    let xuv2 = uvs[i2 * 2 + 0];
    let yuv2 = uvs[i2 * 2 + 1];

    let deltaPosX1 = xv1 - xv0;
    let deltaPosY1 = yv1 - yv0;
    let deltaPosZ1 = zv1 - zv0;

    let deltaPosX2 = xv2 - xv0;
    let deltaPosY2 = yv2 - yv0;
    let deltaPosZ2 = zv2 - zv0;

    let uvDeltaPosX1 = xuv1 - xuv0;
    let uvDeltaPosY1 = yuv1 - yuv0;

    let uvDeltaPosX2 = xuv2 - xuv0;
    let uvDeltaPosY2 = yuv2 - yuv0;

    let rInv = uvDeltaPosX1 * uvDeltaPosY2 - uvDeltaPosY1 * uvDeltaPosX2;
    let r = 1.0 / (Math.abs(rInv < 0.0001) ? 1.0 : rInv);

    // tangent
    let xt = (deltaPosX1 * uvDeltaPosY2 - deltaPosX2 * uvDeltaPosY1) * r;
    let yt = (deltaPosY1 * uvDeltaPosY2 - deltaPosY2 * uvDeltaPosY1) * r;
    let zt = (deltaPosZ1 * uvDeltaPosY2 - deltaPosZ2 * uvDeltaPosY1) * r;

    // bitangent
    let xb = (deltaPosX2 * uvDeltaPosX1 - deltaPosX1 * uvDeltaPosX2) * r;
    let yb = (deltaPosY2 * uvDeltaPosX1 - deltaPosY1 * uvDeltaPosX2) * r;
    let zb = (deltaPosZ2 * uvDeltaPosX1 - deltaPosZ1 * uvDeltaPosX2) * r;

    // orthogonalize
    let xn0 = normals[i0 * 3 + 0];
    let yn0 = normals[i0 * 3 + 1];
    let zn0 = normals[i0 * 3 + 2];

    let xn1 = normals[i1 * 3 + 0];
    let yn1 = normals[i1 * 3 + 1];
    let zn1 = normals[i1 * 3 + 2];

    let xn2 = normals[i2 * 3 + 0];
    let yn2 = normals[i2 * 3 + 1];
    let zn2 = normals[i2 * 3 + 2];

    // tangent
    let xTangent0 = xt - xn0 * (xt * xn0 + yt * yn0 + zt * zn0);
    let yTangent0 = yt - yn0 * (xt * xn0 + yt * yn0 + zt * zn0);
    let zTangent0 = zt - zn0 * (xt * xn0 + yt * yn0 + zt * zn0);

    let xTangent1 = xt - xn1 * (xt * xn1 + yt * yn1 + zt * zn1);
    let yTangent1 = yt - yn1 * (xt * xn1 + yt * yn1 + zt * zn1);
    let zTangent1 = zt - zn1 * (xt * xn1 + yt * yn1 + zt * zn1);

    let xTangent2 = xt - xn2 * (xt * xn2 + yt * yn2 + zt * zn2);
    let yTangent2 = yt - yn2 * (xt * xn2 + yt * yn2 + zt * zn2);
    let zTangent2 = zt - zn2 * (xt * xn2 + yt * yn2 + zt * zn2);

    let magTangent0 = Math.sqrt(xTangent0 * xTangent0 + yTangent0 * yTangent0 + zTangent0 * zTangent0);
    let magTangent1 = Math.sqrt(xTangent1 * xTangent1 + yTangent1 * yTangent1 + zTangent1 * zTangent1);
    let magTangent2 = Math.sqrt(xTangent2 * xTangent2 + yTangent2 * yTangent2 + zTangent2 * zTangent2);

    // bitangent
    let N0oBt = xb * xn0 + yb * yn0 + zb * zn0;
    let N1oBt = xb * xn1 + yb * yn1 + zb * zn1;
    let N2oBt = xb * xn2 + yb * yn2 + zb * zn2;

    let magBitangent0 = Math.sqrt(
      (xb - xn0 * N0oBt) * 2 +
      (yb - yn0 * N0oBt) * 2 +
      (zb - zn0 * N0oBt) * 2
    );
    let magBitangent1 = Math.sqrt(
      (xb - xn1 * N1oBt) * 2 +
      (yb - yn1 * N1oBt) * 2 +
      (zb - zn1 * N1oBt) * 2
    );
    let magBitangent2 = Math.sqrt(
      (xb - xn2 * N2oBt) * 2 +
      (yb - yn2 * N2oBt) * 2 +
      (zb - zn2 * N2oBt) * 2
    );

    tangents[i0 * 3 + 0] += xTangent0 / magTangent0;
    tangents[i0 * 3 + 1] += yTangent0 / magTangent0;
    tangents[i0 * 3 + 2] += zTangent0 / magTangent0;

    tangents[i1 * 3 + 0] += xTangent1 / magTangent1;
    tangents[i1 * 3 + 1] += yTangent1 / magTangent1;
    tangents[i1 * 3 + 2] += zTangent1 / magTangent1;

    tangents[i2 * 3 + 0] += xTangent2 / magTangent2;
    tangents[i2 * 3 + 1] += yTangent2 / magTangent2;
    tangents[i2 * 3 + 2] += zTangent2 / magTangent2;

    bitangents[i0 * 3 + 0] += (xb - xn0 * N0oBt) / magBitangent0;
    bitangents[i0 * 3 + 1] += (yb - yn0 * N0oBt) / magBitangent0;
    bitangents[i0 * 3 + 2] += (zb - zn0 * N0oBt) / magBitangent0;

    bitangents[i1 * 3 + 0] += (xb - xn1 * N1oBt) / magBitangent1;
    bitangents[i1 * 3 + 1] += (yb - yn1 * N1oBt) / magBitangent1;
    bitangents[i1 * 3 + 2] += (zb - zn1 * N1oBt) / magBitangent1;

    bitangents[i2 * 3 + 0] += (xb - xn2 * N2oBt) / magBitangent2;
    bitangents[i2 * 3 + 1] += (yb - yn2 * N2oBt) / magBitangent2;
    bitangents[i2 * 3 + 2] += (zb - zn2 * N2oBt) / magBitangent2;
  };

  return { tangents, bitangents };
};
