#version 460
#extension GL_NV_ray_tracing : require
#extension GL_GOOGLE_include_directive : enable
#pragma shader_stage(miss)

#include "utils.glsl"

layout(location = 1) rayPayloadInNV ShadowRayPayload ShadowRay;

void main() {
  ShadowRay.hit = vec3(0);
  ShadowRay.shadowed = false;
}
