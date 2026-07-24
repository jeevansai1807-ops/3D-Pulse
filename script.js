// --- Helper function for distance calculation ---
function getFingerDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// --- Create a circular texture for smooth particles ---
function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    return new THREE.CanvasTexture(canvas);
}

let camera, scene, renderer;
let saturnGroup;
let targetCameraZ = 300; 
let currentCameraZ = 300;
let targetRotationX = 11;
let targetRotationY = 11;

// GUI Parameters
const GUI_PARAMS = {
    particleSize: 4,
    ringSize: 2.5,
    manualControl: false
};

// Constants 
const PLANET_RADIUS = 60;
const INNER_RING_RADIUS = 80;
const OUTER_RING_RADIUS = 150;
const PARTICLE_COUNT = 300000; 
const MOVEMENT_RANGE_X = 1500;
const MOVEMENT_RANGE_Y = 150;

// State Variables for dragging
let dragStart = {x: 0, y: 0};
let saturnStart = {x: 0, y: 0};
let isDragging = false; 

let sphereParticles, ringParticles;
let pipCanvas, pipCtx, videoElement;

document.addEventListener('DOMContentLoaded', () => {
    pipCanvas = document.getElementById('pip_hand_canvas');
    pipCtx = pipCanvas.getContext('2d');
    videoElement = document.getElementById('input_video');

    initThreeJS();
    initGUI();
    initMediaPipe();
    animate();
});

function createParticleSphere() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const colorPole = new THREE.Color(0xd2b48c);
    const colorEquator = new THREE.Color(0xf4d38c);
    const tempColor = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT * 0.6; i++) {
        const phi = Math.acos(-1 + (2 * i) / (PARTICLE_COUNT * 0.6));
        const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
        const r = PLANET_RADIUS + (Math.random() - 0.5) * 5; 
        const x = r * Math.cos(theta) * Math.sin(phi);
        const y = r * Math.sin(theta) * Math.sin(phi);
        const z = r * Math.cos(phi);
        positions.push(x, y, z);
        const latitude = Math.abs(y / PLANET_RADIUS); 
        tempColor.lerpColors(colorEquator, colorPole, latitude * 0.7); 
        colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ 
        size: GUI_PARAMS.particleSize, 
        vertexColors: true, 
        sizeAttenuation: true, 
        map: createCircleTexture(), 
        transparent: true 
    });

    sphereParticles = new THREE.Points(geometry, material);
    saturnGroup.add(sphereParticles);
}

function createParticleRings() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const ringColor = new THREE.Color(0xcccccc); 

    for (let i = 0; i < PARTICLE_COUNT * 0.4; i++) { 
        const r = THREE.MathUtils.randFloat(INNER_RING_RADIUS, OUTER_RING_RADIUS);
        const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
        const x = r * Math.cos(angle);
        const y = (Math.random() - 0.5) * 2; 
        const z = r * Math.sin(angle);
        positions.push(x, y, z);
        const colorFactor = 1 - ((r - INNER_RING_RADIUS) / (OUTER_RING_RADIUS - INNER_RING_RADIUS)) * 0.3;
        const finalColor = ringColor.clone().multiplyScalar(colorFactor);
        colors.push(finalColor.r, finalColor.r, finalColor.r);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ 
        size: GUI_PARAMS.ringSize, 
        vertexColors: true, 
        sizeAttenuation: true, 
        map: createCircleTexture(), 
        transparent: true 
    });

    ringParticles = new THREE.Points(geometry, material);
    saturnGroup.add(ringParticles);
}

window.setShape = function(shapeName) {
    // Update button states if buttons exist
    const btnSaturn = document.getElementById('btn_saturn');
    if (btnSaturn) {
        btnSaturn.classList.remove('active');
        document.getElementById('btn_heart').classList.remove('active');
        document.getElementById('btn_flower').classList.remove('active');
        document.getElementById('btn_' + shapeName).classList.add('active');
    }

    // Clear existing particles
    while(saturnGroup.children.length > 0){ 
        const child = saturnGroup.children[0];
        saturnGroup.remove(child); 
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    sphereParticles = null;
    ringParticles = null;

    if (shapeName === 'saturn') {
        createParticleSphere();
        createParticleRings();
        saturnGroup.rotation.set(0, 0, THREE.MathUtils.degToRad(26.7));
    } else if (shapeName === 'heart') {
        createHeartShape();
        saturnGroup.rotation.set(0, 0, 0); 
    } else if (shapeName === 'flower') {
        createFlowerShape();
        saturnGroup.rotation.set(0, 0, 0);
    }
    
    // Reset interaction rotations to starting point
    targetRotationX = 0;
    targetRotationY = 0;
    saturnGroup.rotation.x = 0;
    saturnGroup.rotation.y = 0;
}

function createHeartShape() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const colorCenter = new THREE.Color(0xff0055);
    const colorEdge = new THREE.Color(0xffaaaa);
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = Math.PI * 2 * Math.random();
        const u = Math.PI * Math.random() - Math.PI / 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        const z = 10 * Math.sin(u) + (Math.random() - 0.5) * 5; 
        
        const scale = 3 * Math.cbrt(Math.random()); // Reduced scale to fit screen
        
        const finalX = x * scale;
        const finalY = y * scale;
        const finalZ = z * scale;

        positions.push(finalX, finalY, finalZ);
        
        tempColor.lerpColors(colorCenter, colorEdge, Math.random());
        colors.push(tempColor.r, tempColor.g, tempColor.b);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ 
        size: GUI_PARAMS.particleSize, 
        vertexColors: true, 
        sizeAttenuation: true, 
        map: createCircleTexture(), 
        transparent: true 
    });

    sphereParticles = new THREE.Points(geometry, material);
    saturnGroup.add(sphereParticles);
}

function createFlowerShape() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const colorCenter = new THREE.Color(0xffff00);
    const colorPetal = new THREE.Color(0xff00ff);
    const tempColor = new THREE.Color();
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const r_random = Math.random();
        
        const k = 5;
        const radius = Math.cos(k * theta) * 60; 
        
        const r_actual = Math.abs(radius) * Math.sqrt(r_random) * 1.5; // Scale to fill
        
        const x = r_actual * Math.cos(theta);
        const y = r_actual * Math.sin(theta);
        const z = (Math.random() - 0.5) * 10; 
        
        positions.push(x, y, z);
        
        const dist = Math.sqrt(x*x + y*y);
        tempColor.lerpColors(colorCenter, colorPetal, Math.min(1, dist / 60));
        colors.push(tempColor.r, tempColor.g, tempColor.b);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ 
        size: GUI_PARAMS.particleSize, 
        vertexColors: true, 
        sizeAttenuation: true, 
        map: createCircleTexture(), 
        transparent: true 
    });

    sphereParticles = new THREE.Points(geometry, material);
    saturnGroup.add(sphereParticles);
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0015);
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.z = currentCameraZ;
    
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('output_canvas'), antialias: true });
    // IMPORTANT: Keep sizeAttenuation correct by using the pixel ratio
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    saturnGroup = new THREE.Group();
    scene.add(saturnGroup);

    window.setShape('saturn');
    
    window.addEventListener('resize', onWindowResize, false);
}

function initGUI() {
    if (typeof dat !== 'undefined') {
        const gui = new dat.GUI();
        gui.add(GUI_PARAMS, 'particleSize', 1, 10).name('Sphere Size').onChange(val => {
            if(sphereParticles) sphereParticles.material.size = val;
        });
        gui.add(GUI_PARAMS, 'ringSize', 1, 10).name('Ring Size').onChange(val => {
            if(ringParticles) ringParticles.material.size = val;
        });
        gui.add(GUI_PARAMS, 'manualControl').name('Manual Mouse Drag').onChange(val => {
            // Toggle gesture vs manual
        });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- PIP SKELETON DRAWING ---

function drawPIP(results) {
    // Match pip canvas size to actual video source
    if (pipCanvas.width !== videoElement.videoWidth) {
        pipCanvas.width = videoElement.videoWidth;
        pipCanvas.height = videoElement.videoHeight;
    }
    
    pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
    
    // Draw raw video to canvas
    if (results.image) {
        pipCtx.drawImage(results.image, 0, 0, pipCanvas.width, pipCanvas.height);
    }
    
    // Draw skeleton overlay
    if (results.multiHandLandmarks) {
        const HAND_CONNECTIONS = [
            [0,1],[1,2],[2,3],[3,4],
            [0,5],[5,6],[6,7],[7,8],
            [5,9],[9,10],[10,11],[11,12],
            [9,13],[13,14],[14,15],[15,16],
            [13,17],[17,18],[18,19],[19,20],
            [0,17]
        ];

        for (const landmarks of results.multiHandLandmarks) {
            pipCtx.strokeStyle = '#00ffff';
            pipCtx.lineWidth = 4;
            pipCtx.beginPath();
            for (const [start, end] of HAND_CONNECTIONS) {
                const pt1 = landmarks[start];
                const pt2 = landmarks[end];
                pipCtx.moveTo(pt1.x * pipCanvas.width, pt1.y * pipCanvas.height);
                pipCtx.lineTo(pt2.x * pipCanvas.width, pt2.y * pipCanvas.height);
            }
            pipCtx.stroke();
            
            pipCtx.fillStyle = '#ff00ff';
            for (const pt of landmarks) {
                pipCtx.beginPath();
                pipCtx.arc(pt.x * pipCanvas.width, pt.y * pipCanvas.height, 5, 0, 2*Math.PI);
                pipCtx.fill();
            }
        }
    }
}

// --- ROBUST HAND TRACKING LOGIC ---
function onResults(results) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';

    // Draw the PIP overlay first
    drawPIP(results);

    if (GUI_PARAMS.manualControl) return;

    const hands = results.multiHandLandmarks;

    if (!hands || hands.length === 0) {
        isDragging = false;
        return;
    }

    const hand1 = hands[0]; 

    // 1. ZOOM (Z) CONTROL - Uses Hand 1 Pinch
    const indexTip = hand1[8];
    const thumbTip = hand1[4];
    const pinchDistance = getFingerDistance(indexTip, thumbTip);

    targetCameraZ = THREE.MathUtils.mapLinear(pinchDistance, 0.02, 0.2, 80, 500); 
    targetCameraZ = THREE.MathUtils.clamp(targetCameraZ, 80, 700);
    
    if (hands.length === 2) {
        // --- 2. TWO-HAND ROTATION CONTROL ---
        const hand2 = hands[1];
        
        const centerWristX = (hand1[0].x + hand2[0].x) / 2;
        const centerWristY = (hand1[0].y + hand2[0].y) / 2;
        const separationDistance = getFingerDistance(hand1[0], hand2[0]); 
        
        targetRotationY = THREE.MathUtils.mapLinear(centerWristX, 0.2, 0.8, -Math.PI / 4, Math.PI / 4); 
        targetRotationX = THREE.MathUtils.mapLinear(centerWristY, 0.2, 0.8, Math.PI / 4, -Math.PI / 4); 
        
        saturnGroup.rotation.y += separationDistance * 0.01;
        
        isDragging = false; 

    } else if (hands.length === 1) {
        // --- 3. SINGLE-HAND DRAG/TRANSLATION CONTROL (Open Hand) ---
        const PINCH_THRESHOLD = 0.08;
        
        if (pinchDistance > PINCH_THRESHOLD) { 
            if (!isDragging) {
                isDragging = true;
                dragStart.x = hand1[0].x; 
                dragStart.y = hand1[0].y; 
                saturnStart.x = saturnGroup.position.x;
                saturnStart.y = saturnGroup.position.y;
            }

            const deltaX = hand1[0].x - dragStart.x;
            const deltaY = hand1[0].y - dragStart.y;
            
            const newX = saturnStart.x - deltaX * MOVEMENT_RANGE_X * 2;
            const newY = saturnStart.y + deltaY * MOVEMENT_RANGE_Y * 2;
            
            saturnGroup.position.x += (newX - saturnGroup.position.x) * 0.1;
            saturnGroup.position.y += (newY - saturnGroup.position.y) * 0.1;
            
        } else {
            isDragging = false; 
        }
    }
}


function animate() {
    requestAnimationFrame(animate);

    currentCameraZ += (targetCameraZ - currentCameraZ) * 0.1; 
    camera.position.z = currentCameraZ;
    
    saturnGroup.rotation.y += (targetRotationY - saturnGroup.rotation.y) * 0.1; 
    saturnGroup.rotation.x += (targetRotationX - saturnGroup.rotation.x) * 0.1; 

    if (!isDragging && saturnGroup.rotation.y === 0) {
         saturnGroup.rotation.y += 0.003; 
    }

    renderer.render(scene, camera);
}


function initMediaPipe() {
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`});
    hands.setOptions({
        maxNumHands: 2, 
        modelComplexity: 1, 
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480 
    });
    cameraUtils.start().catch(err => {
        console.error(err);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.textContent = "Camera access denied. Use mouse controls.";
            setTimeout(() => { loadingEl.style.display = 'none'; }, 3000);
        }
        GUI_PARAMS.manualControl = true;
    });
}

// Mouse Drag Fallback
let isMouseDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener('mousedown', (e) => {
    if (GUI_PARAMS.manualControl) {
        isMouseDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isMouseDragging && GUI_PARAMS.manualControl) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        targetRotationY += deltaX * 0.01;
        targetRotationX += deltaY * 0.01;
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

document.addEventListener('mouseup', () => {
    isMouseDragging = false;
});