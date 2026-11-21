import type { Recommendation } from '../../../domain/types';
import { decideRecommendation } from '../../../data/repo';
import { Icon } from '../../components/Icon';
import { formatKg } from '../../../lib/format';
import { haptic } from '../../../telegram/tg';

const ACTION = {
  increase: { label: 'Увеличить вес', icon: 'up', cls: 'green' },
  keep: { label: 'Оставить вес', icon: 'equal', cls: '' },
  decrease: { label: 'Уменьшить вес', icon: 'down', cls: 'amber' },
} as const;

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const a = ACTION[rec.action];
  const change = rec.fromWeight !== null && rec.toWeight !== null && rec.fromWeight !== rec.toWeight;
  return (
    <div className="card tight">
      <div className="row between">
        <span className="bold ellipsis grow">{rec.exerciseName}</span>
        <span className={`chip ${a.cls}`}><Icon name={a.icon} size={13} stroke={2.5} /> {a.label}</span>
      </div>
      {change && (
        <div className="num mt-8" style={{ fontSize: 18, fontWeight: 700 }}>
          {formatKg(rec.fromWeight)} → {formatKg(rec.toWeight)} кг
        </div>
      )}
      <div className="small muted mt-8">{rec.reason}</div>
      {rec.decision === 'pending' ? (
        <div className="grid-2 mt-12">
          <button className="btn sm" onClick={() => { haptic.tap(); void decideRecommendation(rec.id, 'rejected'); }}>Оставить как было</button>
          <button className="btn sm primary" onClick={() => { haptic.success(); void decideRecommendation(rec.id, 'accepted'); }}>Принять</button>
        </div>
      ) : rec.action !== 'keep' && (
        <div className="tiny faint mt-8">
          {rec.decision === 'accepted' ? '✓ Принято — новый вес подставится в следующей тренировке' : 'Отклонено'}
        </div>
      )}
    </div>
  );
}
