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
struct Voice: Decodable {
    let name: String
    let program: UInt8
    let pan: Float
    let gain: Float
}
struct Control: Decodable {
    let time: Double
    let voice: Int
    let controller: UInt8
    let value: UInt8
}
struct Performance: Decodable {
    let duration: Double
    let sample_rate: Double
    let sound_bank: String
    let voices: [Voice]
    let notes: [Note]
    let controls: [Control]
}
struct Event {
    let frame: AVAudioFramePosition
    let order: Int
    let voice: Int
    let note: UInt8
    let value: UInt8
}

let args = CommandLine.arguments
if args.count != 3 { fatalError("Usage: render_orchestra.swift performance.json output.wav") }
let performance = try JSONDecoder().decode(Performance.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let engine = AVAudioEngine()
let format = AVAudioFormat(standardFormatWithSampleRate: performance.sample_rate, channels: 2)!
let ensemble = AVAudioMixerNode()
let room = AVAudioUnitReverb()
engine.attach(ensemble)
engine.attach(room)
room.loadFactoryPreset(.largeHall)
room.wetDryMix = 20
ensemble.outputVolume = 0.5
engine.connect(ensemble, to: room, format: format)
engine.connect(room, to: engine.mainMixerNode, format: format)
var samplers = [AVAudioUnitSampler]()
for (index, voice) in performance.voices.enumerated() {
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)
    engine.connect(sampler, to: ensemble, fromBus: 0, toBus: AVAudioNodeBus(index), format: format)
    try sampler.loadSoundBankInstrument(at: URL(fileURLWithPath: performance.sound_bank),
                                        program: voice.program, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    sampler.stereoPan = voice.pan
    sampler.masterGain = voice.gain
    sampler.sendController(91, withValue: 0, onChannel: 0)
    sampler.sendController(93, withValue: 0, onChannel: 0)
    samplers.append(sampler)
}
var events = [Event]()
for note in performance.notes {
    events.append(Event(frame: Int64((note.time*performance.sample_rate).rounded()), order: 2,
                        voice: note.voice, note: note.midi, value: note.velocity))
    events.append(Event(frame: Int64(((note.time+note.duration)*performance.sample_rate).rounded()), order: 0,
                        voice: note.voice, note: note.midi, value: 0))
}
for control in performance.controls {
    events.append(Event(frame: Int64((control.time*performance.sample_rate).rounded()), order: 1,
                        voice: control.voice, note: control.controller, value: control.value))
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
        if event.order == 0 { sampler.stopNote(event.note, onChannel: 0) }
        else if event.order == 1 { sampler.sendController(event.note, withValue: event.value, onChannel: 0) }
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
        if status == .error || retries > 100 { fatalError("Offline orchestra rendering failed: \(status)") }
    }
}
engine.stop()
print("Rendered \(performance.voices.count) orchestra parts, \(performance.notes.count) notes, \(performance.duration)s")
