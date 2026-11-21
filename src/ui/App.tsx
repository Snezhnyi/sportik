import { useEffect } from 'react';
import { NavProvider, useNav, type Route, type Tab } from './nav';
import { UiProvider } from './components/common';
import { Icon, type IconName } from './components/Icon';
import { useReady } from '../data/store';
import { useActiveWorkout, useProfile } from '../data/repo';
import { setClosingConfirmation } from '../telegram/tg';
import { useSyncStatus } from '../data/sync';
import { AccessDeniedScreen } from './screens/profile/AccessDeniedScreen';
import { HomeScreen } from './screens/home/HomeScreen';
import { WorkoutsScreen } from './screens/workouts/WorkoutsScreen';
import { WorkoutDetailScreen } from './screens/workouts/WorkoutDetailScreen';
import { ProgramsScreen } from './screens/programs/ProgramsScreen';
import { ProgramScreen } from './screens/programs/ProgramScreen';
import { DayEditorScreen } from './screens/programs/DayEditorScreen';
import { ImportScreen } from './screens/programs/ImportScreen';
import { LibraryScreen } from './screens/programs/LibraryScreen';
import { CalendarScreen } from './screens/calendar/CalendarScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { WeightsScreen } from './screens/profile/WeightsScreen';
import { OnboardingScreen } from './screens/profile/OnboardingScreen';
import { RunnerScreen } from './screens/run/RunnerScreen';
import { SummaryScreen } from './screens/run/SummaryScreen';
import { RecommendationsScreen } from './screens/run/RecommendationsScreen';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'workouts', label: 'Тренировки', icon: 'dumbbell' },
  { id: 'programs', label: 'Программы', icon: 'build' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar' },
  { id: 'stats', label: 'Статистика', icon: 'chart' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'program': return <ProgramScreen id={route.id} />;
    case 'day': return <DayEditorScreen programId={route.programId} blockId={route.blockId} dayId={route.dayId} />;
    case 'import': return <ImportScreen programId={route.programId} />;
    case 'library': return <LibraryScreen />;
    case 'run': return <RunnerScreen />;
    case 'summary': return <SummaryScreen id={route.id} />;
    case 'workout': return <WorkoutDetailScreen id={route.id} />;
    case 'weights': return <WeightsScreen />;
    case 'recommendations': return <RecommendationsScreen />;
  }
}

function TabView({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'home': return <HomeScreen />;
    case 'workouts': return <WorkoutsScreen />;
    case 'programs': return <ProgramsScreen />;
    case 'calendar': return <CalendarScreen />;
    case 'stats': return <StatsScreen />;
    case 'profile': return <ProfileScreen />;
  }
}

function Shell() {
  const nav = useNav();
  const ready = useReady();
  const profile = useProfile();
  const active = useActiveWorkout();
  const sync = useSyncStatus();
  const top = nav.stack[nav.stack.length - 1];
  const fullscreen = top?.name === 'run' || top?.name === 'summary';

  // Ask Telegram to confirm closing while a workout is running.
  useEffect(() => setClosingConfirmation(!!active), [active]);

  if (sync.state === 'forbidden') return <AccessDeniedScreen />;
  if (!ready) return <div className="screen center faint" style={{ paddingTop: 120 }}>Загрузка…</div>;
  if (!profile.onboarded) return <OnboardingScreen />;

  return (
    <div className="app">
      {top ? <RouteView key={nav.stack.length} route={top} /> : <TabView tab={nav.tab} />}
      {!fullscreen && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={nav.tab === t.id ? 'on' : ''} onClick={() => nav.setTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export function App() {
  return (
    <NavProvider>
      <UiProvider>
        <Shell />
      </UiProvider>
    </NavProvider>
  );
}
