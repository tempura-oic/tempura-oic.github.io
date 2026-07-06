const { useState, useEffect, useRef } = React;

// ==========================================
// 初期デフォルト家電データ (LocalStorageが空の場合に使用)
// ==========================================
const DEFAULT_DEVICES = {
  "device_tv": {
    "metadata": {
      "name": "リビングテレビ",
      "category": "television",
      "gridColumns": 4,
      "gridRows": 6,
      "sortOrder": 1
    },
    "buttons": {
      "btn_power": {
        "label": "電源",
        "action": "power",
        "layout": { "x": 0, "y": 0, "w": 4, "h": 1, "variant": "danger" },
        "ir_code": { "protocol": "NEC", "address": "0x20DF", "command": "0x10EF" }
      },
      "btn_vol_up": {
        "label": "音量+",
        "action": "volume_up",
        "layout": { "x": 0, "y": 1, "w": 2, "h": 1, "variant": "secondary" },
        "ir_code": { "protocol": "NEC", "address": "0x20DF", "command": "0x40BF" }
      },
      "btn_vol_down": {
        "label": "音量-",
        "action": "volume_down",
        "layout": { "x": 0, "y": 2, "w": 2, "h": 1, "variant": "secondary" },
        "ir_code": { "protocol": "NEC", "address": "0x20DF", "command": "0x40C0" }
      },
      "btn_ch_up": {
        "label": "チャンネル+",
        "action": "channel_up",
        "layout": { "x": 2, "y": 1, "w": 2, "h": 1, "variant": "primary" },
        "ir_code": { "protocol": "NEC", "address": "0x20DF", "command": "0x00FF" }
      },
      "btn_ch_down": {
        "label": "チャンネル-",
        "action": "channel_down",
        "layout": { "x": 2, "y": 2, "w": 2, "h": 1, "variant": "primary" },
        "ir_code": { "protocol": "NEC", "address": "0x20DF", "command": "0x00FE" }
      }
    }
  },
  "device_aircon": {
    "metadata": {
      "name": "リビングエアコン",
      "category": "aircon",
      "gridColumns": 3,
      "gridRows": 4,
      "sortOrder": 2
    },
    "buttons": {
      "btn_cool": {
        "label": "冷房",
        "action": "cool",
        "layout": { "x": 0, "y": 0, "w": 1, "h": 1, "variant": "info" },
        "ir_code": { "protocol": "AEHA", "address": "0x32C1", "command": "0x51A2" }
      },
      "btn_heat": {
        "label": "暖房",
        "action": "heat",
        "layout": { "x": 1, "y": 0, "w": 1, "h": 1, "variant": "danger" },
        "ir_code": { "protocol": "AEHA", "address": "0x32C1", "command": "0x51C2" }
      },
      "btn_stop": {
        "label": "停止",
        "action": "stop",
        "layout": { "x": 2, "y": 0, "w": 1, "h": 1, "variant": "secondary" },
        "ir_code": { "protocol": "AEHA", "address": "0x32C1", "command": "0x5100" }
      }
    }
  },
  "device_light": {
    "metadata": {
      "name": "リビング照明",
      "category": "light",
      "gridColumns": 2,
      "gridRows": 4,
      "sortOrder": 3
    },
    "buttons": {
      "btn_on": {
        "label": "全灯",
        "action": "turn_on",
        "layout": { "x": 0, "y": 0, "w": 1, "h": 2, "variant": "success" },
        "ir_code": { "protocol": "PANASONIC", "address": "0x5C", "command": "0x2D" }
      },
      "btn_off": {
        "label": "消灯",
        "action": "turn_off",
        "layout": { "x": 1, "y": 0, "w": 1, "h": 2, "variant": "secondary" },
        "ir_code": { "protocol": "PANASONIC", "address": "0x5C", "command": "0x2F" }
      }
    }
  },
  "device_circulator": {
    "metadata": {
      "name": "サーキュレーター",
      "category": "circulator",
      "gridColumns": 3,
      "gridRows": 4,
      "sortOrder": 4
    },
    "buttons": {
      "btn_fan_power": {
        "label": "電源",
        "action": "fan_power",
        "layout": { "x": 0, "y": 0, "w": 3, "h": 1, "variant": "info" },
        "ir_code": null // 初期は未学習
      }
    }
  }
};

function App() {
  const [devices, setDevices] = useState({});
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [currentTab, setCurrentTab] = useState("remote"); // 'remote' | 'master'

  // 擬似実行ログ & 学習制御用State
  const [logs, setLogs] = useState([]);
  const [learningState, setLearningState] = useState({ status: "idle", device: null, button: null });
  const [learningTimer, setLearningTimer] = useState(0);

  // マスタ追加フォーム用
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceCategory, setNewDeviceCategory] = useState("television");
  const [newDeviceCols, setNewDeviceCols] = useState(4);

  // ボタン追加フォーム用
  const [newButtonLabel, setNewButtonLabel] = useState("");
  const [newButtonAction, setNewButtonAction] = useState("");
  const [newButtonX, setNewButtonX] = useState(0);
  const [newButtonY, setNewButtonY] = useState(0);
  const [newButtonW, setNewButtonW] = useState(1);
  const [newButtonH, setNewButtonH] = useState(1);
  const [newButtonColor, setNewButtonColor] = useState("secondary");

  // LocalStorage から家電データをロード
  useEffect(() => {
    const saved = localStorage.getItem("smart_remote_devices");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDevices(parsed);
        if (Object.keys(parsed).length > 0) {
          setActiveDeviceId(Object.keys(parsed)[0]);
        }
      } catch (e) {
        setDevices(DEFAULT_DEVICES);
        setActiveDeviceId(Object.keys(DEFAULT_DEVICES)[0]);
      }
    } else {
      setDevices(DEFAULT_DEVICES);
      setActiveDeviceId(Object.keys(DEFAULT_DEVICES)[0]);
      localStorage.setItem("smart_remote_devices", JSON.stringify(DEFAULT_DEVICES));
    }
  }, []);

  // データを保存するヘルパー
  const saveDevices = (updated) => {
    setDevices(updated);
    localStorage.setItem("smart_remote_devices", JSON.stringify(updated));
  };

  // ログを追加するヘルパー（最大5件保持）
  const addLog = (message, type = "info", irData = null) => {
    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      message,
      type,
      irData
    };
    setLogs(prev => [newLog, ...prev].slice(0, 5));
  };

  // 触覚フィードバックの模倣
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
  };

  // リモコンのボタンを押したときの処理
  const handleRemoteClick = (deviceKey, buttonKey, btn) => {
    triggerHaptic();

    if (!btn.ir_code) {
      addLog(`❌ [${devices[deviceKey].metadata.name}] - [${btn.label}] は赤外線コードが未学習です。`, "error");
      return;
    }

    const { protocol, address, command } = btn.ir_code;
    const msg = `📡 [${devices[deviceKey].metadata.name}] - [${btn.label}] 信号を送信しました（${protocol}フォーマット）`;

    // 擬似ログとして追加
    addLog(msg, "success", { protocol, address, command });
  };

  // 新規家電登録
  const handleAddDevice = (e) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    const deviceId = `device_${Date.now()}`;
    const updated = {
      ...devices,
      [deviceId]: {
        metadata: {
          name: newDeviceName,
          category: newDeviceCategory,
          gridColumns: Number(newDeviceCols),
          gridRows: 6,
          sortOrder: Object.keys(devices).length + 1
        },
        buttons: {}
      }
    };
    saveDevices(updated);
    setActiveDeviceId(deviceId);
    setNewDeviceName("");
    addLog(`➕ 新しい家電「${newDeviceName}」を追加しました`, "info");
  };

  // 新規ボタン追加
  const handleAddButton = (e) => {
    e.preventDefault();
    if (!activeDeviceId || !newButtonLabel.trim() || !newButtonAction.trim()) return;

    const buttonId = `btn_${Date.now()}`;
    const targetDevice = devices[activeDeviceId];

    const updated = {
      ...devices,
      [activeDeviceId]: {
        ...targetDevice,
        buttons: {
          ...targetDevice.buttons,
          [buttonId]: {
            label: newButtonLabel,
            action: newButtonAction,
            layout: {
              x: Number(newButtonX),
              y: Number(newButtonY),
              w: Number(newButtonW),
              h: Number(newButtonH),
              variant: newButtonColor
            },
            ir_code: null
          }
        }
      }
    };
    saveDevices(updated);
    setNewButtonLabel("");
    setNewButtonAction("");
    addLog(`➕ [${targetDevice.metadata.name}] にボタン「${newButtonLabel}」を追加しました`, "info");
  };

  // 擬似赤外線学習の開始
  const startLearning = (deviceKey, buttonKey) => {
    triggerHaptic();
    setLearningState({
      status: "waiting",
      device: deviceKey,
      button: buttonKey
    });
    setLearningTimer(3); // 3秒の受信待機

    addLog(`⏳ [${devices[deviceKey].metadata.name}] のボタン 「${devices[deviceKey].buttons[buttonKey].label}」 の赤外線コード学習を開始しました（リモコンを押してください）`, "warning");
  };

  // 擬似学習タイマーのカウントダウン
  useEffect(() => {
    if (learningState.status !== "waiting") return;

    if (learningTimer > 0) {
      const timer = setTimeout(() => setLearningTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // 3秒経過後の自動擬似学習成功処理
      const { device: devKey, button: btnKey } = learningState;
      const targetDevice = devices[devKey];
      const targetBtn = targetDevice.buttons[btnKey];

      // ランダムなダミーコードの生成
      const protocols = ["NEC", "AEHA", "SONY", "PANASONIC"];
      const randomProto = protocols[Math.floor(Math.random() * protocols.length)];
      const randomAddr = "0x" + Math.floor(Math.random() * 65536).toString(16).toUpperCase();
      const randomCmd = "0x" + Math.floor(Math.random() * 65536).toString(16).toUpperCase();

      const updated = {
        ...devices,
        [devKey]: {
          ...targetDevice,
          buttons: {
            ...targetDevice.buttons,
            [btnKey]: {
              ...targetBtn,
              ir_code: {
                protocol: randomProto,
                address: randomAddr,
                command: randomCmd
              }
            }
          }
        }
      };

      saveDevices(updated);
      setLearningState({ status: "idle", device: null, button: null });
      addLog(`✅ 「${targetBtn.label}」 として赤外線コードの学習に成功しました！ (${randomProto}: Addr ${randomAddr}, Cmd ${randomCmd})`, "success");
    }
  }, [learningTimer, learningState]);

  // デバイスのリセット (モックの初期化用)
  const resetAllDevices = () => {
    if (window.confirm("リモコン情報を初期状態にリセットしますか？")) {
      saveDevices(DEFAULT_DEVICES);
      setActiveDeviceId(Object.keys(DEFAULT_DEVICES)[0]);
      setLogs([]);
      addLog("🔄 デバイス設定を初期モックデータにリセットしました", "info");
    }
  };

  const getCategoryIconName = (category) => {
    switch (category) {
      case "television": return "tv";
      case "aircon": return "thermometer";
      case "light": return "lightbulb";
      default: return "cpu";
    }
  };

  const activeDevice = devices[activeDeviceId];

  // Lucideアイコンの再描画更新
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [activeDeviceId, currentTab, logs, learningState]);

  return (
    <div className="app-container">
      {/* ヘッダー */}
      <header>
        <div className="brand-title">
          <i data-lucide="home"></i>
          <span>Smart Remote Mock</span>
        </div>
        <div className="nav-tabs">
          <button
            className={`nav-btn ${currentTab === 'remote' ? 'active' : ''}`}
            onClick={() => { triggerHaptic(); setCurrentTab('remote'); }}
          >
            リモコン
          </button>
          <button
            className={`nav-btn ${currentTab === 'master' ? 'active' : ''}`}
            onClick={() => { triggerHaptic(); setCurrentTab('master'); }}
          >
            設定
          </button>
        </div>
      </header>

      <main>
        {currentTab === 'remote' ? (
          /* ==========================================
             リモコン UI タブ
             ========================================== */
          <React.Fragment>
            {/* デバイス選択スイッチャー */}
            <div className="device-select-container">
              {Object.entries(devices).map(([key, dev]) => (
                <div
                  key={key}
                  className={`device-chip ${activeDeviceId === key ? 'active' : ''}`}
                  onClick={() => { triggerHaptic(); setActiveDeviceId(key); }}
                >
                  <i data-lucide={getCategoryIconName(dev.metadata.category)}></i>
                  {dev.metadata.name}
                </div>
              ))}
            </div>

            {/* 擬似学習ステータス表示 */}
            {learningState.status === "waiting" && (
              <div className="learning-indicator">
                <div className="learning-dot"></div>
                <div>赤外線受信待機中... あと {learningTimer} 秒</div>
              </div>
            )}

            {/* リモコン本体 */}
            {activeDevice ? (
              <div
                className="remote-body"
                style={{
                  gridTemplateColumns: `repeat(${activeDevice.metadata.gridColumns}, 1fr)`
                }}
              >
                {activeDevice.buttons && Object.keys(activeDevice.buttons).length > 0 ? (
                  Object.entries(activeDevice.buttons).map(([btnKey, btn]) => {
                    const hasIr = btn.ir_code !== null && btn.ir_code !== undefined;
                    return (
                      <button
                        key={btnKey}
                        className={`rem-btn ${btn.layout.variant || 'secondary'} ${!hasIr ? 'unlearned' : ''}`}
                        style={{
                          gridColumnStart: btn.layout.x + 1,
                          gridColumnEnd: btn.layout.x + 1 + btn.layout.w,
                          gridRowStart: btn.layout.y + 1,
                          gridRowEnd: btn.layout.y + 1 + btn.layout.h
                        }}
                        onClick={() => handleRemoteClick(activeDeviceId, btnKey, btn)}
                      >
                        <i data-lucide={btn.layout.variant === 'danger' ? 'power' : 'activity'}></i>
                        <span className="rem-btn-label">{btn.label}</span>
                      </button>
                    );
                  })
                ) : (
                  <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: 20 }}>
                    ボタンが定義されていません。「設定」から追加してください。
                  </div>
                )}
              </div>
            ) : null}

            {/* 擬似送信送信ログコンソール */}
            <div className="card console-card">
              <div className="card-title">
                <i data-lucide="terminal"></i>
                <span>送信信号ログ (ブラウザ完結)</span>
              </div>
              <div className="console-logs">
                {logs.length > 0 ? (
                  logs.map(log => (
                    <div key={log.id} className={`log-item ${log.type}`}>
                      <div className="log-header">
                        <span className="log-time">[{log.time}]</span>
                        <span>{log.message}</span>
                      </div>
                      {log.irData && (
                        <div className="log-details">
                          <code>Protocol: {log.irData.protocol} | Addr: {log.irData.address} | Cmd: {log.irData.command}</code>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="log-empty">リモコンのボタンを押すと、ここに送信ログが表示されます。</div>
                )}
              </div>
            </div>
          </React.Fragment>
        ) : (
          /* ==========================================
             家電マスタ管理タブ
             ========================================== */
          <React.Fragment>
            {/* 新規家電追加 */}
            <div className="card">
              <div className="card-title">
                <i data-lucide="plus-circle"></i>
                <span>新規家電の追加</span>
              </div>
              <form onSubmit={handleAddDevice} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">家電の表示名</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="例: サーキュレーター"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">カテゴリ</label>
                  <select
                    className="form-select"
                    value={newDeviceCategory}
                    onChange={(e) => setNewDeviceCategory(e.target.value)}
                  >
                    <option value="television">テレビ</option>
                    <option value="aircon">エアコン</option>
                    <option value="light">照明</option>
                    <option value="circulator">サーキュレーター</option>
                    <option value="fan">扇風機</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">リモコンの横カラム数 (1〜4列)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="4"
                    value={newDeviceCols}
                    onChange={(e) => setNewDeviceCols(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-submit">登録する</button>
              </form>
            </div>

            {/* ボタンレイアウト・学習 */}
            {activeDevice ? (
              <div className="card">
                <div className="card-title">
                  <i data-lucide="settings"></i>
                  <span>【{activeDevice.metadata.name}】ボタン・レイアウト編集</span>
                </div>

                <form onSubmit={handleAddButton} style={{ display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border-glass)', paddingBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">ボタン表示名</label>
                      <input className="form-input" value={newButtonLabel} onChange={e => setNewButtonLabel(e.target.value)} placeholder="例: 強運転" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">アクションID</label>
                      <input className="form-input" value={newButtonAction} onChange={e => setNewButtonAction(e.target.value)} placeholder="例: mode_strong" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    <div className="form-group">
                      <label className="form-label">配置X</label>
                      <input className="form-input" type="number" min="0" value={newButtonX} onChange={e => setNewButtonX(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">配置Y</label>
                      <input className="form-input" type="number" min="0" value={newButtonY} onChange={e => setNewButtonY(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">幅W</label>
                      <input className="form-input" type="number" min="1" value={newButtonW} onChange={e => setNewButtonW(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">高H</label>
                      <input className="form-input" type="number" min="1" value={newButtonH} onChange={e => setNewButtonH(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">テーマカラー</label>
                    <select className="form-select" value={newButtonColor} onChange={e => setNewButtonColor(e.target.value)}>
                      <option value="secondary">グレー (通常)</option>
                      <option value="primary">ブルー (推奨・サブ)</option>
                      <option value="success">グリーン (OK)</option>
                      <option value="danger">レッド (電源)</option>
                      <option value="info">水色 (冷暖房)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-submit">ボタン作成</button>
                </form>

                <div>
                  <div className="form-label" style={{ marginBottom: 10 }}>赤外線コードの擬似学習管理</div>
                  {activeDevice.buttons && Object.keys(activeDevice.buttons).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(activeDevice.buttons).map(([bKey, btn]) => (
                        <div key={bKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{btn.label}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: 8 }}>({btn.action})</span>
                            <div style={{ fontSize: '0.7rem' }}>
                              {btn.ir_code ? (
                                <span style={{ color: 'var(--success)' }}>学習済: {btn.ir_code.protocol}</span>
                              ) : (
                                <span style={{ color: 'var(--danger)' }}>未学習</span>
                              )}
                            </div>
                          </div>
                          <button
                            className="nav-btn"
                            style={{
                              background: 'var(--warning)',
                              color: '#000',
                              fontSize: '0.8rem',
                              padding: '5px 10px'
                            }}
                            onClick={() => startLearning(activeDeviceId, bKey)}
                            disabled={learningState.status === "waiting"}
                          >
                            模擬学習
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>ボタンが定義されていません</div>
                  )}
                </div>
              </div>
            ) : null}

            {/* リセット用のカード */}
            <div className="card" style={{ border: '1px solid rgba(255, 77, 109, 0.3)' }}>
              <div className="card-title" style={{ color: 'var(--danger)' }}>
                <i data-lucide="refresh-cw"></i>
                <span>ファクトリーリセット</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                LocalStorageに保存されたリモコンレイアウトをすべて消去し、デフォルトのデモ用データ（テレビ・エアコン・照明等）に再構成します。
              </p>
              <button className="btn-submit" style={{ background: 'var(--danger)' }} onClick={resetAllDevices}>
                データをリセット
              </button>
            </div>
          </React.Fragment>
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
