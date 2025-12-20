console.log("EXPERIMENT.JS LOADED - VERSION 3 - " + new Date());
// ========================================
// RISK LEARNING EXPERIMENT - MAIN SCRIPT
// ========================================

// Global variables
let currentTrial = 0;
let totalTrials = 100;
let experimentData = [];
let params = {};

// ========================================
// 1. LOAD PARAMETERS AND INITIALIZE
// ========================================

// Load your parameter file
async function loadParameters() {
    try {
        const response = await fetch('parameterfiles/RiskLearningSubject_params.txt');
        const text = await response.text();
        params = JSON.parse(text);
        console.log('Parameters loaded:', params);
    } catch (error) {
        console.error('Error loading parameters:', error);
        console.log('Make sure the file is at: mkturkfolders/parameterfiles/RiskLearningSubject_params.txt');
    }
}

// ========================================
// 2. REWARD FEEDBACK SYSTEM
// ========================================

class RewardFeedback {
    constructor() {
        this.rewardSound = new Audio('sounds/au0.wav');
        this.rewardSound.preload = 'auto';
    }
    
    async playRewardFeedback(nRewards) {
        console.log(`Playing reward sound ${nRewards} times`);
        
        for (let i = 0; i < nRewards; i++) {
            try {
                // Reset sound to beginning
                this.rewardSound.currentTime = 0;
                
                // Play sound
                await this.rewardSound.play();
                
                // Wait 200ms between sounds
                await this.sleep(200);
                
            } catch (error) {
                console.error('Error playing sound:', error);
            }
        }
    }
    
    determineRewardCount(chosenStimulus) {
        // Map your sure stimuli to reward counts
        const sureValues = {
            'Sure1.png': 1,
            'Sure2.png': 2,
            'Sure3.png': 3,
            'Sure4.png': 4,
            'Sure5.png': 5,
            'Sure6.png': 6,
            'Sure7.png': 7
        };
        
        return sureValues[chosenStimulus] || 0;
    }
    
    // Helper function for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ========================================
// 3. STIMULUS DISPLAY FUNCTIONS
// ========================================

function createStimulusElement(imagePath, position) {
    const img = document.createElement('img');
    img.src = imagePath;
    img.className = 'stimulus';
    img.style.position = 'absolute';
    img.style.width = '150px';  // Adjust size as needed
    img.style.height = '150px';
    img.style.cursor = 'pointer';
    
    // Position based on your grid indices [3, 23]
    if (position === 'left') {
        img.style.left = '25%';
        img.style.top = '50%';
    } else if (position === 'right') {
        img.style.left = '75%';
        img.style.top = '50%';
    } else if (position === 'center') {
        img.style.left = '50%';
        img.style.top = '50%';
    }
    
    // Center the image on its position
    img.style.transform = 'translate(-50%, -50%)';
    
    return img;
}

function showStimulus(imagePath, position) {
    const stimulus = createStimulusElement(imagePath, position);
    document.getElementById('experiment-container').appendChild(stimulus);
    return stimulus;
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

async function presentSingleStimulus(stimulusPath) {
    return new Promise((resolve) => {
        // Clear display
        clearDisplay();
        
        // Randomly choose left or right position
        const position = Math.random() > 0.5 ? 'left' : 'right';
        
        // Show single stimulus
        const stimulus = showStimulus(stimulusPath, position);
        
        let responseMade = false;
        let correct = false;
        
        // Correct response: click on the stimulus
        const handleStimulusClick = (event) => {
            event.stopPropagation(); // Prevent background click
            if (!responseMade) {
                responseMade = true;
                correct = true;
                hideStimulus(stimulus);
                resolve({ correct: true, position: position });
            }
        };
        
        // Incorrect response: click anywhere else on screen
        const handleBackgroundClick = () => {
            if (!responseMade) {
                responseMade = true;
                correct = false;
                hideStimulus(stimulus);
                resolve({ correct: false, position: position });
            }
        };
        
        // Add click handlers
        stimulus.addEventListener('click', handleStimulusClick);
        document.getElementById('experiment-container').addEventListener('click', handleBackgroundClick);
        
        // Timeout (also incorrect)
        setTimeout(() => {
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                document.getElementById('experiment-container').removeEventListener('click', handleBackgroundClick);
                resolve({ correct: false, position: position, timeout: true });
            }
        }, params.ChoiceTimeOut || 10000);
    });
}
// ========================================
// 5. POSITION RANDOMIZATION
// ========================================

function randomizePositions() {
    const positions = ['left', 'right'];
    
    // Simple shuffle
    if (Math.random() > 0.5) {
        positions.reverse();
    }
    
    return {
        surePosition: positions[0],
        gamblePosition: positions[1]
    };
}

// ========================================
// 6. TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Starting trial ${currentTrial + 1}`);
    
    // Select a single stimulus (sure option for reward feedback)
    const stimulus = 'imagebags/sure_options/sure_2_tokens.png';
    
    // Present single stimulus
    const response = await presentSingleStimulus(stimulus);
    
    // Process response
    if (response.correct) {
        console.log('Correct response!');
        
        // Play reward feedback for correct responses
        const rewardCount = rewardSystem.determineRewardCount(stimulus);
        if (rewardCount > 0) {
            await rewardSystem.playRewardFeedback(rewardCount);
        }
    } else {
        console.log('Incorrect response or timeout');
        // No reward feedback for incorrect responses
    }
    
    // Save trial data
    experimentData.push({
        trial: currentTrial + 1,
        stimulus: stimulus,
        position: response.position,
        correct: response.correct,
        timeout: response.timeout || false,
        rewardCount: response.correct ? rewardSystem.determineRewardCount(stimulus) : 0,
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
// 7. EXPERIMENT CONTROL
// ========================================

// Initialize reward system
const rewardSystem = new RewardFeedback();

async function startExperiment() {
    console.log('Starting experiment...');
    
    // Load parameters
    await loadParameters();
    
    // Show instructions
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    
    // Start first trial
    runTrial();
}

function endExperiment() {
    console.log('Experiment complete!');
    console.log('Data:', experimentData);
    
    // Hide experiment, show completion message
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
    
    // You can send data to server here
    // sendDataToServer(experimentData);
}

// ========================================
// 8. PAGE LOAD INITIALIZATION
// ========================================

window.addEventListener('load', function() {
    console.log('Page loaded, experiment ready');
    
    // Add start button handler
    document.getElementById('start-button').addEventListener('click', startExperiment);
});
