// === SETTINGS & STATE ===
const CONFIG = {
    particleCount: 15000,
    shape: 'sphere', // Default, will change via GUI
    color: '#00ffff',
    particleSize: 3.0,
    spread: 1.0, // Multiplier for position scale
    tension: 1.0 // Multiplier for group scale
};

const SHAPES = ['sphere', 'hearts', 'flowers', 'saturn', 'buddha', 'fireworks'];

// Real-time state
let currentShape = 'hearts';
let isFist = false;
let lastFistTime = 0;
let fireworkActive = false;
let fireworkTime = 0;

// === THREE.JS SETUP ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// === PARTICLE SYSTEM ===
// Base geometry holding positions and target positions
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(CONFIG.particleCount * 3);
const targets = new Float32Array(CONFIG.particleCount * 3);
const randoms = new Float32Array(CONFIG.particleCount);

for (let i = 0; i < CONFIG.particleCount; i++) {
    const i3 = i * 3;
    // Initial random sphere
    const r = 50 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);
    
    // Target defaults to position initially
    targets[i3] = positions[i3];
    targets[i3 + 1] = positions[i3 + 1];
    targets[i3 + 2] = positions[i3 + 2];

    randoms[i] = Math.random();
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('targetPos', new THREE.BufferAttribute(targets, 3));
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

// Shader Material
const vertexShader = `
    uniform float uTime;
    uniform float uSpread;
    uniform float uTension;
    uniform float uSize;
    attribute vec3 targetPos;
    attribute float aRandom;
    varying float vRandom;
    
    void main() {
        vRandom = aRandom;
        vec3 pos = position;
        
        // Apply spread (distance)
        pos *= uSpread;
        
        // Apply tension (fist closed = scale down)
        pos *= uTension;

        // Slight breathing animation
        float noise = sin(uTime * 2.0 + aRandom * 10.0) * 0.5;
        vec3 normalDir = normalize(pos == vec3(0.0) ? vec3(0.0, 1.0, 0.0) : pos);
        pos += normalDir * noise; 

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        gl_PointSize = uSize * (30.0 / -mvPosition.z) * (aRandom + 0.5);
    }
`;

const fragmentShader = `
    uniform vec3 uColor;
    varying float vRandom;
    
    void main() {
        // Soft circle particle
        float d = distance(gl_PointCoord, vec2(0.5));
        if(d > 0.5) discard;
        
        // Add a bit of glow based on distance to center
        float alpha = smoothstep(0.5, 0.1, d);
        
        // Slightly vary color based on vRandom
        vec3 finalColor = uColor + vec3(vRandom * 0.2);
        
        gl_FragColor = vec4(finalColor, alpha * 0.8);
    }
`;

const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uSpread: { value: 1.0 },
        uTension: { value: 1.0 },
        uSize: { value: CONFIG.particleSize },
        uColor: { value: new THREE.Color(CONFIG.color) }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// === SHAPE GENERATORS ===
function generateShape(shapeName) {
    const t = geometry.attributes.targetPos.array;
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;
        let x, y, z;

        if (shapeName === 'hearts') {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI;
            const r = 15;
            x = r * 16 * Math.pow(Math.sin(u), 3);
            y = r * (13 * Math.cos(u) - 5 * Math.cos(2*u) - 2 * Math.cos(3*u) - Math.cos(4*u));
            z = r * 5 * Math.cos(v); 
            
            x *= 0.15; y *= 0.15; z *= 0.15;
            y += 5; 
        } 
        else if (shapeName === 'flowers') {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * 2 - 1;
            const r = 20 * (1 + 0.5 * Math.sin(5 * u)) * Math.sqrt(1 - v*v);
            x = r * Math.cos(u);
            y = r * Math.sin(u);
            z = 20 * v * 0.2; 
        }
        else if (shapeName === 'saturn') {
            const isRing = Math.random() > 0.4;
            if (isRing) {
                const angle = Math.random() * Math.PI * 2;
                const r = 25 + Math.random() * 15;
                x = r * Math.cos(angle);
                y = (Math.random() - 0.5) * 2;
                z = r * Math.sin(angle);
                const tilt = 0.5;
                const tempY = y * Math.cos(tilt) - z * Math.sin(tilt);
                z = y * Math.sin(tilt) + z * Math.cos(tilt);
                y = tempY;
            } else {
                const r = 15 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            }
        }
        else if (shapeName === 'buddha') {
            const part = Math.random();
            if (part < 0.2) { // head
                const r = 5 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta) + 18;
                z = r * Math.cos(phi);
            } else if (part < 0.6) { // torso
                const r = 10 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta) * 1.5 + 2;
                z = r * Math.cos(phi) * 0.8;
            } else { // base/legs
                const r = 15 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta) * 1.5;
                y = r * Math.sin(phi) * Math.sin(theta) * 0.4 - 10;
                z = r * Math.cos(phi);
            }
        }
        else if (shapeName === 'fireworks') {
            if (fireworkActive) {
                const r = 50 * Math.random();
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            } else {
                const r = 2 * Math.random();
                x = r * Math.random(); y = r * Math.random(); z = r * Math.random();
            }
        }
        else { // sphere
            const r = 20 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
        }

        // Add random scatter
        x += (Math.random() - 0.5) * 2;
        y += (Math.random() - 0.5) * 2;
        z += (Math.random() - 0.5) * 2;

        t[i3] = x;
        t[i3 + 1] = y;
        t[i3 + 2] = z;
    }
    geometry.attributes.targetPos.needsUpdate = true;
}

generateShape(currentShape);

// === GUI SETUP ===
const gui = new dat.GUI();
const controls = {
    shape: currentShape,
    color: CONFIG.color,
    size: CONFIG.particleSize,
    manualSpread: 1.0,
    manualTension: 1.0,
    cameraControl: true
};

gui.add(controls, 'shape', SHAPES).onChange(v => {
    currentShape = v;
    generateShape(v);
});
gui.addColor(controls, 'color').onChange(v => material.uniforms.uColor.value.set(v));
gui.add(controls, 'size', 0.1, 10.0).onChange(v => material.uniforms.uSize.value = v);
gui.add(controls, 'cameraControl').name('Use Webcam Gestures');
const folder = gui.addFolder('Manual Controls (if Camera off)');
folder.add(controls, 'manualSpread', 0.1, 3.0);
folder.add(controls, 'manualTension', 0.1, 2.0);
folder.open();

// === MEDIAPIPE HANDS SETUP ===
const videoElement = document.getElementById('video');
const statusIndicator = document.querySelector('.indicator');
const statusText = document.querySelector('#camera-status');

let handsInstance = null;
let cameraInstance = null;

try {
    handsInstance = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`; 
        }
    });

    handsInstance.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    handsInstance.onResults(onResults);

    cameraInstance = new Camera(videoElement, {
        onFrame: async () => {
            if(controls.cameraControl) {
                await handsInstance.send({image: videoElement});
            }
        },
        width: 640,
        height: 480
    });
    
    cameraInstance.start()
        .then(() => {
            statusIndicator.className = 'indicator green';
            statusText.innerHTML = '<span class="indicator green"></span> Camera: Active';
        })
        .catch(err => {
            console.error(err);
            statusText.innerHTML = '<span class="indicator red"></span> Camera: Error/Denied';
        });

} catch (e) {
    console.error("MediaPipe initialization failed", e);
}

function onResults(results) {
    if (!controls.cameraControl) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        
        // 1. Map Hand Distance (X-axis relative to center) to Spread
        const palmX = hand[0].x;
        const spread = 0.5 + Math.abs(palmX - 0.5) * 4.0; 
        CONFIG.spread = spread;

        // 2. Fist Tension
        const wrist = hand[0];
        const indexTip = hand[8];
        const middleTip = hand[12];
        const ringTip = hand[16];
        const pinkyTip = hand[20];

        const getDist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        const avgDist = (getDist(wrist, indexTip) + getDist(wrist, middleTip) + getDist(wrist, ringTip) + getDist(wrist, pinkyTip)) / 4;

        const tension = Math.max(0.1, Math.min(1.0, (avgDist - 0.1) * 2.5)); 
        CONFIG.tension = 0.5 + tension * 0.5;

        const wasFist = isFist;
        isFist = avgDist < 0.2;

        // 3. Quick Fist Snap -> Fireworks
        if (isFist && !wasFist) {
            const now = Date.now();
            if (now - lastFistTime < 500 && !fireworkActive) { 
                triggerFireworks();
            }
            lastFistTime = now;
        }

    } else {
        // Return to defaults gracefully
        CONFIG.spread += (1.0 - CONFIG.spread) * 0.1;
        CONFIG.tension += (1.0 - CONFIG.tension) * 0.1;
    }
}

function triggerFireworks() {
    fireworkActive = true;
    fireworkTime = 0;
    const prevShape = currentShape;
    currentShape = 'fireworks';
    generateShape('fireworks');
    controls.shape = 'fireworks';
    gui.updateDisplay();

    // Reset after 2 seconds
    setTimeout(() => {
        fireworkActive = false;
        currentShape = prevShape;
        generateShape(prevShape);
        controls.shape = prevShape;
        gui.updateDisplay();
    }, 2000);
}

// === ANIMATION LOOP ===
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    material.uniforms.uTime.value = time;

    // Smoothly interpolate uniforms
    const targetSpread = controls.cameraControl ? CONFIG.spread : controls.manualSpread;
    const targetTension = controls.cameraControl ? CONFIG.tension : controls.manualTension;
    
    material.uniforms.uSpread.value += (targetSpread - material.uniforms.uSpread.value) * 0.1;
    material.uniforms.uTension.value += (targetTension - material.uniforms.uTension.value) * 0.1;

    // Smoothly interpolate positions to target positions
    const pos = geometry.attributes.position.array;
    const tgt = geometry.attributes.targetPos.array;
    let lerpSpeed = 0.05;
    
    if (currentShape === 'fireworks' && fireworkActive) {
        lerpSpeed = 0.2;
    }

    for (let i = 0; i < pos.length; i++) {
        pos[i] += (tgt[i] - pos[i]) * lerpSpeed;
    }
    geometry.attributes.position.needsUpdate = true;
    
    // Rotate scene slightly
    particles.rotation.y = time * 0.2;
    particles.rotation.x = Math.sin(time * 0.1) * 0.2;

    renderer.render(scene, camera);
}

animate();

// === RESIZE HANDLER ===
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
