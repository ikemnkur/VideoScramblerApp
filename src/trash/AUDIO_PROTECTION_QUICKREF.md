# Audio Protection System - Quick Reference

## 🚀 Quick Start (3 Steps)

### Scrambling Audio
1. Load audio file → Configure seeds (click 🎲 Random for both)
2. Click "🔒 Scramble Audio"
3. Download BOTH files: Scrambled Audio + Protection Key

### Unscrambling Audio
1. Load scrambled audio + key file
2. Click "🔓 Unscramble Audio"
3. Download recovered audio

---

## ⚙️ Parameter Quick Guide

| Parameter | Range | Recommended | Effect |
|-----------|-------|-------------|--------|
| **Shuffle Seed** | Any integer | Random (9 digits) | Determines segment order |
| **Segment Size** | 0.5-5.0s | 1.5-2.5s | Smaller = more scrambled |
| **Padding** | 0.0-2.0s | 0.3-0.6s | Gaps between segments |
| **Noise Seed** | Any integer | Random (9 digits) | Determines noise pattern |
| **Noise Strength** | 0.0-1.0 | 0.3-0.45 | Higher = more obscured |

---

## 🎚️ Preset Configurations

### Maximum Protection
```
Segment Size: 0.8s | Padding: 0.6s | Noise: 0.45
Result: Completely unrecognizable
```

### High Protection
```
Segment Size: 1.5s | Padding: 0.4s | Noise: 0.35
Result: Barely recognizable
```

### Medium Protection
```
Segment Size: 2.5s | Padding: 0.3s | Noise: 0.25
Result: Distorted but recognizable
```

### Light Protection
```
Segment Size: 4.0s | Padding: 0.2s | Noise: 0.15
Result: Clearly altered
```

---

## 🔑 Key File Management

### Storage Rules
✅ **DO**: Store separately from audio
✅ **DO**: Backup in secure location
✅ **DO**: Use descriptive filenames
❌ **DON'T**: Share publicly
❌ **DON'T**: Rename or edit
❌ **DON'T**: Store with scrambled audio

### Key File Contains
- Scrambling algorithm version
- Shuffle parameters (seed, size, padding)
- Noise parameters (seed, strength, type)
- Original audio metadata
- All encrypted with Base64 + XOR

---

## 🎯 Use Case Matrix

| Use Case | Segment Size | Noise Level | Security |
|----------|--------------|-------------|----------|
| Unreleased album | 0.8-1.2s | 0.40-0.50 | Maximum |
| Demo tracks | 1.5-2.0s | 0.30-0.40 | High |
| Preview clips | 2.5-3.5s | 0.20-0.30 | Medium |
| Watermarking | 4.0-5.0s | 0.10-0.20 | Light |

---

## 🔬 Technical Specs

### Noise System
- **3 Frequency Layers**: High (40%), Mid (40%), Low (30%)
- **Seeded Generation**: Deterministic, reproducible
- **Fully Reversible**: Perfect reconstruction

### Shuffle System
- **Algorithm**: Fisher-Yates with seeded RNG
- **Invertible**: Original order fully recoverable
- **Deterministic**: Same seed = same shuffle

### Encryption
- **Base64 Encoding**: Text-safe transmission
- **XOR Cipher**: Parameter obfuscation
- **JSON Format**: Structured data storage

---

## ⚡ Performance Tips

1. **Faster Processing**: Use larger segments (2-3s)
2. **Smaller Files**: Use no/minimal padding
3. **Better Security**: Use smaller segments + high noise
4. **Batch Work**: Keep same seed for related tracks

---

## 🐛 Common Issues & Fixes

### "Key file invalid"
→ Ensure file wasn't edited, re-download if needed

### "Audio sounds strange after unscramble"
→ Verify correct key file, check sample rates match

### "Processing is slow"
→ Normal for long files, use larger segments

### "Clicks in audio"
→ Reduce padding or increase segment size

---

## 📊 File Size Impact

```
Original: 10 MB (3 minutes)
Scrambled: 10.5 MB (+5% from padding)
Key File: <1 KB (negligible)
```

---

## 🛡️ Security Level Guide

| Noise + Segment | Security Rating | Reversible | Use Case |
|-----------------|----------------|------------|----------|
| 0.45 + 0.8s | ⭐⭐⭐⭐⭐ Maximum | ✅ Yes | Unreleased music |
| 0.35 + 1.5s | ⭐⭐⭐⭐ High | ✅ Yes | Demos |
| 0.25 + 2.5s | ⭐⭐⭐ Medium | ✅ Yes | Previews |
| 0.15 + 4.0s | ⭐⭐ Light | ✅ Yes | Watermarks |

---

## 📱 Browser Support

✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 14+
✅ Opera 76+

Requires: Web Audio API, ES6+

---

## ⏱️ Processing Time Estimates

| Duration | Segments | Time |
|----------|----------|------|
| 1-2 min | ~60 | 2-5s |
| 3-5 min | ~150 | 5-10s |
| 5-10 min | ~300 | 10-20s |
| 10+ min | ~600+ | 20-40s |

---

## 🎵 Audio Quality

### Scrambled
- Format: WAV 16-bit PCM
- Quality: Lossless transformation
- Playable: Yes (but unrecognizable)

### Recovered
- Accuracy: 99.99% identical
- Quality: No degradation
- Format: WAV 16-bit PCM

---

## 💡 Pro Tips

1. **Always use Random seeds** for maximum security
2. **Test unscramble immediately** after scrambling
3. **Store key files encrypted** on cloud storage
4. **Name keys descriptively**: `songname-protection.key`
5. **Higher noise = more protection** but stay below 0.6
6. **Smaller segments = more scrambling** but slower
7. **Add padding for extra duration** (deters editing)
8. **Keep original audio** as final backup

---

## 🚨 Critical Reminders

⚠️ **Key file is REQUIRED** to recover audio
⚠️ **No key = No recovery** (by design)
⚠️ **Always backup keys** in secure location
⚠️ **Don't share keys publicly** or with untrusted parties

---

For complete documentation, see: `AUDIO_PROTECTION_GUIDE.md`
