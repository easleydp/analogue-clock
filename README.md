An analogue clock component with realistic second hand physics.

## **Core Features:**

1. **Realistic Second Hand Physics:**

   - **Anticipatory Creep**: The second hand begins to move forward ~300ms before each tick
   - **Overshoot**: Upon each tick, the hand jumps past the target position
   - **Recoil**: The hand then bounces back, undershooting slightly
   - **Settle**: Finally settles into the correct position

2. **Smooth Hour and Minute Hands:**

   - Continuous movement based on fractional time calculations
   - Hour hand moves smoothly between hour marks based on minutes
   - Minute hand moves smoothly between minute marks based on seconds

3. **Professional Clock Face:**

   - Major tick marks at each hour position
   - Minor tick marks at each minute position
   - Traditional 1-12 numerals
   - Realistic shadows on all hands for 3D appearance
   - Customizable styling options

4. **Performance Optimized:**
   - Uses `requestAnimationFrame` for smooth 60 FPS animation
   - Efficient canvas rendering with proper clearing
   - Throttled animation loop to prevent excessive CPU usage

## **Physics Implementation:**

The second hand follows a precise 4-state animation cycle:

- **SETTLED**: Hand rests at the correct second position
- **CREEPING**: 300ms before next tick, hand creeps forward 2°
- **OVERSHOOT**: At tick, hand jumps 3° past target with blur effect
- **RECOIL**: Hand bounces back 1.5° behind target, then settles

## **Technical Highlights:**

- **State Machine**: Robust state management for second hand physics
- **Blur Effects**: Visual motion blur during rapid movements
- **Configurable**: Extensive customization options for appearance and physics
- **Error Handling**: Proper initialization and clean-up
- **Modern Standards**: Clean, maintainable code with proper encapsulation

The clock automatically starts when the page loads and provides start/stop controls. Watch the second hand carefully - you'll notice the subtle anticipatory movement before each tick, followed by the realistic overshoot and recoil behaviour that mimics a mechanical timepiece!
