#version 460
#extension GL_EXT_ray_tracing : enable
#extension GL_GOOGLE_include_directive : enable
#pragma shader_stage(miss)

#include "utils.glsl"

layout (location = 1) rayPayloadInEXT ShadowRayPayload ShadowRay;

void main() {
  ShadowRay.hit = vec3(0);
  ShadowRay.shadowed = false;
}
