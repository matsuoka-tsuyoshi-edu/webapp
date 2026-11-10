/**
 * Where is OO? - 多言語 (日本語 / 英語) 対応マネージャー (i18n.js)
 * 
 * ALT（外国語指導助手）の先生が授業で円滑に活用できるよう、
 * 操作説明、ガイダンス、ステータス、ボタン等のUIシステムメッセージを日英切替可能にします。
 * 
 * 【重要方針】
 * 児童・生徒が学習・発話する「ターゲット英語表現」「建物の英語名」「問題文・解答構文」は
 * 日本語モード・英語モード問わずすべて【英語】のまま保持します。
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'whereisoo_lang';
    let currentLang = 'ja';

    const DICTIONARY = {
        ja: {
            // 共通
            'lang_btn_text': '🌐 English',
            'lang_btn_title': 'Switch to English (for ALT)',
            'nav_lobby': '🏠 ロビー',
            'btn_back_lobby': 'ロビーに戻る',
            'btn_restart': '最初からやり直す',
            'btn_close': '閉じる',
            'btn_listen': '🔊 きく',
            'btn_reconnect': '再接続',
            'status_waiting': '待機中...',
            'status_connected': '接続完了！',
            'status_disconnected': '切断されました',
            'status_error': '通信エラー',
            'status_offline': 'オフライン稼働',

            // index.html (ロビー)
            'lobby_subtitle': '3Dの街で楽しむ英語道案内ペアワーク教材 (Webリアルタイム版)',
            'card_a_title': '<span>🗺️</span> 【iPad A】地図役 (Navigator)',
            'card_a_desc': '街の2D全体地図を見ながら道案内をします。「部屋をつくる」を押すと4桁の合言葉が表示されます。',
            'btn_start_host': '🗺️ 部屋をつくって合言葉を出す',
            'card_b_title': '<span>🧭</span> 【iPad B】探検役 (Explorer)',
            'card_b_desc': '3Dの街を歩きます。iPad Aから4桁の合言葉を教えてもらい、入力してスタートしましょう！',
            'label_room_code': '相手(iPad A)の合言葉 (4桁数字):',
            'placeholder_room_code': '例: 1234',
            'btn_join_client': '🧭 合言葉を入れて探検スタート！',
            'guide_summary': '📖 遊び方・ルール & 会話の流れ',
            'guide_flow_title': '【対話の流れ（インフォメーション・ギャップ）】',
            'guide_step_1': '<strong>画面は見せ合いません！</strong>（向き合ってワイワイ言いながら、ことばだけで伝え合いましょう）',
            'guide_step_2': '<strong>iPad B（探検役）</strong>がスタートすると、画面に「行きたい場所（ミッション）」がランダムで出ます。',
            'guide_step_3': 'iPad BがiPad Aに英語で尋ねます: <code>"Excuse me. Where is the hospital?"</code>',
            'guide_step_4': '<strong>iPad A（地図役）</strong>は地図を見て、英語で道案内します: <code>"Go straight for two blocks. Turn right at the corner."</code>',
            'guide_step_5': 'iPad Bが指示を聞きながら3D街を歩き、光るサークルに入ったらゴール！',
            'guide_step_6': 'iPad B: <code>"Thank you!"</code> ➜ iPad A: <code>"You\'re welcome!"</code>',
            'guide_step_7': '「つぎの目的地に挑戦！」を押してどんどん新しい場所へ行きましょう！',
            'guide_phrase_title': '【よく使う英語表現】',
            'guide_p1': '<code>Excuse me. Where is the [建物名]?</code>（すみません、〜はどこですか？）',
            'guide_p2': '<code>Go straight for 1 block / 2 blocks.</code>（○ブロックまっすぐ進んで）',
            'guide_p3': '<code>Turn left / Turn right at the corner.</code>（角を左／右に曲がって）',
            'guide_p4': '<code>It\'s on your right / left.</code>（右手 / 左手に見えるよ）',
            'alert_input_room': '4桁の合言葉を入力してください（相手のiPad Aの画面上部に表示されています）。',

            // QRコード共有パネル (index.html)
            'qr_panel_title': '<span>📲</span> 教室で共有！ 参加用QRコード & URL',
            'qr_panel_desc': '児童・生徒のiPadカメラでこのQRコードをかざすだけで、すぐにこのロビーに入れます！',
            'qr_url_label': 'アクセスURL:',
            'btn_copy_url': '📋 URLをコピー',
            'btn_zoom_qr': '🔍 大画面で表示 (プロジェクター用)',
            'copied_msg': 'URLをコピーしました！',
            'zoom_modal_title': '🎉 教室のみんなでアクセス！ 🎉',
            'zoom_modal_desc': 'iPadのカメラを画面に向けてスキャンしてね！',

            // map.html (地図役)
            'room_label_prefix': '🔑 合言葉: ',
            'status_waiting_partner': '探検役(iPad B)の接続待機中...',
            'status_partner_connected': 'iPad B 接続中',
            'badge_waiting_question': '❓ 相手の質問待ち...',
            'badge_goal_prefix': '🎯 目的地: ',
            'label_toggle_player': '相手の位置',
            'btn_phrase_help': '💬 英語フレーズ (Help)',
            'drawer_title': '💬 道案内フレーズ',
            'tab_desc_level1': '【初級】基本のシンプルな指示表現。短くハッキリ伝えよう！',
            'tab_desc_level2': '【標準】ブロック数や角（corner）、左右を組み合わせた道案内！',
            'tab_desc_level3': '【応用】建物の名前（目印）や位置関係を使ったリアルな道案内！',
            'tab_desc_search': '【逆引き】「これ英語で何て言うんだっけ？」をすぐに探せるよ！',
            'companion_title': '👥 ペア探検隊',
            'stage_status_waiting': '❓ 質問待ち',
            'stage_status_guiding': 'へ案内中',
            'btn_go_ahead_label': '🟢 Go ahead! (どうぞ！)',
            'btn_go_ahead_title': '英語の案内が終わったら押して、探検役に『どうぞ！』と伝えよう',
            'btn_wait_label': '🔴 Wait! (ストップ！)',
            'btn_wait_title': 'タップすると探検役をストップさせます',
            'goal_modal_title': '🎉 GOAL! 🎉',
            'goal_modal_msg_a': '探検役が目的地に到着しました！',
            'goal_modal_teamwork': 'Great teamwork! 素晴らしい道案内でした！',
            'btn_wait_next_question': '⏳ つぎの質問を待つ',

            // town.html (探検役)
            'hud_status_waiting': '待機中...',
            'hud_status_connected': 'iPad A と同期中',
            'hud_goal_label': '🎯 目的地: ',
            'hud_dir_label': '🧭 方角: ',
            'lock_msg_listen': '相手の案内を聞こう',
            'lock_msg_wait': '合図を待とう',
            'lock_msg_go': 'Go ahead! 自由に進もう',
            'mission_title': '🎯 今日のミッション (Mission)',
            'mission_desc': 'あなたの行きたい場所が決まりました！',
            'mission_ask_title': '🗣️ iPad A(地図役)に英語で聞いてみよう！',
            'mission_ask_prompt': 'なんて質問するか思い出せるかな？<br>まずは声に出して質問してみよう！',
            'btn_reveal_help': '💡 英語のヒントを見る (Help)',
            'btn_tell_goal_text': 'Aさんに目的地を伝える (Tap!)',
            'btn_close_mission': '閉じる (OK)',
            'bubble_tap_guide': '👆 タップでAさんに伝える',
            'goal_modal_msg_b': '目的地に到着しました！',
            'goal_modal_found': 'You found it! ナイス探検でした！',
            'btn_next_mission': '🎯 つぎの目的地に挑戦！',
        },
        en: {
            // 共通
            'lang_btn_text': '🌐 日本語',
            'lang_btn_title': '日本語に切り替え',
            'nav_lobby': '🏠 Lobby',
            'btn_back_lobby': 'Back to Lobby',
            'btn_restart': 'Restart',
            'btn_close': 'Close',
            'btn_listen': '🔊 Listen',
            'btn_reconnect': 'Reconnect',
            'status_waiting': 'Waiting...',
            'status_connected': 'Connected!',
            'status_disconnected': 'Disconnected',
            'status_error': 'Connection Error',
            'status_offline': 'Offline Mode',

            // index.html (ロビー)
            'lobby_subtitle': '3D English Wayfinding Pairwork Activity (Real-time Web App)',
            'card_a_title': '<span>🗺️</span> [iPad A] Navigator (Guide)',
            'card_a_desc': 'Guide your partner using the 2D map. Tap "Create Room" to generate a 4-digit Room Code.',
            'btn_start_host': '🗺️ Create Room & Get Code',
            'card_b_title': '<span>🧭</span> [iPad B] Explorer (Traveler)',
            'card_b_desc': 'Explore the 3D town. Ask iPad A for the 4-digit code and tap start!',
            'label_room_code': "Partner's Room Code (4 digits):",
            'placeholder_room_code': 'e.g. 1234',
            'btn_join_client': '🧭 Enter Code & Start Exploring!',
            'guide_summary': '📖 How to Play & Conversation Flow',
            'guide_flow_title': '[Conversation Flow (Information Gap)]',
            'guide_step_1': "<strong>Do not look at each other's screens!</strong> (Face each other and communicate only through spoken English!)",
            'guide_step_2': 'When <strong>iPad B (Explorer)</strong> starts, a secret destination mission appears on screen.',
            'guide_step_3': 'iPad B asks iPad A in English: <code>"Excuse me. Where is the hospital?"</code>',
            'guide_step_4': '<strong>iPad A (Navigator)</strong> checks the map and guides: <code>"Go straight for two blocks. Turn right at the corner."</code>',
            'guide_step_5': 'iPad B walks in 3D following the directions. Entering the glowing circle reaches the goal!',
            'guide_step_6': 'iPad B: <code>"Thank you!"</code> ➜ iPad A: <code>"You\'re welcome!"</code>',
            'guide_step_7': 'Tap "Challenge Next Destination" to explore more places together!',
            'guide_phrase_title': '[Useful English Expressions]',
            'guide_p1': '<code>Excuse me. Where is the [landmark]?</code> (Asking for directions)',
            'guide_p2': '<code>Go straight for 1 block / 2 blocks.</code> (Giving straight directions)',
            'guide_p3': '<code>Turn left / Turn right at the corner.</code> (Turning at a corner)',
            'guide_p4': '<code>It\'s on your right / left.</code> (Specifying the side)',
            'alert_input_room': "Please enter the 4-digit Room Code (shown at the top of partner's iPad A).",

            // QR Code Sharing Panel (index.html)
            'qr_panel_title': '<span>📲</span> Share in Class! Access QR Code & URL',
            'qr_panel_desc': 'Scan this QR code with students’ iPad cameras to open this Lobby instantly!',
            'qr_url_label': 'Access URL:',
            'btn_copy_url': '📋 Copy URL',
            'btn_zoom_qr': '🔍 Enlarge (for Projector)',
            'copied_msg': 'URL copied to clipboard!',
            'zoom_modal_title': '🎉 Join with All Students! 🎉',
            'zoom_modal_desc': 'Point your iPad camera at this screen to scan and join!',

            // map.html (地図役)
            'room_label_prefix': '🔑 Code: ',
            'status_waiting_partner': 'Waiting for Explorer (iPad B)...',
            'status_partner_connected': 'iPad B Connected',
            'badge_waiting_question': "❓ Waiting for Partner's Question...",
            'badge_goal_prefix': '🎯 Target: ',
            'label_toggle_player': "Partner's Marker",
            'btn_phrase_help': '💬 English Phrases (Help)',
            'drawer_title': '💬 Direction Phrases',
            'tab_desc_level1': '[Beginner] Simple, direct instructions. Speak clearly and concisely!',
            'tab_desc_level2': '[Standard] Combine number of blocks, corners, and left/right turns!',
            'tab_desc_level3': '[Advanced] Use landmarks and relative positions for realistic wayfinding!',
            'tab_desc_search': '[Reverse Lookup] Quick help for "How do I say this in English?"',
            'companion_title': '👥 Pair Team',
            'stage_status_waiting': '❓ Waiting',
            'stage_status_guiding': ' guiding',
            'btn_go_ahead_label': '🟢 Go ahead! (Proceed)',
            'btn_go_ahead_title': 'Tap when you finish explaining to allow Explorer to move',
            'btn_wait_label': '🔴 Wait! (Stop)',
            'btn_wait_title': 'Tap to pause Explorer',
            'goal_modal_title': '🎉 GOAL! 🎉',
            'goal_modal_msg_a': 'Explorer reached the destination!',
            'goal_modal_teamwork': 'Great teamwork! Excellent navigation!',
            'btn_wait_next_question': '⏳ Wait for Next Question',

            // town.html (探検役)
            'hud_status_waiting': 'Waiting...',
            'hud_status_connected': 'Synced with iPad A',
            'hud_goal_label': '🎯 Target: ',
            'hud_dir_label': '🧭 Dir: ',
            'lock_msg_listen': "Listen to Navigator's directions",
            'lock_msg_wait': 'Wait for signal',
            'lock_msg_go': 'Go ahead! Move forward',
            'mission_title': '🎯 Today’s Mission',
            'mission_desc': 'Your target destination has been decided!',
            'mission_ask_title': '🗣️ Ask iPad A (Navigator) in English!',
            'mission_ask_prompt': 'Can you remember how to ask?<br>Say it out loud to your partner first!',
            'btn_reveal_help': '💡 Show English Hint (Help)',
            'btn_tell_goal_text': 'Tell Navigator (Tap!)',
            'btn_close_mission': 'Close (OK)',
            'bubble_tap_guide': '👆 Tap to tell Navigator',
            'goal_modal_msg_b': 'You reached the destination!',
            'goal_modal_found': 'You found it! Great exploration!',
            'btn_next_mission': '🎯 Challenge Next Destination!',
        }
    };

    // 逆引き質問フレーズの日英マッピング
    const SEARCH_QUESTIONS = {
        ja: {
            q1: "「角で曲がって」って何て言う？",
            q2: "「〇〇の角で曲がって」って何て言う？",
            q3: "「〇〇の隣にあるよ」って何て言う？",
            q4: "「〇〇の向かい側だよ」って何て言う？",
            q5: "「行き過ぎちゃった！」って何て言う？",
            q6: "「もう1回言って？」って何て言う？",
            q7: "「ゆっくり言って？」って何て言う？",
            q8: "「どういたしまして」って何て言う？"
        },
        en: {
            q1: 'How to say "Turn at the corner"?',
            q2: 'How to say "Turn at the corner of [Landmark]"?',
            q3: 'How to say "It\'s next to [Landmark]"?',
            q4: 'How to say "It\'s across from [Landmark]"?',
            q5: 'How to say "You passed it!"?',
            q6: 'How to say "One more time, please"?',
            q7: 'How to say "Slowly, please"?',
            q8: 'How to say "You\'re welcome!"?'
        }
    };

    const I18n = {
        /**
         * 初期化: URLパラメータまたはlocalStorageから言語設定を読み込む
         */
        init() {
            const params = new URLSearchParams(window.location.search);
            const urlLang = params.get('lang');
            if (urlLang === 'en' || urlLang === 'ja') {
                currentLang = urlLang;
            } else {
                try {
                    currentLang = localStorage.getItem(STORAGE_KEY) || 'ja';
                } catch (e) {
                    currentLang = 'ja';
                }
            }
            this.applyLanguage(currentLang);
        },

        getLang() {
            return currentLang;
        },

        setLang(lang) {
            currentLang = (lang === 'en') ? 'en' : 'ja';
            try {
                localStorage.setItem(STORAGE_KEY, currentLang);
            } catch (e) {}
            this.applyLanguage(currentLang);
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
        },

        toggleLang() {
            this.setLang(currentLang === 'ja' ? 'en' : 'ja');
        },

        t(key, fallback = '') {
            const dict = DICTIONARY[currentLang] || DICTIONARY.ja;
            if (dict && dict[key] !== undefined) {
                return dict[key];
            }
            if (DICTIONARY.ja && DICTIONARY.ja[key] !== undefined) {
                return DICTIONARY.ja[key];
            }
            return fallback;
        },

        getSearchQuestion(qKey) {
            const map = SEARCH_QUESTIONS[currentLang] || SEARCH_QUESTIONS.ja;
            return map[qKey] || '';
        },

        applyLanguage(lang) {
            document.documentElement.lang = lang;

            // data-i18n 属性の要素を置換
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const val = this.t(key);
                if (val !== undefined && val !== '') {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        el.placeholder = val;
                    } else {
                        el.innerHTML = val;
                    }
                }
            });

            // data-i18n-title 属性
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                const val = this.t(key);
                if (val) {
                    el.title = val;
                }
            });

            // 言語切替ボタンの表示更新
            document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
                btn.innerHTML = this.t('lang_btn_text');
                btn.title = this.t('lang_btn_title');
            });
        }
    };

    global.I18n = I18n;

})(typeof window !== 'undefined' ? window : this);
