import Foundation
import AVFoundation
import AudioToolbox

struct Note: Decodable {
    let time: Double
    let duration: Double
    let midi: UInt8
    let velocity: UInt8
    let voice: Int
}
struct Pedal: Decodable { let time: Double; let value: UInt8 }
struct Performance: Decodable {
    let duration: Double
    let sample_rate: Double
    let sound_bank: String
    let notes: [Note]
    let pedal: [Pedal]
}
struct Event {
    let frame: AVAudioFramePosition
    let order: Int
    let voice: Int
    let kind: Int  // 0 note-off, 1 pedal, 2 note-on
    let note: UInt8
    let value: UInt8
}

let args = CommandLine.arguments
if args.count != 3 { fatalError("Usage: render_piano.swift performance.json output.wav") }
let performance = try JSONDecoder().decode(Performance.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let engine = AVAudioEngine()
let format = AVAudioFormat(standardFormatWithSampleRate: performance.sample_rate, channels: 2)!
let ensemble = AVAudioMixerNode()
let room = AVAudioUnitReverb()
engine.attach(ensemble)
engine.attach(room)
room.loadFactoryPreset(.mediumHall)
room.wetDryMix = 12
ensemble.outputVolume = 0.63
engine.connect(ensemble, to: room, format: format)
engine.connect(room, to: engine.mainMixerNode, format: format)
var samplers = [AVAudioUnitSampler]()
for voice in 0..<2 {
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)
    engine.connect(sampler, to: ensemble, fromBus: 0, toBus: AVAudioNodeBus(voice), format: format)
    try sampler.loadSoundBankInstrument(at: URL(fileURLWithPath: performance.sound_bank),
                                        program: 0, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    sampler.stereoPan = voice == 0 ? 0.08 : -0.08
    samplers.append(sampler)
}
var events = [Event]()
for note in performance.notes {
    events.append(Event(frame: Int64((note.time*performance.sample_rate).rounded()), order: 2,
                        voice: note.voice, kind: 2, note: note.midi, value: note.velocity))
    events.append(Event(frame: Int64(((note.time+note.duration)*performance.sample_rate).rounded()), order: 0,
                        voice: note.voice, kind: 0, note: note.midi, value: 0))
}
for pedal in performance.pedal {
    for voice in 0..<2 {
        events.append(Event(frame: Int64((pedal.time*performance.sample_rate).rounded()), order: 1,
                            voice: voice, kind: 1, note: 64, value: pedal.value))
    }
}
events.sort { $0.frame == $1.frame ? $0.order < $1.order : $0.frame < $1.frame }
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 2048)
engine.prepare()
try engine.start()
let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 2048)!
var settings = format.settings
settings[AVLinearPCMIsNonInterleaved] = false
let output = try AVAudioFile(forWriting: URL(fileURLWithPath: args[2]), settings: settings)
let total = AVAudioFramePosition((performance.duration*performance.sample_rate).rounded())
var cursor = 0
var retries = 0
while engine.manualRenderingSampleTime < total {
    let now = engine.manualRenderingSampleTime
    while cursor < events.count && events[cursor].frame <= now {
        let event = events[cursor]
        let sampler = samplers[event.voice]
        if event.kind == 0 { sampler.stopNote(event.note, onChannel: 0) }
        else if event.kind == 1 { sampler.sendController(64, withValue: event.value, onChannel: 0) }
        else { sampler.startNote(event.note, withVelocity: event.value, onChannel: 0) }
        cursor += 1
    }
    let untilEvent = cursor < events.count ? max(1,events[cursor].frame-now) : total-now
    let frames = AVAudioFrameCount(min(2048,total-now,untilEvent))
    let status = try engine.renderOffline(frames, to: buffer)
    if status == .success {
        try output.write(from: buffer)
        retries = 0
    } else {
        retries += 1
        if status == .error || retries > 100 { fatalError("Offline piano rendering failed: \(status)") }
    }
}
engine.stop()
print("Rendered piano performance: \(performance.notes.count) notes, \(performance.duration)s")
