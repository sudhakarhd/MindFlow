import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { Auth } from './components/Auth'
import { playPourSound } from './utils/audio'
import { 
  Camera, Image as ImageIcon, Utensils, Footprints, MapPin, Sparkles, 
  Droplet, Bell, Play, Square, RefreshCw, Moon, BookOpen, Clock, Calendar,
  Activity, LogOut, Music, Volume2, Heart, MessageSquare, Menu, X, Receipt, Edit3, Check
} from 'lucide-react'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [currentView, setCurrentView] = useState<'wellness' | 'grocery'>('wellness')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'feed' | 'capture' | 'somatic' | 'meditate' | 'summary'>('feed')
  const [logs, setLogs] = useState<any[]>([])
  const [somaticLogs, setSomaticLogs] = useState<any[]>([])
  const [likes, setLikes] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'all' | 'mine'>('all')

  // Expanded Comment input state per log ID
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({})
  const [expandedCommentsLogId, setExpandedCommentsLogId] = useState<string | null>(null)

  // Capture Form State
  const [category, setCategory] = useState<'meal' | 'activity' | 'place' | 'note'>('meal')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Grocery & Budget State
  const [groceryBills, setGroceryBills] = useState<any[]>([])
  const [parsingReceipt, setParsingReceipt] = useState(false)
  const [groceryMode, setGroceryMode] = useState<'list' | 'manual' | 'share'>('list')
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [editBillData, setEditBillData] = useState<any>(null)
  const [globalSharedEmails, setGlobalSharedEmails] = useState<string[]>([])
  const [newShareEmailInput, setNewShareEmailInput] = useState('')

  // Manual Bill Form State
  const [manualStore, setManualStore] = useState('')
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualTotal, setManualTotal] = useState('')
  const [manualItemsText, setManualItemsText] = useState('')
  const [manualCategory, setManualCategory] = useState<'Produce' | 'Dairy' | 'Meat' | 'Pantry' | 'Household'>('Pantry')

  const receiptCameraRef = useRef<HTMLInputElement>(null)
  const receiptGalleryRef = useRef<HTMLInputElement>(null)

  // Reminders & Active Scheduling
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderFrequencyMin, setReminderFrequencyMin] = useState(45)

  // Meditation State & Audio Options
  const [meditationMode, setMeditationMode] = useState<'singing_bowl' | 'tone_512' | 'guided_breath'>('singing_bowl')
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

  // Fetch User Profile & All Profiles for sharing
  useEffect(() => {
    if (session?.user?.id) {
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
        if (data) setUserProfile(data)
      })
      supabase.from('user_profiles').select('*').then(({ data }) => {
        if (data) setAllProfiles(data)
      })
    }
  }, [session])

  useEffect(() => {
    if (session) {
      fetchLogs()
      fetchGroceryBills()
      setupSmartNotificationEngine()
    }
  }, [session, quietHoursEnabled, quietStart, quietEnd, reminderEnabled, reminderFrequencyMin])

  const userDisplayName = userProfile?.display_name || session?.user?.email?.split('@')[0] || 'User'
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

    const { data: lData } = await supabase.from('log_likes').select('*')
    if (lData) setLikes(lData)

    const { data: cData } = await supabase.from('log_comments').select('*').order('created_at', { ascending: true })
    if (cData) setComments(cData)
  }

  const fetchGroceryBills = async () => {
    const { data } = await supabase.from('grocery_bills').select('*').order('created_at', { ascending: false })
    if (data) {
      setGroceryBills(data)
      const allShared = new Set<string>()
      data.forEach(b => {
        if (Array.isArray(b.shared_with)) {
          b.shared_with.forEach((email: string) => allShared.add(email))
        }
      })
      setGlobalSharedEmails(Array.from(allShared))
    }
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

  // Soothing 128 Hz Harmonic Sub-Octave with 256 Hz Overtone & Lowpass Filter
  const startSoothingTone = () => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = ctx

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(240, ctx.currentTime)

      const masterGain = ctx.createGain()
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime)
      masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 3.0)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(128, ctx.currentTime)

      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(256, ctx.currentTime)
      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0.35, ctx.currentTime)

      osc1.connect(masterGain)
      osc2.connect(gain2)
      gain2.connect(masterGain)

      masterGain.connect(filter)
      filter.connect(ctx.destination)

      osc1.start()
      osc2.start()

      droneOscillatorRef.current = osc1
      droneGainRef.current = masterGain
    } catch (e) {
      console.error('Soothing tone error:', e)
    }
  }

  const stopToneOrDrone = () => {
    try {
      if (droneGainRef.current && audioContextRef.current) {
        droneGainRef.current.gain.linearRampToValueAtTime(0.001, audioContextRef.current.currentTime + 1.5)
        setTimeout(() => {
          droneOscillatorRef.current?.stop()
          droneOscillatorRef.current?.disconnect()
          droneOscillatorRef.current = null
          droneGainRef.current = null
        }, 1500)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Voice Prompt Generator for Guided Breath Focus (Soft Female Voice, Paced)
  const speakGuidance = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.82
      utterance.pitch = 1.05

      const voices = window.speechSynthesis.getVoices()
      const softFemale = voices.find(v => 
        v.name.includes('Google UK English Female') || 
        v.name.includes('Microsoft Zira') || 
        v.name.includes('Samantha') || 
        (v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
      )
      if (softFemale) utterance.voice = softFemale

      window.speechSynthesis.speak(utterance)
    }
  }

  const isInQuietHours = () => {
    if (!quietHoursEnabled) return false
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const [qStartH, qStartM] = quietStart.split(':').map(Number)
    const [qEndH, qEndM] = quietEnd.split(':').map(Number)
    const quietStartMin = qStartH * 60 + qStartM
    const quietEndMin = qEndH * 60 + qEndM

    return quietStartMin > quietEndMin 
      ? (currentMinutes >= quietStartMin || currentMinutes < quietEndMin)
      : (currentMinutes >= quietStartMin && currentMinutes < quietEndMin)
  }

  // Smart Engine: Persistent Timestamp Check via localStorage (No more modulo per-minute bug)
  const setupSmartNotificationEngine = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const checkReminder = () => {
      if (!reminderEnabled) return
      if (isInQuietHours()) return

      const lastNotifiedStr = localStorage.getItem('mindflow_last_notified_at')
      const nowMs = Date.now()
      const intervalMs = reminderFrequencyMin * 60 * 1000

      if (!lastNotifiedStr || (nowMs - Number(lastNotifiedStr)) >= intervalMs) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🌿 MindFlow: Gentle Awareness Break', { 
            body: 'Unclench your jaw, drink a sip of water, and take one deep conscious breath.' 
          })
          localStorage.setItem('mindflow_last_notified_at', nowMs.toString())
        }
      }
    }

    const intervalId = setInterval(checkReminder, 30000)

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && reminderEnabled && !isInQuietHours()) {
        const lastNotifiedStr = localStorage.getItem('mindflow_last_notified_at')
        const nowMs = Date.now()
        const intervalMs = reminderFrequencyMin * 60 * 1000

        if (!lastNotifiedStr || (nowMs - Number(lastNotifiedStr)) >= intervalMs) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🌿 MindFlow: Gentle Awareness Break', { 
              body: 'Unclench your jaw, drink a sip of water, and take one deep conscious breath.' 
            })
            localStorage.setItem('mindflow_last_notified_at', nowMs.toString())
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }

  const testNotification = async () => {
    if (!('Notification' in window)) {
      alert('Notifications not supported in this browser.')
      return
    }
    let perm = Notification.permission
    if (perm === 'default') {
      perm = await Notification.requestPermission()
    }
    if (perm === 'granted') {
      if (isInQuietHours()) {
        alert('Notice: Quiet hours are currently active, but test notification is firing anyway!')
      }
      new Notification('🌿 MindFlow Test Notification', {
        body: 'Notifications are working correctly and active on your device!'
      })
      localStorage.setItem('mindflow_last_notified_at', Date.now().toString())
      alert('Test notification sent!')
    } else {
      alert('Notification permission was denied.')
    }
  }

  // Meditation Timer Controller
  useEffect(() => {
    let timer: any
    if (isMeditating) {
      if (meditationMode === 'singing_bowl') playTibetanSingingBowl()
      if (meditationMode === 'tone_512') startSoothingTone()
      if (meditationMode === 'guided_breath') {
        playTibetanSingingBowl()
        speakGuidance("Breathe in from the nose... and breathe out through the mouth... and hold for 2 seconds... and inhale")
      }

      timer = setInterval(() => {
        setMeditationSeconds(prev => {
          const next = prev + 1
          if (meditationMode === 'singing_bowl' && next > 0 && next % 120 === 0) {
            playTibetanSingingBowl()
          }
          if (meditationMode === 'guided_breath') {
            if (next === 15) {
              speakGuidance("Notice the quiet space within your body and soften your shoulders.")
            } else if (next === 30) {
              speakGuidance("Breathe in calm... release all tension.")
            }
          }
          return next
        })
      }, 1000)
    } else {
      if (meditationMode === 'tone_512') stopToneOrDrone()
    }

    return () => {
      clearInterval(timer)
      if (meditationMode === 'tone_512') stopToneOrDrone()
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

  // Robust Likes & Comments using { log_id, user_id, author } and { log_id, user_id, author, content }
  const toggleLike = async (logId: string) => {
    try {
      const existing = likes.find(l => l.log_id === logId && l.user_id === currentUserId)
      if (existing) {
        const { error } = await supabase.from('log_likes').delete().eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('log_likes').insert([{ 
          log_id: logId, 
          user_id: currentUserId, 
          author: userDisplayName 
        }])
        if (error) throw error
      }
      await fetchLogs()
    } catch (err: any) {
      console.error('Like error:', err)
      alert('Failed to update like: ' + (err.message || err))
    }
  }

  const handleAddComment = async (logId: string) => {
    const content = commentInputs[logId]?.trim()
    if (!content) return
    try {
      const { error } = await supabase.from('log_comments').insert([{
        log_id: logId,
        user_id: currentUserId,
        author: userDisplayName,
        content
      }])
      if (error) throw error
      setCommentInputs({ ...commentInputs, [logId]: '' })
      await fetchLogs()
    } catch (err: any) {
      console.error('Comment error:', err)
      alert('Failed to post comment: ' + (err.message || err))
    }
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

  // Auto-Read Receipt, Edit & Manual Bill Entry
  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      await processReceiptImageFile(selected)
    }
  }

  const processReceiptImageFile = async (fileToUpload: File) => {
    setParsingReceipt(true)
    try {
      const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
      const fileName = `receipt-${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage
        .from('wellness-media')
        .upload(fileName, fileToUpload, { contentType: fileToUpload.type || 'image/jpeg', upsert: true })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('wellness-media').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: publicUrl })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Server error: ${response.status}`)
      }

      const jsonRes = await response.json()
      let parsed = {}
      try {
        let cleanText = jsonRes.response.trim()
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim()
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim()
        }
        parsed = JSON.parse(cleanText)
      } catch (err) {
        console.error('Failed to parse JSON from AI:', jsonRes.response)
        parsed = {
          store_name: 'Supermarket',
          receipt_date: new Date().toISOString().split('T')[0],
          total_amount: 0,
          items: [{ name: 'Scanned Items', price: 0, category: 'Pantry' }]
        }
      }

      const billObj = {
        user_id: currentUserId,
        owner_email: session?.user?.email,
        store_name: (parsed as any).store_name || 'Grocery Store',
        receipt_date: (parsed as any).receipt_date || new Date().toISOString().split('T')[0],
        total_amount: (parsed as any).total_amount || 0,
        items: (parsed as any).items || [],
        shared_with: globalSharedEmails,
        image_url: publicUrl
      }

      const { error: saveErr } = await supabase.from('grocery_bills').insert([billObj])
      if (saveErr) throw saveErr

      alert('Receipt automatically scanned and saved to grocery bills!')
      await fetchGroceryBills()
      setGroceryMode('list')
    } catch (err: any) {
      alert('Error parsing receipt: ' + (err.message || err))
    } finally {
      setParsingReceipt(false)
    }
  }

  const saveManualBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualStore || !manualTotal) return

    try {
      const itemsList = manualItemsText ? manualItemsText.split('\n').map(line => {
        const [name, price] = line.split(':').map(s => s.trim())
        return {
          name: name || 'Item',
          price: parseFloat(price) || 0,
          category: manualCategory
        }
      }) : [{ name: 'Manual Expense', price: parseFloat(manualTotal) || 0, category: manualCategory }]

      const { error } = await supabase.from('grocery_bills').insert([{
        user_id: currentUserId,
        owner_email: session?.user?.email,
        store_name: manualStore,
        receipt_date: manualDate,
        total_amount: parseFloat(manualTotal) || 0,
        items: itemsList,
        shared_with: globalSharedEmails,
        image_url: null
      }])

      if (error) throw error

      alert('Manual bill saved successfully!')
      setManualStore('')
      setManualTotal('')
      setManualItemsText('')
      setGroceryMode('list')
      await fetchGroceryBills()
    } catch (err: any) {
      alert('Error saving manual bill: ' + err.message)
    }
  }

  const updateExistingBill = async (billId: string) => {
    try {
      const { error } = await supabase.from('grocery_bills').update({
        store_name: editBillData.store_name,
        receipt_date: editBillData.receipt_date,
        total_amount: editBillData.total_amount,
        items: editBillData.items,
        shared_with: editBillData.shared_with
      }).eq('id', billId)

      if (error) throw error

      alert('Grocery bill updated successfully!')
      setEditingBillId(null)
      setEditBillData(null)
      await fetchGroceryBills()
    } catch (err: any) {
      alert('Error updating bill: ' + err.message)
    }
  }

  const toggleShareEmail = (email: string) => {
    if (globalSharedEmails.includes(email)) {
      setGlobalSharedEmails(globalSharedEmails.filter(e => e !== email))
    } else {
      setGlobalSharedEmails([...globalSharedEmails, email])
    }
  }

  const addCustomShareEmail = () => {
    const trimmed = newShareEmailInput.trim()
    if (trimmed && !globalSharedEmails.includes(trimmed)) {
      setGlobalSharedEmails([...globalSharedEmails, trimmed])
      setNewShareEmailInput('')
    }
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

  // Category Spend Totals for Grocery & Budget
  const categoryTotals: { [cat: string]: number } = { Produce: 0, Dairy: 0, Meat: 0, Pantry: 0, Household: 0 }
  groceryBills.forEach(bill => {
    if (Array.isArray(bill.items)) {
      bill.items.forEach((item: any) => {
        const cat = item.category || 'Pantry'
        if (categoryTotals[cat] !== undefined) {
          categoryTotals[cat] += Number(item.price || 0)
        } else {
          categoryTotals['Pantry'] += Number(item.price || 0)
        }
      })
    }
  })

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between pb-20 select-none relative">
      
      {/* Top Header with Hamburger Menu */}
      <header className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 text-zinc-300 hover:text-white bg-zinc-800/60 rounded-xl border border-zinc-700/50"
            title="Menu"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="font-semibold text-base tracking-tight text-white">
              {currentView === 'wellness' ? 'MindFlow' : 'Grocery & Budget'}
            </h1>
            <p className="text-[11px] text-zinc-400">User: <span className="text-emerald-400 font-medium">{userDisplayName}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {currentView === 'wellness' && (
            <button 
              onClick={() => setActiveTab('summary')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'summary' ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-white'}`}
              title="Daily Reflection"
            >
              <Moon size={18} />
            </button>
          )}
          <button onClick={() => { fetchLogs(); fetchGroceryBills(); }} className="p-2 text-zinc-400 hover:text-white" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button onClick={handleSignOut} className="p-2 text-zinc-400 hover:text-red-400" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Hamburger Menu Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex">
          <div className="w-72 bg-zinc-900 border-r border-zinc-800 p-5 flex flex-col justify-between h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-3">
                <div>
                  <h2 className="font-bold text-lg text-white">MindFlow Menu</h2>
                  <p className="text-xs text-zinc-400">{userDisplayName}</p>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-800"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="space-y-2">
                <button
                  onClick={() => { setCurrentView('wellness'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                    currentView === 'wellness' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Sparkles size={18} /> Daily Wellness
                </button>
                <button
                  onClick={() => { setCurrentView('grocery'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                    currentView === 'grocery' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Receipt size={18} /> Grocery & Budget
                </button>
              </nav>
            </div>

            <div className="border-t border-zinc-800 pt-4 text-xs text-zinc-500 text-center">
              MindFlow v2.5 • Shared Wellness & Budget
            </div>
          </div>

          <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-4 overflow-y-auto">
        
        {/* VIEW 1: DAILY WELLNESS */}
        {currentView === 'wellness' && (
          <>
            {/* TAB 1: FAMILY FEED / TIMELINE WITH LIKES & COMMENTS */}
            {activeTab === 'feed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Timeline Stream</span>
                  <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
                    <button 
                      onClick={() => setFeedFilter('all')}
                      className={`px-2.5 py-1 rounded ${feedFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}
                    >
                      Family Feed
                    </button>
                    <button 
                      onClick={() => setFeedFilter('mine')}
                      className={`px-2.5 py-1 rounded ${feedFilter === 'mine' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'}`}
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
                  displayedFeedLogs.map(log => {
                    const logLikes = likes.filter(l => l.log_id === log.id)
                    const hasLiked = logLikes.some(l => l.user_id === currentUserId)
                    const logComments = comments.filter(c => c.log_id === log.id)
                    const isCommentsExpanded = expandedCommentsLogId === log.id

                    return (
                      <div key={log.id} className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                        {log.image_url && (
                          <img 
                            src={log.image_url} 
                            alt={log.title} 
                            className="w-full h-56 object-cover bg-zinc-950 border-b border-zinc-800/80" 
                            loading="lazy"
                          />
                        )}
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between mb-1">
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
                          {log.notes && <p className="text-xs text-zinc-400 leading-relaxed">{log.notes}</p>}

                          {/* Likes & Comments Action Bar */}
                          <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/60 text-xs">
                            <button
                              onClick={() => toggleLike(log.id)}
                              className={`flex items-center gap-1.5 transition-colors ${hasLiked ? 'text-rose-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                              <Heart size={16} className={hasLiked ? 'fill-rose-400' : ''} />
                              <span>{logLikes.length}</span>
                            </button>

                            <button
                              onClick={() => setExpandedCommentsLogId(isCommentsExpanded ? null : log.id)}
                              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              <MessageSquare size={16} />
                              <span>{logComments.length} Comments</span>
                            </button>
                          </div>

                          {/* Expandable Comments Section */}
                          {isCommentsExpanded && (
                            <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800 space-y-2 mt-2">
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {logComments.length === 0 ? (
                                  <p className="text-[11px] text-zinc-500 italic">No comments yet. Leave a kind word!</p>
                                ) : (
                                  logComments.map(c => (
                                    <div key={c.id} className="text-xs border-b border-zinc-900 pb-1 last:border-0">
                                      <span className="font-semibold text-emerald-400 mr-2">{c.author || 'User'}:</span>
                                      <span className="text-zinc-300">{c.content}</span>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="flex gap-2 pt-1">
                                <input
                                  type="text"
                                  placeholder="Write a comment..."
                                  value={commentInputs[log.id] || ''}
                                  onChange={e => setCommentInputs({ ...commentInputs, [log.id]: e.target.value })}
                                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(log.id) }}
                                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                                <button
                                  onClick={() => handleAddComment(log.id)}
                                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded-lg text-xs"
                                >
                                  Post
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
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

            {/* TAB 3: WATER, SOMATIC & REMINDERS */}
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

                {/* Somatic Check-In with "Focus" */}
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
                    {['Relaxed & Grounded', 'Shoulder Tension', 'Chest Tightness', 'Restless Energy', 'Calm Breathing', 'Fatigued', 'Focus'].map(sens => (
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

                {/* Reminders: Extended Intervals & Test Notification */}
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
                    <div className="space-y-2">
                      <span className="block text-zinc-400 text-xs">Interval Frequency:</span>
                      <select 
                        value={reminderFrequencyMin}
                        onChange={e => setReminderFrequencyMin(Number(e.target.value))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value={30}>Every 30 minutes</option>
                        <option value={45}>Every 45 minutes</option>
                        <option value={60}>Every 60 minutes</option>
                        <option value={90}>Every 90 minutes</option>
                        <option value={120}>Every 120 minutes (2 hours)</option>
                        <option value={180}>Every 180 minutes (3 hours)</option>
                        <option value={360}>Every 360 minutes (6 hours)</option>
                      </select>
                    </div>
                  )}

                  <button
                    onClick={testNotification}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-medium text-emerald-400 transition-colors"
                  >
                    Test Notification Permission & Alert
                  </button>
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

            {/* TAB 4: MEDITATE (WITH SOOTHING 128Hz/256Hz TONE) */}
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
                      { id: 'tone_512', label: 'Soothing Tone', icon: Music },
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
                    {meditationMode === 'tone_512' && 'Soothing Sub-Octave Warm Tone (128Hz + 256Hz)'}
                    {meditationMode === 'guided_breath' && 'Soft Guided Breathwork'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    {meditationMode === 'singing_bowl' && 'Harmonic singing bowl chimes every 2 minutes to bring you back to awareness.'}
                    {meditationMode === 'tone_512' && 'Mellow 128Hz sub-octave and 256Hz overtone filtered through a gentle lowpass filter.'}
                    {meditationMode === 'guided_breath' && 'Soft female voice guiding your nose breathing, hold, and release.'}
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
          </>
        )}

        {/* VIEW 2: GROCERY & BUDGET */}
        {currentView === 'grocery' && (
          <div className="space-y-5">
            {/* Mode Sub-navigation: List vs Manual vs Share */}
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-medium">
              <button
                onClick={() => setGroceryMode('list')}
                className={`flex-1 py-2 rounded-lg transition-colors ${groceryMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
              >
                Bills & Spend ({groceryBills.length})
              </button>
              <button
                onClick={() => setGroceryMode('manual')}
                className={`flex-1 py-2 rounded-lg transition-colors ${groceryMode === 'manual' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
              >
                + Manual Bill
              </button>
              <button
                onClick={() => setGroceryMode('share')}
                className={`flex-1 py-2 rounded-lg transition-colors ${groceryMode === 'share' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
              >
                Share Settings
              </button>
            </div>

            {/* MODE 1: BILLS LIST & RECEIPT SCANNER */}
            {groceryMode === 'list' && (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <h2 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Receipt size={18} className="text-emerald-400" /> Auto-Scan Receipt
                  </h2>
                  <p className="text-xs text-zinc-400">Select or snap a photo. AI will instantly parse and save your bill.</p>

                  <input ref={receiptCameraRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptFile} className="hidden" />
                  <input ref={receiptGalleryRef} type="file" accept="image/*" onChange={handleReceiptFile} className="hidden" />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={parsingReceipt}
                      onClick={() => receiptCameraRef.current?.click()}
                      className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs flex items-center justify-center gap-2 text-zinc-300"
                    >
                      <Camera size={16} className="text-emerald-400" />
                      Snap Receipt
                    </button>
                    <button
                      type="button"
                      disabled={parsingReceipt}
                      onClick={() => receiptGalleryRef.current?.click()}
                      className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs flex items-center justify-center gap-2 text-zinc-300"
                    >
                      <ImageIcon size={16} className="text-blue-400" />
                      Upload Photo
                    </button>
                  </div>

                  {parsingReceipt && (
                    <div className="text-center py-4 text-xs text-indigo-400 animate-pulse font-medium">
                      🤖 Gemini Vision is analyzing receipt & auto-saving...
                    </div>
                  )}
                </div>

                {/* Category Spend Breakdown */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Category Spend Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(categoryTotals).map(([cat, total]) => (
                      <div key={cat} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-xs text-zinc-400 font-medium">{cat}</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">${total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Saved Bills List with Edit Option */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Saved Grocery Bills</h3>
                  {groceryBills.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No grocery bills recorded yet.</p>
                  ) : (
                    groceryBills.map(bill => {
                      const isEditing = editingBillId === bill.id
                      return (
                        <div key={bill.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                          {!isEditing ? (
                            <>
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-white text-sm">{bill.store_name}</span>
                                <span className="text-emerald-400 font-bold font-mono text-sm">${Number(bill.total_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-zinc-400">
                                <span>{bill.receipt_date}</span>
                                <button
                                  onClick={() => { setEditingBillId(bill.id); setEditBillData({ ...bill }); }}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                                >
                                  <Edit3 size={13} /> Edit Bill
                                </button>
                              </div>
                              {bill.shared_with && bill.shared_with.length > 0 && (
                                <div className="text-[10px] text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40">
                                  Shared with: {bill.shared_with.join(', ')}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-3 pt-1">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[10px] text-zinc-500 block">Store:</label>
                                  <input
                                    type="text"
                                    value={editBillData.store_name || ''}
                                    onChange={e => setEditBillData({ ...editBillData, store_name: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-500 block">Total ($):</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editBillData.total_amount || 0}
                                    onChange={e => setEditBillData({ ...editBillData, total_amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white"
                                  />
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => updateExistingBill(bill.id)}
                                  className="flex-1 py-1.5 bg-emerald-500 text-zinc-950 font-semibold rounded text-xs"
                                >
                                  Save Changes
                                </button>
                                <button
                                  onClick={() => { setEditingBillId(null); setEditBillData(null); }}
                                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* MODE 2: MANUAL BILL ENTRY */}
            {groceryMode === 'manual' && (
              <form onSubmit={saveManualBill} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-sm text-white">Manual Grocery Bill Entry</h2>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Store Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Trader Joe's, Costco"
                    value={manualStore}
                    onChange={e => setManualStore(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={e => setManualDate(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Total Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={manualTotal}
                      onChange={e => setManualTotal(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
                  <select
                    value={manualCategory}
                    onChange={e => setManualCategory(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Produce">Produce</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Meat">Meat</option>
                    <option value="Pantry">Pantry</option>
                    <option value="Household">Household</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Items (Format: Item Name: Price per line)</label>
                  <textarea
                    rows={3}
                    placeholder="Organic Milk: 4.99&#10;Avocados: 3.50"
                    value={manualItemsText}
                    onChange={e => setManualItemsText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-semibold text-zinc-950 rounded-xl text-xs transition-colors"
                >
                  Save Manual Bill
                </button>
              </form>
            )}

            {/* MODE 3: SHARE SETTINGS */}
            {groceryMode === 'share' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Receipt size={18} className="text-emerald-400" /> Share Budget & Bills
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Select registered family/friends or add custom email addresses to share bills with.</p>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Registered Users:</span>
                  {allProfiles.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No other registered user profiles found.</p>
                  ) : (
                    allProfiles.map(prof => {
                      const isShared = globalSharedEmails.includes(prof.email)
                      return (
                        <button
                          key={prof.id}
                          onClick={() => toggleShareEmail(prof.email)}
                          className={`w-full flex justify-between items-center p-3 rounded-xl border text-xs transition-colors ${
                            isShared 
                              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-medium' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white'
                          }`}
                        >
                          <span>{prof.display_name} ({prof.email})</span>
                          {isShared && <Check size={16} className="text-emerald-400" />}
                        </button>
                      )
                    })
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Add Custom Email:</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="family@domain.com"
                      value={newShareEmailInput}
                      onChange={e => setNewShareEmailInput(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={addCustomShareEmail}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded-xl text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {globalSharedEmails.length > 0 && (
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Currently Shared With ({globalSharedEmails.length}):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {globalSharedEmails.map(email => (
                        <span key={email} className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs">
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Tab Navigation (Only shown in Wellness view) */}
      {currentView === 'wellness' && (
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
      )}
    </div>
  )
}
