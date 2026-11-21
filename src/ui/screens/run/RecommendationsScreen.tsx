import { useRecommendations } from '../../../data/repo';
import { Empty, Header } from '../../components/common';
import { RecommendationCard } from './RecommendationCard';
import { formatDate, toLocalDate } from '../../../lib/dates';

export function RecommendationsScreen() {
  const recs = useRecommendations();
  const pending = recs.filter((r) => r.decision === 'pending');
  const decided = recs.filter((r) => r.decision !== 'pending').slice(0, 100);

  return (
    <div className="screen">
      <Header title="Рекомендации" back />
      {!recs.length && <Empty icon="📈" title="Пока нет рекомендаций">Они появятся после первой завершённой тренировки.</Empty>}
      {pending.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>Ждут решения</div>
          <div className="stack">{pending.map((r) => <RecommendationCard key={r.id} rec={r} />)}</div>
        </>
      )}
      {decided.length > 0 && (
        <>
          <div className="section-title">История</div>
          <div className="stack">
            {decided.map((r) => (
              <div key={r.id}>
                <div className="tiny faint" style={{ margin: '0 4px 4px' }}>{formatDate(toLocalDate(r.createdAt), true)}</div>
                <RecommendationCard rec={r} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
