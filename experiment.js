// ========================================
// RISK LEARNING EXPERIMENT - MAIN SCRIPT
// ========================================

console.log("EXPERIMENT.JS LOADED - VERSION 15 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 0;  // Will be set after loading images
let experimentData = [];
let params = {};
let loadedImages = [];  // Array of {image: Image, path: string, type: 'sure'|'gamble'}
let trialOrder = [];    // Randomized order of stimulus indices
let currentBlock = 1;      // ADD THIS
let trialWithinBlock = 0;  // ADD THIS

// ========================================
// 1. LOAD ASSETS FROM DROPBOX
// ========================================

// Custom image loading function
async function loadImageFromDropboxCustom(imagePath) {
    try {
        console.log("Loading image from:", imagePath);
        
        const response = await dbx.filesDownload({ path: imagePath });
        
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

// Get list of files in a Dropbox folder
async function getDropboxFolderContents(folderPath) {
    try {
        console.log("Getting folder contents:", folderPath);
        const response = await dbx.filesListFolder({ path: folderPath });
        
        // Filter for image files only
        const imageFiles = response.result.entries
            .filter(entry => entry['.tag'] === 'file' && entry.name.endsWith('.png'))
            .map(entry => entry.path_lower);
        
        console.log("Found images:", imageFiles);
        return imageFiles;
    } catch (error) {
        console.error("Error getting folder contents:", error);
        return [];
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
        // Get list of all sure option images
        const sureImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/sure_options");
        
        // Get list of all gamble option images
        const gambleImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/gamble_options");
        
        console.log("Sure options found:", sureImagePaths.length);
        console.log("Gamble options found:", gambleImagePaths.length);
        
        // Load all sure option images
        for (const path of sureImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.push({
                image: image,
                path: path,
                type: 'sure'
            });
        }
        
        // Load all gamble option images
        for (const path of gambleImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.push({
                image: image,
                path: path,
                type: 'gamble'
            });
        }
        
        console.log("Total images loaded:", loadedImages.length);
        
        // Set total trials to number of images
        totalTrials = loadedImages.length;
        
        // Create randomized trial order (without replacement)
        trialOrder = shuffleArray([...Array(loadedImages.length).keys()]);
        console.log("Trial order:", trialOrder);
        
        // Load audio
        await loadRewardSound();
        console.log("Loaded reward sound");
        
    } catch (error) {
        console.error("Error loading assets:", error);
    }
}

// Shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ========================================
// 2. SAVE DATA TO DROPBOX
// ========================================

async function saveDataToDropbox() {
    console.log("Attempting to save data to Dropbox...");
    console.log("Data to save:", experimentData);
    
    try {
        // Subject name
        const subjectName = "RiskLearningSubject";
        
        // Create filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/${subjectName}/${subjectName}_${timestamp}.json`;
        
        console.log("Saving to filename:", filename);
        
        // Prepare data object
        const dataToSave = {
            experimentInfo: {
                subject: subjectName,
                startTime: experimentData[0]?.timestamp || now.toISOString(),
                endTime: now.toISOString(),
                totalTrials: currentTrial,
                version: "15"
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

function determineRewardCount(imagePath) {
    const sureValues = {
        'sure1.png': 1,
        'sure2.png': 2,
        'sure3.png': 3,
        'sure4.png': 4,
        'sure5.png': 5,
        'sure6.png': 6,
        'sure7.png': 7
    };
    
    // Extract filename from path (lowercase for matching)
    const filename = imagePath.split('/').pop().toLowerCase();
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
    
    // Position based on left, right, or center
    if (position === 'left') {
        img.style.left = '25%';
    } else if (position === 'right') {
        img.style.left = '75%';
    } else if (position === 'center') {
        img.style.left = '50%';
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

async function presentSingleStimulus(image, imagePath, stimulusType) {
    return new Promise((resolve) => {
        clearDisplay();
        
        // Randomly choose left, right, or center position
        const positions = ['left', 'right', 'center'];
        const position = positions[Math.floor(Math.random() * positions.length)];
        
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
                resolve({ correct: true, position: position, imagePath: imagePath, stimulusType: stimulusType });
            }
        };
        
        // Incorrect response: click anywhere else
        const handleBackgroundClick = () => {
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                stimulus.removeEventListener('click', handleStimulusClick);
                resolve({ correct: false, position: position, imagePath: imagePath, stimulusType: stimulusType });
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
                resolve({ correct: false, position: position, imagePath: imagePath, stimulusType: stimulusType, timeout: true });
            }
        }, params.ChoiceTimeOut || 10000);
    });
}

// ========================================
// 6. TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Starting trial ${currentTrial + 1} (Block ${currentBlock}, Trial ${trialWithinBlock + 1} of ${totalTrials})`);
    
    // Get the stimulus for this trial (randomized order)
    const stimulusIndex = trialOrder[trialWithinBlock];
    const stimulusData = loadedImages[stimulusIndex];
    
    console.log(`Presenting: ${stimulusData.path} (${stimulusData.type})`);
    
    // Present single stimulus
    const response = await presentSingleStimulus(
        stimulusData.image, 
        stimulusData.path, 
        stimulusData.type
    );
    
    // Process response
    if (response.correct) {
        console.log('Correct response!');
        
        // Play reward feedback
        const rewardCount = determineRewardCount(stimulusData.path);
        await playRewardFeedback(rewardCount);
    } else {
        console.log('Incorrect response or timeout');
    }
    
    // Save trial data
    experimentData.push({
        trial: currentTrial + 1,
        block: currentBlock,
        trialWithinBlock: trialWithinBlock + 1,
        stimulus: stimulusData.path,
        stimulusType: stimulusData.type,
        position: response.position,
        correct: response.correct,
        timeout: response.timeout || false,
        rewardCount: response.correct ? determineRewardCount(stimulusData.path) : 0,
        timestamp: new Date().toISOString()
    });
    
    // Save data to Dropbox every 10 trials (backup)
    if ((currentTrial + 1) % 10 === 0) {
        console.log("Triggering backup save at trial", currentTrial + 1);
        await saveDataToDropbox();
    }
    
    // Inter-trial interval (1 second blank screen)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    currentTrial++;
    trialWithinBlock++;
    
    // Check if we've completed all stimuli in this block
    if (trialWithinBlock >= totalTrials) {
        // Reshuffle for next block
        console.log(`Block ${currentBlock} complete. Reshuffling for block ${currentBlock + 1}...`);
        trialOrder = shuffleArray([...Array(loadedImages.length).keys()]);
        trialWithinBlock = 0;
        currentBlock++;
    }
    
    // Continue running trials indefinitely
    runTrial();
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
    
    console.log(`Experiment will have ${totalTrials} trials`);
    
    // Hide instructions, show experiment
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    
    // Add black background class to body
    document.body.classList.add('experiment-running');
    console.log('Added experiment-running class to body');
    
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
// 8. PAGE LOAD INITIALIZATION
// ========================================

window.addEventListener('load', function() {
    console.log('Page loaded, experiment ready');
    document.getElementById('start-button').addEventListener('click', startExperiment);
});
