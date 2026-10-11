import { useState } from 'react'

const MAX_NOTE = 500

// Suhbatni boshqa support xodimiga o'tkazish (POST /conversations/<id>/transfer/)
export default function TransferMenu({ agents, disabled, onOpen, onTransfer }) {
    const [open, setOpen] = useState(false)
    const [agentId, setAgentId] = useState('')
    const [note, setNote] = useState('')
    const [busy, setBusy] = useState(false)

    const toggle = () => {
        if (!open) onOpen?.()
        setOpen((v) => !v)
    }

    const submit = async () => {
        if (!agentId || busy) return
        setBusy(true)
        const ok = await onTransfer(agentId, note.trim())
        setBusy(false)
        if (ok) {
            setOpen(false)
            setAgentId('')
            setNote('')
        }
    }

    return (
        <div className="sp-transfer">
            <button
                type="button"
                className={`sp-btn sp-btn--ghost ${open ? 'is-on' : ''}`}
                disabled={disabled}
                onClick={toggle}
                aria-expanded={open}
            >
                O‘tkazish
            </button>

            {open && (
                <div className="sp-transfer__pop" role="dialog" aria-label="Boshqa xodimga o'tkazish">
                    <h4>Boshqa xodimga o‘tkazish</h4>

                    {agents.loading && <p className="sp-transfer__hint">Yuklanmoqda…</p>}
                    {agents.error && <p className="sp-transfer__hint sp-transfer__hint--err">{agents.error}</p>}
                    {!agents.loading && !agents.error && !agents.list.length && (
                        <p className="sp-transfer__hint">Boshqa faol xodim yo‘q.</p>
                    )}

                    <ul className="sp-transfer__list">
                        {agents.list.map((a) => (
                            <li key={a.id}>
                                <label className={`sp-transfer__agent ${String(a.id) === agentId ? 'is-on' : ''}`}>
                                    <input
                                        type="radio"
                                        name="transfer-agent"
                                        value={a.id}
                                        checked={String(a.id) === agentId}
                                        onChange={() => setAgentId(String(a.id))}
                                    />
                                    <span>{a.full_name || `Xodim #${a.id}`}</span>
                                    <small>{a.open_count} ta ochiq</small>
                                </label>
                            </li>
                        ))}
                    </ul>

                    <textarea
                        className="sp-transfer__note"
                        rows={2}
                        maxLength={MAX_NOTE}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Izoh (ixtiyoriy, faqat xodimlar ko‘radi)"
                    />

                    <div className="sp-transfer__foot">
                        <button type="button" className="sp-btn sp-btn--ghost" onClick={() => setOpen(false)}>
                            Bekor qilish
                        </button>
                        <button
                            type="button"
                            className="sp-btn sp-btn--solid"
                            disabled={!agentId || busy}
                            onClick={submit}
                        >
                            {busy ? 'O‘tkazilmoqda…' : 'O‘tkazish'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}