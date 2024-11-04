# mqtt_publisher.py
import paho.mqtt.client as mqtt
import json
import time
import sqlite3
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))

# AWS IoT Core configuration
aws_iot_endpoint = "a3uoz4wfsx2nz3-ats.iot.ap-south-1.amazonaws.com"
cert_path = os.path.join(current_dir, "certs", "test.cert.pem.crt")
key_path = os.path.join(current_dir, "certs", "test.private.pem.key")
root_ca_path = os.path.join(current_dir, "certs", "root-CA.crt")

client = mqtt.Client()
client.tls_set(root_ca_path, certfile=cert_path, keyfile=key_path)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT broker")
    else:
        logger.error(f"Failed to connect to MQTT broker with code {rc}")

def on_publish(client, userdata, mid):
    logger.info(f"Message {mid} published successfully")

client.on_connect = on_connect
client.on_publish = on_publish

def publish_mqtt_message():
    try:
        client.connect(aws_iot_endpoint, 8883, 60)
        client.loop_start()
        
        conn = sqlite3.connect('system_status.db')
        c = conn.cursor()
        
        c.execute('SELECT * FROM members')
        members = c.fetchall()
        
        states = []
        genders = []
        ages = []
        
        for member in members:
            states.append(bool(member[4]))  # is_active
            genders.append(member[3])  # gender
            ages.append(member[2])  # age
        
        message = {
            "ID": 1,
            "DEVICE_ID": 100000,
            "Type": 3,
            "TS": int(time.time()),
            "Details": {
                "state": states,
                "gender": genders,
                "age": ages
            }
        }
        
        result = client.publish("apm/server", json.dumps(message), qos=1)
        result.wait_for_publish()
        logger.info(f"Message published: {message}")
        
        client.loop_stop()
        client.disconnect()
        
        conn.close()
        
    except Exception as e:
        logger.error(f"Error publishing MQTT message: {e}")

if __name__ == "__main__":
    publish_mqtt_message()