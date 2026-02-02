export class HeadTracker {
  constructor(videoEl, onDirection = () => {}) {
    this.video = videoEl;
    this.onDirection = onDirection;
    this.faceMesh = null;
    this.camera = null;
    this.neutral = null; // {x,y}
    this._calibrating = false;
    this._calibFrames = [];
    this._frameCountForCalib = 25;

    // tuning
    this.deadZone = 0.035; // normalized units (~3.5% of frame)
    this.sensitivity = 1.0; // multiplier for responsiveness
    this.mirrored = false; // whether horizontal input is mirrored
  }

  setSensitivity(v) { this.sensitivity = Number(v) || 1.0; }
  setDeadZone(v) { this.deadZone = Number(v) || 0.035; }
  setMirror(flag) { this.mirrored = !!flag; }

  async start() {
    // Setup FaceMesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.faceMesh.onResults(this._onResults.bind(this));

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        try {
          await this.faceMesh.send({ image: this.video });
        } catch (err) {
          // ignore camera/frame errors
        }
      },
      width: 640,
      height: 480
    });

    await this.camera.start();
  }

  stop() {
    if (this.camera) {
      try { this.camera.stop(); } catch (e) {}
    }
  }

  async calibrate() {
    // collect several frames to compute a stable neutral
    this._calibrating = true;
    this._calibFrames = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._calibrating = false;
        if (this._calibFrames.length === 0) return reject(new Error('未检测到人脸，请重试')); 
        this.neutral = this._averagePoints(this._calibFrames);
        resolve(this.neutral);
      }, 3000);

      const observer = () => {
        if (!this._calibrating) return;
        if (this._calibFrames.length >= this._frameCountForCalib) {
          this._calibrating = false;
          clearTimeout(timeout);
          this.neutral = this._averagePoints(this._calibFrames);
          resolve(this.neutral);
        } else {
          // keep waiting until timeout or enough frames
          requestAnimationFrame(observer);
        }
      };

      observer();
    });
  }

  _onResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      this.onDirection(null);
      return;
    }

    const lm = results.multiFaceLandmarks[0];
    const center = this._landmarksCenter(lm);

    if (this._calibrating) {
      this._calibFrames.push(center);
      // don't emit directions while calibrating
      this.onDirection(null);
      return;
    }

    if (!this.neutral) {
      // if not calibrated yet, treat current as neutral automatically after a short time
      if (!this._autoCalibTimer) {
        this._autoCalibTimer = setTimeout(() => {
          this.neutral = center;
        }, 600);
      }
    }

    if (!this.neutral) {
      this.onDirection(null);
      return;
    }

    // apply mirror horizontally if needed
    let dx = center.x - this.neutral.x;
    if (this.mirrored) dx = -dx;
    dx = dx * this.sensitivity;
    const dy = (center.y - this.neutral.y) * this.sensitivity;

    // apply dead zone
    if (Math.abs(dx) < this.deadZone && Math.abs(dy) < this.deadZone) {
      this.onDirection(null);
      return;
    }

    let dir = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }

    this.onDirection(dir);
  }

  _landmarksCenter(landmarks) {
    let sx = 0, sy = 0;
    for (let i = 0; i < landmarks.length; i++) {
      sx += landmarks[i].x;
      sy += landmarks[i].y;
    }
    const n = landmarks.length;
    return { x: sx / n, y: sy / n };
  }

  _averagePoints(points) {
    let sx = 0, sy = 0;
    for (const p of points) {
      sx += p.x; sy += p.y;
    }
    return { x: sx / points.length, y: sy / points.length };
  }
}
