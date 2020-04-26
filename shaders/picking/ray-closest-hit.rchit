#version 460
#extension GL_EXT_ray_tracing : enable
#pragma shader_stage(closest)

struct RayPayload {
  vec4 position;
  vec4 normal;
  uint instanceId;
};

layout(location = 0) rayPayloadInEXT RayPayload Ray;

hitAttributeEXT vec4 Hit;

void main() {
  Ray.position.xyz = gl_WorldRayOriginEXT + gl_WorldRayDirectionEXT * gl_RayTmaxEXT;
  Ray.instanceId = gl_InstanceCustomIndexEXT + 1;
}
