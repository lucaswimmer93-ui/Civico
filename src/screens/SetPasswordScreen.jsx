import React, { useState } from 'react';

export default function SetPasswordScreen({ email, name, onSubmit, onBack }) {
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!password || !passwordRepeat) {
      setError('Bitte beide Passwortfelder ausfüllen.');
      return;
    }

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }

    if (password !== passwordRepeat) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await onSubmit(password);
      setSuccess('Passwort erfolgreich gespeichert. Du kannst dich jetzt einloggen.');
    } catch (submitError) {
      console.log('Set password failed:', submitError);
      setError(submitError?.message || 'Passwort konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #1A1208 0%, #2C2416 60%, #3D3020 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '48px 28px 24px', color: '#F4F0E8' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#8B7355',
            fontSize: 13,
            cursor: 'pointer',
            padding: '0 0 16px',
            fontFamily: 'inherit',
          }}
        >
          ← Zurück
        </button>
        <div style={{ fontSize: 40, fontWeight: 'bold', letterSpacing: 3 }}>
          Civico
        </div>
        <div style={{ fontSize: 13, color: '#8B7355', marginTop: 6 }}>
          Gemeindezugang aktivieren
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: '#F4F0E8',
          borderRadius: '28px 28px 0 0',
          padding: '28px 24px 40px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: '0 auto',
            background: '#FAF7F2',
            border: '1px solid #E0D8C8',
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔐</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#2C2416', marginBottom: 8 }}>
            Passwort festlegen
          </div>
          <div style={{ fontSize: 14, color: '#8B7355', lineHeight: 1.7, marginBottom: 22 }}>
            {name ? <div><strong>{name}</strong></div> : null}
            {email ? <div>{email}</div> : null}
            <div style={{ marginTop: 10 }}>
              Lege jetzt dein Passwort fest. Danach landest du direkt im Login.
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 8, letterSpacing: 0.5 }}>
              Neues Passwort
            </div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Mindestens 8 Zeichen"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid #D8CFBF',
                background: '#fff',
                fontFamily: 'inherit',
                fontSize: 14,
                color: '#2C2416',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 8, letterSpacing: 0.5 }}>
              Passwort wiederholen
            </div>
            <input
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              type="password"
              placeholder="Passwort wiederholen"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid #D8CFBF',
                background: '#fff',
                fontFamily: 'inherit',
                fontSize: 14,
                color: '#2C2416',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>

          {error && (
            <div
              style={{
                background: '#FBEAEA',
                color: '#A33A3A',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: '#EAF8EC',
                color: '#2C6B36',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {success}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 14,
              border: 'none',
              background: '#3A7D44',
              color: '#fff',
              fontSize: 15,
              fontWeight: 'bold',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Speichern...' : 'Passwort speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
