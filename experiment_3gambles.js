// ========================================
// 3 GAMBLES EXPERIMENT
// Subject chooses between 3 gamble stimuli
// ========================================

console.log("EXPERIMENT_3GAMBLES.JS LOADED - VERSION 42 - " + new Date());

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
// GENERATE TRIAL COMBINATIONS
// ========================================

function generateTrialCombinations() {
    trialOrder = [];
    
    // All unique combinations of 3 gambles
    for (let g1 = 0; g1 < loadedImages.gamble.length; g1++) {
        for (let g2 = g1 + 1; g2 < loadedImages.gamble.length; g2++) {
            for (let g3 = g2 + 1; g3 < loadedImages.gamble.length; g3++) {
                trialOrder.push({
                    gamble1Stimulus: loadedImages.gamble[g1],
                    gamble2Stimulus: loadedImages.gamble[g2],
                    gamble3Stimulus: loadedImages.gamble[g3]
                });
            }
        }
    }
    
    // Shuffle
    trialOrder = shuffleArray(trialOrder);
    totalTrials = trialOrder.length;
    
    console.log("Generated " + totalTrials + " trial combinations (3 gambles)");
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
        saveDataLocally(subjectName, "3gambles", params, experimentData, currentTrial, currentBlock);
        return;
    }
    
    try {
        const subject = subjectName || "UnknownSubject";
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/${subject}/${subject}_3gambles_${timestamp}.json`;
        
        const dataToSave = {
            experimentInfo: {
                experimentType: "3gambles",
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
        saveDataLocally(subjectName, "3gambles", params, experimentData, currentTrial, currentBlock);
    }
}

// ========================================
// THREE-CHOICE PRESENTATION
// ========================================

async function presentThreeGambles(gamble1Stimulus, gamble2Stimulus, gamble3Stimulus) {
    return new Promise((resolve) => {
        clearDisplay();
        
        // Randomize positions
        const stimuli = [
            { stimulus: gamble1Stimulus, type: 'gamble1' },
            { stimulus: gamble2Stimulus, type: 'gamble2' },
            { stimulus: gamble3Stimulus, type: 'gamble3' }
        ];
        const positions = ['left', 'center', 'right'];
        
        // Shuffle positions
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // Assign positions
        const positionMap = {};
        stimuli.forEach((s, i) => {
            s.position = positions[i];
            positionMap[positions[i]] = s;
        });
        
        // Show all three stimuli
        const elements = {};
        stimuli.forEach(s => {
            elements[s.position] = showStimulus(s.stimulus.image, s.position);
        });
        
        let responseMade = false;
        
        const handleClick = (position) => {
            return (event) => {
                event.stopPropagation();
                if (!responseMade) {
                    responseMade = true;
                    cleanup();
                    
                    const chosen = positionMap[position];
                    resolve({
                        choice: position,
                        chosenStimulus: chosen.stimulus,
                        chosenType: chosen.type,
                        gamble1Stimulus: gamble1Stimulus,
                        gamble2Stimulus: gamble2Stimulus,
                        gamble3Stimulus: gamble3Stimulus,
                        positionMap: positionMap
                    });
                }
            };
        };
        
        const cleanup = () => {
            Object.values(elements).forEach(el => hideStimulus(el));
        };
        
        // Add click handlers
        elements['left'].addEventListener('click', handleClick('left'));
        elements['center'].addEventListener('click', handleClick('center'));
        elements['right'].addEventListener('click', handleClick('right'));
        
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
                    gamble1Stimulus: gamble1Stimulus,
                    gamble2Stimulus: gamble2Stimulus,
                    gamble3Stimulus: gamble3Stimulus,
                    positionMap: positionMap
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
    
    const trialData = trialOrder[trialWithinBlock];
    
    const response = await presentThreeGambles(
        trialData.gamble1Stimulus,
        trialData.gamble2Stimulus,
        trialData.gamble3Stimulus
    );
    
    let rewardAmount = 0;
    let gambleOutcome = null;
    
    if (response.timeout) {
        console.log('Timeout - no response');
    } else {
        gambleOutcome = getGambleOutcome(response.chosenStimulus.path);
        rewardAmount = gambleOutcome.rewardAmount;
        console.log('Chose GAMBLE:', gambleOutcome.outcome, '=', rewardAmount);
        
        await showOutcomeAndDeliverReward(rewardAmount, response.choice, loadedImages, params, ble);
    }
    
    const gamble1Info = getGambleInfo(trialData.gamble1Stimulus.path);
    const gamble2Info = getGambleInfo(trialData.gamble2Stimulus.path);
    const gamble3Info = getGambleInfo(trialData.gamble3Stimulus.path);
    
    experimentData.push({
        trial: currentTrial + 1,
        block: currentBlock,
        trialWithinBlock: trialWithinBlock + 1,
        gamble1Stimulus: trialData.gamble1Stimulus.path,
        gamble2Stimulus: trialData.gamble2Stimulus.path,
        gamble3Stimulus: trialData.gamble3Stimulus.path,
        gamble1WinAmount: gamble1Info.winAmount,
        gamble1LoseAmount: gamble1Info.loseAmount,
        gamble1WinProbability: gamble1Info.winProbability,
        gamble2WinAmount: gamble2Info.winAmount,
        gamble2LoseAmount: gamble2Info.loseAmount,
        gamble2WinProbability: gamble2Info.winProbability,
        gamble3WinAmount: gamble3Info.winAmount,
        gamble3LoseAmount: gamble3Info.loseAmount,
        gamble3WinProbability: gamble3Info.winProbability,
        gamble1Position: Object.keys(response.positionMap).find(k => response.positionMap[k].type === 'gamble1'),
        gamble2Position: Object.keys(response.positionMap).find(k => response.positionMap[k].type === 'gamble2'),
        gamble3Position: Object.keys(response.positionMap).find(k => response.positionMap[k].type === 'gamble3'),
        choice: response.choice,
        chosenGamble: response.chosenStimulus?.path || null,
        gambleOutcome: gambleOutcome?.outcome || null,
        rewardDelivered: rewardAmount,
        timeout: response.timeout || false,
        timestamp: new Date().toISOString()
    });
    
    if ((currentTrial + 1) % 10 === 0) {
        await saveDataToDropbox();
    }
    
    await new Promise(resolve => setTimeout(resolve, params.InterTrialInterval || 1000));
    
    currentTrial++;
    trialWithinBlock++;
    
    if (trialWithinBlock >= totalTrials) {
        console.log(`Block ${currentBlock} complete. Reshuffling...`);
        trialOrder = shuffleArray([...trialOrder]);
        trialWithinBlock = 0;
        currentBlock++;
    }
    
    runTrial();
}

// ========================================
// EXPERIMENT CONTROL
// ========================================

async function startExperiment() {
    console.log('Starting 3 Gambles Experiment...');
    
    const subjectSelect = document.getElementById('subject-select');
    subjectName = subjectSelect.value;
    
    if (!subjectName) {
        alert('Please select a subject first!');
        return;
    }
    
    const paramsLoaded = await loadSubjectParameters(subjectName);
    if (!paramsLoaded) {
        alert('Failed to load subject parameters.');
        return;
    }
    
    initializeAudio();
    
    await loadAssetsFromDropbox();
    
    console.log(`Experiment ready: ${totalTrials} trial combinations per block`);
    
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
    
    runTrial();
}

async function endExperiment() {
    console.log('Experiment complete!');
    await saveDataToDropbox();
    document.body.classList.remove('experiment-running');
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
    
    // Exit fullscreen
    exitFullscreen();
}
