// ========================================
// RISK LEARNING EXPERIMENT - MAIN SCRIPT
// ========================================

console.log("EXPERIMENT_DETECTION.JS LOADED - VERSION 42 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 0;  // Will be set after loading images
let experimentData = [];
let params = {};           // Subject parameters
let subjectName = "";      // Current subject name
let loadedImages = { sure: [], gamble: [] };  // Array of {image: Image, path: string, type: 'sure'|'gamble'}
let trialOrder = [];    // Randomized order of stimulus indices
let currentBlock = 1;      // ADD THIS
let trialWithinBlock = 0;  // ADD THIS

// ========================================
// 1. LOAD ASSETS FROM DROPBOX
// ========================================
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
                console.log("After loading - Sure:", loadedImages.sure.length, "Gamble:", loadedImages.gamble.length);
                console.log("Loaded from cache successfully");
                generateTrialOrder();  // Add this line
                // Detection task doesn't need trial order generation
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

        // Generate trial order
        generateTrialOrder();
        
        await loadRewardSound();
        
    } catch (error) {
        console.error("Error loading assets:", error);
        alert("Failed to load assets. Check internet connection.");
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
    console.log("Current subjectName:", subjectName);  // ADD THIS LINE
    try {
        // Use selected subject name
        const subject = subjectName || "UnknownSubject";
        console.log("Using subject:", subject);  // ADD THIS LINE
        // Create filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/${subject}/${subject}_${timestamp}.json`;
        
        console.log("Saving to filename:", filename);
        
        // Prepare data object
        const dataToSave = {
            experimentInfo: {
                subject: subject,
                parameters: params,
                startTime: experimentData[0]?.timestamp || now.toISOString(),
                endTime: now.toISOString(),
                totalTrials: currentTrial,
                totalBlocks: currentBlock,
                version: "38"
            },
            trials: experimentData
        };
        
        // Convert to JSON string
        const dataString = JSON.stringify(dataToSave, null, 2);
        
        // Upload to Dropbox
        const response = await dbx.filesUpload({
            path: filename,
            contents: dataString,
            mode: { '.tag': 'overwrite' }
        });
        
        console.log("SUCCESS! Data saved to Dropbox:", response);
        
    } catch (error) {
        console.error("ERROR saving data to Dropbox:", error);
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

function determineRewardCount(imagePath, stimulusType) {
    // Extract filename from path (lowercase for matching)
    const filename = imagePath.split('/').pop().toLowerCase();
    
    if (stimulusType === 'sure') {
        // Sure options: Sure1.png, Sure2.png, etc.
        // Extract number from filename
        const sureValues = {
            'sure1.png': 1,
            'sure2.png': 2,
            'sure3.png': 3,
            'sure4.png': 4,
            'sure5.png': 5,
            'sure6.png': 6,
            'sure7.png': 7
        };
        return {
            rewardCount: sureValues[filename] || 1,
            outcome: 'sure',
            winAmount: null,
            loseAmount: null,
            probability: null
        };
        
    } else if (stimulusType === 'gamble') {
        // Gamble options: Gamble7v1pw75.png
        // Format: Gamble[WIN]v[LOSE]pw[PROBABILITY].png
        // Example: Gamble7v1pw75.png = win 7, lose 1, 75% chance of win
        
        const gambleMatch = filename.match(/gamble(\d+)v(\d+)pw(\d+)\.png/);
        
        if (gambleMatch) {
            const winAmount = parseInt(gambleMatch[1]);
            const loseAmount = parseInt(gambleMatch[2]);
            const winProbability = parseInt(gambleMatch[3]) / 100;
            
            // Randomly determine outcome based on probability
            const randomValue = Math.random();
            const isWin = randomValue < winProbability;
            const rewardCount = isWin ? winAmount : loseAmount;
            
            console.log(`Gamble: ${winAmount} vs ${loseAmount}, P(win)=${winProbability}, Random=${randomValue.toFixed(3)}, Result=${isWin ? 'WIN' : 'LOSE'}, Reward=${rewardCount}`);
            
            return {
                rewardCount: rewardCount,
                outcome: isWin ? 'win' : 'lose',
                winAmount: winAmount,
                loseAmount: loseAmount,
                probability: winProbability
            };
        } else {
            console.warn("Could not parse gamble filename:", filename);
            return {
                rewardCount: 1,
                outcome: 'unknown',
                winAmount: null,
                loseAmount: null,
                probability: null
            };
        }
    }
    
    return {
        rewardCount: 1,
        outcome: 'unknown',
        winAmount: null,
        loseAmount: null,
        probability: null
    };
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
// 6. OUTCOME REVEAL
// ========================================

async function showOutcome(rewardCount, position) {
    // Clear display for 100ms
    clearDisplay();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find the corresponding sure stimulus image
    const sureFilename = `sure${rewardCount}.png`;
    const sureStimulus = loadedImages.find(img => 
        img.path.toLowerCase().endsWith(sureFilename)
    );
    
    if (sureStimulus) {
        // Show the sure stimulus at the same position
        const outcomeStimulus = showStimulus(sureStimulus.image, position);
        
        // Display outcome for 500ms (adjust as needed)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Hide outcome stimulus
        hideStimulus(outcomeStimulus);
    } else {
        console.warn(`Could not find sure stimulus for reward count: ${rewardCount}`);
    }
}

// ========================================
// GENERATE TRIAL ORDER
// ========================================

function generateTrialOrder() {
    // Create array of indices for all loaded images
    const totalImages = loadedImages.sure.length + loadedImages.gamble.length;
     console.log("Total images available:", totalImages);
    console.log("Sure images:", loadedImages.sure.length);
    console.log("Gamble images:", loadedImages.gamble.length);
    
    trialOrder = shuffleArray([...Array(totalImages).keys()]);
    totalTrials = trialOrder.length;
    
    console.log("Generated trial order with " + totalTrials + " stimuli");
    console.log("Trial order:", trialOrder);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Get stimulus by index
function getStimulusAtIndex(index) {
    const allStimuli = [...loadedImages.sure, ...loadedImages.gamble];
    return allStimuli[index];
}

// ========================================
// 7. TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Starting trial ${currentTrial + 1} (Block ${currentBlock}, Trial ${trialWithinBlock + 1} of ${totalTrials})`);
    
    const stimulusIndex = trialOrder[trialWithinBlock];
    const stimulusData = getStimulusAtIndex(stimulusIndex);
    
    console.log(`Presenting: ${stimulusData.path} (${stimulusData.type})`);
    
    const response = await presentSingleStimulus(
        stimulusData.image, 
        stimulusData.path, 
        stimulusData.type
    );
    
    console.log("DEBUG 1: Response received:", response);
    
    let rewardResult = { rewardCount: 0, outcome: 'none' };
    
    if (response.correct) {
        console.log('DEBUG 2: Correct response!');
        
        console.log('DEBUG 3: Calling determineRewardCount...');
        rewardResult = determineRewardCount(stimulusData.path, stimulusData.type);
        console.log('DEBUG 4: Reward result:', rewardResult);
        
        console.log('DEBUG 5: Calling showOutcomeAndDeliverReward...');
        await showOutcomeAndDeliverReward(rewardResult.rewardCount, response.position);
        console.log('DEBUG 6: showOutcomeAndDeliverReward complete');
    } else {
        console.log('Incorrect response or timeout');
    }
    
    console.log('DEBUG 7: Saving trial data...');
    
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
        rewardCount: rewardResult.rewardCount,
        gambleOutcome: rewardResult.outcome,
        gambleWinAmount: rewardResult.winAmount,
        gambleLoseAmount: rewardResult.loseAmount,
        gambleProbability: rewardResult.probability,
        timestamp: new Date().toISOString()
    });
    
    console.log('DEBUG 8: Trial data saved');
    
    if ((currentTrial + 1) % 10 === 0) {
        console.log("DEBUG 9: Triggering backup save at trial", currentTrial + 1);
        await saveDataToDropbox();
        console.log("DEBUG 10: Backup save complete");
    }
    
    console.log('DEBUG 11: Inter-trial interval...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('DEBUG 12: Inter-trial interval complete');
    
    currentTrial++;
    trialWithinBlock++;
    
    if (trialWithinBlock >= totalTrials) {
        console.log(`Block ${currentBlock} complete. Reshuffling...`);
        const totalImages = loadedImages.sure.length + loadedImages.gamble.length;
        trialOrder = shuffleArray([...Array(totalImages).keys()]);
        console.log("Reshuffled trial order for block", currentBlock + 1);
        trialWithinBlock = 0;
        currentBlock++;
    }
    
    console.log('DEBUG 13: Calling runTrial recursively...');
    runTrial();
}

// ========================================
// 8. EXPERIMENT CONTROL
// ========================================

async function startExperiment() {
    console.log('Starting experiment...');
    
    // Check if subject is selected
    const subjectSelect = document.getElementById('subject-select');
    subjectName = subjectSelect.value;
    
    if (!subjectName) {
        alert('Please select a subject first!');
        return;
    }
    
    // Load subject parameters
    const paramsLoaded = await loadSubjectParameters(subjectName);
    if (!paramsLoaded) {
        alert('Failed to load subject parameters. Check console for details.');
        return;
    }
    
    // Initialize audio context (requires user interaction)
    initializeAudio();
    
    // Load assets from Dropbox
    await loadAssetsFromDropbox();
    
    console.log(`Experiment will have ${totalTrials} stimuli per block`);
    
    // Hide instructions, show experiment
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    
    // Add black background class to body
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
    console.log('Data:', experimentData);
    // Save final data to Dropbox
    console.log("Saving final data...");
    await saveDataToDropbox();
    
    // Remove black background class
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

// ========================================
// 9. BLUETOOTH CONNECTION
// ========================================

async function connectBluetooth() {
    console.log('Connect Bluetooth button clicked');
    
    try {
        console.log('Requesting BLE device...');
        await requestBLEDevice();
        
        console.log('Connecting to device...');
        await connectBLEDeviceAndCacheCharacteristics();
        
        document.getElementById('ble-status').innerHTML = 'Connected!';
        document.getElementById('ble-status').style.color = 'green';
        console.log('BLE connected successfully');
        
    } catch (error) {
        console.error('BLE connection error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        document.getElementById('ble-status').innerHTML = 'Connection failed: ' + (error.message || 'Unknown error');
        document.getElementById('ble-status').style.color = 'red';
    }
}

// ========================================
// COMBINED OUTCOME AND REWARD DELIVERY
// ========================================

async function showOutcomeAndDeliverReward(rewardCount, position) {
    try {
        console.log("DEBUG OUTCOME: Starting showOutcomeAndDeliverReward with rewardCount:", rewardCount);
        console.log("DEBUG OUTCOME: Position:", position);
        console.log("DEBUG OUTCOME: loadedImages:", loadedImages);
        
        // Clear display for 100ms
        console.log("DEBUG OUTCOME: Clearing display");
        clearDisplay();
        console.log("DEBUG OUTCOME: Waiting 100ms");
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log("DEBUG OUTCOME: Wait complete");
        
        // Find the corresponding sure stimulus image
        const sureFilename = `sure${rewardCount}.png`;
        console.log("DEBUG OUTCOME: Looking for:", sureFilename);
        
        const sureStimulus = loadedImages.sure.find(img => 
            img.path.toLowerCase().endsWith(sureFilename)
        );
        
        console.log("DEBUG OUTCOME: Found stimulus:", sureStimulus ? sureStimulus.path : "NOT FOUND");
        
        let outcomeStimulus = null;
        
        if (sureStimulus) {
            outcomeStimulus = showStimulus(sureStimulus.image, position);
            console.log("DEBUG OUTCOME: Showing outcome stimulus");
        } else {
            console.log("DEBUG OUTCOME: No outcome stimulus found for reward count", rewardCount);
        }
        
        // Get pump duration from params (default 100ms)
        const pumpDuration = params.PumpDuration || 100;
        console.log("DEBUG OUTCOME: Pump duration:", pumpDuration);
        
        // Deliver rewards with sound
        console.log("Delivering " + rewardCount + " rewards");
        
        for (let i = 0; i < rewardCount; i++) {
            console.log("Reward " + (i + 1) + " of " + rewardCount);
            
            // Play sound first (CS)
            await playSingleRewardSound();
            console.log("DEBUG OUTCOME: Sound played");
            
            // Then trigger pump (US)
            if (ble.connected) {
                console.log("DEBUG OUTCOME: BLE connected, triggering pump");
                await writepumpdurationtoBLE(pumpDuration);
            } else {
                console.log("DEBUG OUTCOME: BLE not connected, skipping pump");
            }
            
            // Wait between rewards
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log("DEBUG OUTCOME: Reward delivery complete");
        
        // Hide outcome stimulus
        if (outcomeStimulus) {
            hideStimulus(outcomeStimulus);
            console.log("DEBUG OUTCOME: Outcome stimulus hidden");
        }
        
        console.log("DEBUG OUTCOME: showOutcomeAndDeliverReward complete");
        
    } catch (error) {
        console.error("ERROR in showOutcomeAndDeliverReward:", error);
        console.error("Error stack:", error.stack);
    }
}

// Play a single reward sound
async function playSingleRewardSound() {
    try {
        if (sounds && sounds.buffer && sounds.buffer[0]) {
            var source = audiocontext.createBufferSource();
            source.buffer = sounds.buffer[0];
            source.connect(audiocontext.destination);
            source.start(0);
            
            // Wait for sound to finish
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}
// Add event listener for BLE button
document.getElementById('connect-ble-button').addEventListener('click', connectBluetooth);

// ========================================
// 10. PAGE LOAD INITIALIZATION
// ========================================

window.addEventListener('load', function() {
    console.log('Page loaded, experiment ready');
    document.getElementById('start-button').addEventListener('click', startExperiment);
});
