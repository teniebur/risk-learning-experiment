// ========================================
// RISK LEARNING EXPERIMENT - MAIN SCRIPT
// ========================================

console.log("EXPERIMENT.JS LOADED - VERSION 6 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 100;
let experimentData = [];
let params = {};
let loadedImages = {};  // Store preloaded images
let rewardSound = null; // Store loaded audio

// ========================================
// 1. LOAD ASSETS FROM DROPBOX
// ========================================

async function loadAssetsFromDropbox() {
    console.log("Loading assets from Dropbox...");
    
    try {
        // Load images using MKTurk's existing function
        // Path must start with / for Dropbox
        const sureImagePath = "/mkturkfolders/imagebags/sure_options/Sure2.png";
        loadedImages.sure = await loadImagefromDropbox(sureImagePath);
        console.log("Loaded sure image:", loadedImages.sure);
        
        // Load audio using MKTurk's existing function
        // SOUND_FILEPREFIX is "/mkturkfolders/sounds/au"
        // So "0" will load "/mkturkfolders/sounds/au0.wav"
        await loadSoundfromDropbox2("0", 0);
        console.log("Loaded reward sound");
        
    } catch (error) {
        console.error("Error loading assets:", error);
    }
}

// ========================================
// 2. REWARD FEEDBACK SYSTEM
// ========================================

async function playRewardFeedback(nRewards) {
    console.log(`Playing reward sound ${nRewards} times`);
    
    for (let i = 0; i < nRewards; i++) {
        try {
            // Use MKTurk's sound system
            if (sounds && sounds.buffer && sounds.buffer[0]) {
                var source = audiocontext.createBufferSource();
                source.buffer = sounds.buffer[0];
                source.connect(audiocontext.destination);
                source.start(0);
            }
            
            // Wait 300ms between sounds
            await new Promise(resolve => setTimeout(resolve, 300));
            
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }
}

function determineRewardCount(chosenStimulus) {
    const sureValues = {
        'Sure1.png': 1,
        'Sure2.png': 2,
        'Sure3.png': 3,
        'Sure4.png': 4,
        'Sure5.png': 5,
        'Sure6.png': 6,
        'Sure7.png': 7
    };
    
    // Extract filename from path
    const filename = chosenStimulus.split('/').pop();
    return sureValues[filename] || 1;
}

// ========================================
// 3. STIMULUS DISPLAY FUNCTIONS
// ========================================

function showStimulus(image, position) {
    const container = document.getElementById('experiment-container');
    
    // Clone the image element
    const img = image.cloneNode();
    img.className = 'stimulus';
    img.style.position = 'absolute';
    img.style.width = '150px';
    img.style.height = '150px';
    img.style.cursor = 'pointer';
    
    // Position based on left or right
    if (position === 'left') {
        img.style.left = '25%';
    } else if (position === 'right') {
        img.style.left = '75%';
    }
    img.style.top = '50%';
    img.style.transform = 'translate(-50%, -50%)';
    
    container.appendChild(img);
    return img;
}

function hideStimulus(stimulusElement) {
    if (stimulusElement && stimulusElement.parentNode) {
        stimulusElement.parentNode.removeChild(stimulusElement);
    }
}

function clearDisplay() {
    const container = document.getElementById('experiment-container');
    const stimuli = container.querySelectorAll('.stimulus');
    stimuli.forEach(stimulus => stimulus.remove());
}

// ========================================
// 4. SINGLE STIMULUS PRESENTATION
// ========================================

async function presentSingleStimulus(image, imagePath) {
    return new Promise((resolve) => {
        clearDisplay();
        
        // Randomly choose left or right position
        const position = Math.random() > 0.5 ? 'left' : 'right';
        
        // Show single stimulus
        const stimulus = showStimulus(image, position);
        
        let responseMade = false;
        
        // Correct response: click on the stimulus
        const handleStimulusClick = (event) => {
            event.stopPropagation();
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                document.getElementById('experiment-container').removeEventListener('click', handleBackgroundClick);
                resolve({ correct: true, position: position, imagePath: imagePath });
            }
        };
        
        // Incorrect response: click anywhere else
        const handleBackgroundClick = () => {
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                stimulus.removeEventListener('click', handleStimulusClick);
                resolve({ correct: false, position: position, imagePath: imagePath });
            }
        };
        
        stimulus.addEventListener('click', handleStimulusClick);
        document.getElementById('experiment-container').addEventListener('click', handleBackgroundClick);
        
        // Timeout (also incorrect)
        setTimeout(() => {
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                stimulus.removeEventListener('click', handleStimulusClick);
                document.getElementById('experiment-container').removeEventListener('click', handleBackgroundClick);
                resolve({ correct: false, position: position, imagePath: imagePath, timeout: true });
            }
        }, params.ChoiceTimeOut || 10000);
    });
}

// ========================================
// 5. TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Starting trial ${currentTrial + 1}`);
    
    // Use preloaded image
    const sureImagePath = "/mkturkfolders/imagebags/sure_options/Sure2.png";
    
    // Present single stimulus
    const response = await presentSingleStimulus(loadedImages.sure, imagePath);
    
    // Process response
    if (response.correct) {
        console.log('Correct response!');
        
        // Play reward feedback
        const rewardCount = determineRewardCount(imagePath);
        await playRewardFeedback(rewardCount);
    } else {
        console.log('Incorrect response or timeout');
    }
    
    // Save trial data
    experimentData.push({
        trial: currentTrial + 1,
        stimulus: imagePath,
        position: response.position,
        correct: response.correct,
        timeout: response.timeout || false,
        rewardCount: response.correct ? determineRewardCount(imagePath) : 0,
        timestamp: new Date().toISOString()
    });
    
    // Inter-trial interval (1 second blank screen)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    currentTrial++;
    
    if (currentTrial < totalTrials) {
        runTrial();
    } else {
        endExperiment();
    }
}

// ========================================
// 6. EXPERIMENT CONTROL
// ========================================

async function startExperiment() {
    console.log('Starting experiment...');
    
    // Initialize audio context (requires user interaction)
    initializeAudio();

    // Load assets from Dropbox
    await loadAssetsFromDropbox();
    
    // Hide instructions, show experiment
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    
    // Start first trial
    runTrial();
}

function endExperiment() {
    console.log('Experiment complete!');
    console.log('Data:', experimentData);
    
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
}

// ========================================
// 7. PAGE LOAD INITIALIZATION
// ========================================

window.addEventListener('load', function() {
    console.log('Page loaded, experiment ready');
    document.getElementById('start-button').addEventListener('click', startExperiment);
});
