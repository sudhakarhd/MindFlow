import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { 
  Camera, Utensils, Footprints, MapPin, Sparkles, 
  Droplet, Bell, Play, Square, RefreshCw, Moon, BookOpen, Clock, Calendar
} from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'capture' | 'somatic' | 'meditate' | 'summary'>('feed')
  const [logs, setLogs] = useState<any[]>([])
  const [somaticLogs, setSomaticLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Capture Form State
  const [category, setCategory] = useState<'meal' | 'activity' | 'place' | 'note'>('meal')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Quiet Hours & Settings State
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')

  // Meditation State
  const [isMeditating, setIsMeditating] = useState(false)
  const [meditationTime, setMeditationTime] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    const { data: wLogs, error: wErr } = await supabase
      .from('wellness_logs')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (wErr) {
      console.error('Fetch logs error:', wErr)
    } else if (wLogs) {
      setLogs(wLogs)
    }

    const { data: sLogs, error: sErr } = await supabase
      .from('somatic_checkins')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (sErr) {
      console.error('Fetch checkins error:', sErr)
    } else if (sLogs) {
      setSomaticLogs(sLogs)
    }
  }

  // Tibetan Singing Bowl Synthesis
  const playTibetanSingingBowl = () => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = ctx

      const baseFreq = 216
      const harmonics = [
        { freq: baseFreq, gain: 0.6 },
        { freq: baseFreq * 2.76, gain: 0.35 },
        { freq: baseFreq * 5.4, gain: 0.15 }
      ]

      harmonics.forEach(({ freq, gain: targetGain }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        gain.gain.setValueAtTime(targetGain, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 4.5)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start()
        osc.stop(ctx.currentTime + 4.6)
      })
    } catch (e) {
      console.error(e)
    }
  }

  // 2-Minute Interval Bell
  useEffect(() => {
    let timer: any
    if (isMeditating) {
      playTibetanSingingBowl()
      timer = setInterval(() => {
        setMeditationTime(prev => {
          const next = prev + 1
          if (next % 120 === 0) {
            playTibetanSingingBowl()
          }
          return next
        })
      }, 1000)
    } else {
      setMeditationTime(0)
    }
    return () => clearInterval(timer)
  }, [isMeditating])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      setFile(selected)
      setPreviewUrl(URL.createObjectURL(selected))
    }
  }

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return
    setLoading(true)

    let publicUrl = ''

    if (file) {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      
      const { error: uploadErr } = await supabase.storage
        .from('wellness-media')
        .upload(fileName, file, { 
          contentType: file.type || 'image/jpeg',
          upsert: true 
        })

      if (uploadErr) {
        alert('Image upload failed: ' + uploadErr.message)
      } else {
        const { data: urlData } = supabase.storage.from('wellness-media').getPublicUrl(fileName)
        publicUrl = urlData.publicUrl
      }
    }

    const { error: insertErr } = await supabase.from('wellness_logs').insert([{
      category,
      title,
      notes: notes || null,
      image_url: publicUrl || null
    }])

    if (insertErr) {
      alert('Error saving log: ' + insertErr.message)
    } else {
      setTitle('')
      setNotes('')
      setFile(null)
      setPreviewUrl(null)
      setActiveTab('feed')
      await fetchLogs()
    }

    setLoading(false)
  }

  const logSomaticCheckin = async (sensation: string) => {
    const { error } = await supabase.from('somatic_checkins').insert([{ type: 'body_scan', sensation }])
    if (error) {
      alert('Error saving check-in: ' + error.message)
    } else {
      await fetchLogs()
      alert(`Logged: "${sensation}"`)
    }
  }

  const logWater = async (amount = 250) => {
    const { error } = await supabase.from('somatic_checkins').insert([{ type: 'water', water_amount_ml: amount }])
    if (error) {
      alert('Error logging water: ' + error.message)
    } else {
      await fetchLogs()
      alert(`+${amount}ml water logged! 💧`)
    }
  }

  // Date Filtering Calculations
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayLogs = logs.filter(l => new Date(l.created_at) >= todayStart)
  const todayWaterEntries = somaticLogs.filter(s => s.type === 'water' && new Date(s.created_at) >= todayStart)
  const todayWaterTotal = todayWaterEntries.reduce((sum, item) => sum + (item.water_amount_ml || 250), 0)
  const todayCheckins = somaticLogs.filter(s => s.type === 'body_scan' && new Date(s.created_at) >= todayStart)

  // Past 7 Days History Calculation
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const nextD = new Date(d)
    nextD.setDate(d.getDate() + 1)

    const dayWater = somaticLogs
      .filter(s => s.type === 'water' && new Date(s.created_at) >= d && new Date(s.created_at) < nextD)
      .reduce((sum, item) => sum + (item.water_amount_ml || 250), 0)

    const dayCheckinsCount = somaticLogs
      .filter(s => s.type === 'body_scan' && new Date(s.created_at) >= d && new Date(s.created_at) < nextD).length

    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      water: dayWater,
      scans: dayCheckinsCount
    }
  })

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between pb-20 select-none">
      
      {/* Header */}
      <header className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg tracking-tight text-white">Daily Wellness</h1>
          <p className="text-xs text-zinc-400">Mindful living & lifestyle journal</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'summary' ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-white'}`}
            title="Evening Reflection"
          >
            <Moon size={18} />
          </button>
          <button onClick={fetchLogs} className="p-2 text-zinc-400 hover:text-white">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <main className="flex-1 p-4 overflow-y-auto">
        
        {/* TAB 1: FEED */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <Sparkles className="mx-auto mb-2 opacity-50" size={32} />
                <p>No entries yet. Tap Capture below to start!</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                  {log.image_url && (
                    <img 
                      src={log.image_url} 
                      alt={log.title} 
                      className="w-full h-56 object-cover bg-zinc-950 border-b border-zinc-800" 
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-emerald-400">
                        {log.category}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="font-medium text-zinc-100 text-base">{log.title}</h3>
                    {log.notes && <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{log.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: CAPTURE */}
        {activeTab === 'capture' && (
          <form onSubmit={handleSaveEntry} className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'meal', label: 'Meal', icon: Utensils },
                { id: 'activity', label: 'Workout', icon: Footprints },
                { id: 'place', label: 'Place', icon: MapPin },
                { id: 'note', label: 'Note', icon: Sparkles }
              ].map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as any)}
                    className={`py-3 flex flex-col items-center gap-1 rounded-xl text-xs font-medium border transition-colors ${
                      category === item.id 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
              <input 
                type="text"
                placeholder="e.g., Healthy lunch, Trail walk, Sunset view"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Photo (Optional)</label>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleImageChange}
                className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
              />
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="mt-2 w-full h-44 object-cover rounded-xl border border-zinc-800" />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Notes / Reflection</label>
              <textarea 
                rows={3}
                placeholder="How did you feel? What ingredients or thoughts were present?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded-xl text-sm transition-colors flex justify-center items-center gap-2"
            >
              {loading ? 'Uploading & Saving...' : 'Save Entry'}
            </button>
          </form>
        )}

        {/* TAB 3: SOMATIC & WATER */}
        {activeTab === 'somatic' && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Droplet size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Hydration Tracker</h3>
                    <p className="text-xs text-zinc-400">Total today: <strong className="text-blue-400 text-sm">{todayWaterTotal} ml</strong></p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => logWater(250)}
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 font-medium rounded-xl text-xs text-white transition-colors"
                >
                  + Glass (250ml)
                </button>
                <button 
                  onClick={() => logWater(500)}
                  className="py-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 font-medium rounded-xl text-xs transition-colors"
                >
                  + Bottle (500ml)
                </button>
              </div>
            </div>

            {/* Somatic Check-In Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-sm text-white">Somatic Check-In</h3>
                  <p className="text-xs text-zinc-400">Notice body sensations without judging</p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-4 italic">
                "Pause for 20 seconds. Scan jaw, chest, shoulders, and abdomen. What is present?"
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['Relaxed & Open', 'Shoulder Tension', 'Chest Tightness', 'Restless Energy', 'Calm & Grounded', 'Fatigued'].map(sens => (
                  <button
                    key={sens}
                    onClick={() => logSomaticCheckin(sens)}
                    className="py-2.5 px-3 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl text-xs text-left text-zinc-200 transition-colors"
                  >
                    {sens}
                  </button>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Quiet Hours</h3>
                    <p className="text-xs text-zinc-400">Mutes reminders during rest/sleep</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={quietHoursEnabled} 
                  onChange={e => setQuietHoursEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500" 
                />
              </div>

              {quietHoursEnabled && (
                <div className="flex items-center gap-3 mt-3 text-xs text-zinc-300">
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Mute from:</span>
                    <input 
                      type="time" 
                      value={quietStart} 
                      onChange={e => setQuietStart(e.target.value)} 
                      className="w-full bg-zinc-800 rounded-lg p-2 text-white border border-zinc-700" 
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Until:</span>
                    <input 
                      type="time" 
                      value={quietEnd} 
                      onChange={e => setQuietEnd(e.target.value)} 
                      className="w-full bg-zinc-800 rounded-lg p-2 text-white border border-zinc-700" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MEDITATE */}
        {activeTab === 'meditate' && (
          <div className="text-center py-10 space-y-6">
            <div className="w-36 h-36 mx-auto rounded-full border-2 border-emerald-500/30 flex items-center justify-center bg-emerald-500/5">
              <span className="text-3xl font-light font-mono text-emerald-400">
                {Math.floor(meditationTime / 60).toString().padStart(2, '0')}:
                {(meditationTime % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-medium text-white">Tibetan Singing Bowl Anchor</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                A subtle, harmonic singing bowl chimes every 2 minutes. When you hear it, gently bring awareness back to body & breath.
              </p>
            </div>

            <button
              onClick={() => setIsMeditating(!isMeditating)}
              className={`px-8 py-3 rounded-full font-medium text-sm inline-flex items-center gap-2 transition-colors ${
                isMeditating 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold'
              }`}
            >
              {isMeditating ? <><Square size={16} /> End Sitting</> : <><Play size={16} /> Start Sitting</>}
            </button>
          </div>
        )}

        {/* TAB 5: NIGHTLY SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/20 border border-indigo-900/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="text-indigo-400" size={20} />
                <h2 className="font-medium text-sm text-white">Today's Daily Reflection</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Review what you did, ate, and felt before going to sleep.
              </p>
            </div>

            {/* Daily Stats Card */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-center">
                <span className="text-lg font-bold text-white">{todayLogs.length}</span>
                <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Entries</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-center">
                <span className="text-lg font-bold text-blue-400">{todayWaterTotal} <span className="text-xs font-normal">ml</span></span>
                <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Water</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-center">
                <span className="text-lg font-bold text-purple-400">{todayCheckins.length}</span>
                <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Body Scans</span>
              </div>
            </div>

            {/* 7-Day History Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Past 7 Days History</h3>
              </div>
              <div className="space-y-2">
                {past7Days.map((day, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 text-xs last:border-0">
                    <span className="text-zinc-400 font-medium">{day.date}</span>
                    <div className="flex gap-4">
                      <span className="text-blue-400 font-medium">{day.water} ml</span>
                      <span className="text-purple-400">{day.scans} scans</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Highlights List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Today's Highlights & Notes</h3>
              {todayLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No notes recorded today yet.</p>
              ) : (
                todayLogs.map(l => (
                  <div key={l.id} className="border-l-2 border-emerald-500 pl-3 py-1">
                    <p className="text-xs font-medium text-zinc-200">{l.title}</p>
                    {l.notes && <p className="text-xs text-zinc-400 mt-0.5">{l.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 px-4 py-2.5 flex justify-around items-center">
        {[
          { id: 'feed', label: 'Timeline', icon: Sparkles },
          { id: 'capture', label: 'Capture', icon: Camera },
          { id: 'somatic', label: 'Check-In', icon: Droplet },
          { id: 'meditate', label: 'Meditate', icon: Bell }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-400' : 'text-zinc-500'
              }`}
            >
              <Icon size={20} />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}