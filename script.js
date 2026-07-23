// --- GLOBAL VARIABLES & CONFIGURATION ---
let scene, camera3D, renderer, particles;
const particleCount = 80000;
const clock = new THREE.Clock();
const LERP_SPEED = 0.1;

const GUI_PARAMS = {
    template: 'hearts',
    color: '#FF44AA',
    particleSize: 3.0,
    motionNoiseStrength: 0.05,
    gestureControl: true,
    spread: 0.5,
    scale: 0.5,
    activeCount: 40000,
};

const HAND_STATE = {
    ready: false,
    tracking: false,
    handTension: 0.0,
    lastTension: 0.0,
};

// --- TEMPLATE GENERATOR FUNCTIONS ---

function generateHeartTemplate(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const t = Math.random() * 2 * Math.PI;
        const r = 2.0;
        let x = r * 16 * Math.pow(Math.sin(t), 3);
        let y = -r * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        let z = (Math.random() - 0.5) * 40;

        positions[i * 3 + 0] = x * 0.05;
        positions[i * 3 + 1] = y * 0.05 + 1.0;
        positions[i * 3 + 2] = z * 0.01;
    }
    return positions;
}

function generateFlowerTemplate(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r1 = Math.pow(Math.random(), 0.3) * 2;
        const theta = Math.random() * 2 * Math.PI;
        const phi = (Math.random() * 2 - 1) * Math.PI;

        let x = r1 * Math.cos(theta) * Math.cos(phi);
        let y = r1 * Math.sin(phi);
        let z = r1 * Math.sin(theta) * Math.cos(phi);

        const petalFactor = Math.sin(theta * 5) * 0.2;
        x += x * petalFactor;
        z += z * petalFactor;

        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }
    return positions;
}

function generateSaturnTemplate(count) {
    const positions = new Float32Array(count * 3);
    const coreCount = Math.floor(count * 0.35);

    for (let i = 0; i < coreCount; i++) {
        const r = Math.pow(Math.random(), 1 / 3) * 0.6;
        const theta = Math.random() * 2 * Math.PI;
        const phi = (Math.random() * 2 - 1) * Math.PI;
        positions[i * 3 + 0] = r * Math.cos(theta) * Math.cos(phi);
        positions[i * 3 + 1] = r * Math.sin(phi);
        positions[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi);
    }

    for (let i = 0; i < count - coreCount; i++) {
        const idx = coreCount + i;
        const r = THREE.MathUtils.randFloat(1.1, 2.2);
        const theta = Math.random() * 2 * Math.PI;
        const height = THREE.MathUtils.randFloat(-0.04, 0.04);
        positions[idx * 3 + 0] = r * Math.cos(theta);
        positions[idx * 3 + 1] = height;
        positions[idx * 3 + 2] = r * Math.sin(theta);
    }
    return positions;
}

function generateBuddhaTemplate(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        let x, y, z;
        if (Math.random() < 0.5) {
            x = (Math.random() - 0.5) * 0.3;
            y = (Math.random() - 0.5) * 2.5;
        } else {
            x = (Math.random() - 0.5) * 1.8;
            y = (Math.random() - 0.5) * 0.3;
        }
        z = (Math.random() - 0.5) * 0.2;

        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = y + 0.2;
        positions[i * 3 + 2] = z;
    }
    return positions;
}

function generateFireworksTemplate(count) {
    return generateHeartTemplate(count);
}

// Global particle shape registry
const PARTICLE_TEMPLATES = {
    hearts: generateHeartTemplate(particleCount),
    flowers: generateFlowerTemplate(particleCount),
    saturn: generateSaturnTemplate(particleCount),
    buddha: generateBuddhaTemplate(particleCount),
    fireworks: generateFireworksTemplate(particleCount),
};

// --- GLSL SHADERS ---

const vertexShader = `
    uniform float uTime;
    uniform float uSize;
    uniform float uSpread;
    uniform float uScale;
    uniform float uTemplateMix;
    uniform float uExplosionIntensity;

    attribute vec3 position2; 
    attribute float pIndex; 

    varying float vAlpha;

    void main() {
        vec3 targetPosition = mix(position, position2, uTemplateMix);
        vec3 finalPosition = targetPosition * uScale + targetPosition * uSpread * 4.0;

        // Add a slight movement using pIndex and uTime
        finalPosition.x += sin(uTime * 0.5 + pIndex * 100.0) * 0.05;
        finalPosition.y += cos(uTime * 0.5 + pIndex * 100.0) * 0.05;

        if (uExplosionIntensity > 0.0) {
            vec3 dir = normalize(finalPosition + vec3(0.001));
            finalPosition += dir * uExplosionIntensity * 15.0;
        }

        vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
        gl_PointSize = uSize * (250.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;

        vAlpha = max(0.0, 1.0 - uExplosionIntensity); 
    }
`;

const fragmentShader = `
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = length(cxy);
        if (r > 1.0) {
            discard;
        }
        // Crisper circle and reduced alpha for better clarity
        float alpha = smoothstep(1.0, 0.7, r) * vAlpha * 0.4;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

// --- THREE.JS SCENE SETUP ---

function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x111111, 10, 100);

    camera3D = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera3D.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    createParticleSystem(particleCount);
    initGUI();

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function createParticleSystem(count) {
    if (particles) scene.remove(particles);

    const geometry = new THREE.BufferGeometry();
    const positions = PARTICLE_TEMPLATES.hearts.slice(0, count * 3);
    const positions2 = PARTICLE_TEMPLATES.hearts.slice(0, count * 3);
    const pIndices = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        pIndices[i] = i / count;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('position2', new THREE.BufferAttribute(positions2, 3));
    geometry.setAttribute('pIndex', new THREE.BufferAttribute(pIndices, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSize: { value: GUI_PARAMS.particleSize },
            uSpread: { value: GUI_PARAMS.spread },
            uScale: { value: GUI_PARAMS.scale },
            uColor: { value: new THREE.Color(GUI_PARAMS.color) },
            uTemplateMix: { value: 0.0 },
            uExplosionIntensity: { value: 0.0 },
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    particles = new THREE.Points(geometry, material);
    particles.geometry.setDrawRange(0, GUI_PARAMS.activeCount);
    scene.add(particles);
}

function onWindowResize() {
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- GESTURE PROCESSING ---

function mapRange(value, in_min, in_max, out_min, out_max) {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function calculateHandTension(landmarks) {
    let totalDist = 0;
    const points = [4, 8, 12, 16, 20];
    const wrist = landmarks[0];

    for (let i = 0; i < points.length; i++) {
        const tip = landmarks[points[i]];
        const dist = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2) +
            Math.pow(tip.z - wrist.z, 2)
        );
        totalDist += dist;
    }
    // Wrist to tips dist: ~1.0 for closed fist, ~2.5 for open hand.
    return Math.min(1.0, Math.max(0.0, mapRange(totalDist, 1.0, 2.5, 0.0, 1.0)));
}

function processGestures(results) {
    if (!GUI_PARAMS.gestureControl) return;

    // Clear and prepare canvas
    if (canvas2d && ctx && videoElement.videoWidth) {
        canvas2d.width = videoElement.videoWidth;
        canvas2d.height = videoElement.videoHeight;
        ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
    }

    const detectedHands = results.multiHandLandmarks;

    if (detectedHands && detectedHands.length > 0) {
        // Draw hand skeleton
        if (ctx) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            const HAND_CONNECTIONS = [
                [0,1],[1,2],[2,3],[3,4],
                [0,5],[5,6],[6,7],[7,8],
                [5,9],[9,10],[10,11],[11,12],
                [9,13],[13,14],[14,15],[15,16],
                [13,17],[17,18],[18,19],[19,20],
                [0,17]
            ];
            
            detectedHands.forEach(landmarks => {
                ctx.beginPath();
                HAND_CONNECTIONS.forEach(([start, end]) => {
                    const pt1 = landmarks[start];
                    const pt2 = landmarks[end];
                    ctx.moveTo(pt1.x * canvas2d.width, pt1.y * canvas2d.height);
                    ctx.lineTo(pt2.x * canvas2d.width, pt2.y * canvas2d.height);
                });
                ctx.stroke();
                
                // Draw fingertips
                ctx.fillStyle = '#ff00ff';
                [4,8,12,16,20].forEach(tipIdx => {
                    const tip = landmarks[tipIdx];
                    ctx.beginPath();
                    ctx.arc(tip.x * canvas2d.width, tip.y * canvas2d.height, 5, 0, 2*Math.PI);
                    ctx.fill();
                });
            });
        }

        let avgTension = 0.0;
        for (let i = 0; i < detectedHands.length; i++) {
            avgTension += calculateHandTension(detectedHands[i]);
        }
        avgTension /= detectedHands.length;

        HAND_STATE.handTension = THREE.MathUtils.lerp(HAND_STATE.handTension, avgTension, 0.2);

        // Snap gesture detection for fireworks
        const tensionDrop = HAND_STATE.lastTension - HAND_STATE.handTension;
        if (tensionDrop > 0.35 && HAND_STATE.handTension < 0.25) {
            triggerFireworks();
        }
        HAND_STATE.lastTension = HAND_STATE.handTension;

        GUI_PARAMS.scale = mapRange(HAND_STATE.handTension, 0.0, 1.0, 0.1, 1.8);

        if (detectedHands.length >= 2) {
            const h1 = detectedHands[0][0];
            const h2 = detectedHands[1][0];
            const distX = Math.abs(h1.x - h2.x);
            GUI_PARAMS.spread = mapRange(distX, 0.1, 0.8, 0.1, 3.0);
        } else {
            const h1 = detectedHands[0][0];
            GUI_PARAMS.spread = mapRange(h1.x, 0.0, 1.0, 0.2, 2.0);
        }

    } else {
        GUI_PARAMS.spread = THREE.MathUtils.lerp(GUI_PARAMS.spread, 0.5, 0.05);
        GUI_PARAMS.scale = THREE.MathUtils.lerp(GUI_PARAMS.scale, 0.5, 0.05);
    }
}

// --- RENDER LOOP & TRANSITIONS ---

let templateMixTarget = 0.0;
let explosionIntensityTarget = 0.0;

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    camera3D.position.x = Math.sin(elapsedTime * 0.05) * 10;
    camera3D.position.y = Math.cos(elapsedTime * 0.05) * 10;
    camera3D.lookAt(scene.position);

    if (particles) {
        const material = particles.material;
        material.uniforms.uTemplateMix.value = THREE.MathUtils.lerp(material.uniforms.uTemplateMix.value, templateMixTarget, 0.08);

        explosionIntensityTarget = THREE.MathUtils.lerp(explosionIntensityTarget, 0.0, 0.1);
        material.uniforms.uExplosionIntensity.value = explosionIntensityTarget;

        material.uniforms.uTime.value = elapsedTime;
        material.uniforms.uSpread.value = THREE.MathUtils.lerp(material.uniforms.uSpread.value, GUI_PARAMS.spread, LERP_SPEED);
        material.uniforms.uScale.value = THREE.MathUtils.lerp(material.uniforms.uScale.value, GUI_PARAMS.scale, LERP_SPEED);
    }

    renderer.render(scene, camera3D);
}

// --- MEDIAPIPE HAND TRACKING ---

const videoElement = document.getElementById('video');
const statusElement = document.getElementById('camera-status');
const canvas2d = document.getElementById('hand-canvas');
const ctx = canvas2d ? canvas2d.getContext('2d') : null;

function setupCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        statusElement.textContent = "❌ Camera API not supported on this browser.";
        GUI_PARAMS.gestureControl = false;
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
        .then(stream => {
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                initHandsTracking();
            };
        })
        .catch(err => {
            console.error(err);
            statusElement.textContent = "❌ Camera access denied. Using manual controls.";
            GUI_PARAMS.gestureControl = false;
        });
}

function initHandsTracking() {
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        statusElement.textContent = "❌ MediaPipe library scripts failed to load.";
        return;
    }

    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(processGestures);

    const cameraPipe = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    cameraPipe.start();
    statusElement.textContent = "✅ Camera connected. Tracking gestures!";
}

// --- UI & INTERACTION HELPERS ---

function initGUI() {
    const gui = new dat.GUI();

    gui.add(GUI_PARAMS, 'template', Object.keys(PARTICLE_TEMPLATES)).name('Shape').onChange(setParticleTemplate);
    gui.addColor(GUI_PARAMS, 'color').name('Color').onChange((val) => { particles.material.uniforms.uColor.value.set(val); });
    gui.add(GUI_PARAMS, 'particleSize', 0.5, 8.0).name('Size');
    gui.add(GUI_PARAMS, 'activeCount', 1000, particleCount).step(1000).name('Particle Count').onChange((val) => {
        particles.geometry.setDrawRange(0, val);
    });

    const gestureFolder = gui.addFolder('Gestures & Controls');
    gestureFolder.add(GUI_PARAMS, 'gestureControl').name('Camera Enabled');
    gestureFolder.add(GUI_PARAMS, 'spread', 0.1, 4.0).step(0.1).name('Spread').listen().onChange(() => { GUI_PARAMS.gestureControl = false; });
    gestureFolder.add(GUI_PARAMS, 'scale', 0.1, 3.0).step(0.1).name('Scale').listen().onChange(() => { GUI_PARAMS.gestureControl = false; });
    gestureFolder.open();
}

function triggerFireworks() {
    if (GUI_PARAMS.template !== 'fireworks') return;
    explosionIntensityTarget = 1.0;
    setParticleTemplate('fireworks');
}

function setParticleTemplate(templateName) {
    if (!particles || !PARTICLE_TEMPLATES[templateName]) return;

    const currentGeometry = particles.geometry;
    const currentTemplateName = GUI_PARAMS.template;

    const currentPositions = PARTICLE_TEMPLATES[currentTemplateName];
    currentGeometry.getAttribute('position').copyArray(currentPositions);
    currentGeometry.getAttribute('position').needsUpdate = true;

    GUI_PARAMS.template = templateName;
    const newPositions = PARTICLE_TEMPLATES[templateName];
    currentGeometry.getAttribute('position2').copyArray(newPositions);
    currentGeometry.getAttribute('position2').needsUpdate = true;

    particles.material.uniforms.uTemplateMix.value = 0.0;
    templateMixTarget = 1.0;
}

// --- BOOTSTRAP APP ---

document.addEventListener('DOMContentLoaded', () => {
    initThree();
    setupCamera();
});

// --- MOUSE FALLBACK CONTROLS ---

let isDragging = false;
let lastX = 0;
let lastY = 0;

document.addEventListener('mousedown', (e) => {
    if (!GUI_PARAMS.gestureControl) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging && !GUI_PARAMS.gestureControl) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;

        GUI_PARAMS.spread = THREE.MathUtils.clamp(GUI_PARAMS.spread + deltaX * 0.005, 0.1, 4.0);
        GUI_PARAMS.scale = THREE.MathUtils.clamp(GUI_PARAMS.scale - deltaY * 0.005, 0.1, 3.0);

        lastX = e.clientX;
        lastY = e.clientY;
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});