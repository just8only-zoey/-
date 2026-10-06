/* ============================================
 * 方言主题 2048 - 游戏核心逻辑
 * 文件作用：实现 2048 游戏的全部逻辑，包括
 *          方块移动、碰撞合并、随机生成、
 *          胜负判定、键盘/触屏操控、动画渲染
 * ============================================ */

(function () {
  "use strict";

  /* ========== 常量与配置 ========== */

  /** 棋盘尺寸 */
  const SIZE = 4;

  /** 胜利目标值 */
  const WIN_VALUE = 1024;

  /**
   * 数字 → 方言词汇映射表
   * 将 2048 中的数字替换为上海话方言词
   */
  const DIALECT_MAP = {
    2:    "港都",
    4:    "小瘪三",
    8:    "小赤佬",
    16:   "乡毋宁",
    32:   "小宗桑",
    64:   "老宗桑",
    128:  "sasandi",
    256:  "老屈诶",
    512:  "老家诶",
    1024: "老灵诶"
  };

  /** 方向向量：上、右、下、左 */
  const DIRECTIONS = {
    up:    { dr: -1, dc:  0 },
    right: { dr:  0, dc:  1 },
    down:  { dr:  1, dc:  0 },
    left:  { dr:  0, dc: -1 }
  };

  /* ========== 游戏状态 ========== */

  /** 4x4 棋盘数据，每个元素为 { value, row, col, merged, isNew } 或 null */
  let grid = [];

  /** 当前分数 */
  let score = 0;

  /** 最高分（从 localStorage 读取） */
  let bestScore = parseInt(localStorage.getItem("dialect2048_best") || "0", 10);

  /** 游戏是否结束 */
  let isGameOver = false;

  /** 是否已胜利（用于判断是否显示胜利提示） */
  let hasWon = false;

  /** 方块唯一 ID 计数器，用于 DOM 动画追踪 */
  let tileIdCounter = 0;

  /* ========== DOM 引用 ========== */

  const boardWrapper  = document.getElementById("board-wrapper");
  const tileLayer     = document.getElementById("tile-layer");
  const scoreEl       = document.getElementById("score-value");
  const bestScoreEl   = document.getElementById("best-value");
  const gameMessage   = document.getElementById("game-message");
  const msgText       = document.getElementById("msg-text");
  const btnRetry      = document.getElementById("btn-retry");
  const btnNewGame    = document.getElementById("btn-new-game");
  const btnSound      = document.getElementById("btn-sound");

  /* ========== 语音模块 ========== */

  /**
   * 语音管理器：负责方言发音的开关、播放与容错
   * - 开关状态通过 localStorage 持久化，默认关闭（遵守浏览器自动播放策略）
   * - 只有玩家主动点击开关后才允许播放音频
   */
  const SoundManager = {
    /** 是否开启语音（默认关闭，页面加载时绝不自动播放） */
    enabled: false,

    /** 缓存数值 → audio 元素的映射表 */
    audios: {},

    /** localStorage 存储键名 */
    STORAGE_KEY: "dialect2048_sound",

    /**
     * 初始化：收集页面上的原生 audio 元素、恢复上次开关状态、绑定容错事件
     */
    init: function () {
      const self = this;

      /* 收集 #audio-pool 中所有带 data-value 的 audio 元素 */
      const audioEls = document.querySelectorAll("#audio-pool .game-audio");
      audioEls.forEach(function (el) {
        const value = Number(el.getAttribute("data-value"));
        self.audios[value] = el;

        /* 音频加载失败容错：仅记录警告，不抛出错误、不阻塞游戏 */
        el.addEventListener("error", function () {
          console.warn("[语音] 音频加载失败：" + el.getAttribute("src"));
        });
      });

      /* 读取上次的开关状态（仅允许 "true" 时开启） */
      this.enabled = localStorage.getItem(this.STORAGE_KEY) === "true";

      /* 根据状态同步按钮外观 */
      this.syncButton();
    },

    /**
     * 切换语音开关
     * @returns {boolean} 切换后的状态
     */
    toggle: function () {
      this.enabled = !this.enabled;
      localStorage.setItem(this.STORAGE_KEY, String(this.enabled));
      this.syncButton();
      return this.enabled;
    },

    /**
     * 同步开关按钮的样式类、无障碍属性与提示文案
     */
    syncButton: function () {
      if (this.enabled) {
        btnSound.classList.add("sound-on");
        btnSound.classList.remove("sound-off");
        btnSound.setAttribute("aria-pressed", "true");
        btnSound.setAttribute("aria-label", "关闭语音");
      } else {
        btnSound.classList.add("sound-off");
        btnSound.classList.remove("sound-on");
        btnSound.setAttribute("aria-pressed", "false");
        btnSound.setAttribute("aria-label", "开启语音");
      }
    },

    /**
     * 播放指定方块数值对应的方言语音
     * 全程容错：未开启 / 缺音频 / 播放被拒绝 都安全返回
     * @param {number} value - 合并后方块的数值（如 4、8、1024）
     */
    play: function (value) {
      /* 语音关闭时直接忽略 */
      if (!this.enabled) return;

      const audio = this.audios[value];

      /* 找不到对应音频：静默失败，不影响游戏 */
      if (!audio) {
        console.warn("[语音] 未找到数值 " + value + " 对应的音频");
        return;
      }

      /* 从头播放：若上一个语音未结束则重新开始，避免叠加延迟 */
      try {
        audio.currentTime = 0;
        /* play() 返回 Promise，捕获浏览器自动播放限制等异常 */
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function (err) {
            /* 浏览器拒绝播放（如自动播放策略）时仅记录，不影响游戏 */
            console.warn("[语音] 播放失败：" + (err && err.message ? err.message : err));
          });
        }
      } catch (err) {
        /* 极端环境下 play 同步抛错，兜底捕获 */
        console.warn("[语音] 播放异常：" + (err && err.message ? err.message : err));
      }
    }
  };

  /* ========== 初始化 ========== */

  /**
   * 初始化新游戏
   * 清空棋盘、重置分数、生成两个初始方块
   */
  function initGame() {
    grid = createEmptyGrid();
    score = 0;
    isGameOver = false;
    hasWon = false;
    tileIdCounter = 0;

    /* 清空方块层 DOM */
    tileLayer.innerHTML = "";

    /* 隐藏结算弹窗 */
    gameMessage.classList.remove("active", "win");

    /* 更新分数显示 */
    updateScoreDisplay();

    /* 随机生成两个初始方块 */
    addRandomTile();
    addRandomTile();
  }

  /**
   * 创建空的 4x4 棋盘
   * @returns {Array<Array<null>>} 空棋盘
   */
  function createEmptyGrid() {
    const g = [];
    for (let r = 0; r < SIZE; r++) {
      g[r] = [];
      for (let c = 0; c < SIZE; c++) {
        g[r][c] = null;
      }
    }
    return g;
  }

  /* ========== 方块生成 ========== */

  /**
   * 在棋盘上随机找一个空位，生成一个新方块（90% 概率为 2，10% 概率为 4）
   * @returns {boolean} 是否成功生成（棋盘满则返回 false）
   */
  function addRandomTile() {
    /* 收集所有空位 */
    const emptyCells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === null) {
          emptyCells.push({ r, c });
        }
      }
    }

    /* 没有空位则不生成 */
    if (emptyCells.length === 0) return false;

    /* 随机选一个空位 */
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];

    /* 90% 概率生成 2，10% 概率生成 4 */
    const value = Math.random() < 0.9 ? 2 : 4;

    /* 创建方块数据 */
    const tile = {
      id: ++tileIdCounter,
      value: value,
      row: r,
      col: c,
      isNew: true,
      merged: false
    };

    grid[r][c] = tile;

    /* 创建 DOM 元素 */
    createTileElement(tile);

    return true;
  }

  /* ========== 方块 DOM 操作 ========== */

  /**
   * 根据方块数据创建对应的 DOM 元素并添加到方块层
   * @param {Object} tile - 方块数据对象
   */
  function createTileElement(tile) {
    const el = document.createElement("div");
    el.id = "tile-" + tile.id;
    el.className = "tile tile-" + tile.value;

    /* 新方块添加弹出动画类 */
    if (tile.isNew) {
      el.classList.add("tile-new");
    }

    /* 显示方言词汇 */
    el.textContent = DIALECT_MAP[tile.value] || tile.value;

    /* 设置位置 */
    positionTile(el, tile.row, tile.col);

    tileLayer.appendChild(el);

    /* 动画结束后移除动画类 */
    if (tile.isNew) {
      el.addEventListener("animationend", function handler() {
        el.classList.remove("tile-new");
        el.removeEventListener("animationend", handler);
      });
    }
  }

  /**
   * 计算方块在棋盘中的像素位置
   * @param {number} row - 行号 (0-3)
   * @param {number} col - 列号 (0-3)
   * @returns {{ top: string, left: string }} CSS 定位值
   */
  function getTilePosition(row, col) {
    /* 每个格子的位置 = 序号 * (格子尺寸 + 间距) */
    return {
      top:  "calc(" + row + " * (var(--cell-size) + var(--cell-gap)))",
      left: "calc(" + col + " * (var(--cell-size) + var(--cell-gap)))"
    };
  }

  /**
   * 设置方块 DOM 元素的位置
   * @param {HTMLElement} el - 方块 DOM 元素
   * @param {number} row - 目标行号
   * @param {number} col - 目标列号
   */
  function positionTile(el, row, col) {
    const pos = getTilePosition(row, col);
    el.style.top = pos.top;
    el.style.left = pos.left;
  }

  /**
   * 重新渲染整个棋盘的方块 DOM
   * 在移动/合并操作完成后调用，确保 DOM 与数据一致
   */
  function renderAllTiles() {
    tileLayer.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== null) {
          createTileElement(grid[r][c]);
        }
      }
    }
  }

  /* ========== 核心移动逻辑 ========== */

  /**
   * 执行一次方向移动
   * @param {string} direction - 方向名称：up / right / down / left
   * @returns {boolean} 是否发生了有效移动（有方块位移或合并）
   */
  function move(direction) {
    if (isGameOver) return false;

    const dir = DIRECTIONS[direction];
    if (!dir) return false;

    let moved = false;

    /* 确定遍历顺序：从移动方向的前方开始遍历 */
    const rows = buildTraversalOrder(dir.dr);
    const cols = buildTraversalOrder(dir.dc);

    /* 记录本次移动中已合并的方块，防止一次移动中重复合并 */
    const mergedThisMove = new Set();

    for (const r of rows) {
      for (const c of cols) {
        const tile = grid[r][c];
        if (tile === null) continue;

        /* 计算当前方块能滑到的最远位置 */
        let newR = r;
        let newC = c;

        while (true) {
          const nextR = newR + dir.dr;
          const nextC = newC + dir.dc;

          /* 超出边界则停止 */
          if (nextR < 0 || nextR >= SIZE || nextC < 0 || nextC >= SIZE) break;

          const target = grid[nextR][nextC];

          if (target === null) {
            /* 目标为空，继续滑动 */
            newR = nextR;
            newC = nextC;
          } else if (target.value === tile.value && !mergedThisMove.has(target.id)) {
            /* 目标方块值相同且未被本次合并过 → 合并 */
            newR = nextR;
            newC = nextC;
            break;
          } else {
            /* 目标有方块且值不同，停止 */
            break;
          }
        }

        /* 如果位置发生了变化 */
        if (newR !== r || newC !== c) {
          moved = true;
          const target = grid[newR][newC];

          /* 从原位置移除 */
          grid[r][c] = null;

          if (target !== null && target.value === tile.value) {
            /* === 合并操作 === */
            const newValue = tile.value * 2;

            /* 更新分数 */
            score += newValue;

            /* 合并成功：播放新方块数值对应的方言语音
             * （仅在玩家已主动开启语音时发声；播放失败内部已容错） */
            SoundManager.play(newValue);

            /* 创建合并后的新方块 */
            const mergedTile = {
              id: ++tileIdCounter,
              value: newValue,
              row: newR,
              col: newC,
              isNew: false,
              merged: true
            };

            grid[newR][newC] = mergedTile;
            mergedThisMove.add(mergedTile.id);

            /* 先移动旧方块到目标位置（CSS 过渡动画），然后替换 */
            const oldEl = document.getElementById("tile-" + tile.id);
            const targetEl = document.getElementById("tile-" + target.id);

            if (oldEl) positionTile(oldEl, newR, newC);
            if (targetEl) positionTile(targetEl, newR, newC);

            /* 动画结束后替换为合并后的新方块 */
            setTimeout(function () {
              if (oldEl) oldEl.remove();
              if (targetEl) targetEl.remove();
              createTileElement(mergedTile);

              /* 添加合并弹跳动画 */
              const mergedEl = document.getElementById("tile-" + mergedTile.id);
              if (mergedEl) {
                mergedEl.classList.add("tile-merged");
                mergedEl.addEventListener("animationend", function handler() {
                  mergedEl.classList.remove("tile-merged");
                  mergedEl.removeEventListener("animationend", handler);
                });
              }
            }, 150);

            /* 检查是否达到胜利值 */
            if (newValue >= WIN_VALUE && !hasWon) {
              hasWon = true;
              setTimeout(function () { showGameMessage("老灵诶！侬赢了！"); }, 400);
            }
          } else {
            /* === 纯滑动（无合并） === */
            tile.row = newR;
            tile.col = newC;
            grid[newR][newC] = tile;

            /* 更新 DOM 位置（CSS 过渡自动处理动画） */
            const el = document.getElementById("tile-" + tile.id);
            if (el) positionTile(el, newR, newC);
          }
        }
      }
    }

    if (moved) {
      /* 更新分数显示 */
      updateScoreDisplay();

      /* 延迟生成新方块（等滑动动画完成） */
      setTimeout(function () {
        addRandomTile();

        /* 检查是否游戏结束 */
        if (!canMove()) {
          isGameOver = true;
          showGameMessage("游戏结束");
        }
      }, 180);
    }

    return moved;
  }

  /**
   * 根据移动方向构建遍历顺序
   * 确保先处理移动方向前方的方块，避免重复推动
   * @param {number} delta - 方向增量（-1 或 1 或 0）
   * @returns {number[]} 遍历顺序数组
   */
  function buildTraversalOrder(delta) {
    const order = [];
    if (delta === 1) {
      /* 向下/向右：从后往前遍历 */
      for (let i = SIZE - 1; i >= 0; i--) order.push(i);
    } else {
      /* 向上/向左：从前往后遍历 */
      for (let i = 0; i < SIZE; i++) order.push(i);
    }
    return order;
  }

  /**
   * 检查是否还有可行的移动
   * 遍历所有方块，检查是否有空位或可合并的相邻方块
   * @returns {boolean} 是否还能移动
   */
  function canMove() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        /* 有空位则可以移动 */
        if (grid[r][c] === null) return true;

        const val = grid[r][c].value;

        /* 检查右方和下方是否有相同值的方块 */
        if (c < SIZE - 1 && grid[r][c + 1] !== null && grid[r][c + 1].value === val) {
          return true;
        }
        if (r < SIZE - 1 && grid[r + 1][c] !== null && grid[r + 1][c].value === val) {
          return true;
        }
      }
    }
    return false;
  }

  /* ========== 分数管理 ========== */

  /**
   * 更新分数显示（当前分数 + 最高分）
   */
  function updateScoreDisplay() {
    scoreEl.textContent = score;

    /* 更新最高分 */
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("dialect2048_best", String(bestScore));
    }
    bestScoreEl.textContent = bestScore;
  }

  /* ========== 游戏结束 / 胜利弹窗 ========== */

  /**
   * 显示游戏结束或胜利弹窗
   * @param {string} text - 弹窗文字
   */
  function showGameMessage(text) {
    msgText.textContent = text;

    if (hasWon && text.indexOf("赢") !== -1) {
      gameMessage.classList.add("win");
    }

    gameMessage.classList.add("active");
  }

  /* ========== 键盘操控 ========== */

  /**
   * 键盘事件监听
   * 方向键 / WASD 控制方块移动
   */
  document.addEventListener("keydown", function (e) {
    /* 方向键映射 */
    const keyMap = {
      ArrowUp:    "up",
      ArrowDown:  "down",
      ArrowLeft:  "left",
      ArrowRight: "right",
      /* WASD 也支持 */
      w: "up",    W: "up",
      s: "down",  S: "down",
      a: "left",  A: "left",
      d: "right", D: "right"
    };

    const direction = keyMap[e.key];
    if (direction) {
      e.preventDefault(); /* 阻止页面滚动 */
      move(direction);
    }
  });

  /* ========== 触屏操控 ========== */

  /** 触屏起始坐标 */
  let touchStartX = 0;
  let touchStartY = 0;

  /** 滑动阈值（像素），小于此距离不触发移动 */
  const SWIPE_THRESHOLD = 30;

  /**
   * 触屏开始：记录起始坐标
   */
  boardWrapper.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  /**
   * 触屏结束：计算滑动方向并触发移动
   */
  boardWrapper.addEventListener("touchend", function (e) {
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      /* 判断滑动方向（取水平/垂直中位移更大的） */
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

      let direction;
      if (absDx > absDy) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "down" : "up";
      }

      e.preventDefault();
      move(direction);
    }
  }, { passive: false });

  /* 阻止触屏滑动时页面滚动 */
  boardWrapper.addEventListener("touchmove", function (e) {
    e.preventDefault();
  }, { passive: false });

  /* ========== 按钮事件 ========== */

  /** 新游戏按钮 */
  btnNewGame.addEventListener("click", function () {
    initGame();
  });

  /** 重试按钮（弹窗内） */
  btnRetry.addEventListener("click", function () {
    initGame();
  });

  /**
   * 语音开关按钮：由玩家主动点击切换
   * 此点击属于用户手势，开启后后续合并播放可满足浏览器自动播放策略
   */
  btnSound.addEventListener("click", function () {
    SoundManager.toggle();
  });

  /* ========== 启动游戏 ========== */
  /* 先初始化语音模块（仅恢复状态与绑定事件，不会播放声音） */
  SoundManager.init();
  initGame();

})();
