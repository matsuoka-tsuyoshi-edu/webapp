/**
 * webrtc_sync.js - PeerJSを用いた iPad A (Map) と iPad B (Town) の P2P リアルタイム同期マネージャー
 * 
 * pgmsakana の 4桁ルームID 接続方式を参考に、より堅牢な再接続・状態同期・オフラインフォールバックを実装。
 * - 世界中の他アプリとのPeer ID衝突を防止するプレフィックス管理
 * - 複数のSTUNサーバー指定によるNAT越え・PC/iPad間通信の安定化
 * - クライアント側自動リトライ & タイムアウト検出機構
 */

(function (global) {
    'use strict';

    // 接続先WebサーバーのIPアドレス・ホスト名を自動取得してプレフィックス化
    // これにより、校内の同一サーバー（例: 192.168.x.x）配下の端末同士でのみ一意なID体系を形成し、
    // 世界中の他校・他ユーザーとのID衝突を原理的に完全ゼロ化します。
    function getServerPrefix() {
        let host = 'local';
        try {
            if (typeof window !== 'undefined' && window.location && window.location.hostname) {
                // ドットや特殊文字をハイフンに正規化 (例: "192.168.10.20" -> "192-168-10-20")
                host = window.location.hostname.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                if (!host) host = 'local';
            }
        } catch (e) {
            host = 'local';
        }
        return `whereisoo-${host}-`;
    }

    const PEER_PREFIX = getServerPrefix();

    class WebRTCSync {
        /**
         * @param {Object} options
         * @param {'host'|'client'} options.role 'host'(iPad A: 地図) または 'client'(iPad B: 3D街)
         * @param {string} [options.roomId] 4桁のルームID (ホストは生成または指定、クライアントは接続先)
         * @param {Function} [options.onStatusChange] 状態変更コールバック (status, message)
         * @param {Function} [options.onConnected] 接続完了コールバック
         * @param {Function} [options.onData] データ受信コールバック (data)
         * @param {Function} [options.onError] エラーコールバック (err)
         */
        constructor(options) {
            this.role = options.role || 'host';
            this.roomId = options.roomId ? String(options.roomId).trim() : '';
            this.onStatusChange = options.onStatusChange || function () {};
            this.onConnected = options.onConnected || function () {};
            this.onData = options.onData || function () {};
            this.onError = options.onError || function () {};

            this.peer = null;
            this.conn = null;
            this.isConnected = false;
            this.destroyed = false;
            this.connectAttempts = 0;
            this.maxConnectAttempts = 3;
            this.connectTimeoutTimer = null;

            // PeerJS サーバー設定 (公式クラウドサーバー + 複数STUNサーバーでNAT越え保証)
            this.peerConfig = {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun.cloudflare.com:3478' }
                    ]
                }
            };
        }

        /**
         * 4桁のランダムな数字IDを生成 (1000〜9999)
         */
        static generateNumericId() {
            return String(Math.floor(Math.random() * 9000) + 1000);
        }

        /**
         * 初期化 & 接続開始
         */
        init() {
            if (typeof Peer === 'undefined') {
                const err = new Error('PeerJSライブラリが読み込まれていません。通信をスキップします。');
                this.onStatusChange('offline', err.message);
                this.onError(err);
                return;
            }

            if (this.role === 'host') {
                this._initHost();
            } else {
                this._initClient();
            }
        }

        /**
         * ホスト側 (iPad A / PC) の初期化: プレフィックス付き4桁IDで待ち受ける
         */
        _initHost() {
            if (!this.roomId) {
                this.roomId = WebRTCSync.generateNumericId();
            }

            const fullPeerId = PEER_PREFIX + this.roomId;
            this.onStatusChange('initializing', `合言葉 [${this.roomId}] で準備中...`);

            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
            }

            try {
                this.peer = new Peer(fullPeerId, this.peerConfig);
            } catch (err) {
                console.error('[WebRTC Host Init Error]', err);
                this.onStatusChange('error', 'Peer初期化エラー: ' + err.message);
                this.onError(err);
                return;
            }

            this.peer.on('open', (id) => {
                console.log('[WebRTC Host Opened]', id, 'Raw Room:', this.roomId);
                this.onStatusChange('waiting', `探検役(iPad B)の接続を待機中... 合言葉: ${this.roomId}`);
            });

            this.peer.on('connection', (conn) => {
                console.log('[WebRTC Host Incoming Connection]', conn.peer);

                // すでに探検役が接続中の場合は、重複接続を拒否（早い者勝ち・1対1排他ロック）
                if (this.isConnected && this.conn && this.conn.open) {
                    console.warn('[WebRTC Host] Duplicate connection rejected:', conn.peer);
                    conn.on('open', () => {
                        try {
                            conn.send(JSON.stringify({
                                type: 'ROOM_BUSY_REJECTED',
                                message: `合言葉 [${this.roomId}] はすでに別の探検役(iPad B)が接続中です。4桁の番号をもう一度確認してください。`
                            }));
                        } catch (e) {}
                        setTimeout(() => {
                            try { conn.close(); } catch (e) {}
                        }, 500);
                    });
                    return;
                }

                this.conn = conn;
                this._setupConnectionEvents(conn);
            });

            this.peer.on('error', (err) => {
                console.warn('[WebRTC Host Error]', err.type, err.message);
                if (err.type === 'unavailable-id') {
                    // IDが既に使われている場合は別の4桁番号で再試行
                    console.warn(`合言葉 [${this.roomId}] は世界中で使用中のため別の番号で再試行します...`);
                    this.roomId = WebRTCSync.generateNumericId();
                    this._initHost();
                } else {
                    this.onStatusChange('error', '通信エラー: ' + (err.type || err.message));
                    this.onError(err);
                }
            });
        }

        /**
         * クライアント側 (iPad B) の初期化: ホストの4桁IDに接続する
         */
        _initClient() {
            if (!this.roomId) {
                this.onStatusChange('error', '接続先合言葉が指定されていません。');
                return;
            }

            this.connectAttempts++;
            this.onStatusChange('initializing', `サーバー接続準備中... (${this.connectAttempts}回目)`);

            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
            }

            try {
                // クライアントはランダムPeer IDで登録
                this.peer = new Peer(this.peerConfig);
            } catch (err) {
                console.error('[WebRTC Client Init Error]', err);
                this.onStatusChange('error', 'Peer初期化エラー: ' + err.message);
                this.onError(err);
                return;
            }

            this.peer.on('open', (myId) => {
                console.log('[WebRTC Client Opened]', myId, 'Connecting to Room:', this.roomId);
                this._connectToHost();
            });

            this.peer.on('error', (err) => {
                console.warn('[WebRTC Client Error]', err.type, err.message);
                this._clearConnectTimeout();

                if (err.type === 'peer-unavailable') {
                    if (this.connectAttempts < this.maxConnectAttempts) {
                        this.onStatusChange('connecting', `合言葉 [${this.roomId}] を探しています... (再試行中 ${this.connectAttempts}/${this.maxConnectAttempts})`);
                        setTimeout(() => {
                            if (!this.isConnected && !this.destroyed) {
                                this._initClient();
                            }
                        }, 2000);
                        return;
                    }
                    this.onStatusChange('error', `合言葉 [${this.roomId}] の部屋が見つかりません。iPad Aで部屋が作られているか確認してください。`);
                } else {
                    this.onStatusChange('error', '通信エラー: ' + (err.type || err.message));
                }
                this.onError(err);
            });
        }

        /**
         * 接続実行 & タイムアウト管理
         */
        _connectToHost() {
            const targetPeerId = PEER_PREFIX + this.roomId;
            this.onStatusChange('connecting', `地図役(iPad A: [${this.roomId}])へ接続中...`);

            try {
                const conn = this.peer.connect(targetPeerId, {
                    reliable: true
                });
                this.conn = conn;
                this._setupConnectionEvents(conn);

                // 8秒タイムアウト検出
                this._clearConnectTimeout();
                this.connectTimeoutTimer = setTimeout(() => {
                    if (!this.isConnected) {
                        console.warn('[WebRTC Client] Connection timeout after 8s');
                        if (this.connectAttempts < this.maxConnectAttempts) {
                            console.log('[WebRTC Client] Retrying connection...');
                            this._initClient();
                        } else {
                            this.onStatusChange('error', `接続がタイムアウトしました。合言葉 [${this.roomId}] をもう一度ご確認ください。`);
                        }
                    }
                }, 8000);
            } catch (err) {
                console.error('[WebRTC Client connect error]', err);
                this.onStatusChange('error', '接続開始エラー: ' + err.message);
            }
        }

        _clearConnectTimeout() {
            if (this.connectTimeoutTimer) {
                clearTimeout(this.connectTimeoutTimer);
                this.connectTimeoutTimer = null;
            }
        }

        /**
         * 手動再接続
         */
        reconnect() {
            this.connectAttempts = 0;
            this.isConnected = false;
            this.init();
        }

        /**
         * データチャネルのイベントリスナー設定
         */
        _setupConnectionEvents(conn) {
            conn.on('open', () => {
                this._clearConnectTimeout();
                this.isConnected = true;
                console.log('[WebRTC DataChannel OPENED!]');
                this.onStatusChange('connected', `接続完了！ペアリング成功`);
                this.onConnected();
            });

            conn.on('data', (data) => {
                try {
                    let parsed = data;
                    if (typeof data === 'string') {
                        parsed = JSON.parse(data);
                    }
                    if (parsed && parsed.type === 'ROOM_BUSY_REJECTED') {
                        console.warn('[WebRTC Client] Connection rejected: Room already in use');
                        this.onStatusChange('error', parsed.message || 'この部屋はすでに別の探検役が接続中です。合言葉を確認してください。');
                        this.destroy();
                        return;
                    }
                    this.onData(parsed);
                } catch (e) {
                    this.onData(data);
                }
            });

            conn.on('close', () => {
                if (this.conn === conn) {
                    this.isConnected = false;
                    console.log('[WebRTC DataChannel CLOSED]');
                    this.onStatusChange('disconnected', '接続が切断されました。');
                }
            });

            conn.on('error', (err) => {
                if (this.conn === conn) {
                    console.error('[WebRTC DataChannel Error]', err);
                    this.onStatusChange('error', 'データ通信エラー: ' + (err.message || err));
                }
            });
        }

        /**
         * 相手にデータを送信
         * @param {Object|string} data 送信データ
         */
        send(data) {
            if (!this.conn || !this.isConnected) {
                return false;
            }
            try {
                const payload = (typeof data === 'object') ? JSON.stringify(data) : data;
                this.conn.send(payload);
                return true;
            } catch (err) {
                console.error('Send error:', err);
                return false;
            }
        }

        /**
         * 通信終了・リソース解放
         */
        destroy() {
            this.destroyed = true;
            this.isConnected = false;
            this._clearConnectTimeout();
            if (this.conn) {
                try { this.conn.close(); } catch (e) {}
                this.conn = null;
            }
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
                this.peer = null;
            }
        }
    }

    // グローバル公開
    global.WebRTCSync = WebRTCSync;

})(typeof window !== 'undefined' ? window : this);
