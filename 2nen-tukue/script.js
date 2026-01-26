/**
 * --- script.js ---
 */

// --- 定数・変数 ---
const GRID_ROWS = 5;
const GRID_COLS = 6;
const SNAP_DISTANCE = 80;
const PADDING_TOP = 100;

// ゲーム状態
let gameState = {
    // 初期位置: x=4.5, y=4.5, dir=0(上)
    robot: { x: 4.5, y: 4.5, dir: 0, angle: 0 }, 
    targetItem: "",
    isRunning: false
};
// 囲みモードかどうか
let isEnclosureMode = false;

const items = ["牛にゅう", "ごまだしうどん", "カレー", "シチュー", "ケーキ"];

// DOM要素
const workspace = document.getElementById('workspace');
const palette = document.getElementById('palette');
const snapIndicator = document.getElementById('snap-indicator');
const classroom = document.getElementById('classroom');
const messageArea = document.getElementById('message-area');
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const debugWindow = document.getElementById('debug-window');
const chkEnclosure = document.getElementById('chk-enclosure-mode');

// --- 1. 初期化処理 ---

function initGame() {
    createClassroom();
    setNewOrder();
    resetRobot();
    
    if (chkEnclosure) {
        chkEnclosure.addEventListener('change', toggleEnclosureMode);
    }

    runTutorial();
}

function toggleEnclosureMode(e) {
    const isChecked = e.target.checked;
    const loopBlocks = Array.from(workspace.querySelectorAll('.block-loop'));
    
    if (!isChecked) {
        const hasChildren = loopBlocks.some(block => {
            const inner = block.querySelector('.loop-inner');
            return inner && inner.children.length > 0;
        });

        if (hasChildren) {
            alert('かこみのなかに ブロックが はいっているので\nモードを もどせません！');
            e.target.checked = true;
            return;
        }
    }

    isEnclosureMode = isChecked;
    
    updateLoopBlockVisual(document.getElementById('palette-loop'), isEnclosureMode);
    loopBlocks.forEach(block => {
        updateLoopBlockVisual(block, isEnclosureMode);
    });
}

function updateLoopBlockVisual(block, isEnclosure) {
    if (!block) return;
    
    const select = block.querySelector('select');
    const currentVal = select ? select.value : "2";

    if (isEnclosure) {
        block.classList.add('enclosure-mode');
        block.innerHTML = `
            <div class="loop-header">
                <select class="loop-count">
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                </select>
                かい くりかえす
            </div>
            <div class="loop-inner"></div>
            <div class="loop-footer"></div>
        `;
    } else {
        block.classList.remove('enclosure-mode');
        block.innerHTML = `
            <div class="loop-line-1">まえの うごきを</div>
            <div class="loop-line-2">
                <select class="loop-count">
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                </select>
                かい くりかえす
            </div>
        `;
    }
    
    const newSelect = block.querySelector('select');
    if (newSelect) newSelect.value = currentVal;
    
    if (newSelect) {
        newSelect.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
}


async function runTutorial() {
    gameState.isRunning = true;
    btnRun.disabled = true;

    await wait(2000);
    showBubble('student', '', false);
    
    showBubble('robot', 'ぼくの いっぽは\nこれくらいだよ', true);
    await wait(1500);

    // チュートリアルの動きも少しゆっくりにします
    gameState.robot.y -= 1;
    updateRobotVisual();
    await wait(1000);

    gameState.robot.y += 1;
    updateRobotVisual();
    await wait(1000);

    const rBubble = document.getElementById('robot-bubble');
    if (rBubble) {
        rBubble.style.top = '60px'; 
        rBubble.style.zIndex = '600';
    }

    showBubble('robot', 'じゃぁ、\nどの ブロックを\nくみあわせようか？', true);

    gameState.isRunning = false;
    btnRun.disabled = false;
}

function createClassroom() {
    classroom.innerHTML = '';
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const desk = document.createElement('div');
            desk.className = 'desk';
            cell.appendChild(desk);
            classroom.appendChild(cell);
        }
    }

    const cellWidth = classroom.clientWidth / GRID_COLS;
    const cellHeight = (classroom.clientHeight - PADDING_TOP) / GRID_ROWS;

    // --- 先生 ---
    const teacherDesk = document.createElement('div');
    teacherDesk.className = 'teacher-desk';
    const baseLeft = ((0 + 1) * cellWidth - (cellWidth/2) - (cellWidth*0.3));
    teacherDesk.style.left = (baseLeft + 30) + 'px'; 
    teacherDesk.style.top = '30px'; 
    teacherDesk.style.width = (cellWidth * 0.6) + 'px';
    teacherDesk.style.height = '50px';
    classroom.appendChild(teacherDesk);

    const teacher = document.createElement('div');
    teacher.id = 'teacher';
    teacher.className = 'character';
    teacher.textContent = '👩‍🏫';
    teacher.style.left = ((0 + 1) * cellWidth - 25 ) + 'px'; 
    teacher.style.top = '55px'; 
    teacher.style.zIndex = '10'; 
    
    const tBubble = document.createElement('div');
    tBubble.id = 'teacher-bubble';
    tBubble.className = 'bubble';
    tBubble.style.top = '-50px';
    tBubble.style.left = '5px';
    tBubble.style.transform = 'none';
    teacher.appendChild(tBubble);
    classroom.appendChild(teacher);

    // --- 生徒 ---
    const student = document.createElement('div');
    student.id = 'student';
    student.className = 'character';
    student.textContent = '👦';
    student.style.bottom = '-5px';
    student.style.right = '10px';
    
    const sBubble = document.createElement('div');
    sBubble.id = 'student-bubble';
    sBubble.className = 'bubble';
    sBubble.style.top = '-60px'; 
    sBubble.style.right = '0px'; 
    sBubble.style.left = 'auto';
    sBubble.style.transform = 'none';
    sBubble.style.width = '120px'; 
    student.appendChild(sBubble);
    classroom.appendChild(student);

    // --- ロボット ---
    const robot = document.createElement('div');
    robot.id = 'robot';
    robot.className = 'character';
    robot.textContent = '🤖';
    const rBubble = document.createElement('div');
    rBubble.id = 'robot-bubble';
    rBubble.className = 'bubble';
    rBubble.style.top = '-60px';
    robot.appendChild(rBubble);
    classroom.appendChild(robot);
}

function setNewOrder() {
    gameState.targetItem = items[Math.floor(Math.random() * items.length)];
    showBubble('teacher', `${gameState.targetItem} を\nもってきてください`, true);
    showBubble('student', `先生に\n${gameState.targetItem} を\nとどけて！`, true);
    if (messageArea) {
        messageArea.textContent = `もくひょう：${gameState.targetItem} を とどける`;
    }
}

function resetRobot() {
    gameState.robot = { x: 4.5, y: 4.5, dir: 0, angle: 0 };
    gameState.isRunning = false;

    updateRobotVisual();
    
    if(btnRun) {
        btnRun.style.display = 'inline-block';
        btnRun.disabled = false;
    }
    if(btnReset) {
        btnReset.style.display = 'none';
    }
    
    showBubble('robot', '', false);
    
    const rBubble = document.getElementById('robot-bubble');
    if (rBubble) {
        rBubble.style.top = '-60px';
    }
    showBubble('student', `先生に\n${gameState.targetItem} を\nとどけて！`, true);
}

function updateDebugInfo() {
    if (debugWindow) {
        const cx = gameState.robot.x.toFixed(2);
        const cy = gameState.robot.y.toFixed(2);
        const dirs = ['↑(0)', '→(1)', '↓(2)', '←(3)'];
        debugWindow.innerHTML = `X: ${cx}, Y: ${cy} <br>向き: ${dirs[gameState.robot.dir]}`;
    }
}

function updateRobotVisual() {
    const robot = document.getElementById('robot');
    if (!robot || !classroom.clientWidth) return;

    const cellWidth = classroom.clientWidth / GRID_COLS;
    const cellHeight = (classroom.clientHeight - PADDING_TOP) / GRID_ROWS;

    const left = (gameState.robot.x * cellWidth) + (cellWidth / 2) - 20;
    const top = (gameState.robot.y * cellHeight) + (cellHeight / 2) - 20 + PADDING_TOP;

    robot.style.transform = `translate(${left}px, ${top}px) rotate(${gameState.robot.angle}deg)`;
    updateDebugInfo();
}

function performAction(type) {
    if (type === 'left') {
        gameState.robot.dir = (gameState.robot.dir + 3) % 4;
        gameState.robot.angle -= 90;
    } 
    else if (type === 'right') {
        gameState.robot.dir = (gameState.robot.dir + 1) % 4;
        gameState.robot.angle += 90;
    } 
    else if (type === 'move') {
        let nextX = gameState.robot.x;
        let nextY = gameState.robot.y;
        
        if (gameState.robot.dir === 0) nextY -= 1;
        if (gameState.robot.dir === 1) nextX += 1;
        if (gameState.robot.dir === 2) nextY += 1;
        if (gameState.robot.dir === 3) nextX -= 1;

        if (nextX >= -0.5 && nextX <= 5.5 && nextY >= -1.5 && nextY <= 5.5) {
            gameState.robot.x = nextX;
            gameState.robot.y = nextY;
        } else {
            console.log('行き止まり');
            showBubble('robot', 'これいじょう\nすすめないよ', true);
        }
    }
}

function checkResult() {
    updateDebugInfo();

    const isGoalX = Math.abs(gameState.robot.x - 0.5) < 0.1;
    const isGoalY = Math.abs(gameState.robot.y - (-0.5)) < 0.1;

    if (isGoalX && isGoalY) {
        showBubble('teacher', 'ありがとう！\nいただきまーす', true);
        showBubble('robot', 'やったー！', true);
        playWinEffect();
    } else {
        console.log(`Failed at X:${gameState.robot.x}, Y:${gameState.robot.y}`);
        showBubble('robot', 'あれ？\nたどりつけなかった', true);
        showBubble('teacher', 'こっちだよ～', true);
    }
}

// ---------------------------------------------------------
// --- ドラッグ&ドロップ機能 ---
// ---------------------------------------------------------

function showBubble(charId, text, show) {
    const bubble = document.getElementById(`${charId}-bubble`);
    if (bubble) {
        bubble.innerHTML = text.replace(/\n/g, '<br>');
        if (show) bubble.classList.add('show');
        else bubble.classList.remove('show');
    }
}

let dragSrc = null;
let dragClone = null;
let dragOffset = { x: 0, y: 0 };
let attachedBlocks = [];

document.querySelectorAll('#palette .block').forEach(block => {
    addDragEvents(block);
});

function addDragEvents(el) {
    el.addEventListener('pointerdown', onPointerDown);
    const select = el.querySelector('select');
    if (select) {
        select.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
}

function onPointerDown(e) {
    e.preventDefault();
    const target = e.currentTarget;
    if (target.classList.contains('static-start')) return;

    const isPalette = target.closest('#palette') !== null;
    dragSrc = target;
    attachedBlocks = [];
    
    if (!isPalette) {
        if (!target.parentElement.classList.contains('loop-inner')) {
             attachedBlocks = getAttachedBlocks(target);
        }
    }

    dragClone = target.cloneNode(true);
    dragClone.classList.add('dragging');
    dragClone.style.width = target.offsetWidth + 'px';
    document.body.appendChild(dragClone);

    const innerBlocks = dragClone.querySelectorAll('.block');
    innerBlocks.forEach(b => {
        b.style.position = 'relative';
        b.style.top = '0';
        b.style.left = '0';
        b.style.opacity = '1';
    });

    const rect = target.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    updateDragPos(e.clientX, e.clientY);

    if (!isPalette) {
        target.style.opacity = '0';
        attachedBlocks.forEach(b => b.style.opacity = '0');
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    
    copySelectValue(target, dragClone);
}

function copySelectValue(src, dest) {
    const srcSel = src.querySelector('select');
    const destSel = dest.querySelector('select');
    if(srcSel && destSel) destSel.value = srcSel.value;
}

function onPointerMove(e) {
    if (!dragClone) return;
    updateDragPos(e.clientX, e.clientY);
    checkSnap(e.clientX, e.clientY);
}

function updateDragPos(x, y) {
    dragClone.style.left = (x - dragOffset.x) + 'px';
    dragClone.style.top = (y - dragOffset.y) + 'px';
}

let snapTarget = null;
let snapToInner = false; 

function checkSnap(x, y) {
    snapTarget = null;
    snapToInner = false;
    snapIndicator.style.display = 'none';
    
    const wsRect = workspace.getBoundingClientRect();
    if (x < wsRect.left || x > wsRect.right || y < wsRect.top || y > wsRect.bottom) {
        return;
    }

    const blocks = Array.from(workspace.querySelectorAll('.block:not(.dragging)'));
    const filteredBlocks = blocks.filter(b => b !== dragSrc && !attachedBlocks.includes(b) && b.style.opacity !== '0');

    let minDist = SNAP_DISTANCE;
    const dragTop = y - dragOffset.y;
    
    filteredBlocks.forEach(b => {
        const rect = b.getBoundingClientRect();
        
        let targetBottom = rect.bottom;
        if (b.classList.contains('enclosure-mode')) {
             targetBottom = rect.bottom; 
        }

        const targetConnectY = targetBottom - 5;
        const dist = Math.abs(dragTop - targetConnectY);
        const horizontalDist = Math.abs((x - dragOffset.x) - rect.left);

        if (dist < minDist && horizontalDist < 100) { 
             minDist = dist;
             snapTarget = b;
             snapToInner = false;
        }

        if (b.classList.contains('enclosure-mode') && dragSrc !== b) {
            const inner = b.querySelector('.loop-inner');
            if (inner) {
                const innerRect = inner.getBoundingClientRect();
                
                if (inner.children.length > 0) {
                    const lastChild = inner.lastElementChild;
                    const lastRect = lastChild.getBoundingClientRect();
                    const innerDist = Math.abs(dragTop - (lastRect.bottom - 5));
                    const innerHDist = Math.abs((x - dragOffset.x) - lastRect.left);
                    
                    if (innerDist < minDist && innerHDist < 100) {
                        minDist = innerDist;
                        snapTarget = lastChild;
                        snapToInner = false; 
                    }

                } else {
                    const innerTopDist = Math.abs(dragTop - (innerRect.top - 5));
                    const innerHDist = Math.abs((x - dragOffset.x) - (rect.left + 20));

                    if (innerTopDist < minDist && innerHDist < 100) {
                        minDist = innerTopDist;
                        snapTarget = b;
                        snapToInner = true; 
                    }
                }
            }
        }
    });

    if (snapTarget) {
        const rect = snapTarget.getBoundingClientRect();
        snapIndicator.style.display = 'block';
        
        if (snapToInner) {
            const inner = snapTarget.querySelector('.loop-inner');
            const innerRect = inner.getBoundingClientRect();
            snapIndicator.style.top = (innerRect.top - wsRect.top) + 'px';
            snapIndicator.style.left = (innerRect.left - wsRect.left + 5) + 'px';
            snapIndicator.style.width = (innerRect.width - 10) + 'px';
        } else {
            snapIndicator.style.top = (rect.bottom - wsRect.top - 5) + 'px';
            snapIndicator.style.left = (rect.left - wsRect.left) + 'px';
            snapIndicator.style.width = '200px';
        }
    }
}

function onPointerUp(e) {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    const wsRect = workspace.getBoundingClientRect();
    const dropX = e.clientX;
    const dropY = e.clientY;

    if (dropX < wsRect.left || dropX > wsRect.right || dropY < wsRect.top || dropY > wsRect.bottom) {
        if (!dragSrc.closest('#palette')) {
            dragSrc.remove();
            attachedBlocks.forEach(b => b.remove());
        }
    } else {
        let newBlock = dragSrc;
        
        if (dragSrc.closest('#palette')) {
            newBlock = dragSrc.cloneNode(true);
            newBlock.id = ''; 
            addDragEvents(newBlock);
            newBlock.classList.add('workspace-block');
            copySelectValue(dragSrc, newBlock);
        }

        newBlock.style.opacity = '1';
        
        if (snapTarget) {
            if (snapToInner) {
                const inner = snapTarget.querySelector('.loop-inner');
                inner.appendChild(newBlock);
                newBlock.style.position = 'relative';
                newBlock.style.left = '0';
                newBlock.style.top = '0';
                
            } else {
                const container = snapTarget.parentElement;
                
                if (snapTarget.nextSibling) {
                    container.insertBefore(newBlock, snapTarget.nextSibling);
                } else {
                    container.appendChild(newBlock);
                }
                
                if (container.classList.contains('loop-inner')) {
                    newBlock.style.position = 'relative';
                    newBlock.style.left = '0';
                    newBlock.style.top = '0';
                } else {
                    newBlock.style.position = 'absolute';
                    const snapRect = snapTarget.getBoundingClientRect();
                    newBlock.style.left = (snapTarget.offsetLeft) + 'px';
                    newBlock.style.top = (snapTarget.offsetTop + snapTarget.offsetHeight - 5) + 'px';
                }
            }
        } else {
            workspace.appendChild(newBlock);
            newBlock.style.position = 'absolute';
            newBlock.style.left = (dropX - dragOffset.x - wsRect.left) + 'px';
            newBlock.style.top = (dropY - dragOffset.y - wsRect.top) + 'px';
        }

        if (attachedBlocks.length > 0) {
            let parent = newBlock.parentElement;
            
            attachedBlocks.forEach(b => {
                b.style.opacity = '1';
                parent.appendChild(b);
                
                if (parent.classList.contains('loop-inner')) {
                    b.style.position = 'relative';
                    b.style.left = '0';
                    b.style.top = '0';
                } else {
                    b.style.position = 'absolute';
                    const prev = b.previousElementSibling;
                    if(prev) {
                        b.style.left = prev.offsetLeft + 'px';
                        b.style.top = (prev.offsetTop + prev.offsetHeight - 5) + 'px';
                    }
                }
            });
        }
    }

    dragClone.remove();
    dragClone = null;
    snapIndicator.style.display = 'none';
    dragSrc = null;
    attachedBlocks = [];
}

function getAttachedBlocks(headBlock) {
    const results = [];
    
    if (headBlock.parentElement.id === 'workspace') {
        const blocks = Array.from(workspace.children).filter(el => el.classList.contains('block'));
        let current = headBlock;
        while(true) {
            const currentRect = current.getBoundingClientRect();
            const found = blocks.find(b => {
                if (b === current || results.includes(b) || b === headBlock) return false;
                const r = b.getBoundingClientRect();
                const vDist = Math.abs(r.top - currentRect.bottom + 5);
                const hDist = Math.abs(r.left - currentRect.left);
                return vDist < 10 && hDist < 10;
            });
            if (found) { results.push(found); current = found; } else { break; }
        }
    } 
    return results;
}

// ---------------------------------------------------------
// --- 実行ロジック ---
// ---------------------------------------------------------

btnRun.addEventListener('click', async () => {
    if (gameState.isRunning) return;
    gameState.isRunning = true;
    btnRun.disabled = true;

    showBubble('student', '', false);

    const startBlock = Array.from(workspace.children).find(b => 
        b.classList.contains('block') && b.dataset.type === 'start'
    );

    if (!startBlock) {
        alert('「はじまり」ブロックが みつからないよ。');
        finishRun();
        return;
    }

    let firstCommandBlock = null;
    const startRect = startBlock.getBoundingClientRect();
    const blocks = Array.from(workspace.children).filter(el => el.classList.contains('block'));
    
    firstCommandBlock = blocks.find(b => {
        const r = b.getBoundingClientRect();
        const vDist = Math.abs(r.top - startRect.bottom + 5);
        const hDist = Math.abs(r.left - startRect.left);
        return vDist < 10 && hDist < 10;
    });

    if (!firstCommandBlock) {
        showBubble('robot', 'プログラミング\nしてね', true);
        finishRun();
        return;
    }

    showBubble('robot', 'しゅっぱつ！', true);
    await wait(1000);
    showBubble('robot', '', false);

    await runBlockChain(firstCommandBlock);

    checkResult();
    finishRun();
});

function finishRun() {
    gameState.isRunning = false;
    btnRun.disabled = false;
    btnRun.style.display = 'none';
    btnReset.style.display = 'inline-block';
    if (!gameState.isRunning && btnRun.style.display !== 'none') {
        showBubble('student', `先生に\n${gameState.targetItem} を\nとどけて！`, true);
    }
}

async function runBlockChain(block) {
    let current = block;
    let lastAction = null; 

    while (current) {
        const type = current.dataset.type;
        
        if (type === 'move' || type === 'left' || type === 'right') {
            await performAction(type);
            updateRobotVisual();
            await wait(1000); // ★修正: 待機時間を1000msに延長
            lastAction = type;
        } 
        else if (type === 'loop') {
            const count = parseInt(current.querySelector('select').value);
            
            if (current.classList.contains('enclosure-mode')) {
                const inner = current.querySelector('.loop-inner');
                if (inner && inner.firstElementChild) {
                    for (let i = 0; i < count; i++) {
                        await runBlockChain(inner.firstElementChild);
                    }
                }
            } else {
                if (lastAction) {
                    for (let i = 0; i < count; i++) {
                        await performAction(lastAction);
                        updateRobotVisual();
                        // ★修正: 最後の1回も待機するように修正（移動し終わるのを待つ）
                        await wait(1000); 
                    }
                }
            }
        }

        if (current.parentElement.id === 'workspace') {
            current = findNextBlockByPos(current);
        } else {
            current = current.nextElementSibling;
            while(current && !current.classList.contains('block')) {
                current = current.nextElementSibling;
            }
        }
    }
}

function findNextBlockByPos(currentBlock) {
    const currentRect = currentBlock.getBoundingClientRect();
    const blocks = Array.from(workspace.children).filter(el => el.classList.contains('block'));
    return blocks.find(b => {
        if (b === currentBlock) return false;
        const r = b.getBoundingClientRect();
        const vDist = Math.abs(r.top - currentRect.bottom + 5);
        const hDist = Math.abs(r.left - currentRect.left);
        return vDist < 10 && hDist < 10;
    });
}

function playWinEffect() {
    classroom.style.backgroundColor = '#F48FB1';
    setTimeout(() => {
        classroom.style.backgroundColor = '#8D6E63';
    }, 2000);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.onload = initGame;
window.onresize = () => {
    createClassroom();
    updateRobotVisual();
};

btnReset.addEventListener('click', () => {
    resetRobot();
});