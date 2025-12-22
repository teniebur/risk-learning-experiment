// ========================================
// RISK LEARNING EXPERIMENT - MAIN SCRIPT
// ========================================

console.log("EXPERIMENT.JS LOADED - VERSION 12 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 100;
let experimentData = [];
let params = {};
let loadedImages = {};

// ========================================
// 1. LOAD ASSETS FROM DROPBOX
// ========================================

// Custom image loading function
async function loadImageFromDropboxCustom(imagePath) {
    try {
        console.log("Loading image from:", imagePath);
        
        const response = await dbx.filesDownload({ path: imagePath });
        console.log("Dropbox image response:", response);
        
        // Get the blob from the response
        const blob = response.result.fileBlob;
        
        // Create object URL from blob
        const imageUrl = window.URL.createObjectURL(blob);
        
        // Create and return image element
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function() {
                console.log("Image loaded successfully:", imagePath);
                resolve(image);
            };
            image.onerror = function() {
                console.error("Image failed to load:", imagePath);
                reject(new Error("Image load failed"));
            };
            image.src = imageUrl;
        });
        
    } catch (error) {
        console.error("Error loading image:", error);
        throw error;
    }
}

// Custom audio loading function
async function loadRewardSound() {
    try {
        const soundPath = "/mkturkfolders/sounds/au0.wav";
        
        const response = await dbx.filesDownload({ path: soundPath });
        console.log("Dropbox audio response:", response);
        
        // Get the blob from the response
        const blob = response.result.fileBlob;
        
        // Convert blob to array buffer and decode
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audiocontext.decodeAudioData(arrayBuffer);
        
        // Store in sounds object
        sounds.buffer[0] = audioBuffer;
        console.log("Audio loaded successfully");
        
    } catch (error) {
        console.error("Error loading audio:", error);
    }
}

async function loadAssetsFromDropbox() {
    console.log("Loading assets from Dropbox...");
    
    try {
        // Load image using custom function
        const sureImagePath = "/mkturkfolders/imagebags/sure_options/Sure2.png";
        loadedImages.sure = await loadImageFromDropboxCustom(sureImagePath);
        console.log("Loaded sure image:", loadedImages.sure);
        
        // Load audio
        await loadRewardSound();
        console.log("Loaded reward sound");
        
    } catch (error) {
        console.error("Error loading assets:", error);
    }
}

// ========================================
// 2. SAVE DATA TO DROPBOX
// ========================================

async function saveDataToDropbox() {
    console.log("Attempting to save data to Dropbox...");
    console.log("Data to save:", experimentData);
    
    try {
        // Create filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/RiskLearning_${timestamp}.json`;
        
        console.log("Saving to filename:", filename);
        
        // Prepare data object
        const dataToSave = {
            experimentInfo: {
                startTime: experimentData[0]?.timestamp || now.toISOString(),
                endTime: now.toISOString(),
                totalTrials: currentTrial,
                version: "12"
            },
            trials: experimentData
        };
        
        // Convert to JSON string
        const dataString = JSON.stringify(dataToSave, null, 2);
        console.log("Data string length:", dataString.length);
        
        // Upload to Dropbox
        const response = await dbx.filesUpload({
            path: filename,
            contents: dataString,
            mode: { '.tag': 'overwrite' }
        });
        
        console.log("SUCCESS! Data saved to Dropbox:", response);
        console.log("Filename:", filename);
        
    } catch (error) {
        console.error("ERROR saving data to Dropbox:", error);
        console.error("Error details:", error.message);
    }
}

// ========================================
// 3. REWARD FEEDBACK SYSTEM
// ========================================

async function playRewardFeedback(nRewards) {
    console.log(`Playing reward sound ${nRewards} times`);
    
    for (let i = 0; i < nRewards; i++) {
        try {
            if (sounds && sounds.buffer && sounds.buffer[0]) {
                var source = audiocontext.createBufferSource();
                source.buffer = sounds.buffer[0];
                source.connect(audiocontext.destination);
                source.start(0);
                
                // Wait for sound to finish + small gap
                await new Promise(resolve => setTimeout(resolve, 300));
            }
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
    
    const filename = chosenStimulus.split('/').pop();
    return sureValues[filename] || 1;
}

// ========================================
// 4. STIMULUS DISPLAY FUNCTIONS
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
// 5. SINGLE STIMULUS PRESENTATION
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
// 6. TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Starting trial ${currentTrial + 1}`);
    
    // Use preloaded image
    const imagePath = "/mkturkfolders/imagebags/sure_options/Sure2.png";
    
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

    // THIS PART - Save data to Dropbox every 10 trials (backup)
    if ((currentTrial + 1) % 10 === 0) {
        console.log("Triggering backup save at trial", currentTrial + 1);
        await saveDataToDropbox();
    }
    
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
// 7. EXPERIMENT CONTROL
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

    // Add black background class to body  <-- THIS LINE
    document.body.classList.add('experiment-running');
    
    // Start first trial
    runTrial();
}

async function endExperiment() {
    console.log('Experiment complete!');
    console.log('Data:', experimentData);
    
    // Save final data to Dropbox
    console.log("Saving final data...");
    await saveDataToDropbox();
    
    // Remove black background class
    document.body.classList.remove('experiment-running');
    
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
