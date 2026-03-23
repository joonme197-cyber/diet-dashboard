import { useLang } from '../context/LanguageContext';

export default function LanguageToggle() {
  const { lang, toggleLang } = useLang();

  return (
    <button
      onClick={toggleLang}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '20px', border: 'none',
        cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 700,
        fontSize: '0.85rem', transition: 'all 0.2s',
        background: lang === 'ar' ? '#0d9488' : '#1e293b',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{lang === 'ar' ? '🇬🇧' : '🇰🇼'}</span>
      <span>{lang === 'ar' ? 'English' : 'عربي'}</span>
    </button>
  );
}
