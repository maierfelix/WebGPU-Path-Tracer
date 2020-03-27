#version 460
#extension GL_NV_ray_tracing : require
#extension GL_GOOGLE_include_directive : enable
#extension GL_EXT_nonuniform_qualifier : enable
#pragma shader_stage(closest)

#include "utils.glsl"

ShadingData shading;

#include "disney.glsl"

hitAttributeNV vec4 Hit;

layout(location = 0) rayPayloadInNV RayPayload Ray;
layout(location = 1) rayPayloadNV ShadowRayPayload ShadowRay;

layout (binding = 3) uniform CameraBuffer {
  vec4 forward;
  mat4 viewInverse;
  mat4 projectionInverse;
  mat4 viewProjection;
  mat4 previousViewInverse;
  mat4 previousProjectionInverse;
} Camera;

layout(binding = 4) uniform SettingsBuffer {
  uint sampleCount;
  uint totalSampleCount;
  uint lightCount;
  uint screenWidth;
  uint screenHeight;
  uint pad_0;
  uint pad_1;
  uint pad_2;
} Settings;

layout(binding = 5, std430) readonly buffer AttributeBuffer {
  Vertex Vertices[];
};

layout(binding = 6, std430) readonly buffer FaceBuffer {
  uint Faces[];
};

layout(binding = 7, std140, row_major) readonly buffer InstanceBuffer {
  Instance Instances[];
};

layout(binding = 8, std430) readonly buffer MaterialBuffer {
  Material Materials[];
};

layout(binding = 9, std430) readonly buffer LightBuffer {
  Light Lights[];
};

layout(binding = 10) uniform sampler TextureSampler;
layout(binding = 11) uniform texture2DArray TextureArray;

vec3 DirectLight(const uint instanceId, in vec3 normal) {
  vec3 Lo = vec3(0.0);

  const LightSource lightSource = Ray.lightSource;

  const vec4 directionAndPdf = lightSource.directionAndPdf;
  const vec4 emissionAndGeometryId = lightSource.emissionAndGeometryId;

  const vec3 lightEmission = emissionAndGeometryId.xyz;
  const uint lightGeometryInstanceId = uint(emissionAndGeometryId.w);

  // if we hit a light source, then just returns its emission directly
  if (instanceId == lightGeometryInstanceId) return lightEmission;

  // abort if we are occluded
  if (Ray.shadowed) return Lo;

  const vec3 lightDir = directionAndPdf.xyz;
  const float lightPdf = directionAndPdf.w;
  const vec3 powerPdf = lightEmission * Settings.lightCount;

  const vec3 N = normal;
  const vec3 V = -gl_WorldRayDirectionNV;
  const vec3 L = lightDir;
  const vec3 H = normalize(V + L);

  const float NdotH = max(0.0, dot(N, H));
  const float NdotL = max(0.0, dot(L, N));
  const float HdotL = max(0.0, dot(H, L));
  const float NdotV = max(0.0, dot(N, V));

  const float bsdfPdf = DisneyPdf(NdotH, NdotL, HdotL);

  const vec3 f = DisneyEval(NdotL, NdotV, NdotH, HdotL);

  Lo += powerHeuristic(lightPdf, bsdfPdf) * f * powerPdf / max(0.001, lightPdf);

  return max(vec3(0), Lo);
}

void main() {
  const uint instanceId = gl_InstanceCustomIndexNV;

  const Instance instance = Instances[nonuniformEXT(instanceId)];

  const Vertex v0 = Vertices[instance.vertexIndex + Faces[instance.faceIndex + gl_PrimitiveID * 3 + 0]];
  const Vertex v1 = Vertices[instance.vertexIndex + Faces[instance.faceIndex + gl_PrimitiveID * 3 + 1]];
  const Vertex v2 = Vertices[instance.vertexIndex + Faces[instance.faceIndex + gl_PrimitiveID * 3 + 2]];

  const vec2 u0 = v0.uv.xy, u1 = v1.uv.xy, u2 = v2.uv.xy;
  const vec3 n0 = v0.normal.xyz, n1 = v1.normal.xyz, n2 = v2.normal.xyz;
  const vec3 t0 = v0.tangent.xyz, t1 = v1.tangent.xyz, t2 = v2.tangent.xyz;

  const Material material = Materials[instance.materialIndex];

  const vec2 uv = blerp(Hit.xy, u0.xy, u1.xy, u2.xy) * material.textureScaling;
  const vec3 no = blerp(Hit.xy, n0.xyz, n1.xyz, n2.xyz);
  const vec3 ta = blerp(Hit.xy, t0.xyz, t1.xyz, t2.xyz);

  const vec3 nw = normalize(gl_ObjectToWorldNV * vec4(no, 0));
  const vec3 tw = normalize(gl_ObjectToWorldNV * vec4(ta, 0));
  const vec3 bw = cross(nw, tw);

  const vec3 tex0 = texture(sampler2DArray(TextureArray, TextureSampler), vec3(uv, material.albedoIndex)).rgb;
  const vec3 tex1 = texture(sampler2DArray(TextureArray, TextureSampler), vec3(uv, material.normalIndex)).rgb;
  const vec3 tex2 = texture(sampler2DArray(TextureArray, TextureSampler), vec3(uv, material.metalRoughnessIndex)).rgb;
  const vec3 tex3 = texture(sampler2DArray(TextureArray, TextureSampler), vec3(uv, material.emissionIndex)).rgb;

  // material color
  vec3 color = tex0 + material.color;
  // material normal
  const vec3 normal = normalize(
    material.normalIndex > 0 ?
    mat3(tw, bw, nw) * normalize((pow(tex1, vec3(INV_GAMMA))) * 2.0 - 1.0).xyz :
    nw
  );
  // material metalness/roughness
  const vec2 metalRoughness = pow(vec2(tex2.r, tex2.g), vec2(INV_GAMMA));
  // material emission
  const vec3 emission = tex3;

  const vec3 W = vec3(0.2125, 0.7154, 0.0721);
  vec3 intensity = vec3(dot(color, W));
  color = mix(intensity, color, 1.275);

  uint seed = Ray.seed;
  float t = gl_HitTNV;

  vec3 radiance = vec3(0);
  vec3 throughput = Ray.throughput.rgb;

  radiance += emission * throughput;

  shading.base_color = color;
  shading.metallic = clamp(metalRoughness.r + material.metalness, 0.001, 0.999);
  shading.specular = material.specular;
  shading.roughness = clamp(metalRoughness.g + material.roughness, 0.001, 0.999);
  {
    const vec3 cd_lin = shading.base_color;
    const float cd_lum = dot(cd_lin, vec3(0.3, 0.6, 0.1));
    const vec3 c_spec0 = mix(shading.specular * vec3(0.3), cd_lin, shading.metallic);
    const float cs_lum = dot(c_spec0, vec3(0.3, 0.6, 0.1));
    const float cs_w = cs_lum / (cs_lum + (1.0 - shading.metallic) * cd_lum);
    shading.csw = cs_w;
  }

  vec3 Lo = DirectLight(instanceId, normal);
  radiance += Lo * throughput;

  vec3 bsdfDir = DisneySample(seed, -gl_WorldRayDirectionNV, normal);

  const vec3 N = normal;
  const vec3 V = -gl_WorldRayDirectionNV;
  const vec3 L = bsdfDir;
  const vec3 H = normalize(V + L);

  const float NdotH = abs(dot(N, H));
  const float NdotL = abs(dot(L, N));
  const float HdotL = abs(dot(H, L));
  const float NdotV = abs(dot(N, V));

  float pdf = DisneyPdf(NdotH, NdotL, HdotL);
  if (pdf > 0.0) {
    throughput *= DisneyEval(NdotL, NdotV, NdotH, HdotL) / pdf;
  } else {
    t = -1.0;
  }

  Ray.radianceAndDistance = vec4(radiance, t);
  Ray.scatterDirection = vec4(bsdfDir, t);
  Ray.throughput = vec4(throughput, 1);
  Ray.seed = seed;
}
