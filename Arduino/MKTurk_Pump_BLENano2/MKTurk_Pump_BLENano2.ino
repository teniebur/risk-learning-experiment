/*
 * MKTurk Pump Controller - RedBear BLE Nano v2
 * 
 * Service UUID: 0xA000
 * Characteristics:
 *   0xA001 - Connection/ping (write)
 *   0xA002 - Pump duration (write) - triggers pump
 *   0xA003 - Pump notification (notify)
 *   0xA004 - RFID (notify) - placeholder
 */

#include <nRF5x_BLE_API.h>

// ============== CONFIGURATION ==============
#define DEVICE_NAME       "BLENano_Bo"
#define PUMP_PIN          P0_4    // Change to your pump pin

// ============== BLE UUIDs ==============
UUID serviceUUID(0xA000);
UUID connUUID(0xA001);
UUID pumpDurUUID(0xA002);
UUID pumpNotifyUUID(0xA003);
UUID rfidUUID(0xA004);

// ============== BLE OBJECTS ==============
BLE ble;

// Characteristic values
uint8_t connValue[2] = {0, 0};
uint8_t pumpDurValue[2] = {0, 0};
uint8_t pumpNotifyValue[4] = {0, 0, 0, 0};
uint8_t rfidValue[13] = {0};

// Characteristic properties
GattCharacteristic connChar(connUUID, connValue, sizeof(connValue), sizeof(connValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE_WITHOUT_RESPONSE);

GattCharacteristic pumpDurChar(pumpDurUUID, pumpDurValue, sizeof(pumpDurValue), sizeof(pumpDurValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_WRITE_WITHOUT_RESPONSE);

GattCharacteristic pumpNotifyChar(pumpNotifyUUID, pumpNotifyValue, sizeof(pumpNotifyValue), sizeof(pumpNotifyValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_READ | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_NOTIFY);

GattCharacteristic rfidChar(rfidUUID, rfidValue, sizeof(rfidValue), sizeof(rfidValue),
    GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_READ | GattCharacteristic::BLE_GATT_CHAR_PROPERTIES_NOTIFY);

// Service
GattCharacteristic *allChars[] = {&connChar, &pumpDurChar, &pumpNotifyChar, &rfidChar};
GattService pumpService(serviceUUID, allChars, sizeof(allChars) / sizeof(GattCharacteristic*));

// ============== VARIABLES ==============
volatile uint16_t pumpDuration = 0;
volatile bool pumpTriggered = false;
unsigned long pumpStartTime = 0;
bool pumpRunning = false;

// ============== CALLBACKS ==============
void onDisconnect(const Gap::DisconnectionCallbackParams_t *params) {
    Serial.println("Disconnected!");
    // Turn off pump
    digitalWrite(PUMP_PIN, LOW);
    pumpRunning = false;
    // Restart advertising
    ble.gap().startAdvertising();
}

void onConnect(const Gap::ConnectionCallbackParams_t *params) {
    Serial.println("Connected!");
}

void onDataWritten(const GattWriteCallbackParams *params) {
    // Check which characteristic was written
    if (params->handle == connChar.getValueHandle()) {
        // Connection/ping received
        uint16_t value = params->data[0] | (params->data[1] << 8);
        Serial.print("Ping: ");
        Serial.println(value);
    }
    else if (params->handle == pumpDurChar.getValueHandle()) {
        // Pump duration received
        pumpDuration = params->data[0] | (params->data[1] << 8);
        Serial.print("Pump command: ");
        Serial.print(pumpDuration);
        Serial.println(" ms");
        
        if (pumpDuration > 0) {
            pumpTriggered = true;
        }
    }
}

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
    
    // Initialize BLE
    Serial.println("Initializing BLE...");
    ble.init();
    
    // Set callbacks
    ble.gap().onConnection(onConnect);
    ble.gap().onDisconnection(onDisconnect);
    ble.gattServer().onDataWritten(onDataWritten);
    
    // Add service
    ble.gattServer().addService(pumpService);
    
    // Setup advertising
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::BREDR_NOT_SUPPORTED | GapAdvertisingData::LE_GENERAL_DISCOVERABLE);
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::COMPLETE_LOCAL_NAME, (uint8_t *)DEVICE_NAME, sizeof(DEVICE_NAME));
    ble.gap().accumulateAdvertisingPayload(GapAdvertisingData::COMPLETE_LIST_16BIT_SERVICE_IDS, (uint8_t *)serviceUUID.getBaseUUID(), serviceUUID.getLen());
    
    ble.gap().setAdvertisingType(GapAdvertisingParams::ADV_CONNECTABLE_UNDIRECTED);
    ble.gap().setAdvertisingInterval(160); // 100ms
    ble.gap().startAdvertising();
    
    Serial.println("BLE initialized!");
    Serial.print("Device name: ");
    Serial.println(DEVICE_NAME);
    Serial.println("Waiting for connection...");
}

// ============== MAIN LOOP ==============
void loop() {
    // Process BLE events
    ble.waitForEvent();
    
    // Handle pump trigger
    if (pumpTriggered) {
        pumpTriggered = false;
        pumpStartTime = millis();
        pumpRunning = true;
        digitalWrite(PUMP_PIN, HIGH);
        Serial.println("PUMP ON!");
        
        // Send notification
        uint32_t notifyVal = pumpDuration;
        ble.gattServer().write(pumpNotifyChar.getValueHandle(), (uint8_t*)&notifyVal, 4);
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