// resources:
// API - https://webbluetoothcg.github.io/web-bluetooth/
// Samples - https://googlechrome.github.io/samples/web-bluetooth/index.html
// MDN - https://developer.mozilla.org/en-US/docs/Web/API/BluetoothDevice/gatt
// Playbulb - https://googlecodelabs.github.io/candle-bluetooth/
// Implementation status - https://github.com/WebBluetoothCG/web-bluetooth/blob/gh-pages/implementation-status.md#chrome


//Performing operations that require explicit user interaction on touchstart events is deprecated
// and will be removed in M54, around October 2016.
// See https://www.chromestatus.com/features/5649871251963904 for more details.

//----retry on disconnect
//---ble status write
//---detect multiple ble devices
//---ble opt out

//================ INITIALIZE BLE VARIABLE ================//
var ble = {
  name: "BLENano_Bo",
  namePrefix: "BLENano_",
  serviceUUID: 0xFFFF,
  customserviceUUID: 0xA000,
  pumpWriteUUID: 0xA001,  // This is the only characteristic on your device

  device: [],
  server: [],
  service: [],
  pumpWriteCharacteristic: [],  // For writing pump commands
  connected: false,
  ping_duration: 200,
  ping_interval: 5000,
  statustext: "",
}
//================ INITIALIZE BLE VARIABLE (end) ================//

// Convert number to 2-byte array (Int16)
function toBytesInt16(num) {
    var arr = new Uint8Array(2);
    arr[0] = num & 0xFF;        // Low byte
    arr[1] = (num >> 8) & 0xFF; // High byte
    return arr;
}

//==================== CONNECT BLE ====================//
function connectBLEButtonPromise(){
  var resolveFunc
  var errFunc
  p = new Promise(function(resolve,reject){
    resolveFunc = resolve;
    errFunc = reject;
  }).then(function(resolveval){console.log('User clicked ' + resolveval)});

  function *waitforclickGenerator(){
    var buttonclicked =[-1];
    while (true){
      buttonclicked = yield buttonclicked;
      resolveFunc(buttonclicked);
    }
  }

  waitforClick = waitforclickGenerator(); // start async function
  waitforClick.next(); //move out of default state
  return p;
}

function skipBLEDevice(event){
  event.preventDefault(); //prevents additional downstream call of click listener
  waitforClick.next(1)
}

async function findBLEDevice(event){
  console.log('=== findBLEDevice() STARTED ===');
  event.preventDefault();
  try{
    console.log('About to call requestBLEDevice()');
    await requestBLEDevice()
    console.log('requestBLEDevice() completed, now calling connectBLEDeviceAndCacheCharacteristics()');
    await connectBLEDeviceAndCacheCharacteristics()
    waitforClick.next(1)    
  }
  catch(error){
    console.log('=== CAUGHT ERROR IN findBLEDevice ===');
    // Add detailed error logging here too
    console.log('findBLEDevice error:', error);
    console.log('findBLEDevice error name:', error.name);
    console.log('findBLEDevice error message:', error.message);
    
    if (ble.connected == false){
      var textstr = 'Error getting ble device/service/characteristic';
      console.log(textstr)
      ble.statustext = ble.statustext + "<br>" + textstr
      updateStatusText()
    }
  }
}

// Step 1: Manually select device -- returns a promise
// Step 1: Manually select device -- returns a promise
async function requestBLEDevice(){
    let result = Promise.resolve();
    
    if (ble.connected == false){
        console.log('Requesting ble device...');
        
        // Get selected device name from dropdown (if exists)
        let selectedDevice = document.getElementById('ble-device-select');
        let deviceName = selectedDevice ? selectedDevice.value : 'BLENano_';
        
        let options;
        
        if (deviceName === 'other') {
            // Scan for all BLE devices
            options = {
                acceptAllDevices: true,
                optionalServices: [ble.customserviceUUID]
            };
        } else {
            // Filter by device name prefix
            options = {
                filters: [{namePrefix: deviceName}],
                optionalServices: [ble.customserviceUUID]
            };
        }
        
        console.log('Requesting device with options:', options);
        
        try {
            device = await navigator.bluetooth.requestDevice(options);
            console.log("Found a device:", device);
            console.log("Device name:", device.name);
            
            var textstr = "Found device: " + device.name + "<br>ID: " + device.id;
            ble.statustext = textstr;
            updateBLEStatus(textstr);
            
            ble.device = device;
            ble.device.addEventListener('gattserverdisconnected', onDisconnectedBLE);
            
        } catch(error) {
            console.log('Bluetooth error:', error);
            console.log('Error name:', error.name);
            console.log('Error message:', error.message);
            
            if (ble.connected == false){
                var textstr = 'Waiting for user to select device';
                console.log(textstr);
                ble.statustext = textstr;
                updateBLEStatus(textstr);
                return error;
            }
        }
    }
    return result;
}

// Helper function to update BLE status on page
function updateBLEStatus(message) {
    let statusElement = document.getElementById('ble-status');
    if (statusElement) {
        statusElement.innerHTML = message;
        statusElement.style.color = ble.connected ? 'green' : 'orange';
    }
    // Also try the original function if it exists
    if (typeof updateStatusText === 'function') {
        updateStatusText();
    }
}

// Step 2: Connect server & Cache characteristics -- returns a promise
async function connectBLEDeviceAndCacheCharacteristics(){
    if (!ble.device || !ble.device.gatt) {
        console.error('No BLE device found. Cannot connect.');
        throw new Error('No BLE device selected');
    }
    
    console.log('Connecting to GATT Server...');
    
    try {
        server = await ble.device.gatt.connect();
        console.log("Connected to GATT server");
        ble.server = server;
        
        // Get our service
        console.log("Getting service...");
        service = await server.getPrimaryService(ble.customserviceUUID);
        console.log("Found service!");
        ble.service = service;
        
        // Get the pump write characteristic
        console.log("Getting pump characteristic...");
        ble.pumpWriteCharacteristic = await service.getCharacteristic(ble.pumpWriteUUID);
        console.log("Found pump characteristic!");
        
        ble.connected = true;
        ble.device.addEventListener('gattserverdisconnected', onDisconnectedBLE);
        
        updateBLEStatus('Connected!');
        console.log("BLE fully connected and ready!");
        
    } catch (error) {
        console.error('Error: ' + error.message);
        ble.connected = false;
        updateBLEStatus('Failed: ' + error.message);
        throw error;
    }
}
//==================== CONNECT BLE (end) ====================//

// Trigger pump for reward delivery
async function triggerPump(duration) {
    if (!ble.connected || !ble.pumpWriteCharacteristic) {
        console.error('BLE not connected');
        return false;
    }
    
    try {
        // Convert duration to bytes (adjust based on your device protocol)
        // Common formats: single byte, or 2-byte little-endian
        const data = new Uint8Array([duration & 0xFF]);
        
        console.log("Triggering pump with duration: " + duration);
        await ble.pumpWriteCharacteristic.writeValueWithoutResponse(data);
        console.log("Pump triggered!");
        return true;
        
    } catch (error) {
        console.error('Error triggering pump: ' + error.message);
        return false;
    }
}

// Deliver reward (call this from experiment)
// Deliver reward (call this from experiment)
async function deliverReward(rewardCount) {
    console.log("deliverReward called with count: " + rewardCount);
    
    if (!ble.connected) {
        console.log('BLE not connected - skipping pump');
        return;
    }
    
    console.log("Delivering " + rewardCount + " rewards via pump");
    
    for (let i = 0; i < rewardCount; i++) {
        console.log("Triggering pump " + (i + 1) + " of " + rewardCount);
        await writepumpdurationtoBLE(100);  // 100ms pump duration
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log("Reward delivery complete");
}

//==================== RECONNECT BLE ====================//
// adapted from: https://googlechrome.github.io/samples/web-bluetooth/automatic-reconnect.html

function onDisconnectedBLE(){
  ble.connected = false
  var textstr = 'BLE disconnected'
  console.log(textstr)
  ble.statustext = textstr
  updateHeadsUpDisplay()

  reconnectBLE()
}

async function reconnectBLE(){
  exponentialBackoff(100 /* max retries */, 2 /* seconds delay */,
    async function toTry() {
      time('Connecting to Bluetooth Device... ');
      var textstr = 'Attempting to reconnect to BLE...'
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()

      await connectBLEDeviceAndCacheCharacteristics()
    },
    function success() {
      console.log('> Bluetooth Device reconnected. Try disconnect it now.');
      var textstr = 'Successful reconnection!'
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()
    },
    function fail() {
      time('Failed to reconnect.');
      var textstr = 'Could not reconnect to Bluetooth Device after multipe tries'
      console.log(textstr)
      ble.statustext = textstr
      updateHeadsUpDisplay()
    });
}

// This function keeps calling "toTry" until promise resolves or has
// retried "max" number of times. First retry has a delay of "delay" seconds.
// "success" is called upon success.
async function exponentialBackoff(max, delay, toTry, success, fail) {
  try {
    const result = await toTry();
    success(result);
  } catch(error) {
    if (max === 0) {
      return fail();
    }
    time('Retrying in ' + delay + 's... (' + max + ' tries left)');
    setTimeout(function() {
      exponentialBackoff(--max, delay * 2, toTry, success, fail);
    }, delay * 1000);
  }
}

function time(text) {
  console.log('[' + new Date().toJSON().substr(11, 8) + '] ' + text);
}
//==================== RECONNECT BLE (end) ====================//

//============== READ NOTIFICATIONS & WRITES ==============//
async function writepumpdurationtoBLE(num) {
    console.log("writepumpdurationtoBLE called with: " + num);
    
    if (!ble.connected) {
        console.error('BLE not connected');
        return false;
    }
    
    if (!ble.pumpWriteCharacteristic) {
        console.error('Pump characteristic not found');
        return false;
    }
    
    var arrInt8 = toBytesInt16(num);
    console.log("Sending bytes: " + arrInt8[0] + ", " + arrInt8[1]);
    
    try {
        await ble.pumpWriteCharacteristic.writeValue(arrInt8);
        console.log('Wrote pump value: ' + num);
        return true;
    } catch(error) {
        console.error('Could not write pump duration: ' + error.message);
        return false;
    }
}

function onPumpNotificationFromBLE(event){
  ble.tnotify_pump=performance.now()
  var textstr = 'BLE read notification << ' +
          Math.round(ble.tnotify_pump - ble.twrite_pumpduration) + 'ms'
  console.log(textstr)
  ble.statustext = ble.statustext + "  <---->  " + textstr
  updateHeadsUpDisplay()
  // updateStatusText()
  // writeTextonBlankCanvas(textstr,400,20.5)

  let value = event.target.value
  value = value.buffer ? value : new DataView(value)
  let a = []
  for (var i = 0; i < value.byteLength; i++){
      a.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
    }
    console.log('Received ble notification value << ' + a.join(' '))
}

function onRFIDNotificationFromBLE(event){
  var t0 = ble.tnotify_rfid
  ble.tnotify_rfid = performance.now()

  let value = event.target.value
  value = value.buffer ? value : new DataView(value)
  let a = []
  for (var i = 0; i < value.byteLength; i++){
      a.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
    }
    console.log('Received ble notification value << ' + a.join(' '))

    var textstr = 'BLE RFID notification:  value << ' + a.join(' ') + '  interval << ' + Math.round(ble.tnotify_rfid - t0) + 'ms'
    ble.statustext = textstr
    updateHeadsUpDisplay()
}
//============== READ NOTIFICATIONS & WRITES (end) ==============//
