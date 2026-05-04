import { useState } from 'react';
import { useLang } from '../LanguageContext';

// Category editor — supports flat (inventory) and grouped (expenses) shapes.
// Each item: { key, code, nameAr, nameEn }
// Backward-compat: items with only `label` are migrated to nameAr on first edit.
export default function CategoryManagerModal({ title, categories, groups, onSave, onClose }) {
  const { t, isAr } = useLang();

  const migrate = (item) => ({
    key:    item.key    || '',
    code:   item.code   || '',
    nameAr: item.nameAr || item.label || '',
    nameEn: item.nameEn || '',
  });

  const [items, setItems] = useState(() => {
    if (groups) {
      return groups.reduce((acc, g) => ({
        ...acc,
        [g]: (categories[g] || []).map(migrate),
      }), {});
    }
    return categories.map(migrate);
  });

  const slug = (label) =>
    label.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '_').slice(0, 30) || `cat_${Date.now()}`;

  const addItem = (group) => {
    const blank = { key: `new_${Date.now()}`, code: '', nameAr: '', nameEn: '' };
    if (group) {
      setItems(p => ({ ...p, [group]: [...p[group], blank] }));
    } else {
      setItems(p => [...p, blank]);
    }
  };

  const updField = (group, idx, field, value) => {
    if (group) {
      setItems(p => {
        const arr = [...p[group]];
        const item = { ...arr[idx], [field]: value };
        if (field === 'nameAr' && item.key.startsWith('new_')) {
          item.key = slug(value);
        }
        arr[idx] = item;
        return { ...p, [group]: arr };
      });
    } else {
      setItems(p => {
        const arr = [...p];
        const item = { ...arr[idx], [field]: value };
        if (field === 'nameAr' && item.key.startsWith('new_')) {
          item.key = slug(value);
        }
        arr[idx] = item;
        return arr;
      });
    }
  };

  const removeItem = (group, idx) => {
    if (group) setItems(p => ({ ...p, [group]: p[group].filter((_, i) => i !== idx) }));
    else setItems(p => p.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const clean = (list) => list.filter(i => i.nameAr.trim() || i.nameEn.trim());
    if (groups) {
      onSave(groups.reduce((acc, g) => ({ ...acc, [g]: clean(items[g]) }), {}));
    } else {
      onSave(clean(items));
    }
  };

  const renderList = (list, group) => (
    <div>
      {list.map((c, idx) => (
        <div key={idx} style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 1fr auto',
          gap: 6,
          marginBottom: 8,
          alignItems: 'center',
        }}>
          <input
            className="form-control"
            placeholder={isAr ? 'الكود' : 'Code'}
            value={c.code}
            onChange={e => updField(group, idx, 'code', e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '.82rem' }}
          />
          <input
            className="form-control"
            placeholder={isAr ? 'الاسم بالعربي *' : 'Arabic Name *'}
            value={c.nameAr}
            onChange={e => updField(group, idx, 'nameAr', e.target.value)}
            dir="rtl"
          />
          <input
            className="form-control"
            placeholder={isAr ? 'الاسم بالإنجليزي' : 'English Name'}
            value={c.nameEn}
            onChange={e => updField(group, idx, 'nameEn', e.target.value)}
            dir="ltr"
          />
          <button className="btn btn-danger btn-sm" onClick={() => removeItem(group, idx)}>×</button>
        </div>
      ))}
      {list.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 1fr auto',
          gap: 6,
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: '.72rem', color: '#94a3b8', textAlign: 'center' }}>{isAr ? 'الكود' : 'Code'}</div>
          <div style={{ fontSize: '.72rem', color: '#94a3b8', textAlign: 'center' }}>{isAr ? 'الاسم العربي' : 'Arabic Name'}</div>
          <div style={{ fontSize: '.72rem', color: '#94a3b8', textAlign: 'center' }}>{isAr ? 'الاسم الإنجليزي' : 'English Name'}</div>
          <div />
        </div>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => addItem(group)}>
        + {isAr ? t('addCategory') : t('addCategory')}
      </button>
    </div>
  );

  const groupLabel = (g) => {
    if (g === 'fixed') return isAr ? 'مصروفات ثابتة' : 'Fixed Expenses';
    if (g === 'variable') return isAr ? 'مصروفات متغيرة' : 'Variable Expenses';
    return g;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {groups ? groups.map(g => (
            <div key={g} style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12, color: '#0d9488' }}>{groupLabel(g)}</h4>
              {renderList(items[g], g)}
            </div>
          )) : renderList(items, null)}

          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 20 }}
            onClick={handleSave}
          >
            💾 {isAr ? t('saveChanges') : t('saveChanges')}
          </button>
          <div style={{ fontSize: '.78rem', color: '#94a3b8', marginTop: 10 }}>
            {isAr ? t('categoryDeleteNote') : t('categoryDeleteNote')}
          </div>
        </div>
      </div>
    </div>
  );
}
