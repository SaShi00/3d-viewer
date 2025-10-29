/**
 * src/main.ts
 * Main client script for the 3D Viewer application.
 *
 * Responsibilities:
 * - Build the minimal UI for Admin / Guest flows
 * - Upload and fetch a single `latest.glb` model from the backend
 * - Provide live scale sync (admin -> guests) via socket.io
 * - Provide pointer and camera movement with bounds derived from the model
 *
 * Notes:
 * - This file is intentionally written in a single module for simplicity.
 * - Keep network endpoints (http://localhost:3001) in sync with backend if changed.
 */

// --- Global type augmentation ---
// The backend/admin will provide a scale value for guests before they load the model.


// Use current browser location for API base (adapts to localhost, LAN, etc.)
const apiBase = `${window.location.protocol}//${window.location.hostname}:3001`;


declare global {
  interface Window {
    __guestScale?: number;
  }
}
let userRole: 'admin' | 'guest' | null = null;

// Track if a GLB file exists on the server
let hasGlbOnServer = false;

const loginPanel = document.createElement('div');
loginPanel.id = 'login-panel';
loginPanel.style.position = 'absolute';
loginPanel.style.top = '50%';
loginPanel.style.left = '50%';
loginPanel.style.transform = 'translate(-50%,-50%)';
loginPanel.style.zIndex = '100';
loginPanel.style.background = 'rgba(0,0,0,0.92)';
loginPanel.style.padding = '24px 32px';
loginPanel.style.borderRadius = '10px';
loginPanel.style.boxShadow = '0 2px 12px rgba(0,0,0,0.22)';
loginPanel.style.display = 'flex';
loginPanel.style.flexDirection = 'column';
loginPanel.style.alignItems = 'center';
loginPanel.style.gap = '16px';

const loginTitle = document.createElement('h2');
loginTitle.textContent = '3D Viewer';
loginTitle.style.color = '#fff';
loginTitle.style.margin = '0 0 8px 0';
loginPanel.appendChild(loginTitle);

const adminBtn = document.createElement('button');
adminBtn.textContent = 'Admin';
adminBtn.style.width = '180px';
adminBtn.style.marginBottom = '8px';

const guestBtn = document.createElement('button');
guestBtn.textContent = 'Guest';
guestBtn.style.width = '180px';

adminBtn.onclick = () => {
  userRole = 'admin';
  loginPanel.style.display = 'none';
  showMainUI();
};
guestBtn.onclick = () => {
  userRole = 'guest';
  loginPanel.style.display = 'none';
  // Wait for scale from admin before showing UI and loading model
  socket.once('model-scale', (scale) => {
    window.__guestScale = scale;
    showMainUI(); // This will call loadLatestModelFromBackend()
  });
  socket.emit('request-scale');
};

loginPanel.appendChild(adminBtn);
loginPanel.appendChild(guestBtn);
document.body.appendChild(loginPanel);

// --- GLB Upload Panel (hidden until admin login) ---
const uploadPanel = document.createElement('div');
uploadPanel.id = 'glb-upload-panel';
uploadPanel.style.position = 'absolute';
uploadPanel.style.top = '50%';
uploadPanel.style.left = '50%';
uploadPanel.style.transform = 'translate(-50%,-50%)';
uploadPanel.style.zIndex = '50';
uploadPanel.style.background = 'rgba(0,0,0,0.85)';
uploadPanel.style.padding = '12px 18px';
uploadPanel.style.borderRadius = '8px';
uploadPanel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
uploadPanel.style.display = 'none';
uploadPanel.style.flexDirection = 'column';
uploadPanel.style.alignItems = 'flex-start';
uploadPanel.style.gap = '6px';

const uploadLabel = document.createElement('label');
uploadLabel.htmlFor = 'glb-upload';
uploadLabel.textContent = 'Upload GLB file:';
uploadLabel.style.color = '#fff';
uploadLabel.style.fontWeight = 'bold';
uploadLabel.style.cursor = 'pointer';

const uploadNote = document.createElement('div');
// uploadNote.textContent = 'Your file is not saved. Only use in your browser.';
uploadNote.style.color = '#ffffffff';
uploadNote.style.fontSize = '15px';
uploadNote.style.marginTop = '4px';
uploadNote.style.marginLeft = '2px';

const uploadInput = document.createElement('input');
uploadInput.type = 'file';
uploadInput.id = 'glb-upload';
uploadInput.accept = '.glb,model/gltf-binary';
uploadInput.style.color = '#fff';
uploadInput.style.background = 'transparent';
uploadInput.style.border = 'none';

// --- Delete GLB button (admin only, left side) ---
const deleteBtn = document.createElement('button');
deleteBtn.textContent = 'Delete GLB file';
deleteBtn.style.position = 'absolute';
deleteBtn.style.top = '3%';
deleteBtn.style.left = '50%';
deleteBtn.style.transform = 'translate(-50%,-50%)';
deleteBtn.style.background = '#c00';
deleteBtn.style.color = '#fff';
deleteBtn.style.fontWeight = 'bold';
deleteBtn.style.border = 'none';
deleteBtn.style.borderRadius = '6px';
deleteBtn.style.padding = '12px 24px';
deleteBtn.style.zIndex = '60';
deleteBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
deleteBtn.style.display = 'none';
deleteBtn.onclick = () => {
  if (confirm('Delete the GLB file from backend?')) {
    fetch(`${apiBase}/latest.glb`, { method: 'DELETE' })
      .then(async res => {
        if (res.ok) {
          alert('GLB file deleted.');
          if (loadedModel) {
            scene.remove(loadedModel);
            loadedModel = null;
          }
        } else if (res.status === 404) {
          const data = await res.json().catch(() => null);
          alert('No GLB file to delete. ' + (data && data.error ? data.error : ''));
        } else {
          const text = await res.text();
          alert('Delete failed: ' + res.status + ' ' + text);
        }
      })
      .catch(err => {
        alert('Network or CORS error: ' + err.message + '\nCheck if backend is running and accessible.');
      });
  }
};

document.body.appendChild(deleteBtn);

// --- Load Existing Model Button (admin only, if .glb exists) ---
const loadModelBtn = document.createElement('button');
loadModelBtn.textContent = 'Load Existing Model';
loadModelBtn.style.position = 'absolute';
loadModelBtn.style.top = '10%';
loadModelBtn.style.left = '50%';
loadModelBtn.style.transform = 'translate(-50%,-50%)';
loadModelBtn.style.background = '#007bff';
loadModelBtn.style.color = '#fff';
loadModelBtn.style.fontWeight = 'bold';
loadModelBtn.style.border = 'none';
loadModelBtn.style.borderRadius = '6px';
loadModelBtn.style.padding = '12px 24px';
loadModelBtn.style.zIndex = '60';
loadModelBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
loadModelBtn.style.display = 'none';
loadModelBtn.onclick = () => {
  loadLatestModelFromBackend();
  uploadPanel.style.display = 'none';
};
document.body.appendChild(loadModelBtn);

uploadPanel.appendChild(uploadLabel);
uploadPanel.appendChild(uploadInput);
uploadPanel.appendChild(uploadNote);
document.body.appendChild(uploadPanel);

// Show/hide main UI panels based on login
function showMainUI() {
  if (userRole === 'admin') {
    uploadPanel.style.display = 'flex';
    scalePanel.style.display = 'flex';
    deleteBtn.style.display = 'block';
    // Check for GLB existence every time admin logs in
  fetch(`${apiBase}/has-glb`)
      .then(res => res.json())
      .then(data => {
        hasGlbOnServer = !!data.exists;
        if (hasGlbOnServer) {
          loadModelBtn.style.display = 'block';
        } else {
          loadModelBtn.style.display = 'none';
        }
      })
      .catch(() => {
        hasGlbOnServer = false;
        loadModelBtn.style.display = 'none';
      });
    infoPanel.innerHTML = `
      <b>Admin Controls</b><br>
      <ol style="margin:8px 0 0 10px;padding:0;">
        <li>Upload a GLB file</li>
        <li>Scale model if you need</li>
        <li>Enter VR or AR</li>
        <li>Move camera: <b> right joysticks</b></li>
        <li>Move camera up/down: <b>hold trigger + joystick</b></li>
        <li>Move pointer: <b> left joysticks</b></li>
        <li>Move pointer up/down: <b>hold trigger + joystick</b></li>
        <li>Escape from VR/AR: <b>press meta mark button</b></li>
        <li>Delete the GLB file</li>
      </ol>
    `;
  } else {
    uploadPanel.style.display = 'none';
    scalePanel.style.display = 'none';
    deleteBtn.style.display = 'none';
    loadModelBtn.style.display = 'none';
    infoPanel.innerHTML = `
      <b>Guest Controls</b><br>
      <ul style="margin:8px 0 0 10px;padding:0;">
        <li>Move camera: <b>joysticks</b></li>
        <li>Move camera up/down: <b>hold trigger + joystick</b></li>
      </ul>
    `;
    // For guest: try to load the latest model from backend
    loadLatestModelFromBackend();
  }
  infoPanel.style.display = 'block';
}

// Load latest GLB from backend for guests
function loadLatestModelFromBackend() {
  fetch(`${apiBase}/latest.glb`)
    .then(response => {
      if (!response.ok) throw new Error('No model uploaded yet.');
      return response.arrayBuffer();
    })
    .then(arrayBuffer => {
      const loader = new GLTFLoader();
      loader.parse(arrayBuffer, '', (gltf) => {
        // Remove previous model if any
        if (loadedModel) {
          scene.remove(loadedModel);
        }
        scene.add(gltf.scene);
        loadedModel = gltf.scene;
        let initialScale = 1;
        if (userRole === 'guest' && typeof (window as any).__guestScale === 'number') {
          initialScale = (window as any).__guestScale;
        }
        if (scaleBar) scaleBar.value = initialScale.toString();
        loadedModel.scale.set(initialScale, initialScale, initialScale);
        // Compute movement bounds based on scaled model size
        updateMovementBoundsFromModel();
        // Listen for scale updates from admin
        socket.on('model-scale', (scale) => {
          if (loadedModel) {
            loadedModel.scale.set(scale, scale, scale);
            if (scaleBar) scaleBar.value = scale.toString();
            updateMovementBoundsFromModel();
          }
        });
        // Hide upload panel if admin loaded existing model
        if (userRole === 'admin') {
          uploadPanel.style.display = 'none';
        }
      }, (error) => {
        alert('Failed to load GLB: ' + error.message);
      });
    })
    // We intentionally ignore the error here for guests (no model available yet).
    .catch(() => {
      // Optionally show a message to guest if no model is available
      // alert(err.message);
    });
}
const infoPanel = document.createElement('div');
infoPanel.style.position = 'absolute';
infoPanel.style.top = '20px';
infoPanel.style.left = '20px';
infoPanel.style.width = '330px';
infoPanel.style.background = 'rgba(0, 0, 0, 0.95)';
infoPanel.style.color = '#f1f1f1ff';
infoPanel.style.borderRadius = '8px';
infoPanel.style.fontSize = '15px';
infoPanel.style.fontWeight = 'normal';
infoPanel.style.padding = '20px';
infoPanel.style.zIndex = '40';
infoPanel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
infoPanel.innerHTML = `
  <b>How to move camera position in VR/AR</b><br>
  <ul style="margin:8px 0 0 10px;padding:0;">
    <li>left/right/forward/backward: <b>joysticks</b></li>
    <li>up/down: <b>hold trigger button + joysticks</b></li>
  </ul>
`;
infoPanel.style.display = 'none';
document.body.appendChild(infoPanel);
// --- Scale Panel UI ---
const scalePanel = document.createElement('div');
scalePanel.style.position = 'absolute';
scalePanel.style.top = '20px';
scalePanel.style.right = '20px';
scalePanel.style.left = '';
scalePanel.style.transform = '';
scalePanel.style.width = '200px';
scalePanel.style.height = '40px';
scalePanel.style.background = '#000000ff';
scalePanel.style.color = '#fff';
scalePanel.style.borderRadius = '8px';
scalePanel.style.fontWeight = 'bold';
scalePanel.style.fontSize = '16px';
scalePanel.style.display = 'none'; // Only show for admin
scalePanel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
scalePanel.style.zIndex = '20';
scalePanel.style.padding = '0 10px';
scalePanel.style.margin = '0';
scalePanel.style.textAlign = 'center';
// scalePanel.style.display = 'flex';
scalePanel.style.flexDirection = 'row';
scalePanel.style.alignItems = 'center';
scalePanel.style.justifyContent = 'center';
scalePanel.innerHTML = `<label for="scale-bar" style="margin-right:8px;">Scale:</label><input id="scale-bar" type="range" min="0.1" max="5" step="0.01" value="1" style="width:120px;">`;
document.body.appendChild(scalePanel);
let loadedModel: THREE.Object3D | null = null;

const scaleBar = document.getElementById('scale-bar') as HTMLInputElement;
if (scaleBar) {
  // Throttle sending updates so we don't flood socket.io while dragging
  let lastEmit = 0;
  const EMIT_INTERVAL = 100; // ms
  let pendingTimer: number | null = null;

  function scheduleEmit(scale: number) {
    const now = Date.now();
    if (now - lastEmit >= EMIT_INTERVAL) {
      lastEmit = now;
      if (userRole === 'admin') socket.emit('model-scale', scale);
    } else {
      if (pendingTimer !== null) clearTimeout(pendingTimer);
      pendingTimer = window.setTimeout(() => {
        lastEmit = Date.now();
        if (userRole === 'admin') socket.emit('model-scale', scale);
        pendingTimer = null;
      }, EMIT_INTERVAL - (now - lastEmit));
    }
  }

  // While dragging: update local model preview and notify guests (if admin)
  scaleBar.addEventListener('input', () => {
    const scale = parseFloat(scaleBar.value);
    if (loadedModel) loadedModel.scale.set(scale, scale, scale);
    // If admin, notify guests about the changing scale
    scheduleEmit(scale);
    // Recompute movement bounds when admin changes scale locally
    updateMovementBoundsFromModel();
  });

  // Final value when user releases the slider (guarantee an emit)
  scaleBar.addEventListener('change', () => {
    const scale = parseFloat(scaleBar.value);
    if (loadedModel) loadedModel.scale.set(scale, scale, scale);
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    if (userRole === 'admin') socket.emit('model-scale', scale);
    updateMovementBoundsFromModel();
  });
}

import './style.css'
import * as THREE from 'three';
import { GLTFLoader, VRButton, XRControllerModelFactory, OrbitControls, ARButton } from 'three-stdlib';
import io from 'socket.io-client';

// --- SOCKET.IO SETUP ---
const socket = io(`${window.location.protocol}//${window.location.hostname}:3001`);

// --- POINTER (RED BALL) ---
const pointerGeometry = new THREE.SphereGeometry(0.15, 32, 32);
const pointerMaterial = new THREE.MeshStandardMaterial({ color: 0xff2222 });
const pointerMesh = new THREE.Mesh(pointerGeometry, pointerMaterial);
pointerMesh.position.set(0, 1.5, 0);
pointerMesh.visible = true;

// Movement bounds will be computed dynamically from the loaded model.
const pointerBounds = {
  minX: -10, maxX: 10,
  minZ: -10, maxZ: 10,
  minY: 0.05, maxY: 5
};

const userBounds = {
  minX: -50, maxX: 50,
  minZ: -50, maxZ: 50,
  minY: 0, maxY: 10
};

// pointerBounds: where the red pointer ball can move. These values are
// replaced by `updateMovementBoundsFromModel()` when a model is loaded or
// when the model's scale changes. Defaults are generous to allow testing
// without a model present.

// userBounds: limits for the user (camera root). These are intentionally
// larger than pointerBounds so users can step back to view the whole model.

function clampPointerPosition() {
  pointerMesh.position.x = Math.max(pointerBounds.minX, Math.min(pointerBounds.maxX, pointerMesh.position.x));
  pointerMesh.position.y = Math.max(pointerBounds.minY, Math.min(pointerBounds.maxY, pointerMesh.position.y));
  pointerMesh.position.z = Math.max(pointerBounds.minZ, Math.min(pointerBounds.maxZ, pointerMesh.position.z));
}

function clampUserPosition() {
  user.position.x = Math.max(userBounds.minX, Math.min(userBounds.maxX, user.position.x));
  user.position.y = Math.max(userBounds.minY, Math.min(userBounds.maxY, user.position.y));
  user.position.z = Math.max(userBounds.minZ, Math.min(userBounds.maxZ, user.position.z));
}

function updateMovementBoundsFromModel() {
  if (!loadedModel) return;
  // Make sure world matrices reflect the current scale/position/rotation
  loadedModel.updateMatrixWorld(true);
  // Compute model bounding box in world space (this includes applied scale)
  const box = new THREE.Box3().setFromObject(loadedModel);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  const max = box.max.clone();

  // Padding as a fraction of model size (safer than centering-based math)
  const horizontalPadFactor = 0.2; // 20% padding left/right/front/back
  const verticalPadFactor = 0.1;   // 10% padding top/bottom

  const padX = Math.max(0.1, size.x * horizontalPadFactor);
  const padZ = Math.max(0.1, size.z * horizontalPadFactor);
  const padY = Math.max(0.05, size.y * verticalPadFactor);

  // Pointer bounds: tight to the model extents + small padding
  pointerBounds.minX = min.x - padX;
  pointerBounds.maxX = max.x + padX;
  pointerBounds.minZ = min.z - padZ;
  pointerBounds.maxZ = max.z + padZ;
  // Never let pointer drop below a small floor value
  pointerBounds.minY = Math.max(0.05, min.y - padY);
  pointerBounds.maxY = max.y + padY;

  // User (camera) bounds: looser so user can step back further
  const userPadMultiplier = 2.5;
  userBounds.minX = min.x - padX * userPadMultiplier;
  userBounds.maxX = max.x + padX * userPadMultiplier;
  userBounds.minZ = min.z - padZ * userPadMultiplier;
  userBounds.maxZ = max.z + padZ * userPadMultiplier;
  userBounds.minY = Math.max(0, min.y - padY * userPadMultiplier);
  userBounds.maxY = max.y + padY * userPadMultiplier;

  // Ensure existing positions respect new bounds
  clampPointerPosition();
  clampUserPosition();

  // Optional debug logging to help diagnose Y/bounds issues
  const ENABLE_BOUNDS_DEBUG = false;
  if (ENABLE_BOUNDS_DEBUG) {
    console.log('[BOUNDS] box.min', min, 'box.max', max, 'size', size);
    console.log('[BOUNDS] pointerBounds', JSON.parse(JSON.stringify(pointerBounds)));
    console.log('[BOUNDS] userBounds', JSON.parse(JSON.stringify(userBounds)));
  }
}

// Add pointer to scene after scene is created (see below)

// --- GLB Uploader (admin only) ---
uploadInput.addEventListener('change', () => {
  if (userRole !== 'admin') {
    alert('Only admin can upload GLB files.');
    uploadInput.value = '';
    return;
  }
  const file = uploadInput.files && uploadInput.files[0];
  if (!file) return;
  // Upload to backend
  const formData = new FormData();
  formData.append('file', file);
  fetch(`${apiBase}/upload`, {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Upload failed');
      // After upload, load the model from backend (same as guest)
      loadLatestModelFromBackend();
      // Hide upload panel after successful load
      uploadPanel.style.display = 'none';
    })
    .catch(err => {
      alert('Failed to upload GLB: ' + err.message);
    });
});


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue
scene.add(pointerMesh);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.left = '0';
renderer.domElement.style.top = '0';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.domElement.style.zIndex = '0';
const vrButton = VRButton.createButton(renderer);
document.body.appendChild(vrButton);
// Emit scale only when admin enters VR mode
vrButton.addEventListener('click', () => {
  if (userRole === 'admin' && scaleBar) {
    const scale = parseFloat(scaleBar.value);
    console.log('[VRButton] Submitting scale:', scale);
    socket.emit('model-scale', scale);
  } else {
    console.log('[VRButton] Not admin or scaleBar missing');
  }
});
const arButton = ARButton.createButton(renderer, { requiredFeatures: [ 'hit-test' ] });
document.body.appendChild(arButton);
// Emit scale only when admin enters AR mode
arButton.addEventListener('click', () => {
  if (userRole === 'admin' && scaleBar) {
    const scale = parseFloat(scaleBar.value);
    console.log('[ARButton] Submitting scale:', scale);
    socket.emit('model-scale', scale);
  } else {
    console.log('[ARButton] Not admin or scaleBar missing');
  }
});

// --- Set custom text for VR and AR buttons, even if changed by WebXR polyfill ---
function setButtonText(btn: HTMLElement, text: string, notSupported = false) {
  // Always show the mode text
  btn.textContent = text;
  btn.style.textDecoration = notSupported ? 'line-through' : 'none';
  // Observe for future changes (WebXR polyfill may change it)
  const observer = new MutationObserver(() => {
    if (btn.textContent !== text) btn.textContent = text;
    btn.style.textDecoration = notSupported ? 'line-through' : 'none';
  });
  observer.observe(btn, { childList: true, subtree: true, characterData: true });
}

// Detect WebXR support for VR and AR
const isVRSupported = navigator.xr && navigator.xr.isSessionSupported ? navigator.xr.isSessionSupported('immersive-vr') : Promise.resolve(false);
const isARSupported = navigator.xr && navigator.xr.isSessionSupported ? navigator.xr.isSessionSupported('immersive-ar') : Promise.resolve(false);

isVRSupported.then((supported) => {
  setButtonText(vrButton as HTMLElement, 'VR MODE', !supported);
});
isARSupported.then((supported) => {
  setButtonText(arButton as HTMLElement, 'AR MODE', !supported);
});
// Style VR and AR buttons side by side in the top right
setTimeout(() => {
  const vrBtn = vrButton;
  const arBtn = arButton;
  if (vrBtn) {
    (vrBtn as HTMLElement).style.background = '#000000ff';
    (vrBtn as HTMLElement).style.color = '#fff';
    (vrBtn as HTMLElement).style.borderRadius = '8px';
    (vrBtn as HTMLElement).style.fontWeight = 'bold';
    (vrBtn as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    (vrBtn as HTMLElement).style.position = 'absolute';
    (vrBtn as HTMLElement).style.top = '70px';
    (vrBtn as HTMLElement).style.right = '20px';
    (vrBtn as HTMLElement).style.left = '';
    (vrBtn as HTMLElement).style.zIndex = '30';
    (vrBtn as HTMLElement).style.width = '160px';
    (vrBtn as HTMLElement).style.height = '40px';
    (vrBtn as HTMLElement).style.fontSize = '16px';
    (vrBtn as HTMLElement).style.padding = '0 10px';
    (vrBtn as HTMLElement).style.margin = '0';
    (vrBtn as HTMLElement).style.display = 'flex';
    (vrBtn as HTMLElement).style.alignItems = 'center';
    (vrBtn as HTMLElement).style.justifyContent = 'center';
  }
  if (arBtn) {
    (arBtn as HTMLElement).style.background = '#000000ff';
    (arBtn as HTMLElement).style.color = '#fff';
    (arBtn as HTMLElement).style.borderRadius = '8px';
    (arBtn as HTMLElement).style.fontWeight = 'bold';
    (arBtn as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    (arBtn as HTMLElement).style.position = 'absolute';
    (arBtn as HTMLElement).style.top = '120px';
    (arBtn as HTMLElement).style.right = '20px';
    (arBtn as HTMLElement).style.left = '';
    (arBtn as HTMLElement).style.zIndex = '30';
    (arBtn as HTMLElement).style.width = '160px';
    (arBtn as HTMLElement).style.height = '40px';
    (arBtn as HTMLElement).style.fontSize = '16px';
    (arBtn as HTMLElement).style.padding = '0 10px';
    (arBtn as HTMLElement).style.margin = '0';
    (arBtn as HTMLElement).style.display = 'flex';
    (arBtn as HTMLElement).style.alignItems = 'center';
    (arBtn as HTMLElement).style.justifyContent = 'center';
  }
  // Scale panel is already styled above
}, 100);

// --- OrbitControls for mouse/touchscreen navigation ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 1000;
controls.target.set(0, 1.6, 0);
controls.update();

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
light.position.set(0, 20, 0);
light.intensity = 2.0;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// No default GLB loaded. Only user-uploaded GLB files will be shown.


// VR controller movement and pointer control
const user = new THREE.Group();
scene.add(user);
user.add(camera);

// Track trigger state for each controller
const triggerHeld = [false, false];

// We don't keep a persistent reference to the raw controller groups here because
// they are added into the `user` group and handled via events. Keeping local
// variables produced lint warnings; the controllers are still created/registered
// in setupControllers().

function handleController(controller: THREE.Group, index: number) {
  (controller as any).addEventListener('selectstart', () => {
    triggerHeld[index] = true;
  });
  (controller as any).addEventListener('selectend', () => {
    triggerHeld[index] = false;
  });
}

function setupControllers() {
  const controllerModelFactory = new XRControllerModelFactory();

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    handleController(controller, i);
    user.add(controller);

    const controllerGrip = renderer.xr.getControllerGrip(i);
    controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
    user.add(controllerGrip);

  // controller references are intentionally not stored in module globals.
  }
}

setupControllers();


function animate() {
  renderer.setAnimationLoop(() => {
    // Animation / render loop.
    // Note: when in an XR session we disable OrbitControls to avoid input
    // conflicts with VR/AR controllers. Camera/user movement is handled by
    // controller axes below. We clamp the `user` group to `userBounds` to
    // prevent the camera from leaving the allowed area or getting stuck.
    const session = renderer.xr.getSession();
    controls.enabled = !session;
    controls.update();
    // VR movement logic for admin: right controller moves camera, left controller moves pointer
    if (session && session.inputSources.length >= 2) {
      // --- Right controller (index 1): camera movement (same as before) ---
      const i = 1;
      const source = session.inputSources[i];
      if (source && source.gamepad && source.gamepad.axes.length >= 2) {
        const x = source.gamepad.axes[2];
        const y = source.gamepad.axes[3];
        const threshold = 0.1;
        if (Math.abs(x) > threshold || Math.abs(y) > threshold) {
          const speed = 0.05;
          if (triggerHeld[i]) {
            // Move along z axis when trigger is held
            user.position.y += -y * speed;
          } else {
            // Move in camera direction (x/y)
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            dir.y = 0; // keep movement horizontal
            dir.normalize();
            // Forward/backward
            user.position.addScaledVector(dir, -y * speed);
            // Left/right (strafe)
            const strafe = new THREE.Vector3();
            strafe.crossVectors(camera.up, dir).normalize();
            user.position.addScaledVector(strafe, -x * speed);
          }
        }
      }

      // --- Left controller (index 0): pointer movement (admin only) ---
      if (userRole === 'admin') {
        const leftSource = session.inputSources[0];
        if (leftSource && leftSource.gamepad && leftSource.gamepad.axes.length >= 2) {
          const lx = leftSource.gamepad.axes[2];
          const ly = leftSource.gamepad.axes[3];
          const threshold = 0.1;
          if (Math.abs(lx) > threshold || Math.abs(ly) > threshold) {
            const pointerSpeed = 0.05;
            if (triggerHeld[0]) {
              // If trigger held, move pointer up/down with joystick Y
              pointerMesh.position.y += -ly * pointerSpeed;
              // Clamp pointer to respect model-derived bounds
              clampPointerPosition();
            } else {
              // Move pointer in XZ plane (relative to camera), keep Y unchanged
              const pointerDir = new THREE.Vector3();
              camera.getWorldDirection(pointerDir);
              pointerDir.y = 0;
              pointerDir.normalize();
              // Forward/backward
              pointerMesh.position.addScaledVector(pointerDir, -ly * pointerSpeed);
              // Left/right
              const pointerStrafe = new THREE.Vector3();
              pointerStrafe.crossVectors(camera.up, pointerDir).normalize();
              pointerMesh.position.addScaledVector(pointerStrafe, -lx * pointerSpeed);
              // Clamp pointer to respect model-derived bounds
              clampPointerPosition();
            }
            // Emit pointer position to backend
            socket.emit('pointer-move', {
              x: pointerMesh.position.x,
              y: pointerMesh.position.y,
              z: pointerMesh.position.z
            });
          }
        }
      }
    }
  // Clamp user position using model-derived bounds
  clampUserPosition();

    renderer.render(scene, camera);
  });
}

animate();

// --- SOCKET.IO: Listen for pointer updates ---
socket.on('pointer-update', (pos) => {
  pointerMesh.position.set(pos.x, pos.y, pos.z);
  // Ensure incoming positions respect model-based bounds
  clampPointerPosition();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});