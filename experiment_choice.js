// ========================================
// CHOICE EXPERIMENT - TWO STIMULUS COMPARISON
// Subject chooses between 2 sure stimuli
// ========================================

console.log("EXPERIMENT_CHOICE.JS LOADED - VERSION 42 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 0;
let experimentData = [];
let params = {};
let subjectName = "";
let loadedImages = { sure: [], gamble: [] };
let trialOrder = [];
let currentBlock = 1;
let trialWithinBlock = 0;

// ========================================
// TRIAL ORDER GENERATION
// ========================================

function generateTrialOrder() {
    trialOrder = shuffleArray(trialOrder);
    totalTrials = trialOrder.length;
    console.log("Generated trial order with " + totalTrials + " trials");
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

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
    console.log("Loading assets...");
    
    try {
        // Try to load from cache first
        if (!isOnline) {
            console.log("Offline mode - loading from cache");
            const cachedSure = getCachedImages(CACHE_KEYS.SURE_IMAGES);
            const cachedGamble = getCachedImages(CACHE_KEYS.GAMBLE_IMAGES);
            
            if (cachedSure && cachedGamble) {
                loadedImages.sure = cachedSure;
                loadedImages.gamble = cachedGamble;
                console.log("Loaded from cache successfully");
                generateTrialCombinations();
                return;
            } else {
                alert("No cached data available. Please connect to internet first.");
                return;
            }
        }
        
        // Online - load from Dropbox and cache
        const sureImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/sure_options");
        console.log("Sure options found:", sureImagePaths.length);
        
        for (const path of sureImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.sure.push({
                image: image,
                path: path,
                type: 'sure'
            });
        }
        
        const gambleImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/gamble_options");
        console.log("Gamble options found:", gambleImagePaths.length);
        
        for (const path of gambleImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.gamble.push({
                image: image,
                path: path,
                type: 'gamble'
            });
        }
        
        console.log("Total images loaded:", loadedImages.sure.length + loadedImages.gamble.length);
        
        // Cache the images
        cacheImages(CACHE_KEYS.SURE_IMAGES, loadedImages.sure);
        cacheImages(CACHE_KEYS.GAMBLE_IMAGES, loadedImages.gamble);
        
        generateTrialCombinations();
        await loadRewardSound();
        
    } catch (error) {
        console.error("Error loading assets:", error);
        alert("Failed to load assets. Check internet connection.");
    }
}

// ========================================
// GENERATE TRIAL PAIRS
// ========================================

function generateTrialCombinations() {
    trialOrder = [];
    
    // Create all unique pairs of sure stimuli
    for (let i = 0; i < loadedImages.sure.length; i++) {
        for (let j = i + 1; j < loadedImages.sure.length; j++) {
            trialOrder.push({
                stimulus1: loadedImages.sure[i],
                stimulus2: loadedImages.sure[j]
            });
        }
    }
    
    // Shuffle pairs
    generateTrialOrder();
    
    console.log("Generated " + totalTrials + " trial pairs");
}

// ========================================
// LOAD SUBJECT PARAMETERS
// ========================================

async function loadSubjectParameters(subject) {
    console.log("Loading parameters for subject: " + subject);
    
    try {
        // Try cache first
        if (!isOnline) {
            console.log("Offline - loading parameters from cache");
            const cached = getCachedParameters(subject);
            if (cached) {
                params = cached;
                console.log("Parameters loaded from cache");
                document.getElementById('subject-status').innerHTML = 'Parameters (cached)';
                document.getElementById('subject-status').style.color = 'orange';
                return true;
            } else {
                alert("No cached parameters for this subject. Please connect to internet first.");
                return false;
            }
        }
        
        // Online - load from Dropbox
        const paramPath = `/mkturkfolders/parameterfiles/subjects/${subject}_params.txt`;
        const response = await dbx.filesDownload({ path: paramPath });
        const blob = response.result.fileBlob;
        const text = await blob.text();
        params = JSON.parse(text);
        
        // Cache parameters
        cacheParameters(subject, params);
        
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
    console.log("Attempting to save data...");
    
    // If offline, save to local storage instead
    if (!isOnline) {
        console.log("Offline - saving to local storage");
        saveDataLocally();
        return;
    }
    
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
                version: "42"
            },
            trials: experimentData
        };
        
        const dataString = JSON.stringify(dataToSave, null, 2);
        
        const response = await dbx.filesUpload({
            path: filename,
            contents: dataString,
            mode: { '.tag': 'overwrite' }
        });
        
        console.log("Data saved to Dropbox:", filename);
        
    } catch (error) {
        console.error("Error saving to Dropbox:", error);
        console.log("Falling back to local storage");
        saveDataLocally();
    }
}

function saveDataLocally() {
    try {
        const subject = subjectName || "UnknownSubject";
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const localKey = `experiment_data_${subject}_${timestamp}`;
        
        const dataToSave = {
            experimentInfo: {
                experimentType: "choice",
                subject: subject,
                parameters: params,
                startTime: experimentData[0]?.timestamp || new Date().toISOString(),
                endTime: new Date().toISOString(),
                totalTrials: currentTrial,
                totalBlocks: currentBlock,
                version: "42",
                savedLocally: true
            },
            trials: experimentData
        };
        
        localStorage.setItem(localKey, JSON.stringify(dataToSave));
        console.log("Data saved locally:", localKey);
        
    } catch (error) {
        console.error("Error saving data locally:", error);
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
// GET REWARD VALUES
// ========================================

function getSureRewardValue(imagePath) {
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
        const leftValue = getSureRewardValue(leftStimulus.path);
        const rightValue = getSureRewardValue(rightStimulus.path);
        
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
                    optimalChoice: leftValue > rightValue,
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
                    optimalChoice: rightValue > leftValue,
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
                    optimalChoice: false,
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

async function showOutcomeAndDeliverReward(rewardCount, position) {
    clearDisplay();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const sureFilename = `sure${rewardCount}.png`;
    const sureStimulus = loadedImages.sure.find(img => 
        img.path.toLowerCase().endsWith(sureFilename)
    );
    
    let outcomeStimulus = null;
    
    if (sureStimulus) {
        outcomeStimulus = showStimulus(sureStimulus.image, position);
    }
    
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
    
    // Hide outcome stimulus
    if (outcomeStimulus) {
        hideStimulus(outcomeStimulus);
    }
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
    if (response.timeout) {
        console.log('Timeout - no response');
    } else {
        // Always deliver reward for chosen stimulus (whether optimal or not)
        console.log('Chose:', response.chosenValue, '| Optimal:', response.optimalChoice ? 'Yes' : 'No');
        await showOutcomeAndDeliverReward(response.chosenValue, response.choice);
    }
    
    // Save trial data
    experimentData.push({
        trial: currentTrial + 1,
        block: currentBlock,
        trialWithinBlock: trialWithinBlock + 1,
        leftStimulus: response.leftStimulus.path,
        rightStimulus: response.rightStimulus.path,
        leftValue: getSureRewardValue(response.leftStimulus.path),
        rightValue: getSureRewardValue(response.rightStimulus.path),
        choice: response.choice,
        chosenValue: response.chosenValue,
        optimalChoice: response.optimalChoice,
        timeout: response.timeout || false,
        rewardDelivered: response.timeout ? 0 : response.chosenValue,
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
        trialOrder = shuffleArray([...trialOrder]);
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
    
    // Enter fullscreen automatically
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
    
    // Start first trial (or runTrial() depending on your code)
    runTrial();
}

async function endExperiment() {
    console.log('Experiment complete!');
    await saveDataToDropbox();
    document.body.classList.remove('experiment-running');
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
    
    // Exit fullscreen
    if (document.fullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}
