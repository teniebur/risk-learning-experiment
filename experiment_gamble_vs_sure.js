// ========================================
// GAMBLE VS SURE EXPERIMENT
// Subject chooses between a gamble and a sure stimulus
// ========================================

console.log("EXPERIMENT_GAMBLE_VS_SURE.JS LOADED - VERSION 42 - " + new Date());

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
    
    // Each gamble is paired with each sure stimulus
    for (let g = 0; g < loadedImages.gamble.length; g++) {
        for (let s = 0; s < loadedImages.sure.length; s++) {
            trialOrder.push({
                gambleStimulus: loadedImages.gamble[g],
                sureStimulus: loadedImages.sure[s]
            });
        }
    }
    
    // Shuffle pairs
    trialOrder = shuffleArray(trialOrder);
    totalTrials = trialOrder.length;
    
    console.log("Generated " + totalTrials + " trial pairs (gamble vs sure)");
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
        saveDataLocally(subjectName, "gamble_vs_sure", params, experimentData, currentTrial, currentBlock);
        return;
    }
    
    try {
        const subject = subjectName || "UnknownSubject";
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/${subject}/${subject}_gamble_vs_sure_${timestamp}.json`;
        
        const dataToSave = {
            experimentInfo: {
                experimentType: "gamble_vs_sure",
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
        saveDataLocally(subjectName, "gamble_vs_sure", params, experimentData, currentTrial, currentBlock);
    }
}

// ========================================
// TWO-CHOICE PRESENTATION
// ========================================

async function presentGambleVsSure(gambleStimulus, sureStimulus) {
    return new Promise((resolve) => {
        clearDisplay();
        
        // Randomly assign left/right positions
        const gambleOnLeft = Math.random() > 0.5;
        const leftStimulus = gambleOnLeft ? gambleStimulus : sureStimulus;
        const rightStimulus = gambleOnLeft ? sureStimulus : gambleStimulus;
        
        // Show both stimuli
        const leftElement = showStimulus(leftStimulus.image, 'left');
        const rightElement = showStimulus(rightStimulus.image, 'right');
        
        let responseMade = false;
        
        // Left stimulus clicked
        const handleLeftClick = (event) => {
            event.stopPropagation();
            if (!responseMade) {
                responseMade = true;
                cleanup();
                resolve({
                    choice: 'left',
                    chosenStimulus: leftStimulus,
                    chosenType: leftStimulus.type,
                    gambleStimulus: gambleStimulus,
                    sureStimulus: sureStimulus,
                    gambleOnLeft: gambleOnLeft
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
                    chosenType: rightStimulus.type,
                    gambleStimulus: gambleStimulus,
                    sureStimulus: sureStimulus,
                    gambleOnLeft: gambleOnLeft
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
                    chosenType: null,
                    timeout: true,
                    gambleStimulus: gambleStimulus,
                    sureStimulus: sureStimulus,
                    gambleOnLeft: gambleOnLeft
                });
            }
        }, params.ChoiceTimeOut || 10000);
    });
}

// ========================================
// TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Trial ${currentTrial + 1} (Block ${currentBlock}, Trial ${trialWithinBlock + 1})`);
    
    // Get trial pair
    const trialPair = trialOrder[trialWithinBlock];
    
    // Present gamble vs sure
    const response = await presentGambleVsSure(trialPair.gambleStimulus, trialPair.sureStimulus);
    
    let rewardAmount = 0;
    let gambleOutcome = null;
    let sureValue = getSureRewardValue(trialPair.sureStimulus.path);
    
    // Process response
    if (response.timeout) {
        console.log('Timeout - no response');
    } else {
        // Determine reward based on choice
        if (response.chosenType === 'gamble') {
            // Chose gamble - determine outcome
            gambleOutcome = getGambleOutcome(response.chosenStimulus.path);
            rewardAmount = gambleOutcome.rewardAmount;
            console.log('Chose GAMBLE:', gambleOutcome.outcome, '=', rewardAmount);
        } else {
            // Chose sure
            rewardAmount = sureValue;
            console.log('Chose SURE:', rewardAmount);
        }
        
        // Deliver reward
        const choicePosition = response.choice;
        await showOutcomeAndDeliverReward(rewardAmount, choicePosition, loadedImages, params, ble);
    }
    
    // Parse gamble info for data saving
    const gambleInfo = getGambleInfo(trialPair.gambleStimulus.path);
    
    // Save trial data
    experimentData.push({
        trial: currentTrial + 1,
        block: currentBlock,
        trialWithinBlock: trialWithinBlock + 1,
        gambleStimulus: trialPair.gambleStimulus.path,
        sureStimulus: trialPair.sureStimulus.path,
        gambleWinAmount: gambleInfo.winAmount,
        gambleLoseAmount: gambleInfo.loseAmount,
        gambleWinProbability: gambleInfo.winProbability,
        sureValue: sureValue,
        gambleOnLeft: response.gambleOnLeft,
        choice: response.choice,
        chosenType: response.chosenType,
        gambleOutcome: response.chosenType === 'gamble' ? gambleOutcome?.outcome : null,
        rewardDelivered: rewardAmount,
        timeout: response.timeout || false,
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
    console.log('Starting Gamble vs Sure Experiment...');
    
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
    const fullscreenPromise = elem.requestFullscreen ? elem.requestFullscreen() 
        : elem.webkitRequestFullscreen ? elem.webkitRequestFullscreen()
        : elem.msRequestFullscreen ? elem.msRequestFullscreen()
        : Promise.reject('Fullscreen not supported');

    fullscreenPromise.catch(err => {
        console.error('Fullscreen error:', err);
    });
    
    // Start
    runTrial();
}

async function endExperiment() {
    console.log('Experiment complete!');
    await saveDataToDropbox();
    document.body.classList.remove('experiment-running');
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
    
    exitFullscreen();
}
