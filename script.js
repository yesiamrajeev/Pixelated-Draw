let currentOutline = 'none';
let undoStack = [];
let redoStack = [];
let fillMode = false;

function isInsideOutline(i, j, size, outlineType) {
    if (outlineType === 'none') return true;
    
    const centerX = size / 2;
    const centerY = size / 2;
    const x = j - centerX;
    const y = i - centerY;
    const maxRadius = size / 2;
    
    switch(outlineType) {
        case 'circle':
            return (x * x + y * y) <= (maxRadius * maxRadius * 0.85);
        
        case 'heart':
            const scale = maxRadius / 13;
            const nx = x / scale;
            const ny = -y / scale + 2;
            return (Math.pow(nx * nx + ny * ny - 10, 3) - nx * nx * ny * ny * ny) <= 0;
        
        case 'star':
            const angle = Math.atan2(y, x);
            const radius = Math.sqrt(x * x + y * y);
            const starRadius = maxRadius * 0.75 * (0.4 + 0.6 * Math.cos(5 * angle));
            return radius <= starRadius;
        
        case 'square':
            return Math.abs(x) <= maxRadius * 0.75 && Math.abs(y) <= maxRadius * 0.75;
        
        case 'triangle':
            const triHeight = maxRadius * 0.85;
            const triBase = maxRadius * 0.9;
            return y >= -triHeight/3 && y <= triHeight * 0.6 && 
                   Math.abs(x) <= triBase * (1 - (y + triHeight/3) / triHeight);
        
        default:
            return true;
    }
}

function createGrid(size = 16) {
    const gridlinesToggle = document.getElementById('gridlines-toggle');
    const gridSize = 800;
    for (let i = 0; i < size; i++) {
        let row = document.createElement('div');
        row.classList.add('row');
        row.setAttribute('id', `row-${i}`)
        row.style.cssText = `display: flex;width: ${gridSize}px; height: ${gridSize/size}px; min-width: ${gridSize}px; min-height: ${gridSize/size}px; max-width: ${gridSize}px; max-height: ${gridSize/size}px`
        document.querySelector('.grid').appendChild(row);
        for (let j = 0; j < size; j++) {
            let box = document.createElement('div');
            box.classList.add('box');
            box.id = `${i}-${j}`
            box.dataset.row = i;
            box.dataset.col = j;
            
            const insideOutline = isInsideOutline(i, j, size, currentOutline);
            
            if (gridlinesToggle.checked) {
                box.style.cssText = `user-select: none; border: 1px solid #D3D3D3; width: ${gridSize/size}px; height: ${gridSize/size}px; min-width: 0px; min-height: 0px; max-width: ${gridSize/size}px; max-height: ${gridSize/size}px;`
            }
            else{
                box.style.cssText = `user-select: none; width: ${gridSize/size}px; height: ${gridSize/size}px; min-width: 0px; min-height: 0px; max-width: ${gridSize/size}px; max-height: ${gridSize/size}px;`
            }
            
            if (!insideOutline && currentOutline !== 'none') {
                box.style.backgroundColor = '#f0f0f0';
                box.classList.add('outside-outline');
            }
            
            row.appendChild(box);
        }
    }
    draw();
}

function saveState() {
    const boxes = document.querySelectorAll('.box');
    const state = Array.from(boxes).map(box => ({
        id: box.id,
        color: box.style.backgroundColor || 'white'
    }));
    undoStack.push(state);
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
}

function undo() {
    if (undoStack.length === 0) return;
    
    const boxes = document.querySelectorAll('.box');
    const currentState = Array.from(boxes).map(box => ({
        id: box.id,
        color: box.style.backgroundColor || 'white'
    }));
    redoStack.push(currentState);
    
    const previousState = undoStack.pop();
    previousState.forEach(item => {
        const box = document.getElementById(item.id);
        if (box) box.style.backgroundColor = item.color;
    });
}

function redo() {
    if (redoStack.length === 0) return;
    
    const boxes = document.querySelectorAll('.box');
    const currentState = Array.from(boxes).map(box => ({
        id: box.id,
        color: box.style.backgroundColor || 'white'
    }));
    undoStack.push(currentState);
    
    const nextState = redoStack.pop();
    nextState.forEach(item => {
        const box = document.getElementById(item.id);
        if (box) box.style.backgroundColor = item.color;
    });
}

function floodFill(startBox, targetColor, fillColor) {
    try {
        if (targetColor === fillColor) return;
        if (startBox.classList.contains('outside-outline')) return;
        
        const queue = [startBox];
        const visited = new Set();
        const maxIterations = 10000; // Prevent infinite loops
        let iterations = 0;
        
        while (queue.length > 0 && iterations < maxIterations) {
            iterations++;
            const box = queue.shift();
            const boxId = box.id;
            
            if (visited.has(boxId)) continue;
            visited.add(boxId);
            
            const currentColor = box.style.backgroundColor || 'white';
            if (currentColor !== targetColor) continue;
            if (box.classList.contains('outside-outline')) continue;
            
            box.style.backgroundColor = fillColor;
            
            const [row, col] = boxId.split('-').map(Number);
            const neighbors = [
                document.getElementById(`${row-1}-${col}`),
                document.getElementById(`${row+1}-${col}`),
                document.getElementById(`${row}-${col-1}`),
                document.getElementById(`${row}-${col+1}`)
            ];
            
            neighbors.forEach(neighbor => {
                if (neighbor && !visited.has(neighbor.id)) {
                    queue.push(neighbor);
                }
            });
        }
        
        if (iterations >= maxIterations) {
            console.warn('Flood fill reached maximum iterations');
        }
    } catch (error) {
        console.error('Error during flood fill:', error);
        alert('An error occurred while filling. Please try again.');
    }
}

function downloadCanvas() {
    try {
        const grid = document.querySelector('.grid');
        const canvas = document.createElement('canvas');
        const boxes = document.querySelectorAll('.box');
        const gridSize = Math.sqrt(boxes.length);
        
        if (!boxes.length) {
            alert('No drawing to download!');
            return;
        }
        
        canvas.width = gridSize * 20;
        canvas.height = gridSize * 20;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }
        
        boxes.forEach(box => {
            const [row, col] = box.id.split('-').map(Number);
            const color = box.style.backgroundColor || 'white';
            ctx.fillStyle = color;
            ctx.fillRect(col * 20, row * 20, 20, 20);
        });
        
        const link = document.createElement('a');
        link.download = `pixelated-art-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (error) {
        console.error('Error downloading canvas:', error);
        alert('Failed to download image. Please try again.');
    }
}

function clearGrid() {
    saveState();
    let boxes = document.querySelectorAll('.box')
    boxes.forEach(box => {
        if (box.style.backgroundColor != 'white'){
            box.style.backgroundColor = 'white';
        }
    });
}


function draw(color='black', rainbow=false) {
    let isDrawing = false;
    let hasDrawn = false;

    function startDrawing() {
        isDrawing = true;
        hasDrawn = false;
    }

    function stopDrawing() {
        if (isDrawing && hasDrawn) {
            saveState();
        }
        isDrawing = false;
        hasDrawn = false;
    }

    function drawBox(box) {
        if (fillMode) {
            const targetColor = box.style.backgroundColor || 'white';
            const fillColor = rainbow ? 
                `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})` : 
                color;
            saveState();
            floodFill(box, targetColor, fillColor);
            fillMode = false;
            document.querySelector('.fill-bucket').classList.remove('active');
            return;
        }
        
        if (isDrawing && !box.classList.contains('outside-outline')) {
            hasDrawn = true;
            if (rainbow) {
                color = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`
            }
            box.style.backgroundColor = color;
        }
    }

    let boxes = document.querySelectorAll('.box');
    boxes.forEach(box => {
        box.addEventListener('mousedown', () => {
            startDrawing();
            drawBox(box);
        });
        box.addEventListener('mouseover', () => {
            drawBox(box);
        });
    });

    document.addEventListener('mouseup', stopDrawing);
}


function removeGrid() {
    let grid = document.querySelector('.grid');
    grid.innerHTML = '';
}

function gridAction() {

    createGrid();

    const boxSlider = document.getElementById('box-slider');
    const boxCountDisplay = document.querySelectorAll('.box-count');
    const eraseButton = document.querySelector('.eraser');
    const clearButton = document.querySelector('.clear');
    const rainbowButton = document.querySelector('.rainbow');
    const colorButton = document.querySelector('.color');

    boxSlider.addEventListener('input', () => {
        boxCountDisplay.forEach(boxCount => boxCount.textContent = boxSlider.value);
        removeGrid();
        createGrid(boxSlider.value);
        const colorPicker = document.querySelector("#color-picker");
        draw(colorPicker.value);
        if (eraseButton.classList.contains('active')) {
            draw('white');
        }
        else if (rainbowButton.classList.contains('active')) {
            draw('white',true);
        }
    });

    clearButton.onclick = clearGrid;

    eraseButton.addEventListener('click', () => {
        eraseButton.classList.add('active');
        rainbowButton.classList.remove('active');
        draw('white');
    });

    rainbowButton.addEventListener('click', () => {
        rainbowButton.classList.add('active');
        eraseButton.classList.remove('active');
        draw('white',true);
    });

    colorButton.addEventListener('click', () => {
        eraseButton.classList.remove('active');
        rainbowButton.classList.remove('active');
        const colorPicker = document.querySelector("#color-picker");
        draw(colorPicker.value);
    });

    const gridlinesToggle = document.getElementById('gridlines-toggle');
    gridlinesToggle.addEventListener('change', () => {
        let boxes = document.querySelectorAll('.box')
        boxes.forEach(box => {
            if (gridlinesToggle.checked) {
                box.style.border = '1px solid #D3D3D3';
            }
            else {
                box.style.border = 'none';
            }
        });
    });

    const outlineSelect = document.getElementById('outline-select');
    outlineSelect.addEventListener('change', () => {
        currentOutline = outlineSelect.value;
        removeGrid();
        createGrid(boxSlider.value);
        const colorPicker = document.querySelector("#color-picker");
        draw(colorPicker.value);
        if (eraseButton.classList.contains('active')) {
            draw('white');
        }
        else if (rainbowButton.classList.contains('active')) {
            draw('white', true);
        }
    });

    const fillButton = document.querySelector('.fill-bucket');
    fillButton.addEventListener('click', () => {
        fillMode = !fillMode;
        if (fillMode) {
            fillButton.classList.add('active');
        } else {
            fillButton.classList.remove('active');
        }
    });

    const downloadButton = document.querySelector('.download');
    downloadButton.addEventListener('click', downloadCanvas);

    const undoButton = document.querySelector('.undo-btn');
    undoButton.addEventListener('click', undo);

    const redoButton = document.querySelector('.redo-btn');
    redoButton.addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });

    window.addEventListener("load", startup, false);

}

function startup() {
    let colorPicker;
    colorPicker = document.querySelector("#color-picker");
    colorPicker.value = "#000000";
    colorPicker.addEventListener("input", updateFirst, false);
    colorPicker.addEventListener("change", updateAll, false);
    colorPicker.select();
}

function updateFirst(event) {
    draw(event.target.value);
}

function updateAll(event) {
    draw(event.target.value);
}



gridAction();

