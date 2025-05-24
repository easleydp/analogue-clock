/**
 * AnalogueClock class for rendering a clock on an HTML canvas
 * with realistic second hand physics.
 */
class AnalogueClock {
  /**
   * Default configuration for the clock.
   */
  static defaultConfig = {
    // Clock Face
    dialColor: "#FFFFFF",
    borderColor: "#000000",
    borderWidth: 5, // pixels
    showNumerals: true,
    numeralFont: "Arial", // Will be scaled with radius
    numeralColor: "#000000",
    majorTickColor: "#000000",
    majorTickLength: 10, // pixels
    majorTickWidth: 3, // pixels
    showMinorTicks: true,
    minorTickColor: "#333333",
    minorTickLength: 5, // pixels
    minorTickWidth: 1, // pixel
    centerPinColor: "#000000",
    centerPinRadius: 5, // pixels

    // Hands (common shadow properties)
    handShadowOffsetX: 2,
    handShadowOffsetY: 2,
    handShadowBlur: 3,
    handShadowColor: "rgba(0, 0, 0, 0.3)",

    // Hour Hand
    hourHandColor: "#000000",
    hourHandLength: 0.5, // as fraction of clock radius
    hourHandWidth: 7, // pixels

    // Minute Hand
    minuteHandColor: "#000000",
    minuteHandLength: 0.75, // as fraction of clock radius
    minuteHandWidth: 5, // pixels

    // Second Hand
    secondHandColor: "#FF0000",
    secondHandLength: 0.9, // as fraction of clock radius
    secondHandWidth: 2, // pixels
    secondHandCounterWeightLength: 0.15, // as fraction of clock radius for counterweight
    secondHandPhysics: {
      creepDurationMs: 150,
      creepAngleDegrees: 2,
      overshootDegrees: 2,
      recoilDegrees: -1.5,
      motionBlurStrength: 12, // Custom: Strength of the motion blur effect
    },
  };

  /**
   * Initializes the AnalogueClock.
   * @param {string} canvasId The ID of the HTML canvas element.
   * @param {object} userConfig Optional configuration object to override defaults.
   */
  constructor(canvasId, userConfig = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas element with ID "${canvasId}" not found.`);
      return;
    }
    this.ctx = this.canvas.getContext("2d");

    // Merge user config with defaults recursively
    this.config = this._deepMerge(AnalogueClock.defaultConfig, userConfig);

    this.isRunning = false;
    this.animationFrameId = null;

    // State variables for second hand physics
    this.lastSystemSecond = -1;
    this.secondHandAnimationPhase = "SETTLED"; // 'SETTLED', 'CREEPING', 'OVERSHOOT', 'RECOIL'
    this.targetSecondBaseAngle = 0; // Normal angle for the current (last ticked) second
    this.currentSecondHandVisualAngle = 0; // Actual rendered angle of the second hand
    this.blurSecondHandEffect = 0; // -1 for ACW blur, 1 for CW blur, 0 for no special blur
    this.lastTimestamp = -1; // Last timestamp for animation loop

    this._initDimensions();
  }

  /**
   * Deeply merges a source object into a target object.
   * @param {object} target The target object.
   * @param {object} source The source object.
   * @returns {object} The merged object.
   */
  _deepMerge(target, source) {
    const output = { ...target };
    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this._isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this._deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  _isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  }

  /**
   * Initializes clock dimensions based on canvas size.
   */
  _initDimensions() {
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    // Radius is half of the smaller dimension, minus padding for border/numerals
    const baseRadius = Math.min(this.width, this.height) / 2;
    // Adjusted radius to allow space for border and numerals
    this.radius =
      baseRadius - Math.max(this.config.borderWidth, baseRadius * 0.15);
    this.numeralRadius = this.radius * 0.85; // Radius for numeral placement
  }

  /**
   * Starts the clock animation.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const now = new Date();
    // Initialize lastSystemSecond to force initial tick processing
    this.lastSystemSecond = (now.getSeconds() + 59) % 60;
    this.targetSecondBaseAngle = (now.getSeconds() / 60) * 360;
    this.currentSecondHandVisualAngle = this.targetSecondBaseAngle;
    this.secondHandAnimationPhase = "SETTLED"; // Start in settled state
    this.blurSecondHandEffect = 0;

    // Bind animationLoop to this instance
    this._animationLoop = this._animationLoop.bind(this);
    this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
    console.log("Clock started");
  }

  /**
   * Stops the clock animation.
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log("Clock stopped");
  }

  /**
   * Converts degrees to radians.
   * @param {number} degrees Angle in degrees.
   * @returns {number} Angle in radians.
   */
  _degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * The main animation loop.
   * @param {DOMHighResTimeStamp} timestamp The current time.
   */
  _animationLoop(timestamp) {
    if (!this.isRunning) return;

    const delta = timestamp - this.lastTimestamp;
    // Throttle animation loop to optimise perception of the 'jump' phases
    const maxRefreshRateHz = 50;
    if (delta < 1000 / maxRefreshRateHz) {
      this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
      return;
    }
    // if (this.lastTimestamp !== -1) {
    //   const refreshRate = Math.round(1000 / delta);
    //   console.log(`Refresh rate: ${refreshRate} Hz`);
    // }
    this.lastTimestamp = timestamp;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentMilliseconds = now.getMilliseconds();

    // Calculate smooth hand angles
    const hourAngle = (((currentHours % 12) + currentMinutes / 60) / 12) * 360;
    const minuteAngle = ((currentMinutes + currentSeconds / 60) / 60) * 360;

    // --- SECOND HAND PHYSICS LOGIC ---
    const newSecondDetected = currentSeconds !== this.lastSystemSecond;
    this.blurSecondHandEffect = 0; // Default to no special blur

    if (newSecondDetected) {
      this.lastSystemSecond = currentSeconds;
      this.targetSecondBaseAngle = (currentSeconds / 60) * 360; // Normal angle for the new second
      this.secondHandAnimationPhase = "OVERSHOOT";
      this.currentSecondHandVisualAngle =
        this.targetSecondBaseAngle +
        this.config.secondHandPhysics.overshootDegrees;
      this.blurSecondHandEffect = -1; // Blur for OVERSHOOT jump (CW jump, blur trails ACW)
    } else {
      switch (this.secondHandAnimationPhase) {
        case "OVERSHOOT":
          this.secondHandAnimationPhase = "RECOIL";
          this.currentSecondHandVisualAngle =
            this.targetSecondBaseAngle +
            this.config.secondHandPhysics.recoilDegrees;
          this.blurSecondHandEffect = 1; // Blur for RECOIL jump (ACW jump, blur trails CW)
          break;
        case "RECOIL":
          this.secondHandAnimationPhase = "SETTLED";
          this.currentSecondHandVisualAngle = this.targetSecondBaseAngle;
          this.blurSecondHandEffect = -1; // Blur for SETTLED jump (CW jump, blur trails ACW)
          break;
        case "SETTLED":
          const millisecondsUntilNextTick = 1000 - currentMilliseconds;
          if (
            millisecondsUntilNextTick <=
              this.config.secondHandPhysics.creepDurationMs &&
            millisecondsUntilNextTick > 0
          ) {
            this.secondHandAnimationPhase = "CREEPING";
            // Fall through to CREEPING case to calculate position immediately
          } else {
            this.currentSecondHandVisualAngle = this.targetSecondBaseAngle; // Stay settled
            break; // Important: Break if not transitioning to CREEPING
          }
        // falls through to CREEPING if phase just changed or was already CREEPING
        case "CREEPING":
          // Ensure we are still in the creep window
          let msUntilNextTick = 1000 - currentMilliseconds;
          if (
            msUntilNextTick > this.config.secondHandPhysics.creepDurationMs ||
            msUntilNextTick < 0
          ) {
            // Creep window passed or time jumped, revert to settled or await next tick
            this.secondHandAnimationPhase = "SETTLED";
            this.currentSecondHandVisualAngle = this.targetSecondBaseAngle;
          } else {
            const timeIntoCreepMs =
              this.config.secondHandPhysics.creepDurationMs - msUntilNextTick;
            let creepProgress =
              timeIntoCreepMs / this.config.secondHandPhysics.creepDurationMs;
            creepProgress = Math.max(0, Math.min(1, creepProgress)); // Clamp progress

            const additionalCreepAngle =
              creepProgress * this.config.secondHandPhysics.creepAngleDegrees;
            this.currentSecondHandVisualAngle =
              this.targetSecondBaseAngle + additionalCreepAngle;
          }
          break;
        default: // Should not happen
          this.secondHandAnimationPhase = "SETTLED";
          this.targetSecondBaseAngle = (currentSeconds / 60) * 360;
          this.currentSecondHandVisualAngle = this.targetSecondBaseAngle;
          break;
      }
    }

    // --- RENDERING ---
    this._clearCanvas();
    this._drawClockFace();
    this._drawHands(hourAngle, minuteAngle, this.currentSecondHandVisualAngle);

    if (this.isRunning) {
      this.animationFrameId = window.requestAnimationFrame(this._animationLoop);
    }
  }

  /**
   * Clears the canvas.
   */
  _clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Draws the clock face (dial, numerals, tick marks, center pin).
   */
  _drawClockFace() {
    const { ctx, centerX, centerY, radius, config } = this;

    // Draw dial
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = config.dialColor;
    ctx.fill();

    // Draw border
    if (config.borderWidth > 0) {
      ctx.lineWidth = config.borderWidth;
      ctx.strokeStyle = config.borderColor;
      ctx.stroke();
    }

    // Draw numerals
    if (config.showNumerals) {
      const numeralSize = radius * 0.12; // Dynamic numeral size
      ctx.font = `${numeralSize}px ${config.numeralFont}`;
      ctx.fillStyle = config.numeralColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 1; i <= 12; i++) {
        const angle = this._degreesToRadians(i * 30 - 90); // -90 to align 12 at top
        const x = centerX + this.numeralRadius * Math.cos(angle);
        const y = centerY + this.numeralRadius * Math.sin(angle);
        ctx.fillText(i.toString(), x, y);
      }
    }

    // Draw tick marks
    for (let i = 0; i < 60; i++) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(this._degreesToRadians(i * 6)); // 6 degrees per minute/second

      if (i % 5 === 0) {
        // Major tick (hour)
        if (config.showNumerals || config.majorTickLength > 0) {
          // Draw if numerals shown or ticks explicitly sized
          ctx.beginPath();
          ctx.moveTo(
            0,
            -radius + config.majorTickLength + config.borderWidth / 2
          );
          ctx.lineTo(0, -radius + config.borderWidth / 2);
          ctx.lineWidth = config.majorTickWidth;
          ctx.strokeStyle = config.majorTickColor;
          ctx.stroke();
        }
      } else if (config.showMinorTicks) {
        // Minor tick (minute)
        ctx.beginPath();
        ctx.moveTo(
          0,
          -radius + config.minorTickLength + config.borderWidth / 2
        );
        ctx.lineTo(0, -radius + config.borderWidth / 2);
        ctx.lineWidth = config.minorTickWidth;
        ctx.strokeStyle = config.minorTickColor;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw center pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, config.centerPinRadius, 0, 2 * Math.PI);
    ctx.fillStyle = config.centerPinColor;
    ctx.fill();
    // Optional: add a highlight to the pin
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Draws all clock hands.
   * @param {number} hourAngle Angle of the hour hand in degrees.
   * @param {number} minuteAngle Angle of the minute hand in degrees.
   * @param {number} secondAngle Angle of the second hand in degrees.
   */
  _drawHands(hourAngle, minuteAngle, secondAngle) {
    const { config, radius } = this;

    // Standard shadow config
    const stdShadow = {
      offsetX: config.handShadowOffsetX,
      offsetY: config.handShadowOffsetY,
      blur: config.handShadowBlur,
      color: config.handShadowColor,
    };

    // Hour Hand
    this._drawHand(
      hourAngle,
      config.hourHandLength * radius,
      config.hourHandWidth,
      config.hourHandColor,
      stdShadow
    );

    // Minute Hand
    this._drawHand(
      minuteAngle,
      config.minuteHandLength * radius,
      config.minuteHandWidth,
      config.minuteHandColor,
      stdShadow
    );

    // Second Hand - potentially with motion blur
    let secShadow = { ...stdShadow }; // Start with standard shadow

    if (this.blurSecondHandEffect !== 0) {
      const handColor = config.secondHandColor;
      let r = 255,
        g = 0,
        b = 0; // Default to red if parse fails
      if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(handColor)) {
        let c = handColor.substring(1).split("");
        if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = "0x" + c.join("");
        r = (c >> 16) & 255;
        g = (c >> 8) & 255;
        b = c & 255;
      } else if (/^rgb/.test(handColor)) {
        const parts = handColor.match(/\d+/g);
        if (parts && parts.length >= 3) {
          r = parseInt(parts[0]);
          g = parseInt(parts[1]);
          b = parseInt(parts[2]);
        }
      }

      secShadow.color = `rgba(${r},${g},${b},0.35)`; // Motion blur color (semi-transparent hand color)
      secShadow.blur = config.secondHandPhysics.motionBlurStrength;

      // Optional: Adjust offset for a more "directional" motion blur feel
      // Based on the spec's blurSecondHandEffect direction hint
      // For simplicity, this example uses a slightly stronger, more diffuse shadow for blur.
      // A more complex directional offset could be implemented here if desired.
      // For example:
      // const blurOffset = 3;
      // if (this.blurSecondHandEffect === -1) { // ACW blur trail
      //     secShadow.offsetX = stdShadow.offsetX - blurOffset;
      //     secShadow.offsetY = stdShadow.offsetY - blurOffset;
      // } else if (this.blurSecondHandEffect === 1) { // CW blur trail
      //     secShadow.offsetX = stdShadow.offsetX + blurOffset;
      //     secShadow.offsetY = stdShadow.offsetY + blurOffset;
      // }
    }

    this._drawHand(
      secondAngle,
      config.secondHandLength * radius,
      config.secondHandWidth,
      config.secondHandColor,
      secShadow,
      true, // isSecondHand
      config.secondHandCounterWeightLength * radius
    );
  }

  /**
   * Generic function to draw a clock hand.
   * @param {number} angleDegrees Angle of the hand in degrees (0 at 12 o'clock, positive CW).
   * @param {number} length Pixel length of the hand from center.
   * @param {number} width Pixel width/thickness of the hand.
   * @param {string} color Color of the hand.
   * @param {object} shadowConfig Shadow properties {offsetX, offsetY, blur, color}.
   * @param {boolean} [isSecondHand=false] True if this is the second hand (for counterweight).
   * @param {number} [counterWeightLength=0] Pixel length of the counterweight.
   */
  _drawHand(
    angleDegrees,
    length,
    width,
    color,
    shadowConfig,
    isSecondHand = false,
    counterWeightLength = 0
  ) {
    const { ctx, centerX, centerY } = this;
    const angleRadians = this._degreesToRadians(angleDegrees - 90); // -90 to adjust: 0deg canvas is 3 o'clock

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angleRadians);

    // Apply shadow
    ctx.shadowOffsetX = shadowConfig.offsetX;
    ctx.shadowOffsetY = shadowConfig.offsetY;
    ctx.shadowBlur = shadowConfig.blur;
    ctx.shadowColor = shadowConfig.color;

    // Draw hand
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = "round"; // Rounded ends for hands

    if (isSecondHand && counterWeightLength > 0) {
      ctx.moveTo(-counterWeightLength, 0); // Start from counterweight end
    } else {
      ctx.moveTo(0, 0); // Start from center
    }
    ctx.lineTo(length, 0); // Draw to tip
    ctx.stroke();

    // Simple circle for second hand counterweight if needed (alternative to extending line)
    if (
      isSecondHand &&
      counterWeightLength > 0 &&
      this.config.centerPinRadius > 0
    ) {
      // Optional: draw a slightly larger circle at the base for the second hand
      ctx.beginPath();
      ctx.arc(0, 0, width * 1.2, 0, 2 * Math.PI); // e.g. width * 1.2
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore(); // Clear shadow settings and transformations for next drawing operation
  }
}

// Make class available if using modules or for direct script include
if (typeof module !== "undefined" && module.exports) {
  module.exports = AnalogueClock;
}
