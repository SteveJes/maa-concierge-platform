/**
 * vapi-debug-audio-latency
 *
 * Downloads the stereo recording from the latest Vapi call and estimates real
 * audible gaps by analysing PCM amplitude, not just Vapi performanceMetrics.
 *
 * No external npm packages required.
 * ffmpeg is optional and only used when the recording is not a WAV.
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// ── Env ───────────────────────────────────────────────────────────────────────

function loadEnv(): void {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(dir, "../..");
  const repoRoot = path.resolve(apiRoot, "../..");
  for (const f of [
    path.join(apiRoot, ".env.local"),
    path.join(apiRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ]) {
    dotenv.config({ path: f, override: false });
  }
}

loadEnv();

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSISTANT_ID = "ec272999-2782-4e57-9068-55a3bacd4915";

// Speech detection parameters
const FRAME_MS = 20;                // analysis frame size in ms
const SILENCE_THRESHOLD_DBFS = -45; // below this = silence
const MERGE_GAP_MS = 250;           // merge speech segments closer than this
const MIN_SEGMENT_MS = 150;         // discard segments shorter than this

// ── Vapi types ────────────────────────────────────────────────────────────────

interface VapiMetrics {
  modelLatencyAverage?: number;
  voiceLatencyAverage?: number;
  transcriberLatencyAverage?: number;
  endpointingLatencyAverage?: number;
  turnLatencyAverage?: number;
}

interface VapiCall {
  id: string;
  startedAt?: string;
  endedAt?: string;
  artifact?: {
    stereoRecordingUrl?: string;
    recordingUrl?: string;
    performanceMetrics?: VapiMetrics;
  };
  assistantOverrides?: {
    variableValues?: Record<string, string>;
  };
}

// ── Fetch latest call ─────────────────────────────────────────────────────────

async function fetchLatestCall(): Promise<VapiCall> {
  const apiKey = process.env.VAPI_PRIVATE_KEY ?? process.env.VAPI_API_KEY;
  if (!apiKey) throw new Error("VAPI_PRIVATE_KEY not set in environment");

  const res = await fetch(
    `https://api.vapi.ai/call?assistantId=${ASSISTANT_ID}&limit=25`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`Vapi API ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as VapiCall[] | { results?: VapiCall[] };
  const calls = Array.isArray(data) ? data : (data.results ?? []);
  if (calls.length === 0) throw new Error("No calls found for this assistant.");

  const sorted = [...calls].sort((a, b) => {
    const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return tb - ta;
  });

  // Prefer a call that has a recording
  const withRecording = sorted.find(
    (c) => c.artifact?.stereoRecordingUrl ?? c.artifact?.recordingUrl,
  );
  return withRecording ?? sorted[0]!;
}

// ── Download audio ────────────────────────────────────────────────────────────

async function downloadToTemp(url: string): Promise<string> {
  const ext = url.split("?")[0]!.split(".").pop()?.toLowerCase() ?? "wav";
  const tmpPath = path.join(os.tmpdir(), `vapi-recording-${Date.now()}.${ext}`);

  console.log(`  Downloading recording…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tmpPath, buf);
  console.log(`  Saved to ${tmpPath} (${(buf.length / 1024).toFixed(0)} KB)`);
  return tmpPath;
}

// ── WAV header parser ─────────────────────────────────────────────────────────

interface WavHeader {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

function parseWavHeader(buf: Buffer): WavHeader {
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("Not a RIFF file — is ffmpeg available? Try converting to WAV first.");
  if (buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not a WAVE file.");

  let offset = 12;
  let fmtOffset = -1;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") fmtOffset = offset + 8;
    if (chunkId === "data") {
      dataOffset = offset + 8;
      dataLength = chunkSize;
      break;
    }
    offset += 8 + Math.max(chunkSize, 0);
    if (offset > buf.length) break;
  }

  if (fmtOffset === -1) throw new Error("No fmt chunk found in WAV.");
  if (dataOffset === -1) throw new Error("No data chunk found in WAV.");

  const audioFormat = buf.readUInt16LE(fmtOffset);
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new Error(`Unsupported WAV audio format ${audioFormat}. Only PCM (1) supported.`);
  }

  return {
    numChannels: buf.readUInt16LE(fmtOffset + 2),
    sampleRate: buf.readUInt32LE(fmtOffset + 4),
    bitsPerSample: buf.readUInt16LE(fmtOffset + 14),
    dataOffset,
    dataLength,
  };
}

// ── Convert non-WAV to WAV via ffmpeg ─────────────────────────────────────────

function convertToWav(inputPath: string): string {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (result.error) {
    throw new Error(
      "Recording is not a WAV file and ffmpeg is not available.\n" +
      "Install ffmpeg (brew install ffmpeg / apt install ffmpeg) or ensure the Vapi\n" +
      "recording format is WAV. Alternatively, set stereoRecordingUrl to a WAV URL.",
    );
  }

  const outPath = inputPath.replace(/\.\w+$/, "-converted.wav");
  console.log("  Converting to WAV via ffmpeg…");
  execSync(`ffmpeg -y -i "${inputPath}" -acodec pcm_s16le "${outPath}"`, {
    stdio: "pipe",
  });
  return outPath;
}

// ── Extract PCM channel data ──────────────────────────────────────────────────

function extractChannels(buf: Buffer, hdr: WavHeader): Float32Array[] {
  const { numChannels, bitsPerSample, dataOffset, dataLength } = hdr;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataLength / bytesPerSample);
  const samplesPerChannel = Math.floor(totalSamples / numChannels);

  const channels: Float32Array[] = Array.from(
    { length: numChannels },
    () => new Float32Array(samplesPerChannel),
  );

  const maxVal = bitsPerSample === 16 ? 32768 : bitsPerSample === 24 ? 8388608 : 2147483648;

  for (let i = 0; i < samplesPerChannel; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const bytePos = dataOffset + (i * numChannels + ch) * bytesPerSample;
      if (bytePos + bytesPerSample > buf.length) break;

      let sample = 0;
      if (bitsPerSample === 16) {
        sample = buf.readInt16LE(bytePos) / maxVal;
      } else if (bitsPerSample === 24) {
        const lo = buf.readUInt16LE(bytePos);
        const hi = buf.readInt8(bytePos + 2);
        sample = ((hi << 16) | lo) / maxVal;
      } else if (bitsPerSample === 32) {
        sample = buf.readInt32LE(bytePos) / maxVal;
      } else if (bitsPerSample === 8) {
        sample = (buf.readUInt8(bytePos) - 128) / 128;
      }

      channels[ch]![i] = sample;
    }
  }

  return channels;
}

// ── Amplitude analysis ────────────────────────────────────────────────────────

interface SpeechSegment {
  startMs: number;
  endMs: number;
  peakDbfs: number;
}

function amplitudeToDbfs(rms: number): number {
  return rms < 1e-10 ? -120 : 20 * Math.log10(rms);
}

function detectSpeechSegments(
  samples: Float32Array,
  sampleRate: number,
): SpeechSegment[] {
  const frameSamples = Math.floor((sampleRate * FRAME_MS) / 1000);
  const frames = Math.floor(samples.length / frameSamples);

  // Compute RMS per frame
  const frameDbfs: number[] = [];
  for (let f = 0; f < frames; f++) {
    let sumSq = 0;
    for (let s = 0; s < frameSamples; s++) {
      const v = samples[f * frameSamples + s] ?? 0;
      sumSq += v * v;
    }
    frameDbfs.push(amplitudeToDbfs(Math.sqrt(sumSq / frameSamples)));
  }

  // Mark speech frames
  const isSpeech = frameDbfs.map((db) => db > SILENCE_THRESHOLD_DBFS);

  // Build raw segments
  const rawSegments: SpeechSegment[] = [];
  let inSpeech = false;
  let segStart = 0;
  let peakDbfs = -120;

  for (let f = 0; f < frames; f++) {
    if (isSpeech[f] && !inSpeech) {
      inSpeech = true;
      segStart = f;
      peakDbfs = frameDbfs[f]!;
    } else if (isSpeech[f] && inSpeech) {
      peakDbfs = Math.max(peakDbfs, frameDbfs[f]!);
    } else if (!isSpeech[f] && inSpeech) {
      rawSegments.push({
        startMs: segStart * FRAME_MS,
        endMs: f * FRAME_MS,
        peakDbfs,
      });
      inSpeech = false;
      peakDbfs = -120;
    }
  }
  if (inSpeech) {
    rawSegments.push({ startMs: segStart * FRAME_MS, endMs: frames * FRAME_MS, peakDbfs });
  }

  // Merge segments closer than MERGE_GAP_MS
  const merged: SpeechSegment[] = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && seg.startMs - last.endMs <= MERGE_GAP_MS) {
      last.endMs = seg.endMs;
      last.peakDbfs = Math.max(last.peakDbfs, seg.peakDbfs);
    } else {
      merged.push({ ...seg });
    }
  }

  // Discard segments shorter than MIN_SEGMENT_MS
  return merged.filter((s) => s.endMs - s.startMs >= MIN_SEGMENT_MS);
}

// ── Channel role heuristic ────────────────────────────────────────────────────

function guessChannelRoles(
  ch0segs: SpeechSegment[],
  ch1segs: SpeechSegment[],
): { assistantCh: number; customerCh: number } {
  // The assistant speaks first and usually has longer total speech time
  const ch0First = ch0segs[0]?.startMs ?? Infinity;
  const ch1First = ch1segs[0]?.startMs ?? Infinity;
  if (ch0First <= ch1First) {
    return { assistantCh: 0, customerCh: 1 };
  }
  return { assistantCh: 1, customerCh: 0 };
}

// ── Gap calculation ───────────────────────────────────────────────────────────

interface ResponseGap {
  userSegmentEnd: number;
  assistantReplyStart: number;
  gapMs: number;
}

function calculateResponseGaps(
  assistantSegs: SpeechSegment[],
  customerSegs: SpeechSegment[],
): ResponseGap[] {
  const gaps: ResponseGap[] = [];

  for (const userSeg of customerSegs) {
    // Find next assistant segment that starts after user stopped speaking
    const next = assistantSegs.find((a) => a.startMs >= userSeg.endMs);
    if (next) {
      gaps.push({
        userSegmentEnd: userSeg.endMs,
        assistantReplyStart: next.startMs,
        gapMs: next.startMs - userSeg.endMs,
      });
    }
  }

  return gaps;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  return `${ms}ms (${(ms / 1000).toFixed(2)}s)`;
}

function fmtSeg(s: SpeechSegment): string {
  return `${(s.startMs / 1000).toFixed(2)}s – ${(s.endMs / 1000).toFixed(2)}s  [${(s.endMs - s.startMs)}ms, peak ${s.peakDbfs.toFixed(1)}dBFS]`;
}

function redactPhone(s: string): string {
  return s.replace(/\+?1?\d[\d\s\-().]{8,}\d/g, "[REDACTED]");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  VAPI AUDIO LATENCY ANALYSIS — Club Sportif MAA / Sophie");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. Fetch call
  console.log("📡 Fetching latest Vapi call…");
  const call = await fetchLatestCall();
  const metrics = call.artifact?.performanceMetrics ?? {};
  const recordingUrl =
    call.artifact?.stereoRecordingUrl ?? call.artifact?.recordingUrl;

  console.log(`  Call ID    : ${call.id}`);
  console.log(`  Started at : ${call.startedAt ?? "n/a"}`);
  console.log(`  Ended at   : ${call.endedAt ?? "n/a"}`);
  console.log(`  Recording  : ${recordingUrl ? redactPhone(recordingUrl) : "⚠️  none — enable recording in Vapi dashboard"}`);

  if (!recordingUrl) {
    console.log("\n⚠️  No recording URL found on this call.");
    console.log("   Enable 'Record Call' in the Vapi assistant settings and run a new call.");
    process.exit(0);
  }

  // 2. Download
  console.log("\n📥 Downloading audio…");
  let audioPath = await downloadToTemp(recordingUrl);

  // 3. Convert if needed
  const ext = audioPath.split(".").pop()?.toLowerCase();
  if (ext !== "wav") {
    audioPath = convertToWav(audioPath);
  }

  // 4. Parse WAV
  console.log("  Parsing WAV…");
  const buf = fs.readFileSync(audioPath);
  const hdr = parseWavHeader(buf);
  const durationMs = Math.floor(
    (hdr.dataLength / (hdr.numChannels * (hdr.bitsPerSample / 8))) / hdr.sampleRate * 1000,
  );

  console.log(`  Channels    : ${hdr.numChannels}`);
  console.log(`  Sample rate : ${hdr.sampleRate} Hz`);
  console.log(`  Bit depth   : ${hdr.bitsPerSample}-bit`);
  console.log(`  Duration    : ${(durationMs / 1000).toFixed(2)}s`);

  // 5. Extract channels
  console.log("  Extracting PCM channels…");
  const channels = extractChannels(buf, hdr);

  if (channels.length === 1) {
    console.log("  ⚠️  Mono recording — cannot separate assistant/customer channels.");
    console.log("      Enable stereo recording in Vapi to get per-channel analysis.");
  }

  // 6. Detect speech segments
  const segsByChannel = channels.map((ch) => detectSpeechSegments(ch, hdr.sampleRate));

  const { assistantCh, customerCh } = channels.length >= 2
    ? guessChannelRoles(segsByChannel[0]!, segsByChannel[1]!)
    : { assistantCh: 0, customerCh: 0 };

  const assistantSegs = segsByChannel[assistantCh] ?? [];
  const customerSegs = channels.length >= 2 ? (segsByChannel[customerCh] ?? []) : [];

  // 7. Print segments
  console.log("\n🔊 CHANNEL ANALYSIS");
  for (let i = 0; i < channels.length; i++) {
    const role = i === assistantCh ? "ASSISTANT (guessed)" : i === customerCh ? "CUSTOMER (guessed)" : `CH${i}`;
    const segs = segsByChannel[i]!;
    console.log(`\n  Channel ${i} — ${role} — ${segs.length} speech segment(s):`);
    if (segs.length === 0) {
      console.log("    (no speech detected above threshold)");
    } else {
      segs.forEach((s, idx) => console.log(`    [${idx + 1}] ${fmtSeg(s)}`));
    }
  }

  // 8. Response gap analysis
  const gaps = calculateResponseGaps(assistantSegs, customerSegs);

  console.log("\n⏱️  RESPONSE GAPS (user stop → assistant reply start)");
  if (gaps.length === 0) {
    console.log("  No gaps detected (mono recording, or customer never spoke).");
  } else {
    gaps.forEach((g, i) => {
      console.log(
        `  [${i + 1}] User ended @${(g.userSegmentEnd / 1000).toFixed(2)}s → Sophie started @${(g.assistantReplyStart / 1000).toFixed(2)}s  GAP: ${fmtMs(g.gapMs)}`,
      );
    });

    const gapValues = gaps.map((g) => g.gapMs);
    const maxGap = Math.max(...gapValues);
    const avgGap = gapValues.reduce((a, b) => a + b, 0) / gapValues.length;

    console.log(`\n  Largest gap : ${fmtMs(maxGap)}`);
    console.log(`  Average gap : ${fmtMs(Math.round(avgGap))}`);
  }

  // 9. Vapi metrics comparison
  console.log("\n⚡ VAPI PERFORMANCE METRICS (from API)");
  const metricLine = (label: string, val?: number) =>
    console.log(`  ${label.padEnd(32)}: ${val !== undefined ? `${val}ms` : "n/a"}`);
  metricLine("modelLatencyAverage", metrics.modelLatencyAverage);
  metricLine("voiceLatencyAverage", metrics.voiceLatencyAverage);
  metricLine("transcriberLatencyAverage", metrics.transcriberLatencyAverage);
  metricLine("endpointingLatencyAverage", metrics.endpointingLatencyAverage);
  metricLine("turnLatencyAverage", metrics.turnLatencyAverage);

  // 10. Diagnosis
  console.log("\n🔍 DIAGNOSIS");

  const vapiTurnOk = (metrics.turnLatencyAverage ?? 0) < 2200;
  const avgGapMs = gaps.length > 0
    ? gaps.reduce((a, b) => a + b.gapMs, 0) / gaps.length
    : null;

  if (gaps.length === 0) {
    console.log("  ⚠️  Could not compute audio gaps (mono or no customer speech detected).");
    console.log("     Enable stereo recording in Vapi for full analysis.");
  } else if (vapiTurnOk && avgGapMs !== null && avgGapMs > 2500) {
    console.log(`  🔴 Vapi metrics healthy (turnLatency ${metrics.turnLatencyAverage}ms), but real audible gap is ${Math.round(avgGapMs)}ms.`);
    console.log("     Suspect phone transport delay, audio codec buffering, or ElevenLabs TTS streaming start.");
    console.log("     → Try: lower inputMinCharacters further (to 1), check ElevenLabs streaming settings.");
  } else if (!vapiTurnOk && avgGapMs !== null && avgGapMs > 2500) {
    console.log(`  🔴 Both Vapi turnLatency (${metrics.turnLatencyAverage}ms) and audio gap (${Math.round(avgGapMs)}ms) are high.`);
    console.log("     → The assistant pipeline latency is real. Address model or TTS bottleneck.");
  } else if (avgGapMs !== null && avgGapMs <= 1500) {
    console.log(`  ✅ Audio gap looks healthy (avg ${Math.round(avgGapMs)}ms).`);
    console.log("     → If user perceives delay, it may be the opening length or audio codec quality, not pipeline latency.");
  } else {
    console.log(`  🟡 Audio gap is moderate (avg ${avgGapMs !== null ? Math.round(avgGapMs) : "n/a"}ms). Acceptable but worth monitoring.`);
  }

  // Check for TTS pronunciation markers in transcript
  const vars = call.assistantOverrides?.variableValues ?? {};
  const summary = vars.handoff_summary ?? "";
  if (summary.toLowerCase().includes("assistant:") || summary.toLowerCase().includes("nous vous appelons")) {
    console.log("  🔴 handoff_summary is still dirty — re-check cleanHandoffSummary() logic.");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Cleanup temp file
  try {
    fs.unlinkSync(audioPath);
    if (ext !== "wav") {
      const converted = audioPath.replace(/\.\w+$/, "-converted.wav");
      if (fs.existsSync(converted)) fs.unlinkSync(converted);
    }
  } catch {
    // non-fatal
  }
}

main().catch((err: unknown) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
