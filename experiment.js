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
            'sure_1_token.png': 1,
            'sure_2_tokens.png': 2,
            'sure_3_tokens.png': 3,
            'sure_4_tokens.png': 4
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
// 4. CHOICE PRESENTATION (ONE AT A TIME)
// ========================================

async function presentChoicesSequential(choice1Path, choice2Path) {
    return new Promise((resolve) => {
        let selectedChoice = null;
        
        // Clear display
        clearDisplay();
        
        // Show first choice in center
        const firstStimulus = showStimulus(choice1Path, 'center');
        
        // Add click handler for first choice
        const handleFirstClick = () => {
            selectedChoice = choice1Path;
            hideStimulus(firstStimulus);
            showSecondChoice();
        };
        
        firstStimulus.addEventListener('click', handleFirstClick);
        
        // Show second choice after first is clicked or timeout
        const showSecondChoice = () => {
            // Remove first choice click handler
            firstStimulus.removeEventListener('click', handleFirstClick);
            
            // Show second choice
            const secondStimulus = showStimulus(choice2Path, 'center');
            
            // Add click handler for second choice
            const handleSecondClick = () => {
                selectedChoice = choice2Path;
                hideStimulus(secondStimulus);
                resolve(selectedChoice);
            };
            
            secondStimulus.addEventListener('click', handleSecondClick);
            
            // Timeout for second choice
            setTimeout(() => {
                if (!selectedChoice) {
                    hideStimulus(secondStimulus);
                    resolve(null); // No choice made
                }
            }, params.ChoiceTimeOut || 10000);
        };
        
        // Timeout for first choice
        setTimeout(() => {
            if (!selectedChoice) {
                hideStimulus(firstStimulus);
                showSecondChoice();
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
    
    // Get random stimuli (you'll need to implement stimulus selection)
    const sureOption = 'imagebags/sure_options/Sure2.png';
    const gambleOption = 'imagebags/gamble_options/Gamble7v1pw10.png';
    
    // Randomize which appears first
    const showSureFirst = Math.random() > 0.5;
    const firstChoice = showSureFirst ? sureOption : gambleOption;
    const secondChoice = showSureFirst ? gambleOption : sureOption;
    
    // Present choices sequentially
    const selectedChoice = await presentChoicesSequential(firstChoice, secondChoice);
    
    // Process the choice
    if (selectedChoice) {
        console.log('Choice made:', selectedChoice);
        
        // Play reward feedback if sure option chosen
        const rewardCount = rewardSystem.determineRewardCount(selectedChoice);
        if (rewardCount > 0) {
            await rewardSystem.playRewardFeedback(rewardCount);
        }
        
        // Save trial data
        experimentData.push({
            trial: currentTrial + 1,
            sureOption: sureOption,
            gambleOption: gambleOption,
            choice: selectedChoice,
            rewardCount: rewardCount,
            timestamp: new Date().toISOString()
        });
    } else {
        console.log('No choice made (timeout)');
    }
    
    // Inter-trial interval
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    currentTrial++;
    
    // Continue or end experiment
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
