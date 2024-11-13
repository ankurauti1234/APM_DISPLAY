import sqlite3
import os
from flask import Flask, render_template, request, jsonify
from mqtt_publisher import publish_mqtt_message
from PyQt5 import QtWidgets
from PyQt5.QtCore import QUrl, Qt
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
import sys
import threading
import subprocess
import time
from PyQt5 import QtWidgets, QtCore
from PyQt5.QtGui import QKeySequence
from PyQt5.QtWidgets import QShortcut


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
                  is_active BOOLEAN,
                  active_until TIMESTAMP)''')
    
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

@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    try:
        os.system('sudo shutdown -h now')
        return jsonify({"message": "Shutting down the system..."}), 200
    except Exception as e:
        return jsonify({"message": f"Failed to shut down: {str(e)}"}), 500

@app.route('/api/restart', methods=['POST'])
def restart():
    try:
        os.system('sudo reboot')
        return jsonify({"message": "Restarting the system..."}), 200
    except Exception as e:
        return jsonify({"message": f"Failed to restart: {str(e)}"}), 500

@app.route('/api/system_status')
def get_system_status():
    global last_known_member_states
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    c.execute('SELECT * FROM system_status WHERE id = 1')
    row = c.fetchone()
    
    if row:
        is_tv_cable_plugged_in = bool(row[5])
        
        if not is_tv_cable_plugged_in:
            c.execute('UPDATE members SET is_active = 0, active_until = NULL')
            conn.commit()
            
            current_member_states = get_member_states()
            
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
        c.execute('INSERT INTO members (name, age, gender, is_active, active_until) VALUES (?, ?, ?, ?, NULL)',
                  (data['name'], data['age'], data['gender'], False))
        conn.commit()
        member_id = c.lastrowid
        
        current_member_states = get_member_states()
        
        if current_member_states != last_known_member_states:
            publish_mqtt_message()
            last_known_member_states = current_member_states
            
        conn.close()
        return jsonify({'id': member_id, 'message': 'Member added successfully'}), 201
    
    c.execute('SELECT * FROM members')
    members = [{'id': row[0], 'name': row[1], 'age': row[2], 'gender': row[3], 'is_active': bool(row[4])}
               for row in c.fetchall()]
    conn.close()
    return jsonify(members)

@app.route('/api/members/<int:member_id>/set_active', methods=['POST'])
def set_member_active(member_id):
    global last_known_member_states
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    data = request.json
    duration = data.get('duration', 0)
    
    if duration > 0:
        active_until = time.time() + (duration * 60)  # Convert minutes to seconds
        c.execute('UPDATE members SET is_active = 1, active_until = ? WHERE id = ?', (active_until, member_id))
    else:
        c.execute('UPDATE members SET is_active = 1, active_until = NULL WHERE id = ?', (member_id,))
    
    conn.commit()
    
    current_member_states = get_member_states()
    
    if current_member_states != last_known_member_states:
        publish_mqtt_message()
        last_known_member_states = current_member_states
    
    conn.close()
    return jsonify({'message': f'Member set active for {duration} minutes'})

@app.route('/api/members/<int:member_id>/toggle_active', methods=['POST'])
def toggle_member_active(member_id):
    global last_known_member_states
    conn = sqlite3.connect('system_status.db')
    c = conn.cursor()
    
    c.execute('SELECT is_active FROM members WHERE id=?', (member_id,))
    current_state = c.fetchone()
    if current_state is None:
        conn.close()
        return jsonify({'error': 'Member not found'}), 404
    
    new_state = not bool(current_state[0])
    if new_state:
        c.execute('UPDATE members SET is_active = 1, active_until = NULL WHERE id=?', (member_id,))
    else:
        c.execute('UPDATE members SET is_active = 0, active_until = NULL WHERE id=?', (member_id,))
    conn.commit()
    
    current_member_states = get_member_states()
    
    if current_member_states != last_known_member_states:
        publish_mqtt_message()
        last_known_member_states = current_member_states
    
    conn.close()
    return jsonify({'message': f'Member active state toggled to {new_state}'})

def check_active_durations():
    while True:
        conn = sqlite3.connect('system_status.db')
        c = conn.cursor()
        current_time = time.time()
        c.execute('UPDATE members SET is_active = 0, active_until = NULL WHERE active_until IS NOT NULL AND active_until <= ?', (current_time,))
        if c.rowcount > 0:
            conn.commit()
            publish_mqtt_message()
        conn.close()
        time.sleep(60)  # Check every minute

# Start the background thread to check active durations
active_duration_thread = threading.Thread(target=check_active_durations, daemon=True)
active_duration_thread.start()
@app.route('/api/wifi/connect', methods=['POST'])
def connect_wifi():
    data = request.json
    ssid = data.get('ssid')
    password = data.get('password')

    try:
        # Check if the network is already known
        check_network = subprocess.run(['nmcli', '-t', '-f', 'NAME', 'connection', 'show'], 
                                    capture_output=True, text=True)
        known_networks = check_network.stdout.strip().split('\n')
        
        # If network exists, delete it to update with new password
        if ssid in known_networks:
            subprocess.run(['sudo', 'nmcli', 'connection', 'delete', ssid], check=True)
        
        # Add and connect to the network
        subprocess.run([
            'sudo', 'nmcli', 'device', 'wifi', 'connect', ssid,
            'password', password
        ], check=True)
        
        return jsonify({"message": "Connected successfully!"}), 200
    except subprocess.CalledProcessError as e:
        return jsonify({
            "message": "Connection failed!", 
            "error": str(e)
        }), 500

@app.route('/api/wifi/disconnect', methods=['POST'])
def disconnect_wifi():
    try:
        # Get current connection info
        connection_info = subprocess.check_output(['nmcli', '-t', '-f', 'NAME,TYPE', 'connection', 'show', '--active'],
                                               universal_newlines=True)
        
        # Find WiFi connection
        wifi_connection = None
        for line in connection_info.split('\n'):
            if line and ':wifi' in line:
                wifi_connection = line.split(':')[0]
                break
        
        if wifi_connection:
            # Disconnect from the network
            subprocess.run(['sudo', 'nmcli', 'device', 'disconnect', 'wlan0'], check=True)
            return jsonify({"message": f"Disconnected from {wifi_connection} successfully!"}), 200
        else:
            return jsonify({"message": "No active Wi-Fi connection found."}), 200
            
    except subprocess.CalledProcessError as e:
        return jsonify({
            "message": "Disconnection failed!", 
            "error": str(e)
        }), 500

@app.route('/api/wifi/networks', methods=['GET'])
def list_wifi_networks():
    try:
        # Scan for networks
        subprocess.run(['sudo', 'nmcli', 'device', 'wifi', 'rescan'], check=True)
        
        # Get network list
        output = subprocess.check_output([
            'nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list'
        ], universal_newlines=True)
        
        networks = []
        for line in output.strip().split('\n'):
            if line:
                ssid, signal, security = line.split(':')
                if ssid:  # Only add networks with non-empty SSIDs
                    networks.append({
                        "ssid": ssid,
                        "signal_strength": f"{signal}%",
                        "security": security if security else "None"
                    })
        
        return jsonify(networks), 200
    except subprocess.CalledProcessError as e:
        return jsonify({
            "message": "Failed to scan networks!", 
            "error": str(e)
        }), 500

@app.route('/close')
def close_application():
    QtCore.QCoreApplication.quit()
    return 'Closing application'


class MyApp(QtWidgets.QMainWindow):
    def __init__(self):
        super(MyApp, self).__init__()
        self.browser = QWebEngineView()
        self.setCentralWidget(self.browser)
        self.showFullScreen()
        
        # Enhanced zoom prevention settings
        self.browser.setZoomFactor(1.0)
        self.browser.settings().setAttribute(QWebEngineSettings.ShowScrollBars, False)
        self.browser.settings().setAttribute(QWebEngineSettings.ScrollAnimatorEnabled, False)
        self.browser.settings().setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        
        # Disable all touch and gesture events
        self.browser.setAttribute(Qt.WA_AcceptTouchEvents, False)
        self.setAttribute(Qt.WA_AcceptTouchEvents, False)
        
        # Comprehensive JavaScript to prevent zooming
        zoom_prevention_js = """
            // Prevent pinch zooming
            document.addEventListener('touchstart', function(e) {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, { passive: false });
            
            document.addEventListener('touchmove', function(e) {
                if (e.touches.length > 1 || e.scale !== undefined && e.scale !== 1) {
                    e.preventDefault();
                }
            }, { passive: false });
            
            // Prevent gesture events
            document.addEventListener('gesturestart', function(e) {
                e.preventDefault();
            }, { passive: false });
            
            document.addEventListener('gesturechange', function(e) {
                e.preventDefault();
            }, { passive: false });
            
            document.addEventListener('gestureend', function(e) {
                e.preventDefault();
            }, { passive: false });
            
            // Prevent double-tap zooming
            document.addEventListener('dblclick', function(e) {
                e.preventDefault();
            }, { passive: false });
            
            // Add viewport meta tag to prevent zooming
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.getElementsByTagName('head')[0].appendChild(meta);
            
            // Force viewport settings
            document.body.style.zoom = '1.0';
            document.body.style.touchAction = 'none';
        """
        
        # Inject the zoom prevention JavaScript
        self.browser.page().loadFinished.connect(lambda: self.browser.page().runJavaScript(zoom_prevention_js))
        
        # Disable keyboard zoom shortcuts
        self.disable_zoom_shortcuts()
        
        # Load the application URL
        self.browser.setUrl(QUrl("http://127.0.0.1:5000"))

    def disable_zoom_shortcuts(self):
        # Block all common zoom shortcuts
        shortcuts = [
            QKeySequence.ZoomIn,
            QKeySequence.ZoomOut,
            QKeySequence("Ctrl+="),
            QKeySequence("Ctrl+-"),
            QKeySequence("Ctrl+0"),
            QKeySequence("Ctrl++"),
            QKeySequence("Ctrl+wheel"),  # Mouse wheel zoom
        ]
        for shortcut in shortcuts:
            QShortcut(shortcut, self, lambda: None)

    def keyPressEvent(self, event):
        # Block Alt+F4 and other potential zoom-related key combinations
        if event.key() == QtCore.Qt.Key_F4 and event.modifiers() == QtCore.Qt.AltModifier:
            self.close()
        elif event.modifiers() & QtCore.Qt.ControlModifier:
            # Block all Ctrl + key combinations that might affect zoom
            if event.key() in [QtCore.Qt.Key_Plus, QtCore.Qt.Key_Minus, QtCore.Qt.Key_0]:
                return
        super().keyPressEvent(event)

    def wheelEvent(self, event):
        # Block mouse wheel events when Ctrl is pressed
        if event.modifiers() & QtCore.Qt.ControlModifier:
            event.ignore()
        else:
            super().wheelEvent(event)

# Function to run the Flask app
def run_flask():
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)

if __name__ == '__main__':
    # Start the Flask app in a separate thread
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.start()
    
    # Start the PyQt application
    qt_app = QtWidgets.QApplication(sys.argv)
    window = MyApp()
    window.show()
    sys.exit(qt_app.exec_())