import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ==========================================
// Firebase 設定 (適宜書き換えて使用)
// ==========================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const { useState, useEffect, useRef } = React;

function App() {
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState({});
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [currentTab, setCurrentTab] = useState("remote"); // 'remote' | 'master'
  const [learningState, setLearningState] = useState({ status: "idle" });
  const [toastMessage, setToastMessage] = useState(null);

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

  // トースト自動消去用
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Firebase 匿名認証 & リアルタイムリスナー設定
  useEffect(() => {
    // 1. 匿名ログイン
    signInAnonymously(auth)
      .then(() => showToast("セキュアログイン成功"))
      .catch((error) => console.error("Firebase Login Error", error));

    onAuthStateChanged(auth, (usr) => {
      if (usr) {
        setUser(usr);
        // 2. 家電リスト監視
        const devicesRef = ref(db, "devices");
        onValue(devicesRef, (snapshot) => {
          const data = snapshot.val() || {};
          setDevices(data);
          // 初期アクティブデバイス設定
          if (Object.keys(data).length > 0 && !activeDeviceId) {
            setActiveDeviceId(Object.keys(data)[0]);
          }
        });

        // 3. 学習ステータス監視
        const learningRef = ref(db, "learning_state");
        onValue(learningRef, (snapshot) => {
          const val = snapshot.val() || { status: "idle" };
          setLearningState(val);
          if (val.status === "success") {
            showToast("赤外線コードの学習に成功しました！");
          } else if (val.status === "error") {
            showToast("学習に失敗しました。リトライしてください。");
          }
        });
      }
    });
  }, [db]);

  const showToast = (msg) => setToastMessage(msg);

  // 触覚フィードバック (Web Vibration API)
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(40); // 40ms 振動
    }
  };

  // リモコンボタンタップ時の処理
  const handleRemoteClick = (deviceKey, buttonKey, irCode) => {
    triggerHaptic();
    if (!irCode) {
      showToast("このボタンは赤外線コードが未学習です");
      return;
    }

    // コマンド発火
    const cmdRef = ref(db, "commands/active_command");
    set(cmdRef, {
      device: deviceKey,
      button: buttonKey,
      timestamp: Date.now()
    }).then(() => {
      showToast(`${devices[deviceKey].buttons[buttonKey].label} を送信しました`);
    });
  };

  // 新規家電登録
  const handleAddDevice = (e) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    const deviceId = `device_${Date.now()}`;
    const deviceRef = ref(db, `devices/${deviceId}`);
    
    set(deviceRef, {
      metadata: {
        name: newDeviceName,
        category: newDeviceCategory,
        gridColumns: Number(newDeviceCols),
        gridRows: 6,
        sortOrder: Object.keys(devices).length + 1
      },
      buttons: {}
    }).then(() => {
      showToast("新家電を登録しました");
      setActiveDeviceId(deviceId);
      setNewDeviceName("");
    });
  };

  // 新規ボタン追加
  const handleAddButton = (e) => {
    e.preventDefault();
    if (!activeDeviceId || !newButtonLabel.trim() || !newButtonAction.trim()) return;

    const buttonId = `btn_${Date.now()}`;
    const btnRef = ref(db, `devices/${activeDeviceId}/buttons/${buttonId}`);

    set(btnRef, {
      label: newButtonLabel,
      action: newButtonAction,
      layout: {
        x: Number(newButtonX),
        y: Number(newButtonY),
        w: Number(newButtonW),
        h: Number(newButtonH),
        variant: newButtonColor
      },
      ir_code: null // なし
    }).then(() => {
      showToast("ボタンを追加しました");
      setNewButtonLabel("");
      setNewButtonAction("");
    });
  };

  // 学習シーケンス開始の指示
  const startLearning = (deviceKey, buttonKey) => {
    triggerHaptic();
    const lrnRef = ref(db, "learning_state");
    set(lrnRef, {
      status: "waiting",
      target_device: deviceKey,
      target_button: buttonKey,
      timestamp: Date.now()
    }).then(() => {
      showToast("学習待機モードに入りました。物理リモコンを押してください。");
    });
  };

  // デバイスの背景カテゴリ装飾用
  const getCategoryIconName = (category) => {
    switch (category) {
      case "television": return "tv";
      case "aircon": return "thermometer";
      case "light": return "lightbulb";
      default: return "cpu";
    }
  };

  const activeDevice = devices[activeDeviceId];

  return (
    <div className="app-container">
      {/* ヘッダー */}
      <header>
        <div className="brand-title">
          <i data-lucide="home"></i>
          <span>Smart Remote</span>
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

      {/* メインの切り替え表示 */}
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

            {/* 学習ステータスインジケータ */}
            {learningState.status === "waiting" && (
              <div className="learning-indicator">
                <div className="learning-dot"></div>
                <div>赤外線受信待機中: リモコン信号を送ってください...</div>
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
                {activeDevice.buttons ? (
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
                        onClick={() => handleRemoteClick(activeDeviceId, btnKey, btn.ir_code)}
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
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
                デバイスを選択するか、設定タブから新規登録してください。
              </div>
            )}
          </React.Fragment>
        ) : (
          /* ==========================================
             家電マスタ・UI配置 管理タブ
             ========================================== */
          <React.Fragment>
            {/* 家電追加用カード */}
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
                    placeholder="例: クーラー"
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
                    <option value="aircon">エアコン / 温度センサー</option>
                    <option value="light">親照明</option>
                    <option value="circulator">サーキュレーター / 扇風機</option>
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

            {/* ボタン・UIレイアウト・学習の設定カード */}
            {activeDevice ? (
              <div className="card">
                <div className="card-title">
                  <i data-lucide="settings"></i>
                  <span>【{activeDevice.metadata.name}】ボタン・レイアウト編集</span>
                </div>
                
                {/* 新規ボタン追加フォーム */}
                <form onSubmit={handleAddButton} style={{ display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border-glass)', paddingBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">ボタン表示文字</label>
                      <input className="form-input" value={newButtonLabel} onChange={e => setNewButtonLabel(e.target.value)} placeholder="例: 弱風" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">アクションID</label>
                      <input className="form-input" value={newButtonAction} onChange={e => setNewButtonAction(e.target.value)} placeholder="例: mode_weak" />
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
                    <label className="form-label">ボタンテーマカラー</label>
                    <select className="form-select" value={newButtonColor} onChange={e => setNewButtonColor(e.target.value)}>
                      <option value="secondary">グレー (通常)</option>
                      <option value="primary">ブルー (推奨・サブ)</option>
                      <option value="success">グリーン (OK)</option>
                      <option value="danger">レッド (電源用)</option>
                      <option value="info">水色 (冷房用)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-submit">ボタン作成</button>
                </form>

                {/* ボタンごとの赤外線学習ステータスと実行トリガー一覧 */}
                <div>
                  <div className="form-label" style={{ marginBottom: 10 }}>赤外線学習管理 (学習させたいボタンの学習ボタンを押す)</div>
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
                          >
                            学習開始
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>まずは上にボタンを追加してください。</div>
                  )}
                </div>
              </div>
            ) : null}
          </React.Fragment>
        )}
      </main>

      {/* トースト表示 */}
      {toastMessage && (
        <div className="toast">
          <i data-lucide="info" style={{ width: 16, height: 16 }}></i>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// Reactアプリのレンダリング
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);

// アイコンをレンダリング後に描画（Lucide適用）
setTimeout(() => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}, 500);
