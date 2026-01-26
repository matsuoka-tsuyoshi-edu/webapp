import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

// --- 1. シーン & カメラ設定 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const frustumSize = 10;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2, 0.1, 1000
);
camera.position.set(0, 50, 0);
camera.lookAt(0, 0, 0);
camera.zoom = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.domElement.style.touchAction = 'none'; 
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
scene.add(dirLight);

// Controls
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableRotate = false; 
controls.enableZoom = true;

// --- 2. 方眼紙 (3軸) ---
const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xdddddd);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

const gridXY = new THREE.GridHelper(20, 20, 0x888888, 0xeeeeee);
gridXY.rotation.x = Math.PI / 2;
gridXY.position.set(0, 10, 0);
gridXY.visible = false; 
scene.add(gridXY);

const gridYZ = new THREE.GridHelper(20, 20, 0x888888, 0xeeeeee);
gridYZ.rotation.z = Math.PI / 2;
gridYZ.position.set(0, 10, 0);
gridYZ.visible = false; 
scene.add(gridYZ);

const planeGeometry = new THREE.PlaneGeometry(100, 100);
const clickPlane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ visible: false }));
clickPlane.rotation.x = -Math.PI / 2;
scene.add(clickPlane);

// --- 3. 変数管理 ---
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 1; 

const pointer = new THREE.Vector2();

// 作図用
let points = [];
let markers = [];
let lineObj = null;

// 立体用
let createdMesh = null;
let edgesObj = null;
let lidMaterial = null;

// 切断用
let cutPoints = [];
let cutLineObj = null;
let cutResultMeshes = [];
let selectedEdge = null;
let isDraggingCutPoint = false;

// 状態管理
let appMode = 'create'; 
let isSolidCreated = false;

// 高さ調整用
let isDraggingHeight = false;
let dragStartY = 0;
let startScaleZ = 1;

// 切断後ドラッグ用
let isDraggingResult = false;
let dragResultMesh = null;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();

// デバッグ用
const debugContent = document.getElementById('debug-content');

// UI要素
const uiGroups = {
    create: document.getElementById('ui-create'),
    view: document.getElementById('ui-view'),
    cutting: document.getElementById('ui-cutting'),
    result: document.getElementById('ui-result')
};
const btnConnect = document.getElementById('connect-btn');
const btnExecute = document.getElementById('execute-btn');
const btnToggleGrid = document.getElementById('toggle-grid-btn');

// ログ関数
function log(msg, type = "INFO") {
    if (!debugContent) return;
    let color = "#00ff00"; 
    if (type === "VERTEX") color = "#ff00ff"; 
    if (type === "EDGE") color = "#00ffff"; 
    if (type === "FACE") color = "#ffff00"; 
    if (type === "ERROR") color = "#ff0000"; 
    if (type === "SYSTEM") color = "#ffffff"; 

    const time = new Date().toLocaleTimeString().split(' ')[0];
    debugContent.innerHTML = `[${time}] <span style="color:${color}">${msg}</span><br>` + debugContent.innerHTML;
    if (debugContent.innerHTML.length > 800) debugContent.innerHTML = debugContent.innerHTML.substring(0, 800);
}

// 高さ表示切替
let isGridVisible = false;
btnToggleGrid.addEventListener('click', () => {
    isGridVisible = !isGridVisible;
    gridXY.visible = isGridVisible;
    gridYZ.visible = isGridVisible;
    
    if (isGridVisible) {
        btnToggleGrid.classList.add('active');
        btnToggleGrid.textContent = "📏 高さ非表示";
    } else {
        btnToggleGrid.classList.remove('active');
        btnToggleGrid.textContent = "📏 高さを表示";
    }
});

function switchUI(mode) {
    appMode = mode;
    Object.values(uiGroups).forEach(el => el.style.display = 'none');
    if (uiGroups[mode]) uiGroups[mode].style.display = 'flex';

    debugContent.innerHTML = ""; 
    
    let modeName = "";
    if (mode === 'create') {
        modeName = "モード: 作成";
        btnToggleGrid.style.display = 'none'; 
        isGridVisible = false;
        gridXY.visible = false;
        gridYZ.visible = false;
        btnToggleGrid.classList.remove('active');
        btnToggleGrid.textContent = "📏 高さを表示";
    } else {
        btnToggleGrid.style.display = 'block'; 
    }

    if (mode === 'view') modeName = "モード: 閲覧 (高さ調整可)";
    if (mode === 'cutting') modeName = "モード: 切断 (辺をタップ)";
    if (mode === 'result') modeName = "モード: 結果 (上の立体を移動可)";
    
    log(modeName, "SYSTEM");

    if (controls) {
        if (mode === 'cutting') {
            controls.enableRotate = false;
            log(">> 回転ロック (3点指定中)", "SYSTEM");
        } else if (mode === 'view' || mode === 'result') {
            controls.enableRotate = true; 
            controls.enabled = true;
            log(">> 回転OK", "SYSTEM");
        }
    }
}

function snapToGrid(val) { return Math.round(val); }

function getIntersect(clientX, clientY, target, recursive = true) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    
    const targets = Array.isArray(target) ? target : [target || clickPlane];
    const intersects = raycaster.intersectObjects(targets, recursive);
    return intersects.length > 0 ? intersects[0] : null;
}

// --- 4. アニメーション制御 ---
let animState = 'idle'; 
let animStartTime = 0;
const animDuration = 1500;
const startVals = { pos: new THREE.Vector3(), zoom: 1, target: new THREE.Vector3() };
const endVals = { pos: new THREE.Vector3(45, 35, 45), zoom: 0.75, target: new THREE.Vector3(0, 2.5, 0) };
let animMeshStartTime = 0;
let isMeshAnimFinished = false; 

function startCreateAnimation() {
    if (controls) { controls.dispose(); controls = null; }
    startVals.pos.copy(camera.position);
    startVals.zoom = camera.zoom;
    startVals.target.set(0, 0, 0); 
    animState = 'animating';
    animStartTime = performance.now();
    animMeshStartTime = animStartTime + 600; 
    isMeshAnimFinished = false; 
}

// --- 5. メインループ ---
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();

    if (animState === 'animating') {
        let p = (now - animStartTime) / animDuration;
        if (p >= 1.0) {
            p = 1.0;
            animState = 'done'; 
            camera.position.copy(endVals.pos);
            camera.zoom = endVals.zoom;
            camera.lookAt(endVals.target);
            camera.updateProjectionMatrix();

            controls = new OrbitControls(camera, renderer.domElement);
            controls.target.copy(endVals.target);
            controls.enableDamping = true;
            controls.enableRotate = true;
            controls.enableZoom = true;
            controls.update();
            
            switchUI('view');
        } else {
            const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            camera.position.lerpVectors(startVals.pos, endVals.pos, ease);
            camera.zoom = startVals.zoom + (endVals.zoom - startVals.zoom) * ease;
            camera.updateProjectionMatrix();
            const curTarget = new THREE.Vector3().lerpVectors(startVals.target, endVals.target, ease);
            camera.lookAt(curTarget);
        }
    }

    if (createdMesh && (animState === 'animating' || animState === 'done') && !isMeshAnimFinished) {
        let mp = (now - animMeshStartTime) / 1200;
        if (mp < 0) mp = 0; 
        if (mp >= 1.0) {
            mp = 1.0;
            isMeshAnimFinished = true; 
        }
        if (!isDraggingHeight) {
            const elastic = mp === 0 ? 0 : mp === 1 ? 1 : Math.pow(2, -10 * mp) * Math.sin((mp * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
            createdMesh.scale.z = elastic;
        }
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
}
animate();


// --- 6. イベントハンドラ ---

function showTapFeedback(position) {
    const feedbackGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const feedbackMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const feedbackMesh = new THREE.Mesh(feedbackGeo, feedbackMat);
    feedbackMesh.position.copy(position);
    scene.add(feedbackMesh);
    setTimeout(() => {
        scene.remove(feedbackMesh);
        feedbackGeo.dispose();
        feedbackMat.dispose();
    }, 1000);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    // 1. 作成モード
    if (appMode === 'create') {
        event.target.setPointerCapture(event.pointerId);
        event.target.dataset.startX = event.clientX;
        event.target.dataset.startY = event.clientY;
        return;
    }

    // 2. 閲覧モード (高さ調整)
    if (appMode === 'view' && createdMesh) {
        const intersect = getIntersect(event.clientX, event.clientY, createdMesh, false);
        if (intersect && intersect.face) {
            const normal = intersect.face.normal.clone();
            normal.transformDirection(createdMesh.matrixWorld);
            if (normal.y > 0.5) { 
                isDraggingHeight = true;
                dragStartY = event.clientY;
                startScaleZ = createdMesh.scale.z;
                if (controls) controls.enabled = false; 
                if (lidMaterial) lidMaterial.color.setHex(0xffaaaa);
                log("高さ調整中", "INFO");
                return; 
            }
        } 
        if (controls) controls.enabled = true;
        isDraggingHeight = false;
        return;
    }

    // 3. 切断モード
    if (appMode === 'cutting') {
        // A. 既存の点に近いかどうかを最優先でチェック
        const targets = [createdMesh, clickPlane]; 
        const intersect = getIntersect(event.clientX, event.clientY, targets, false);
        
        if (intersect) {
            // タップ位置から距離2.0以内にある既存点を探す
            for(let pt of cutPoints) {
                if (pt.position.distanceTo(intersect.point) < 2.0) {
                    // 既存点を見つけたら、それを「ドラッグ状態」にする
                    isDraggingCutPoint = true;
                    selectedEdge = pt.userData.edgeInfo;
                    pt.material.color.setHex(0xffff00); // 選択色
                    if(controls) controls.enabled = false;
                    log("既存点を選択しました", "INFO");
                    return; // ★ここで処理終了（新規作成させない）
                }
            }
        }
        
        // B. 新規点追加 (近くに既存点がなかった場合のみ)
        if (cutPoints.length < 3) {
            if (intersect) {
                showTapFeedback(intersect.point);
                try {
                    const analysis = analyzeTapLocation(intersect.point);
                    
                    if (analysis.type !== 'NONE' && analysis.edgeInfo) {
                        // 初回のみスナップ計算
                        const p1 = analysis.edgeInfo.p1;
                        const p2 = analysis.edgeInfo.p2;
                        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
                        
                        const d1 = intersect.point.distanceTo(p1);
                        const d2 = intersect.point.distanceTo(p2);
                        const dMid = intersect.point.distanceTo(mid);
                        
                        let snapPos = mid;
                        let snapType = "中点";
                        
                        if (d1 <= d2 && d1 <= dMid) {
                            snapPos = p1; snapType = "頂点A";
                        } else if (d2 <= d1 && d2 <= dMid) {
                            snapPos = p2; snapType = "頂点B";
                        }
                        
                        log(`吸着: ${snapType}`, "EDGE");
                        
                        // 点を作成し、即座にドラッグ対象として選択する
                        const newPoint = addPointAt(snapPos, analysis.edgeInfo);
                        isDraggingCutPoint = true;
                        selectedEdge = analysis.edgeInfo;
                        newPoint.material.color.setHex(0xffff00);
                        if (controls) controls.enabled = false;
                        
                    } else {
                        log("辺が見つかりません", "NONE");
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }

    // 4. 結果モード
    if (appMode === 'result' && cutResultMeshes.length >= 2) {
        const topMesh = cutResultMeshes[1]; 
        const intersect = getIntersect(event.clientX, event.clientY, topMesh, true);
        
        if (intersect) {
            isDraggingResult = true;
            dragResultMesh = topMesh;
            if(controls) controls.enabled = false; 
            
            dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersect.point);
            
            const planeIntersect = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane, planeIntersect);
            dragOffset.subVectors(dragResultMesh.position, planeIntersect);
            
            log("上の立体を移動中...", "INFO");
        }
    }
});

renderer.domElement.addEventListener('pointermove', (event) => {
    // 高さ調整
    if (isDraggingHeight && createdMesh) {
        event.preventDefault(); 
        const deltaY = dragStartY - event.clientY;
        let s = startScaleZ + deltaY * 0.005;
        if (s < 0.1) s = 0.1;
        if (s > 3.0) s = 3.0;
        createdMesh.scale.z = s;
    }
    // 切断点移動 (★ドラッグ中はスナップなしで滑らかに)
    if (isDraggingCutPoint && selectedEdge) {
        event.preventDefault();
        
        // Raycaster更新
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        // 辺（線分）上の、マウスレイに一番近い点を計算
        const p1 = selectedEdge.p1;
        const p2 = selectedEdge.p2;
        const target = new THREE.Vector3();
        
        // この関数で線分上の最短距離の点を取得（スナップなし）
        raycaster.ray.distanceSqToSegment(p1, p2, null, target);

        // マーカー移動
        const m = cutPoints.find(p => p.material.color.getHex() === 0xffff00);
        if (m) m.position.copy(target);
    }
    // 切断後移動
    if (isDraggingResult && dragResultMesh) {
        event.preventDefault();
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const planeIntersect = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            dragResultMesh.position.copy(planeIntersect.add(dragOffset));
        }
    }
});

renderer.domElement.addEventListener('pointerup', (event) => {
    if (appMode === 'create') {
        if (event.target.hasPointerCapture(event.pointerId)) {
            event.target.releasePointerCapture(event.pointerId);
        }
        const startX = parseFloat(event.target.dataset.startX);
        const startY = parseFloat(event.target.dataset.startY);
        const d = Math.sqrt(Math.pow(event.clientX - startX, 2) + Math.pow(event.clientY - startY, 2));
        if (d < 10) {
            const intersect = getIntersect(event.clientX, event.clientY, clickPlane);
            if (intersect) {
                const pt = new THREE.Vector3(snapToGrid(intersect.point.x), 0, snapToGrid(intersect.point.z));
                if (points.length > 0 && pt.distanceTo(points[points.length - 1]) < 0.1) return;
                points.push(pt);
                const m = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshStandardMaterial({ color: 0x00aa00 }));
                m.position.copy(pt);
                scene.add(m);
                markers.push(m);
                redrawBaseLines();
            }
        }
        return;
    }
    if (isDraggingHeight) {
        isDraggingHeight = false;
        if (controls) controls.enabled = true; 
        if (lidMaterial) lidMaterial.color.setHex(0xeeeeee);
        return;
    }
    if (isDraggingCutPoint) {
        isDraggingCutPoint = false;
        selectedEdge = null;
        if (controls) controls.enabled = true;
        cutPoints.forEach(p => p.material.color.setHex(0xff0000));
        if (cutLineObj) updateCutLines();
        log("位置決定", "INFO");
        return;
    }
    if (isDraggingResult) {
        isDraggingResult = false;
        dragResultMesh = null;
        if (controls) controls.enabled = true;
        log("移動完了", "INFO");
        return;
    }
});

// --- 7. ロジック関数群 ---

function redrawBaseLines() {
    if (lineObj) scene.remove(lineObj);
    if (points.length < 2) return;
    const pos = [];
    points.forEach(p => pos.push(p.x, p.y, p.z));
    const geo = new LineGeometry();
    geo.setPositions(pos);
    const mat = new LineMaterial({ color: 0x00aa00, linewidth: 5 });
    mat.resolution.set(window.innerWidth, window.innerHeight);
    lineObj = new Line2(geo, mat);
    lineObj.computeLineDistances();
    scene.add(lineObj);
}

// 手計算ロジック
function analyzeTapLocation(hitPoint) {
    if (!edgesObj || !edgesObj.geometry) {
        return { type: 'ERROR', dist: Infinity };
    }

    const posAttr = edgesObj.geometry.attributes.position;
    const count = posAttr.count;
    
    let minD = Infinity;
    let bestType = 'FACE'; 
    let bestPos = hitPoint.clone();
    let bestEdgeInfo = null;

    const vStart = new THREE.Vector3();
    const vEnd = new THREE.Vector3();
    const vecAB = new THREE.Vector3();
    const vecAP = new THREE.Vector3();
    const closestOnSeg = new THREE.Vector3();

    for (let i = 0; i < count; i += 2) {
        vStart.fromBufferAttribute(posAttr, i);
        vEnd.fromBufferAttribute(posAttr, i + 1);
        vStart.applyMatrix4(edgesObj.matrixWorld);
        vEnd.applyMatrix4(edgesObj.matrixWorld);
        
        vecAB.subVectors(vEnd, vStart);
        vecAP.subVectors(hitPoint, vStart);
        
        const lenSq = vecAB.lengthSq();
        let t = (lenSq === 0) ? 0 : vecAP.dot(vecAB) / lenSq;
        t = Math.max(0, Math.min(1, t));
        
        closestOnSeg.copy(vStart).addScaledVector(vecAB, t);
        
        const dEdge = hitPoint.distanceTo(closestOnSeg);
        
        if (dEdge < minD) {
            minD = dEdge;
            bestEdgeInfo = { p1: vStart.clone(), p2: vEnd.clone(), closest: closestOnSeg.clone() };
            
            // 判定: 5.0以内なら辺とみなす
            if (dEdge < 5.0) {
                bestType = 'EDGE';
                bestPos = closestOnSeg.clone();
            } else {
                bestType = 'FACE'; 
            }
        }
    }
    return { type: bestType, dist: minD, pos: bestPos, edgeInfo: bestEdgeInfo };
}

function addPointAt(pos, edgeInfo) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    m.position.copy(pos);
    m.userData.edgeInfo = edgeInfo; 
    scene.add(m);
    cutPoints.push(m);
    if (cutPoints.length === 3) btnConnect.disabled = false;
    return m; // 作成したメッシュを返す
}

// ドラッグ計算用 (raycaster使用のため不要だが互換性のため残す)
function projectPointOnEdge(target, edgeInfo) {
    const p1 = edgeInfo.p1;
    const p2 = edgeInfo.p2;
    const vecAB = new THREE.Vector3().subVectors(p2, p1);
    const vecAP = new THREE.Vector3().subVectors(target, p1);
    const lenSq = vecAB.lengthSq();
    let t = (lenSq === 0) ? 0 : vecAP.dot(vecAB) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const res = new THREE.Vector3().copy(p1).addScaledVector(vecAB, t);
    return res;
}

function updateCutLines() {
    if (cutLineObj) scene.remove(cutLineObj);
    const pos = [];
    cutPoints.forEach(p => pos.push(p.position.x, p.position.y, p.position.z));
    pos.push(cutPoints[0].position.x, cutPoints[0].position.y, cutPoints[0].position.z);
    const geo = new LineGeometry();
    geo.setPositions(pos);
    const mat = new LineMaterial({ color: 0xff0000, linewidth: 6, dashed: false });
    mat.resolution.set(window.innerWidth, window.innerHeight);
    cutLineObj = new Line2(geo, mat);
    cutLineObj.computeLineDistances();
    scene.add(cutLineObj);
}

function addEdgesToMesh(mesh) {
    const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    mesh.add(edges);
}


// --- 8. UIボタン処理 ---

document.getElementById('create-btn').addEventListener('click', () => {
    if (points.length < 3) { alert("3点以上必要"); return; }
    isSolidCreated = true;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach(p => {
        if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
        if(p.z < minZ) minZ = p.z; if(p.z > maxZ) maxZ = p.z;
    });
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const baseSize = Math.max(width, depth) || 5;

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].z);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: baseSize, bevelEnabled: false });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
    lidMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
    
    const mesh = new THREE.Mesh(geo, [sideMat, lidMaterial]);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.z = 0;
    
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000 }));
    mesh.add(edges);
    edgesObj = edges;
    
    scene.add(mesh);
    createdMesh = mesh;

    if (lineObj) scene.remove(lineObj);
    markers.forEach(m => scene.remove(m));

    startCreateAnimation();
});

document.getElementById('to-cut-btn').addEventListener('click', () => {
    switchUI('cutting');
});

btnConnect.addEventListener('click', () => {
    updateCutLines();
    btnExecute.disabled = false;
    if (controls) {
        controls.enableRotate = true;
        log(">> 回転OK", "SYSTEM");
    }
});

btnExecute.addEventListener('click', () => {
    const p1 = cutPoints[0].position;
    const p2 = cutPoints[1].position;
    const p3 = cutPoints[2].position;
    const plane = new THREE.Plane().setFromCoplanarPoints(p1, p2, p3);

    const cutFaceMat = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, side: THREE.DoubleSide }); 
    const cutter = new Brush(new THREE.BoxGeometry(100, 100, 100), cutFaceMat);
    
    const center = new THREE.Vector3().add(p1).add(p2).add(p3).divideScalar(3);
    cutter.position.copy(center);
    cutter.lookAt(center.clone().add(plane.normal));
    cutter.translateZ(50);
    cutter.updateMatrixWorld();

    const base = new Brush(createdMesh.geometry, createdMesh.material[0]);
    base.position.copy(createdMesh.position);
    base.rotation.copy(createdMesh.rotation);
    base.scale.copy(createdMesh.scale);
    base.updateMatrixWorld();

    const evaluator = new Evaluator();
    const res1 = evaluator.evaluate(base, cutter, SUBTRACTION);
    const res2 = evaluator.evaluate(base, cutter, INTERSECTION);

    res1.geometry.computeBoundingBox();
    res2.geometry.computeBoundingBox();
    const y1 = (res1.geometry.boundingBox.max.y + res1.geometry.boundingBox.min.y) / 2;
    const y2 = (res2.geometry.boundingBox.max.y + res2.geometry.boundingBox.min.y) / 2;

    let realTop, realBot;
    if (y1 > y2) { realTop = res1; realBot = res2; }
    else { realTop = res2; realBot = res1; }

    realBot.material = [createdMesh.material[0], createdMesh.material[1], cutFaceMat];
    realTop.material = [createdMesh.material[0], createdMesh.material[1], cutFaceMat];
    
    addEdgesToMesh(realBot);
    addEdgesToMesh(realTop);

    scene.remove(createdMesh);
    scene.remove(cutLineObj);
    cutPoints.forEach(p => scene.remove(p));
    if (edgesObj) scene.remove(edgesObj);

    scene.add(realBot);
    scene.add(realTop);
    cutResultMeshes = [realBot, realTop];

    const startP = createdMesh.position.clone();
    const sideDir = new THREE.Vector3(3, 0, 0); 
    let slideP = 0;

    function animateCut() {
        slideP += 0.02;
        if (slideP <= 1.0) {
            let lift = 0;
            let slide = 0;
            const liftHeight = 3.0;

            if (slideP < 0.5) {
                const t = slideP * 2; 
                const ease = 1 - Math.pow(1 - t, 3);
                lift = liftHeight * ease;
            } else {
                lift = liftHeight;
                const t = (slideP - 0.5) * 2; 
                const ease = 1 - Math.pow(1 - t, 3);
                slide = 1.0 * ease;
            }

            realTop.position.y = startP.y + lift;
            realTop.position.x = startP.x + (sideDir.x * slide);
            
            requestAnimationFrame(animateCut);
        }
    }
    animateCut();

    switchUI('result');
});

const resetToCreate = () => location.reload();
document.getElementById('reset-btn').addEventListener('click', resetToCreate);
document.getElementById('reset-view-btn').addEventListener('click', resetToCreate);
document.getElementById('reset-all-btn').addEventListener('click', resetToCreate);
document.getElementById('undo-btn').addEventListener('click', () => {
    if (points.length) { points.pop(); scene.remove(markers.pop()); redrawBaseLines(); }
});

document.getElementById('cancel-cut-btn').addEventListener('click', restoreView);
document.getElementById('restore-btn').addEventListener('click', restoreView);

function restoreView() {
    cutResultMeshes.forEach(m => scene.remove(m));
    cutResultMeshes = [];
    if (createdMesh) {
        scene.add(createdMesh);
        createdMesh.position.set(0,0,0);
    }
    cutPoints.forEach(p => scene.remove(p));
    cutPoints = [];
    if (cutLineObj) { scene.remove(cutLineObj); cutLineObj = null; }
    
    btnConnect.disabled = true;
    btnExecute.disabled = true;
    switchUI('view');
}

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (lineObj) lineObj.material.resolution.set(window.innerWidth, window.innerHeight);
    if (cutLineObj) cutLineObj.material.resolution.set(window.innerWidth, window.innerHeight);
});