"""Generate small WAV UI sounds without third-party audio libraries."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 44_100
OUT = Path(__file__).resolve().parent.parent / "public" / "sounds"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(7)


def write(name: str, samples: list[float]) -> None:
    peak = max(1e-6, max(abs(s) for s in samples))
    gain = min(1.0, 0.85 / peak)
    frames = bytearray()
    for sample in samples:
        value = int(max(-1.0, min(1.0, sample * gain)) * 32767)
        frames += struct.pack("<h", value)
    with wave.open(str(OUT / name), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(bytes(frames))


def tick() -> None:
    duration = 0.055
    total = int(RATE * duration)
    samples = []
    for i in range(total):
        t = i / RATE
        envelope = math.exp(-t * 85)
        tone = math.sin(2 * math.pi * 2200 * t) * 0.55
        click = (random.random() * 2 - 1) * math.exp(-t * 220) * 0.35
        samples.append((tone + click) * envelope)
    write("tick.wav", samples)


def reveal() -> None:
    duration = 0.5
    total = int(RATE * duration)
    samples = []
    for i in range(total):
        t = i / RATE
        freq = 620 + 520 * (t / duration)
        envelope = min(1.0, t * 40) * math.exp(-t * 3.4)
        tone = (
            math.sin(2 * math.pi * freq * t) * 0.55
            + math.sin(2 * math.pi * freq * 2 * t) * 0.15
        )
        samples.append(tone * envelope)
    write("reveal.wav", samples)


def jackpot() -> None:
    duration = 1.45
    total = int(RATE * duration)
    notes = [(0.0, 523.25), (0.16, 659.25), (0.32, 783.99), (0.5, 1046.5)]
    samples = []
    for i in range(total):
        t = i / RATE
        value = 0.0
        for start, freq in notes:
            if t < start:
                continue
            local = t - start
            envelope = min(1.0, local * 45) * math.exp(-local * 3.2)
            value += (
                math.sin(2 * math.pi * freq * local) * 0.4
                + math.sin(2 * math.pi * freq * 1.5 * local) * 0.12
                + math.sin(2 * math.pi * freq * 2 * local) * 0.06
            ) * envelope
        if t > 0.5:
            value += math.sin(2 * math.pi * 261.63 * t) * 0.08 * math.exp(-(t - 0.5) * 2)
        samples.append(value)
    write("jackpot.wav", samples)


def coin() -> None:
    duration = 0.24
    total = int(RATE * duration)
    samples = []
    for i in range(total):
        t = i / RATE
        first = math.exp(-t * 18) * math.sin(2 * math.pi * 1180 * t)
        second = 0.0
        if t > 0.07:
            second = math.exp(-(t - 0.07) * 22) * math.sin(2 * math.pi * 1580 * (t - 0.07))
        samples.append(first * 0.55 + second * 0.45)
    write("coin.wav", samples)


if __name__ == "__main__":
    tick()
    reveal()
    jackpot()
    coin()
    for path in sorted(OUT.glob("*.wav")):
        print(f"{path.name}: {path.stat().st_size} bytes")
