# Risk Learning Experiment

A web-based behavioral experiment platform for studying risk preferences and decision-making. Built on the MKTurk framework with Bluetooth Low Energy (BLE) pump control for liquid reward delivery.

## 📁 Project Organization

### File Structure
```bash
risk-learning-experiment/          # GitHub Repository (Root)
├── index.html                     # Main entry point with UI
├── experiment_detection.js        # Single stimulus detection task
├── experiment_choice.js           # Two-choice comparison (Sure vs Sure)
├── experiment_gamble_vs_sure.js   # Gamble vs Sure choice task
├── experiment_gamble_vs_gamble.js # Gamble vs Gamble choice task
├── mkturk_bluetooth.js            # BLE pump control functions
├── mkturk_dropbox.js              # Dropbox API functions
├── mkturk_installsettings.js      # Dropbox client ID configuration
├── mkturk_globalvariables.js      # Global variables
├── mkturk_utils.js                # Utility functions
├── mkturk_ImageBuffer.js          # Image loading utilities
├── mkturk.html                    # Original MKTurk interface
└── README.md                      # This file

/mkturkfolders/                    # Dropbox (Shared Resources)
├── /imagebags/
│   ├── /sure_options/             # Sure stimulus images (Sure1.png - Sure7.png)
│   └── /gamble_options/           # Gamble stimulus images (Gamble7v1pw75.png, etc.)
├── /sounds/
│   └── au0.wav                    # Reward feedback tone
├── /parameterfiles/
│   └── /subjects/                 # Subject-specific parameter files
│       ├── RiskLearningSubject_params.txt
│       └── NewSubject_params.txt
└── /datafiles/
├── /RiskLearningSubject/      # Data files for each subject
└── /NewSubject/
```

### Hosting Setup

- **GitHub Pages**: Hosts the HTML and JavaScript files
- **Dropbox**: Stores stimuli, sounds, parameters, and data files
- **BLE Device**: Arduino-based pump controller for liquid rewards

---

## 🧪 Experiment Types

### 1. Detection Task (`experiment_detection.js`)
- **Description**: Single stimulus appears at random position (left, right, or center)
- **Correct Response**: Tap the stimulus
- **Incorrect Response**: Tap elsewhere or timeout
- **Reward**: Value corresponding to the stimulus shown

### 2. Choice Task - Sure vs Sure (`experiment_choice.js`)
- **Description**: Two sure stimuli appear simultaneously (left and right)
- **Response**: Choose either stimulus
- **Reward**: Value of chosen stimulus
- **Data Tracked**: Whether choice was optimal (higher value)

### 3. Gamble vs Sure (`experiment_gamble_vs_sure.js`)
- **Description**: One gamble and one sure stimulus appear simultaneously
- **Response**: Choose either stimulus
- **Reward**: 
  - Sure: Fixed value
  - Gamble: Probabilistic outcome (win or lose amount)

### 4. Gamble vs Gamble (`experiment_gamble_vs_gamble.js`)
- **Description**: Two gamble stimuli appear simultaneously
- **Response**: Choose either gamble
- **Reward**: Probabilistic outcome of chosen gamble

### 5. Sure vs Gamble vs Gamble (`experiment_suree_vs_2gambles.js`)
- **Description**: Two gamble and one sure stimuli appear simultaneously
- **Response**: Choose either gamble or sure
- **Reward**: Probabilistic outcome of chosen gamble

### 6. Gamble vs Gamble vs Gamble (`experiment_3gambles.js`)
- **Description**: Three gamble stimuli appear simultaneously
- **Response**: Choose either gamble
- **Reward**: Probabilistic outcome of chosen gamble

---

## 🎰 Stimulus Naming Conventions

### Sure Stimuli

Sure1.png  → Reward value: 1
Sure2.png  → Reward value: 2
...
Sure7.png  → Reward value: 7

### Gamble Stimuli

Gamble[WIN]v[LOSE]pw[PROBABILITY].png

Examples:
Gamble7v1pw75.png  → Win: 7, Lose: 1, P(win): 75%
Gamble5v2pw50.png  → Win: 5, Lose: 2, P(win): 50%
Gamble6v0pw25.png  → Win: 6, Lose: 0, P(win): 25%

---

## ⚙️ Setup Process

### 1. Dropbox Setup

1. **Create Dropbox App**:
   - Go to [Dropbox Developers](https://www.dropbox.com/developers/apps)
   - Create a new app with "Full Dropbox" access
   - Note your `App Key` (Client ID)

2. **Configure Redirect URI**:
   - In your Dropbox app settings, add redirect URI:
   `https://[your-github-username].github.io/risk-learning-experiment/index.html`

3. **Update `mkturk_installsettings.js`**:
   ```javascript
   var DBX_CLIENT_ID = "your_app_key_here"
   var DBX_REDIRECT_URI_ROOT = "https://[your-github-username].github.io/risk-learning-experiment/"

4. **Create Dropbox Folder Structure:
```bash
/mkturkfolders/imagebags/sure_options/ (Add Sure1.png through Sure7.png)
/mkturkfolders/imagebags/gamble_options/ (Add gamble images)
/mkturkfolders/sounds/ (Add au0.wav)
/mkturkfolders/parameterfiles/subjects/ (Subject parameter files)
/mkturkfolders/datafiles/[SubjectName]/ (One folder per subject)
```
### 2. GitHub Pages Setup
1. **Fork or Clone Repository

2. **Enable GitHub Pages:
- Go to repository Settings → Pages
- Source: Deploy from branch
- Branch: main, / (root)
- Access Experiment
  https://[your-github-username].github.io/risk-learning-experiment/index.html

### 3. Subject Parameter File Setup
Create a parameter file for each subject in Dropbox:
/mkturkfolders/parameterfiles/subjects/[SubjectName]_params.txt

Example content:
```javascript
{
    "Weight": 75,
    "Species": "human",
    "PumpDuration": 100,
    "ChoiceTimeOut": 10000,
    "PunishTimeOut": 3000,
    "InterTrialInterval": 1000
}
```

### 4. Adding New Subjects
Create parameter file: /mkturkfolders/parameterfiles/subjects/NewSubject_params.txt
Create data folder: /mkturkfolders/datafiles/NewSubject/
Add to dropdown in index.html: <option value="NewSubject">NewSubject</option>

### 🔵 BLE Pump Controller Setup
Hardware Requirements
- Adafruit Feather 32u4 Bluefruit LE (or compatible BLE board)
- Liquid pump/solenoid
- Power supply for pump
- Arduino Setup

#### Install Arduino IDE

- Add Adafruit Board Package:

-- File → Preferences → Additional Board Manager URLs: https://adafruit.github.io/arduino-board-index/package_adafruit_index.json

#### Install Libraries:

- Sketch → Include Library → Manage Libraries
- Search and install: "Adafruit BluefruitLE nRF51"
- Upload Sketch:

See arduino/mkturk_pump_feather.ino (save the working sketch)
Select Board: Arduino Uno (or appropriate board)
Upload
BLE Service Configuration
Service UUID: 0xA000
Characteristic UUID: 0xA002 (Pump duration, write)
Adding New BLE Devices
Add to dropdown in index.html: <option value="NewDevice">NewDevice</option>
Device name must start with "BLENano_" prefix (or update filter in mkturk_bluetooth.js)

### 🚀 Running an Experiment
- Open the experiment URL in Chrome browser
- Authorize Dropbox (first time or after token expires)
- Select Experiment Type from dropdown
- Select Subject from dropdown
- Connect Bluetooth (if using pump):
- Click "Connect Bluetooth"
- Select your BLE device from popup
- Wait for "Connected!" status
- Test Pump (optional): Click "Test Pump" to verify connection
- Start Experiment: Click "Start Experiment" - screen turns black, stimuli appear
- Data Saving:
- Auto-saves every 10 trials
- Final save on experiment end
- Files saved to: /mkturkfolders/datafiles/[Subject]/

## 🔧 Troubleshooting
Dropbox Token Expired
Error: 401 Unauthorized
Solution: Click "Clear Dropbox Token" button and refresh page, or use incognito mode.

### BLE Device Not Found
#### Solutions:

- Ensure device is powered on
- Check device name matches dropdown selection
- Try "Other (scan all)" option
- Ensure Bluetooth is enabled on computer/tablet
- Experiment Script Not Loading
- Error: 404 Not Found
- Solution: Verify the experiment .js file exists in repository and is committed.

#### No Pump Response
Solutions:

- Check Arduino Serial Monitor for connection messages
- Verify BLE shows "Connected!" in browser
- Test with "Test Pump" button
- Check pump wiring and power
  
## 📊 Data Output Format
Data files are saved as JSON with the following structure:

```javascript 
{
    "experimentInfo": {
        "experimentType": "detection",
        "subject": "SubjectName",
        "parameters": { ... },
        "startTime": "2025-12-25T...",
        "endTime": "2025-12-25T...",
        "totalTrials": 100,
        "totalBlocks": 2,
        "version": "40"
    },
    "trials": [
        {
            "trial": 1,
            "block": 1,
            "stimulus": "/mkturkfolders/imagebags/sure_options/sure3.png",
            "position": "left",
            "correct": true,
            "rewardDelivered": 3,
            "timestamp": "2025-12-25T..."
        }
    ]
}
```

### 📝 Version History
- v40 - Added multiple experiment types, subject selection, dynamic script loading
- v38 - Added BLE pump control, Pavlovian CS-US ordering
- v34 - Basic detection task with Dropbox integration

🙏 Acknowledgments

Built on the MKTurk framework by DiCarlo Lab.










  
