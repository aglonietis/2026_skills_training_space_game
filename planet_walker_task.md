**WorldSkills Competition 2027**
**Skill 17 - Web Technologies**
**Test Project - Module B: Frontend Development**

---

# Planet Walker - 3D Space Game

## Project Overview

Develop a 3D space survival game using HTML5 Canvas where a player (astronaut) stands on a rotating planet and collects crystals that appear on its surface. The planet rotates in response to player input while the character remains fixed at the center of the screen. Crystals expire over time — the player must keep collecting to survive. The game features a 3D sphere projection, bobbing collectibles with expiry animations, a parallax starfield, and a score-over-time chart on the results screen.

**Time allowed:** 3 hours

---

## Requirements

### Core Game Rendering (3D Canvas)

- Implement a 3D planet rendered as a sphere using HTML5 Canvas 2D API
- The planet must be rendered with a radial gradient (green tones) to give a 3D shaded appearance
- The planet surface must have randomly generated features (craters and patches) projected onto the sphere using 3D rotation math
- Implement an atmosphere glow effect extending slightly beyond the planet edge
- Render a starfield background (300 stars) distributed across a sky-sphere that slowly rotates with the planet for a parallax effect

### Player Character

- The player is always rendered at the **center of the screen** — it never moves
- The planet rotates beneath the player in response to input, creating the illusion of movement
- The character consists of: a helmet (filled circle), a visor with a reflection highlight, a torso, arms, and legs

### Planet Rotation & Controls

- Player input rotates the planet using **Arrow keys**
- The planet rotates; the player character stays fixed
- Movement must be smooth with acceleration and deceleration (velocity lerp, no instant changes)

### Collectibles (Crystals)

- Crystals spawn at random positions on the planet surface
- Maximum **6 crystals** can exist at once; a new crystal spawns every **2.5 seconds**
- **3 crystals** spawn immediately when the game starts
- Crystals are rendered as yellow diamond shapes with a glow effect
- Crystals must have some kind of animation
- Crystal opacity and size scale with their z-depth (appear larger/brighter when facing the player)
- Crystals on the far side of the planet (z ≤ 0) are not drawn
- Each crystal has a **lifespan** — it expires and disappears if not collected in time
  - Lifespan starts at **8 seconds** and shrinks as the player survives longer (minimum **3 seconds**)
  - At 40% life remaining the crystal starts fading out and the glow turns red/orange
  - At 15% life remaining the crystal flickers rapidly as a final warning

### Collision Detection

- A crystal is collected when its screen-space distance from the player (center of screen) is within a small threshold
- Only front-facing crystals (z > 0) can be collected

### Scoring System

- Each crystal collected: **100 points**
- Current score displayed during gameplay
- High score persists across sessions using `localStorage`

### Game Duration & Difficulty

- The game has no fixed time limit — the goal is to survive as long as possible
- Player dies if a crystal has not been collected for **5 seconds**
- A countdown timer (SS:MS format) shows how long until game over — it resets to 5s on each collection
- **Difficulty scales over time:** crystal lifespan shrinks the longer the player survives, making crystals disappear faster and forcing quicker reactions

### User Interface

The game consists of **3 screens**:

---

#### Screen 1: Start Screen

- Game title prominently displayed
- **"START GAME"** button
- High score display (from localStorage)
- Controls information: "Arrows to move"

---

#### Screen 2: Game Screen (HUD)

- Full-screen canvas showing the planet, player, crystals, and starfield
- **Top-left:** Current score
- **Bottom-center (or top):** Countdown timer in SS:MSMS format
- Player astronaut always visible at screen center

---

#### Screen 3: Game Over / Results Screen

- **"GAME OVER"** title
- Final score displayed (animated count-up from 0)
- **"NEW HIGH SCORE!"** message if player beat their previous best
- Statistics:
  - Survival time (MM:SS)
  - Crystals collected (total count)
- **Score over time chart:** A canvas-rendered line graph
  - X-axis: Time (seconds)
  - Y-axis: Score
  - Connected line with visible data points
  - Grid lines and axis labels
- **"PLAY AGAIN"** button
- **"MAIN MENU"** button

---

### Smooth Transitions and Animations

- **Screen transitions:** Fade in/out between screens (minimum 300ms)
- **Score animation:** Final score counts up from 0 on the game over screen
- **Object movement:** All rotation and collectible animations must be smooth (no teleporting)
- **Button interactions:** Hover and active states on all buttons

### Audio

- **Collect sound:** Short ascending tone when a crystal is collected (Web Audio API)
- **Game Over sound:** Descending tone when the game ends (Web Audio API)
- Audio must be implemented using the **Web Audio API**

---

## Technical Constraints

- **Technologies:** HTML, CSS, and JavaScript only
- **No external libraries:** All rendering, charts, animations, and audio must be custom-implemented
- **Data persistence:** Use `localStorage` for high score
- **Responsive:** Must work correctly on screens from 1024px to 1920px width
- **Browser support:** Google Chrome (latest version)
- **Single page:** The entire game in a single HTML page (separate CSS/JS files are allowed)
