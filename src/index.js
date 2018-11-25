export default class CanvasFreeDrawing {
  constructor(params = {}) {
    const {
      elementId = this.requiredParam('elementId'),
      width = this.requiredParam('width'),
      height = this.requiredParam('height'),
      backgroundColor = [255, 255, 255],
      lineWidth = 5,
      strokeColor,
      disabled,
      showWarnings = false,
      maxSnapshots = 10,
    } = params;

    this.elementId = elementId;
    this.canvas = document.getElementById(this.elementId);
    this.checkCanvasElement();
    this.context = this.canvas.getContext('2d');
    this.width = width;
    this.height = height;

    this.maxSnapshots = maxSnapshots;
    this.snapshots = [];
    this.undos = [];
    this.positions = [];
    this.leftCanvasDrawing = false; // to check if user left the canvas drawing, on mouseover resume drawing
    this.isDrawing = false;
    this.isDrawingModeEnabled = true;
    this.imageRestored = false;

    this.lineWidth = lineWidth;
    this.strokeColor = this.validateColor(strokeColor, true);
    this.bucketToolColor = this.validateColor(strokeColor, true);
    this.bucketToolTolerance = 0;
    this.isBucketToolEnabled = false;

    this.listenersList = ['mouseDown', 'mouseMove', 'mouseLeave', 'mouseUp', 'touchStart', 'touchMove', 'touchEnd'];
    this.allowedEvents = ['redraw', 'mouseup', 'mousedown', 'mouseenter', 'mouseleave'];
    this.redrawCounter = 0;
    this.dispatchEventsOnceEvery = 0; // this may become something like: [{event, counter}]

    // initialize events
    this.redrawEvent = new Event('cfd_redraw');
    this.mouseUpEvent = new Event('cfd_mouseup');
    this.mouseDownEvent = new Event('cfd_mousedown');
    this.mouseEnterEvent = new Event('cfd_mouseenter');
    this.mouseLeaveEvent = new Event('cfd_mouseleave');
    this.touchStartEvent = new Event('cfd_touchstart');
    this.touchEndEvent = new Event('cfd_touchend');

    // these are needed to remove the listener
    this.mouseDown = this.mouseDown.bind(this);
    this.mouseMove = this.mouseMove.bind(this);
    this.mouseLeave = this.mouseLeave.bind(this);
    this.mouseUp = this.mouseUp.bind(this);
    this.mouseUpDocument = this.mouseUpDocument.bind(this);
    this.touchStart = this.touchStart.bind(this);
    this.touchMove = this.touchMove.bind(this);
    this.touchEnd = this.touchEnd.bind(this);

    this.touchIdentifier = null;
    this.previousX = null;
    this.previousY = null;

    this.showWarnings = showWarnings;

    // cache
    this.isNodeColorEqualCache = [];

    this.setDimensions();
    this.setBackground(backgroundColor);
    this.storeSnapshot();

    if (!disabled) this.enableDrawingMode();
  }

  requiredParam(param) {
    throw new Error(`${param} is required`);
  }

  logWarning(...args) {
    if (this.showWarnings) console.warn(...args);
  }

  checkCanvasElement() {
    if (this.canvas.tagName !== 'CANVAS') {
      const newCanvas = document.createElement('canvas');
      this.canvas.appendChild(newCanvas);
      this.canvas = newCanvas;
    }
  }

  addListeners() {
    this.listenersList.forEach(event => {
      this.canvas.addEventListener(event.toLowerCase(), this[event]);
    });
    document.addEventListener('mouseup', this.mouseUpDocument);
  }

  removeListeners() {
    this.listenersList.forEach(event => {
      this.canvas.removeEventListener(event.toLowerCase(), this[event]);
    });
    document.removeEventListener('mouseup', this.mouseUpDocument);
  }

  enableDrawingMode() {
    this.isDrawingModeEnabled = true;
    this.addListeners();
    this.toggleCursor();
    return this.isDrawingModeEnabled;
  }

  disableDrawingMode() {
    this.isDrawingModeEnabled = false;
    this.removeListeners();
    this.toggleCursor();
    return this.isDrawingModeEnabled;
  }

  mouseDown(event) {
    if (event.button !== 0) return;
    const x = event.pageX - this.canvas.offsetLeft;
    const y = event.pageY - this.canvas.offsetTop;
    return this.drawPoint(x, y);
  }

  mouseMove(event) {
    const x = event.pageX - this.canvas.offsetLeft;
    const y = event.pageY - this.canvas.offsetTop;
    this.drawLine(x, y);
  }

  touchStart(event) {
    if (event.changedTouches.length > 0) {
      const { pageX, pageY, identifier } = event.changedTouches[0];
      const x = pageX - this.canvas.offsetLeft;
      const y = pageY - this.canvas.offsetTop;
      this.touchIdentifier = identifier;
      return this.drawPoint(x, y);
    }
  }

  touchMove(event) {
    if (event.changedTouches.length > 0) {
      const { pageX, pageY, identifier } = event.changedTouches[0];
      const x = pageX - this.canvas.offsetLeft;
      const y = pageY - this.canvas.offsetTop;

      // check if is multi touch, if it is do nothing
      if (identifier != this.touchIdentifier) return;

      this.previousX = x;
      this.previousY = y;
      this.drawLine(x, y);
    }
  }

  touchEnd() {
    this.handleEndDrawing();
    this.canvas.dispatchEvent(this.touchEndEvent);
  }

  mouseUp() {
    this.handleEndDrawing();
    this.canvas.dispatchEvent(this.mouseUpEvent);
  }

  mouseUpDocument() {
    this.leftCanvasDrawing = false;
  }

  mouseLeave() {
    if (this.isDrawing) this.leftCanvasDrawing = true;
    this.isDrawing = false;
    this.canvas.dispatchEvent(this.mouseLeaveEvent);
  }

  mouseEnter() {
    this.canvas.dispatchEvent(this.mouseEnterEvent);
  }

  handleEndDrawing() {
    this.isDrawing = false;
    this.storeSnapshot();
  }

  drawPoint(x, y) {
    if (this.isBucketToolEnabled) {
      return this.fill(x, y, this.bucketToolColor, { tolerance: this.bucketToolTolerance });
    }
    this.isDrawing = true;
    this.storeDrawing(x, y, false);

    this.canvas.dispatchEvent(this.mouseDownEvent);

    this.handleDrawing();
  }

  drawLine(x, y) {
    if (this.leftCanvasDrawing) {
      this.leftCanvasDrawing = false;
      this.mouseDown(event);
    }

    if (this.isDrawing) {
      this.storeDrawing(x, y, true);
      this.handleDrawing({ dispatchEventsOnceEvery: this.dispatchEventsOnceEvery });
    }
  }

  handleDrawing({ dispatchEventsOnceEvery } = {}) {
    this.context.lineJoin = 'round';
    const positions = [[...this.positions].pop()];

    positions.forEach(position => {
      this.context.strokeStyle = this.rgbaFromArray(position[0].strokeColor);
      this.context.lineWidth = position[0].lineWidth;

      this.draw(position);
    });

    if (!dispatchEventsOnceEvery) {
      this.canvas.dispatchEvent(this.redrawEvent);
    } else if (this.redrawCounter % dispatchEventsOnceEvery === 0) {
      this.canvas.dispatchEvent(this.redrawEvent);
    }

    this.undos = [];
    this.redrawCounter += 1;
  }

  draw(position) {
    position.forEach(({ x, y, moving }, i) => {
      this.context.beginPath();
      if (moving && i) {
        this.context.moveTo(position[i - 1]['x'], position[i - 1]['y']);
      } else {
        this.context.moveTo(x - 1, y);
      }
      this.context.lineTo(x, y);
      this.context.closePath();
      this.context.stroke();
    });
  }

  // https://en.wikipedia.org/wiki/Flood_fill
  fill(x, y, newColor, { tolerance, storeInPosition = true }) {
    return new Promise(resolve => {
      newColor = this.validateColor(newColor);
      if (this.positions.length === 0 && !this.imageRestored) {
        this.setBackground(newColor, false);
        this.canvas.dispatchEvent(this.redrawEvent);
        return;
      }

      const imageData = this.context.getImageData(0, 0, this.width, this.height);
      const newData = imageData.data;
      const targetColor = this.getNodeColor(x, y, newData);
      if (this.isNodeColorEqual(targetColor, newColor, tolerance)) return;
      const queue = [];
      queue.push([x, y]);

      while (queue.length) {
        if (queue.length > this.width * this.height) break;
        const n = queue.pop();
        let w = n;
        let e = n;

        while (this.isNodeColorEqual(this.getNodeColor(w[0] - 1, w[1], newData), targetColor, tolerance)) {
          w = [w[0] - 1, w[1]];
        }

        while (this.isNodeColorEqual(this.getNodeColor(e[0] + 1, e[1], newData), targetColor, tolerance)) {
          e = [e[0] + 1, e[1]];
        }

        const firstNode = w[0];
        const lastNode = e[0];

        for (let i = firstNode; i <= lastNode; i++) {
          this.setNodeColor(i, w[1], newColor, newData);

          if (this.isNodeColorEqual(this.getNodeColor(i, w[1] + 1, newData), targetColor, tolerance)) {
            queue.push([i, w[1] + 1]);
          }

          if (this.isNodeColorEqual(this.getNodeColor(i, w[1] - 1, newData), targetColor, tolerance)) {
            queue.push([i, w[1] - 1]);
          }
        }
      }

      this.context.putImageData(imageData, 0, 0);
      this.canvas.dispatchEvent(this.redrawEvent);

      if (storeInPosition) {
        this.positions.push({ isBucket: true, x, y, newColor, tolerance });
      }

      resolve(true);
    });
  }

  validateColor(color, placeholder) {
    if (typeof color === 'object' && color.length === 4) color.pop();
    if (typeof color === 'object' && color.length === 3) {
      const validColor = [...color];
      validColor.push(255);
      return validColor;
    } else if (placeholder) {
      return [0, 0, 0, 255];
    }
    this.logWarning('Color is not valid! It must be an array with RGB values:  [0-255, 0-255, 0-255]');
    return null;
  }

  // i = color 1; j = color 2; t = tolerance
  isNodeColorEqual(i, j, t) {
    // const color1 = JSON.stringify(i);
    // const color2 = JSON.stringify(j);
    const color1 = '' + i[0] + i[1] + i[2] + i[3];
    const color2 = '' + j[0] + j[1] + j[2] + j[3];
    t = t || 0;

    if (this.isNodeColorEqualCache.hasOwnProperty(color1 + color2 + t)) {
      return this.isNodeColorEqualCache[color1 + color2 + t];
    }

    const diffRed = Math.abs(j[0] - i[0]);
    const diffGreen = Math.abs(j[1] - i[1]);
    const diffBlue = Math.abs(j[2] - i[2]);

    const percentDiffRed = diffRed / 255;
    const percentDiffGreen = diffGreen / 255;
    const percentDiffBlue = diffBlue / 255;

    const percentDiff = ((percentDiffRed + percentDiffGreen + percentDiffBlue) / 3) * 100;
    const result = t >= percentDiff;

    this.isNodeColorEqualCache[color1 + color2 + t] = result;
    return result;
  }

  getNodeColor(x, y, data) {
    const i = (x + y * this.width) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  setNodeColor(x, y, color, data) {
    const i = (x + y * this.width) * 4;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  }

  rgbaFromArray(a) {
    return `rgba(${a[0]},${a[1]},${a[2]},${a[3]})`;
  }

  setDimensions() {
    this.canvas.height = this.height;
    this.canvas.width = this.width;
  }

  toggleCursor() {
    this.canvas.style.cursor = this.isDrawingModeEnabled ? 'crosshair' : 'auto';
  }

  storeDrawing(x, y, moving) {
    if (moving) {
      this.positions[this.positions.length - 1].push({
        x,
        y,
        moving,
        lineWidth: this.lineWidth,
        strokeColor: this.strokeColor,
      });
    } else {
      this.positions.push([
        {
          x,
          y,
          moving,
          lineWidth: this.lineWidth,
          strokeColor: this.strokeColor,
        },
      ]);
    }
  }

  storeSnapshot() {
    new Promise(resolve => {
      const imageData = this.getCanvasSnapshot();
      this.snapshots.push(imageData);
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots = this.snapshots.splice(-Math.abs(this.maxSnapshots));
      }
      resolve();
    });
  }

  getCanvasSnapshot() {
    return this.context.getImageData(0, 0, this.width, this.height);
  }

  restoreCanvasSnapshot(imageData) {
    this.context.putImageData(imageData, 0, 0);
  }

  // Public APIs

  on(params, callback) {
    const { event = this.requiredParam('event'), counter } = params;

    if (this.allowedEvents.includes(event)) {
      if (event === 'redraw' && Number.isInteger(counter)) {
        this.dispatchEventsOnceEvery = parseInt(counter);
      }
      this.canvas.addEventListener('cfd_' + event, () => callback());
    } else {
      this.logWarning(`This event is not allowed: ${event}`);
    }
  }

  setLineWidth(px) {
    this.lineWidth = px;
  }

  setBackground(color, save = true) {
    const validColor = this.validateColor(color);
    if (validColor) {
      if (save) this.backgroundColor = validColor;
      this.context.fillStyle = this.rgbaFromArray(validColor);
      this.context.fillRect(0, 0, this.width, this.height);
    }
  }

  setDrawingColor(color) {
    this.configBucketTool({ color });
    this.setStrokeColor(color);
  }

  setStrokeColor(color) {
    this.strokeColor = this.validateColor(color, true);
  }

  configBucketTool(params) {
    const { color = null, tolerance = null } = params;
    if (color) this.bucketToolColor = this.validateColor(color);
    if (tolerance && tolerance > 0) {
      this.bucketToolTolerance = tolerance > 100 ? 100 : tolerance;
    }
  }

  toggleBucketTool() {
    return (this.isBucketToolEnabled = !this.isBucketToolEnabled);
  }

  isBucketToolEnabled() {
    return this.isBucketToolEnabled;
  }

  toggleDrawingMode() {
    return this.isDrawingModeEnabled ? this.disableDrawingMode() : this.enableDrawingMode();
  }

  isDrawingModeEnabled() {
    return this.isDrawingModeEnabled;
  }

  clear() {
    this.context.clearRect(0, 0, this.width, this.height);
    this.lastPath = [];
    this.positions = [];
    this.setBackground(this.backgroundColor);
    this.handleEndDrawing();
  }

  save() {
    return this.canvas.toDataURL();
  }

  restore(backup, callback) {
    const image = new Image();
    image.src = backup;
    image.onload = () => {
      this.imageRestored = true;
      this.context.drawImage(image, 0, 0);
      if (typeof callback === 'function') callback();
    };
  }

  undo() {
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const goToSnapshot = this.snapshots[this.snapshots.length - 2];
    if (goToSnapshot) {
      this.restoreCanvasSnapshot(goToSnapshot);
      this.snapshots.pop();
      this.undos.push(lastSnapshot);
      this.undos = this.undos.splice(-Math.abs(this.maxSnapshots));
    } else {
      this.logWarning('There are no more undos left.');
    }
  }

  redo() {
    if (this.undos.length > 0) {
      const lastUndo = this.undos.pop();
      this.restoreCanvasSnapshot(lastUndo);
      this.snapshots.push(lastUndo);
      this.snapshots = this.snapshots.splice(-Math.abs(this.maxSnapshots));
    } else {
      this.logWarning('There are no more redo left.');
    }
  }
}
