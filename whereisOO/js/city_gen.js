/**
 * city_gen.js - 決定論的擬似乱数(PRNG)による街並み・マップ生成エンジン
 * 
 * 同一のシード値(文字列または整数)から、iPad A(2D地図)とiPad B(3D街)で
 * 完全に一致するグリッド街並み、建物、ランドマーク、スタート地点を生成します。
 * また、目的地(Goal)の動的なランダム選択・切り替え機能を提供します。
 */

(function (global) {
    'use strict';

    // -------------------------------------------------------------
    // 1. 決定論的 PRNG (Mulberry32) & シード文字列ハッシュ化
    // -------------------------------------------------------------

    /** 文字列または数値を32bit整数ハッシュに変換 */
    function stringToSeed(str) {
        if (typeof str === 'number') {
            return (str >>> 0);
        }
        str = String(str || 'default_seed');
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        }
        return (h >>> 0);
    }

    /** Mulberry32 疑似乱数生成器クラス */
    class SeededRNG {
        constructor(seed) {
            this.seed = stringToSeed(seed);
            this.state = this.seed;
        }

        /** 0以上1未満の疑似乱数を生成 */
        next() {
            let t = (this.state += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }

        /** min以上max未満の実数 */
        range(min, max) {
            return min + (max - min) * this.next();
        }

        /** min以上max以下の整数 */
        intRange(min, max) {
            return Math.floor(this.range(min, max + 1));
        }

        /** 配列からランダムに1つ選択 */
        choice(array) {
            if (!array || array.length === 0) return null;
            return array[Math.floor(this.next() * array.length)];
        }

        /** 配列をシャッフル (Fisher-Yates) */
        shuffle(array) {
            const arr = array.slice();
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(this.next() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }
    }

    // -------------------------------------------------------------
    // 2. ランドマーク定義 (英語道案内で頻出の施設)
    // -------------------------------------------------------------
    const LANDMARK_DEFINITIONS = [
        {
            id: 'hospital',
            name: 'Hospital',
            jpName: '病院',
            color: '#ffffff',
            accentColor: '#e53935',
            roofColor: '#d32f2f',
            icon: '🏥',
            description: 'White building with red cross',
            height: 3,
            signText: 'HOSPITAL'
        },
        {
            id: 'convenience_store',
            name: 'Convenience Store',
            jpName: 'コンビニ',
            color: '#e0f2f1',
            accentColor: '#00897b',
            roofColor: '#fb8c00',
            icon: '🏪',
            description: 'Bright shop with orange and green lines',
            height: 1.5,
            signText: 'CONVENIENCE'
        },
        {
            id: 'library',
            name: 'Library',
            jpName: '図書館',
            color: '#d7ccc8',
            accentColor: '#5d4037',
            roofColor: '#8d6e63',
            icon: '📚',
            description: 'Brick-style building with bookshelves',
            height: 2.2,
            signText: 'LIBRARY'
        },
        {
            id: 'post_office',
            name: 'Post Office',
            jpName: '郵便局',
            color: '#ffffff',
            accentColor: '#d32f2f',
            roofColor: '#c62828',
            icon: '🏣',
            description: 'Red post box and white facade',
            height: 1.8,
            signText: 'POST OFFICE'
        },
        {
            id: 'police_station',
            name: 'Police Station',
            jpName: '交番・警察署',
            color: '#eceff1',
            accentColor: '#1e88e5',
            roofColor: '#0d47a1',
            icon: '👮',
            description: 'Blue and white building with patrol lamp',
            height: 2,
            signText: 'POLICE'
        },
        {
            id: 'station',
            name: 'Train Station',
            jpName: '駅',
            color: '#cfd8dc',
            accentColor: '#37474f',
            roofColor: '#263238',
            icon: '🚉',
            description: 'Large station entrance with clock',
            height: 2.5,
            signText: 'STATION'
        },
        {
            id: 'restaurant',
            name: 'Restaurant',
            jpName: 'レストラン',
            color: '#fff3e0',
            accentColor: '#f57c00',
            roofColor: '#e65100',
            icon: '🍽️',
            description: 'Cozy diner with outdoor awnings',
            height: 1.8,
            signText: 'RESTAURANT'
        },
        {
            id: 'school',
            name: 'School',
            jpName: '学校',
            color: '#fff8e1',
            accentColor: '#fbc02d',
            roofColor: '#f57f17',
            icon: '🏫',
            description: 'School building with a large clock tower',
            height: 3,
            signText: 'SCHOOL'
        },
        {
            id: 'park',
            name: 'Central Park',
            jpName: '公園',
            color: '#a5d6a7',
            accentColor: '#2e7d32',
            roofColor: '#1b5e20',
            icon: '🌳',
            description: 'Green park with trees and fountain',
            height: 0.5,
            signText: 'PARK',
            isPark: true
        },
        {
            id: 'bakery',
            name: 'Bakery',
            jpName: 'パン屋',
            color: '#fff3e0',
            accentColor: '#ff9800',
            roofColor: '#d84315',
            icon: '🥐',
            description: 'Warm aroma of freshly baked bread',
            height: 1.8,
            signText: 'BAKERY'
        },
        {
            id: 'supermarket',
            name: 'Supermarket',
            jpName: 'スーパーマーケット',
            color: '#e8f5e9',
            accentColor: '#43a047',
            roofColor: '#2e7d32',
            icon: '🏬',
            description: 'Large grocery and daily goods store',
            height: 2.2,
            signText: 'SUPERMARKET'
        },
        {
            id: 'cafe',
            name: 'Cafe',
            jpName: 'カフェ',
            color: '#efebe9',
            accentColor: '#795548',
            roofColor: '#4e342e',
            icon: '☕',
            description: 'Coffee shop with striped terrace awnings',
            height: 1.6,
            signText: 'CAFE'
        },
        {
            id: 'museum',
            name: 'Museum',
            jpName: '博物館・美術館',
            color: '#ede7f6',
            accentColor: '#7e57c2',
            roofColor: '#512da8',
            icon: '🏛️',
            description: 'Classical museum with grand entrance pillars',
            height: 2.8,
            signText: 'MUSEUM'
        },
        {
            id: 'fire_station',
            name: 'Fire Station',
            jpName: '消防署',
            color: '#ffebee',
            accentColor: '#e53935',
            roofColor: '#b71c1c',
            icon: '🚒',
            description: 'Red emergency fire station with siren beacon',
            height: 2.4,
            signText: 'FIRE STATION'
        },
        {
            id: 'drugstore',
            name: 'Pharmacy',
            jpName: '薬局・ドラッグストア',
            color: '#e0f7fa',
            accentColor: '#00acc1',
            roofColor: '#006064',
            icon: '💊',
            description: 'Medicine and wellness drugstore',
            height: 1.7,
            signText: 'PHARMACY'
        },
        {
            id: 'bank',
            name: 'Bank',
            jpName: '銀行',
            color: '#eceff1',
            accentColor: '#546e7a',
            roofColor: '#37474f',
            icon: '🏦',
            description: 'Sturdy financial building with gold crest',
            height: 2.6,
            signText: 'BANK'
        },
        {
            id: 'bookstore',
            name: 'Bookstore',
            jpName: '本屋',
            color: '#fbe9e7',
            accentColor: '#ff7043',
            roofColor: '#bf360c',
            icon: '📖',
            description: 'Store packed with books, magazines and manga',
            height: 1.9,
            signText: 'BOOKSTORE'
        },
        {
            id: 'gym',
            name: 'Gym',
            jpName: '体育館・スポーツジム',
            color: '#e1f5fe',
            accentColor: '#039be5',
            roofColor: '#01579b',
            icon: '⚽',
            description: 'Sports complex with arena roof',
            height: 2.7,
            signText: 'SPORTS GYM'
        },
        {
            id: 'amusement_park',
            name: 'Amusement Park',
            jpName: '遊園地',
            color: '#fff9c4',
            accentColor: '#e91e63',
            roofColor: '#d81b60',
            icon: '🎡',
            description: 'Lively theme park with giant Ferris wheel and attractions',
            height: 3.2,
            signText: 'AMUSEMENT PARK',
            isAmusementPark: true,
            isLarge: true
        },
        {
            id: 'city_hall',
            name: 'City Hall',
            jpName: '市役所',
            color: '#eceff1',
            accentColor: '#1976d2',
            roofColor: '#37474f',
            icon: '🏢',
            description: 'Civic municipal hall with national flag and clock',
            height: 2.8,
            signText: 'CITY HALL'
        }
    ];

    // 一般建物のカラーパレット
    const GENERAL_BUILDING_COLORS = [
        { wall: '#cfd8dc', roof: '#90a4ae', accent: '#607d8b' },
        { wall: '#ffe0b2', roof: '#bcaaa4', accent: '#ffb74d' },
        { wall: '#e1bee7', roof: '#ba68c8', accent: '#8e24aa' },
        { wall: '#b3e5fc', roof: '#81d4fa', accent: '#0288d1' },
        { wall: '#dcedc8', roof: '#aed581', accent: '#689f38' },
        { wall: '#fff9c4', roof: '#fff176', accent: '#fbc02d' },
        { wall: '#f5f5f5', roof: '#bdbdbd', accent: '#757575' }
    ];

    // -------------------------------------------------------------
    // 3. 街マップ定数
    // -------------------------------------------------------------
    const CELL_SIZE = 4.0;
    const BLOCKS_X = 4;
    const BLOCKS_Z = 4;
    const BLOCK_CELL_SIZE = 3;
    const ROAD_WIDTH = 1;

    const GRID_SIZE_X = BLOCKS_X * BLOCK_CELL_SIZE + (BLOCKS_X + 1) * ROAD_WIDTH; // 17
    const GRID_SIZE_Z = BLOCKS_Z * BLOCK_CELL_SIZE + (BLOCKS_Z + 1) * ROAD_WIDTH; // 17

    const CELL_ROAD = 0;
    const CELL_INTERSECTION = 1;
    const CELL_SIDEWALK = 2;
    const CELL_BUILDING = 3;
    const CELL_PARK = 4;
    const CELL_LANDMARK = 5;

    /**
     * ランドマーク情報からゴール情報オブジェクトを作成
     */
    function createGoalFromLandmark(landmarkObj) {
        return {
            landmarkId: landmarkObj.id,
            landmarkName: landmarkObj.name,
            landmarkJpName: landmarkObj.jpName,
            icon: landmarkObj.icon,
            cellX: landmarkObj.frontRoadCell.x,
            cellZ: landmarkObj.frontRoadCell.z,
            worldX: landmarkObj.frontRoadWorld.x,
            worldZ: landmarkObj.frontRoadWorld.z,
            radius: CELL_SIZE * 1.2,
            landmark: landmarkObj
        };
    }

    /**
     * 指定されたシード値およびカスタムランドマークから一意の街データを生成する
     * @param {string|number} seedInput シード値
     * @param {Array} [customLandmarksInput] 教員指定のカスタムランドマーク配列
     * @returns {Object} 街並み完全データオブジェクト
     */
    function generateCity(seedInput, customLandmarksInput) {
        const seedStr = (seedInput !== undefined && seedInput !== null && seedInput !== '') ? String(seedInput).trim() : '01';
        const rng = new SeededRNG(seedStr);

        // 1. グリッド配列の初期化
        const grid = [];
        for (let z = 0; z < GRID_SIZE_Z; z++) {
            grid[z] = new Array(GRID_SIZE_X).fill(CELL_ROAD);
        }

        function isRoadCell(x, z) {
            const step = BLOCK_CELL_SIZE + ROAD_WIDTH;
            return (x % step === 0) || (z % step === 0);
        }

        function isIntersection(x, z) {
            const step = BLOCK_CELL_SIZE + ROAD_WIDTH;
            return (x % step === 0) && (z % step === 0);
        }

        for (let z = 0; z < GRID_SIZE_Z; z++) {
            for (let x = 0; x < GRID_SIZE_X; x++) {
                if (isIntersection(x, z)) {
                    grid[z][x] = CELL_INTERSECTION;
                } else if (isRoadCell(x, z)) {
                    grid[z][x] = CELL_ROAD;
                } else {
                    grid[z][x] = CELL_BUILDING;
                }
            }
        }

        // 2. 街区（ブロック）のリスト作成 & 2x1 または 1x2 の大型街区を1つだけ生成
        const step = BLOCK_CELL_SIZE + ROAD_WIDTH;
        const rawBlocks = [];
        for (let bz = 0; bz < BLOCKS_Z; bz++) {
            for (let bx = 0; bx < BLOCKS_X; bx++) {
                const startX = bx * step + ROAD_WIDTH;
                const startZ = bz * step + ROAD_WIDTH;
                rawBlocks.push({
                    bx: bx,
                    bz: bz,
                    startX: startX,
                    startZ: startZ,
                    endX: startX + BLOCK_CELL_SIZE - 1,
                    endZ: startZ + BLOCK_CELL_SIZE - 1,
                    width: BLOCK_CELL_SIZE,
                    height: BLOCK_CELL_SIZE
                });
            }
        }

        // 2x1 (横長) または 1x2 (縦長) のペア候補を生成
        const mergePairs = [];
        // 横長ペア (2x1)
        for (let bz = 0; bz < BLOCKS_Z; bz++) {
            for (let bx = 0; bx < BLOCKS_X - 1; bx++) {
                mergePairs.push({ type: '2x1', bx1: bx, bz1: bz, bx2: bx + 1, bz2: bz });
            }
        }
        // 縦長ペア (1x2)
        for (let bz = 0; bz < BLOCKS_Z - 1; bz++) {
            for (let bx = 0; bx < BLOCKS_X; bx++) {
                mergePairs.push({ type: '1x2', bx1: bx, bz1: bz, bx2: bx, bz2: bz + 1 });
            }
        }

        const chosenPair = rng.choice(mergePairs);
        const mergedBlock = {
            id: `block_large_${chosenPair.bx1}_${chosenPair.bz1}`,
            bx: chosenPair.bx1,
            bz: chosenPair.bz1,
            startX: chosenPair.bx1 * step + ROAD_WIDTH,
            startZ: chosenPair.bz1 * step + ROAD_WIDTH,
            endX: (chosenPair.type === '2x1') ? ((chosenPair.bx2 * step + ROAD_WIDTH) + BLOCK_CELL_SIZE - 1) : (chosenPair.bx1 * step + ROAD_WIDTH + BLOCK_CELL_SIZE - 1),
            endZ: (chosenPair.type === '1x2') ? ((chosenPair.bz2 * step + ROAD_WIDTH) + BLOCK_CELL_SIZE - 1) : (chosenPair.bz1 * step + ROAD_WIDTH + BLOCK_CELL_SIZE - 1),
            width: (chosenPair.type === '2x1') ? (BLOCK_CELL_SIZE * 2 + ROAD_WIDTH) : BLOCK_CELL_SIZE, // 7 または 3
            height: (chosenPair.type === '1x2') ? (BLOCK_CELL_SIZE * 2 + ROAD_WIDTH) : BLOCK_CELL_SIZE, // 7 または 3
            isLarge: true,
            largeType: chosenPair.type,
            isLandmark: false,
            landmark: null,
            building: null
        };

        // 中間の道路セルを建物セルに上書き（道がなくなり、衝突判定で侵入不可になる）
        if (chosenPair.type === '2x1') {
            const midX = mergedBlock.startX + BLOCK_CELL_SIZE;
            for (let z = mergedBlock.startZ; z <= mergedBlock.endZ; z++) {
                grid[z][midX] = CELL_BUILDING;
            }
        } else {
            const midZ = mergedBlock.startZ + BLOCK_CELL_SIZE;
            for (let x = mergedBlock.startX; x <= mergedBlock.endX; x++) {
                grid[midZ][x] = CELL_BUILDING;
            }
        }

        // 残りの単一ブロック (14個) を構築
        const normalBlocks = [];
        rawBlocks.forEach(b => {
            const isPair1 = (b.bx === chosenPair.bx1 && b.bz === chosenPair.bz1);
            const isPair2 = (b.bx === chosenPair.bx2 && b.bz === chosenPair.bz2);
            if (!isPair1 && !isPair2) {
                normalBlocks.push({
                    id: `block_${b.bx}_${b.bz}`,
                    bx: b.bx,
                    bz: b.bz,
                    startX: b.startX,
                    startZ: b.startZ,
                    endX: b.endX,
                    endZ: b.endZ,
                    width: b.width,
                    height: b.height,
                    isLarge: false,
                    isLandmark: false,
                    landmark: null,
                    building: null
                });
            }
        });

        // 3. ランドマークの準備 & 配置
        // (A) 教員指定カスタムランドマークの正規化 & 🛡️教育安心フィルターによる多層防御サニタイズ
        const INAPPROPRIATE_EMOJI_REGEX = /[\u{1F3E9}\u{1F51E}\u{1F37A}\u{1F37B}\u{1F377}\u{1F378}\u{1F379}\u{1F376}\u{1F6AC}\u{1F48A}\u{1F489}\u{1F52B}\u{1F4A3}\u{1F52A}\u{2694}\u{1F5E1}\u{1F3B0}\u{1F3B2}\u{1F459}\u{1F48B}\u{1F4A9}\u{1F480}\u{1F595}]/u;
        const INAPPROPRIATE_WORDS_REGEX = /(ラブホ|風俗|カジノ|パチンコ|スロット|バー|居酒屋|酒|ビール|タバコ|煙草|銃|ピストル|ライフル|武器|ナイフ|包丁|爆弾|薬物|麻薬|毒|殺|死|エッチ|性交|下着|監獄|刑務所|牢屋|love\s*hotel|casino|pachinko|slot\b|bar\b|pub\b|liquor|alcohol|beer|wine|tobacco|cigarette|cigar|gun\b|rifle|weapon|knife|bomb|drug|narcotic|poison|kill|murder|death|dead|prison|jail|gamble|gambling|sex\b|erotic|porn)/i;

        function isEducationallySafe(name, jpName, icon) {
            const text = `${name || ''} ${jpName || ''}`.toLowerCase();
            const iconStr = icon || '';
            if (INAPPROPRIATE_EMOJI_REGEX.test(iconStr) || INAPPROPRIATE_EMOJI_REGEX.test(text)) return false;
            if (INAPPROPRIATE_WORDS_REGEX.test(text) || INAPPROPRIATE_WORDS_REGEX.test(iconStr)) return false;
            return true;
        }

        let customLandmarks = [];
        if (Array.isArray(customLandmarksInput)) {
            customLandmarks = customLandmarksInput
                .filter(c => c && c.name && isEducationallySafe(c.name, c.jpName, c.icon))
                .map((c, idx) => ({
                    id: c.id || ('custom_' + idx + '_' + c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')),
                    name: c.name.trim(),
                    jpName: (c.jpName || c.name).trim(),
                    icon: (c.icon || '📍').trim(),
                    color: c.color || '#e8eaf6',
                    accentColor: c.accentColor || '#3f51b5',
                    roofColor: c.roofColor || '#1a237e',
                    description: c.description || c.name,
                    height: 2.4,
                    signText: (c.signText || c.name).toUpperCase().slice(0, 16),
                    isCustom: true
                }));
        }

        // (B) 2x1/1x2の大型ブロックには遊園地 (Amusement Park) を優先配置
        const amusementParkDef = LANDMARK_DEFINITIONS.find(lm => lm.id === 'amusement_park') || {
            id: 'amusement_park',
            name: 'Amusement Park',
            jpName: '遊園地',
            icon: '🎡',
            color: '#fff9c4',
            accentColor: '#e91e63',
            roofColor: '#d81b60',
            height: 3.2,
            signText: 'AMUSEMENT PARK',
            isAmusementPark: true,
            isLarge: true
        };

        // (C) 標準ランドマーク (遊園地を除く) をシャッフル
        const standardOthers = LANDMARK_DEFINITIONS.filter(lm => lm.id !== 'amusement_park');
        const shuffledStandard = rng.shuffle(standardOthers);

        // カスタムランドマークを先頭に優先配置し、残りを標準から補充 (合計7施設)
        const normalLandmarkPool = customLandmarks.concat(shuffledStandard);

        // シャッフルした通常ブロック14個のうち先頭7個にランドマークを配置
        const shuffledNormalBlocks = rng.shuffle(normalBlocks);
        const landmarksInCity = [];

        // ヘルパー: ブロックにランドマークを割り当てて登録
        function assignLandmarkToBlock(block, lmDef) {
            block.isLandmark = true;
            block.landmark = Object.assign({}, lmDef);

            for (let z = block.startZ; z <= block.endZ; z++) {
                for (let x = block.startX; x <= block.endX; x++) {
                    grid[z][x] = lmDef.isPark ? CELL_PARK : CELL_LANDMARK;
                }
            }

            const centerX = (block.startX + block.width / 2) * CELL_SIZE;
            const centerZ = (block.startZ + block.height / 2) * CELL_SIZE;

            // 接道 (Front Road) オプション
            let frontOptions = [];
            if (block.width > block.height) {
                // 2x1
                frontOptions = [
                    { x: block.startX + 3, z: block.startZ - 1, face: 'North' },
                    { x: block.startX + 3, z: block.endZ + 1, face: 'South' },
                    { x: block.startX - 1, z: block.startZ + 1, face: 'West' },
                    { x: block.endX + 1, z: block.startZ + 1, face: 'East' }
                ];
            } else if (block.height > block.width) {
                // 1x2
                frontOptions = [
                    { x: block.startX + 1, z: block.startZ - 1, face: 'North' },
                    { x: block.startX + 1, z: block.endZ + 1, face: 'South' },
                    { x: block.startX - 1, z: block.startZ + 3, face: 'West' },
                    { x: block.endX + 1, z: block.startZ + 3, face: 'East' }
                ];
            } else {
                // 1x1
                frontOptions = [
                    { x: block.startX + 1, z: block.startZ - 1, face: 'North' },
                    { x: block.startX + 1, z: block.endZ + 1, face: 'South' },
                    { x: block.startX - 1, z: block.startZ + 1, face: 'West' },
                    { x: block.endX + 1, z: block.startZ + 1, face: 'East' }
                ];
            }

            const validFronts = frontOptions.filter(f => f.x >= 0 && f.x < GRID_SIZE_X && f.z >= 0 && f.z < GRID_SIZE_Z);
            const frontRoad = validFronts.length > 0 ? rng.choice(validFronts) : { x: block.startX, z: block.startZ - 1, face: 'North' };

            const landmarkEntry = {
                id: lmDef.id,
                name: lmDef.name,
                jpName: lmDef.jpName,
                icon: lmDef.icon,
                color: lmDef.color,
                accentColor: lmDef.accentColor,
                roofColor: lmDef.roofColor,
                signText: lmDef.signText,
                isPark: !!lmDef.isPark,
                isAmusementPark: !!lmDef.isAmusementPark,
                isLarge: !!block.isLarge,
                isCustom: !!lmDef.isCustom,
                blockId: block.id,
                startX: block.startX,
                startZ: block.startZ,
                endX: block.endX,
                endZ: block.endZ,
                widthCells: block.width,
                heightCells: block.height,
                worldX: centerX,
                worldZ: centerZ,
                frontRoadCell: { x: frontRoad.x, z: frontRoad.z },
                frontRoadWorld: { x: (frontRoad.x + 0.5) * CELL_SIZE, z: (frontRoad.z + 0.5) * CELL_SIZE },
                facing: frontRoad.face,
                height: lmDef.height
            };

            landmarksInCity.push(landmarkEntry);
        }

        // 大型ブロックに遊園地を配置
        assignLandmarkToBlock(mergedBlock, amusementParkDef);

        // 通常ブロックにランドマーク7個を配置
        const numNormalLandmarks = Math.min(7, normalLandmarkPool.length, shuffledNormalBlocks.length);
        for (let i = 0; i < numNormalLandmarks; i++) {
            assignLandmarkToBlock(shuffledNormalBlocks[i], normalLandmarkPool[i]);
        }

        // 4. 残りの通常ブロック (7個) を一般建物に
        for (let i = numNormalLandmarks; i < shuffledNormalBlocks.length; i++) {
            const block = shuffledNormalBlocks[i];
            const palette = rng.choice(GENERAL_BUILDING_COLORS);
            const bldgHeight = rng.range(1.5, 3.8);

            block.isLandmark = false;
            block.building = {
                id: block.id,
                type: 'general',
                colors: palette,
                height: bldgHeight,
                startX: block.startX,
                startZ: block.startZ,
                endX: block.endX,
                endZ: block.endZ,
                widthCells: block.width,
                heightCells: block.height,
                worldX: (block.startX + block.width / 2) * CELL_SIZE,
                worldZ: (block.startZ + block.height / 2) * CELL_SIZE
            };
        }

        // 全ブロックリストを統合 (大型1個 + 通常14個 = 計15街区)
        const allBlocks = [mergedBlock].concat(shuffledNormalBlocks);

        // 5. 街路樹・街灯
        const streetProps = [];
        allBlocks.forEach(block => {
            const corners = [
                { x: block.startX, z: block.startZ },
                { x: block.endX, z: block.startZ },
                { x: block.startX, z: block.endZ },
                { x: block.endX, z: block.endZ }
            ];
            corners.forEach((c, idx) => {
                if (rng.next() < 0.4) {
                    streetProps.push({
                        type: (idx % 2 === 0) ? 'tree' : 'lamp',
                        cellX: c.x,
                        cellZ: c.z,
                        worldX: (c.x + 0.5) * CELL_SIZE,
                        worldZ: (c.z + 0.5) * CELL_SIZE
                    });
                }
            });
        });

        // 6. デフォルトゴールの選定（公園以外のランドマーク）
        const potentialGoals = landmarksInCity.filter(lm => !lm.isPark);
        const goalLandmark = rng.choice(potentialGoals) || landmarksInCity[0];
        const goal = createGoalFromLandmark(goalLandmark);

        // 7. スタート地点の選定
        const roadCells = [];
        for (let z = 0; z < GRID_SIZE_Z; z++) {
            for (let x = 0; x < GRID_SIZE_X; x++) {
                if (grid[z][x] === CELL_ROAD || grid[z][x] === CELL_INTERSECTION) {
                    const dist = Math.abs(x - goalLandmark.frontRoadCell.x) + Math.abs(z - goalLandmark.frontRoadCell.z);
                    if (dist >= 6) {
                        roadCells.push({ x: x, z: z, dist: dist });
                    }
                }
            }
        }

        let startCell = null;
        if (roadCells.length > 0) {
            const goodStarts = roadCells.filter(c => c.dist >= 7 && c.dist <= 13);
            startCell = rng.choice(goodStarts.length > 0 ? goodStarts : roadCells);
        } else {
            startCell = { x: 0, z: 0, dist: 8 };
        }

        const DIRECTIONS = [
            { name: 'North', angle: 0, dx: 0, dz: -1 },
            { name: 'East', angle: 90, dx: 1, dz: 0 },
            { name: 'South', angle: 180, dx: 0, dz: 1 },
            { name: 'West', angle: 270, dx: -1, dz: 0 }
        ];

        const validDirs = DIRECTIONS.filter(d => {
            const nx = startCell.x + d.dx;
            const nz = startCell.z + d.dz;
            return (nx >= 0 && nx < GRID_SIZE_X && nz >= 0 && nz < GRID_SIZE_Z &&
                (grid[nz][nx] === CELL_ROAD || grid[nz][nx] === CELL_INTERSECTION));
        });
        const initialDir = validDirs.length > 0 ? rng.choice(validDirs) : DIRECTIONS[1];

        const spawn = {
            cellX: startCell.x,
            cellZ: startCell.y !== undefined ? startCell.y : startCell.z,
            worldX: (startCell.x + 0.5) * CELL_SIZE,
            worldZ: (startCell.z + 0.5) * CELL_SIZE,
            direction: initialDir.name,
            angle: initialDir.angle
        };

        const cityObj = {
            seed: seedStr,
            gridSizeX: GRID_SIZE_X,
            gridSizeZ: GRID_SIZE_Z,
            cellSize: CELL_SIZE,
            worldWidth: GRID_SIZE_X * CELL_SIZE,
            worldDepth: GRID_SIZE_Z * CELL_SIZE,
            grid: grid,
            blocks: allBlocks,
            landmarks: landmarksInCity,
            streetProps: streetProps,
            spawn: spawn,
            goal: goal,
            cellTypes: {
                ROAD: CELL_ROAD,
                INTERSECTION: CELL_INTERSECTION,
                SIDEWALK: CELL_SIDEWALK,
                BUILDING: CELL_BUILDING,
                PARK: CELL_PARK,
                LANDMARK: CELL_LANDMARK
            },

            /**
             * 目的地のランドマークを変更する
             * @param {string} landmarkId 変更先ランドマークID
             * @returns {Object|null} 更新されたgoalオブジェクト
             */
            setGoalById: function (landmarkId) {
                const targetLm = this.landmarks.find(lm => lm.id === landmarkId);
                if (targetLm) {
                    this.goal = createGoalFromLandmark(targetLm);
                    return this.goal;
                }
                return null;
            },

            /**
             * 公園以外のランドマークからランダムに新しい目的地を選定する
             * 現在地（またはスポーン地点）から一定距離離れたランドマークを優先選定
             * @param {string} [excludeId] 直前の目的地IDを除外
             * @param {number} [currentX] 現在のワールドX座標（省略時はスポーン地点）
             * @param {number} [currentZ] 現在のワールドZ座標（省略時はスポーン地点）
             * @param {number} [minDistance=14] 最低離す距離（ワールド単位、約5ブロック相当）
             * @returns {Object} 選定されたgoalオブジェクト
             */
            pickRandomGoal: function (excludeId, currentX, currentZ, minDistance = 14) {
                let candidates = this.landmarks.filter(lm => !lm.isPark);
                if (excludeId && candidates.length > 1) {
                    candidates = candidates.filter(lm => lm.id !== excludeId);
                }

                // 現在地（指定がなければスポーン地点）からの距離が minDistance 以上の候補を優先
                const refX = (currentX !== undefined && currentX !== null) ? currentX : this.spawn.worldX;
                const refZ = (currentZ !== undefined && currentZ !== null) ? currentZ : this.spawn.worldZ;

                const farCandidates = candidates.filter(lm => {
                    const dist = Math.hypot(lm.frontRoadWorld.x - refX, lm.frontRoadWorld.z - refZ);
                    return dist >= minDistance;
                });

                const pool = (farCandidates.length > 0) ? farCandidates : candidates;
                const chosen = pool[Math.floor(Math.random() * pool.length)] || this.landmarks[0];
                this.goal = createGoalFromLandmark(chosen);
                return this.goal;
            }
        };

        return cityObj;
    }

    // グローバル公開
    global.CityGen = {
        generateCity: generateCity,
        createGoalFromLandmark: createGoalFromLandmark,
        SeededRNG: SeededRNG,
        CELL_SIZE: CELL_SIZE,
        GRID_SIZE_X: GRID_SIZE_X,
        GRID_SIZE_Z: GRID_SIZE_Z,
        LANDMARK_DEFINITIONS: LANDMARK_DEFINITIONS
    };

})(typeof window !== 'undefined' ? window : this);
