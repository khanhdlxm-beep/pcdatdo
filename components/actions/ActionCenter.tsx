'use client';

import { useMemo, useState } from 'react';
import type { ActionItem, ActionStatus } from '@/types/intelligence';
import { actionOriginLabel, actionPriorityLabel, actionStatusLabel } from '@/lib/action-engine';

const filters: { id:'all'|ActionStatus; label:string }[] = [
  {id:'all',label:'Tất cả'}, {id:'new',label:'Mới'}, {id:'doing',label:'Đang làm'}, {id:'overdue',label:'Quá hạn'}, {id:'done',label:'Hoàn thành'},
];

export default function ActionCenter({ actions, updateAction, openAction }: {
  actions: ActionItem[];
  updateAction: (id:string, patch:Partial<ActionItem>)=>void;
  openAction: (id:string)=>void;
}) {
  const [filter,setFilter]=useState<'all'|ActionStatus>('all');
  const summary=useMemo(()=>({
    new:actions.filter((a)=>a.status==='new').length,
    doing:actions.filter((a)=>a.status==='doing').length,
    overdue:actions.filter((a)=>a.status==='overdue').length,
    done:actions.filter((a)=>a.status==='done').length,
  }),[actions]);
  const visible=useMemo(()=>actions.filter((a)=>filter==='all'||a.status===filter).sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')||a.progress-b.progress),[actions,filter]);
  return <>
    <div className="pageTitle"><div><small>Điều hành</small><h2>Hành động & gợi ý</h2></div><span>{actions.length} việc</span></div>
    <section className="actionSummary">
      <span><b>{summary.new}</b><small>Mới</small></span><span className="doing"><b>{summary.doing}</b><small>Đang làm</small></span><span className="danger"><b>{summary.overdue}</b><small>Quá hạn</small></span><span className="success"><b>{summary.done}</b><small>Hoàn thành</small></span>
    </section>
    <div className="pillTabs actionFilters">{filters.map((item)=><button key={item.id} className={filter===item.id?'active':''} onClick={()=>setFilter(item.id)}>{item.label}</button>)}</div>
    <section className="actionList">
      {visible.map((action)=><article className={`actionCard ${action.status} priority-${action.priority}`} key={action.id}>
        <button className="actionMain" onClick={()=>openAction(action.id)}>
          <div className="actionTop"><span className={`actionPriority ${action.priority}`}>{actionPriorityLabel(action.priority)}</span><small>{action.owner}</small></div>
          <b>{action.title}</b>
          <small className="actionSource">{actionOriginLabel(action)}{action.sourceKpiLabel ? ` · KPI: ${action.sourceKpiLabel}` : ''}</small>
          {action.progressConfirmed ? (
            <div className="actionProgress"><i style={{width:`${Math.max(0,Math.min(100,action.progress))}%`}}/><span>{action.progress}%</span></div>
          ) : (
            <div className="actionProgress unconfirmed"><i style={{width:'0%'}}/><span>Chưa xác nhận tiến độ</span></div>
          )}
          <div className="actionMeta"><span>{actionStatusLabel(action.status)}</span><span>{action.dueDateConfirmed && action.dueDate ? `Hạn ${action.dueDate}` : 'Chưa có hạn chính thức'}</span></div>
        </button>
        <div className="actionQuick">
          {action.status!=='done'&&<button onClick={()=>updateAction(action.id,{status:'doing',progress:50,progressConfirmed:true})}>Đang làm</button>}
          {action.status!=='done'&&<button className="done" onClick={()=>updateAction(action.id,{status:'done',progress:100,progressConfirmed:true})}>✓ Xong</button>}
        </div>
      </article>)}
      {!visible.length&&<div className="emptyState">Không có hành động ở trạng thái này.</div>}
    </section>
  </>;
}
