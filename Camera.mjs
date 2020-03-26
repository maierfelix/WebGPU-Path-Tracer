const SETTINGS = {
  fieldOfView: Math.tan(70 * Math.PI / 360),
  zNear: 1.0,
  zFar: 8192.0
};

export default class Camera {
  constructor(opts = {}) {
    this.device = opts.device;
    this.deltaMovement = { x: 0, y: 0 };
    this.viewMatrix = mat4.create();
    this.viewInverseMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
    this.projectionInverseMatrix = mat4.create();
    // previous projections
    this.previousViewInverseMatrix = mat4.create();
    this.previousProjectionInverseMatrix = mat4.create();
    this.viewProjectionMatrix = mat4.create();
    this.transforms = {
      translation: vec3.create(),
      rotation: vec3.create(),
      forward: vec3.create(),
      up: vec3.create()
    };
    this.buffer = this.device.createBuffer({
      size: 90 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
    });
    this.buffer.byteLength = 90 * Float32Array.BYTES_PER_ELEMENT;
    this.sampleCount = 8;
    this.totalSampleCount = this.sampleCount;
    this.transforms.translation = vec3.fromValues(
      96, 68, 96
    );
  }
};

Camera.prototype.update = function(delta) {
  let {buffer, deltaMovement} = this;

  let mView = this.viewMatrix;
  let mViewInverse = this.viewInverseMatrix;
  let mProjection = this.projectionMatrix;
  let mProjectionInverse = this.projectionInverseMatrix;
  let mViewProjection = this.viewProjectionMatrix;

  let mPreviousViewInverse = this.previousViewInverseMatrix;
  let mPreviousProjectionInverse = this.previousProjectionInverseMatrix;

  let {sampleCount, totalSampleCount} = this;

  let {translation, rotation, forward, up} = this.transforms;

  this.control(
    [
      isKeyPressed("W") | 0,
      isKeyPressed("S") | 0,
      isKeyPressed("A") | 0,
      isKeyPressed("D") | 0,
      isKeyPressed(" ") | 0,
      isKeyPressed("C") | 0,
      isKeyPressed("Shift") | 0
    ],
    delta
  );

  let hasMoved = (
    !mat4.exactEquals(mViewInverse, mPreviousViewInverse) ||
    !mat4.exactEquals(mProjectionInverse, mPreviousProjectionInverse)
  );

  // reset accumulation
  if (hasMoved) this.totalSampleCount = this.sampleCount;
  // increase accumulation
  else this.totalSampleCount += this.sampleCount;

  // projection matrix
  {
    let aspect = window.width / window.height;
    mat4.identity(mProjection);
    mat4.perspective(
      mProjection,
      SETTINGS.fieldOfView,
      aspect,
      SETTINGS.zNear,
      SETTINGS.zFar
    );
  }
  // projection-inverse matrix
  {
    mat4.copy(mPreviousProjectionInverse, mProjectionInverse);
    mat4.invert(mProjectionInverse, mProjection);
  }
  // view matrix
  {
    mat4.identity(mView);
    mat4.rotateX(mView, mView, rotation[0]);
    mat4.rotateY(mView, mView, rotation[1]);
    mat4.rotateZ(mView, mView, rotation[2]);
    mat4.translate(mView, mView, vec3.negate(vec3.create(), translation));
  }
  // view-inverse matrix
  {
    mat4.copy(mPreviousViewInverse, mViewInverse);
    mat4.invert(mViewInverse, mView);
  }
  // up, forward vector
  {
    vec3.set(up, mView[0], mView[4], mView[8]);
    vec3.set(forward, mView[2], mView[6], mView[10]);
    vec3.normalize(up, up);
    vec3.normalize(forward, forward);
  }
  // view-projection matrix
  {
    mat4.multiply(mViewProjection, mProjection, mView);
  }

  deltaMovement.x *= 0.375;
  deltaMovement.y *= 0.375;

  let dataBuf = new ArrayBuffer(88 * Float32Array.BYTES_PER_ELEMENT);
  let dataF32 = new Float32Array(dataBuf);
  let dataU32 = new Uint32Array(dataBuf);

  let lightCount = 1;

  let offset = 0;
  dataF32.set(forward, offset);                             offset += 4;
  dataF32.set(mViewInverse, offset);                        offset += 16;
  dataF32.set(mProjectionInverse, offset);                  offset += 16;
  dataF32.set(mViewProjection, offset);                     offset += 16;
  dataF32.set(mPreviousViewInverse, offset);                offset += 16;
  dataF32.set(mPreviousProjectionInverse, offset);          offset += 16;
  dataU32.set(new Uint32Array([sampleCount]), offset);      offset += 1;
  dataU32.set(new Uint32Array([totalSampleCount]), offset); offset += 1;
  dataU32.set(new Uint32Array([lightCount]), offset);       offset += 1;
  dataU32.set(new Uint32Array([0]), offset);                offset += 1;

  buffer.setSubData(0, dataF32);
};

Camera.prototype.control = function(move, delta) {
  let {deltaMovement} = this;
  let dir = vec3.create();
  let speed = 64.0 * delta;
  if (move[6]) speed *= 2.75;
  if (move[0]) dir[2] += speed;
  else if (move[1]) dir[2] -= speed;
  if (move[2]) dir[0] += speed * 1.0;
  else if (move[3]) dir[0] -= speed * 1.0;
  if (move[4]) dir[1] -= speed;
  else if (move[5]) dir[1] += speed;
  this.move(dir, delta);
  this.look([deltaMovement.x, deltaMovement.y], delta);
};

Camera.prototype.move = function(direction, delta) {
  let {rotation, translation} = this.transforms;
  let dir = vec3.clone(direction);
  let rotX = vec3.fromValues(1.0, 0.0, 0.0);
  let rotY = vec3.fromValues(0.0, 1.0, 0.0);
  vec3.rotateX(dir, dir, rotX, -rotation[0]);
  vec3.rotateY(dir, dir, rotY, -rotation[1]);
  vec3.add(translation, translation, vec3.negate(vec3.create(), dir));
};

Camera.prototype.look = function(direction, delta) {
  let {rotation} = this.transforms;
  rotation[0] -= direction[1] * delta;
  rotation[1] -= direction[0] * delta;
  if (rotation[0] < -Math.PI * 0.5) rotation[0] = -Math.PI * 0.5;
  if (rotation[0] > Math.PI * 0.5) rotation[0] = Math.PI * 0.5;
};
