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
     * 指定されたシード値から一意の街データを生成する
     * @param {string|number} seedInput シード値
     * @returns {Object} 街並み完全データオブジェクト
     */
    function generateCity(seedInput) {
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

        // 2. 街区（ブロック）のリスト作成
        const blocks = [];
        const step = BLOCK_CELL_SIZE + ROAD_WIDTH;
        for (let bz = 0; bz < BLOCKS_Z; bz++) {
            for (let bx = 0; bx < BLOCKS_X; bx++) {
                const startX = bx * step + ROAD_WIDTH;
                const startZ = bz * step + ROAD_WIDTH;
                blocks.push({
                    id: `block_${bx}_${bz}`,
                    bx: bx,
                    bz: bz,
                    startX: startX,
                    startZ: startZ,
                    endX: startX + BLOCK_CELL_SIZE - 1,
                    endZ: startZ + BLOCK_CELL_SIZE - 1,
                    width: BLOCK_CELL_SIZE,
                    height: BLOCK_CELL_SIZE,
                    isLandmark: false,
                    landmark: null,
                    building: null
                });
            }
        }

        // 3. ランドマークの配置
        const shuffledBlocks = rng.shuffle(blocks);
        const availableLandmarks = rng.shuffle(LANDMARK_DEFINITIONS);

        const landmarksInCity = [];
        const numLandmarksToPlace = Math.min(6, availableLandmarks.length, blocks.length);

        for (let i = 0; i < numLandmarksToPlace; i++) {
            const block = shuffledBlocks[i];
            const lmDef = availableLandmarks[i];

            block.isLandmark = true;
            block.landmark = Object.assign({}, lmDef);

            for (let z = block.startZ; z <= block.endZ; z++) {
                for (let x = block.startX; x <= block.endX; x++) {
                    grid[z][x] = lmDef.isPark ? CELL_PARK : CELL_LANDMARK;
                }
            }

            const centerX = (block.startX + block.width / 2) * CELL_SIZE;
            const centerZ = (block.startZ + block.height / 2) * CELL_SIZE;

            const frontOptions = [
                { x: block.startX + 1, z: block.startZ - 1, face: 'North' },
                { x: block.startX + 1, z: block.endZ + 1, face: 'South' },
                { x: block.startX - 1, z: block.startZ + 1, face: 'West' },
                { x: block.endX + 1, z: block.startZ + 1, face: 'East' }
            ];
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

        // 4. 一般建物の生成
        for (let i = numLandmarksToPlace; i < shuffledBlocks.length; i++) {
            const block = shuffledBlocks[i];
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

        // 5. 街路樹・街灯
        const streetProps = [];
        blocks.forEach(block => {
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
            blocks: blocks,
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
             * @param {string} [excludeId] 直前の目的地IDを除外
             * @returns {Object} 選定されたgoalオブジェクト
             */
            pickRandomGoal: function (excludeId) {
                let candidates = this.landmarks.filter(lm => !lm.isPark);
                if (excludeId && candidates.length > 1) {
                    candidates = candidates.filter(lm => lm.id !== excludeId);
                }
                const chosen = candidates[Math.floor(Math.random() * candidates.length)] || this.landmarks[0];
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
        GRID_SIZE_Z: GRID_SIZE_Z
    };

})(typeof window !== 'undefined' ? window : this);
