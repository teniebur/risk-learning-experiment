// ========================================
// CHOICE EXPERIMENT - TWO STIMULUS COMPARISON
// ========================================

console.log("EXPERIMENT_CHOICE.JS LOADED - VERSION 39 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 0;
let experimentData = [];
let params = {};
let subjectName = "";
let loadedImages = [];
let trialOrder = [];
let currentBlock = 1;
let trialWithinBlock = 0;

// ========================================
// LOAD ASSETS FROM DROPBOX
// ========================================

async function loadImageFromDropboxCustom(imagePath) {
    try {
        console.log("Loading image from:", imagePath);
        const response = await dbx.filesDownload({ path: imagePath });
        const blob = response.result.fileBlob;
        const imageUrl = window.URL.createObjectURL(blob);
        
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function() {
                console.log("Image loaded:", imagePath);
                resolve(image);
            };
            image.onerror = function() {
                reject(new Error("Image load failed"));
            };
            image.src = imageUrl;
        });
    } catch (error) {
        console.error("Error loading image:", error);
        throw error;
    }
}

async function getDropboxFolderContents(folderPath) {
    try {
        const response = await dbx.filesListFolder({ path: folderPath });
        const imageFiles = response.result.entries
            .filter(entry => entry['.tag'] === 'file' && entry.name.endsWith('.png'))
            .map(entry => entry.path_lower);
        return imageFiles;
    } catch (error) {
        console.error("Error getting folder contents:", error);
        return [];
    }
}

async function loadRewardSound() {
    try {
        const soundPath = "/mkturkfolders/sounds/au0.wav";
        const response = await dbx.filesDownload({ path: soundPath });
        const blob = response.result.fileBlob;
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audiocontext.decodeAudioData(arrayBuffer);
        sounds.buffer[0] = audioBuffer;
        console.log("Audio loaded");
    } catch (error) {
        console.error("Error loading audio:", error);
    }
}

async function loadAssetsFromDropbox() {
    console.log("Loading assets from Dropbox...");
    
    try {
        // Only load sure options for this task
        const sureImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/sure_options");
        
        console.log("Sure options found:", sureImagePaths.length);
        
        for (const path of sureImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.push({
                image: image,
                path: path,
                type: 'sure'
            });
        }
        
        console.log("Total images loaded:", loadedImages.length);
        
        // Generate all unique pairs for comparison
        generateTrialPairs();
        
        await loadRewardSound();
        
    } catch (error) {
        console.error("Error loading assets:", error);
    }
}

// ========================================
// GENERATE TRIAL PAIRS
// ========================================

function generateTrialPairs() {
    trialOrder = [];
    
    // Create all unique pairs of sure stimuli
    for (let i = 0; i < loadedImages.length; i++) {
        for (let j = i + 1; j < loadedImages.length; j++) {
            trialOrder.push({
                stimulus1: loadedImages[i],
                stimulus2: loadedImages[j]
            });
        }
    }
    
    // Shuffle pairs
    trialOrder = shuffleArray(trialOrder);
    totalTrials = trialOrder.length;
    
    console.log("Generated " + totalTrials + " trial pairs");
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ========================================
// LOAD SUBJECT PARAMETERS
// ========================================

async function loadSubjectParameters(subject) {
    console.log("Loading parameters for subject: " + subject);
    const paramPath = `/mkturkfolders/parameterfiles/subjects/${subject}_params.txt`;
    
    try {
        const response = await dbx.filesDownload({ path: paramPath });
        const blob = response.result.fileBlob;
        const text = await blob.text();
        params = JSON.parse(text);
        console.log("Parameters loaded:", params);
        document.getElementById('subject-status').innerHTML = 'Parameters loaded!';
        document.getElementById('subject-status').style.color = 'green';
        return true;
    } catch (error) {
        console.error("Error loading parameters:", error);
        document.getElementById('subject-status').innerHTML = 'Failed to load parameters!';
        document.getElementById('subject-status').style.color = 'red';
        return false;
    }
}

// ========================================
// SAVE DATA TO DROPBOX
// ========================================

async function saveDataToDropbox() {
    console.log("Saving data to Dropbox...");
    
    try {
        const subject = subjectName || "UnknownSubject";
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/${subject}/${subject}_choice_${timestamp}.json`;
        
        const dataToSave = {
            experimentInfo: {
                experimentType: "choice",
                subject: subject,
                parameters: params,
                startTime: experimentData[0]?.timestamp || now.toISOString(),
                endTime: now.toISOString(),
                totalTrials: currentTrial,
                totalBlocks: currentBlock,
                version: "39"
            },
            trials: experimentData
        };
        
        const dataString = JSON.stringify(dataToSave, null, 2);
        
        const response = await dbx.filesUpload({
            path: filename,
            contents: dataString,
            mode: { '.tag': 'overwrite' }
        });
        
        console.log("Data saved:", filename);
        
    } catch (error) {
        console.error("Error saving data:", error);
    }
}

// ========================================
// STIMULUS DISPLAY FUNCTIONS
// ========================================

function showStimulus(image, position) {
    const container = document.getElementById('experiment-container');
    const img = image.cloneNode();
    img.className = 'stimulus';
    img.style.position = 'absolute';
    img.style.width = '150px';
    img.style.height = '150px';
    img.style.cursor = 'pointer';
    
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
// GET REWARD VALUE FROM FILENAME
// ========================================

function getRewardValue(imagePath) {
    const filename = imagePath.split('/').pop().toLowerCase();
    const match = filename.match(/sure(\d+)\.png/);
    if (match) {
        return parseInt(match[1]);
    }
    return 0;
}

// ========================================
// TWO-CHOICE PRESENTATION
// ========================================

async function presentTwoChoices(stimulus1, stimulus2) {
    return new Promise((resolve) => {
        clearDisplay();
        
        // Randomly assign left/right positions
        const leftStimulus = Math.random() > 0.5 ? stimulus1 : stimulus2;
        const rightStimulus = leftStimulus === stimulus1 ? stimulus2 : stimulus1;
        
        // Show both stimuli
        const leftElement = showStimulus(leftStimulus.image, 'left');
        const rightElement = showStimulus(rightStimulus.image, 'right');
        
        let responseMade = false;
        
        // Get reward values
        const leftValue = getRewardValue(leftStimulus.path);
        const rightValue = getRewardValue(rightStimulus.path);
        const correctChoice = leftValue > rightValue ? 'left' : 'right';
        const higherValue = Math.max(leftValue, rightValue);
        const lowerValue = Math.min(leftValue, rightValue);
        
        // Left stimulus clicked
        const handleLeftClick = (event) => {
            event.stopPropagation();
            if (!responseMade) {
                responseMade = true;
                cleanup();
                resolve({
                    choice: 'left',
                    chosenStimulus: leftStimulus,
                    chosenValue: leftValue,
                    otherValue: rightValue,
                    correct: leftValue > rightValue,
                    leftStimulus: leftStimulus,
                    rightStimulus: rightStimulus
                });
            }
        };
        
        // Right stimulus clicked
        const handleRightClick = (event) => {
            event.stopPropagation();
            if (!responseMade) {
                responseMade = true;
                cleanup();
                resolve({
                    choice: 'right',
                    chosenStimulus: rightStimulus,
                    chosenValue: rightValue,
                    otherValue: leftValue,
                    correct: rightValue > leftValue,
                    leftStimulus: leftStimulus,
                    rightStimulus: rightStimulus
                });
            }
        };
        
        // Cleanup function
        const cleanup = () => {
            leftElement.removeEventListener('click', handleLeftClick);
            rightElement.removeEventListener('click', handleRightClick);
            hideStimulus(leftElement);
            hideStimulus(rightElement);
        };
        
        leftElement.addEventListener('click', handleLeftClick);
        rightElement.addEventListener('click', handleRightClick);
        
        // Timeout
        setTimeout(() => {
            if (!responseMade) {
                responseMade = true;
                cleanup();
                resolve({
                    choice: 'none',
                    chosenStimulus: null,
                    chosenValue: 0,
                    otherValue: 0,
                    correct: false,
                    timeout: true,
                    leftStimulus: leftStimulus,
                    rightStimulus: rightStimulus
                });
            }
        }, params.ChoiceTimeOut || 10000);
    });
}

// ========================================
// REWARD DELIVERY
// ========================================

async function playSingleRewardSound() {
    try {
        if (sounds && sounds.buffer && sounds.buffer[0]) {
            var source = audiocontext.createBufferSource();
            source.buffer = sounds.buffer[0];
            source.connect(audiocontext.destination);
            source.start(0);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}

async function deliverRewardWithFeedback(rewardCount) {
    const pumpDuration = params.PumpDuration || 100;
    
    console.log("Delivering " + rewardCount + " rewards");
    
    for (let i = 0; i < rewardCount; i++) {
        console.log("Reward " + (i + 1) + " of " + rewardCount);
        
        // Tone first (CS)
        await playSingleRewardSound();
        
        // Then pump (US)
        if (ble.connected) {
            await writepumpdurationtoBLE(pumpDuration);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log("Reward delivery complete");
}

// ========================================
// TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Trial ${currentTrial + 1} (Block ${currentBlock}, Trial ${trialWithinBlock + 1})`);
    
    // Get trial pair
    const trialPair = trialOrder[trialWithinBlock];
    
    // Present two choices
    const response = await presentTwoChoices(trialPair.stimulus1, trialPair.stimulus2);
    
    // Process response
    if (response.correct) {
        console.log('Correct! Chose higher value:', response.chosenValue);
        await deliverRewardWithFeedback(response.chosenValue);
    } else if (response.timeout) {
        console.log('Timeout - no response');
    } else {
        console.log('Incorrect. Chose:', response.chosenValue, 'instead of:', response.otherValue);
        // Optional: still deliver reward for chosen value, or no reward
        // await deliverRewardWithFeedback(response.chosenValue);
    }
    
    // Save trial data
    experimentData.push({
        trial: currentTrial + 1,
        block: currentBlock,
        trialWithinBlock: trialWithinBlock + 1,
        leftStimulus: response.leftStimulus.path,
        rightStimulus: response.rightStimulus.path,
        leftValue: getRewardValue(response.leftStimulus.path),
        rightValue: getRewardValue(response.rightStimulus.path),
        choice: response.choice,
        chosenValue: response.chosenValue,
        correct: response.correct,
        timeout: response.timeout || false,
        rewardDelivered: response.correct ? response.chosenValue : 0,
        timestamp: new Date().toISOString()
    });
    
    // Save every 10 trials
    if ((currentTrial + 1) % 10 === 0) {
        await saveDataToDropbox();
    }
    
    // Inter-trial interval
    await new Promise(resolve => setTimeout(resolve, params.InterTrialInterval || 1000));
    
    currentTrial++;
    trialWithinBlock++;
    
    // Check if block complete
    if (trialWithinBlock >= totalTrials) {
        console.log(`Block ${currentBlock} complete. Reshuffling...`);
        trialOrder = shuffleArray(trialOrder);
        trialWithinBlock = 0;
        currentBlock++;
    }
    
    // Continue
    runTrial();
}

// ========================================
// EXPERIMENT CONTROL
// ========================================

async function startExperiment() {
    console.log('Starting Choice Experiment...');
    
    // Check subject selection
    const subjectSelect = document.getElementById('subject-select');
    subjectName = subjectSelect.value;
    
    if (!subjectName) {
        alert('Please select a subject first!');
        return;
    }
    
    // Load parameters
    const paramsLoaded = await loadSubjectParameters(subjectName);
    if (!paramsLoaded) {
        alert('Failed to load subject parameters.');
        return;
    }
    
    // Initialize audio
    initializeAudio();
    
    // Load assets
    await loadAssetsFromDropbox();
    
    console.log(`Experiment ready: ${totalTrials} trial pairs per block`);
    
    // Hide instructions, show experiment
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    document.body.classList.add('experiment-running');
    
    // Start
    runTrial();
}

async function endExperiment() {
    console.log('Experiment complete!');
    await saveDataToDropbox();
    document.body.classList.remove('experiment-running');
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
}
