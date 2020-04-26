#version 460
#extension GL_EXT_ray_tracing : enable
#extension GL_GOOGLE_include_directive : enable
#pragma shader_stage(closest)

#include "utils.glsl"

layout (location = 1) rayPayloadInEXT ShadowRayPayload ShadowRay;

hitAttributeEXT vec3 Hit;

void main() {
  ShadowRay.hit = gl_WorldRayOriginEXT + gl_WorldRayDirectionEXT * gl_RayTmaxEXT;
  ShadowRay.shadowed = true;
}
