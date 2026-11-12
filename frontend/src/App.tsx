import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { Auth } from './components/Auth'
import { playPourSound } from './utils/audio'
import { 
  Camera, Image as ImageIcon, Utensils, Footprints, MapPin, Sparkles, 
  Droplet, Bell, Play, Square, RefreshCw, Moon, BookOpen, Clock, Calendar,
  Activity, LogOut, Music, Volume2
} from 'lucide-react'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'feed' | 'capture' | 'somatic' | 'meditate' | 'summary'>('feed')
  const [logs, setLogs] = useState<any[]>([])
  const [somaticLogs, setSomaticLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'all' | 'mine'>('all')

  // Capture Form State
  const [category, setCategory] = useState<'meal' | 'activity' | 'place' | 'note'>('meal')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Reminders & Active Scheduling
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderFrequencyMin, setReminderFrequencyMin] = useState(45)

  // Meditation State & Audio Options
  const [meditationMode, setMeditationMode] = useState<'singing_bowl' | 'calm_drone' | 'guided_breath'>('singing_bowl')
  const [isMeditating, setIsMeditating] = useState(false)
  const [meditationSeconds, setMeditationSeconds] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const droneOscillatorRef = useRef<OscillatorNode | null>(null)
  const droneGainRef = useRef<GainNode | null>(null)

  // Session Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      fetchLogs()
      setupSmartNotificationEngine()
    }
  }, [session, quietHoursEnabled, quietStart, quietEnd, reminderEnabled, reminderFrequencyMin])

  const userDisplayName = session?.user?.email?.split('@')[0] || 'User'
  const currentUserId = session?.user?.id

  const fetchLogs = async () => {
    const { data: wLogs } = await supabase
      .from('wellness_logs')
      .select('*')
      .order('created_at', { ascending: false })
    if (wLogs) setLogs(wLogs)

    const { data: sLogs } = await supabase
      .from('somatic_checkins')
      .select('*')
      .order('created_at', { ascending: false })
    if (sLogs) setSomaticLogs(sLogs)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Tibetan Singing Bowl Sound
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

  // Calming Ambient Drone (Synthesized 432Hz ambient sound)
  const startCalmDrone = () => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = ctx

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(432 / 4, ctx.currentTime) // 108Hz grounding pitch
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2.0)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()

      droneOscillatorRef.current = osc
      droneGainRef.current = gain
    } catch (e) {
      console.error('Drone error:', e)
    }
  }

  const stopCalmDrone = () => {
    try {
      if (droneGainRef.current && audioContextRef.current) {
        droneGainRef.current.gain.linearRampToValueAtTime(0.001, audioContextRef.current.currentTime + 1.0)
        setTimeout(() => {
          droneOscillatorRef.current?.stop()
          droneOscillatorRef.current?.disconnect()
          droneOscillatorRef.current = null
          droneGainRef.current = null
        }, 1000)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Voice Prompt Generator for Guided Breath Focus
  const speakGuidance = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.85
      utterance.pitch = 0.95
      window.speechSynthesis.speak(utterance)
    }
  }

  // Smart Engine: Quiet Hours & Break Reminders
  const setupSmartNotificationEngine = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const checkInterval = () => {
      if (!reminderEnabled) return

      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      const [qStartH, qStartM] = quietStart.split(':').map(Number)
      const [qEndH, qEndM] = quietEnd.split(':').map(Number)
      const quietStartMin = qStartH * 60 + qStartM
      const quietEndMin = qEndH * 60 + qEndM

      const inQuietHours = quietHoursEnabled && (
        quietStartMin > quietEndMin 
          ? (currentMinutes >= quietStartMin || currentMinutes < quietEndMin)
          : (currentMinutes >= quietStartMin && currentMinutes < quietEndMin)
      )

      if (inQuietHours) return

      // Triggers at the set minute interval (e.g., every 45 or 60 min)
      if (now.getMinutes() % reminderFrequencyMin === 0) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🌿 MindFlow: Gentle Awareness Break', { 
            body: 'Unclench your jaw, drink a sip of water, and take one deep conscious breath.' 
          })
        }
      }
    }

    const intervalId = setInterval(checkInterval, 60000)
    return () => clearInterval(intervalId)
  }

  // Meditation Timer Controller
  useEffect(() => {
    let timer: any
    if (isMeditating) {
      if (meditationMode === 'singing_bowl') playTibetanSingingBowl()
      if (meditationMode === 'calm_drone') startCalmDrone()
      if (meditationMode === 'guided_breath') {
        playTibetanSingingBowl()
        speakGuidance("Close your eyes. Inhale slowly through your nose... and release.")
      }

      timer = setInterval(() => {
        setMeditationSeconds(prev => {
          const next = prev + 1
          if (meditationMode === 'singing_bowl' && next > 0 && next % 120 === 0) {
            playTibetanSingingBowl()
          }
          if (meditationMode === 'guided_breath' && next === 60) {
            speakGuidance("Notice any tension in your shoulders. Relax your belly and soften your gaze.")
          }
          return next
        })
      }, 1000)
    } else {
      if (meditationMode === 'calm_drone') stopCalmDrone()
    }

    return () => {
      clearInterval(timer)
      if (meditationMode === 'calm_drone') stopCalmDrone()
    }
  }, [isMeditating, meditationMode])

  const stopMeditation = async () => {
    setIsMeditating(false)
    const minutes = Math.max(1, Math.round(meditationSeconds / 60))

    if (meditationSeconds >= 20) {
      await supabase.from('wellness_logs').insert([{
        category: 'meditation',
        title: `Mindful Sitting (${minutes} min - ${meditationMode.replace('_', ' ')})`,
        notes: `Body, breath, and awareness reset.`,
        duration_minutes: minutes,
        author: userDisplayName,
        user_id: currentUserId,
        is_shared: true
      }])
      await fetchLogs()
      alert(`Meditation logged: ${minutes} min!`)
    }
    setMeditationSeconds(0)
  }

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        .upload(fileName, file, { contentType: file.type || 'image/jpeg', upsert: true })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('wellness-media').getPublicUrl(fileName)
        publicUrl = urlData.publicUrl
      }
    }

    await supabase.from('wellness_logs').insert([{
      category,
      title,
      notes: notes || null,
      image_url: publicUrl || null,
      author: userDisplayName,
      user_id: currentUserId,
      is_shared: true
    }])

    setTitle('')
    setNotes('')
    setFile(null)
    setPreviewUrl(null)
    setActiveTab('feed')
    await fetchLogs()
    setLoading(false)
  }

  const logSomaticCheckin = async (sensation: string) => {
    await supabase.from('somatic_checkins').insert([{ 
      type: 'body_scan', 
      sensation,
      author: userDisplayName,
      user_id: currentUserId
    }])
    await supabase.from('wellness_logs').insert([{
      category: 'somatic',
      title: `Somatic Check-In: ${sensation}`,
      notes: `Body scan registered without labeling.`,
      author: userDisplayName,
      user_id: currentUserId,
      is_shared: true
    }])
    await fetchLogs()
    alert(`Logged: "${sensation}"`)
  }

  const logWater = async (amount = 250) => {
    playPourSound()
    await supabase.from('somatic_checkins').insert([{ 
      type: 'water', 
      water_amount_ml: amount,
      author: userDisplayName,
      user_id: currentUserId
    }])
    await fetchLogs()
  }

  // Format Helper for Date and Time
  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString)
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `${datePart} • ${timePart}`
  }

  const isSameLocalDate = (dateA: Date, dateB: Date) => {
    return dateA.getFullYear() === dateB.getFullYear() &&
           dateA.getMonth() === dateB.getMonth() &&
           dateA.getDate() === dateB.getDate()
  }

  // Render Login Screen if Not Signed In
  if (!session) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center px-4">
        <header className="text-center mb-6">
          <h1 className="font-bold text-2xl tracking-tight text-white">MindFlow</h1>
          <p className="text-xs text-zinc-400 mt-1">Daily hydration, awareness & mindful grounding</p>
        </header>
        <Auth />
      </div>
    )
  }

  const now = new Date()
  const isMine = (item: any) => (item.user_id ? item.user_id === currentUserId : item.author === userDisplayName)

  const todayLogs = logs.filter(l => isSameLocalDate(new Date(l.created_at), now) && isMine(l))
  const todayWaterLogs = somaticLogs.filter(s => s.type === 'water' && isSameLocalDate(new Date(s.created_at), now) && isMine(s))
  const todayWaterTotal = todayWaterLogs.reduce((sum, item) => sum + (item.water_amount_ml || 250), 0)
  const todayCheckins = somaticLogs.filter(s => s.type === 'body_scan' && isSameLocalDate(new Date(s.created_at), now) && isMine(s))

  const displayedFeedLogs = logs.filter(l => {
    if (feedFilter === 'mine') return isMine(l)
    return true
  })

  // Past 7 Days Table for Current User
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - i)

    const dayWater = somaticLogs
      .filter(s => s.type === 'water' && isSameLocalDate(new Date(s.created_at), targetDate) && isMine(s))
      .reduce((sum, item) => sum + (item.water_amount_ml || 250), 0)

    const dayScans = somaticLogs
      .filter(s => s.type === 'body_scan' && isSameLocalDate(new Date(s.created_at), targetDate) && isMine(s)).length

    return {
      dateLabel: targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      water: dayWater,
      scans: dayScans
    }
  })

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between pb-20 select-none">
      
      {/* Top Header */}
      <header className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur sticky top-0 z-20 space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-base tracking-tight text-white">MindFlow</h1>
            <p className="text-[11px] text-zinc-400">User: <span className="text-emerald-400 font-medium">{userDisplayName}</span></p>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'summary' ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-white'}`}
              title="Daily Reflection"
            >
              <Moon size={18} />
            </button>
            <button onClick={fetchLogs} className="p-2 text-zinc-400 hover:text-white" title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button onClick={handleSignOut} className="p-2 text-zinc-400 hover:text-red-400" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 overflow-y-auto">
        
        {/* TAB 1: FEED / TIMELINE WITH DATE & TIME */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Timeline Stream</span>
              <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
                <button 
                  onClick={() => setFeedFilter('all')}
                  className={`px-2 py-0.5 rounded ${feedFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}
                >
                  All Logs
                </button>
                <button 
                  onClick={() => setFeedFilter('mine')}
                  className={`px-2 py-0.5 rounded ${feedFilter === 'mine' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}
                >
                  My Logs
                </button>
              </div>
            </div>

            {displayedFeedLogs.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <Sparkles className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">No entries recorded yet. Tap Capture below to start!</p>
              </div>
            ) : (
              displayedFeedLogs.map(log => (
                <div key={log.id} className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                  {log.image_url && (
                    <img 
                      src={log.image_url} 
                      alt={log.title} 
                      className="w-full h-56 object-cover bg-zinc-950 border-b border-zinc-800/80" 
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                          log.category === 'meditation' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          log.category === 'somatic' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {log.category}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium">by {log.author || 'User'}</span>
                    </div>
                    <h3 className="font-medium text-zinc-100 text-sm leading-snug">{log.title}</h3>
                    {log.notes && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{log.notes}</p>}
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
              <label className="block text-xs font-medium text-zinc-400 mb-1">Add Photo</label>
              <input 
                ref={cameraInputRef}
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={handleImageFile}
                className="hidden" 
              />
              <input 
                ref={galleryInputRef}
                type="file" 
                accept="image/*" 
                onChange={handleImageFile}
                className="hidden" 
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs flex items-center justify-center gap-2 text-zinc-300"
                >
                  <Camera size={16} className="text-emerald-400" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs flex items-center justify-center gap-2 text-zinc-300"
                >
                  <ImageIcon size={16} className="text-blue-400" />
                  Upload Gallery
                </button>
              </div>

              {previewUrl && (
                <div className="relative mt-2">
                  <img src={previewUrl} alt="Preview" className="w-full h-44 object-cover rounded-xl border border-zinc-800" />
                  <button 
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="absolute top-2 right-2 bg-zinc-950/80 text-zinc-300 px-2 py-0.5 text-[10px] rounded-md border border-zinc-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Notes / Reflection</label>
              <textarea 
                rows={3}
                placeholder="How did you feel? Ingredients or thoughts..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded-xl text-sm transition-colors"
            >
              {loading ? 'Uploading & Saving...' : 'Save Entry'}
            </button>
          </form>
        )}

        {/* TAB 3: WATER & SOMATIC WITH FUNCTIONAL QUIET HOURS */}
        {activeTab === 'somatic' && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Droplet size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Daily Hydration Tracker</h3>
                    <p className="text-xs text-zinc-400">Today's Intake: <strong className="text-blue-400">{todayWaterTotal} ml</strong></p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => logWater(250)}
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 font-medium rounded-xl text-xs text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <Droplet size={14} /> + Glass (250ml)
                </button>
                <button 
                  onClick={() => logWater(500)}
                  className="py-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Droplet size={14} /> + Bottle (500ml)
                </button>
              </div>
            </div>

            {/* Somatic Check-In */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-sm text-white">Somatic Check-In</h3>
                  <p className="text-xs text-zinc-400">Notice body sensations without judging</p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-3 italic">
                "Scan jaw, shoulders, and chest right now. What is present?"
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['Relaxed & Grounded', 'Shoulder Tension', 'Chest Tightness', 'Restless Energy', 'Calm Breathing', 'Fatigued'].map(sens => (
                  <button
                    key={sens}
                    onClick={() => logSomaticCheckin(sens)}
                    className="py-2.5 px-3 bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 rounded-xl text-xs text-left text-zinc-200 transition-colors"
                  >
                    {sens}
                  </button>
                ))}
              </div>
            </div>

            {/* Reminders: Periodic Hydration & Posture Reset */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Daytime Mindful Reminders</h3>
                    <p className="text-xs text-zinc-400">Drink water & stand up alerts</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={reminderEnabled} 
                  onChange={e => setReminderEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500" 
                />
              </div>

              {reminderEnabled && (
                <div>
                  <span className="block text-zinc-400 text-xs mb-1">Interval Frequency:</span>
                  <select 
                    value={reminderFrequencyMin}
                    onChange={e => setReminderFrequencyMin(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value={30}>Every 30 minutes</option>
                    <option value={45}>Every 45 minutes</option>
                    <option value={60}>Every 60 minutes</option>
                  </select>
                </div>
              )}
            </div>

            {/* Functional Quiet Hours */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Moon size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Quiet Hours</h3>
                    <p className="text-xs text-zinc-400">Silence daytime reminders completely</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={quietHoursEnabled} 
                  onChange={e => setQuietHoursEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500" 
                />
              </div>

              {quietHoursEnabled && (
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Silence From:</span>
                    <input 
                      type="time" 
                      value={quietStart} 
                      onChange={e => setQuietStart(e.target.value)} 
                      className="w-full bg-zinc-800 rounded-lg p-2 text-white border border-zinc-700" 
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Until Morning:</span>
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

        {/* TAB 4: MEDITATE (WITH CALMING AUDIO MODES) */}
        {activeTab === 'meditate' && (
          <div className="text-center py-6 space-y-6">
            <div className="w-36 h-36 mx-auto rounded-full border-2 border-emerald-500/30 flex items-center justify-center bg-emerald-500/5 shadow-lg">
              <span className="text-3xl font-light font-mono text-emerald-400">
                {Math.floor(meditationSeconds / 60).toString().padStart(2, '0')}:
                {(meditationSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Audio & Guided Session Selector */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left">
              <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Meditation Atmosphere
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'singing_bowl', label: 'Singing Bowl', icon: Bell },
                  { id: 'calm_drone', label: '432Hz Drone', icon: Music },
                  { id: 'guided_breath', label: 'Guided Breath', icon: Volume2 }
                ].map(opt => {
                  const Icon = opt.icon
                  const active = meditationMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isMeditating}
                      onClick={() => setMeditationMode(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-colors ${
                        active 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      } ${isMeditating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Icon size={16} />
                      <span className="text-[11px] font-medium">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <h2 className="text-base font-medium text-white">
                {meditationMode === 'singing_bowl' && 'Tibetan Singing Bowl Anchor'}
                {meditationMode === 'calm_drone' && 'Deep Grounding Drone (432Hz)'}
                {meditationMode === 'guided_breath' && 'Short Guided Breathwork'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                {meditationMode === 'singing_bowl' && 'Harmonic singing bowl chimes every 2 minutes to bring you back to awareness.'}
                {meditationMode === 'calm_drone' && 'A smooth low-frequency ambient tone designed for deep presence.'}
                {meditationMode === 'guided_breath' && 'Minimal vocal cues guiding your breath and posture release.'}
              </p>
            </div>

            <button
              onClick={() => isMeditating ? stopMeditation() : setIsMeditating(true)}
              className={`px-8 py-3 rounded-full font-medium text-sm inline-flex items-center gap-2 transition-colors ${
                isMeditating 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold'
              }`}
            >
              {isMeditating ? <><Square size={16} /> End & Log Sitting</> : <><Play size={16} /> Start Sitting</>}
            </button>
          </div>
        )}

        {/* TAB 5: SUMMARY & REFLECTION */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/20 border border-indigo-900/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="text-indigo-400" size={20} />
                <h2 className="font-medium text-sm text-white">{userDisplayName}'s Daily Reflection</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Summary for {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

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

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">{userDisplayName}'s Past 7 Days</h3>
              </div>
              <div className="space-y-2">
                {past7Days.map((day, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 text-xs last:border-0">
                    <span className="text-zinc-400 font-medium">{day.dateLabel}</span>
                    <div className="flex gap-4">
                      <span className="text-blue-400 font-medium">{day.water} ml</span>
                      <span className="text-purple-400">{day.scans} scans</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Today's Notes</h3>
              {todayLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No notes recorded today yet.</p>
              ) : (
                todayLogs.map(l => (
                  <div key={l.id} className="border-l-2 border-emerald-500 pl-3 py-1">
                    <p className="text-xs font-medium text-zinc-200">{l.title}</p>
                    {l.notes && <p className="text-xs text-zinc-400 mt-0.5">{l.notes}</p>}
                    <span className="text-[10px] text-zinc-500 block mt-1">{formatDateTime(l.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 px-4 py-2.5 flex justify-around items-center z-20">
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