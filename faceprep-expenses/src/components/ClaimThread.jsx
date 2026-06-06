import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatDate } from '../lib/constants'
import { Send } from 'lucide-react'

export default function ClaimThread({ claimId }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { if (claimId) fetchMessages() }, [claimId])

  async function fetchMessages() {
    const { data } = await supabase
      .from('claim_messages')
      .select('*, profiles!claim_messages_sender_id_fkey(full_name, role)')
      .eq('claim_id', claimId)
      .order('created_at')
    setMessages(data ?? [])
  }

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await supabase.from('claim_messages').insert({
      claim_id: claimId,
      sender_id: profile.id,
      message: text.trim(),
    })
    setText('')
    fetchMessages()
    setSending(false)
  }

  return (
    <div>
      <div className="section-label">Clarification thread</div>
      <div className="message-thread" style={{ marginBottom: 12, maxHeight: 240, overflowY: 'auto', padding: 4 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No messages yet. Start the conversation below.
          </div>
        )}
        {messages.map(m => {
          const mine = m.sender_id === profile.id
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div className={`message-bubble ${mine ? 'mine' : 'theirs'}`}>{m.message}</div>
              <div className="message-meta" style={{ textAlign: mine ? 'right' : 'left' }}>
                {m.profiles?.full_name} · {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="inline-input"
          placeholder="Type a message…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={sending || !text.trim()}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
