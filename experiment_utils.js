// ========================================
// SHARED EXPERIMENT UTILITIES
// Common functions used by all experiments
// ========================================

console.log("EXPERIMENT_UTILS.JS LOADED - VERSION 42 - " + new Date());

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
    img.style.zIndex = '10';
    img.style.WebkitTapHighlightColor = 'transparent';
    img.style.outline = 'none';
    
    if (position === 'left') {
        img.style.left = '20%';
    } else if (position === 'right') {
        img.style.left = '80%';
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
// REWARD DELIVERY FUNCTIONS
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

async function showOutcomeAndDeliverReward(rewardCount, position, loadedImages, params, ble) {
    // Immediately hide all stimuli
    const container = document.getElementById('experiment-container');
    const stimuli = container.querySelectorAll('.stimulus');
    
    stimuli.forEach(stimulus => {
        stimulus.style.display = 'none';
    });
    
    // Wait to avoid flash
    await new Promise(resolve => setTimeout(resolve, 200));
    
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
        
        await playSingleRewardSound();
        
        if (ble.connected) {
            await writepumpdurationtoBLE(pumpDuration);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (outcomeStimulus) {
        hideStimulus(outcomeStimulus);
    }
}

// ========================================
// GAMBLE OUTCOME FUNCTIONS
// ========================================

function getGambleOutcome(imagePath) {
    const filename = imagePath.split('/').pop().toLowerCase();
    const match = filename.match(/gamble(\d+)v(\d+)pw(\d+)\.png/);
    
    if (match) {
        const winAmount = parseInt(match[1]);
        const loseAmount = parseInt(match[2]);
        const winProbability = parseInt(match[3]) / 100;
        
        const isWin = Math.random() < winProbability;
        const rewardAmount = isWin ? winAmount : loseAmount;
        
        return {
            winAmount: winAmount,
            loseAmount: loseAmount,
            winProbability: winProbability,
            outcome: isWin ? 'win' : 'lose',
            rewardAmount: rewardAmount
        };
    }
    
    return { winAmount: 0, loseAmount: 0, winProbability: 0, outcome: 'unknown', rewardAmount: 0 };
}

function getGambleInfo(imagePath) {
    const filename = imagePath.split('/').pop().toLowerCase();
    const match = filename.match(/gamble(\d+)v(\d+)pw(\d+)\.png/);
    
    if (match) {
        return {
            winAmount: parseInt(match[1]),
            loseAmount: parseInt(match[2]),
            winProbability: parseInt(match[3]) / 100
        };
    }
    return { winAmount: 0, loseAmount: 0, winProbability: 0 };
}

// ========================================
// SURE STIMULUS FUNCTIONS
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
// ARRAY UTILITIES
// ========================================

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ========================================
// FULLSCREEN UTILITIES
// ========================================

function exitFullscreen() {
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
// DATA SAVING UTILITIES
// ========================================

function saveDataLocally(subject, experimentType, params, experimentData, currentTrial, currentBlock) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const localKey = `experiment_data_${subject}_${timestamp}`;
        
        const dataToSave = {
            experimentInfo: {
                experimentType: experimentType,
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
