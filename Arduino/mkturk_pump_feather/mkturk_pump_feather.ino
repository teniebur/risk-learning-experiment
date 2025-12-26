#include <Arduino.h>
#include <SPI.h>
#include "Adafruit_BLE.h"
#include "Adafruit_BluefruitLE_SPI.h"

#define DEVICE_NAME       "BLENano_Dev"
#define PUMP_PIN          6

#define BLUEFRUIT_SPI_CS    8
#define BLUEFRUIT_SPI_IRQ   7
#define BLUEFRUIT_SPI_RST   4

Adafruit_BluefruitLE_SPI ble(BLUEFRUIT_SPI_CS, BLUEFRUIT_SPI_IRQ, BLUEFRUIT_SPI_RST);

uint16_t pumpDuration = 0;
unsigned long pumpStartTime = 0;
bool pumpRunning = false;
int32_t charid_pump = 0;

// Callback when GATT characteristic is written
void BleGattRX(int32_t chars_id, uint8_t data[], uint16_t len) {
    Serial.print(F("GATT RX charID="));
    Serial.print(chars_id);
    Serial.print(F(" len="));
    Serial.println(len);
    
    for (int i = 0; i < len; i++) {
        Serial.print(F("  byte["));
        Serial.print(i);
        Serial.print(F("]="));
        Serial.println(data[i]);
    }
    
    if (len >= 2) {
        pumpDuration = data[0] | (data[1] << 8);
        Serial.print(F("Pump duration: "));
        Serial.print(pumpDuration);
        Serial.println(F(" ms"));
        
        if (pumpDuration > 0 && pumpDuration < 10000) {
            pumpStartTime = millis();
            pumpRunning = true;
            digitalWrite(PUMP_PIN, HIGH);
            Serial.println(F("PUMP ON!"));
        }
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println(F("Starting..."));
    
    pinMode(PUMP_PIN, OUTPUT);
    digitalWrite(PUMP_PIN, LOW);
    
    // Test pump
    digitalWrite(PUMP_PIN, HIGH);
    delay(100);
    digitalWrite(PUMP_PIN, LOW);
    
    if (!ble.begin(false)) {
        Serial.println(F("No Bluefruit!"));
        while(1);
    }
    Serial.println(F("Bluefruit OK"));
    
    ble.factoryReset();
    delay(1000);
    ble.echo(false);
    
    Serial.println(F("Step 1: Name"));
    ble.sendCommandCheckOK(F("AT+GAPDEVNAME=BLENano_Dev"));
    
    Serial.println(F("Step 2: Clear GATT"));
    ble.sendCommandCheckOK(F("AT+GATTCLEAR"));
    
    Serial.println(F("Step 3: Add Service"));
    ble.sendCommandCheckOK(F("AT+GATTADDSERVICE=UUID=0xA000"));
    
    Serial.println(F("Step 4: Add Char"));
    ble.println(F("AT+GATTADDCHAR=UUID=0xA002,PROPERTIES=0x0C,MIN_LEN=2,MAX_LEN=2,VALUE=0"));
    delay(100);
    // Read the characteristic ID from response
    charid_pump = ble.readline_parseInt();
    Serial.print(F("Pump char ID: "));
    Serial.println(charid_pump);
    
    Serial.println(F("Step 5: Reset"));
    ble.reset();
    delay(1000);
    
    Serial.println(F("Step 6: List GATT"));
    ble.println(F("AT+GATTLIST"));
    delay(500);
    while(ble.available()) { Serial.write(ble.read()); }
    Serial.println();
    
    // Set callback for GATT writes
    Serial.println(F("Step 7: Set callback"));
    ble.setBleGattRxCallback(charid_pump, BleGattRX);
    
    Serial.println(F("Ready!"));
}

void loop() {
    // IMPORTANT: Must call update() to process BLE events and trigger callbacks
    ble.update(200);
    
    // Handle pump timing
    if (pumpRunning && (millis() - pumpStartTime >= pumpDuration)) {
        digitalWrite(PUMP_PIN, LOW);
        pumpRunning = false;
        Serial.println(F("PUMP OFF"));
    }
}