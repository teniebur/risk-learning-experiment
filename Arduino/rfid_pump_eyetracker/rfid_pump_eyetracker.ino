/*
 * MKTurk Pump Controller - RedBear BLE Nano v2 (nRF52832)
 * 
 * Service UUID: 0xA000
 * Characteristics:
 *   0xA001 - Connection/ping (write)
 *   0xA002 - Pump duration (write) - triggers pump
 *   0xA003 - Pump notification (notify)
 *   0xA004 - RFID (notify) - placeholder
 */

#include <BLEPeripheral.h>

// ============== CONFIGURATION ==============
#define DEVICE_NAME       "BLENano_Bo"
#define PUMP_PIN          D2    // Change to your pump pin

// ============== BLE SETUP ==============
BLEPeripheral blePeripheral;

// Custom service
BLEService pumpService("A000");

// Characteristics
BLECharacteristic connChar("A001", BLEWrite | BLEWriteWithoutResponse, 2);
BLECharacteristic pumpDurChar("A002", BLEWrite | BLEWriteWithoutResponse, 2);
BLECharacteristic pumpNotifyChar("A003", BLERead | BLENotify, 4);
BLECharacteristic rfidChar("A004", BLERead | BLENotify, 13);

// ============== VARIABLES ==============
volatile uint16_t pumpDuration = 0;
volatile bool pumpTriggered = false;
unsigned long pumpStartTime = 0;
bool pumpRunning = false;

// ============== SETUP ==============
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("MKTurk Pump Controller - BLE Nano v2");
    Serial.println("------------------------------------");
    
    // Setup pump pin
    pinMode(PUMP_PIN, OUTPUT);
    digitalWrite(PUMP_PIN, LOW);
    
    // Test pump on startup
    Serial.println("Testing pump pin...");
    digitalWrite(PUMP_PIN, HIGH);
    delay(100);
    digitalWrite(PUMP_PIN, LOW);
    Serial.println("Pump test complete");
    
    // Setup BLE
    setupBLE();
    
    Serial.println("Setup complete! Waiting for connection...");
}

// ============== BLE SETUP ==============
void setupBLE() {
    // Set device name
    blePeripheral.setLocalName(DEVICE_NAME);
    blePeripheral.setDeviceName(DEVICE_NAME);
    
    // Set advertised service
    blePeripheral.setAdvertisedServiceUuid(pumpService.uuid());
    
    // Add service and characteristics
    blePeripheral.addAttribute(pumpService);
    blePeripheral.addAttribute(connChar);
    blePeripheral.addAttribute(pumpDurChar);
    blePeripheral.addAttribute(pumpNotifyChar);
    blePeripheral.addAttribute(rfidChar);
    
    // Set event handlers
    blePeripheral.setEventHandler(BLEConnected, onConnect);
    blePeripheral.setEventHandler(BLEDisconnected, onDisconnect);
    
    // Set characteristic event handlers
    connChar.setEventHandler(BLEWritten, onConnCharWritten);
    pumpDurChar.setEventHandler(BLEWritten, onPumpDurCharWritten);
    
    // Begin
    blePeripheral.begin();
    
    Serial.println("BLE initialized");
    Serial.print("Device name: ");
    Serial.println(DEVICE_NAME);
}

// ============== BLE EVENT HANDLERS ==============
void onConnect(BLECentral& central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());
}

void onDisconnect(BLECentral& central) {
    Serial.print("Disconnected from: ");
    Serial.println(central.address());
    
    // Turn off pump if running
    digitalWrite(PUMP_PIN, LOW);
    pumpRunning = false;
}

void onConnCharWritten(BLECentral& central, BLECharacteristic& characteristic) {
    // Connection/ping received
    const uint8_t* data = characteristic.value();
    uint16_t len = characteristic.valueLength();
    
    if (len >= 2) {
        uint16_t value = data[0] | (data[1] << 8);
        Serial.print("Ping received: ");
        Serial.println(value);
    }
}

void onPumpDurCharWritten(BLECentral& central, BLECharacteristic& characteristic) {
    // Pump duration received
    const uint8_t* data = characteristic.value();
    uint16_t len = characteristic.valueLength();
    
    if (len >= 2) {
        pumpDuration = data[0] | (data[1] << 8);
        
        Serial.print("Pump command: ");
        Serial.print(pumpDuration);
        Serial.println(" ms");
        
        if (pumpDuration > 0) {
            pumpTriggered = true;
        }
    }
}

// ============== MAIN LOOP ==============
void loop() {
    // Poll BLE events
    blePeripheral.poll();
    
    // Handle pump trigger
    if (pumpTriggered) {
        pumpTriggered = false;
        pumpStartTime = millis();
        pumpRunning = true;
        digitalWrite(PUMP_PIN, HIGH);
        Serial.println("PUMP ON!");
        
        // Send notification
        uint32_t notifyVal = pumpDuration;
        pumpNotifyChar.setValue((uint8_t*)&notifyVal, 4);
    }
    
    // Handle pump timing
    if (pumpRunning) {
        if (millis() - pumpStartTime >= pumpDuration) {
            digitalWrite(PUMP_PIN, LOW);
            pumpRunning = false;
            Serial.println("PUMP OFF");
        }
    }
}