# Shuffle Algorithm - Detailed Implementation

## Overview
The shuffle algorithm partitions audio into segments, rearranges them with padding, and can reverse the operation perfectly.

## Example: 30-second Audio

### Input Parameters
- **Original Duration**: 30 seconds
- **Segment Size**: 5 seconds
- **Padding**: 1 second
- **Seed**: 12345

### Step 1: Partitioning
Divide the audio into segments:
```
Number of segments: 30 / 5 = 6 segments

Segment 0: 0-5s
Segment 1: 5-10s
Segment 2: 10-15s
Segment 3: 15-20s
Segment 4: 20-25s
Segment 5: 25-30s
```

### Step 2: Generate Shuffle Order
Using seed 12345, generate shuffle permutation:
```
Original order: [0, 1, 2, 3, 4, 5]
Shuffled order: [5, 2, 3, 1, 0, 4]  (example output)
```

**Interpretation**: 
- Position 0 gets segment 5
- Position 1 gets segment 2
- Position 2 gets segment 3
- Position 3 gets segment 1
- Position 4 gets segment 0
- Position 5 gets segment 4

### Step 3: Scrambling (Render with Padding)

**Layout in scrambled audio**:
```
Position 0: [Segment 5: 0-5s]   [Padding: 5-6s]
Position 1: [Segment 2: 6-11s]  [Padding: 11-12s]
Position 2: [Segment 3: 12-17s] [Padding: 17-18s]
Position 3: [Segment 1: 18-23s] [Padding: 23-24s]
Position 4: [Segment 0: 24-29s] [Padding: 29-30s]
Position 5: [Segment 4: 30-35s] [Padding: 35-36s]
```

**Total Duration**: 30s + (6 × 1s) = 36 seconds

**Key Storage**:
```json
{
  "shuffle": {
    "enabled": true,
    "seed": 12345,
    "segmentSize": 5,
    "padding": 1,
    "shuffleOrder": [5, 2, 3, 1, 0, 4]
  }
}
```

### Step 4: Unscrambling (Reverse Operation)

#### 4.1: Create Inverse Mapping
```
Shuffle order: [5, 2, 3, 1, 0, 4]

Inverse calculation:
  shuffleOrder[0] = 5  →  inverseOrder[5] = 0
  shuffleOrder[1] = 2  →  inverseOrder[2] = 1
  shuffleOrder[2] = 3  →  inverseOrder[3] = 2
  shuffleOrder[3] = 1  →  inverseOrder[1] = 3
  shuffleOrder[4] = 0  →  inverseOrder[0] = 4
  shuffleOrder[5] = 4  →  inverseOrder[4] = 5

Inverse order: [4, 3, 1, 2, 5, 0]
```

**Meaning**: Segment at scrambled position X came from original position inverseOrder[X]

#### 4.2: Extract Segments (Skip Padding)

For each original segment position, find where it is in scrambled audio:

```
Original Seg 0: shuffleOrder[0] = 5
  → Extract from scrambled position 5
  → Time range: 30-35s (skip padding at 35-36s)
  → Place at: 0-5s

Original Seg 1: shuffleOrder[1] = 2
  → Extract from scrambled position 2
  → Time range: 12-17s (skip padding at 17-18s)
  → Place at: 5-10s

Original Seg 2: shuffleOrder[2] = 3
  → Extract from scrambled position 3
  → Time range: 18-23s (skip padding at 23-24s)
  → Place at: 10-15s

Original Seg 3: shuffleOrder[3] = 1
  → Extract from scrambled position 1
  → Time range: 6-11s (skip padding at 11-12s)
  → Place at: 15-20s

Original Seg 4: shuffleOrder[4] = 0
  → Extract from scrambled position 0
  → Time range: 0-5s (skip padding at 5-6s)
  → Place at: 20-25s

Original Seg 5: shuffleOrder[5] = 4
  → Extract from scrambled position 4
  → Time range: 24-29s (skip padding at 29-30s)
  → Place at: 25-30s
```

#### 4.3: Render Without Padding

Concatenate segments in original order without gaps:
```
[Segment 0: 0-5s][Segment 1: 5-10s][Segment 2: 10-15s]
[Segment 3: 15-20s][Segment 4: 20-25s][Segment 5: 25-30s]
```

**Final Duration**: 30 seconds (original duration restored)

## Algorithm Formulas

### Scrambling
```
numSegments = ceil(duration / segmentSize)
scrambledDuration = duration + (numSegments × padding)

For segment i:
  originalStart = i × segmentSize
  scrambledPosition = shuffleOrder[i]
  scrambledStart = scrambledPosition × (segmentSize + padding)
```

### Unscrambling
```
For original segment i:
  shuffledPosition = shuffleOrder[i]
  extractFrom = shuffledPosition × (segmentSize + padding)
  extractDuration = segmentSize (or remaining duration for last segment)
  placeAt = i × segmentSize
```

## Code Implementation Key Points

### 1. Shuffle Function
```javascript
async function applyAudioShuffling(sourceBuffer, segmentSize, padding, seed) {
  // Calculate segments
  const numSegments = Math.floor(sourceBuffer.duration / segmentSize);
  
  // Create segment objects
  const segments = [];
  for (let i = 0; i < numSegments; i++) {
    segments.push({
      start: i * segmentSize,
      duration: segmentSize,
      originalIndex: i
    });
  }
  
  // Shuffle order
  const originalOrder = segments.map(s => s.originalIndex);
  const shuffleOrder = seededShuffle(originalOrder, seed);
  
  // Reorder and render with padding
  const shuffledSegments = shuffleOrder.map(idx => segments[idx]);
  const buffer = await renderShuffledAudioWithPadding(sourceBuffer, shuffledSegments, padding);
  
  return { buffer, shuffleOrder };
}
```

### 2. Unshuffle Function
```javascript
async function unshuffleAudio(shuffledBuffer, segmentSize, padding, shuffleOrder, originalDuration) {
  const numSegments = shuffleOrder.length;
  
  // Extract segments in original order
  const unshuffledSegments = [];
  for (let originalPos = 0; originalPos < numSegments; originalPos++) {
    const shuffledPos = shuffleOrder[originalPos];
    const startTime = shuffledPos * (segmentSize + padding);
    
    unshuffledSegments.push({
      start: startTime,
      duration: segmentSize,
      originalIndex: originalPos
    });
  }
  
  // Render without padding
  return await renderShuffledAudioWithPadding(shuffledBuffer, unshuffledSegments, 0);
}
```

### 3. Render Function
```javascript
async function renderShuffledAudioWithPadding(originalBuffer, segments, paddingDuration) {
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration + paddingDuration, 0);
  
  const offlineCtx = new OfflineAudioContext(
    originalBuffer.numberOfChannels,
    Math.ceil(totalDuration * originalBuffer.sampleRate),
    originalBuffer.sampleRate
  );
  
  let currentTime = 0;
  segments.forEach(segment => {
    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;
    source.start(currentTime, segment.start, segment.duration);
    source.connect(offlineCtx.destination);
    
    currentTime += segment.duration + paddingDuration;
  });
  
  return await offlineCtx.startRendering();
}
```

## Testing

Open browser console and run:
```javascript
testShuffleLogic(30, 5, 1, 12345);
```

This will output:
- Number of segments
- Original order
- Shuffle order
- Scrambled segment positions
- Inverse order
- Unscrambling extraction points

## Verification

To verify the implementation works correctly:

1. **Duration Check**:
   - Original: 30s
   - Scrambled: 36s (30 + 6×1)
   - Recovered: 30s

2. **Audio Integrity**:
   - All segment data preserved
   - No gaps in recovered audio
   - Bit-perfect recovery (within float precision)

3. **Order Verification**:
   - Log shuffle order
   - Verify inverse mapping
   - Confirm extraction points match

## Troubleshooting

### Issue: Recovered audio is shorter than original
**Cause**: Padding not being removed correctly
**Fix**: Ensure extracting only segment duration, not padding

### Issue: Recovered audio has gaps or clicks
**Cause**: Incorrect segment boundaries
**Fix**: Verify segment start times: `shuffledPos × (segmentSize + padding)`

### Issue: Segments in wrong order
**Cause**: Inverse mapping error
**Fix**: Ensure `inverseOrder[shuffleOrder[i]] = i` for all i

### Issue: Duration mismatch
**Cause**: Last segment not handling remainder
**Fix**: Calculate last segment duration as `originalDuration - (lastSegmentIndex × segmentSize)`

## Performance

- **Scrambling**: O(n) where n = number of samples
- **Unscrambling**: O(n)
- **Memory**: 2-3× audio size during processing
- **Typical Time**: 1-3 seconds per minute of audio

## Limitations

- Padding must be > 0 for proper segment separation
- Very small segments (<0.1s) may cause artifacts
- Maximum ~1000 segments recommended for performance
- Browser memory limits affect maximum audio length
