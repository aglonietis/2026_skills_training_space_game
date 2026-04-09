    // Planet Walker - 3D Sphere Planet Game
// Reference Solution for WorldSkills Competition

// ============================================
// GAME CONFIGURATION
// ============================================
const CONFIG = {
    PLANET_RADIUS: 180,
    ROTATION_SPEED: 0.015,
    COLLECTIBLE_SPAWN_INTERVAL: 2500,
    MAX_COLLECTIBLES: 6,
    COLLECT_TIMEOUT:          5000,  // ms since last collection before game over
    COLLECTIBLE_SPAWN_INTERVAL: 2500,  // ms between spawns
    CRYSTAL_LIFESPAN_START:   8000,  // ms a crystal lives at game start
    CRYSTAL_LIFESPAN_MIN:     3000,  // ms floor (hardest)
};

// ============================================
// GAME STATE
// ============================================
let canvas, ctx;
let gameState = 'menu';
let animationId = null;
let lastTimestamp = 0;

// Planet rotation as a 3x3 matrix (incremental world-space rotations)
let planetMatrix = [[1,0,0],[0,1,0],[0,0,1]];
let starMatrix   = [[1,0,0],[0,1,0],[0,0,1]]; // rotates at a fraction of planet speed
let rotVelX = 0, rotVelY = 0;         // smoothed velocity
let targetVelX = 0, targetVelY = 0;
let starVelX = 0, starVelY = 0;       // star velocity — same speed, lazier lerp

// Player is always at "top" of visible sphere
// Movement rotates the planet instead

// Game stats
let score = 0;
let highScore = 0;
let collectibles = [];
let gameTime = 0;
let lastCollectTime = 0;  // timestamp of last crystal collection
let collectiblesGathered = 0;
let scoreHistory = [];
let lastScoreRecord = 0;

// Stars background
let stars = [];

// Input
let keys = {};

// Audio
let audioContext = null;

// Planet surface features (craters, patches)
let surfaceFeatures = [];

// ============================================
// 3D MATH UTILITIES
// ============================================
function rotateX(point, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: point.x,
        y: point.y * cos - point.z * sin,
        z: point.y * sin + point.z * cos
    };
}

function rotateY(point, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: point.x * cos + point.z * sin,
        y: point.y,
        z: -point.x * sin + point.z * cos
    };
}

function sphereToCartesian(lat, lon, radius) {
    // lat: -PI/2 to PI/2, lon: 0 to 2*PI
    const x = radius * Math.cos(lat) * Math.sin(lon);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lat) * Math.cos(lon);
    return { x, y, z };
}

// Multiply two 3x3 matrices
function mat3Mul(a, b) {
    const r = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            for (let k = 0; k < 3; k++)
                r[i][j] += a[i][k] * b[k][j];
    return r;
}

// Apply 3x3 matrix to a point
function mat3Apply(m, p) {
    return {
        x: m[0][0]*p.x + m[0][1]*p.y + m[0][2]*p.z,
        y: m[1][0]*p.x + m[1][1]*p.y + m[1][2]*p.z,
        z: m[2][0]*p.x + m[2][1]*p.y + m[2][2]*p.z
    };
}

// Incremental rotation matrices (match convention of existing rotateX/rotateY)
function rotXMat(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [[1,0,0],[0,c,-s],[0,s,c]];
}

function rotYMat(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [[c,0,s],[0,1,0],[-s,0,c]];
}

function project(point, cx, cy, scale = 400, distance = 5) {
    const z = point.z + distance;
    const factor = scale / z;
    return {
        x: cx + point.x * factor,
        y: cy - point.y * factor, // Flip Y for screen coords
        z: point.z,
        scale: factor
    };
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    highScore = parseInt(localStorage.getItem('planetWalkerHighScore')) || 0;
    updateHighScoreDisplay();

    setupEventListeners();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    generateStars();
    generateSurfaceFeatures();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
            e.preventDefault();
            keys[e.code] = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    document.getElementById('start-btn').addEventListener('click', (e) => {
        e.target.blur();
        startGame();
    });
    document.getElementById('play-again-btn').addEventListener('click', (e) => {
        e.target.blur();
        startGame();
    });
    document.getElementById('main-menu-btn').addEventListener('click', (e) => {
        e.target.blur();
        showMainMenu();
    });
}

function generateStars() {
    stars = [];
    for (let i = 0; i < 300; i++) {
        // Uniform random point on unit sphere
        const lat = Math.asin(Math.random() * 2 - 1);
        const lon = Math.random() * Math.PI * 2;
        stars.push({
            nx: Math.cos(lat) * Math.sin(lon),
            ny: Math.sin(lat),
            nz: Math.cos(lat) * Math.cos(lon),
            size: Math.random() * 2 + 0.5,
            brightness: Math.random() * 0.5 + 0.3
        });
    }
}

function generateSurfaceFeatures() {
    surfaceFeatures = [];
    // Generate random craters/features on sphere surface
    for (let i = 0; i < 25; i++) {
        surfaceFeatures.push({
            lat: (Math.random() - 0.5) * Math.PI, // -PI/2 to PI/2
            lon: Math.random() * Math.PI * 2,     // 0 to 2*PI
            size: Math.random() * 15 + 5,
            type: Math.random() > 0.5 ? 'crater' : 'patch',
            color: Math.random() > 0.5 ? 'darker' : 'lighter'
        });
    }
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
function showMainMenu() {
    gameState = 'menu';
    if (animationId) cancelAnimationFrame(animationId);
    planetMatrix = [[1,0,0],[0,1,0],[0,0,1]];
    starMatrix   = [[1,0,0],[0,1,0],[0,0,1]];
    rotVelX = 0; rotVelY = 0; targetVelX = 0; targetVelY = 0;
    starVelX = 0; starVelY = 0;
    keys = {};
    updateHighScoreDisplay();
    showScreen('start-screen');
    animationId = requestAnimationFrame(menuLoop);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.toggle('active', screen.id === screenId);
    });
}

function updateHighScoreDisplay() {
    document.getElementById('menu-high-score').textContent = highScore.toLocaleString();
    document.getElementById('best-score').textContent = highScore.toLocaleString();
}

// ============================================
// GAME FLOW
// ============================================
function startGame() {
    gameState = 'playing';
    score = 0;
    gameTime = 0;
    lastCollectTime = 0;
    collectiblesGathered = 0;
    scoreHistory = [{ time: 0, score: 0 }];
    lastScoreRecord = 0;

    planetMatrix = [[1,0,0],[0,1,0],[0,0,1]];
    starMatrix   = [[1,0,0],[0,1,0],[0,0,1]];
    rotVelX = 0; rotVelY = 0; targetVelX = 0; targetVelY = 0;
    starVelX = 0; starVelY = 0;

    collectibles = [];
    generateSurfaceFeatures();

    // Spawn initial collectibles
    for (let i = 0; i < 3; i++) {
        spawnCollectible();
    }

    keys = {};

    showScreen('game-screen');

    setTimeout(() => {
        resizeCanvas();
        generateStars();
        document.getElementById('game-container').focus();
        updateScore();
        updateTime();

        if (animationId) cancelAnimationFrame(animationId);
        lastTimestamp = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }, 50);
}

function endGame() {
    gameState = 'gameover';

    const isNewHighScore = score > highScore;
    if (isNewHighScore) {
        highScore = score;
        localStorage.setItem('planetWalkerHighScore', highScore);
    }

    playGameOverSound();

    document.getElementById('final-score-value').textContent = '0';
    document.getElementById('stat-time').textContent = formatTime(gameTime);
    document.getElementById('stat-collectibles').textContent = collectiblesGathered;

    const highScoreMsg = document.getElementById('new-highscore-msg');
    highScoreMsg.classList.toggle('hidden', !isNewHighScore);

    showScreen('gameover-screen');
    animateScoreCount();
    setTimeout(drawScoreChart, 500);
}

function animateScoreCount() {
    const el = document.getElementById('final-score-value');
    const start = performance.now();
    const duration = 1000;

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.floor(score * progress).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ============================================
// GAME LOOP - 60 FPS
// ============================================
function gameLoop(timestamp) {
    if (gameState !== 'playing') return;

    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    gameTime += deltaTime;

    if (gameTime - lastCollectTime >= CONFIG.COLLECT_TIMEOUT) {
        endGame();
        return;
    }

    if (gameTime - lastScoreRecord >= 5000) {
        scoreHistory.push({ time: gameTime / 1000, score });
        lastScoreRecord = gameTime;
    }

    // Handle input - rotate planet
    handleInput(deltaTime);

    // Smooth velocity, then apply incremental world-space rotation
    rotVelX += (targetVelX - rotVelX) * 0.1;
    rotVelY += (targetVelY - rotVelY) * 0.1;
    planetMatrix = mat3Mul(rotYMat(rotVelY), mat3Mul(rotXMat(rotVelX), planetMatrix));
    starVelX += (rotVelX - starVelX) * 0.03; // lazy lerp — stars ease in/out slowly
    starVelY += (rotVelY - starVelY) * 0.03;
    starMatrix = mat3Mul(rotYMat(starVelY), mat3Mul(rotXMat(starVelX), starMatrix));

    // Expire old crystals
    collectibles = collectibles.filter(c => gameTime - c.spawnTime < c.lifespan);

    // Check collisions with collectibles
    checkCollisions();

    // Spawn collectibles
    spawnCollectiblesOverTime(timestamp);

    // Render
    render();
    updateScore();
    updateTime();

    animationId = requestAnimationFrame(gameLoop);
}

// ============================================
// INPUT - Planet rotates when walking
// ============================================
// Crystal lifespan shrinks as you survive longer (8s → 3s floor)
function getCrystalLifespan() {
    const s = gameTime / 1000;
    return Math.max(CONFIG.CRYSTAL_LIFESPAN_MIN, CONFIG.CRYSTAL_LIFESPAN_START - s * 50);
}

function handleInput(deltaTime) {
    const speed = CONFIG.ROTATION_SPEED;
    targetVelX = 0;
    targetVelY = 0;
    if (keys['ArrowUp'] || keys['KeyW'])    targetVelX =  speed;
    if (keys['ArrowDown'] || keys['KeyS'])  targetVelX = -speed;
    if (keys['ArrowLeft'] || keys['KeyA'])  targetVelY =  speed;
    if (keys['ArrowRight'] || keys['KeyD']) targetVelY = -speed;
}

// ============================================
// COLLECTIBLES
// ============================================
let lastSpawnTime = 0;

function spawnCollectible() {
    if (collectibles.length >= CONFIG.MAX_COLLECTIBLES) return;

    // Random position on sphere (avoid poles)
    const lat = (Math.random() - 0.5) * Math.PI * 0.8;
    const lon = Math.random() * Math.PI * 2;

    collectibles.push({
        lat,
        lon,
        bobPhase: Math.random() * Math.PI * 2,
        spawnTime: gameTime,
        lifespan: getCrystalLifespan()
    });
}

function spawnCollectiblesOverTime(timestamp) {
    if (timestamp - lastSpawnTime > CONFIG.COLLECTIBLE_SPAWN_INTERVAL) {
        spawnCollectible();
        lastSpawnTime = timestamp;
    }
}

function checkCollisions() {
    // Player is at top of sphere (lat ≈ PI/2 after rotation)
    // Check if any collectible is near the top
    const collectZone = 0.2; // Screen-space radius around player center (normalised coords)

    for (let i = collectibles.length - 1; i >= 0; i--) {
        const c = collectibles[i];

        // Transform collectible position by current rotation matrix
        let pos = sphereToCartesian(c.lat, c.lon, 1);
        pos = mat3Apply(planetMatrix, pos);

        // Check if it's at the top (y close to 1)
        const screenDist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
        if (screenDist < collectZone && pos.z > 0) {
            collectibles.splice(i, 1);
            score += 100;
            collectiblesGathered++;
            lastCollectTime = gameTime;
            playCollectSound();
        }
    }
}

// ============================================
// RENDERING
// ============================================
function render() {
    // Clear with space background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Draw stars
    drawStars(cx, cy);

    // Draw planet
    drawPlanet(ctx, cx, cy, CONFIG.PLANET_RADIUS, planetMatrix);

    // Draw player on top of planet
    drawPlayer(ctx, cx, cy);
}

function drawStars(cx, cy) {
    const scale = Math.max(canvas.width, canvas.height) / 2;
    for (const star of stars) {
        const pos = mat3Apply(starMatrix, { x: star.nx, y: star.ny, z: star.nz });
        if (pos.z <= 0) continue; // behind the camera
        const alpha = star.brightness * Math.min(1, pos.z * 4); // fade near horizon
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx + pos.x * scale, cy - pos.y * scale, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlanet(context, cx, cy, radius, rotation) {
    // Draw planet sphere with gradient
    const gradient = context.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, 0,
        cx, cy, radius
    );
    gradient.addColorStop(0, '#4a7c4e');   // Lighter green
    gradient.addColorStop(0.5, '#2d5a30'); // Mid green
    gradient.addColorStop(1, '#1a3d1c');   // Dark green edge

    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();

    // Draw surface features (craters, patches)
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();

    for (const feature of surfaceFeatures) {
        let pos = sphereToCartesian(feature.lat, feature.lon, radius * 0.98);
        pos = mat3Apply(rotation, pos);

        // Only draw if on visible side (z > 0)
        if (pos.z > 0) {
            const screenX = cx + pos.x;
            const screenY = cy - pos.y;

            // Size scales with z position (perspective)
            const scale = (pos.z / radius + 0.5);
            const size = feature.size * scale;

            context.beginPath();
            context.arc(screenX, screenY, size, 0, Math.PI * 2);

            if (feature.type === 'crater') {
                context.fillStyle = feature.color === 'darker'
                    ? 'rgba(0, 30, 0, 0.4)'
                    : 'rgba(100, 150, 100, 0.3)';
            } else {
                context.fillStyle = feature.color === 'darker'
                    ? 'rgba(20, 60, 20, 0.5)'
                    : 'rgba(80, 130, 80, 0.4)';
            }
            context.fill();
        }
    }

    // Draw collectibles on planet
    for (const c of collectibles) {
        let pos = sphereToCartesian(c.lat, c.lon, radius + 5);
        pos = mat3Apply(rotation, pos);

        // Only draw if on visible side
        if (pos.z > -radius * 0.3) {
            const screenX = cx + pos.x;
            const screenY = cy - pos.y;

            const scale = Math.max(0.3, (pos.z / radius + 1) * 0.6);
            const bob = Math.sin(Date.now() / 200 + c.bobPhase) * 3 * scale;

            // Fade based on depth
            const depthAlpha = Math.max(0.3, (pos.z / radius + 1) * 0.5);

            // Fade based on remaining lifespan (starts fading at 40% life left)
            const lifeRemaining = 1 - (gameTime - c.spawnTime) / c.lifespan;
            const lifeAlpha = lifeRemaining < 0.4 ? lifeRemaining / 0.4 : 1;

            // Flicker urgently in last 15%
            const flicker = lifeRemaining < 0.15
                ? (Math.floor(Date.now() / 120) % 2 === 0 ? 0.3 : 1)
                : 1;

            const alpha = depthAlpha * lifeAlpha * flicker;

            context.save();
            context.translate(screenX, screenY + bob);
            context.globalAlpha = alpha;

            // Glow — shifts red as crystal nears expiry
            context.shadowColor = lifeRemaining < 0.4 ? '#ff4400' : '#ffff00';
            context.shadowBlur = 10 * scale;

            // Diamond shape
            const size = 12 * scale;
            context.beginPath();
            context.moveTo(0, -size);
            context.lineTo(size * 0.6, 0);
            context.lineTo(0, size);
            context.lineTo(-size * 0.6, 0);
            context.closePath();

            context.fillStyle = '#ffdd00';
            context.fill();
            context.strokeStyle = '#fff';
            context.lineWidth = 2 * scale;
            context.stroke();

            context.restore();
        }
    }

    context.restore();

    // Draw atmosphere glow
    const atmosphereGradient = context.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.15);
    atmosphereGradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
    atmosphereGradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.1)');
    atmosphereGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

    context.beginPath();
    context.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    context.fillStyle = atmosphereGradient;
    context.fill();

    // Planet edge highlight
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(150, 255, 150, 0.3)';
    context.lineWidth = 2;
    context.stroke();
}

function drawPlayer(context, x, y) {
    context.save();
    context.translate(x, y);

    // Astronaut body
    const scale = 0.6;

    // Legs
    context.strokeStyle = '#4a9eff';
    context.lineWidth = 4 * scale;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(0, 10 * scale);
    context.lineTo(-8 * scale, 28 * scale);
    context.moveTo(0, 10 * scale);
    context.lineTo(8 * scale, 28 * scale);
    context.stroke();

    // Torso
    context.beginPath();
    context.moveTo(0, -5 * scale);
    context.lineTo(0, 10 * scale);
    context.stroke();

    // Arms
    context.beginPath();
    context.moveTo(-12 * scale, 3 * scale);
    context.lineTo(12 * scale, 3 * scale);
    context.stroke();

    // Helmet (head)
    context.fillStyle = '#4a9eff';
    context.beginPath();
    context.arc(0, -14 * scale, 10 * scale, 0, Math.PI * 2);
    context.fill();

    // Visor
    context.fillStyle = '#87ceeb';
    context.beginPath();
    context.arc(0, -14 * scale, 7 * scale, 0, Math.PI * 2);
    context.fill();

    // Visor reflection
    context.fillStyle = 'rgba(255, 255, 255, 0.4)';
    context.beginPath();
    context.arc(-2 * scale, -16 * scale, 3 * scale, 0, Math.PI * 2);
    context.fill();

    context.restore();
}

// ============================================
// UI
// ============================================
function updateScore() {
    document.getElementById('current-score').textContent = score.toLocaleString();
}

function updateTime() {
    const remaining = Math.max(0, CONFIG.COLLECT_TIMEOUT - (gameTime - lastCollectTime));
    document.getElementById('time-display').textContent = formatCountdown(remaining);
}

// SS:MS format for the in-game danger countdown
function formatCountdown(ms) {
    const s = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10); // centiseconds (2 digits)
    return `${s.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;
}

// MM:SS format for survival time on results screen
function formatTime(ms) {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// CHART
// ============================================
function drawScoreChart() {
    const chart = document.getElementById('score-chart');
    const c = chart.getContext('2d');
    chart.width = chart.offsetWidth;
    chart.height = chart.offsetHeight;

    if (scoreHistory[scoreHistory.length - 1]?.score !== score) {
        scoreHistory.push({ time: gameTime / 1000, score });
    }

    const pad = 40;
    const w = chart.width - pad * 2;
    const h = chart.height - pad * 2;
    const maxT = Math.max(...scoreHistory.map(p => p.time), 1);
    const maxS = Math.max(...scoreHistory.map(p => p.score), 100);

    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0, 0, chart.width, chart.height);

    // Grid
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const x = pad + w * i / 5;
        c.beginPath(); c.moveTo(x, pad); c.lineTo(x, chart.height - pad); c.stroke();
    }
    for (let i = 0; i <= 4; i++) {
        const y = pad + h * i / 4;
        c.beginPath(); c.moveTo(pad, y); c.lineTo(chart.width - pad, y); c.stroke();
    }

    // Axes
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(pad, pad); c.lineTo(pad, chart.height - pad); c.lineTo(chart.width - pad, chart.height - pad);
    c.stroke();

    // Labels
    c.fillStyle = '#888';
    c.font = '11px monospace';
    c.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
        c.fillText(Math.round(maxT * i / 5) + 's', pad + w * i / 5, chart.height - pad + 16);
    }
    c.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        c.fillText(Math.round(maxS * (4 - i) / 4), pad - 6, pad + h * i / 4 + 4);
    }

    // Line
    c.strokeStyle = '#4a9eff';
    c.lineWidth = 3;
    c.beginPath();
    scoreHistory.forEach((p, i) => {
        const x = pad + (p.time / maxT) * w;
        const y = chart.height - pad - (p.score / maxS) * h;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    });
    c.stroke();

    // Points
    c.fillStyle = '#4a9eff';
    scoreHistory.forEach(p => {
        const x = pad + (p.time / maxT) * w;
        const y = chart.height - pad - (p.score / maxS) * h;
        c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    });
}

// ============================================
// AUDIO
// ============================================
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playCollectSound() {
    try {
        initAudio();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, audioContext.currentTime);
        osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.08);
        osc.frequency.setValueAtTime(784, audioContext.currentTime + 0.16);
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        osc.start();
        osc.stop(audioContext.currentTime + 0.25);
    } catch (e) {}
}

function playGameOverSound() {
    try {
        initAudio();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc.start();
        osc.stop(audioContext.currentTime + 0.5);
    } catch (e) {}
}

// ============================================
// START
// ============================================
document.addEventListener('DOMContentLoaded', init);
