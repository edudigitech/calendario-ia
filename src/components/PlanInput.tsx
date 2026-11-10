import { useState } from 'react'

const EXAMPLES = [
  'Mañana tengo clase de 8 a 14, gimnasio a las 18 y estudiar 2 horas por la noche',
  'Lunes reunión con el equipo a las 10, miércoles entrego el proyecto a las 23:59, viernes cena con amigos a las 21',
  'El 25 de octubre es el cumpleaños de Marta, todo el día',
]

interface Props {
  onSubmit: (text: string) => Promise<number>
  credits: number | null
  onBuy: () => void
}

export default function PlanInput({ onSubmit, credits, onBuy }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noCredits, setNoCredits] = useState(false)

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setNoCredits(false)
    try {
      await onSubmit(trimmed)
      setText('')
    } catch (e) {
      const code = (e as { code?: string }).code
      setNoCredits(code === 'sin_creditos')
      setError(e instanceof Error ? e.message : 'No se pudo interpretar el texto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2>Cuéntame tu planning</h2>
      <p className="panel-hint">
        Escríbelo como se lo dirías a alguien. La IA lo convierte en eventos.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej: mañana clase de 8 a 14, luego gimnasio a las 18..."
        rows={5}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
        }}
      />

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="example" onClick={() => setText(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="panel-error">{error}</p>}

      {noCredits ? (
        <button className="primary" onClick={onBuy}>
          Comprar más análisis
        </button>
      ) : (
        <button
          className="primary"
          onClick={submit}
          disabled={busy || text.trim().length === 0}
        >
          {busy ? 'Organizando…' : 'Organizar mi planning'}
        </button>
      )}

      <div className="credits-line">
        <span className="kbd-hint">Ctrl + Enter</span>
        <span className={credits === 0 ? 'credits-empty' : undefined}>
          {credits === null ? '…' : credits} análisis
        </span>
        <button type="button" className="link" onClick={onBuy}>
          Comprar
        </button>
      </div>
    </div>
  )
}
