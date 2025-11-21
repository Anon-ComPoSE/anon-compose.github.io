import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Global state
let allViewers = [];
let isSyncing = false;
let isRotating = true;
let isPaused = false;

// Scale mapping for each example
const scaleMap = {
  'example_1': 1.2,
  'example_2': 1.0,
  'example_3': 0.8,
};

// Sync camera angles across all viewers
function syncCameras(sourceControls) {
  if (isSyncing) return;
  isSyncing = true;

  const cam = sourceControls.object;
  const target = sourceControls.target.clone();
  const offset = new THREE.Vector3().subVectors(cam.position, target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  allViewers.forEach(viewer => {
    if (viewer.controls === sourceControls) return;
    const newPos = new THREE.Vector3()
      .setFromSphericalCoords(spherical.radius, spherical.phi, spherical.theta)
      .add(viewer.controls.target);
    viewer.camera.position.copy(newPos);
    viewer.camera.lookAt(viewer.controls.target);
    viewer.controls.update();
  });

  isSyncing = false;
}

// Initialize a single viewer
function initViewer(container, glbPath, showGround = false, scale = 1.0) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xFFFFFF);

  // Camera
  const camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 1000);
  camera.position.set(0, 1.5, 3);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Enhanced lighting setup
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(5, 12, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);
  
  // Add fill lights for better detail visibility
  const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight1.position.set(-5, 5, -5);
  scene.add(fillLight1);
  
  const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
  fillLight2.position.set(0, -5, 5);
  scene.add(fillLight2);

  // Ground plane
  if (showGround) {
    const planeGeo = new THREE.PlaneGeometry(20, 20);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.2 });
    const ground = new THREE.Mesh(planeGeo, planeMat);
    ground.rotateX(-Math.PI / 2);
    ground.position.y = -0.8;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2;

  controls.addEventListener('change', () => {
    if (controls.userIsInteracting) syncCameras(controls);
  });
  controls.domElement.addEventListener('mousedown', () => {
    controls.userIsInteracting = true;
  });
  document.addEventListener('mouseup', () => {
    controls.userIsInteracting = false;
  });

  // Loading indicator
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.innerText = 'Loading...';
  container.appendChild(loading);

  // Load GLB
  const loader = new GLTFLoader();
  loader.load(
    glbPath,
    (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(scale);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Apply plastic-like material properties
          if (child.material) {
            child.material.roughness = 0.3;
            child.material.metalness = 0.1;
            child.material.envMapIntensity = 1.5;
            child.material.needsUpdate = true;
          }
        }
      });
      scene.add(model);
      loading.style.display = 'none';
    },
    undefined,
    (err) => {
      console.error('Error loading GLB:', err);
      loading.innerText = 'Error loading model';
    }
  );

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return { scene, camera, renderer, controls, container };
}

function clearViewers() {
  allViewers.forEach(viewer => {
    viewer.renderer.dispose();
    viewer.container.innerHTML = '';
  });
  allViewers = [];
}

function animate() {
  requestAnimationFrame(animate);
  allViewers.forEach(viewer => {
    viewer.controls.update();
    viewer.renderer.render(viewer.scene, viewer.camera);
  });
}

function loadTab(objName) {
  clearViewers();

  const tabButton = document.querySelector(`[data-obj="${objName}"]`);
  const conditionPath = tabButton.dataset.condition;
  const gen1Path = tabButton.dataset.gen1;
  const gen2Path = tabButton.dataset.gen2;

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.obj === objName);
  });

  // Sample labels dictionary
  const sampleLabels = {
    'example_1': ['« Modern chair with slatted back »', '« Baby pacifier with handle »'],
    'example_2': ['« Industrial screwdriver with cylindrical body and tapered tip »', '« Ceremonial candle with pedestal base »'],
    'example_3': ['« Wooden chess pawn, polished »', '« Wooden bar stool with cushioned seat »'],
  };

  const labels = sampleLabels[objName] || ['Sample 1', 'Sample 2'];
  const scale = scaleMap[objName] || 1.0;

  const container = document.querySelector('.viewers-container');
  container.innerHTML = `
    <div style="flex: 1; max-width: 350px;">
      <h4 class="title is-6" style="margin-bottom: 0.5rem;">Condition</h4>
      <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.8rem;">Coarse Bounding Boxes</p>
      <div id="condition-viewer" style="background: #ffffff; width: 100%; aspect-ratio: 1; border-radius: 4px;"></div>
    </div>
    <hr class="flex: 1; is-divider-vertical" style="background: white;height: 100%;">
    <div style="flex: 2; display: flex; flex-direction: column; gap: 0rem;">
      <div style="margin-bottom: 0.8rem;">
        <h4 class="title is-6" style="margin-bottom: 0.5rem;">Generation</h4>
        <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.8rem;">Part-Separated Shape</p>
      </div>
      <div style="display: flex; gap: 1.5rem;">
        <div style="flex: 1;">
          <div id="gen1-viewer" style="background: #ffffff; width: 100%; aspect-ratio: 1; border-radius: 4px;"></div>
          <p style="color: #888; font-size: 0.85rem; margin-top: 1rem; text-align: center;">${labels[0]}</p>
        </div>
        <div style="flex: 1;">
          <div id="gen2-viewer" style="background: #ffffff; width: 100%; aspect-ratio: 1; border-radius: 4px;"></div>
          <p style="color: #888; font-size: 0.85rem; margin-top: 1rem; text-align: center;">${labels[1]}</p>
        </div>
      </div>
    </div>
  `;

  const conditionViewer = initViewer(document.getElementById('condition-viewer'), conditionPath, false, scale);
  const gen1Viewer = initViewer(document.getElementById('gen1-viewer'), gen1Path, true, scale);
  const gen2Viewer = initViewer(document.getElementById('gen2-viewer'), gen2Path, true, scale);

  allViewers = [conditionViewer, gen1Viewer, gen2Viewer];
  allViewers.forEach(v => v.controls.autoRotate = isRotating);
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => loadTab(btn.dataset.obj));
  });

  document.getElementById('btn-rotate').addEventListener('click', () => {
    isRotating = !isRotating;
    allViewers.forEach(v => v.controls.autoRotate = isRotating);
    document.getElementById('btn-rotate').innerText = isRotating ? 'Rotate: On' : 'Rotate: Off';
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      allViewers.forEach(v => v.controls.autoRotate = false);
      document.getElementById('btn-pause').innerText = 'Play';
    } else {
      allViewers.forEach(v => v.controls.autoRotate = isRotating);
      document.getElementById('btn-pause').innerText = 'Pause';
    }
  });

  loadTab('example_1');
  animate();
});