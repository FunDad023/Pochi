const canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ch = canvas.height;
const cw = canvas.width;
const ratioh = 15
const ratiow = 7
const sidePadding = Math.min(16, cw * 0.04)
const panelGap = Math.min(24, cw * 0.05)
const panelWidth = Math.min(220, Math.max(1, Math.min(cw * 0.28, cw - sidePadding * 2 - panelGap - 1)))
const maxBoardWidth = Math.max(1, cw - sidePadding * 2 - panelGap - panelWidth)
const maxBoardHeight = Math.max(1, ch - 50)
const khungw = Math.min(maxBoardWidth, maxBoardHeight * ratiow / ratioh)
const khungh = khungw * ratioh / ratiow
const boardX = (cw - khungw - panelGap - panelWidth) / 2
const boardY = (ch - khungh) / 2
const panelX = boardX + khungw + panelGap


export const essen = {
    canvas, ch, cw, khungw, khungh, ratioh, ratiow,
    boardX, boardY, panelX, panelWidth
}
    
