/* Ton, Vibration und Wake Lock – die drei Plattform-Signale der App.
   iOS kennt keine Vibration, und Audio geht dort nur nach einer Nutzergeste;
   der AudioContext wird deshalb beim Start eines Timers (immer ein Tap) geweckt.
   Bei aktivem Stummschalter bleibt der Ton aus – das Blinken in der Leiste ist
   das verlässliche Signal. */

let actx: AudioContext | null = null

export function primeAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    actx = actx || new AC()
    if (actx.state === 'suspended') void actx.resume()
  } catch { /* ohne Audio weiter */ }
}

export function alarm() {
  try {
    if (actx) {
      const t0 = actx.currentTime
      ;[0, 0.22, 0.44].forEach((off, i) => {
        const osc = actx!.createOscillator(), g = actx!.createGain()
        osc.frequency.value = i === 2 ? 1175 : 880
        osc.connect(g); g.connect(actx!.destination)
        g.gain.setValueAtTime(0.0001, t0 + off)
        g.gain.exponentialRampToValueAtTime(0.4, t0 + off + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18)
        osc.start(t0 + off); osc.stop(t0 + off + 0.2)
      })
    }
  } catch { /* ohne Ton weiter */ }
  navigator.vibrate?.([200, 100, 200, 100, 300])
}

let lock: WakeLockSentinel | null = null
export async function keepAwake(on: boolean) {
  try {
    if (on && !document.hidden && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
    if (!on) { await lock?.release(); lock = null }
  } catch { /* nicht unterstützt */ }
}
