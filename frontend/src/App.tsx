import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { 
  Camera, Image as ImageIcon, Utensils, Footprints, MapPin, Sparkles, 
  Droplet, Bell, Play, Square, RefreshCw, Moon, BookOpen, Clock, Calendar,
  Activity, Plus
} from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'capture' | 'somatic' | 'meditate' | 'summary'>('feed')
  const [logs, setLogs] = useState<any[]>([])
  const [somaticLogs, setSomaticLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Lightweight Dynamic Profile System
  const [profiles, setProfiles] = useState<string[]>(() => {
    const saved = localStorage.getItem('mindflow_profiles')
    return saved ? JSON.parse(saved) : ['Sudhakar', 'Spouse']
  })
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem('mindflow_active_user') || 'Sudhakar'
  })
  const [feedFilter, setFeedFilter] = useState<'all' | 'mine'>('all')
  const [isAddingProfile, setIsAddingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')

  // Capture Form State
  const [category, setCategory] = useState<'meal' | 'activity' | 'place' | 'note'>('meal')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Quiet Hours & Work Hours Reminders
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [workHoursEnabled, setWorkHoursEnabled] = useState(true)
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')

  // Meditation State
  const [isMeditating, setIsMeditating] = useState(false)
  const [meditationSeconds, setMeditationSeconds] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    fetchLogs()
    setupPeriodicReminders()
  }, [])

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

  // Profile Management Handlers
  const handleSelectUser = (name: string) => {
    setCurrentUser(name)
    localStorage.setItem('mindflow_active_user', name)
  }

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newProfileName.trim()
    if (trimmed && !profiles.includes(trimmed)) {
      const updated = [...profiles, trimmed]
      setProfiles(updated)
      localStorage.setItem('mindflow_profiles', JSON.stringify(updated))
      handleSelectUser(trimmed)
      setNewProfileName('')
      setIsAddingProfile(false)
    }
  }

  // Web Audio: Tibetan Singing Bowl Sound
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

  // Web Audio: Water Pouring Effect
  const playWaterPourSound = () => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = ctx

      const bufferSize = ctx.sampleRate * 2.5
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      let b0 = 0, b1 = 0, b2 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99 * b0 + white * 0.05
        b1 = 0.95 * b1 + white * 0.11
        b2 = 0.85 * b2 + white * 0.25
        output[i] = (b0 + b1 + b2) * 0.15
      }

      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(600, ctx.currentTime)
      filter.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 2.2)
      filter.Q.setValueAtTime(3.0, ctx.currentTime)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.3)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5)

      noiseSource.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      noiseSource.start()
      noiseSource.stop(ctx.currentTime + 2.5)
    } catch (e) {
      console.error('Water audio error:', e)
    }
  }

  // Periodic Reminders: Water & Posture Check
  const setupPeriodicReminders = () => {
    const checkReminder = () => {
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

      if (workHoursEnabled) {
        const [wStartH, wStartM] = workStart.split(':').map(Number)
        const [wEndH, wEndM] = workEnd.split(':').map(Number)
        const inWorkHours = currentMinutes >= (wStartH * 60 + wStartM) && currentMinutes <= (wEndH * 60 + wEndM)
        if (inWorkHours && now.getMinutes() === 0) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🧘 MindFlow: Stand Up & Unwind', { body: 'Step away from your chair, roll your shoulders, and breathe.' })
          }
        }
      }
    }

    const interval = setInterval(checkReminder, 60000)
    return () => clearInterval(interval)
  }

  // Meditation Interval Tracker
  useEffect(() => {
    let timer: any
    if (isMeditating) {
      playTibetanSingingBowl()
      timer = setInterval(() => {
        setMeditationSeconds(prev => {
          const next = prev + 1
          if (next > 0 && next % 120 === 0) {
            playTibetanSingingBowl()
          }
          return next
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isMeditating])

  const stopMeditation = async () => {
    setIsMeditating(false)
    const minutes = Math.max(1, Math.round(meditationSeconds / 60))

    if (meditationSeconds >= 30) {
      await supabase.from('wellness_logs').insert([{
        category: 'meditation',
        title: `Mindfulness Sitting (${minutes} min)`,
        notes: `Anchored sitting session with 2-minute interval bell.`,
        duration_minutes: minutes,
        author: currentUser,
        is_shared: true
      }])
      await fetchLogs()
      alert(`Meditation logged: ${minutes} min!`)
    }
    setMeditationSeconds(0)
  }

  // Handle Photo Picker
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
      author: currentUser,
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
      author: currentUser 
    }])
    await supabase.from('wellness_logs').insert([{
      category: 'somatic',
      title: `Somatic Check-In: ${sensation}`,
      notes: `Body scan registered without labeling.`,
      author: currentUser,
      is_shared: true
    }])
    await fetchLogs()
    alert(`Logged: "${sensation}"`)
  }

  const logWater = async (amount = 250) => {
    playWaterPourSound()
    await supabase.from('somatic_checkins').insert([{ 
      type: 'water', 
      water_amount_ml: amount,
      author: currentUser 
    }])
    await fetchLogs()
  }

  // Date Filtering Helpers (Local Calendar Days)
  const isSameLocalDate = (dateA: Date, dateB: Date) => {
    return dateA.getFullYear() === dateB.getFullYear() &&
           dateA.getMonth() === dateB.getMonth() &&
           dateA.getDate() === dateB.getDate()
  }

  const now = new Date()
  const todayLogs = logs.filter(l => isSameLocalDate(new Date(l.created_at), now) && l.author === currentUser)
  const todayWaterLogs = somaticLogs.filter(s => s.type === 'water' && isSameLocalDate(new Date(s.created_at), now) && s.author === currentUser)
  const todayWaterTotal = todayWaterLogs.reduce((sum, item) => sum + (item.water_amount_ml || 250), 0)
  const todayCheckins = somaticLogs.filter(s => s.type === 'body_scan' && isSameLocalDate(new Date(s.created_at), now) && s.author === currentUser)

  // Filter Timeline Logs
  const displayedFeedLogs = logs.filter(l => {
    if (feedFilter === 'mine') return l.author === currentUser
    return true
  })

  // Past 7 Days Table for Current Profile
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - i)

    const dayWater = somaticLogs
      .filter(s => s.type === 'water' && isSameLocalDate(new Date(s.created_at), targetDate) && s.author === currentUser)
      .reduce((sum, item) => sum + (item.water_amount_ml || 250), 0)

    const dayScans = somaticLogs
      .filter(s => s.type === 'body_scan' && isSameLocalDate(new Date(s.created_at), targetDate) && s.author === currentUser).length

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
            <p className="text-[11px] text-zinc-400">Daily wellness & reflection</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'summary' ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-white'}`}
              title="Daily Reflection"
            >
              <Moon size={18} />
            </button>
            <button onClick={fetchLogs} className="p-2 text-zinc-400 hover:text-white">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Profile Selector Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mr-1">User:</span>
          {profiles.map(name => (
            <button
              key={name}
              onClick={() => handleSelectUser(name)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                currentUser === name
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => setIsAddingProfile(true)}
            className="p-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
            title="Add Person"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Modal/Input to Add New Profile */}
        {isAddingProfile && (
          <form onSubmit={handleAddProfile} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Enter name..."
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <button type="submit" className="px-3 py-1 bg-emerald-500 text-zinc-950 font-semibold rounded-lg text-xs">
              Add
            </button>
            <button 
              type="button" 
              onClick={() => setIsAddingProfile(false)}
              className="px-2 py-1 text-zinc-400 text-xs hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 overflow-y-auto">
        
        {/* TAB 1: FEED / TIMELINE */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Timeline Stream</span>
              <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
                <button 
                  onClick={() => setFeedFilter('all')}
                  className={`px-2 py-0.5 rounded ${feedFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}
                >
                  Family Feed
                </button>
                <button 
                  onClick={() => setFeedFilter('mine')}
                  className={`px-2 py-0.5 rounded ${feedFilter === 'mine' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}
                >
                  {currentUser}'s Only
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
                        <span className="text-xs text-zinc-500">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium">by {log.author || 'Family'}</span>
                    </div>
                    <h3 className="font-medium text-zinc-100 text-sm leading-snug">{log.title}</h3>
                    {log.notes && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{log.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: CAPTURE (CAMERA OR GALLERY) */}
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

            {/* Photo Selection */}
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
              {loading ? 'Uploading & Saving...' : `Save Entry as ${currentUser}`}
            </button>
          </form>
        )}

        {/* TAB 3: WATER & SOMATIC */}
        {activeTab === 'somatic' && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Droplet size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">{currentUser}'s Hydration</h3>
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

            {/* Work & Desk Stretch Reminders */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Stand Up & Desk Reminders</h3>
                    <p className="text-xs text-zinc-400">Hourly alerts to leave chair & stretch</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={workHoursEnabled} 
                  onChange={e => setWorkHoursEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500" 
                />
              </div>
              {workHoursEnabled && (
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Work Start:</span>
                    <input 
                      type="time" 
                      value={workStart} 
                      onChange={e => setWorkStart(e.target.value)} 
                      className="w-full bg-zinc-800 rounded-lg p-2 text-white border border-zinc-700" 
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Work End:</span>
                    <input 
                      type="time" 
                      value={workEnd} 
                      onChange={e => setWorkEnd(e.target.value)} 
                      className="w-full bg-zinc-800 rounded-lg p-2 text-white border border-zinc-700" 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quiet Hours */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Moon size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-white">Quiet Hours</h3>
                    <p className="text-xs text-zinc-400">Silence all notifications at night</p>
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
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <div className="flex-1">
                    <span className="block text-zinc-500 mb-1">Quiet From:</span>
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
            <div className="w-36 h-36 mx-auto rounded-full border-2 border-emerald-500/30 flex items-center justify-center bg-emerald-500/5 shadow-lg">
              <span className="text-3xl font-light font-mono text-emerald-400">
                {Math.floor(meditationSeconds / 60).toString().padStart(2, '0')}:
                {(meditationSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-medium text-white">Tibetan Singing Bowl Anchor</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                A subtle, harmonic singing bowl chimes every 2 minutes. When you hear it, gently bring awareness back to body & breath.
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

        {/* TAB 5: NIGHTLY SUMMARY & REFLECTION */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/20 border border-indigo-900/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="text-indigo-400" size={20} />
                <h2 className="font-medium text-sm text-white">{currentUser}'s Daily Reflection</h2>
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
                <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">{currentUser}'s Past 7 Days</h3>
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