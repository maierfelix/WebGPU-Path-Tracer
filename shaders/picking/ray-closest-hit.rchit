#version 460
#extension GL_NV_ray_tracing : require
#pragma shader_stage(closest)

struct RayPayload {
  vec4 position;
  vec4 normal;
  uint instanceId;
};

layout(location = 0) rayPayloadInNV RayPayload Ray;

hitAttributeNV vec4 Hit;

void main() {
  Ray.position.xyz = gl_WorldRayOriginNV + gl_WorldRayDirectionNV * gl_RayTmaxNV;
  Ray.instanceId = gl_InstanceCustomIndexNV + 1;
}
