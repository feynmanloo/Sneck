const KEY = 'sneck';

const DEFAULT = { sneck: { highScore: 0, history: [] } };

export const Storage = {
  _read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return JSON.parse(raw);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  },
  _write(obj) {
    localStorage.setItem(KEY, JSON.stringify(obj));
  },
  getHighScore() {
    return this._read().sneck.highScore || 0;
  },
  maybeSetHighScore(score) {
    const data = this._read();
    if (score > (data.sneck.highScore || 0)) {
      data.sneck.highScore = score;
      this._write(data);
      return true;
    }
    return false;
  },
  getHistory() {
    return this._read().sneck.history || [];
  },
  pushHistory(score) {
    const data = this._read();
    data.sneck.history = data.sneck.history || [];
    data.sneck.history.push({ score, time: new Date().toISOString() });
    // cap history to last 200 entries
    if (data.sneck.history.length > 200) data.sneck.history.shift();
    this._write(data);
  },
  export() {
    return this._read();
  },
  import(json) {
    // basic validation
    if (!json || !json.sneck || typeof json.sneck !== 'object') throw new Error('不合法的格式');
    const safe = {
      sneck: {
        highScore: Number(json.sneck.highScore || 0),
        history: Array.isArray(json.sneck.history) ? json.sneck.history.slice(0, 200) : []
      }
    };
    this._write(safe);
  },
  clear() {
    localStorage.removeItem(KEY);
  }
};
