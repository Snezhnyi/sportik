import { useState } from 'react';
import { addWeight, DEFAULT_PROFILE, saveProfile } from '../../../data/repo';
import { ProfileForm } from './ProfileForm';
import { telegramUserName, haptic } from '../../../telegram/tg';
import { toLocalDate } from '../../../lib/dates';

export function OnboardingScreen() {
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE, name: telegramUserName() });
  const [weight, setWeight] = useState<number | null>(null);

  const finish = async () => {
    if (weight) await addWeight(toLocalDate(), weight);
    await saveProfile({ ...profile, onboarded: true });
    haptic.success();
  };

  return (
    <div className="screen no-tabbar">
      <div className="hero" style={{ marginBottom: 20 }}>
        <div className="chip accent">Добро пожаловать</div>
        <h2 className="mt-12">Расскажите о себе</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Это поможет подбирать нагрузку. Всё можно изменить позже в профиле.
        </p>
      </div>
      <ProfileForm value={profile} onChange={setProfile} weight={weight} onWeight={setWeight} />
      <button className="btn primary lg block mt-16" disabled={!profile.name.trim()} onClick={finish}>
        Начать
      </button>
    </div>
  );
}
