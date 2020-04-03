import {
  readImageFile,
  readObjectFile
} from "./utils.mjs"

class Texture {
  constructor(parent, opts = {}) {
    this.parent = parent || null;
    this.data = null;
  }
};

Texture.prototype.fromPath = function(path) {
  this.data = readImageFile(path);
  return this;
};

class Material {
  constructor(parent, opts = {}) {
    this.parent = parent || null;
    this.data = opts;
  }
};

class Geometry {
  constructor(parent, opts = {}) {
    this.parent = parent || null;
    this.data = null;
    this.instances = [];
    this.accelerationContainer = null;
  }
};

Geometry.prototype.fromPath = function(path) {
  this.data = readObjectFile(path);
  return this;
};

Geometry.prototype.setAccelerationContainer = function(container) {
  this.accelerationContainer = container;
};

Geometry.prototype.addMeshInstance = function(opts = {}) {
  let {instances} = this;
  let object = new GeometryInstance(this, opts);
  instances.push(object);
  return object;
};

Geometry.prototype.addEmitterInstance = function(opts = {}) {
  let {instances} = this;
  let object = new GeometryInstance(this, opts);
  object.isLight = true;
  instances.push(object);
  return object;
};

class GeometryInstance {
  constructor(parent, opts = {}) {
    this.parent = parent || null;
    this.data = opts;
    this.isLight = false;
    this.instanceBufferByteOffset = 0x0;
  }
  get geometry() {
    return this.parent;
  }
};

class Scene {
  constructor(opts = {}) {
    this.objects = {
      textures: [],
      materials: [],
      geometries: []
    };
  }
};

Scene.prototype.createTexture = function(opts = {}) {
  let {objects} = this;
  let object = new Texture(this, opts);
  objects.textures.push(object);
  return object;
};

Scene.prototype.createMaterial = function(opts = {}) {
  let {objects} = this;
  let object = new Material(this, opts);
  objects.materials.push(object);
  return object;
};

Scene.prototype.createGeometry = function(opts = {}) {
  let {objects} = this;
  let object = new Geometry(this, opts);
  objects.geometries.push(object);
  return object;
};

Scene.prototype.getInstancesFlattened = function() {
  let {geometries} = this.objects;
  let out = [];
  for (let ii = 0; ii < geometries.length; ++ii) {
    let {instances} = geometries[ii];
    out.push(...instances);
  };
  return out;
};

Scene.prototype.getLightsFlattened = function() {
  let {geometries} = this.objects;
  let out = [];
  for (let ii = 0; ii < geometries.length; ++ii) {
    let {instances} = geometries[ii];
    for (let ii = 0; ii < instances.length; ++ii) {
      let instance = instances[ii];
      if (instance.isLight) out.push(instance);
    };
  };
  return out;
};

Scene.prototype.getInstanceById = function(id) {
  let instances = this.getInstancesFlattened();
  return instances[id] || null;
};

export default Scene;
