let currentOutline = 'none';
let undoStack = [];
let redoStack = [];
let fillMode = false;
let currentZoom = 100;
let brushSize = 1;
let currentColor = '#000000';

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

function getResponsiveGridSize() {
    const screenWidth = window.innerWidth;
    if (screenWidth <= 480) return 320;
    if (screenWidth <= 768) return 400;
    if (screenWidth <= 1200) return 600;
    return 800;
}

function createGrid(size = 16) {
    const grid = document.querySelector('.grid');
    const gridlinesToggle = document.getElementById('gridlines-toggle');
    const gridSize = getResponsiveGridSize();
    
    // Add loading state
    grid.classList.add('loading');
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
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
    
    // Remove loading state and initialize drawing
    grid.classList.remove('loading');
    draw();
    }, 10);
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
    if (targetColor === fillColor) return;
    if (startBox.classList.contains('outside-outline')) return;
    
    const queue = [startBox];
    const visited = new Set();
    
    while (queue.length > 0) {
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
}

function downloadCanvas() {
    const boxes = document.querySelectorAll('.box');
    const gridSize = Math.sqrt(boxes.length);
    
    // Create high-resolution canvas
    const canvas = document.createElement('canvas');
    const pixelSize = 32; // Higher resolution
    canvas.width = gridSize * pixelSize;
    canvas.height = gridSize * pixelSize;
    const ctx = canvas.getContext('2d');
    
    // Fill background with white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw pixels
    boxes.forEach(box => {
        const [row, col] = box.id.split('-').map(Number);
        const color = box.style.backgroundColor;
        
        if (color && color !== 'white' && color !== 'rgb(255, 255, 255)') {
            ctx.fillStyle = color;
            ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
        }
    });
    
    // Create download link
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    link.download = `pixelated-art-${gridSize}x${gridSize}-${timestamp}.png`;
    link.href = canvas.toDataURL('image/png');
    
    // Add to DOM temporarily and click
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success message
    showNotification('Artwork downloaded successfully!', 'success');
}

function validateHexColor(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Check if valid hex
    if (!/^[0-9A-F]{6}$/i.test(hex)) {
        return false;
    }
    
    // Extract RGB values and validate they're within bounds
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const bgColor = {
        'success': 'linear-gradient(135deg, rgba(0, 254, 155, 0.95) 0%, rgba(0, 200, 120, 0.95) 100%)',
        'warning': 'linear-gradient(135deg, rgba(255, 193, 7, 0.95) 0%, rgba(255, 152, 0, 0.95) 100%)',
        'error': 'linear-gradient(135deg, rgba(255, 71, 87, 0.95) 0%, rgba(255, 45, 85, 0.95) 100%)',
        'info': 'linear-gradient(135deg, rgba(255, 83, 205, 0.95) 0%, rgba(120, 119, 198, 0.95) 100%)'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor[type] || bgColor.info};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-family: neon;
        font-size: 1.2rem;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        text-transform: uppercase;
        font-weight: 400;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
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
            document.querySelector('.fill-bucket').style.opacity = '0.8';
            return;
        }
        
        if (isDrawing && !box.classList.contains('outside-outline')) {
            hasDrawn = true;
            const drawColor = rainbow ? 
                `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})` : 
                color;
            
            // Apply brush size
            const [row, col] = box.id.split('-').map(Number);
            const gridSize = Math.sqrt(document.querySelectorAll('.box').length);
            
            for (let i = -Math.floor(brushSize/2); i <= Math.floor(brushSize/2); i++) {
                for (let j = -Math.floor(brushSize/2); j <= Math.floor(brushSize/2); j++) {
                    const targetRow = row + i;
                    const targetCol = col + j;
                    
                    if (targetRow >= 0 && targetRow < gridSize && targetCol >= 0 && targetCol < gridSize) {
                        const targetBox = document.getElementById(`${targetRow}-${targetCol}`);
                        if (targetBox && !targetBox.classList.contains('outside-outline')) {
                            targetBox.style.backgroundColor = drawColor;
                        }
                    }
                }
            }
        }
    }

    let boxes = document.querySelectorAll('.box');
    boxes.forEach(box => {
        // Mouse events
        box.addEventListener('mousedown', () => {
            startDrawing();
            drawBox(box);
        });
        box.addEventListener('mouseover', () => {
            drawBox(box);
        });
        
        // Touch events for mobile
        box.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing();
            drawBox(box);
        }, { passive: false });
        
        box.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (isDrawing) {
                const touch = e.touches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                if (element && element.classList.contains('box')) {
                    drawBox(element);
                }
            }
        }, { passive: false });
    });

    document.addEventListener('mouseup', stopDrawing);
    document.addEventListener('touchend', stopDrawing);
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
        if (eraseButton.style.opacity == 1) {
            draw('white');
        }
        else if (rainbowButton.style.opacity == 1) {
            draw('white',true);
        }
    });

    clearButton.onclick = clearGrid;

    eraseButton.addEventListener('click', () => {
        eraseButton.style.cssText = "opacity: 1;"
        rainbowButton.style.cssText = "font-family: neon; color: white; opacity: 0.6; transition: 0.3s; cursor: pointer; background-color: transparent; padding: 10px 20px; margin: 5px; transition-duration: 0.4s; font-size: 1.8rem; text-align: center; text-transform: uppercase; font-weight: 400;"
        draw('white');
    });

    rainbowButton.addEventListener('click', () => {
        rainbowButton.style.cssText = "opacity: 1;"
        eraseButton.style.cssText = "font-family: neon; color: white; opacity: 0.6; transition: 0.3s; cursor: pointer; background-color: transparent; padding: 10px 20px; margin: 5px; transition-duration: 0.4s; font-size: 1.8rem; text-align: center; text-transform: uppercase; font-weight: 400;"
        draw('white',true);
    });

    colorButton.addEventListener('click', () => {
        eraseButton.style.cssText = "font-family: neon; color: white; opacity: 0.6; transition: 0.3s; cursor: pointer; background-color: transparent; padding: 10px 20px; margin: 5px; transition-duration: 0.4s; font-size: 1.8rem; text-align: center; text-transform: uppercase; font-weight: 400;"
        rainbowButton.style.cssText = "font-family: neon; color: white; opacity: 0.6; transition: 0.3s; cursor: pointer; background-color: transparent; padding: 10px 20px; margin: 5px; transition-duration: 0.4s; font-size: 1.8rem; text-align: center; text-transform: uppercase; font-weight: 400;"
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
        if (eraseButton.style.opacity == 1) {
            draw('white');
        }
        else if (rainbowButton.style.opacity == 1) {
            draw('white', true);
        }
    });

    const fillButton = document.querySelector('.fill-bucket');
    fillButton.addEventListener('click', () => {
        fillMode = !fillMode;
        fillButton.style.opacity = fillMode ? '1' : '0.8';
    });

    const downloadButton = document.querySelector('.download');
    downloadButton.addEventListener('click', downloadCanvas);
    
    const savePaletteButton = document.querySelector('.save-palette');
    savePaletteButton.addEventListener('click', savePalette);
    
    const helpButton = document.querySelector('.help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeModal = document.querySelector('.close');
    
    helpButton.addEventListener('click', () => {
        helpModal.style.display = 'block';
    });
    
    closeModal.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });

    const undoButton = document.querySelector('.undo-btn');
    undoButton.addEventListener('click', undo);

    const redoButton = document.querySelector('.redo-btn');
    redoButton.addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
        // Prevent default for all our shortcuts
        const shortcuts = ['z', 'y', 'c', 'f', 'd', 'r', 'e', 's'];
        if (e.ctrlKey && shortcuts.includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
        
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            undo();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            redo();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            clearGrid();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
            fillMode = !fillMode;
            document.querySelector('.fill-bucket').style.opacity = fillMode ? '1' : '0.8';
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'd') {
            downloadCanvas();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'r') {
            document.querySelector('.rainbow').click();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'e') {
            document.querySelector('.eraser').click();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            savePalette();
        }
        
        // Brush size shortcuts
        if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey) {
            const size = parseInt(e.key);
            brushSize = size;
            document.getElementById('brush-size-slider').value = size;
            document.getElementById('brush-size-value').textContent = size;
        }
        
        // Zoom shortcuts
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            document.querySelector('.zoom-in').click();
        }
        if (e.key === '-') {
            e.preventDefault();
            document.querySelector('.zoom-out').click();
        }
        if (e.key === '0') {
            e.preventDefault();
            document.querySelector('.zoom-reset').click();
        }
    });

    window.addEventListener("load", startup, false);
    
    // Handle window resize for responsive design
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const currentSize = boxSlider.value;
            removeGrid();
            createGrid(currentSize);
            const colorPicker = document.querySelector("#color-picker");
            draw(colorPicker.value);
            if (eraseButton.style.opacity == 1) {
                draw('white');
            }
            else if (rainbowButton.style.opacity == 1) {
                draw('white', true);
            }
        }, 250);
    });

}

function setupColorPicker() {
    const colorPicker = document.querySelector("#color-picker");
    const hexInput = document.querySelector("#hex-input");
    const paletteColors = document.querySelectorAll('.palette-color');
    
    // Set initial color to red to match the HTML default
    const initialColor = "#FF0000";
    colorPicker.value = initialColor;
    hexInput.value = initialColor;
    currentColor = initialColor;
    
    // Update active palette color
    function updateActivePaletteColor(color) {
        paletteColors.forEach(pc => pc.classList.remove('active'));
        const matchingColor = Array.from(paletteColors).find(pc => 
            pc.dataset.color.toLowerCase() === color.toLowerCase()
        );
        if (matchingColor) {
            matchingColor.classList.add('active');
        }
    }
    
    colorPicker.addEventListener("input", (e) => {
        currentColor = e.target.value;
        hexInput.value = e.target.value.toUpperCase();
        updateActivePaletteColor(e.target.value);
        updateFirst(e);
    });
    
    colorPicker.addEventListener("change", (e) => {
        currentColor = e.target.value;
        hexInput.value = e.target.value.toUpperCase();
        updateActivePaletteColor(e.target.value);
        updateAll(e);
    });
    
    hexInput.addEventListener("input", (e) => {
        let value = e.target.value.trim().toUpperCase();
        
        // Remove any non-hex characters except #
        value = value.replace(/[^#0-9A-F]/gi, '');
        
        // Ensure it starts with #
        if (value && !value.startsWith('#')) {
            value = '#' + value.replace(/#/g, '');
        }
        
        // If empty, set to #
        if (!value) {
            value = '#';
        }
        
        // Limit to 7 characters (#RRGGBB)
        if (value.length > 7) {
            value = value.substring(0, 7);
        }
        
        // Update the input field with cleaned value
        e.target.value = value;
        
        // Validate complete hex color
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            currentColor = value;
            colorPicker.value = value;
            updateActivePaletteColor(value);
            draw(value);
            e.target.classList.remove('invalid');
        } else if (value.length === 7 && value !== '#') {
            // Invalid hex color
            e.target.classList.add('invalid');
        } else {
            e.target.classList.remove('invalid');
        }
    });
    
    hexInput.addEventListener("keydown", (e) => {
        // Allow backspace, delete, tab, escape, enter, and arrow keys
        if ([8, 9, 27, 13, 37, 38, 39, 40, 46].includes(e.keyCode) ||
            // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.ctrlKey && [65, 67, 86, 88].includes(e.keyCode))) {
            return;
        }
        
        // Only allow hex characters (0-9, A-F, a-f) and #
        const char = String.fromCharCode(e.keyCode);
        if (!/[0-9A-Fa-f#]/.test(char)) {
            e.preventDefault();
        }
    });
    
    hexInput.addEventListener("blur", (e) => {
        let value = e.target.value.trim().toUpperCase();
        
        // Clean and validate
        value = value.replace(/[^#0-9A-F]/gi, '');
        if (value && !value.startsWith('#')) {
            value = '#' + value.replace(/#/g, '');
        }
        
        // If incomplete or invalid, revert to current color
        if (!/^#[0-9A-F]{6}$/i.test(value) || value.length !== 7) {
            e.target.value = currentColor.toUpperCase();
            e.target.classList.remove('invalid');
            if (value && value !== '#') {
                showNotification('Invalid color code. Reverted to previous color.', 'warning');
            }
        } else {
            e.target.value = value;
            currentColor = value;
            colorPicker.value = value;
            updateActivePaletteColor(value);
            e.target.classList.remove('invalid');
        }
    });
    
    // Palette color selection
    paletteColors.forEach(paletteColor => {
        paletteColor.addEventListener('click', () => {
            const color = paletteColor.dataset.color;
            currentColor = color;
            colorPicker.value = color;
            hexInput.value = color.toUpperCase();
            updateActivePaletteColor(color);
            draw(color);
        });
    });
    
    // Handle paste events
    hexInput.addEventListener("paste", (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        let cleanedText = pastedText.trim().toUpperCase().replace(/[^#0-9A-F]/gi, '');
        
        if (!cleanedText.startsWith('#') && cleanedText) {
            cleanedText = '#' + cleanedText.replace(/#/g, '');
        }
        
        if (cleanedText.length > 7) {
            cleanedText = cleanedText.substring(0, 7);
        }
        
        hexInput.value = cleanedText;
        
        // Trigger input event to validate
        const inputEvent = new Event('input', { bubbles: true });
        hexInput.dispatchEvent(inputEvent);
    });
    
    // Set initial active color
    updateActivePaletteColor(initialColor);
}

function setupBrushSize() {
    const brushSizeSlider = document.getElementById('brush-size-slider');
    const brushSizeValue = document.getElementById('brush-size-value');
    
    brushSizeSlider.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        brushSizeValue.textContent = brushSize;
    });
}

function savePalette() {
    const colors = Array.from(document.querySelectorAll('.palette-color')).map(pc => pc.dataset.color);
    const customColors = JSON.parse(localStorage.getItem('customPalette') || '[]');
    
    // Add current color if not already in palette
    if (!colors.includes(currentColor.toUpperCase()) && !customColors.includes(currentColor.toUpperCase())) {
        customColors.push(currentColor.toUpperCase());
        localStorage.setItem('customPalette', JSON.stringify(customColors));
        
        // Add to palette display
        const palette = document.getElementById('color-palette');
        const newColor = document.createElement('div');
        newColor.className = 'palette-color';
        newColor.dataset.color = currentColor.toUpperCase();
        newColor.style.backgroundColor = currentColor;
        newColor.title = currentColor.toUpperCase();
        
        newColor.addEventListener('click', () => {
            const color = newColor.dataset.color;
            currentColor = color;
            document.querySelector("#color-picker").value = color;
            document.querySelector("#hex-input").value = color;
            document.querySelectorAll('.palette-color').forEach(pc => pc.classList.remove('active'));
            newColor.classList.add('active');
            draw(color);
        });
        
        palette.appendChild(newColor);
    }
}

function loadCustomPalette() {
    const customColors = JSON.parse(localStorage.getItem('customPalette') || '[]');
    const palette = document.getElementById('color-palette');
    
    customColors.forEach(color => {
        const newColor = document.createElement('div');
        newColor.className = 'palette-color';
        newColor.dataset.color = color;
        newColor.style.backgroundColor = color;
        newColor.title = color;
        
        newColor.addEventListener('click', () => {
            currentColor = color;
            document.querySelector("#color-picker").value = color;
            document.querySelector("#hex-input").value = color;
            document.querySelectorAll('.palette-color').forEach(pc => pc.classList.remove('active'));
            newColor.classList.add('active');
            draw(color);
        });
        
        palette.appendChild(newColor);
    });
}

function setupZoomControls() {
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const zoomInBtn = document.querySelector('.zoom-in');
    const zoomOutBtn = document.querySelector('.zoom-out');
    const zoomResetBtn = document.querySelector('.zoom-reset');
    const grid = document.querySelector('.grid');
    const drawingArea = document.querySelector('.drawing-area');
    
    function updateZoom(zoom) {
        currentZoom = Math.max(50, Math.min(200, zoom));
        zoomSlider.value = currentZoom;
        zoomValue.textContent = currentZoom + '%';
        
        if (currentZoom !== 100) {
            grid.classList.add('zoom-transform');
            drawingArea.classList.add('zoomed');
            grid.style.transform = `scale(${currentZoom / 100})`;
        } else {
            grid.classList.remove('zoom-transform');
            drawingArea.classList.remove('zoomed');
            grid.style.transform = 'scale(1)';
        }
    }
    
    zoomSlider.addEventListener('input', (e) => {
        updateZoom(parseInt(e.target.value));
    });
    
    zoomInBtn.addEventListener('click', () => {
        updateZoom(currentZoom + 25);
    });
    
    zoomOutBtn.addEventListener('click', () => {
        updateZoom(currentZoom - 25);
    });
    
    zoomResetBtn.addEventListener('click', () => {
        updateZoom(100);
    });
}

function startup() {
    setupColorPicker();
    setupZoomControls();
    setupBrushSize();
    loadCustomPalette();
}

function updateFirst(event) {
    draw(event.target.value);
}

function updateAll(event) {
    draw(event.target.value);
}



gridAction();

