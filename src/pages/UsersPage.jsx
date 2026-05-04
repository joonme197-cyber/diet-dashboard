import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth, ROLES } from '../AuthContext';
import { useLang } from '../LanguageContext';

const ALL_PERMISSIONS = [
  { group: 'العملاء', groupEn: 'Clients', perms: [
    { key: 'clients.view',   ar: 'عرض العملاء',    en: 'View Clients'   },
    { key: 'clients.add',    ar: 'إضافة عميل',     en: 'Add Client'     },
    { key: 'clients.edit',   ar: 'تعديل عميل',     en: 'Edit Client'    },
    { key: 'clients.delete', ar: 'حذف عميل',       en: 'Delete Client'  },
  ]},
  { group: 'الاشتراكات', groupEn: 'Subscriptions', perms: [
    { key: 'subscriptions.view',   ar: 'عرض الاشتراكات',  en: 'View Subscriptions'   },
    { key: 'subscriptions.add',    ar: 'إضافة اشتراك',    en: 'Add Subscription'     },
    { key: 'subscriptions.edit',   ar: 'تعديل اشتراك',    en: 'Edit Subscription'    },
    { key: 'subscriptions.delete', ar: 'حذف اشتراك',      en: 'Delete Subscription'  },
  ]},
  { group: 'الباقات', groupEn: 'Packages', perms: [
    { key: 'packages.view', ar: 'عرض الباقات',   en: 'View Packages' },
    { key: 'packages.edit', ar: 'تعديل الباقات', en: 'Edit Packages' },
  ]},
  { group: 'الوجبات والمنيو', groupEn: 'Meals & Menu', perms: [
    { key: 'meals.view',  ar: 'عرض الوجبات',     en: 'View Meals'    },
    { key: 'meals.edit',  ar: 'تعديل الوجبات',   en: 'Edit Meals'    },
    { key: 'menu.view',   ar: 'عرض المنيو',      en: 'View Menu'     },
    { key: 'menu.edit',   ar: 'تعديل المنيو',    en: 'Edit Menu'     },
    { key: 'labels.print',ar: 'طباعة الملصقات', en: 'Print Labels'  },
  ]},
  { group: 'التوصيل', groupEn: 'Delivery', perms: [
    { key: 'delivery.view',     ar: 'عرض التوصيل',     en: 'View Delivery'      },
    { key: 'delivery.edit',     ar: 'تعديل التوصيل',   en: 'Edit Delivery'      },
    { key: 'reports.delivery',  ar: 'تقارير التوصيل',  en: 'Delivery Reports'   },
  ]},
  { group: 'التقارير', groupEn: 'Reports', perms: [
    { key: 'reports.view',       ar: 'عرض التقارير',      en: 'View Reports'       },
    { key: 'reports.production', ar: 'تقارير الإنتاج',   en: 'Production Reports' },
    { key: 'reports.financial',  ar: 'التقارير المالية',  en: 'Financial Reports'  },
  ]},
  { group: 'النظام', groupEn: 'System', perms: [
    { key: 'auto.view',    ar: 'التشغيل التلقائي',  en: 'Auto Select'   },
    { key: 'users.manage', ar: 'إدارة المستخدمين', en: 'Manage Users'  },
  ]},
];

const EMPTY_FORM = { name: '', email: '', role: 'kitchen', isActive: true };
const ROLE_COLORS = {
  super_admin:{bg:'#ede9fe',color:'#7c3aed'}, manager:{bg:'#dbeafe',color:'#1d4ed8'},
  kitchen:{bg:'#dcfce7',color:'#16a34a'},     delivery:{bg:'#fff7ed',color:'#d97706'},
  accountant:{bg:'#f0fdfa',color:'#0d9488'},  viewer:{bg:'#f1f5f9',color:'#64748b'},
};

export default function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const { isAr } = useLang();
  const [users, setUsers]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [editUser, setEditUser]             = useState(null);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [password, setPassword]             = useState('');
  const [customPerms, setCustomPerms]       = useState([]);
  const [useCustom, setUseCustom]           = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState('');
  const [msgType, setMsgType]               = useState('success');

  const showMsg = (m, t='success') => { setMsg(m); setMsgType(t); setTimeout(()=>setMsg(''), 3000); };

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditUser(null); setForm(EMPTY_FORM); setPassword('');
    setCustomPerms([]); setUseCustom(false); setShowModal(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name:user.name||'', email:user.email||'', role:user.role||'kitchen', isActive:user.isActive!==false });
    setCustomPerms(user.customPermissions||[]);
    setUseCustom(!!(user.customPermissions?.length>0));
    setPassword(''); setShowModal(true);
  };

  const openPerms = (user) => {
    setEditUser(user);
    setCustomPerms(user.customPermissions?.length>0 ? user.customPermissions : (ROLES[user.role]?.permissions||[]));
    setUseCustom(true); setShowPermsModal(true);
  };

  const saveUser = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      const permsToSave = useCustom ? customPerms : [];
      if (editUser) {
        await updateDoc(doc(db,'users',editUser.id), { name:form.name, role:form.role, isActive:form.isActive, customPermissions:permsToSave, updatedAt:serverTimestamp() });
        showMsg(isAr?'✅ تم التعديل':'✅ Updated');
      } else {
        if (!password||password.length<6) { showMsg(isAr?'❌ الباسورد 6 أحرف على الأقل':'❌ Min 6 chars','error'); setSaving(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, form.email, password);
        await setDoc(doc(db,'users',cred.user.uid), { name:form.name, email:form.email, role:form.role, isActive:true, customPermissions:permsToSave, createdAt:serverTimestamp() });
        showMsg(isAr?'✅ تم إنشاء الحساب':'✅ Created');
      }
      setShowModal(false); await load();
    } catch(err) {
      showMsg('❌ '+(err.code==='auth/email-already-in-use'?(isAr?'الإيميل مستخدم':'Email in use'):err.message),'error');
    }
    setSaving(false);
  };

  const savePerms = async () => {
    if (!editUser) return;
    setSaving(true);
    await updateDoc(doc(db,'users',editUser.id), { customPermissions: useCustom?customPerms:[], updatedAt:serverTimestamp() });
    showMsg(isAr?'✅ تم حفظ الصلاحيات':'✅ Permissions saved');
    setShowPermsModal(false); setSaving(false); await load();
  };

  const togglePerm = (key) => setCustomPerms(p => p.includes(key)?p.filter(x=>x!==key):[...p,key]);

  const toggleGroup = (perms) => {
    const keys = perms.map(p=>p.key);
    const allOn = keys.every(k=>customPerms.includes(k));
    if (allOn) setCustomPerms(p=>p.filter(k=>!keys.includes(k)));
    else setCustomPerms(p=>[...new Set([...p,...keys])]);
  };

  const toggleActive = async (user) => {
    if (user.id===auth.currentUser?.uid) { showMsg(isAr?'❌ لا يمكن تعطيل حسابك':'❌ Cannot disable yourself','error'); return; }
    await updateDoc(doc(db,'users',user.id),{isActive:!user.isActive});
    setUsers(prev=>prev.map(u=>u.id===user.id?{...u,isActive:!u.isActive}:u));
  };

  const resetPassword = async (user) => {
    try { await sendPasswordResetEmail(auth,user.email); showMsg(isAr?`✅ تم إرسال رابط لـ ${user.email}`:`✅ Reset link sent`); }
    catch(err) { showMsg('❌ '+err.message,'error'); }
  };

  if (!isSuperAdmin) return (
    <div><div className="page-header"><h2>👥 {isAr?'إدارة المستخدمين':'Users'}</h2></div>
    <div className="page-body"><div className="card"><div className="empty-state"><div className="empty-icon">🔒</div><h3>{isAr?'غير مصرح':'Access Denied'}</h3></div></div></div></div>
  );

  return (
    <div>
      <div className="page-header">
        <div><h2>👥 {isAr?'إدارة المستخدمين':'Users Management'}</h2><div className="breadcrumb">{isAr?'الموظفون والصلاحيات':'Staff & Permissions'}</div></div>
        <button className="btn btn-primary" onClick={openAdd}>+ {isAr?'إضافة موظف':'Add Staff'}</button>
      </div>

      <div className="page-body">
        {msg && <div className={`alert ${msgType==='error'?'alert-error':'alert-success'} fade-in`}>{msg}</div>}

        <div className="card">
          <div className="table-wrapper">
            {loading ? <div className="loading"><div className="spinner"/></div>
            : users.length===0 ? <div className="empty-state"><div className="empty-icon">👥</div><h3>{isAr?'لا يوجد موظفون':'No staff'}</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>{isAr?'الاسم':'Name'}</th><th>{isAr?'الإيميل':'Email'}</th>
                  <th>{isAr?'الدور':'Role'}</th><th>{isAr?'الصلاحيات':'Permissions'}</th>
                  <th>{isAr?'الحالة':'Status'}</th><th>{isAr?'إجراءات':'Actions'}</th>
                </tr></thead>
                <tbody>
                  {users.map(user => {
                    const role=ROLES[user.role]; const rc=ROLE_COLORS[user.role]||{};
                    const hasCustom=user.customPermissions?.length>0;
                    const isMe=user.id===auth.currentUser?.uid;
                    return (
                      <tr key={user.id} style={{opacity:user.isActive===false?0.5:1}}>
                        <td><strong>{user.name}</strong>{isMe&&<span style={{fontSize:'0.7rem',color:'#0d9488',marginRight:'6px'}}> (أنت)</span>}</td>
                        <td style={{fontSize:'0.82rem',color:'#64748b'}}>{user.email}</td>
                        <td><span style={{background:rc.bg,color:rc.color,padding:'3px 10px',borderRadius:'999px',fontSize:'0.78rem',fontWeight:700}}>{isAr?role?.labelAr:role?.label}</span></td>
                        <td>
                          {hasCustom
                            ? <span style={{background:'#fef3c7',color:'#d97706',padding:'2px 8px',borderRadius:'6px',fontSize:'0.75rem',fontWeight:700}}>✏️ {user.customPermissions.length} {isAr?'مخصصة':'custom'}</span>
                            : <span style={{color:'#94a3b8',fontSize:'0.78rem'}}>{isAr?'من الدور':'From role'}</span>}
                        </td>
                        <td><span style={{background:user.isActive!==false?'#dcfce7':'#fee2e2',color:user.isActive!==false?'#16a34a':'#dc2626',padding:'3px 10px',borderRadius:'999px',fontSize:'0.78rem',fontWeight:700}}>{user.isActive!==false?(isAr?'نشط':'Active'):(isAr?'معطّل':'Disabled')}</span></td>
                        <td><div style={{display:'flex',gap:'6px'}}>
                          <button className="btn btn-outline btn-sm" onClick={()=>openEdit(user)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{color:'#7c3aed',border:'1px solid #ede9fe'}} onClick={()=>openPerms(user)} title={isAr?'الصلاحيات':'Permissions'}>🔐</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>resetPassword(user)}>🔑</button>
                          {!isMe&&<button className="btn btn-ghost btn-sm" onClick={()=>toggleActive(user)}>{user.isActive!==false?'🔴':'🟢'}</button>}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal إضافة/تعديل */}
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:'460px'}}>
            <div className="modal-header">
              <h3>{editUser?(isAr?'تعديل موظف':'Edit'):(isAr?'إضافة موظف':'Add Staff')}</h3>
              <button className="modal-close" onClick={()=>setShowModal(false)}>X</button>
            </div>
            <div className="modal-body"><div className="form-grid col-1">
              <div className="form-group"><label className="form-label">👤 {isAr?'الاسم':'Name'} *</label>
                <input className="form-control" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">📧 {isAr?'الإيميل':'Email'} *</label>
                <input className="form-control" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} disabled={!!editUser} /></div>
              {!editUser&&<div className="form-group"><label className="form-label">🔒 {isAr?'كلمة المرور':'Password'} *</label>
                <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={isAr?'6 أحرف على الأقل':'Min 6 chars'} /></div>}
              <div className="form-group"><label className="form-label">🎭 {isAr?'الدور':'Role'}</label>
                <select className="form-control" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
                  {Object.entries(ROLES).map(([k,r])=><option key={k} value={k}>{isAr?r.labelAr:r.label}</option>)}
                </select></div>
              {editUser&&<div className="form-group"><label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}}>
                <input type="checkbox" checked={form.isActive} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} style={{accentColor:'#0d9488',width:'16px',height:'16px'}} />
                <span style={{fontWeight:600,fontSize:'0.88rem'}}>{isAr?'الحساب نشط':'Active'}</span>
              </label></div>}
              <button className="btn btn-primary btn-full" onClick={saveUser} disabled={saving}>
                {saving?'...':`✅ ${isAr?(editUser?'حفظ':'إنشاء الحساب'):(editUser?'Save':'Create')}`}</button>
            </div></div>
          </div>
        </div>
      )}

      {/* Modal الصلاحيات */}
      {showPermsModal && editUser && (
        <div className="modal-overlay" onClick={()=>setShowPermsModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:'600px',maxHeight:'90vh',overflowY:'auto'}}>
            <div className="modal-header">
              <h3>🔐 {isAr?`صلاحيات ${editUser.name}`:`${editUser.name} Permissions`}</h3>
              <button className="modal-close" onClick={()=>setShowPermsModal(false)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
                {[{val:false,label:isAr?'من الدور':'From Role',desc:isAr?'يرث الصلاحيات تلقائياً':'Inherits automatically'},{val:true,label:isAr?'مخصصة':'Custom',desc:isAr?'تحديد يدوياً':'Set manually'}].map(opt=>(
                  <label key={String(opt.val)} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',flex:1,padding:'10px',borderRadius:'8px',border:`2px solid ${useCustom===opt.val?'#0d9488':'#e2e8f0'}`,background:useCustom===opt.val?'#f0fdfa':'white'}}>
                    <input type="radio" checked={useCustom===opt.val} onChange={()=>{setUseCustom(opt.val); if(opt.val&&customPerms.length===0) setCustomPerms(ROLES[editUser.role]?.permissions||[]);}} style={{accentColor:'#0d9488'}} />
                    <div><div style={{fontWeight:700,fontSize:'0.88rem'}}>{opt.label}</div><div style={{fontSize:'0.72rem',color:'#64748b'}}>{opt.desc}</div></div>
                  </label>
                ))}
              </div>

              {useCustom && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
                    <span style={{fontSize:'0.82rem',color:'#64748b'}}>{customPerms.length} {isAr?'صلاحية':'selected'}</span>
                    <div style={{display:'flex',gap:'8px'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setCustomPerms(ALL_PERMISSIONS.flatMap(g=>g.perms.map(p=>p.key)))}>{isAr?'تحديد الكل':'All'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setCustomPerms([])}>{isAr?'إلغاء الكل':'Clear'}</button>
                    </div>
                  </div>
                  {ALL_PERMISSIONS.map(group => {
                    const allOn = group.perms.every(p=>customPerms.includes(p.key));
                    return (
                      <div key={group.group} style={{marginBottom:'14px',border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden'}}>
                        <div style={{background:allOn?'#0d9488':'#f8fafc',color:allOn?'white':'#1e293b',padding:'9px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>toggleGroup(group.perms)}>
                          <span style={{fontWeight:700,fontSize:'0.88rem'}}>{isAr?group.group:group.groupEn}</span>
                          <span style={{fontSize:'0.72rem'}}>{allOn?(isAr?'إلغاء':'Deselect'):(isAr?'تحديد':'Select')} {isAr?'الكل':'All'}</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',padding:'8px'}}>
                          {group.perms.map(perm=>(
                            <label key={perm.key} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',padding:'7px 10px',borderRadius:'6px',background:customPerms.includes(perm.key)?'#f0fdfa':'white',border:`1px solid ${customPerms.includes(perm.key)?'#0d9488':'#e2e8f0'}`}}>
                              <input type="checkbox" checked={customPerms.includes(perm.key)} onChange={()=>togglePerm(perm.key)} style={{accentColor:'#0d9488',width:'15px',height:'15px'}} />
                              <span style={{fontSize:'0.82rem',fontWeight:customPerms.includes(perm.key)?700:400}}>{isAr?perm.ar:perm.en}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <button className="btn btn-primary btn-full" style={{marginTop:'16px'}} onClick={savePerms} disabled={saving}>
                {saving?'...':`✅ ${isAr?'حفظ الصلاحيات':'Save Permissions'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
