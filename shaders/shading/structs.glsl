#ifndef STRUCTS_H
#define STRUCTS_H

struct LightSource {
  vec4 emissionAndGeometryId;
  vec4 directionAndPdf;
};

struct RayPayload {
  vec4 radianceAndDistance;
  vec4 scatterDirection;
  vec4 throughput;
  uint seed;
  LightSource lightSource;
  bool shadowed;
};

struct ShadowRayPayload {
  vec3 hit;
  bool shadowed;
};

struct ShadingData {
  vec3 base_color;
  float metallic;
  float specular;
  float roughness;
  float csw;
};

struct Vertex {
  vec4 position;
  vec4 normal;
  vec4 tangent;
  vec2 uv;
  vec2 pad_0;
};

struct Offset {
  uint face;
  uint vertex;
  uint material;
  uint pad_0;
};

struct Material {
  vec4 color;
  vec4 emission;
  float metalness;
  float roughness;
  float specular;
  float textureScaling;
  uint albedoIndex;
  uint normalIndex;
  uint emissionIndex;
  uint metalRoughnessIndex;
  float emissionIntensity;
  float metalnessIntensity;
  float roughnessIntensity;
  float pad_0;
};

struct Light {
  uint instanceIndex;
  float pad_0;
  float pad_1;
  float pad_2;
};

struct Instance {
  mat4x3 transformMatrix;
  uint vertexIndex;
  uint faceIndex;
  uint faceCount;
  uint materialIndex;
};

#endif // STRUCTS_H
