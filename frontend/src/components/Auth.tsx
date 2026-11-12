import React, { useState } from 'react'
import { supabase } from '../supabase'

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          const { error: profileError } = await supabase.from('user_profiles').upsert([{
            id: data.user.id,
            email: email,
            display_name: displayName.trim() || email.split('@')[0]
          }])
          if (profileError) {
            console.error('Error creating profile:', profileError)
          }
        }
        alert('Check your email for the confirmation link to activate your account!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl text-zinc-100">
      <h2 className="text-xl font-semibold text-emerald-400 text-center mb-1">
        {isSignUp ? 'Create MindFlow Account' : 'Sign In'}
      </h2>
      <p className="text-xs text-zinc-400 text-center mb-6">
        {isSignUp ? 'First time here? Set up your account' : 'Welcome back to your mindful space'}
      </p>

      <form onSubmit={handleAuth} className="space-y-4">
        {isSignUp && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
            <input
              type="text"
              placeholder="Your Name (e.g., Alex)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required={isSignUp}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
          <input
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {errorMsg && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 font-semibold text-zinc-950 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {isSignUp ? 'Already registered? Sign In' : 'First time user? Sign Up'}
        </button>
      </div>
    </div>
  )
}
