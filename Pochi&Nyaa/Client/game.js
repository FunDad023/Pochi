import {khung} from './draw.js'
import {block, drawLossZoneX, getBlockParticleColor, getScoreAnchor, sidePanel} from './draw.js'
import {essen} from './essentials.js'
let lastTime = 0
const hiddenTopRows = 2 // Extra storage above the visible frame for top-out overflow.
let blocks = Array.from({length:essen.ratioh + hiddenTopRows},()=>Array(essen.ratiow).fill(0))
let triggerExpiresAtTurn = Array.from({length:blocks.length},()=>Array(essen.ratiow).fill(null))
let placementTurn = 0
let pendingIncomingGarbage = 0
let garbageColumnCursor = 0
let key = {a:false,d:false,s:false,ArrowUp:false,ArrowLeft:false}
let activePair = null
let pairMotion = null
let gameOver = false
let isResolving = false
let horizontalKey = null
let nextHorizontalMove = 0
let nextSpawnAt = null
let fallAnimations = []
let landingAnimations = new Map()
let shapeFlashAnimations = []
let pendingShapeCells = []
let scoreParticles = []
let explosionShake = {startTime:-Infinity,strength:0}
let gravityAnimationComplete = null
let upcomingPairs = []
let score = 0
const placeBlockSound = new Audio(new URL('./sounds/placeblock1.MP3', import.meta.url))
placeBlockSound.preload = 'auto'
const switchSound = new Audio(new URL('./sounds/switch.MP3', import.meta.url))
switchSound.preload = 'auto'
const blockBlastSound = new Audio(new URL('./sounds/blast2.MP3', import.meta.url))
blockBlastSound.preload = 'auto'

const colorCount = 4
const garbageBlockCode = colorCount * 2 + 1
const triggerGarbageTurnLimit = 4 // Number of later pair placements before an unused trigger expires.
const previewPairCount = 2
const pairMotionDuration = 64
const horizontalDelay = 200
const horizontalRepeat = 70
const spawnDelay = 350
const normalFallCellsPerSecond = 2
const fastFallCellsPerSecond = 35
const gravityFallCellsPerSecond = 50
const gravityAnimationMinDuration = 20 // Keep fast falls visible for at least one frame.
const landingBounceDuration = 300
const landingBounceStrength = 0.35
const shapeFlashCount = 3
const shapeFlashCycleDuration = 160
const shapeFlashOnDuration = 80
const explosionWaveDelay = 80
const scoreParticleDuration = 620
const scoreParticleBaseSize = 30 // Change this value to tune particle size.
const explosionShakeDuration = 200
const explosionShakeBaseStrength = 3
const explosionShakePerCellStrength = 0.9
const explosionShakeMaxStrength = 2
const scoreParticleCountPerBlock = 1   // 0.5 creates one particle for every two normal blocks.

function randomColor() {
    return Math.floor(Math.random() * colorCount) + 1
}

function playPlaceBlockSound() {
    placeBlockSound.currentTime = 0
    const playback = placeBlockSound.play()
    if (playback) playback.catch(() => {})
}

function playSwitchSound() {
    const sound = switchSound.cloneNode()
    sound.currentTime = 0
    const playback = sound.play()
    if (playback) playback.catch(() => {})
}

function playBlockBlastSound() {
    const sound = blockBlastSound.cloneNode()
    sound.currentTime = 0
    const playback = sound.play()
    if (playback) playback.catch(() => {})
}

function getExplosionSoundKeys(waves) {
    const explodedCells = []
    for (const wave of waves) {
        for (const [row, col] of wave) {
            const type = blocks[row][col]
            if (type > 0) explodedCells.push({row,col})
        }
    }

    const soundKeys = new Set()
    for (let index = 1; index < explodedCells.length; index += 2) {
        const cell = explodedCells[index]
        soundKeys.add(cellKey(cell.row, cell.col))
    }
    if (explodedCells.length % 2 === 1) {
        const lastCell = explodedCells[explodedCells.length - 1]
        soundKeys.add(cellKey(lastCell.row, lastCell.col))
    }
    return soundKeys
}

function spawnScoreParticle(row, col, type, timestamp=performance.now()) {
    const cellW = essen.khungw / essen.ratiow
    const cellH = essen.khungh / essen.ratioh
    const centerX = essen.boardX + (col + 0.5) * cellW
    const centerY = essen.boardY + (row - hiddenTopRows + 0.5) * cellH
    const color = getBlockParticleColor(type)

    scoreParticles.push({
        startX:centerX + (Math.random() - 0.5) * cellW * 0.35,
        startY:centerY + (Math.random() - 0.5) * cellH * 0.35,
        startTime:timestamp,
        duration:scoreParticleDuration + Math.random() * 180,
        arcHeight:18 + Math.random() * 24,
        drift:(Math.random() - 0.5) * 40,
        size:scoreParticleBaseSize * (2 / 3 + Math.random() * 2 / 3),
        color
    })
}

function getExplosionParticleCounts(waves, hasScore) {
    const particleCountsByCell = new Map()
    if (!hasScore || scoreParticleCountPerBlock <= 0) return particleCountsByCell

    let particleRemainder = 0
    for (const wave of waves) {
        for (const [row, col] of wave) {
            const type = blocks[row][col]
            if (type <= 0 || type > colorCount) continue

            particleRemainder += scoreParticleCountPerBlock
            while (particleRemainder >= 1) {
                const key = cellKey(row, col)
                particleCountsByCell.set(key, (particleCountsByCell.get(key) || 0) + 1)
                particleRemainder -= 1
            }
        }
    }

    return particleCountsByCell
}

function drawScoreParticles(timestamp) {
    if (scoreParticles.length === 0) return

    const ctx = essen.canvas.getContext('2d')
    const target = getScoreAnchor(score)
    const remainingParticles = []
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    for (const particle of scoreParticles) {
        const progress = (timestamp - particle.startTime) / particle.duration
        if (progress >= 1) continue
        remainingParticles.push(particle)
        if (progress < 0) continue

        const easedProgress = 1 - Math.pow(1 - progress, 3)
        const arc = Math.sin(progress * Math.PI)
        const x = particle.startX + (target.x - particle.startX) * easedProgress + particle.drift * arc
        const y = particle.startY + (target.y - particle.startY) * easedProgress - particle.arcHeight * arc
        const fade = Math.min(1, (1 - progress) * 4)
        const radius = particle.size * (1 - progress * 0.35)

        ctx.globalAlpha = fade
        ctx.fillStyle = particle.color
        ctx.shadowColor = particle.color
        ctx.shadowBlur = radius * 4
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.restore()
    scoreParticles = remainingParticles
}

function startExplosionShake(cellCount, timestamp=performance.now()) {
    const previousProgress = Math.min(1, (timestamp - explosionShake.startTime) / explosionShakeDuration)
    const remainingStrength = explosionShake.strength * (1 - previousProgress)
    const newStrength = Math.min(
        explosionShakeMaxStrength,
        explosionShakeBaseStrength + Math.sqrt(cellCount) * explosionShakePerCellStrength
    )
    explosionShake = {
        startTime:timestamp,
        strength:Math.max(newStrength, remainingStrength)
    }
}

function getExplosionShakeOffset(timestamp) {
    const progress = (timestamp - explosionShake.startTime) / explosionShakeDuration
    if (progress < 0 || progress >= 1) return {x:0,y:0}

    const fade = 1 - progress
    return {
        x:Math.sin(progress * Math.PI * 12) * explosionShake.strength * fade,
        y:Math.sin(progress * Math.PI * 16) * explosionShake.strength * fade * 0.7
    }
}

let pairColorSource = () => [randomColor(), randomColor()]

function isValidPairColors(colors) {
    return Array.isArray(colors) && colors.length === 2 &&
        colors.every(color => Number.isInteger(color) && color >= 1 && color <= colorCount)
}

function fillUpcomingPairs() {
    while (upcomingPairs.length < previewPairCount) {
        const colors = pairColorSource()
        if (!isValidPairColors(colors)) return false
        upcomingPairs.push([...colors])
    }
    return true
}

function getUpcomingPairs() {
    fillUpcomingPairs()
    return upcomingPairs.map(colors => [...colors])
}

export function setPairColorSource(source) {
    if (typeof source !== 'function') return false
    pairColorSource = source
    upcomingPairs = []
    return true
}

export function spawnPair(colors) {
    if (!fillUpcomingPairs()) return false
    const pairColors = colors === undefined ? upcomingPairs[0] : colors
    if (!isValidPairColors(pairColors)) return false
    const pairColorCopy = [...pairColors]

    const cellH = essen.khungh / essen.ratioh
    const centerCol = Math.floor(essen.ratiow / 2)
    const pair = {
        col:centerCol,
        y:-(hiddenTopRows + 0.5) * cellH,
        colors:pairColorCopy,
        offset:{row:-1,col:0},
        trigger:false,
        verticalFlipArmed:false,
        dropped:false,
    }

    if (!canPlacePairAt(pair.y, pair.col, pair.offset, pair)) {
        gameOver = true
        return false
    }

    upcomingPairs.shift()
    fillUpcomingPairs()
    activePair = pair
    pairMotion = null
    nextSpawnAt = null
    return true
}

export function getGameSnapshot() {
    const cellH = essen.khungh / essen.ratioh
    return {
        schemaVersion:3,
        board:blocks.map(row => [...row]),
        boardLayout:{visibleRows:essen.ratioh,hiddenTopRows},
        boardEncoding:{
            empty:0,
            normalColorMin:1,
            normalColorMax:colorCount,
            triggerMin:colorCount + 1,
            triggerMax:colorCount * 2,
            garbage:garbageBlockCode
        },
        placementTurn,
        triggerTurnsRemaining:blocks.map((row, rowIndex) => row.map((cell, colIndex) =>
            isTriggerBlockCode(cell) ? getTriggerTurnsRemaining(rowIndex, colIndex) : null
        )),
        pendingIncomingGarbage,
        garbageColumnCursor,
        score,
        nextPairs:getUpcomingPairs(),
        activePair:activePair ? {
            column:activePair.col,
            row:activePair.y / cellH,
            colors:[...activePair.colors],
            offset:{...activePair.offset},
            trigger:activePair.trigger,
            verticalFlipArmed:activePair.verticalFlipArmed,
            dropped:activePair.dropped
        } : null,
        gameOver,
        resolving:isResolving,
        spawning:nextSpawnAt !== null
    }
}

function blockCode(color, trigger=false) {
    return trigger ? color + colorCount : color
}

function isTriggerBlockCode(cellCode) {
    return cellCode > colorCount && cellCode <= colorCount * 2
}

function advancePlacementTurn() {
    placementTurn += 1
    for (let row = 0; row < blocks.length; row++) {
        for (let col = 0; col < blocks[row].length; col++) {
            if (!isTriggerBlockCode(blocks[row][col])) continue

            const expiresAtTurn = triggerExpiresAtTurn[row][col]
            if (!Number.isInteger(expiresAtTurn) || placementTurn >= expiresAtTurn) {
                blocks[row][col] = garbageBlockCode
                triggerExpiresAtTurn[row][col] = null
            }
        }
    }
}

function getTriggerTurnsRemaining(row, col) {
    if (!isTriggerBlockCode(blocks[row][col])) return null
    const expiresAtTurn = triggerExpiresAtTurn[row][col]
    if (!Number.isInteger(expiresAtTurn)) return 0
    return Math.max(0, expiresAtTurn - placementTurn)
}

function isBlockOfColor(cellCode, color) {
    return cellCode === color || cellCode === color + colorCount
}

function pairSegments(pair=activePair, offset=pair.offset) {
    return [
        {row:0,col:0,color:pair.colors[0]},
        {row:offset.row,col:offset.col,color:pair.colors[1]}
    ]
}

function getPairPose(timestamp=performance.now()) {
    if (!activePair) return null
    const target = {
        col:activePair.col,
        y:activePair.y,
        offset:{...activePair.offset}
    }
    if (!pairMotion) return target

    const progress = Math.min(1, Math.max(0, (timestamp - pairMotion.startTime) / pairMotion.duration))
    if (progress >= 1) {
        pairMotion = null
        return target
    }

    const lerp = (from, to) => from + (to - from) * progress
    return {
        col:lerp(pairMotion.from.col, pairMotion.to.col),
        y:lerp(pairMotion.from.y, pairMotion.to.y) + activePair.y - pairMotion.to.y,
        offset:{
            row:lerp(pairMotion.from.offset.row, pairMotion.to.offset.row),
            col:lerp(pairMotion.from.offset.col, pairMotion.to.offset.col)
        }
    }
}

function animatePairToPose(from, to) {
    if (!from) {
        pairMotion = null
        return
    }
    pairMotion = {
        from:{col:from.col,y:from.y,offset:{...from.offset}},
        to:{col:to.col,y:to.y,offset:{...to.offset}},
        startTime:performance.now(),
        duration:pairMotionDuration
    }
}

function getPairRenderSegments(timestamp) {
    const pose = getPairPose(timestamp)
    if (!pose || !activePair) return []
    return pairSegments({colors:activePair.colors,offset:pose.offset}).map(segment => ({
        color:segment.color,
        col:pose.col + segment.col,
        y:pose.y + segment.row * (essen.khungh / essen.ratioh)
    }))
}

function canPlacePairAt(y, col, offset, pair=activePair) {
    const cellH = essen.khungh / essen.ratioh
    const segments = pairSegments(pair, offset)

    for (const segment of segments) {
        const segmentCol = col + segment.col
        const segmentY = y + segment.row * cellH
        const firstRow = Math.floor(segmentY / cellH)
        const lastRow = Math.floor((segmentY + cellH - 0.001) / cellH)

        if (segmentCol < 0 || segmentCol >= blocks[0].length || lastRow >= essen.ratioh) {
            return false
        }

        for (let row = Math.max(firstRow, -hiddenTopRows); row <= lastRow; row++) {
            const storageRow = row + hiddenTopRows
            if (blocks[storageRow][segmentCol] !== 0) return false
        }
    }

    return true
}

function moveHorizontal(direction) {
    if (!activePair || activePair.dropped || gameOver || isResolving) return false
    const targetCol = activePair.col + direction
    if (!canPlacePairAt(activePair.y, targetCol, activePair.offset)) return false
    const fromPose = getPairPose()
    activePair.col = targetCol
    activePair.verticalFlipArmed = false
    animatePairToPose(fromPose, {
        col:activePair.col,
        y:activePair.y,
        offset:activePair.offset
    })
    return true
}

function tryPairOffset(offset, kicks) {
    const cellH = essen.khungh / essen.ratioh
    const tried = new Set()
    const fromPose = getPairPose()

    for (const kick of kicks) {
        const targetCol = activePair.col + kick.col
        const targetY = activePair.y + kick.row * cellH
        const positionKey = `${targetCol},${targetY}`
        if (tried.has(positionKey)) continue
        tried.add(positionKey)

        if (canPlacePairAt(targetY, targetCol, offset)) {
            activePair.col = targetCol
            activePair.y = targetY
            activePair.offset = offset
            activePair.verticalFlipArmed = false
            animatePairToPose(fromPose, {
                col:activePair.col,
                y:activePair.y,
                offset:activePair.offset
            })
            return true
        }
    }

    return false
}

function rotatePair(direction) {
    if (!activePair || activePair.dropped || gameOver || isResolving) return false

    if (activePair.offset.col === 0 && activePair.verticalFlipArmed) {
        const flippedOffset = {row:-activePair.offset.row,col:0}
        // Keep the same two occupied cells while reversing which color is on top.
        const flipKicks = [{row:activePair.offset.row,col:0}]
        if (tryPairOffset(flippedOffset, flipKicks)) return true
    }

    const offset = direction === 1
        ? {row:activePair.offset.col,col:-activePair.offset.row}
        : {row:-activePair.offset.col,col:activePair.offset.row}
    const rotationKicks = [
        {row:0,col:0},
        {row:0,col:-offset.col},
        {row:0,col:offset.col},
        {row:-1,col:0},
        {row:1,col:0},
        {row:-1,col:-offset.col},
        {row:1,col:-offset.col}
    ]

    if (tryPairOffset(offset, rotationKicks)) return true

    if (activePair.offset.col === 0) {
        activePair.verticalFlipArmed = true
    }
    return false
}

export function applyPlayerAction(action) {
    if (!action || typeof action.type !== 'string') return false
    if (action.type === 'softDrop') {
        key.s = Boolean(action.pressed)
        return true
    }
    if (!activePair || activePair.dropped || gameOver || isResolving) return false

    if (action.type === 'move') {
        if (action.direction !== -1 && action.direction !== 1) return false
        return moveHorizontal(action.direction)
    }
    if (action.type === 'rotate') {
        if (action.direction !== -1 && action.direction !== 1) return false
        return rotatePair(action.direction)
    }
    if (action.type === 'toggleTrigger') {
        activePair.trigger = !activePair.trigger
        playSwitchSound()
        return true
    }
    return false
}

document.addEventListener('click',function() {
    if (!activePair && !isResolving && !gameOver) spawnPair()
})
document.addEventListener('keydown',function(e) {
    const pressedKey = e.key.startsWith('Arrow') ? e.key : e.key.toLowerCase()
    if (!(pressedKey in key)) return
    if (pressedKey.startsWith('Arrow')) e.preventDefault()
    if (isResolving) return

    if (key[pressedKey]) return
    key[pressedKey] = true

    if (pressedKey === 'a' || pressedKey === 'd') {
        horizontalKey = pressedKey
        applyPlayerAction({type:'move',direction:pressedKey === 'a' ? -1 : 1})
        nextHorizontalMove = performance.now() + horizontalDelay
    } else if (pressedKey === 's') {
        applyPlayerAction({type:'softDrop',pressed:true})
    } else if (pressedKey === 'ArrowUp') {
        applyPlayerAction({type:'toggleTrigger'})
    } else if (pressedKey === 'ArrowLeft') {
        applyPlayerAction({type:'rotate',direction:1})
    }
})

document.addEventListener('keyup',function(e) {
    const releasedKey = e.key.startsWith('Arrow') ? e.key : e.key.toLowerCase()
    if (!(releasedKey in key)) return
    key[releasedKey] = false

    if (releasedKey === 's') {
        applyPlayerAction({type:'softDrop',pressed:false})
    }

    if (releasedKey === horizontalKey) {
        const otherKey = releasedKey === 'a' ? 'd' : 'a'
        horizontalKey = key[otherKey] ? otherKey : null
        if (horizontalKey) nextHorizontalMove = performance.now() + horizontalDelay
    }
})

function updateHorizontalMovement(timestamp) {
    if (!horizontalKey || !key[horizontalKey] || !activePair || activePair.dropped || gameOver || isResolving) return

    if (timestamp >= nextHorizontalMove) {
        applyPlayerAction({type:'move',direction:horizontalKey === 'a' ? -1 : 1})
        nextHorizontalMove = timestamp + horizontalRepeat
    }
}

function findExplosionLayers(triggerRow, triggerCol, triggerColor) {
    const visited = new Set()
    const layers = []
    const startingCells = [
        [triggerRow - 1, triggerCol],
        [triggerRow + 1, triggerCol],
        [triggerRow, triggerCol - 1],
        [triggerRow, triggerCol + 1]
    ]

    let frontier = []
    for (const [row, col] of startingCells) {
        if (row >= 0 && row < blocks.length && col >= 0 && col < blocks[row].length && isBlockOfColor(blocks[row][col], triggerColor)) {
            const cellKey = `${row},${col}`
            if (!visited.has(cellKey)) {
                visited.add(cellKey)
                frontier.push([row, col])
            }
        }
    }

    while (frontier.length > 0) {
        layers.push(frontier)
        const nextFrontier = []

        for (const [row, col] of frontier) {
            for (const [nextRow, nextCol] of [
                [row - 1, col],
                [row + 1, col],
                [row, col - 1],
                [row, col + 1]
            ]) {
                if (nextRow >= 0 && nextRow < blocks.length && nextCol >= 0 && nextCol < blocks[nextRow].length) {
                    const nextKey = `${nextRow},${nextCol}`
                    if (!visited.has(nextKey) && isBlockOfColor(blocks[nextRow][nextCol], triggerColor)) {
                        visited.add(nextKey)
                        nextFrontier.push([nextRow, nextCol])
                    }
                }
            }
        }

        frontier = nextFrontier
    }

    return layers
}

function findTriggeredWaves() {
    const waveByCell = new Map()

    function addCell(row, col, waveIndex) {
        const cellKey = `${row},${col}`
        const existingWave = waveByCell.get(cellKey)
        if (existingWave === undefined || waveIndex < existingWave) {
            waveByCell.set(cellKey, waveIndex)
        }
    }

    for (let row = 0; row < blocks.length; row++) {
        for (let col = 0; col < blocks[row].length; col++) {
            const cellCode = blocks[row][col]
            if (!isTriggerBlockCode(cellCode)) continue

            const triggerColor = cellCode - colorCount
            const layers = findExplosionLayers(row, col, triggerColor)
            if (layers.length === 0) continue

            addCell(row, col, 0)
            for (let waveIndex = 0; waveIndex < layers.length; waveIndex++) {
                for (const [groupRow, groupCol] of layers[waveIndex]) {
                    addCell(groupRow, groupCol, waveIndex)
                }
            }
        }
    }

    for (const [key, waveIndex] of [...waveByCell]) {
        const [row, col] = key.split(',').map(Number)
        const isExplodingColorBlock =
            blocks[row][col] >= 1 && blocks[row][col] <= colorCount * 2
        if (!isExplodingColorBlock) continue

        for (const [rowOffset, colOffset] of neighborOffsets) {
            const garbageRow = row + rowOffset
            const garbageCol = col + colOffset
            if (
                garbageRow >= 0 && garbageRow < blocks.length &&
                garbageCol >= 0 && garbageCol < blocks[garbageRow].length &&
                blocks[garbageRow][garbageCol] === garbageBlockCode
            ) {
                addCell(garbageRow, garbageCol, waveIndex)
            }
        }
    }

    if (waveByCell.size === 0) return []

    const maxWave = Math.max(...waveByCell.values())
    const waves = Array.from({length:maxWave + 1},()=>[])
    for (const [cellKey, waveIndex] of waveByCell) {
        const [row, col] = cellKey.split(',').map(Number)
        waves[waveIndex].push([row, col])
    }
    return waves
}

const neighborOffsets = [[-1,0],[1,0],[0,-1],[0,1]]

function cellKey(row, col) {
    return `${row},${col}`
}

function getRecentPlacementKeys(recentCells, color) {
    return new Set(recentCells
        .filter(cell => (cell.type > colorCount ? cell.type - colorCount : cell.type) === color)
        .map(cell => cellKey(cell.row, cell.col)))
}

function isPlusClosedByRecentPair(color, center, recentKeys) {
    if (recentKeys.size === 0) return false

    for (const rowOffset of [-1, 1]) {
        for (const colOffset of [-1, 1]) {
            const square = [
                center,
                {row:center.row + rowOffset,col:center.col},
                {row:center.row,col:center.col + colOffset},
                {row:center.row + rowOffset,col:center.col + colOffset}
            ]
            const isFilledWithColor = square.every(cell =>
                cell.row >= 0 && cell.row < blocks.length &&
                cell.col >= 0 && cell.col < blocks[cell.row].length &&
                isBlockOfColor(blocks[cell.row][cell.col], color)
            )
            if (isFilledWithColor && square.some(cell => recentKeys.has(cellKey(cell.row, cell.col)))) {
                return true
            }
        }
    }

    return false
}

function getNormalColorComponents(color, activatedOnly=false) {
    const visited = new Set()
    const activated = []

    for (let row = 0; row < blocks.length; row++) {
        for (let col = 0; col < blocks[row].length; col++) {
            if (blocks[row][col] !== color) continue
            const startKey = cellKey(row, col)
            if (visited.has(startKey)) continue

            const cells = []
            const queue = [[row, col]]
            visited.add(startKey)
            for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
                const [currentRow, currentCol] = queue[queueIndex]
                cells.push({row:currentRow,col:currentCol})
                for (const [rowOffset, colOffset] of neighborOffsets) {
                    const nextRow = currentRow + rowOffset
                    const nextCol = currentCol + colOffset
                    if (nextRow < 0 || nextRow >= blocks.length || nextCol < 0 || nextCol >= blocks[nextRow].length) continue
                    if (blocks[nextRow][nextCol] !== color) continue
                    const nextKey = cellKey(nextRow, nextCol)
                    if (visited.has(nextKey)) continue
                    visited.add(nextKey)
                    queue.push([nextRow, nextCol])
                }
            }

            const cellKeys = new Set(cells.map(cell => cellKey(cell.row, cell.col)))
            const contacts = []
            for (const cell of cells) {
                for (const [rowOffset, colOffset] of neighborOffsets) {
                    const triggerRow = cell.row + rowOffset
                    const triggerCol = cell.col + colOffset
                    if (triggerRow < 0 || triggerRow >= blocks.length || triggerCol < 0 || triggerCol >= blocks[triggerRow].length) continue
                    if (blocks[triggerRow][triggerCol] === color + colorCount) {
                        contacts.push({
                            row:cell.row,
                            col:cell.col,
                            triggerRow,
                            triggerCol
                        })
                    }
                }
            }

            if (!activatedOnly || contacts.length > 0) activated.push({color,cells,cellKeys,contacts})
        }
    }

    return activated
}

function areForkArmsIndependent(color, center, arms, includeTriggers=false) {
    const centerKey = cellKey(center.row, center.col)
    const reachedByEarlierArms = new Set()
    const matchesColor = (row, col) => {
        if (row < 0 || row >= blocks.length || col < 0 || col >= blocks[row].length) return false
        return includeTriggers
            ? isBlockOfColor(blocks[row][col], color)
            : blocks[row][col] === color
    }

    for (const arm of arms) {
        const armKey = cellKey(arm.row, arm.col)
        if (reachedByEarlierArms.has(armKey)) return false
        const queue = [[arm.row, arm.col]]
        const reachedByThisArm = new Set([armKey])

        for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
            const [row, col] = queue[queueIndex]
            for (const [rowOffset, colOffset] of neighborOffsets) {
                const nextRow = row + rowOffset
                const nextCol = col + colOffset
                const nextKey = cellKey(nextRow, nextCol)
                if (nextKey === centerKey || !matchesColor(nextRow, nextCol)) continue
                if (reachedByEarlierArms.has(nextKey)) return false
                if (reachedByThisArm.has(nextKey)) continue
                reachedByThisArm.add(nextKey)
                queue.push([nextRow, nextCol])
            }
        }

        for (const key of reachedByThisArm) reachedByEarlierArms.add(key)
    }

    return true
}

function getWaveScoreForComponent(component) {
    const contacts = [...component.contacts].sort((a, b) =>
        a.triggerRow - b.triggerRow ||
        a.triggerCol - b.triggerCol ||
        a.row - b.row ||
        a.col - b.col
    )
    const roots = []
    const rootKeys = new Set()
    for (const contact of contacts) {
        const key = cellKey(contact.row, contact.col)
        if (rootKeys.has(key)) continue
        rootKeys.add(key)
        roots.push(key)
    }

    // Distinct trigger contacts start separate waves; a block is claimed by the first wave that reaches it.
    const claimed = new Set(rootKeys)
    let baseValue = 0

    for (const rootKey of roots) {
        const tailValues = []

        function propagate(currentKey, valueBeforeCurrent) {
            const [row, col] = currentKey.split(',').map(Number)
            const valueAtCurrent = valueBeforeCurrent + 1
            const nextKeys = []
            for (const [rowOffset, colOffset] of neighborOffsets) {
                const nextKey = cellKey(row + rowOffset, col + colOffset)
                if (component.cellKeys.has(nextKey) && !claimed.has(nextKey)) nextKeys.push(nextKey)
            }

            if (nextKeys.length === 0) {
                tailValues.push(valueAtCurrent)
                return
            }

            for (const nextKey of nextKeys) claimed.add(nextKey)
            for (const nextKey of nextKeys) propagate(nextKey, valueAtCurrent)
        }

        propagate(rootKey, 0)
        for (const tailValue of tailValues) {
            // A one-block tail is removed but has no base value.
            if (tailValue > 1) baseValue += tailValue
        }
    }

    return {baseValue}
}

function getLineOfThree(component) {
    if (component.cells.length !== 3) return null
    const sameRow = component.cells.every(cell => cell.row === component.cells[0].row)
    const sameCol = component.cells.every(cell => cell.col === component.cells[0].col)
    if (!sameRow && !sameCol) return null

    const sorted = [...component.cells].sort((a, b) => sameRow ? a.col - b.col : a.row - b.row)
    const first = sorted[0]
    const last = sorted[2]
    if ((sameRow ? last.col - first.col : last.row - first.row) !== 2) return null
    return {cells:sorted,horizontal:sameRow,middle:sorted[1]}
}

function hasOppositeEndTriggers(component, line) {
    const first = line.cells[0]
    const last = line.cells[2]
    const outwardOffset = line.horizontal ? {row:0,col:-1} : {row:-1,col:0}
    const otherOutwardOffset = line.horizontal ? {row:0,col:1} : {row:1,col:0}
    const firstTriggerKey = cellKey(first.row + outwardOffset.row, first.col + outwardOffset.col)
    const lastTriggerKey = cellKey(last.row + otherOutwardOffset.row, last.col + otherOutwardOffset.col)
    return component.contacts.some(contact =>
        cellKey(contact.triggerRow, contact.triggerCol) === firstTriggerKey &&
        contact.row === first.row && contact.col === first.col
    ) && component.contacts.some(contact =>
        cellKey(contact.triggerRow, contact.triggerCol) === lastTriggerKey &&
        contact.row === last.row && contact.col === last.col
    )
}

function hasPerpendicularMiddleTrigger(component, line) {
    const middle = line.middle
    return component.contacts.some(contact => {
        if (contact.row !== middle.row || contact.col !== middle.col) return false
        return line.horizontal
            ? contact.triggerCol === middle.col && Math.abs(contact.triggerRow - middle.row) === 1
            : contact.triggerRow === middle.row && Math.abs(contact.triggerCol - middle.col) === 1
    })
}

function getTShapeCenters(component) {
    const patterns = []
    for (const cell of component.cells) {
        const arms = neighborOffsets.filter(([rowOffset, colOffset]) =>
            component.cellKeys.has(cellKey(cell.row + rowOffset, cell.col + colOffset))
        )
        const armCells = arms.map(([rowOffset, colOffset]) => ({row:cell.row + rowOffset,col:cell.col + colOffset}))
        if (arms.length === 3 && areForkArmsIndependent(component.color, cell, armCells)) {
            const missingOffset = neighborOffsets.find(([rowOffset, colOffset]) =>
                !component.cellKeys.has(cellKey(cell.row + rowOffset, cell.col + colOffset))
            )
            patterns.push({
                center:cell,
                arms:armCells,
                missingOffset
            })
        }
    }
    return patterns
}

function triggerFillsTShape(component, tShape) {
    return component.contacts.some(contact =>
        contact.row === tShape.center.row &&
        contact.col === tShape.center.col &&
        contact.triggerRow === tShape.center.row + tShape.missingOffset[0] &&
        contact.triggerCol === tShape.center.col + tShape.missingOffset[1]
    )
}

function getPlusShapePatterns(component, recentKeys=new Set()) {
    const patterns = []
    for (const center of component.cells) {
        const arms = neighborOffsets.map(([rowOffset, colOffset]) => ({
            row:center.row + rowOffset,
            col:center.col + colOffset
        }))
        if (
            arms.every(arm => component.cellKeys.has(cellKey(arm.row, arm.col))) &&
            !isPlusClosedByRecentPair(component.color, center, recentKeys)
        ) {
            patterns.push({center,arms})
        }
    }
    return patterns
}

function hasPlusShape(component, recentKeys) {
    return getPlusShapePatterns(component, recentKeys).length > 0
}

function getRequestedShapeScore(component, recentKeys) {
    const line = getLineOfThree(component)
    if (line) {
        if (hasOppositeEndTriggers(component, line)) return {fixedScore:2}
        if (hasPerpendicularMiddleTrigger(component, line)) return {fixedScore:4}
    }

    if (hasPlusShape(component, recentKeys)) return {minimumScore:10}

    const tShapes = getTShapeCenters(component)
    const triggerCompletedT = tShapes.find(tShape => triggerFillsTShape(component, tShape))
    if (
        triggerCompletedT &&
        !isPlusClosedByRecentPair(component.color, triggerCompletedT.center, recentKeys)
    ) {
        return {minimumScore:8}
    }
    if (tShapes.length > 0) {
        return {minimumScore:6}
    }

    return null
}

function findShapeFlashPatterns(recentCells) {
    const recentCellsByColor = new Map()
    for (const cell of recentCells) {
        const color = cell.type > colorCount ? cell.type - colorCount : cell.type
        if (color < 1 || color > colorCount) continue
        if (!recentCellsByColor.has(color)) recentCellsByColor.set(color, new Set())
        recentCellsByColor.get(color).add(cellKey(cell.row, cell.col))
    }

    const patterns = new Map()
    function addPattern(color, center, arms) {
        const armKeys = arms.map(arm => cellKey(arm.row, arm.col)).sort()
        const patternKey = `${color}:${cellKey(center.row, center.col)}:${armKeys.join('|')}`
        if (!patterns.has(patternKey)) patterns.set(patternKey, {center,arms})
    }

    for (const [color, recentKeys] of recentCellsByColor) {
        for (let row = 0; row < blocks.length; row++) {
            for (let col = 0; col < blocks[row].length; col++) {
                if (!isBlockOfColor(blocks[row][col], color)) continue

                const arms = neighborOffsets
                    .map(([rowOffset, colOffset]) => ({row:row + rowOffset,col:col + colOffset}))
                    .filter(arm =>
                        arm.row >= 0 && arm.row < blocks.length &&
                        arm.col >= 0 && arm.col < blocks[arm.row].length &&
                        isBlockOfColor(blocks[arm.row][arm.col], color)
                    )
                if (arms.length !== 3 && arms.length !== 4) continue
                if (arms.length === 3 && !areForkArmsIndependent(color, {row,col}, arms, true)) continue
                if (isPlusClosedByRecentPair(color, {row,col}, recentKeys)) continue

                const patternKeys = [cellKey(row, col), ...arms.map(arm => cellKey(arm.row, arm.col))]
                if (patternKeys.some(key => recentKeys.has(key))) {
                    addPattern(color, {row,col}, arms)
                }
            }
        }
    }

    return [...patterns.values()]
}

function startShapeFlashes(recentCells, timestamp) {
    for (const pattern of findShapeFlashPatterns(recentCells)) {
        shapeFlashAnimations.push({...pattern,startTime:timestamp})
    }
}

function drawShapeFlashes(timestamp, cellW, cellH) {
    const ctx = essen.canvas.getContext('2d')
    const cycleDuration = shapeFlashCount * shapeFlashCycleDuration
    const cellSize = Math.min(cellW, cellH)
    shapeFlashAnimations = shapeFlashAnimations.filter(animation => {
        const elapsed = timestamp - animation.startTime
        if (elapsed < 0 || elapsed >= cycleDuration) return elapsed < cycleDuration

        const cyclePhase = elapsed % shapeFlashCycleDuration
        if (cyclePhase >= shapeFlashOnDuration) return true
        const opacity = Math.sin(cyclePhase / shapeFlashOnDuration * Math.PI) * 0.62
        if (opacity <= 0) return true

        const centerX = essen.boardX + animation.center.col * cellW + cellW / 2
        const centerY = essen.boardY + (animation.center.row - hiddenTopRows) * cellH + cellH / 2
        ctx.save()
        ctx.globalAlpha = opacity
        ctx.strokeStyle = 'white'
        ctx.lineWidth = Math.max(1.5, cellSize * 0.11)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
        ctx.shadowBlur = cellSize * 0.18
        ctx.beginPath()
        for (const arm of animation.arms) {
            const armX = essen.boardX + arm.col * cellW + cellW / 2
            const armY = essen.boardY + (arm.row - hiddenTopRows) * cellH + cellH / 2
            ctx.moveTo(centerX, centerY)
            ctx.lineTo(armX, armY)
        }
        ctx.stroke()
        ctx.restore()
        return true
    })
}

function awardExplosionScore(recentCells=[]) {
    for (let color = 1; color <= colorCount; color++) {
        let baseValue = 0
        let fixedScore = 0
        let minimumScoreAdjustment = 0
        const recentKeys = getRecentPlacementKeys(recentCells, color)

        for (const component of getNormalColorComponents(color, true)) {
            const requestedScore = getRequestedShapeScore(component, recentKeys)
            if (requestedScore && requestedScore.fixedScore !== undefined) {
                fixedScore += requestedScore.fixedScore
                continue
            }

            const waveScore = getWaveScoreForComponent(component)
            const componentValue = waveScore.baseValue
            baseValue += waveScore.baseValue
            if (requestedScore && requestedScore.minimumScore > componentValue) {
                minimumScoreAdjustment += requestedScore.minimumScore - componentValue
            }
        }

        score += fixedScore + baseValue + minimumScoreAdjustment
    }
}

function settleGravity() {
    // Compute each column's final stack in one pass; animation covers the full distance.
    const nextBlocks = Array.from({length:blocks.length},()=>Array(blocks[0].length).fill(0))
    const nextTriggerExpiresAtTurn = Array.from({length:blocks.length},()=>Array(blocks[0].length).fill(null))
    const motions = []

    for (let col = 0; col < blocks[0].length; col++) {
        let landingBottom = blocks.length - 1
        let row = blocks.length - 1
        while (row >= 0) {
            if (blocks[row][col] === 0) {
                row--
                continue
            }

            const runBottom = row
            while (row >= 0 && blocks[row][col] !== 0) {
                row--
            }
            const runTop = row + 1
            const fallDistance = landingBottom - runBottom

            for (let fromRow = runTop; fromRow <= runBottom; fromRow++) {
                const toRow = fromRow + fallDistance
                const code = blocks[fromRow][col]
                nextBlocks[toRow][col] = code
                nextTriggerExpiresAtTurn[toRow][col] = triggerExpiresAtTurn[fromRow][col]
                if (fallDistance > 0) {
                    motions.push({fromRow, toRow, col, code})
                }
            }

            landingBottom = runTop + fallDistance - 1
        }
    }

    blocks = nextBlocks
    triggerExpiresAtTurn = nextTriggerExpiresAtTurn
    return motions
}

function startGravityAnimation(motions, onComplete) {
    if (motions.length === 0) {
        onComplete()
        return
    }

    const startTime = performance.now()
    fallAnimations = motions.map(motion => ({
        ...motion,
        startTime,
        duration:Math.max(
            gravityAnimationMinDuration,
            (motion.toRow - motion.fromRow) / gravityFallCellsPerSecond * 1000
        )
    }))
    gravityAnimationComplete = onComplete
    isResolving = true
}

function startLandingBounce(row, col, code, timestamp=performance.now()) {
    if (row < hiddenTopRows) return
    landingAnimations.set(`${row},${col}`, {code,startTime:timestamp})
}

function getLandingBounceScale(row, col, timestamp) {
    const key = `${row},${col}`
    const animation = landingAnimations.get(key)
    if (!animation) return {scaleX:1,scaleY:1}
    if (blocks[row][col] !== animation.code) {
        landingAnimations.delete(key)
        return {scaleX:1,scaleY:1}
    }

    const progress = (timestamp - animation.startTime) / landingBounceDuration
    if (progress >= 1) {
        landingAnimations.delete(key)
        return {scaleX:1,scaleY:1}
    }

    const oscillation = Math.sin(progress * Math.PI * 4) * (1 - progress) * landingBounceStrength
    const pulse = oscillation > 0 ? oscillation : oscillation * 0.55
    return {
        scaleX:1 + pulse * 0.55,
        scaleY:1 - pulse
    }
}

function updateGravityAnimations(timestamp) {
    if (fallAnimations.length === 0) return

    const completedAnimations = fallAnimations.filter(
        animation => timestamp >= animation.startTime + animation.duration
    )
    fallAnimations = fallAnimations.filter(animation => timestamp < animation.startTime + animation.duration)
    if (completedAnimations.length > 0) playPlaceBlockSound()
    for (const animation of completedAnimations) {
        if (animation.toRow >= hiddenTopRows) {
            startLandingBounce(animation.toRow, animation.col, animation.code, timestamp)
        }
    }
    if (fallAnimations.length === 0 && gravityAnimationComplete) {
        const onComplete = gravityAnimationComplete
        gravityAnimationComplete = null
        onComplete()
    }
}

function resolveExplosions(onComplete) {
    function resolveNextExplosion() {
        // Let every unsupported column finish falling before collecting explosion waves.
        const motions = settleGravity()
        if (motions.length > 0) {
            for (const pendingCell of pendingShapeCells) {
                const motion = motions.find(animation =>
                    animation.fromRow === pendingCell.row &&
                    animation.col === pendingCell.col &&
                    animation.code === pendingCell.type
                )
                if (motion) pendingCell.row = motion.toRow
            }
            startGravityAnimation(motions, resolveNextExplosion)
            return
        }

        const recentPlacementCells = pendingShapeCells.map(cell => ({...cell}))
        startShapeFlashes(recentPlacementCells, performance.now())
        pendingShapeCells = []
        const waves = findTriggeredWaves()
        if (waves.length === 0) {
            isResolving = false
            if (onComplete) onComplete()
            return
        }

        const previousScore = score
        awardExplosionScore(recentPlacementCells)
        const particleCountsByCell = getExplosionParticleCounts(waves, score > previousScore)
        const blastSoundKeys = getExplosionSoundKeys(waves)
        isResolving = true
        let layerIndex = 0

        function removeNextWave() {
            startExplosionShake(waves[layerIndex].length)

            for (const [row, col] of waves[layerIndex]) {
                if (blastSoundKeys.has(cellKey(row, col))) playBlockBlastSound()
                const particleCount = particleCountsByCell.get(cellKey(row, col)) || 0
                for (let index = 0; index < particleCount; index += 1) {
                    spawnScoreParticle(row, col, blocks[row][col])
                }
                blocks[row][col] = 0
                triggerExpiresAtTurn[row][col] = null
            }
            layerIndex++

            if (layerIndex < waves.length) {
                setTimeout(removeNextWave, explosionWaveDelay)
            } else {
                const motions = settleGravity()
                startGravityAnimation(motions, resolveNextExplosion)
            }
        }

        setTimeout(removeNextWave, explosionWaveDelay)
    }

    resolveNextExplosion()
}

function placeBlocks(cells, stationaryLandingCells=[]) {
    // Write every cell first so a future pair is resolved as one placement.
    advancePlacementTurn()
    for (const {row, col, type} of cells) {
        blocks[row][col] = type
        triggerExpiresAtTurn[row][col] = isTriggerBlockCode(type)
            ? placementTurn + triggerGarbageTurnLimit
            : null
    }
    pendingShapeCells = cells.map(cell => ({...cell}))
    if (stationaryLandingCells.length > 0) playPlaceBlockSound()
    for (const {row, col, type} of stationaryLandingCells) {
        startLandingBounce(row, col, type)
    }
    resolveExplosions(() => {
        if (activePair && activePair.dropped) activePair = null
        if (pendingIncomingGarbage > 0 && !gameOver) {
            dropPendingGarbage()
        } else if (!gameOver) {
            nextSpawnAt = performance.now() + spawnDelay
        }
    })
}

function dropPendingGarbage() {
    if (
        pendingIncomingGarbage <= 0 || gameOver || isResolving ||
        (activePair && !activePair.dropped)
    ) return 0

    const requestedCount = pendingIncomingGarbage
    pendingIncomingGarbage = 0
    nextSpawnAt = null
    const columnHeights = Array(blocks[0].length).fill(0)
    for (let row = 0; row < blocks.length; row++) {
        for (let col = 0; col < blocks[row].length; col++) {
            if (blocks[row][col] !== 0) columnHeights[col] += 1
        }
    }

    const motions = []
    for (let index = 0; index < requestedCount; index++) {
        let selectedColumn = -1
        let shortestHeight = blocks.length
        for (let offset = 0; offset < blocks[0].length; offset++) {
            const col = (garbageColumnCursor + offset) % blocks[0].length
            if (columnHeights[col] < shortestHeight) {
                selectedColumn = col
                shortestHeight = columnHeights[col]
            }
        }

        if (selectedColumn < 0) {
            gameOver = true
            break
        }

        const row = blocks.length - 1 - columnHeights[selectedColumn]
        blocks[row][selectedColumn] = garbageBlockCode
        triggerExpiresAtTurn[row][selectedColumn] = null
        motions.push({fromRow:Math.min(hiddenTopRows - 1, row - 1),toRow:row,col:selectedColumn,code:garbageBlockCode})
        columnHeights[selectedColumn] += 1
        garbageColumnCursor = (selectedColumn + 1) % blocks[0].length
    }

    function finishGarbageDrop() {
        isResolving = false
        if (pendingIncomingGarbage > 0 && !gameOver) {
            dropPendingGarbage()
        } else if (!gameOver && !activePair) {
            nextSpawnAt = performance.now() + spawnDelay
        }
    }

    startGravityAnimation(motions, finishGarbageDrop)
    return motions.length
}

export function receiveOpponentScore(opponentScore) {
    if (typeof opponentScore !== 'number' || !Number.isFinite(opponentScore) || opponentScore <= 0 || gameOver) {
        return 0
    }

    const garbageCount = Math.floor(opponentScore)
    if (garbageCount <= 0) return 0

    pendingIncomingGarbage += garbageCount
    if (!isResolving && (!activePair || activePair.dropped)) {
        if (activePair && activePair.dropped) activePair = null
        dropPendingGarbage()
    }
    return garbageCount
}

function findLandingRow(nextY) {
    if (canPlacePairAt(nextY, activePair.col, activePair.offset)) return null

    let low = activePair.y
    let high = nextY
    for (let i = 0; i < 20; i++) {
        const middle = (low + high) / 2
        if (canPlacePairAt(middle, activePair.col, activePair.offset)) {
            low = middle
        } else {
            high = middle
        }
    }

    let landingRow = Math.round(low / (essen.khungh / essen.ratioh))
    let rowSearches = 0
    while (rowSearches < blocks.length + hiddenTopRows + 2 && !canPlacePairAt(
        landingRow * (essen.khungh / essen.ratioh),
        activePair.col,
        activePair.offset
    )) {
        landingRow--
        rowSearches++
    }
    return landingRow
}

function getProjectedPairSegments(landingRow) {
    const segments = pairSegments(activePair)
    const projectedBoard = blocks.map(row => [...row])
    const previewMarkers = segments.map((segment, index) => ({
        previewIndex:index,
        row:hiddenTopRows + landingRow + segment.row,
        col:activePair.col + segment.col,
        color:segment.color
    }))
    const projectedPositions = Array(segments.length)

    for (const marker of previewMarkers) {
        if (
            marker.row < 0 || marker.row >= projectedBoard.length ||
            marker.col < 0 || marker.col >= projectedBoard[marker.row].length
        ) continue
        projectedBoard[marker.row][marker.col] = marker
    }

    // Match settleGravity(): each column compacts independently after the pair locks.
    for (let col = 0; col < projectedBoard[0].length; col++) {
        let targetRow = projectedBoard.length - 1
        for (let row = projectedBoard.length - 1; row >= 0; row--) {
            const cell = projectedBoard[row][col]
            if (cell === 0) continue

            if (typeof cell === 'object' && cell.previewIndex !== undefined) {
                projectedPositions[cell.previewIndex] = {
                    row:targetRow,
                    col,
                    color:cell.color
                }
            }
            targetRow--
        }
    }

    return projectedPositions
}

function loop(timestamp) {
    requestAnimationFrame(loop)
    const elapsed = timestamp - lastTime
    if (elapsed < 1000 / 60) {
        return
    }
    const deltaSeconds = Math.min(elapsed / 1000, 0.05)
    lastTime = timestamp
    const ctx = essen.canvas.getContext('2d')
    ctx.clearRect(0, 0, essen.cw, essen.ch)
    const shakeOffset = getExplosionShakeOffset(timestamp)
    ctx.save()
    ctx.translate(shakeOffset.x, shakeOffset.y)
    render(timestamp, deltaSeconds)
    ctx.restore()
}

function drawLossZoneMarker(cellW, cellH) {
    const centerCol = Math.floor(essen.ratiow / 2)
    drawLossZoneX(
        essen.boardX + centerCol * cellW,
        essen.boardY,
        cellW,
        cellH,
        0.4
    )
}

function render(timestamp, deltaSeconds) {
    updateGravityAnimations(timestamp)
    khung()
    const cellW = essen.khungw / essen.ratiow
    const cellH = essen.khungh / essen.ratioh
    drawLossZoneMarker(cellW, cellH)
    const centerCol = Math.floor(essen.ratiow / 2)
    const animatedDestinations = new Set(
        fallAnimations.map(animation => `${animation.toRow},${animation.col}`)
    )

    for (let row = 0; row < blocks.length; row++) {
        for (let col = 0; col < blocks[row].length; col++) {
            if (
                row >= hiddenTopRows && blocks[row][col] !== 0 &&
                !animatedDestinations.has(`${row},${col}`)
            ) {
                const bounce = getLandingBounceScale(row, col, timestamp)
                block(
                    (col - centerCol) * cellW,
                    (row - hiddenTopRows) * cellH,
                    blocks[row][col],
                    bounce.scaleX,
                    bounce.scaleY
                )
            }
        }
    }

    for (const animation of fallAnimations) {
        const progress = Math.min(1, (timestamp - animation.startTime) / animation.duration)
        const currentRow = animation.fromRow + (animation.toRow - animation.fromRow) * progress
        block(
            (animation.col - centerCol) * cellW,
            (currentRow - hiddenTopRows) * cellH,
            animation.code
        )
    }

    sidePanel(score, getUpcomingPairs())

    if (gameOver) {
        const ctx = essen.canvas.getContext('2d')
        ctx.fillStyle = 'white'
        ctx.font = '32px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Game Over', essen.cw / 2, essen.ch / 2)
        drawScoreParticles(timestamp)
        return
    }

    if (nextSpawnAt !== null && timestamp >= nextSpawnAt) {
        nextSpawnAt = null
        spawnPair()
    }

    updateHorizontalMovement(timestamp)

    if (activePair && !activePair.dropped) {
        const fallSpeed = key.s ? fastFallCellsPerSecond : normalFallCellsPerSecond
        const nextY = activePair.y + cellH * fallSpeed * deltaSeconds
        const landingRow = findLandingRow(nextY)

        if (landingRow === null) {
            activePair.y = nextY
        } else {
            const pairCells = pairSegments(activePair).map(segment => ({
                row:hiddenTopRows + landingRow + segment.row,
                col:activePair.col + segment.col,
                type:blockCode(segment.color, activePair.trigger)
            }))
            if (pairCells.some(cell => cell.row < 0 || cell.row >= blocks.length)) {
                gameOver = true
            } else {
                activePair.y = landingRow * cellH
                activePair.dropped = true
                pairMotion = null
                const projectedSegments = getProjectedPairSegments(landingRow)
                const stationaryLandingCells = projectedSegments.flatMap((segment, index) => {
                    const placedCell = pairCells[index]
                    if (segment.row !== placedCell.row || segment.col !== placedCell.col) return []
                    return [{row:segment.row,col:segment.col,type:placedCell.type}]
                })
                placeBlocks(pairCells, stationaryLandingCells)
            }
        }
    }

    if (activePair && !activePair.dropped && !gameOver) {
        const landingRow = findLandingRow((essen.ratioh + 1) * cellH)
        if (landingRow !== null && landingRow >= -hiddenTopRows) {
            for (const segment of getProjectedPairSegments(landingRow)) {
                if (!segment || segment.row < hiddenTopRows || segment.row >= blocks.length) continue
                block(
                    (segment.col - centerCol) * cellW,
                    (segment.row - hiddenTopRows) * cellH,
                    blockCode(segment.color, activePair.trigger),
                    1,
                    1,
                    0.22
                )
            }
        }

        for (const segment of getPairRenderSegments(timestamp)) {
            block(
                (segment.col - centerCol) * cellW,
                segment.y,
                blockCode(segment.color, activePair.trigger)
            )
        }
    } else if (gameOver) {
        const ctx = essen.canvas.getContext('2d')
        ctx.fillStyle = 'white'
        ctx.font = '32px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Game Over', essen.cw / 2, essen.ch / 2)
    }

    drawShapeFlashes(timestamp, cellW, cellH)
    drawScoreParticles(timestamp)

    for (let i in blocks) {
        console.log(blocks[i])
    }
}


export function start() {
    requestAnimationFrame(loop)
}
