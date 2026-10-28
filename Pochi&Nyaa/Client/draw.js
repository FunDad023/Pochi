import {essen} from './essentials.js'
const canvas = essen.canvas
const ctx = canvas.getContext('2d')
const khungw = essen.khungw
const khungh = essen.khungh
const catPalettes = [
    {base:'#63d0ff',blockFill:'rgba(112,216,255,1)',dark:'#2186b7',outline:'#5a5142',light:'#d9f6ff',innerEar:'#ffb0c5',blush:'#ff8fa8',eye:'#514b40',glow:'rgba(99,208,255,0.78)'},
    {base:'#73dc7d',blockFill:'rgba(124,228,136,1)',dark:'#379b50',outline:'#5a5142',light:'#e2ffe3',innerEar:'#ffb0bd',blush:'#ff91a1',eye:'#514b40',glow:'rgba(115,220,125,0.78)'},
    {base:'#ffd750',blockFill:'rgba(255,226,101,1)',dark:'#d59a1b',outline:'#5a5142',light:'#fff4bd',innerEar:'#f49a9b',blush:'#f18e89',eye:'#514b40',glow:'rgba(255,215,80,0.78)'},
    {base:'#b97dff',blockFill:'rgba(196,139,255,1)',dark:'#8150c5',outline:'#5a5142',light:'#f1dcff',innerEar:'#ffafc7',blush:'#ff90bc',eye:'#514b40',glow:'rgba(185,125,255,0.78)'}
]

function nen() {
    ctx.fillStyle = 'rgba(65, 65, 65, 0.5)';
    ctx.fillRect(essen.boardX, essen.boardY, khungw, khungh);
}
export function khung() {
    nen()
}

function roundedRectPath(x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
}

function traceNormalCatHead(cx, cy, radiusX, radiusY) {
    ctx.beginPath()
    ctx.moveTo(cx - radiusX * 0.94, cy - radiusY * 0.12)
    ctx.quadraticCurveTo(cx - radiusX * 1.08, cy - radiusY * 0.60, cx - radiusX * 0.78, cy - radiusY * 0.88)
    ctx.quadraticCurveTo(cx - radiusX * 0.58, cy - radiusY * 1.03, cx - radiusX * 0.28, cy - radiusY * 0.60)
    ctx.quadraticCurveTo(cx, cy - radiusY * 0.74, cx + radiusX * 0.28, cy - radiusY * 0.60)
    ctx.quadraticCurveTo(cx + radiusX * 0.58, cy - radiusY * 1.03, cx + radiusX * 0.78, cy - radiusY * 0.88)
    ctx.quadraticCurveTo(cx + radiusX * 1.08, cy - radiusY * 0.60, cx + radiusX * 0.94, cy - radiusY * 0.12)
    ctx.quadraticCurveTo(cx + radiusX * 1.14, cy + radiusY * 0.35, cx + radiusX * 0.72, cy + radiusY * 0.63)
    ctx.quadraticCurveTo(cx + radiusX * 0.38, cy + radiusY * 0.84, cx, cy + radiusY * 0.81)
    ctx.quadraticCurveTo(cx - radiusX * 0.38, cy + radiusY * 0.84, cx - radiusX * 0.72, cy + radiusY * 0.63)
    ctx.quadraticCurveTo(cx - radiusX * 1.14, cy + radiusY * 0.35, cx - radiusX * 0.94, cy - radiusY * 0.12)
    ctx.closePath()
}

function strokeDebossedPath(drawPath, size, lineWidth, color) {
    const offset = Math.max(0.35, size * 0.008)
    ctx.save()
    ctx.translate(offset, offset)
    drawPath()
    ctx.strokeStyle = 'rgba(8, 7, 6, 0.52)'
    ctx.lineWidth = lineWidth + Math.max(0.25, size * 0.006)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.translate(-offset * 0.45, -offset * 0.45)
    drawPath()
    ctx.strokeStyle = 'rgba(255, 250, 230, 0.34)'
    ctx.lineWidth = Math.max(0.4, lineWidth * 0.42)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()

    drawPath()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
}

function drawCatFace(cx, cy, size, palette) {
    const baseAlpha = ctx.globalAlpha
    for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(cx + side * size * 0.36, cy - size * 0.18)
        ctx.quadraticCurveTo(cx + side * size * 0.34, cy - size * 0.38, cx + side * size * 0.16, cy - size * 0.31)
        ctx.quadraticCurveTo(cx + side * size * 0.13, cy - size * 0.20, cx + side * size * 0.18, cy - size * 0.13)
        ctx.closePath()
        ctx.fillStyle = palette.innerEar
        ctx.globalAlpha = baseAlpha * 0.72
        ctx.fill()
        ctx.globalAlpha = baseAlpha
        ctx.strokeStyle = palette.outline
        ctx.lineWidth = Math.max(0.65, size * 0.022)
        ctx.lineJoin = 'round'
        ctx.stroke()

        const eyeX = cx + side * size * 0.20
        const eyeY = cy - size * 0.015
        ctx.beginPath()
        ctx.arc(eyeX, eyeY, Math.max(0.8, size * 0.055), 0, Math.PI * 2)
        ctx.fillStyle = palette.eye
        ctx.fill()
        ctx.beginPath()
        ctx.arc(eyeX - size * 0.012, eyeY - size * 0.018, Math.max(0.3, size * 0.014), 0, Math.PI * 2)
        ctx.fillStyle = '#fffaf3'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(cx + side * size * 0.32, cy + size * 0.105, size * 0.032, 0, Math.PI * 2)
        ctx.fillStyle = palette.blush
        ctx.globalAlpha = baseAlpha * 0.78
        ctx.fill()
        ctx.globalAlpha = baseAlpha

        ctx.beginPath()
        ctx.moveTo(cx + side * size * 0.35, cy + size * 0.08)
        ctx.lineTo(cx + side * size * 0.44, cy + size * 0.05)
        ctx.moveTo(cx + side * size * 0.35, cy + size * 0.15)
        ctx.lineTo(cx + side * size * 0.44, cy + size * 0.18)
        ctx.strokeStyle = palette.eye
        ctx.lineWidth = Math.max(0.55, size * 0.018)
        ctx.lineCap = 'round'
        ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(cx - size * 0.045, cy + size * 0.09)
    ctx.lineTo(cx + size * 0.045, cy + size * 0.09)
    ctx.lineTo(cx, cy + size * 0.135)
    ctx.closePath()
    ctx.fillStyle = '#e87891'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx, cy + size * 0.13)
    ctx.quadraticCurveTo(cx - size * 0.055, cy + size * 0.22, cx - size * 0.14, cy + size * 0.15)
    ctx.moveTo(cx, cy + size * 0.13)
    ctx.quadraticCurveTo(cx + size * 0.055, cy + size * 0.22, cx + size * 0.14, cy + size * 0.15)
    ctx.strokeStyle = palette.eye
    ctx.lineWidth = Math.max(0.7, size * 0.025)
    ctx.lineCap = 'round'
    ctx.stroke()
}

function drawCatHead(x, y, size, palette) {
    const inset = size * 0.015
    const tileX = x + inset
    const tileY = y + inset
    const tileSize = size - inset * 2
    const tileRadius = tileSize * 0.12

    ctx.save()
    ctx.shadowColor = 'rgba(76, 61, 39, 0.16)'
    ctx.shadowBlur = size * 0.045
    ctx.shadowOffsetY = size * 0.018
    roundedRectPath(tileX, tileY, tileSize, tileSize, tileRadius)
    ctx.fillStyle = palette.blockFill
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    const lineColor = '#11100e'
    const borderGradient = ctx.createLinearGradient(tileX, tileY, tileX + tileSize, tileY + tileSize)
    borderGradient.addColorStop(0, '#302a22')
    borderGradient.addColorStop(0.48, '#090807')
    borderGradient.addColorStop(1, '#24201a')
    const borderWidth = Math.max(1.2, size * 0.04)
    ctx.save()
    ctx.shadowColor = 'rgba(8, 7, 6, 0.2)'
    ctx.shadowBlur = size * 0.018
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    roundedRectPath(tileX, tileY, tileSize, tileSize, tileRadius)
    ctx.strokeStyle = borderGradient
    ctx.lineWidth = borderWidth
    ctx.stroke()
    ctx.restore()

    const innerInset = borderWidth * 0.45
    const innerGradient = ctx.createLinearGradient(tileX, tileY, tileX + tileSize, tileY + tileSize)
    innerGradient.addColorStop(0, 'rgba(8, 7, 6, 0.2)')
    innerGradient.addColorStop(0.5, 'rgba(8, 7, 6, 0.1)')
    innerGradient.addColorStop(1, 'rgba(8, 7, 6, 0.16)')
    roundedRectPath(
        tileX + innerInset,
        tileY + innerInset,
        tileSize - innerInset * 2,
        tileSize - innerInset * 2,
        Math.max(0, tileRadius - innerInset)
    )
    ctx.strokeStyle = innerGradient
    ctx.lineWidth = Math.max(0.45, size * 0.009)
    ctx.stroke()

    const cx = tileX + tileSize / 2
    const cy = tileY + tileSize * 0.53
    const radiusX = tileSize * 0.34
    const radiusY = tileSize * 0.33

    strokeDebossedPath(
        () => traceNormalCatHead(cx, cy, radiusX, radiusY),
        size,
        Math.max(1, size * 0.027),
        lineColor
    )

    for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(cx + side * radiusX * 0.79, cy - radiusY * 0.23)
        ctx.quadraticCurveTo(cx + side * radiusX * 0.70, cy - radiusY * 0.72, cx + side * radiusX * 0.43, cy - radiusY * 0.49)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = Math.max(0.8, size * 0.019)
        ctx.lineCap = 'round'
        ctx.stroke()

        const eyeX = cx + side * tileSize * 0.16
        const eyeY = cy - tileSize * 0.025
        ctx.beginPath()
        ctx.arc(eyeX, eyeY, tileSize * 0.043, 0, Math.PI * 2)
        ctx.fillStyle = lineColor
        ctx.fill()

        for (const whiskerOffset of [-0.09, 0, 0.09]) {
            const whiskerY = cy + tileSize * whiskerOffset
            ctx.beginPath()
            ctx.moveTo(cx + side * radiusX * 0.79, whiskerY)
            ctx.lineTo(cx + side * tileSize * 0.42, whiskerY + side * whiskerOffset * 0.12)
            ctx.strokeStyle = lineColor
            ctx.lineWidth = Math.max(0.8, size * 0.021)
            ctx.lineCap = 'round'
            ctx.stroke()
        }
    }

    ctx.beginPath()
    ctx.moveTo(cx - tileSize * 0.035, cy + tileSize * 0.065)
    ctx.quadraticCurveTo(cx, cy + tileSize * 0.035, cx + tileSize * 0.035, cy + tileSize * 0.065)
    ctx.quadraticCurveTo(cx + tileSize * 0.015, cy + tileSize * 0.105, cx, cy + tileSize * 0.105)
    ctx.quadraticCurveTo(cx - tileSize * 0.015, cy + tileSize * 0.105, cx - tileSize * 0.035, cy + tileSize * 0.065)
    ctx.fillStyle = lineColor
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx, cy + tileSize * 0.10)
    ctx.lineTo(cx, cy + tileSize * 0.145)
    ctx.moveTo(cx, cy + tileSize * 0.145)
    ctx.quadraticCurveTo(cx - tileSize * 0.045, cy + tileSize * 0.20, cx - tileSize * 0.095, cy + tileSize * 0.155)
    ctx.moveTo(cx, cy + tileSize * 0.145)
    ctx.quadraticCurveTo(cx + tileSize * 0.045, cy + tileSize * 0.20, cx + tileSize * 0.095, cy + tileSize * 0.155)
    ctx.strokeStyle = lineColor
    ctx.lineWidth = Math.max(1, size * 0.027)
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.restore()
}

function drawTriggerCat(x, y, size, palette) {
    const inset = size * 0.055
    const left = x + inset
    const top = y + inset
    const right = x + size - inset
    const bottom = y + size - inset
    const centerX = x + size / 2
    const centerY = y + size / 2
    const gradient = ctx.createLinearGradient(left, top, right, bottom)
    gradient.addColorStop(0, palette.light)
    gradient.addColorStop(0.5, palette.base)
    gradient.addColorStop(1, palette.dark)

    ctx.save()
    ctx.shadowColor = palette.glow
    ctx.shadowBlur = size * 0.2
    ctx.shadowOffsetY = 0
    ctx.beginPath()
    ctx.moveTo(centerX, top)
    ctx.lineTo(right, centerY)
    ctx.lineTo(centerX, bottom)
    ctx.lineTo(left, centerY)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.strokeStyle = palette.outline
    ctx.lineWidth = Math.max(1, size * 0.055)
    ctx.lineJoin = 'round'
    ctx.stroke()

    const shineInset = size * 0.16
    ctx.beginPath()
    ctx.moveTo(centerX, top + shineInset)
    ctx.lineTo(right - shineInset, centerY)
    ctx.lineTo(centerX, bottom - shineInset)
    ctx.lineTo(left + shineInset, centerY)
    ctx.closePath()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)'
    ctx.lineWidth = Math.max(0.6, size * 0.022)
    ctx.stroke()

    drawCatFace(centerX, centerY + size * 0.035, size * 0.62, palette)
    ctx.restore()
}

function drawCatSprite(x, y, width, height, color, isTrigger=false) {
    const size = Math.min(width, height)
    const palette = catPalettes[color - 1] || catPalettes[0]
    if (isTrigger) {
        drawTriggerCat(x + (width - size) / 2, y + (height - size) / 2, size, palette)
    } else {
        drawCatHead(x + (width - size) / 2, y + (height - size) / 2, size, palette)
    }
}

// Optional scale values let landing feedback squash or stretch this sprite later.
export function block(x,y,type=1,scaleX=1,scaleY=1,opacity=1) {
    const isTrigger = type > catPalettes.length
    const color = isTrigger ? type - catPalettes.length : type
    const centerCol = Math.floor(essen.ratiow / 2)
    const blockX = essen.boardX+khungw/essen.ratiow*centerCol+x
    const blockY = essen.boardY+y
    const blockW = khungw/essen.ratiow
    const blockH = khungh/essen.ratioh
    const inset = Math.max(0.25, Math.min(blockW, blockH) * (isTrigger ? 0.035 : 0.008))

    ctx.save()
    ctx.translate(blockX + blockW / 2, blockY + blockH / 2)
    ctx.scale(scaleX, scaleY)
    ctx.globalAlpha *= Math.max(0, Math.min(1, opacity))
    drawCatSprite(
        -blockW / 2 + inset,
        -blockH / 2 + inset,
        blockW - inset * 2,
        blockH - inset * 2,
        color,
        isTrigger
    )
    ctx.restore()
}

export function getBlockParticleColor(type) {
    const color = type > catPalettes.length ? type - catPalettes.length : type
    return (catPalettes[color - 1] || catPalettes[0]).base
}

export function getScoreAnchor(score) {
    const x = essen.panelX
    const y = essen.boardY
    const width = essen.panelWidth
    const scale = Math.min(1, width / 190)
    const padding = Math.min(10 * scale, width * 0.08)
    const innerWidth = width - padding * 2
    const fontSize = Math.min(30 * scale, innerWidth * 0.62)

    ctx.save()
    ctx.font = `700 ${fontSize}px sans-serif`
    const textWidth = Math.min(ctx.measureText(String(score)).width, innerWidth)
    ctx.restore()

    return {
        x:x + padding + textWidth / 2,
        y:y + 47 * scale
    }
}

export function sidePanel(score, nextPairs) {
    const x = essen.panelX
    const y = essen.boardY
    const width = essen.panelWidth
    const height = khungh
    const scale = Math.min(1, width / 190)
    const padding = Math.min(10 * scale, width * 0.08)
    const innerWidth = width - padding * 2
    ctx.save()
    ctx.fillStyle = 'rgba(30, 30, 30, 0.88)'
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, width, height)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.font = `600 ${13 * scale}px sans-serif`
    ctx.fillText('SCORE', x + padding, y + 18 * scale)

    ctx.fillStyle = 'white'
    ctx.font = `700 ${Math.min(30 * scale, innerWidth * 0.62)}px sans-serif`
    ctx.fillText(String(score), x + padding, y + 47 * scale, innerWidth)

    const dividerY = y + 64 * scale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)'
    ctx.beginPath()
    ctx.moveTo(x + padding, dividerY)
    ctx.lineTo(x + width - padding, dividerY)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.font = `600 ${13 * scale}px sans-serif`
    ctx.fillText('NEXT', x + padding, y + 82 * scale)

    const cardGap = 8 * scale
    const cardsTop = y + 94 * scale
    const cardHeight = Math.max(0, (height - (cardsTop - y) - padding - cardGap) / 2)
    for (let index = 0; index < 2; index += 1) {
        const cardY = cardsTop + index * (cardHeight + cardGap)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.fillRect(x + padding, cardY, innerWidth, cardHeight)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.strokeRect(x + padding, cardY, innerWidth, cardHeight)

        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
        ctx.font = `500 ${10 * scale}px sans-serif`
        ctx.fillText(`PAIR ${index + 1}`, x + padding + 6 * scale, cardY + 12 * scale)

        const pair = nextPairs[index]
        const previewAreaTop = 23 * scale
        const previewAreaHeight = Math.max(0, cardHeight - previewAreaTop - 4 * scale)
        const blockSize = Math.max(0, Math.min(
            36 * scale,
            cardHeight * 0.32,
            innerWidth * 0.52,
            (previewAreaHeight - 2 * scale) / 2
        ))
        if (!pair || pair.length !== 2 || blockSize === 0) continue

        const pairX = x + (width - blockSize) / 2
        const pairHeight = blockSize * 2 + 2 * scale
        const pairY = cardY + previewAreaTop + Math.max(0, (previewAreaHeight - pairHeight) / 2)
        const previewColors = [pair[1], pair[0]]
        for (let blockIndex = 0; blockIndex < previewColors.length; blockIndex += 1) {
            const blockY = pairY + blockIndex * (blockSize + 2 * scale)
            drawCatSprite(pairX, blockY, blockSize, blockSize, previewColors[blockIndex])
        }
    }
    ctx.restore()
}
