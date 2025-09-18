// Removed unused glbInput variable
// Removed unused loader variable
// Removed unused glbInput variable
// Removed unused loader variable
// --- Info Panel UI ---
// --- GLB Upload Panel (centered) ---
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
uploadPanel.style.display = 'flex';
uploadPanel.style.flexDirection = 'column';
uploadPanel.style.alignItems = 'flex-start';
uploadPanel.style.gap = '6px';

const uploadLabel = document.createElement('label');
uploadLabel.htmlFor = 'glb-upload';
uploadLabel.textContent = 'Upload GLB file:';
uploadLabel.style.color = '#fff';
uploadLabel.style.fontWeight = 'bold';
uploadLabel.style.cursor = 'pointer';

// Add text below the upload label
const uploadNote = document.createElement('div');
uploadNote.textContent = 'Your file is not saved. Only use in your browser.';
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

uploadPanel.appendChild(uploadLabel);
uploadPanel.appendChild(uploadInput);
uploadPanel.appendChild(uploadNote);
document.body.appendChild(uploadPanel);
const infoPanel = document.createElement('div');
infoPanel.style.position = 'absolute';
infoPanel.style.top = '10px';
infoPanel.style.left = '5px';
infoPanel.style.width = '300px';
infoPanel.style.background = 'rgba(0, 0, 0, 0.95)';
infoPanel.style.color = '#f1f1f1ff';
infoPanel.style.borderRadius = '8px';
infoPanel.style.fontSize = '15px';
infoPanel.style.fontWeight = 'normal';
infoPanel.style.padding = '32px';
infoPanel.style.zIndex = '40';
infoPanel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
infoPanel.innerHTML = `
  <b>How to move camera position</b><br>
  <ul style="margin:8px 0 0 10px;padding:0;">
    <li>left/right/forward/backward: joysticks</li>
    <li>up/down: hold trigger button + joysticks</li>
  </ul>
`;
document.body.appendChild(infoPanel);
// --- Scale Panel UI ---
const scalePanel = document.createElement('div');
scalePanel.style.position = 'absolute';
scalePanel.style.top = '70px';
scalePanel.style.right = '20px';
scalePanel.style.left = '';
scalePanel.style.width = '140px';
scalePanel.style.height = '40px';
scalePanel.style.background = '#000000ff';
scalePanel.style.color = '#fff';
scalePanel.style.borderRadius = '8px';
scalePanel.style.fontWeight = 'bold';
scalePanel.style.fontSize = '16px';
scalePanel.style.display = 'flex';
scalePanel.style.alignItems = 'center';
scalePanel.style.justifyContent = 'center';
scalePanel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
scalePanel.style.zIndex = '20';
scalePanel.style.padding = '0 10px';
scalePanel.style.margin = '0';
scalePanel.innerHTML = `<label for="scale-bar" style="margin-right:8px;">Scale:</label><input id="scale-bar" type="range" min="0.1" max="5" step="0.01" value="1" style="width:80px;">`;
document.body.appendChild(scalePanel);

let loadedModel: THREE.Object3D | null = null;

const scaleBar = document.getElementById('scale-bar') as HTMLInputElement;
if (scaleBar) {
  scaleBar.addEventListener('input', () => {
    const scale = parseFloat(scaleBar.value);
    if (loadedModel) {
      loadedModel.scale.set(scale, scale, scale);
    }
  });
}
import './style.css'
import * as THREE from 'three';
import { GLTFLoader, VRButton, XRControllerModelFactory } from 'three-stdlib';

// --- GLB Uploader ---
uploadInput.addEventListener('change', () => {
  const file = uploadInput.files && uploadInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target?.result;
    if (!arrayBuffer) return;
    const loader = new GLTFLoader();
    loader.parse(arrayBuffer as ArrayBuffer, '', (gltf) => {
      // Remove previous model if any
      if (loadedModel) {
        scene.remove(loadedModel);
      }
      scene.add(gltf.scene);
      loadedModel = gltf.scene;
      // Reset scale bar
      if (scaleBar) scaleBar.value = '1';
      loadedModel.scale.set(1, 1, 1);
      // Hide upload panel after successful load
      uploadPanel.style.display = 'none';
    }, (error) => {
      alert('Failed to load GLB: ' + error.message);
    });
  };
  reader.readAsArrayBuffer(file);
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue

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
document.body.appendChild(VRButton.createButton(renderer));
// Change VRButton background color and position (top right), and move scale panel below it
setTimeout(() => {
  const vrBtn = document.querySelector('.vr-button') || document.querySelector('button');
  if (vrBtn) {
    (vrBtn as HTMLElement).style.background = '#000000ff';
    (vrBtn as HTMLElement).style.color = '#fff';
    (vrBtn as HTMLElement).style.borderRadius = '8px';
    (vrBtn as HTMLElement).style.fontWeight = 'bold';
    (vrBtn as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    (vrBtn as HTMLElement).style.position = 'absolute';
    (vrBtn as HTMLElement).style.top = '20px';
    (vrBtn as HTMLElement).style.right = '20px';
    (vrBtn as HTMLElement).style.left = '';
    (vrBtn as HTMLElement).style.zIndex = '30';
    (vrBtn as HTMLElement).style.width = '140px';
    (vrBtn as HTMLElement).style.height = '40px';
    (vrBtn as HTMLElement).style.fontSize = '16px';
    (vrBtn as HTMLElement).style.padding = '0 10px';
    (vrBtn as HTMLElement).style.margin = '0';
    (vrBtn as HTMLElement).style.display = 'flex';
    (vrBtn as HTMLElement).style.alignItems = 'center';
    (vrBtn as HTMLElement).style.justifyContent = 'center';
  }
  // Scale panel is already styled above
}, 100);

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
light.position.set(0, 20, 0);
light.intensity = 2.0;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// No default GLB loaded. Only user-uploaded GLB files will be shown.

// VR controller movement
const user = new THREE.Group();
scene.add(user);
user.add(camera);

// Track trigger state for each controller
const triggerHeld = [false, false];

function handleController(controller: THREE.Group) {
  const index = controller === renderer.xr.getController(0) ? 0 : 1;
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
    handleController(controller);
    user.add(controller);

    const controllerGrip = renderer.xr.getControllerGrip(i);
    controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
    user.add(controllerGrip);
  }
}

setupControllers();

function animate() {
  renderer.setAnimationLoop(() => {
    // Joystick movement using XRSession inputSources
    const session = renderer.xr.getSession();
    if (session && session.inputSources.length >= 2) {
      for (let i = 0; i < 2; i++) {
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
      }
    }
    renderer.render(scene, camera);
  });
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
