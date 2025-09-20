#define BLYNK_TEMPLATE_ID "TMPL3Nku8jhOo"
#define BLYNK_TEMPLATE_NAME "Technomax 2k25"
#define BLYNK_AUTH_TOKEN "gJm7SQZmPOefRGKuOge_Km95Vg7KmsAP"

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <BlynkSimpleEsp32.h>

char ssid[] = "Aditya";
char pass[] = "Aditya09";

// -------------------- PIN DEFINITIONS --------------------
#define MQ3_PIN         34
#define SWITCH_PIN      32
#define RED_LED         26
#define BLUE_LED        27
#define BUZZER          14
#define MOTOR_IN1       16
#define MOTOR_IN2       17
#define MOTOR_IN3       18
#define MOTOR_IN4       19

LiquidCrystal_I2C lcd(0x27, 16, 2);

// -------------------- VARIABLES --------------------
bool blynkMotorControl = false;
bool overrideAllowed = false;
bool alcoholDetected = false;
bool alcoholEverDetected = false;
bool systemReady = false;
bool allowStartupSwitchControl = false;

BLYNK_WRITE(V1) {
  blynkMotorControl = param.asInt();

  // Only allow override if alcohol not detected now
  if (blynkMotorControl && !alcoholDetected) {
    overrideAllowed = true;
  }
}

void setup() {
  Serial.begin(115200);

  // Pin modes
  pinMode(MQ3_PIN, INPUT);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  pinMode(RED_LED, OUTPUT);
  pinMode(BLUE_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);

  // LCD Setup
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");

  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Init Alcohol Check");

  // Initial 5s check
  long startTime = millis();
  while (millis() - startTime < 5000) {
    int val = analogRead(MQ3_PIN);
    if (val > 1000) {
      alcoholDetected = true;
      alcoholEverDetected = true;
    }
    delay(200);
  }

  lcd.clear();
  if (alcoholDetected) {
    lcd.setCursor(0, 0);
    lcd.print("Alcohol Present!");
    lcd.setCursor(0, 1);
    lcd.print("Wait & Retry");
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER, HIGH);
    delay(5000);
  } else {
    lcd.setCursor(0, 0);
    lcd.print("System Ready");
    digitalWrite(BLUE_LED, HIGH);
    allowStartupSwitchControl = true;  // Allow physical switch control initially
  }

  systemReady = true;
}

void runMotors() {
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);
}

void stopMotors() {
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
}

void loop() {
  Blynk.run();
  if (!systemReady) return;

  int val = analogRead(MQ3_PIN);
  alcoholDetected = val > 1000;
  bool switchPressed = digitalRead(SWITCH_PIN) == LOW;

  // If alcohol detected now, mark it for system lock
  if (alcoholDetected) {
    alcoholEverDetected = true;
    allowStartupSwitchControl = false;
  }

  // Alcohol detected case
  if (alcoholDetected) {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BLUE_LED, LOW);
    digitalWrite(BUZZER, HIGH);
    stopMotors();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Alcohol Detected");
    lcd.setCursor(0, 1);
    lcd.print("Motor OFF");

    overrideAllowed = false;
    return;
  }

  // Alcohol NOT detected
  digitalWrite(RED_LED, LOW);
  digitalWrite(BLUE_LED, HIGH);
  digitalWrite(BUZZER, LOW);

  if (!alcoholEverDetected && allowStartupSwitchControl && switchPressed) {
    runMotors();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Manual Start");
    lcd.setCursor(0, 1);
    lcd.print("No Alcohol");
    return;
  }

  // If alcohol was ever detected, only allow motor if Blynk ON and switch ON
  if (blynkMotorControl && switchPressed) {
    runMotors();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Blynk + Switch");
    lcd.setCursor(0, 1);
    lcd.print("Engine Running");
  } else {
    stopMotors();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Motor OFF");
    lcd.setCursor(0, 1);
    lcd.print(blynkMotorControl ? "Switch OFF" : "Blynk OFF");
  }

  delay(300);
}