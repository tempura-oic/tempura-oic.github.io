import os
import sys
import time
import json
import traceback
import firebase_admin
from firebase_admin import credentials, db

# ==========================================
# 動作オプション設定
# ==========================================
# True の場合、AWS IoT Core への実際の接続証明書がなくても、
# Firebaseからの受信イベントとMQTTペイロード出力をコンソール上でテスト（模擬実行）できます。
DEBUG_MODE = True 

# Firebase 設定ファイル(サービスアカウントキーのJSON)
FIREBASE_KEY_PATH = "firebase-key.json"
DATABASE_URL = "https://your-database-id.firebaseio.com/"

# AWS IoT 設定 (DEBUG_MODE = Falseの時に使用)
AWS_ENDPOINT = "your-aws-iot-endpoint.iot.ap-northeast-1.amazonaws.com"
CLIENT_ID = "home_gateway_pc"
PATH_TO_CERT = "cert.pem.crt"
PATH_TO_KEY = "private.pem.key"
PATH_TO_ROOT = "AmazonRootCA1.pem"

mqtt_connection = None

# ==========================================
# AWS IoT Core 接続の初期化
# ==========================================
if not DEBUG_MODE:
    try:
        from awscrt import mqtt
        from awsiot import mqtt_connection_builder
        
        print("AWS IoT Core に接続中...")
        mqtt_connection = mqtt_connection_builder.mtls_from_path(
            endpoint=AWS_ENDPOINT,
            cert_filepath=PATH_TO_CERT,
            pri_key_filepath=PATH_TO_KEY,
            ca_filepath=PATH_TO_ROOT,
            client_id=CLIENT_ID,
            clean_session=False,
            keep_alive_secs=30
        )
        connect_future = mqtt_connection.connect()
        connect_future.result()
        print("AWS IoT Core へセキュアに接続完了！")
    except Exception as e:
        print(f"AWS IoT 接続エラー: {e}")
        print("認証鍵やライブラリが見つかりません。DEBUG_MODE = True に切り替えて実行します。")
        DEBUG_MODE = True
else:
    print("【DEBUG MODE / 模擬実行】 AWS IoT Coreへの物理的な接続は行いません (ログ出力デバッグ)。")

# ==========================================
# Firebase の初期化
# ==========================================
if not os.path.exists(FIREBASE_KEY_PATH):
    print(f"警告: Firebaseサービスアカウントキー '{FIREBASE_KEY_PATH}' が現在のディレクトリに見つかりません。")
    print("PWAからの操作イベントをPythonで検知するには、Firebase Consoleからキーを取得して配置してください。")
    print("スクリプトはキーが提供されるまでエラーになります。")
    # 検証用に作成を続行できるようにインポートのみ試み、ダミー動作にするか、エラー終了とする
    # 研修開発用として、プレースホルダーファイルをカレントディレクトリに用意するよう促すメッセージを出力

# --- グローバル変数 ---
last_processed_timestamp = 0

def publish_mqtt(topic, payload_dict):
    """
    AWS IoT CoreへMQTT Publishを送信 (DEBUG時はログ出力のみ)
    """
    payload_str = json.dumps(payload_dict)
    if DEBUG_MODE:
        print(f" [MQTT MOCK PUBLISH] Topic: {topic} | Payload: {payload_str}")
    else:
        if mqtt_connection:
            from awscrt import mqtt
            mqtt_connection.publish(
                topic=topic,
                payload=payload_str,
                qos=mqtt.QoS.AT_LEAST_ONCE
            )
            print(f" [MQTT PUBLISHED] Topic: {topic}")

def handle_command_change(event):
    """
    Firebase 'commands/active_command' 監視コールバック
    """
    global last_processed_timestamp
    if event.data is None:
        return
        
    cmd_data = event.data
    device_id = cmd_data.get("device")
    button_id = cmd_data.get("button")
    timestamp = cmd_data.get("timestamp", 0)

    # 重複判定 (タイムスタンプを利用)
    if timestamp <= last_processed_timestamp:
        return
    last_processed_timestamp = timestamp

    print(f"\n[自動検知] 新しい家電操作を取得しました:")
    print(f" -> 対象機器ID: {device_id}")
    print(f" -> ボタンID: {button_id}")

    try:
        # 家電マスタから該当ボタンの `ir_code` 情報を取得
        ir_ref = db.reference(f'devices/{device_id}/buttons/{button_id}/ir_code')
        ir_code = ir_ref.get()

        if ir_code:
            print(f" -> 登録赤外線コードを発見: {ir_code}")
            # MQTT Publish (device/control)
            publish_mqtt("homesystem/device/control", ir_code)
        else:
            print(f" -> 警告: このボタン [{button_id}] には赤外線コードが未学習です。")
    except Exception as ex:
        print(f" -> エラー: Firebaseからの参照に失敗しました: {ex}")

def handle_learning_state_change(event):
    """
    Firebase 'learning_state' 監視コールバック (赤外線学習モード制御)
    """
    if event.data is None:
        return
        
    lrn_data = event.data
    status = lrn_data.get("status")
    target_device = lrn_data.get("target_device")
    target_button = lrn_data.get("target_button")

    if status == "waiting":
        print(f"\n[学習シーケンス検知] ESP32-S3へ学習開始指示を送信します。")
        print(f" -> 対象: {target_device}のボタン[{target_button}]")
        
        # ESP32へMQTTで学習モード開始を指示
        publish_mqtt("homesystem/system/config", {
            "action": "start_learning"
        })

# ==========================================
# サービスエントリー
# ==========================================
def main():
    if not os.path.exists(FIREBASE_KEY_PATH):
        print(f"\n=== スマートホーム中継サービス実行エラー ===")
        print(f"'{FIREBASE_KEY_PATH}' が存在しません。")
        print(f"Firebaseの認証（Admin SDKサービスアカウント）設定ファイルをカレントフォルダに配置してください。")
        sys.exit(1)

    try:
        cred = credentials.Certificate(FIREBASE_KEY_PATH)
        firebase_admin.initialize_app(cred, {
            'databaseURL': DATABASE_URL
        })
        print(f"Firebase RTDB 接続完了: {DATABASE_URL}")
        
        # Firebase監視の紐付け
        db.reference('commands/active_command').listen(handle_command_change)
        db.reference('learning_state').listen(handle_learning_state_change)
        
        print("\n中継サービスが稼働しました。")
        print("Firebaseの変更をリアルタイムでWebSocket監視しています。")
        print("終了するには Ctrl+C を押してください。")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n中継サービスを安全に終了しました。")
        if mqtt_connection and not DEBUG_MODE:
            mqtt_connection.disconnect().result()
            print("AWS IoT MQTT 接続を切断しました。")
    except Exception as e:
        print(f"\n重大な接続・実行エラーが発生しました:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
