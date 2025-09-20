import socket

# === Server Setup ===
HOST = '0.0.0.0'      # Listen on all interfaces
PORT = 12345          # Port to listen on

print("[INFO] Starting Socket Server...")
server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server_socket.bind((HOST, PORT))
server_socket.listen(1)
print(f"[INFO] Waiting for ESP32 connection on port {PORT}...")

# === Wait for ESP32 Connection ===
client_socket, client_address = server_socket.accept()
print(f"[INFO] ESP32 connected from {client_address}")
client_socket.settimeout(2)

# === Communication Loop ===
try:
    while True:
        data = client_socket.recv(1024).decode().strip()
        if data:
            print(f"[ESP32] {data}")
            if data == "ACCESS_GRANTED":
                print("[Server] Sending: GRANT")
                client_socket.send("GRANT\n".encode())
            elif data == "ACCESS_DENIED":
                print("[Server] Sending: DENY")
                client_socket.send("DENY\n".encode())
except Exception as e:
    print("[ERROR]", e)
finally:
    client_socket.close()
    server_socket.close()
    print("[INFO] Server closed.")