import sqlite3
import json
from flask import Flask, render_template, request, jsonify
from mqtt_publisher import publish_mqtt_message
from PyQt5 import QtWidgets
from PyQt5.QtCore import QUrl
from PyQt5.QtWebEngineWidgets import QWebEngineView
import sys
import threading
import subprocess
import re

app = Flask(__name__, static_folder='static', template_folder='templates')

last_known_member_states = None

def get_member_states():
    """Helper function to get current member states"""
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    c.execute('SELECT id, is_active, gender, age FROM members')
    members = c.fetchall()
    conn.close()
    return [(m[0], bool(m[1]), m[2], m[3]) for m in members]

# Database initialization
def init_db():
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS system_status
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  is_ble_power_adapter_connected BOOLEAN,
                  is_ble_remote_connected BOOLEAN,
                  rtc_battery_percentage INTEGER,
                  meter_battery_percentage INTEGER,
                  is_tv_cable_plugged_in BOOLEAN,
                  is_tv_tamper_detected BOOLEAN)''')
    c.execute('''CREATE TABLE IF NOT EXISTS members
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT,
                  age INTEGER,
                  gender TEXT,
                  is_active BOOLEAN)''')
    
    # Insert dummy data into system_status
    c.execute('''INSERT OR IGNORE INTO system_status
                 (id, is_ble_power_adapter_connected, is_ble_remote_connected,
                  rtc_battery_percentage, meter_battery_percentage,
                  is_tv_cable_plugged_in, is_tv_tamper_detected)
                 VALUES (1, 1, 0, 75, 80, 1, 0)''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/system_status')
def get_system_status():
    global last_known_member_states
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    # Get current system status
    c.execute('SELECT * FROM system_status WHERE id = 1')
    row = c.fetchone()
    
    if row:
        is_tv_cable_plugged_in = bool(row[5])
        
        # If TV cable is not plugged in, deactivate all members
        if not is_tv_cable_plugged_in:
            c.execute('UPDATE members SET is_active = 0')
            conn.commit()
            
            # Get new member states after update
            current_member_states = get_member_states()
            
            # Only publish if states have changed
            if current_member_states != last_known_member_states:
                publish_mqtt_message()
                last_known_member_states = current_member_states
        
        status = {
            'is_ble_power_adapter_connected': bool(row[1]),
            'is_ble_remote_connected': bool(row[2]),
            'rtc_battery_percentage': row[3],
            'meter_battery_percentage': row[4],
            'is_tv_cable_plugged_in': is_tv_cable_plugged_in,
            'is_tv_tamper_detected': bool(row[6])
        }
        conn.close()
        return jsonify(status)
    else:
        conn.close()
        return jsonify({'error': 'No system status found'}), 404

@app.route('/api/members', methods=['GET', 'POST'])
def members():
    global last_known_member_states
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO members (name, age, gender, is_active) VALUES (?, ?, ?, ?)',
                  (data['name'], data['age'], data['gender'], False))
        conn.commit()
        member_id = c.lastrowid
        
        # Get new member states after update
        current_member_states = get_member_states()
        
        # Only publish if states have changed
        if current_member_states != last_known_member_states:
            publish_mqtt_message()
            last_known_member_states = current_member_states
            
        conn.close()
        return jsonify({'id': member_id, 'message': 'Member added successfully'}), 201
    
    # GET request handling remains the same
    c.execute('SELECT * FROM members')
    members = [{'id': row[0], 'name': row[1], 'age': row[2], 'gender': row[3], 'is_active': bool(row[4])}
               for row in c.fetchall()]
    conn.close()
    return jsonify(members)

@app.route('/api/members/<int:member_id>', methods=['GET', 'PUT', 'DELETE'])
def update_delete_member(member_id):
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    if request.method == 'GET':
        c.execute('SELECT * FROM members WHERE id=?', (member_id,))
        member = c.fetchone()
        if member:
            return jsonify({'id': member[0], 'name': member[1], 'age': member[2], 'gender': member[3], 'is_active': bool(member[4])})
        else:
            return jsonify({'error': 'Member not found'}), 404
    
    elif request.method == 'PUT':
        data = request.json
        c.execute('UPDATE members SET name=?, age=?, gender=? WHERE id=?',
                  (data['name'], data['age'], data['gender'], member_id))
        conn.commit()
        conn.close()
        publish_mqtt_message()
        return jsonify({'message': 'Member updated successfully'})
    
    elif request.method == 'DELETE':
        c.execute('DELETE FROM members WHERE id=?', (member_id,))
        conn.commit()
        conn.close()
        publish_mqtt_message()
        return jsonify({'message': 'Member deleted successfully'})

@app.route('/api/members/<int:member_id>/toggle_active', methods=['POST'])
def toggle_member_active(member_id):
    global last_known_member_states
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    # Get current state
    c.execute('SELECT is_active FROM members WHERE id=?', (member_id,))
    current_state = c.fetchone()
    if current_state is None:
        conn.close()
        return jsonify({'error': 'Member not found'}), 404
    
    # Update state
    new_state = not bool(current_state[0])
    c.execute('UPDATE members SET is_active = ? WHERE id=?', (new_state, member_id))
    conn.commit()
    
    # Get new member states after update
    current_member_states = get_member_states()
    
    # Only publish if states have changed
    if current_member_states != last_known_member_states:
        publish_mqtt_message()
        last_known_member_states = current_member_states
    
    conn.close()
    return jsonify({'message': f'Member active state toggled to {new_state}'})

@app.route('/api/wifi/connect', methods=['POST'])
def connect_wifi():
    data = request.json
    ssid = data.get('ssid')
    password = data.get('password')

    try:
        # Create a Wi-Fi profile XML
        profile = f"""<?xml version="1.0"?>
        <WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
            <name>{ssid}</name>
            <SSIDConfig>
                <SSID>
                    <name>{ssid}</name>
                </SSID>
            </SSIDConfig>
            <connectionType>ESS</connectionType>
            <connectionMode>auto</connectionMode>
            <MSM>
                <security>
                    <authEncryption>
                        <authentication>WPA2PSK</authentication>
                        <encryption>AES</encryption>
                        <useOneX>false</useOneX>
                    </authEncryption>
                    <sharedKey>
                        <keyType>passPhrase</keyType>
                        <protected>false</protected>
                        <keyMaterial>{password}</keyMaterial>
                    </sharedKey>
                </security>
            </MSM>
        </WLANProfile>"""

        # Save the profile to a file
        with open(f"{ssid}.xml", "w") as f:
            f.write(profile)

        # Add the Wi-Fi profile
        subprocess.run(f'netsh wlan add profile filename="{ssid}.xml"', check=True, shell=True)

        # Connect to the Wi-Fi network
        subprocess.run(f'netsh wlan connect name="{ssid}"', check=True, shell=True)

        return jsonify({"message": "Connected successfully!"}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({"message": "Connection failed!", "error": str(e)}), 500

@app.route('/api/wifi/disconnect', methods=['POST'])
def disconnect_wifi():
    try:
        # Get the current connection info
        output = subprocess.check_output('netsh wlan show interfaces', universal_newlines=True)
        ssid = re.search(r"SSID\s+:\s(.+)", output)
        if ssid:
            ssid = ssid.group(1).strip()
            # Disconnect from the current network
            subprocess.run(f'netsh wlan disconnect interface="Wi-Fi"', check=True, shell=True)
            return jsonify({"message": f"Disconnected from {ssid} successfully!"}), 200
        else:
            return jsonify({"message": "No active Wi-Fi connection found."}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({"message": "Disconnection failed!", "error": str(e)}), 500

@app.route('/api/wifi/networks', methods=['GET'])
def list_wifi_networks():
    try:
        # Use subprocess to run the netsh command to list available networks
        output = subprocess.check_output(['netsh', 'wlan', 'show', 'network', 'mode=Bssid'], universal_newlines=True)
        
        # Parse the output to extract SSIDs and signal strength
        networks = []
        current_network = {}
        for line in output.splitlines():
            if "SSID" in line and "BSSID" not in line:
                if current_network:
                    networks.append(current_network)
                    current_network = {}
                ssid = line.split(":")[1].strip()
                current_network["ssid"] = ssid
            elif "Signal" in line:
                signal = line.split(":")[1].strip()
                current_network["signal_strength"] = signal

        if current_network:
            networks.append(current_network)

        return jsonify(networks), 200
    except subprocess.CalledProcessError as e:
        return jsonify({"message": "Failed to scan networks!", "error": str(e)}), 500

# Function to run the Flask app
def run_flask():
    app.run(debug=True, use_reloader=False)

# Main PyQt application
class MyApp(QtWidgets.QMainWindow):
    def __init__(self):
        super(MyApp, self).__init__()
        self.browser = QWebEngineView()
        self.setCentralWidget(self.browser)
        self.showFullScreen()  # Set the window to full screen
        self.browser.setUrl(QUrl("http://127.0.0.1:5000"))  # URL to your Flask app

if __name__ == '__main__':
    # Start the Flask app in a separate thread
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.start()
    
    # Start the PyQt application
    app = QtWidgets.QApplication(sys.argv)
    window = MyApp()
    window.show()
    sys.exit(app.exec_())
