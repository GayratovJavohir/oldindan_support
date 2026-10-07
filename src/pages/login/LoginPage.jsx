// src/pages/login/LoginPage.jsx
import { useState } from 'react'
import './login.css'

const EyeIcon = ({ off }) =>
    off ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-3.17 4.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
        </svg>
    ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )

const MailIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
)

const LockIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="3" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
)

export default function LoginPage({ onLoginSuccess }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [capsOn, setCapsOn] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [shake, setShake] = useState(0)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (loading) return
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/accounts/support/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            })

            let data = null
            try {
                data = await res.json()
            } catch {
                data = null
            }

            if (!res.ok) {
                throw new Error(
                    data?.detail ||
                    data?.non_field_errors?.[0] ||
                    data?.error ||
                    data?.message ||
                    'Email yoki parol noto‘g‘ri',
                )
            }

            const access = data?.access || data?.access_token || data?.token
            if (!access) throw new Error('Serverdan token kelmadi')

            localStorage.setItem('access_token', access)
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh)

            onLoginSuccess()
        } catch (err) {
            setError(err.message || 'Kirishda xatolik yuz berdi')
            setShake((n) => n + 1)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="lg">
            <div className="lg-glow lg-glow--a" />
            <div className="lg-glow lg-glow--b" />
            <div className="lg-grid" />

            <form
                key={shake}
                className={`lg-card ${shake ? 'is-shake' : ''}`}
                onSubmit={handleSubmit}
                noValidate={false}
            >
                <div className="lg-brand">
                    <span className="lg-brand__mark">O</span>
                    <span className="lg-brand__word">
                        oldindan<small>admin</small>
                    </span>
                </div>

                <div className="lg-head">
                    <h1>Xush kelibsiz</h1>
                    <p>Support paneliga kirish uchun ma’lumotlaringizni kiriting</p>
                </div>

                {error && (
                    <div className="lg-error" role="alert">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v5M12 16.5v.01" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <label className="lg-field">
                    <span className="lg-label">Email manzil</span>
                    <span className="lg-input">
                        <i><MailIcon /></i>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            autoComplete="username"
                            autoFocus
                            required
                        />
                    </span>
                </label>

                <label className="lg-field">
                    <span className="lg-label">Parol</span>
                    <span className="lg-input">
                        <i><LockIcon /></i>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                            onBlur={() => setCapsOn(false)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                        />
                        <button
                            type="button"
                            className="lg-eye"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                            aria-pressed={showPassword}
                            title={showPassword ? 'Yashirish' : 'Ko‘rsatish'}
                        >
                            <EyeIcon off={showPassword} />
                        </button>
                    </span>
                    {capsOn && <span className="lg-caps">Caps Lock yoqilgan</span>}
                </label>

                <button className="lg-submit" type="submit" disabled={loading || !email || !password}>
                    {loading ? (
                        <>
                            <span className="lg-spin" /> Kirilmoqda…
                        </>
                    ) : (
                        <>
                            Kirish
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                        </>
                    )}
                </button>

                <p className="lg-foot">Faqat vakolatli support xodimlari uchun</p>
            </form>
        </div>
    )
}