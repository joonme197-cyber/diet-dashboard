import{A as e,D as t,h as n,r,t as i,y as a}from"./jsx-runtime-DQoTZ5-T.js";import{n as o}from"./mealService-DF33ukNx.js";import{c as s,f as c}from"./subscriptionService-70CPLNXr.js";import{i as l}from"./clientService-Gs0jbGyv.js";import{o as u}from"./index-DoiFMvrJ.js";var d=e(t(),1),f=i(),p=[80,90,100,120,150,180,200],m=[{key:`افطار`,labelAr:`الفطور`,labelEn:`Breakfast`},{key:`غداء`,labelAr:`الغداء`,labelEn:`Lunch`},{key:`عشاء`,labelAr:`العشاء`,labelEn:`Dinner`},{key:`سناك`,labelAr:`السناك`,labelEn:`Snacks`}],h=e=>{if(!e)return``;let[t,n,r]=e.split(`-`);return`${r}/${n}/${t}`};function g(){let{isAr:e}=u(),[t,i]=(0,d.useState)(new Date().toISOString().split(`T`)[0]),[g,y]=(0,d.useState)([]),[b,x]=(0,d.useState)(!1),[S,C]=(0,d.useState)(!1),[w,T]=(0,d.useState)(0),E={title:e?`ملصقات الوجبات`:`Meal Labels`,subtitle:e?`مرتبة حسب تقرير التصنيع`:`Sorted by manufacturing batch`,dateLabel:e?`تاريخ الإنتاج`:`Production Date`,generate:e?`🏷️ إنشاء الملصقات`:`🏷️ Generate Labels`,generating:e?`جاري الإنشاء...`:`Generating...`,print:e?`🖨️ طباعة الملصقات`:`🖨️ Print Labels`,totalLabels:e?`ملصق إجمالي`:`total labels`,validFor:e?`صالح لمدة`:`valid for`,days:e?`أيام`:`days`,noData:e?`اختر التاريخ وأنشئ الملصقات`:`Select a date and generate labels`};return(0,f.jsxs)(`div`,{children:[(0,f.jsxs)(`div`,{className:`page-header no-print`,children:[(0,f.jsxs)(`div`,{children:[(0,f.jsxs)(`h2`,{children:[`🏷️ `,E.title]}),(0,f.jsx)(`div`,{className:`breadcrumb`,children:E.subtitle})]}),S&&g.length>0&&(0,f.jsxs)(`button`,{className:`btn btn-primary`,onClick:()=>window.print(),children:[E.print,` (`,g.length,`)`]})]}),(0,f.jsxs)(`div`,{className:`page-body no-print`,children:[(0,f.jsx)(`div`,{className:`card`,style:{marginBottom:`20px`},children:(0,f.jsxs)(`div`,{className:`card-body`,children:[(0,f.jsxs)(`div`,{style:{display:`flex`,gap:`16px`,alignItems:`flex-end`,flexWrap:`wrap`},children:[(0,f.jsxs)(`div`,{className:`form-group`,style:{marginBottom:0,flex:1,maxWidth:`240px`},children:[(0,f.jsxs)(`label`,{className:`form-label`,children:[`📅 `,E.dateLabel]}),(0,f.jsx)(`input`,{type:`date`,className:`form-control`,value:t,onChange:e=>{i(e.target.value),C(!1)}})]}),(0,f.jsx)(`button`,{className:`btn btn-primary`,onClick:async()=>{x(!0),C(!1);let[e,i,u]=await Promise.all([l(),s(),a(n(r,`clientDailyMeals`))]),d=u.docs.map(e=>({id:e.id,...e.data()})).filter(e=>e.date===t),f={};for(let n of e){let e=i.find(e=>e.clientId===n.id&&c(e)===`active`);if(!e||(e.frozenDays||[]).includes(t))continue;let r=Number(e?.protein||n.protein||100),a=Number(e?.carbs||n.carbs||100),o=p.reduce((e,t)=>Math.abs(t-r)<Math.abs(e-r)?t:e);f[n.id]={proteinWeight:r,carbsWeight:a,gramSize:o}}let h=new Set(Object.keys(f)),g={};for(let e of d){if(!h.has(e.clientId))continue;let t=f[e.clientId]||{proteinWeight:100,carbsWeight:100,gramSize:100},n=t.gramSize;for(let r of m){let i=e.meals?.[r.key]||[];for(let e of i){let i=o.find(t=>t.id===e.id),a=`${r.key}__${e.id}`;g[a]||(g[a]={id:e.id,sectionKey:r.key,titleAr:i?.mealTitle||e.title||e.id,titleEn:i?.mealTitleEn||e.title||e.id,protein:i?.protein||0,carbs:i?.carbs||0,fats:i?.fats||0,calories:i?.calories||0,grams:Object.fromEntries(p.map(e=>[e,0]))}),g[a].weightEntries||(g[a].weightEntries=[]),g[a].weightEntries.push({gramSize:n,proteinWeight:t.proteinWeight,carbsWeight:t.carbsWeight}),g[a].grams[n]=(g[a].grams[n]||0)+1}}}let _=[];for(let e of m){let n=Object.values(g).filter(t=>t.sectionKey===e.key);for(let r of n)for(let n of p){let i=r.grams[n]||0;if(i!==0)for(let a=0;a<i;a++)_.push({...r,gramSize:n,proteinWeight:r.weightEntries?.find(e=>e.gramSize===n)?.proteinWeight||n,carbsWeight:r.weightEntries?.find(e=>e.gramSize===n)?.carbsWeight||n,copyIndex:a+1,totalCopies:i,date:t,shelfLife:3,sectionKey2:e.key})}}y(_),T(_.length),C(!0),x(!1)},disabled:b,style:{padding:`10px 28px`},children:b?(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`div`,{className:`spinner`,style:{width:`16px`,height:`16px`,borderWidth:`2px`}}),`\xA0`,E.generating]}):E.generate})]}),S&&(0,f.jsxs)(`div`,{style:{display:`flex`,gap:`20px`,marginTop:`16px`,padding:`12px 16px`,background:`#f0fdfa`,borderRadius:`8px`,fontSize:`0.88rem`},children:[(0,f.jsxs)(`span`,{style:{color:`#0f766e`,fontWeight:700},children:[`📅 `,h(t)]}),(0,f.jsxs)(`span`,{style:{color:`#0d9488`,fontWeight:700},children:[`🏷️ `,g.length,` `,E.totalLabels]}),(0,f.jsxs)(`span`,{style:{color:`#16a34a`,fontWeight:700},children:[`⏳ `,3,` `,E.days]})]})]})}),S&&g.length>0&&(0,f.jsxs)(`div`,{className:`card`,children:[(0,f.jsxs)(`div`,{className:`card-header`,children:[(0,f.jsxs)(`h3`,{children:[`🏷️ `,e?`معاينة الملصقات`:`Labels Preview`]}),(0,f.jsxs)(`span`,{className:`badge badge-teal`,children:[g.length,` `,E.totalLabels]})]}),(0,f.jsx)(`div`,{className:`card-body`,children:(0,f.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fill, minmax(200px, 1fr))`,gap:`12px`},children:[g.slice(0,12).map((t,n)=>(0,f.jsx)(_,{label:t,isAr:e},n)),g.length>12&&(0,f.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`center`,border:`2px dashed #e2e8f0`,borderRadius:`8px`,color:`#94a3b8`,fontSize:`0.85rem`,fontWeight:600,minHeight:`120px`},children:[`+`,g.length-12,` `,e?`ملصق آخر`:`more labels`]})]})})]}),!S&&!b&&(0,f.jsx)(`div`,{className:`card`,children:(0,f.jsxs)(`div`,{className:`empty-state`,children:[(0,f.jsx)(`div`,{className:`empty-icon`,children:`🏷️`}),(0,f.jsx)(`h3`,{children:E.noData}),(0,f.jsx)(`p`,{children:e?`الملصقات ستُرتَّب تلقائياً حسب الوجبة والجرام`:`Labels will be auto-sorted by meal and gram size`})]})})]}),S&&g.length>0&&(0,f.jsxs)(`div`,{className:`print-only`,style:{display:`none`},children:[(0,f.jsx)(`style`,{children:`
            @media print {
              .print-only { display: block !important; }
              .no-print   { display: none  !important; }

              /* المقاس: عرض 40mm × ارتفاع 30mm — landscape يعني نكتب العرض أولاً */
              @page {
                size: 40mm 30mm;
                margin: 0;
              }

              html, body {
                width: 40mm;
                height: 30mm;
                margin: 0;
                padding: 0;
                background: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              /* كل ليبول يملأ الصفحة بالكامل */
              .label-card-print {
                width: 40mm;
                height: 30mm;
                box-sizing: border-box;
                padding: 2mm;
                page-break-after: always;
                break-after: page;
                overflow: hidden;
              }

              /* الإطار على wrapper داخلي عشان ما يتاكلش */
              .label-inner {
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                border: 1pt solid #000;
                border-radius: 1mm;
                padding: 1mm 1.5mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 0.5pt;
                font-family: Cairo, Arial, sans-serif;
                text-align: center;
                overflow: hidden;
              }

              .label-card-print:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }

              /* شيل أي margin أو padding من الـ wrapper */
              .labels-grid {
                margin: 0;
                padding: 0;
              }
            }
          `}),(0,f.jsx)(`div`,{className:`labels-grid`,children:g.map((t,n)=>(0,f.jsx)(v,{label:t,isAr:e},n))})]})]})}function _({label:e,isAr:t}){let n=t?e.titleAr:e.titleEn,r=t?m.find(t=>t.key===e.sectionKey)?.labelAr:m.find(t=>t.key===e.sectionKey)?.labelEn;return(0,f.jsxs)(`div`,{style:{border:`2px solid #1e293b`,borderRadius:`10px`,padding:`12px 14px`,textAlign:`center`,background:`white`,fontFamily:`'Cairo', Arial, sans-serif`,direction:t?`rtl`:`ltr`,position:`relative`},children:[(0,f.jsxs)(`div`,{style:{position:`absolute`,top:`6px`,right:`8px`,fontSize:`0.65rem`,color:`#94a3b8`,fontWeight:600},children:[e.copyIndex,`/`,e.totalCopies]}),(0,f.jsxs)(`div`,{style:{position:`absolute`,top:`6px`,left:`8px`,background:`#0d9488`,color:`white`,fontSize:`0.65rem`,fontWeight:700,padding:`2px 6px`,borderRadius:`999px`},children:[e.gramSize,`g`]}),(0,f.jsx)(`div`,{style:{fontSize:`0.65rem`,color:`#64748b`,fontWeight:600,marginTop:`16px`,marginBottom:`2px`},children:r}),(0,f.jsx)(`div`,{style:{fontSize:`0.82rem`,fontWeight:700,color:`#1e293b`,marginBottom:`6px`,lineHeight:1.3},children:n}),(0,f.jsxs)(`div`,{style:{fontSize:`1rem`,fontWeight:900,color:`#0f172a`,marginBottom:`4px`},children:[`P:`,e.proteinWeight,`g / C:`,e.carbsWeight,`g`]}),(0,f.jsxs)(`div`,{style:{fontSize:`0.7rem`,color:`#64748b`,marginBottom:`6px`},children:[`P:`,e.protein,` - C:`,e.carbs,` - F:`,e.fats,` - Cal:`,e.calories]}),(0,f.jsx)(`div`,{style:{fontSize:`0.72rem`,fontWeight:600,color:`#374151`,marginBottom:`4px`},children:h(e.date)}),(0,f.jsx)(`div`,{style:{fontSize:`0.75rem`,fontWeight:700,color:`#0d9488`},children:t?`صالح لمدة ${e.shelfLife} أيام`:`valid for ${e.shelfLife} days`})]})}function v({label:e,isAr:t}){let n=t?e.titleAr:e.titleEn;return(0,f.jsx)(`div`,{className:`label-card-print`,children:(0,f.jsxs)(`div`,{className:`label-inner`,style:{direction:t?`rtl`:`ltr`,fontFamily:t?`'Cairo', Arial, sans-serif`:`Arial, sans-serif`},children:[(0,f.jsx)(`div`,{style:{fontSize:`8pt`,fontWeight:800,color:`#0f172a`,lineHeight:1.2,textAlign:`center`,marginBottom:`1.5pt`},children:n}),(0,f.jsxs)(`div`,{style:{fontSize:`9pt`,fontWeight:900,color:`#0f172a`,letterSpacing:`0.3px`,marginBottom:`1pt`},children:[`P:`,e.proteinWeight,`g / C:`,e.carbsWeight,`g`]}),(0,f.jsxs)(`div`,{style:{fontSize:`6pt`,color:`#374151`,marginBottom:`1.5pt`},children:[`P:`,e.protein,` - C:`,e.carbs,` - F:`,e.fats,` - Cal:`,e.calories]}),(0,f.jsxs)(`div`,{style:{fontSize:`6.5pt`,fontWeight:700,color:`#1e293b`},children:[h(e.date),` \xA0|\xA0`,t?`صالح ${e.shelfLife} أيام`:`valid ${e.shelfLife} days`]})]})})}export{g as default};