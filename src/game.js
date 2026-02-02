export class Game {
  constructor(canvas, onGameOver = () => {}, onScoreUpdate = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;
    this.onScoreUpdate = onScoreUpdate;

    this.tileCount = 20; // grid size (tiles per row/col)
    this.tileSize = this.canvas.width / this.tileCount;

    this.speed = 120; // ms per tick
    this.interval = null;

    this.tickListeners = [];

    this.reset();
  }

  reset() {
    const mid = Math.floor(this.tileCount / 2);
    this.snake = [{ x: mid, y: mid }];
    this.direction = 'right';
    this.pendingDir = null;
    this.score = 0;
    this.spawnFood();
    this.running = false;
    this.draw();
  }

  start() {
    if (this.running) return;
    this.reset();
    this.running = true;
    this.interval = setInterval(() => this._tick(), this.speed);
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  onTick(cb) {
    this.tickListeners.push(cb);
  }

  _emitTick() {
    for (const cb of this.tickListeners) cb();
  }

  setDirection(dir) {
    // prevent reversing
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (dir && opposite[dir] === this.direction) return;
    this.pendingDir = dir;
  }

  spawnFood() {
    while (true) {
      const x = Math.floor(Math.random() * this.tileCount);
      const y = Math.floor(Math.random() * this.tileCount);
      if (!this.snake.some(s => s.x === x && s.y === y)) {
        this.food = { x, y };
        return;
      }
    }
  }

  _tick() {
    this._emitTick();

    if (this.pendingDir) {
      this.direction = this.pendingDir;
      this.pendingDir = null;
    }

    const head = { ...this.snake[0] };
    if (this.direction === 'up') head.y -= 1;
    if (this.direction === 'down') head.y += 1;
    if (this.direction === 'left') head.x -= 1;
    if (this.direction === 'right') head.x += 1;

    // wall collision
    if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
      this._gameOver();
      return;
    }

    // self collision
    if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
      this._gameOver();
      return;
    }

    // move
    this.snake.unshift(head);

    // food
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.onScoreUpdate({ score: this.score });
      this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.draw();
  }

  _gameOver() {
    this.stop();
    this.onGameOver({ score: this.score });
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#1112';
    ctx.lineWidth = 0.3;
    for (let i = 0; i <= this.tileCount; i++) {
      const p = i * this.tileSize;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, this.canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(this.canvas.width, p);
      ctx.stroke();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // background
    ctx.fillStyle = '#071024';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // grid (subtle)
    // this.drawGrid();

    // food
    ctx.fillStyle = '#ff6b6b';
    this._fillTile(this.food.x, this.food.y);

    // snake
    for (let i = 0; i < this.snake.length; i++) {
      const s = this.snake[i];
      ctx.fillStyle = i === 0 ? '#7be495' : '#4fb3a3';
      this._fillTile(s.x, s.y, i === 0);
    }
  }

  _fillTile(x, y, rounded = false) {
    const ctx = this.ctx;
    const px = x * this.tileSize;
    const py = y * this.tileSize;
    const pad = 2;
    const w = this.tileSize - pad * 2;
    const h = this.tileSize - pad * 2;
    const r = rounded ? Math.max(2, this.tileSize * 0.15) : 4;
    ctx.beginPath();
    ctx.fillRect(px + pad, py + pad, w, h);
    ctx.fill();
  }
}
