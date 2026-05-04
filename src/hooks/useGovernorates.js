import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

let _cache = null;

const normalize = (v) => String(v || '').trim().toLowerCase();

export const useGovernorates = () => {
  const [governorates, setGovernorates] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setGovernorates(_cache);
      setLoading(false);
      return;
    }

    getDocs(collection(db, 'governorates')).then(snap => {
      const data = snap.docs
        .map(d => {
          const raw = { id: d.id, ...d.data() };
          return {
            ...raw,
            name: raw.nameAr || raw.ar || raw.nameEn || raw.en || '',
            value: raw.nameAr || raw.ar || raw.id,
            label: raw.nameAr || raw.ar || raw.nameEn || raw.en || '',
            regions: (raw.regions || []).map((r, idx) => ({
              ...r,
              id: r.id || `${raw.id}_${idx}`,
              nameAr: r.nameAr || r.ar || '',
              nameEn: r.nameEn || r.en || '',
              ar: r.ar || r.nameAr || '',
              en: r.en || r.nameEn || '',
              name: r.nameAr || r.ar || r.nameEn || r.en || '',
              value: r.nameAr || r.ar || r.nameEn || r.en || '',
              label: r.nameAr || r.ar || r.nameEn || r.en || '',
              active: r.active !== false,
            })),
          };
        })
        .filter(g => g.active !== false)
        .sort((a, b) => (a.nameAr || '').localeCompare(b.nameAr || ''));

      _cache = data;
      setGovernorates(data);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, []);

  const getRegions = (govInput1, govInput2) => {
    const candidates = [
      govInput1, govInput2,
      govInput1?.id, govInput1?.value, govInput1?.label, govInput1?.nameAr, govInput1?.nameEn, govInput1?.name,
      govInput2?.id, govInput2?.value, govInput2?.label, govInput2?.nameAr, govInput2?.nameEn, govInput2?.name,
    ].map(normalize).filter(Boolean);

    const gov = governorates.find(g => {
      const pool = [g.id, g.nameAr, g.nameEn, g.value, g.label, g.name, g.ar, g.en].map(normalize);
      return candidates.some(c => pool.includes(c));
    });

    return (gov?.regions || [])
      .filter(r => r.active !== false)
      .map((r, idx) => ({
        id: r.id || `${gov?.id || 'gov'}_${idx}`, ...r,
        name: r.nameAr || r.ar || r.nameEn || r.en || '',
        value: r.nameAr || r.ar || r.nameEn || r.en || '',
        label: r.nameAr || r.ar || r.nameEn || r.en || '',
      }));
  };

  return { governorates, loading, getRegions };
};

export const clearGovernoratesCache = () => { _cache = null; };
