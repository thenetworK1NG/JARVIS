// Image movement variables
const imagesContainer = document.getElementById('imagesContainer');
const progressCircle = document.getElementById('progressCircle');
let images = [];
let selectedImage = null;
let isPinching = false;
let pinchHandPos = {x: 0, y: 0};
let pinchStartTime = null;
// Right-hand gesture state (for rotate/scale)
let rightGesture = { active: false, startAngle: 0, startRotation: 0 };
// Right-hand pinch-scaling state
let rightPinchScale = { active: false, startDist: 0, startScale: 1 };
// Tuning constants
const SELECTION_HOLD = 0.4; // seconds required to hold pinch over an image to select (faster pickup)
const UNSELECT_HOLD = 0.4; // seconds to hold both hands open to place (faster place)
const PINCH_DISTANCE_THRESHOLD = 0.09; // threshold for thumb-index pinch detection (higher = easier pickup)
const SMOOTHING = 0.32; // movement smoothing (higher = snappier)
const ROTATION_SMOOTHING = 0.18; // smoothing for rotation updates (0..1)
const ROTATION_DEADZONE = 0.6; // degrees under which we snap to avoid micro-jitter
const SCALE_SMOOTHING = 0.22; // smoothing for scale updates (0..1)
const SCALE_DEADZONE = 0.005; // scale difference under which we snap to avoid micro-jitter
// Hand openness tuning (use hand-size-normalized thresholds so detection works at different distances)
const OPEN_FINGER_RATIO = 0.55; // fingertip-to-wrist distance must exceed handSize * this to count as 'open'
const MIN_OPEN_THRESHOLD = 0.06; // min absolute threshold
const MAX_OPEN_THRESHOLD = 0.22; // max absolute threshold

// Middle-finger voice reaction settings
const MIDDLE_FINGER_HOLD = 0.6; // seconds the gesture must be held
const MIDDLE_FINGER_COOLDOWN = 5000; // ms cooldown between spoken responses
let middleFingerHoldStart = null;
let lastMiddleFingerTime = 0;

// Time and Date gesture tracking variables
let timeGestureActive = false;
let timeGestureStartTime = null;
let dateGestureActive = false;
let dateGestureStartTime = null;

// NOTE: Add-image button removed per user request. Images are added via the 'i' import key only.

// Helper: create an image element from a data URL or remote URL and add to the scene
function createImageFromSrc(src) {
    const img = document.createElement('img');
    img.src = src;
    img.style.display = 'block';
    img.style.position = 'fixed';
    img.style.left = `${window.innerWidth / 2}px`;
    img.style.top = `${window.innerHeight / 2}px`;
    img.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(1)';
    img.style.maxWidth = '200px';
    img.style.maxHeight = '200px';
    img.style.zIndex = '3';
    imagesContainer.appendChild(img);
    images.push({
        el: img,
        selected: false,
        pinchStartTime: null,
        // displayX/Y used for smoothing movement (exponential smoothing)
        displayX: window.innerWidth / 2,
        displayY: window.innerHeight / 2,
        // transform state
        scale: 1,
        rotation: 0,
        // displayed rotation used for smoothing (degrees)
        displayRotation: 0,
        // displayed scale used for smoothing
        displayScale: 1
    });
}

// Hidden file input for importing images via keyboard
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);
fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        createImageFromSrc(ev.target.result);
    };
    reader.readAsDataURL(file);
    // reset so same file can be chosen again later
    fileInput.value = '';
});

// Keyboard shortcut: press 'i' to import an image
window.addEventListener('keydown', (e) => {
    // ignore when typing into inputs
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    if (e.key && e.key.toLowerCase() === 'i') {
        fileInput.click();
    }
});
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let videoStream;
let video;
async function setupWebcam() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video = document.createElement('video');
        video.srcObject = videoStream;
        video.play();
        await new Promise(resolve => video.onloadedmetadata = resolve);
        statusDiv.textContent = 'Webcam ready. Loading hand tracking...';
        onFrame();
    } catch (e) {
        statusDiv.textContent = 'Error accessing webcam.';
        console.error(e);
    }
}

setupWebcam();

// MediaPipe Hands setup
const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
hands.onResults(onResults);

async function onFrame() {
    if (video && video.readyState === 4) {
        await hands.send({image: video});
    }
    requestAnimationFrame(onFrame);
}

function onResults(results) {
    // Clear canvas (keep it transparent) so the overlay doesn't obscure DOM images
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isPinching = false;
    let allPinched = false;
    let pinchPos = null;
    let handLandmarks = null;
    let bothHandsOpen = false;
    let openHandsCount = 0;
    let handsDetected = 0;
    let leftHandLandmarks = null;
    let rightHandLandmarks = null;
    if (results.multiHandLandmarks && results.multiHandedness) {
        // Find left and right hands (labels are relative to the user)
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const label = results.multiHandedness[i].label;
            if (label === "Left") {
                leftHandLandmarks = results.multiHandLandmarks[i];
            } else if (label === "Right") {
                rightHandLandmarks = results.multiHandLandmarks[i];
            }
        }
        handLandmarks = leftHandLandmarks;
        handsDetected = results.multiHandLandmarks.length;
        results.multiHandLandmarks.forEach(landmarks => {
            // Multi-finger pinch detection (all fingertips close to thumb tip)
            const thumbTip = landmarks[4];
            const tipIndices = [8, 12, 16, 20];
            let closeCount = 0;
            tipIndices.forEach(idx => {
                const tip = landmarks[idx];
                const dx = thumbTip.x - tip.x;
                const dy = thumbTip.y - tip.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 0.09) closeCount++;
            });
            // Check if all fingers pinched
            if (closeCount === 4) {
                allPinched = true;
                pinchPos = {
                    x: (1 - thumbTip.x) * canvas.width,
                    y: thumbTip.y * canvas.height
                };
            }
            // Check if hand is open (all fingertips far from thumb tip)
            // Use a threshold based on hand size so it works even when user is farther from camera.
            let openCount = 0;
            // estimate hand size as distance wrist -> middle_mcp (landmark 9)
            const wrist = landmarks[0];
            const middleMcp = landmarks[9] || landmarks[5];
            const hx = wrist.x - middleMcp.x;
            const hy = wrist.y - middleMcp.y;
            let handSize = Math.sqrt(hx*hx + hy*hy);
            // clamp and fallback
            if (!handSize || handSize <= 0) handSize = 0.12;
            // compute threshold scaled by hand size
            let openThreshold = handSize * OPEN_FINGER_RATIO;
            openThreshold = Math.max(MIN_OPEN_THRESHOLD, Math.min(MAX_OPEN_THRESHOLD, openThreshold));
            tipIndices.forEach(idx => {
                const tip = landmarks[idx];
                const dx = thumbTip.x - tip.x;
                const dy = thumbTip.y - tip.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > openThreshold) openCount++;
            });
            if (openCount === 4) {
                openHandsCount++;
            }
        });
        // Compute simple left-hand pinch (thumb-index) early so UI hiding can use it.
        // Do NOT set global isPinching here (that is controlled by the movement code when an image is selected).
        let leftPinchDetected = false;
        if (leftHandLandmarks) {
            const t = leftHandLandmarks[4];
            const i = leftHandLandmarks[8];
            const dx = t.x - i.x;
            const dy = t.y - i.y;
            const distThumbIndex = Math.sqrt(dx*dx + dy*dy);
            leftPinchDetected = distThumbIndex < PINCH_DISTANCE_THRESHOLD;
        }
        if (openHandsCount === 2 && handsDetected >= 2) {
            bothHandsOpen = true;
            statusDiv.textContent = 'Both hands open - unselecting image...';
        } else {
            statusDiv.textContent = 'Hands detected!';
        }
        // detect a held middle-finger gesture (middle finger extended while neighbors folded)
        function isMiddleFingerGesture(landmarks) {
            if (!landmarks || landmarks.length < 21) return false;
            const wrist = landmarks[0];
            const middleMcp = landmarks[9] || landmarks[5];
            let hx = wrist.x - middleMcp.x;
            let hy = wrist.y - middleMcp.y;
            let handSize = Math.sqrt(hx*hx + hy*hy);
            if (!handSize || handSize <= 0) handSize = 0.12;
            // threshold for considering a finger 'extended'
            const extendThresh = Math.max(0.04, Math.min(0.35, handSize * 0.5));

            const tip = (i) => landmarks[i];
            const pip = (i) => landmarks[Math.max(0, i - 2)];

            const midTip = tip(12);
            const midPip = pip(12);
            const distMid = Math.hypot(midTip.x - midPip.x, midTip.y - midPip.y);
            const midExtended = distMid > extendThresh;

            const idxTip = tip(8); const idxPip = pip(8);
            const distIdx = Math.hypot(idxTip.x - idxPip.x, idxTip.y - idxPip.y);
            const idxExtended = distIdx > extendThresh;

            const ringTip = tip(16); const ringPip = pip(16);
            const distRing = Math.hypot(ringTip.x - ringPip.x, ringTip.y - ringPip.y);
            const ringExtended = distRing > extendThresh;

            const pinkyTip = tip(20); const pinkyPip = pip(20);
            const distPinky = Math.hypot(pinkyTip.x - pinkyPip.x, pinkyTip.y - pinkyPip.y);
            const pinkyExtended = distPinky > extendThresh;

            // Middle extended while the adjacent fingers are not extended
            return midExtended && !idxExtended && !ringExtended && !pinkyExtended;
        }

        let middleFingerDetected = false;
        if (leftHandLandmarks && isMiddleFingerGesture(leftHandLandmarks)) middleFingerDetected = true;
        if (rightHandLandmarks && isMiddleFingerGesture(rightHandLandmarks)) middleFingerDetected = true;

        if (middleFingerDetected) {
            if (!middleFingerHoldStart) middleFingerHoldStart = Date.now();
            const held = (Date.now() - middleFingerHoldStart) / 1000;
            if (held >= MIDDLE_FINGER_HOLD && (Date.now() - lastMiddleFingerTime) > MIDDLE_FINGER_COOLDOWN) {
                // speak a short response (use SpeechSynthesis if available)
                try {
                    if ('speechSynthesis' in window) {
                        const u = new SpeechSynthesisUtterance("That's not nice");
                        u.lang = 'en-US';
                        u.rate = 1.0;
                        // cancel any in-progress speech and speak this
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                    }
                } catch (e) {
                    console.warn('Speech synthesis failed', e);
                }
                lastMiddleFingerTime = Date.now();
                middleFingerHoldStart = null;
            }
        } else {
            middleFingerHoldStart = null;
        }

        // Time and Date Hand Gesture Detection
        let timeGesture = false;
        let dateGesture = false;

        // Check for time gesture (thumb + index finger extended for both hands)
        if (leftHandLandmarks && rightHandLandmarks) {
            const leftThumbTip = leftHandLandmarks[4];
            const leftIndexTip = leftHandLandmarks[8];
            const leftMiddleTip = leftHandLandmarks[12];
            const leftRingTip = leftHandLandmarks[16];
            const leftPinkyTip = leftHandLandmarks[20];

            const rightThumbTip = rightHandLandmarks[4];
            const rightIndexTip = rightHandLandmarks[8];
            const rightMiddleTip = rightHandLandmarks[12];
            const rightRingTip = rightHandLandmarks[16];
            const rightPinkyTip = rightHandLandmarks[20];

            // Calculate hand sizes for normalization
            const leftWrist = leftHandLandmarks[0];
            const rightWrist = rightHandLandmarks[0];
            const leftHandSize = Math.sqrt(
                Math.pow(leftWrist.x - leftHandLandmarks[9].x, 2) + 
                Math.pow(leftWrist.y - leftHandLandmarks[9].y, 2)
            );
            const rightHandSize = Math.sqrt(
                Math.pow(rightWrist.x - rightHandLandmarks[9].x, 2) + 
                Math.pow(rightWrist.y - rightHandLandmarks[9].y, 2)
            );

            const extendThreshold = 0.08;

            // Check if thumb and index are extended for both hands (TIME gesture)
            const leftThumbIndexExtended = (
                Math.sqrt(Math.pow(leftThumbTip.x - leftWrist.x, 2) + Math.pow(leftThumbTip.y - leftWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(leftIndexTip.x - leftWrist.x, 2) + Math.pow(leftIndexTip.y - leftWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(leftMiddleTip.x - leftWrist.x, 2) + Math.pow(leftMiddleTip.y - leftWrist.y, 2)) < extendThreshold
            );

            const rightThumbIndexExtended = (
                Math.sqrt(Math.pow(rightThumbTip.x - rightWrist.x, 2) + Math.pow(rightThumbTip.y - rightWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(rightIndexTip.x - rightWrist.x, 2) + Math.pow(rightIndexTip.y - rightWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(rightMiddleTip.x - rightWrist.x, 2) + Math.pow(rightMiddleTip.y - rightWrist.y, 2)) < extendThreshold
            );

            timeGesture = leftThumbIndexExtended && rightThumbIndexExtended;

            // Check for DATE gesture (all fingers extended for both hands)
            const leftAllExtended = (
                Math.sqrt(Math.pow(leftThumbTip.x - leftWrist.x, 2) + Math.pow(leftThumbTip.y - leftWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(leftIndexTip.x - leftWrist.x, 2) + Math.pow(leftIndexTip.y - leftWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(leftMiddleTip.x - leftWrist.x, 2) + Math.pow(leftMiddleTip.y - leftWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(leftRingTip.x - leftWrist.x, 2) + Math.pow(leftRingTip.y - leftWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(leftPinkyTip.x - leftWrist.x, 2) + Math.pow(leftPinkyTip.y - leftWrist.y, 2)) > extendThreshold
            );

            const rightAllExtended = (
                Math.sqrt(Math.pow(rightThumbTip.x - rightWrist.x, 2) + Math.pow(rightThumbTip.y - rightWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(rightIndexTip.x - rightWrist.x, 2) + Math.pow(rightIndexTip.y - rightWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(rightMiddleTip.x - rightWrist.x, 2) + Math.pow(rightMiddleTip.y - rightWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(rightRingTip.x - rightWrist.x, 2) + Math.pow(rightRingTip.y - rightWrist.y, 2)) > extendThreshold &&
                Math.sqrt(Math.pow(rightPinkyTip.x - rightWrist.x, 2) + Math.pow(rightPinkyTip.y - rightWrist.y, 2)) > extendThreshold
            );

            dateGesture = leftAllExtended && rightAllExtended;
        }

        // Handle time gesture
        if (timeGesture && !timeGestureActive) {
            timeGestureActive = true;
            timeGestureStartTime = Date.now();
            statusDiv.textContent = 'Time gesture detected - hold for 1 second...';
        } else if (!timeGesture && timeGestureActive) {
            timeGestureActive = false;
            timeGestureStartTime = null;
        } else if (timeGesture && timeGestureActive && timeGestureStartTime) {
            const heldTime = (Date.now() - timeGestureStartTime) / 1000;
            if (heldTime >= 1.0) {
                // Get custom format from localStorage if available
                let timeFormat = 'The current time is {time}';
                try {
                    const savedSettings = localStorage.getItem('voiceBotSettings');
                    if (savedSettings) {
                        const settings = JSON.parse(savedSettings);
                        timeFormat = settings.timeResponseFormat || timeFormat;
                    }
                } catch (e) {
                    console.warn('Could not load time format from settings:', e);
                }
                
                // Announce current time
                const currentTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const timeResponse = timeFormat.replace('{time}', currentTime);
                statusDiv.textContent = timeResponse;
                
                try {
                    if ('speechSynthesis' in window) {
                        const u = new SpeechSynthesisUtterance(timeResponse);
                        u.lang = 'en-US';
                        u.rate = 1.0;
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                    }
                } catch (e) {
                    console.warn('Speech synthesis failed', e);
                }
                
                timeGestureActive = false;
                timeGestureStartTime = null;
            }
        }

        // Handle date gesture
        if (dateGesture && !dateGestureActive) {
            dateGestureActive = true;
            dateGestureStartTime = Date.now();
            statusDiv.textContent = 'Date gesture detected - hold for 1 second...';
        } else if (!dateGesture && dateGestureActive) {
            dateGestureActive = false;
            dateGestureStartTime = null;
        } else if (dateGesture && dateGestureActive && dateGestureStartTime) {
            const heldTime = (Date.now() - dateGestureStartTime) / 1000;
            if (heldTime >= 1.0) {
                // Get custom format from localStorage if available
                let dateFormat = 'Today is {date}';
                try {
                    const savedSettings = localStorage.getItem('voiceBotSettings');
                    if (savedSettings) {
                        const settings = JSON.parse(savedSettings);
                        dateFormat = settings.dateResponseFormat || dateFormat;
                    }
                } catch (e) {
                    console.warn('Could not load date format from settings:', e);
                }
                
                // Announce current date
                const currentDate = new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const dateResponse = dateFormat.replace('{date}', currentDate);
                statusDiv.textContent = dateResponse;
                
                try {
                    if ('speechSynthesis' in window) {
                        const u = new SpeechSynthesisUtterance(dateResponse);
                        u.lang = 'en-US';
                        u.rate = 1.0;
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                    }
                } catch (e) {
                    console.warn('Speech synthesis failed', e);
                }
                
                dateGestureActive = false;
                dateGestureStartTime = null;
            }
        }
    // Decide whether to draw fingertip UI: hide when picking up, rotating, selecting or scaling
    // Only hide for left-hand pinch when an item is selected (avoid hiding UI when user pinches in the air)
    const hideFingersUI = Boolean((selectedImage && selectedImage.selected) || (selectedImage && leftPinchDetected) || rightGesture.active || rightPinchScale.active);
        if (!hideFingersUI) {
            // draw hands only if UI not hidden
            results.multiHandLandmarks.forEach(landmarks => drawHand(landmarks));
        }
    } else {
        statusDiv.textContent = 'No hands detected.';
    }

    // Selection logic for multiple images (only right hand)
    let foundSelection = false;
    if (leftHandLandmarks) {
        // Multi-finger pinch detection (all fingertips close to thumb tip)
        const thumbTip = leftHandLandmarks[4];
        const tipIndices = [8, 12, 16, 20];
        let closeCount = 0;
        tipIndices.forEach(idx => {
            const tip = leftHandLandmarks[idx];
            const dx = thumbTip.x - tip.x;
            const dy = thumbTip.y - tip.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 0.09) closeCount++;
        });
        let allPinchedLeft = closeCount === 4;
        let pinchPosLeft = null;
        if (allPinchedLeft) {
            pinchPosLeft = {
                x: (1 - thumbTip.x) * canvas.width,
                y: thumbTip.y * canvas.height
            };
        }
        // Only allow selecting a new image if none is currently selected
        if (!selectedImage) {
            images.forEach(imgObj => {
                if (!imgObj.selected && imgObj.el.style.display === 'block') {
                    if (allPinchedLeft && pinchPosLeft) {
                    const imgRect = imgObj.el.getBoundingClientRect();
                    if (
                        pinchPosLeft.x >= imgRect.left && pinchPosLeft.x <= imgRect.right &&
                        pinchPosLeft.y >= imgRect.top && pinchPosLeft.y <= imgRect.bottom
                    ) {
                        if (!imgObj.pinchStartTime) imgObj.pinchStartTime = Date.now();
                        // Show and update progress circle at image center
                        const centerX = imgRect.left + imgRect.width / 2;
                        const centerY = imgRect.top + imgRect.height / 2;
                        progressCircle.style.display = 'block';
                        progressCircle.style.left = `${centerX}px`;
                        progressCircle.style.top = `${centerY}px`;
                            const elapsed = (Date.now() - imgObj.pinchStartTime) / 1000;
                            drawProgressCircle(elapsed);
                            if (elapsed >= SELECTION_HOLD) {
                            // Remove highlight from previously selected image
                            images.forEach(obj => {
                                obj.selected = false;
                                obj.el.classList.remove('selected');
                            });
                            imgObj.selected = true;
                            imgObj.el.classList.add('selected');
                            selectedImage = imgObj;
                            // initialize displayRotation to current rotation to avoid jump
                            selectedImage.displayRotation = selectedImage.rotation || 0;
                            progressCircle.style.display = 'none';
                        }
                        foundSelection = true;
                    } else {
                        imgObj.pinchStartTime = null;
                    }
                } else {
                    imgObj.pinchStartTime = null;
                }
            }
        });
        } else {
            // Another image is already selected — ensure we don't show selection progress
            images.forEach(obj => obj.pinchStartTime = null);
            foundSelection = false;
        }
    }
    if (!foundSelection) {
        progressCircle.style.display = 'none';
    }

    // Move selected image with one-hand pinch (only right hand)
    if (selectedImage && selectedImage.selected && leftHandLandmarks && !bothHandsOpen) {
        const thumbTip = leftHandLandmarks[4];
        const indexTip = leftHandLandmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < PINCH_DISTANCE_THRESHOLD) {
            isPinching = true;
            pinchHandPos.x = (1 - indexTip.x) * canvas.width;
            pinchHandPos.y = indexTip.y * canvas.height;
        }
            if (isPinching) {
            // Smooth movement using exponential smoothing to reduce jitter
            // smoothing: 0 => no movement, 1 => instant snap. Lower is smoother but more lag.
            const smoothing = SMOOTHING; // tweak between 0.08 (very smooth) and 0.35 (snappier)
            if (typeof selectedImage.displayX !== 'number' || typeof selectedImage.displayY !== 'number') {
                selectedImage.displayX = pinchHandPos.x;
                selectedImage.displayY = pinchHandPos.y;
            }
            // apply smoothing
            selectedImage.displayX += (pinchHandPos.x - selectedImage.displayX) * smoothing;
            selectedImage.displayY += (pinchHandPos.y - selectedImage.displayY) * smoothing;
            // snap to target when very close to avoid micro-jitter
            if (Math.abs(selectedImage.displayX - pinchHandPos.x) < 0.5) selectedImage.displayX = pinchHandPos.x;
            if (Math.abs(selectedImage.displayY - pinchHandPos.y) < 0.5) selectedImage.displayY = pinchHandPos.y;
            selectedImage.el.style.left = `${selectedImage.displayX}px`;
            selectedImage.el.style.top = `${selectedImage.displayY}px`;
            // Apply current rotation & scale along with translate (use smoothed displayRotation/displayScale when available)
            const rot = (typeof selectedImage.displayRotation === 'number') ? selectedImage.displayRotation : ((typeof selectedImage.rotation === 'number') ? selectedImage.rotation : 0);
            if (typeof selectedImage.displayScale !== 'number') selectedImage.displayScale = selectedImage.scale || 1;
            // smooth displayScale toward target each frame for consistent smoothing while moving
            selectedImage.displayScale += (selectedImage.scale - selectedImage.displayScale) * SCALE_SMOOTHING;
            if (Math.abs(selectedImage.displayScale - selectedImage.scale) < SCALE_DEADZONE) selectedImage.displayScale = selectedImage.scale;
            const sc = selectedImage.displayScale;
            selectedImage.el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${sc})`;
        }
    }

    // Right-hand gestures while holding image with left-hand pinch
    if (selectedImage && selectedImage.selected) {
        if (rightHandLandmarks) {
            const thumbTipR = rightHandLandmarks[4];
            const tipIndices = [8, 12, 16, 20];
            let closeCountR = 0;
            tipIndices.forEach(idx => {
                const tip = rightHandLandmarks[idx];
                const dx = thumbTipR.x - tip.x;
                const dy = thumbTipR.y - tip.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 0.09) closeCountR++;
            });
            const rightAllPinched = closeCountR === 4;
            // Detect right thumb-index pinch specifically for rotation
            const rightIndexTip = rightHandLandmarks[8];
            const dxTI = thumbTipR.x - rightIndexTip.x;
            const dyTI = thumbTipR.y - rightIndexTip.y;
            const rightThumbIndexDist = Math.sqrt(dxTI*dxTI + dyTI*dyTI);
            const rightThumbIndexPinch = rightThumbIndexDist < PINCH_DISTANCE_THRESHOLD;
            const rightPinchPos = {
                x: (1 - thumbTipR.x) * canvas.width,
                y: thumbTipR.y * canvas.height
            };

            if (rightAllPinched) {
                // two-hand pinch-scaling (unchanged)
                let leftPos = { x: selectedImage.displayX, y: selectedImage.displayY };
                if (isPinching && typeof pinchHandPos.x === 'number') leftPos = { x: pinchHandPos.x, y: pinchHandPos.y };
                else {
                    const rect = selectedImage.el.getBoundingClientRect();
                    leftPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                }
                const dist = Math.hypot(leftPos.x - rightPinchPos.x, leftPos.y - rightPinchPos.y);
                if (!rightPinchScale.active) {
                    rightPinchScale.active = true;
                    rightPinchScale.startDist = dist || 1;
                    rightPinchScale.startScale = selectedImage.scale || 1;
                    rightGesture.active = false;
                } else {
                    const ratio = dist / (rightPinchScale.startDist || dist);
                    selectedImage.scale = Math.max(0.2, Math.min(5, rightPinchScale.startScale * ratio));
                    if (typeof selectedImage.displayScale !== 'number') selectedImage.displayScale = selectedImage.scale;
                    selectedImage.displayScale += (selectedImage.scale - selectedImage.displayScale) * SCALE_SMOOTHING;
                    if (Math.abs(selectedImage.displayScale - selectedImage.scale) < SCALE_DEADZONE) selectedImage.displayScale = selectedImage.scale;
                    const dispRot = (typeof selectedImage.displayRotation === 'number') ? selectedImage.displayRotation : selectedImage.rotation;
                    selectedImage.el.style.transform = `translate(-50%, -50%) rotate(${dispRot}deg) scale(${selectedImage.displayScale})`;
                }
            } else if (rightThumbIndexPinch) {
                // rotation only when right thumb-index pinch
                const wrist = rightHandLandmarks[0];
                const indexMcp = rightHandLandmarks[5];
                const dx = indexMcp.x - wrist.x;
                const dy = indexMcp.y - wrist.y;
                const angleRad = Math.atan2(dy, dx);
                const angleDeg = angleRad * 180 / Math.PI;
                if (!rightGesture.active) {
                    rightGesture.active = true;
                    rightGesture.startAngle = angleDeg;
                    rightGesture.startRotation = selectedImage.rotation || 0;
                }
                if (rightGesture.active) {
                    let delta = angleDeg - rightGesture.startAngle;
                    if (delta > 180) delta -= 360;
                    if (delta < -180) delta += 360;
                    const newRotation = rightGesture.startRotation - delta;
                    selectedImage.rotation = newRotation;
                    if (typeof selectedImage.displayRotation !== 'number') selectedImage.displayRotation = selectedImage.rotation;
                    if (typeof selectedImage.displayScale !== 'number') selectedImage.displayScale = selectedImage.scale || 1;
                    selectedImage.displayRotation += (selectedImage.rotation - selectedImage.displayRotation) * ROTATION_SMOOTHING;
                    if (Math.abs(selectedImage.displayRotation - selectedImage.rotation) < ROTATION_DEADZONE) selectedImage.displayRotation = selectedImage.rotation;
                    selectedImage.displayScale += (selectedImage.scale - selectedImage.displayScale) * SCALE_SMOOTHING;
                    if (Math.abs(selectedImage.displayScale - selectedImage.scale) < SCALE_DEADZONE) selectedImage.displayScale = selectedImage.scale;
                    selectedImage.el.style.transform = `translate(-50%, -50%) rotate(${selectedImage.displayRotation}deg) scale(${selectedImage.displayScale})`;
                }
            } else {
                // no rotation or pinch-scale active
                rightGesture.active = false;
                rightPinchScale.active = false;
            }
        } else {
            // No right hand present — stop gestures
            rightGesture.active = false;
            rightPinchScale.active = false;
        }
    } else {
        // no selected image — ensure gestures off
        rightGesture.active = false;
        rightPinchScale.active = false;
    }

    // Unselect and lock image if both hands open for a short hold (faster placement)
    if (selectedImage && selectedImage.selected && bothHandsOpen) {
        if (!selectedImage.unselectStartTime) {
            selectedImage.unselectStartTime = Date.now();
        }
    // Use UNSELECT_HOLD seconds for two-hand unselect/lock countdown to match quicker placement
    const elapsed = (Date.now() - selectedImage.unselectStartTime) / 1000;
        // Show circular progress at image center
        const imgRect = selectedImage.el.getBoundingClientRect();
        const centerX = imgRect.left + imgRect.width / 2;
        const centerY = imgRect.top + imgRect.height / 2;
        progressCircle.style.display = 'block';
        progressCircle.style.left = `${centerX}px`;
        progressCircle.style.top = `${centerY}px`;
        drawProgressCircle(elapsed);
                if (elapsed >= UNSELECT_HOLD) {
            selectedImage.selected = false;
            selectedImage.el.classList.remove('selected');
            selectedImage.unselectStartTime = null;
            selectedImage = null;
            progressCircle.style.display = 'none';
        }
    } else if (selectedImage && selectedImage.selected) {
        // Reset unselect timer if hands not open
        selectedImage.unselectStartTime = null;
    }
// Draw circular progress bar (0 to 1)
function drawProgressCircle(progress) {
    const size = 80;
    progressCircle.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    const circleBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circleBg.setAttribute('cx', size/2);
    circleBg.setAttribute('cy', size/2);
    circleBg.setAttribute('r', size/2 - 8);
    circleBg.setAttribute('stroke', '#fff');
    circleBg.setAttribute('stroke-width', '8');
    circleBg.setAttribute('fill', 'none');
    svg.appendChild(circleBg);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', size/2);
    circle.setAttribute('cy', size/2);
    circle.setAttribute('r', size/2 - 8);
    circle.setAttribute('stroke', '#ffb300');
    circle.setAttribute('stroke-width', '8');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-dasharray', 2 * Math.PI * (size/2 - 8));
    circle.setAttribute('stroke-dashoffset', (1-progress) * 2 * Math.PI * (size/2 - 8));
    circle.setAttribute('transform', `rotate(-90 ${size/2} ${size/2})`);
    svg.appendChild(circle);
    progressCircle.appendChild(svg);
}
}

function drawHand(landmarks) {
    // Stylized fingertip UI: glowing radial dots + connecting bones
    const fingertipIndices = [4, 8, 12, 16, 20];
    // draw small connecting lines from tip -> pip for each finger
    ctx.lineWidth = Math.max(2, canvas.width * 0.0025);
    ctx.lineCap = 'round';
    fingertipIndices.forEach(idx => {
        const tip = landmarks[idx];
        const pip = landmarks[Math.max(0, idx - 2)];
        const tx = (1 - tip.x) * canvas.width;
        const ty = tip.y * canvas.height;
        const px = (1 - pip.x) * canvas.width;
        const py = pip.y * canvas.height;
        // subtle connecting line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.closePath();
    });

    // glowing radial circles for each fingertip
    fingertipIndices.forEach((i, idx) => {
        const point = landmarks[i];
        const x = (1 - point.x) * canvas.width;
        const y = point.y * canvas.height;
        const baseR = Math.max(10, canvas.width * 0.012);
        const outerR = baseR * 1.9;
        // create radial gradient (warm center, cool outer)
        const grad = ctx.createRadialGradient(x, y, baseR * 0.2, x, y, outerR);
        // alternate colors for visual interest
        if (idx % 2 === 0) {
            grad.addColorStop(0, 'rgba(255,210,120,0.95)');
            grad.addColorStop(0.6, 'rgba(200,120,255,0.25)');
            grad.addColorStop(1, 'rgba(120,80,200,0.0)');
        } else {
            grad.addColorStop(0, 'rgba(120,200,255,0.95)');
            grad.addColorStop(0.6, 'rgba(180,120,255,0.25)');
            grad.addColorStop(1, 'rgba(140,80,200,0.0)');
        }
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // inner bright core
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.arc(x, y, baseR * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // outer ring
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = Math.max(2, canvas.width * 0.003);
        ctx.arc(x, y, baseR * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();
    });
}

video.addEventListener('play', () => {
    onFrame();
});
