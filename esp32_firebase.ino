#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>  // Add LCD library

// WiFi credentials
#define WIFI_SSID "narzo 50A"
#define WIFI_PASSWORD "1234567890"

// Firebase credentials
#define API_KEY "AIzaSyBmPMhCALgtoNXfb6fPSu95PdryCWpr7Dw"
#define DATABASE_URL "https://technomax-2k25-default-rtdb.firebaseio.com"
#define USER_EMAIL "esp32@device.com"
#define USER_PASSWORD "esp32password123"

// Google Geolocation API
#define GOOGLE_API_KEY "AIzaSyAQhOPjr4xjakiFpBDFJ3DhdvHGmZ4P7WM"

// Pin definitions
#define SOS_BUTTON_PIN 4
#define STATUS_LED_PIN 2  // Built-in LED on most ESP32 boards
#define BUZZER_PIN 5      // Buzzer connected to GPIO 5
#define ALERT_LED_PIN 13  // External LED for alerts on GPIO 13

// I2C LCD Configuration
#define LCD_COLS 16
#define LCD_ROWS 2
#define LCD_ADDRESS 0x27  // Typical I2C address for LCD, might need to change

// Initialize LCD
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);

// Unique ID for this ESP32 device
#define VEHICLE_ID "ESP32_1"

// Constants
const unsigned long RETRY_INTERVAL = 5000; // 5 seconds between retries
const unsigned long UPDATE_INTERVAL = 10000; // 10 seconds

// Constants for alert patterns
const unsigned long BLINK_INTERVAL = 500;    // LED blinks every 500ms
const unsigned long BUZZER_INTERVAL = 1000;  // Buzzer beeps every 1000ms
const int BUZZER_DURATION = 200;   // Buzzer beep duration in ms

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Global variables
bool sosState = false;
bool isWifiConnected = false;
bool isFirebaseConnected = false;
bool signupOK = false;
unsigned long lastUpdateTime = 0;
unsigned long lastAttemptTime = 0;
unsigned long lastBlinkTime = 0;  // For LED blinking
unsigned long lastBuzzerTime = 0; // For buzzer beeping
bool alertLedState = false;       // For LED state tracking
float currentLat = 0;
float currentLng = 0;

// Function declarations
void updateWiFiLocation();
void updateLocation();
void checkSOSButton();
void triggerSOS();
void clearSOS();
void connectWiFi();
void initFirebase();
void updateLEDStatus();
void blinkLED(int times, int delayMs);
void handleAlerts();
void updateLCDStatus();

void setup() {
  Serial.begin(115200);
  Serial.println("\nInitializing SafeGuard Vehicle Tracker...");

  // Initialize pins
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ALERT_LED_PIN, OUTPUT);
  
  // Ensure all alerts are off at startup
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(ALERT_LED_PIN, LOW);
  sosState = false;
  alertLedState = false;
  
  Serial.println("SOS button initialized on PIN " + String(SOS_BUTTON_PIN));

  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    delay(500);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    isWifiConnected = true;
    Serial.println("\nConnected to WiFi");
    Serial.println("IP: " + WiFi.localIP().toString());
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    isWifiConnected = false;
    Serial.println("\nFailed to connect to WiFi!");
    digitalWrite(STATUS_LED_PIN, LOW);
    ESP.restart();
  }

  if (isWifiConnected) {
    // Initialize I2C LCD
    Wire.begin();
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SafeGuard System");
    lcd.setCursor(0, 1);
    lcd.print("Initializing...");
    delay(2000);
    
    // Initialize Firebase
    initFirebase();
    
    // Initial location update if Firebase is connected
    if (isFirebaseConnected) {
      updateWiFiLocation();
    }
  }

  Serial.println("Setup complete!");
}

void loop() {
  if (!isWifiConnected) {
    Serial.println("WiFi disconnected. Attempting to reconnect...");
    connectWiFi();
    return;
  }
  
  if (!isFirebaseConnected && (millis() - lastAttemptTime > RETRY_INTERVAL)) {
    Serial.println("Firebase disconnected. Attempting to reconnect...");
    initFirebase();
    lastAttemptTime = millis();
    return;
  }
  
  if (isWifiConnected && isFirebaseConnected) {
    if (millis() - lastUpdateTime >= UPDATE_INTERVAL) {
      updateWiFiLocation();
      updateLocation();
      updateLCDStatus();  // Update LCD with current status
      lastUpdateTime = millis();
    }
    checkSOSButton();
    handleAlerts();
  }
  
  updateLEDStatus();
}

bool testFirebaseConnection() {
    if (!Firebase.ready()) {
        Serial.println("Firebase not ready!");
        return false;
    }

    FirebaseJson json;
    json.set("test", "Connection test");
    json.set("timestamp", String(millis()));
    
    Serial.println("Testing Firebase connection...");
    if (Firebase.RTDB.setJSON(&fbdo, "test/" VEHICLE_ID, &json)) {
        Serial.println("Test data written successfully");
        return true;
    } else {
        Serial.println("Failed to write test data");
        Serial.println("Error: " + fbdo.errorReason());
        return false;
    }
}

void updateFirebase() {
    // Create JSON with vehicle data
    FirebaseJson json;
    json.set("vehicleId", VEHICLE_ID);
    json.set("latitude", currentLat);
    json.set("longitude", currentLng);
    json.set("lastUpdate", String(millis()));
    json.set("sos", sosState);
    
    String path = "vehicles/" VEHICLE_ID;
    
    Serial.println("Updating Firebase data...");
    if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Data updated successfully");
        isFirebaseConnected = true;
    } else {
        Serial.println("Failed to update data");
        Serial.println("Error: " + fbdo.errorReason());
        isFirebaseConnected = false;
    }
}

void checkSOSButton() {
    static bool lastButtonState = HIGH;
    static unsigned long lastDebounceTime = 0;
    const unsigned long debounceDelay = 50;

    bool currentButtonState = digitalRead(SOS_BUTTON_PIN);

    if (currentButtonState != lastButtonState) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay) {
        if (currentButtonState == LOW && !sosState) {
            Serial.println("Button pressed - Activating SOS!");
            triggerSOS();
        } else if (currentButtonState == HIGH && sosState) {
            Serial.println("Button released - Clearing SOS!");
            clearSOS();
            // Ensure buzzer is off
            digitalWrite(BUZZER_PIN, LOW);
        }
    }

    lastButtonState = currentButtonState;
}

void triggerSOS() {
    if (!Firebase.ready()) {
        Serial.println("Firebase not ready! Cannot trigger SOS");
        return;
    }

    // Update vehicle SOS status
    if (Firebase.RTDB.setBool(&fbdo, "vehicles/" VEHICLE_ID "/sos", true)) {
        Serial.println("Vehicle SOS status updated successfully");
        sosState = true;
        
        // Update LCD with SOS alert
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("*** SOS ALERT ***");
        lcd.setCursor(0, 1);
        lcd.print("Emergency Active!");
    } else {
        Serial.println("Failed to update vehicle SOS status: " + fbdo.errorReason());
    }

    // Create a detailed SOS entry
    FirebaseJson sosData;
    sosData.set("timestamp", String(millis()));
    sosData.set("latitude", currentLat);
    sosData.set("longitude", currentLng);
    sosData.set("active", true);

    if (Firebase.RTDB.setJSON(&fbdo, "sos/" VEHICLE_ID, &sosData)) {
        Serial.println("SOS alert triggered successfully");
    } else {
        Serial.println("Failed to trigger SOS alert: " + fbdo.errorReason());
    }
}

void clearSOS() {
    if (!Firebase.ready()) {
        Serial.println("Firebase not ready! Cannot clear SOS");
        return;
    }

    // First turn off alerts
    digitalWrite(ALERT_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    alertLedState = false;
    sosState = false;

    // Update LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("System Normal");
    lcd.setCursor(0, 1);
    lcd.print("Monitoring...");

    // Then update Firebase
    if (Firebase.RTDB.setBool(&fbdo, "vehicles/" VEHICLE_ID "/sos", false)) {
        Serial.println("Vehicle SOS status cleared successfully");
    } else {
        Serial.println("Failed to clear vehicle SOS status: " + fbdo.errorReason());
    }

    if (Firebase.RTDB.deleteNode(&fbdo, "sos/" VEHICLE_ID)) {
        Serial.println("SOS alert cleared successfully");
    } else {
        Serial.println("Failed to clear SOS alert: " + fbdo.errorReason());
    }
}

void blinkLED(int times, int delayMs) {
    for (int i = 0; i < times; i++) {
        digitalWrite(STATUS_LED_PIN, HIGH);
        delay(delayMs);
        digitalWrite(STATUS_LED_PIN, LOW);
        delay(delayMs);
    }
    digitalWrite(STATUS_LED_PIN, HIGH);
}

void updateWiFiLocation() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    StaticJsonDocument<1024> jsonDoc;
    JsonArray wifiArray = jsonDoc.createNestedArray("wifiAccessPoints");

    int n = WiFi.scanNetworks();
    Serial.println("WiFi scan complete");

    for (int i = 0; i < n && i < 6; ++i) { // limit to 6 networks
        JsonObject wifiObj = wifiArray.createNestedObject();
        wifiObj["macAddress"] = WiFi.BSSIDstr(i);
        wifiObj["signalStrength"] = WiFi.RSSI(i);
        wifiObj["channel"] = WiFi.channel(i);
    }

    String jsonString;
    serializeJson(jsonDoc, jsonString);

    http.begin("https://www.googleapis.com/geolocation/v1/geolocate?key=" + String(GOOGLE_API_KEY));
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(jsonString);

    if (httpCode == 200) {
        String response = http.getString();
        StaticJsonDocument<512> respDoc;
        DeserializationError err = deserializeJson(respDoc, response);
        if (!err) {
            currentLat = respDoc["location"]["lat"];
            currentLng = respDoc["location"]["lng"];
            Serial.print("Lat: ");
            Serial.print(currentLat, 6);
            Serial.print(" | Lng: ");
            Serial.println(currentLng, 6);
        } else {
            Serial.println("Failed to parse location response");
        }
    } else {
        Serial.print("HTTP Error: ");
        Serial.println(httpCode);
    }

    http.end();
    WiFi.scanDelete();
}

void updateLocation() {
    if (Firebase.ready() && currentLat != 0 && currentLng != 0) {
        // Debug print values being sent to Firebase
        Serial.println("Updating Firebase with location:");
        Serial.print("Latitude: "); Serial.println(currentLat, 6);
        Serial.print("Longitude: "); Serial.println(currentLng, 6);
        
        if (Firebase.RTDB.setDouble(&fbdo, "vehicles/" VEHICLE_ID "/latitude", currentLat)) {
            Serial.println("Latitude updated successfully");
        } else {
            Serial.println("Failed to update latitude: " + fbdo.errorReason());
        }

        if (Firebase.RTDB.setDouble(&fbdo, "vehicles/" VEHICLE_ID "/longitude", currentLng)) {
            Serial.println("Longitude updated successfully");
        } else {
            Serial.println("Failed to update longitude: " + fbdo.errorReason());
        }
        
        // Verify stored values
        if (Firebase.RTDB.getDouble(&fbdo, "vehicles/" VEHICLE_ID "/latitude")) {
            float storedLat = fbdo.to<float>();
            Serial.print("Stored latitude in Firebase: "); Serial.println(storedLat, 6);
        }
        if (Firebase.RTDB.getDouble(&fbdo, "vehicles/" VEHICLE_ID "/longitude")) {
            float storedLng = fbdo.to<float>();
            Serial.print("Stored longitude in Firebase: "); Serial.println(storedLng, 6);
        }
    }
}

void connectWiFi() {
    Serial.println("\nConnecting to WiFi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        isWifiConnected = true;
        Serial.println("\nWiFi Connected!");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        digitalWrite(STATUS_LED_PIN, HIGH);
    } else {
        isWifiConnected = false;
        Serial.println("\nWiFi Connection Failed!");
        digitalWrite(STATUS_LED_PIN, LOW);
    }
}

void initFirebase() {
    Serial.println("Initializing Firebase...");
    
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    
    // Enable WiFi reconnection
    Firebase.reconnectWiFi(true);
    
    Serial.println("Attempting Firebase authentication...");
    auth.user.email = USER_EMAIL;
    auth.user.password = USER_PASSWORD;
    
    // Initialize the library with the Firebase authen and config
    Firebase.begin(&config, &auth);
    
    // Set the size of WiFi rx/tx buffers in the case where we want to work with large data
    fbdo.setBSSLBufferSize(4096 /* Rx buffer size in bytes */, 1024 /* Tx buffer size in bytes */);

    // Set the size of HTTP response buffer
    fbdo.setResponseSize(2048);
    
    // Waiting for authentication
    Serial.println("Waiting for Firebase authentication...");
    unsigned long startAttemptTime = millis();
    
    while (!Firebase.ready() && (millis() - startAttemptTime) < 10000) {
        Serial.print(".");
        delay(250);
    }
    Serial.println();
    
    if (Firebase.ready()) {
        Serial.println("Firebase authentication successful!");
        Serial.print("User UID: ");
        Serial.println(auth.token.uid.c_str());
        isFirebaseConnected = true;
        
        // Test the connection with a write operation
        if (testFirebaseConnection()) {
            Serial.println("Firebase connection test successful!");
            blinkLED(3, 200); // Success indicator
            
            // Set initial vehicle state
            FirebaseJson json;
            json.set("latitude", currentLat);
            json.set("longitude", currentLng);
            json.set("sos", false);
            json.set("lastUpdate", String(millis()));
            
            if (Firebase.RTDB.setJSON(&fbdo, "vehicles/" VEHICLE_ID, &json)) {
                Serial.println("Initial vehicle state set successfully");
            } else {
                Serial.println("Failed to set initial vehicle state");
                Serial.println("Reason: " + fbdo.errorReason());
            }
        } else {
            Serial.println("Firebase connection test failed!");
            isFirebaseConnected = false;
            blinkLED(5, 200); // Error indicator
        }
    } else {
        Serial.println("Firebase authentication failed!");
        Serial.println("Check your credentials and internet connection");
        isFirebaseConnected = false;
        blinkLED(5, 200); // Error indicator
    }
}

void updateLEDStatus() {
    if (!isWifiConnected) {
        // Fast blink when no WiFi
        digitalWrite(STATUS_LED_PIN, (millis() % 500) < 250);
    } else if (!isFirebaseConnected) {
        // Slow blink when no Firebase
        digitalWrite(STATUS_LED_PIN, (millis() % 1000) < 500);
    } else if (sosState) {
        // Rapid blink during SOS
        digitalWrite(STATUS_LED_PIN, (millis() % 200) < 100);
    } else {
        // Solid ON when everything is working
        digitalWrite(STATUS_LED_PIN, HIGH);
    }
}

void handleAlerts() {
    // Only handle alerts if sosState is true
    if (sosState) {
        // Handle LED blinking
        if (millis() - lastBlinkTime >= BLINK_INTERVAL) {
            lastBlinkTime = millis();
            alertLedState = !alertLedState;
            digitalWrite(ALERT_LED_PIN, alertLedState);
        }
        
        // Handle buzzer beeping
        if (millis() - lastBuzzerTime >= BUZZER_INTERVAL) {
            lastBuzzerTime = millis();
            // Short beep
            digitalWrite(BUZZER_PIN, HIGH);
            delay(100);  // Short beep duration
            digitalWrite(BUZZER_PIN, LOW);
        }
    } else {
        // When not in SOS state, ensure everything is off
        digitalWrite(ALERT_LED_PIN, LOW);
        digitalWrite(BUZZER_PIN, LOW);
        alertLedState = false;
    }
}

void updateLCDStatus() {
    if (!isWifiConnected) {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Error");
        lcd.setCursor(0, 1);
        lcd.print("Reconnecting...");
    } else if (!isFirebaseConnected) {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Firebase Error");
        lcd.setCursor(0, 1);
        lcd.print("Reconnecting...");
    } else if (!sosState) {
        // Debug print current location values
        Serial.println("Current location values:");
        Serial.print("Latitude: "); Serial.println(currentLat, 6);
        Serial.print("Longitude: "); Serial.println(currentLng, 6);
        
        // Only update if not in SOS state to avoid overwriting SOS message
        lcd.clear();
        lcd.setCursor(0, 0);
        char latStr[16];
        char lngStr[16];
        snprintf(latStr, 16, "Lat:%.4f", currentLat);
        snprintf(lngStr, 16, "Lng:%.4f", currentLng);
        
        // Debug print formatted strings
        Serial.print("LCD Lat string: "); Serial.println(latStr);
        Serial.print("LCD Lng string: "); Serial.println(lngStr);
        
        lcd.print(latStr);
        lcd.setCursor(0, 1);
        lcd.print(lngStr);
    }
} 