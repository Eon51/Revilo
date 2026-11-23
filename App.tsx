import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { isSupabaseConfigured, supabase } from './lib/api/supabase';
import {
  addCards,
  ChapterRecord,
  createChapter,
  createExam,
  createSubject,
  createDeck,
  deleteAccount,
  deleteChapter,
  deleteExam,
  deleteSubject,
  deleteCard,
  deleteDeck,
  ExamRecord,
  generateAndSavePlan,
  getCardProgress,
  listAvailability,
  listCards,
  listChapters,
  listBlockedDays,
  listDecks,
  listExams,
  listSessionViews,
  listSubjects,
  saveAvailability,
  saveCardProgress,
  saveQuizResult,
  setBlockedDay,
  updateSessionStatus,
  renameSubject,
  renameDeck,
  updateExam,
  SubjectRecord,
  SessionView,
  CardRecord,
  DeckRecord,
} from './lib/api/repository';
import { ReviewState, scheduleCard } from './lib/review';
import { isValidDateKey } from './lib/planner';
import { getCurrentStreak } from './lib/statistics';

type Tab = 'today' | 'calendar' | 'cards' | 'profile';

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [requestedDeckId, setRequestedDeckId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const [localStorageReady, setLocalStorageReady] = useState(Platform.OS === 'web');
  const [remoteSubjects, setRemoteSubjects] = useState<SubjectRecord[]>([]);
  const [remoteExams, setRemoteExams] = useState<ExamRecord[]>([]);
  const [remoteSessions, setRemoteSessions] = useState<SessionView[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjects, setSubjects] = useState<{ name: string; color: string; exams: number }[]>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem('revilo.subjects') ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      setUserEmail(data.session?.user.email ?? null);
      const name = data.session?.user.user_metadata.display_name;
      setUserName(typeof name === 'string' && name.trim()
        ? name.trim()
        : data.session?.user.email?.split('@')[0] ?? null);
    }).catch((error: unknown) => setDataMessage(
      error instanceof Error ? error.message : 'Impossible de restaurer la session du compte.'
    ));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user.email ?? null);
      const name = session?.user.user_metadata.display_name;
      setUserName(typeof name === 'string' && name.trim()
        ? name.trim()
        : session?.user.email?.split('@')[0] ?? null);
      setRecoveringPassword(event === 'PASSWORD_RECOVERY');
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!userEmail) {
      setRemoteSubjects([]);
      setRemoteExams([]);
      setRemoteSessions([]);
      return () => { active = false; };
    }

    Promise.all([listSubjects(), listExams(), listSessionViews()])
      .then(([nextSubjects, nextExams, nextSessions]) => {
        if (!active) return;
        setRemoteSubjects(nextSubjects);
        setRemoteExams(nextExams);
        setRemoteSessions(nextSessions);
        setDataMessage('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDataMessage(error instanceof Error ? error.message : 'Impossible de charger les données.');
      });

    return () => { active = false; };
  }, [userEmail]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    AsyncStorage.getItem('revilo.subjects').then((storedSubjects) => {
      if (!active) return;
      try {
        if (storedSubjects) setSubjects(JSON.parse(storedSubjects));
      } catch {
        setDataMessage('Les données hors ligne sont illisibles; elles seront remplacées à la prochaine sauvegarde.');
      }
      setLocalStorageReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setDataMessage(error instanceof Error ? error.message : 'Impossible de charger les données hors ligne.');
      setLocalStorageReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!localStorageReady) return;
    const value = JSON.stringify(subjects);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('revilo.subjects', value);
      } catch (error) {
        setDataMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer les cours hors ligne.');
      }
    } else {
      void AsyncStorage.setItem('revilo.subjects', value).catch((error: unknown) => {
        setDataMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer les matières hors ligne.');
      });
    }
  }, [localStorageReady, subjects]);

  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const todayKey = dateKey(new Date());
  const sessions = userEmail
    ? remoteSessions
      .filter((session) => session.session_date === todayKey)
      .map((session) => ({
        id: session.id,
        time: '',
        subject: session.subjectName,
        title: session.chapterTitle,
        duration: session.duration,
        icon: session.subjectName.slice(0, 1).toUpperCase(),
        tone: session.subjectColor,
        soft: `${session.subjectColor}20`,
        status: session.status,
        deckId: session.deck_id,
        deckTitle: session.deckTitle,
      }))
    : [];
  const shownSubjects = userEmail
    ? remoteSubjects.map((subject) => ({
      ...subject,
      exams: remoteExams.filter((exam) => exam.subject_id === subject.id).length,
    }))
    : subjects;
  const nextExam = remoteExams
    .filter((exam) => exam.exam_date >= todayKey)
    .sort((left, right) => left.exam_date.localeCompare(right.exam_date))[0];
  const nextExamSubject = nextExam
    ? remoteSubjects.find((subject) => subject.id === nextExam.subject_id)
    : undefined;
  const completedDates = remoteSessions
    .filter((session) => session.status === 'done')
    .map((session) => session.session_date);
  const completedDateSet = new Set(completedDates);
  const currentStreak = getCurrentStreak(completedDates, todayKey);
  const completedSessions = remoteSessions.filter((session) => session.status === 'done');
  const completedSessionCount = completedSessions.length;
  const completedStudyMinutes = completedSessions.reduce((total, session) => total + session.duration, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return { label, date: dateKey(date), done: completedDateSet.has(dateKey(date)) };
  });

  const toggleDone = async (id: string) => {
    const session = sessions.find((item) => item.id === id);
    if (userEmail && session) {
      const nextStatus = session.status === 'done' ? 'planned' : 'done';
      try {
        await updateSessionStatus(id, nextStatus);
        setRemoteSessions((current) => current.map((item) =>
          item.id === id ? { ...item, status: nextStatus } : item
        ));
        setDataMessage('');
      } catch (error) {
        setDataMessage(error instanceof Error ? error.message : 'Impossible de mettre à jour la session.');
      }
    }
  };

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.page,
          isWide && styles.pageWide,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={styles.mainColumn}>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }).toLocaleUpperCase('fr-FR')}
                </Text>
                <Text style={styles.title}>
                  {userEmail ? `Bonjour, ${userName ?? 'toi'}` : 'Bienvenue sur Révilo'} <Text style={styles.wave}>👋</Text>
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le profil"
                onPress={() => setTab('profile')}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {userName?.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? 'R'}
                </Text>
              </Pressable>
            </View>

            {tab === 'today' ? (
              <>
                <View style={styles.hero}>
                  <View style={styles.heroCopy}>
                    <Text style={styles.heroLabel}>TA JOURNÉE</Text>
                    <Text style={styles.heroTitle}>
                        {sessions.length > 0 && (userEmail
                          ? sessions.every((session) => session.status === 'done')
                          : false)
                        ? 'Bravo, tout est fait !'
                          : sessions.length === 0 ? 'Ton planning est vide' : 'Tu es prêt pour tes révisions'}
                    </Text>
                    <Text style={styles.heroText}>
                        {sessions.length === 0
                          ? 'Aucune session prévue aujourd’hui'
                          : `${sessions.filter((session) => session.status === 'done').length} sur ${sessions.length} sessions terminées`}
                    </Text>
                  </View>
                  <View style={styles.progressRing}>
                    <Text style={styles.progressValue}>
                        {Math.round((sessions.length === 0 ? 0 : sessions.filter((session) => session.status === 'done').length / sessions.length) * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.examCard}>
                  <Text style={styles.sideEyebrow}>PROCHAIN CONTRÔLE</Text>
                  {nextExam ? (
                    <>
                      <View style={styles.examRow}>
                        <View style={[styles.examIcon, { backgroundColor: `${nextExamSubject?.color ?? '#6657F4'}20` }]}>
                          <Text style={[styles.examIconText, { color: nextExamSubject?.color ?? '#6657F4' }]}>
                            {nextExamSubject?.name.slice(0, 1).toUpperCase() ?? 'C'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.examName}>{nextExam.title}</Text>
                          <Text style={styles.examDate}>
                            {nextExamSubject?.name ?? 'Cours'} · {new Date(`${nextExam.exam_date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.settingsText}>
                      {userEmail ? 'Aucun contrôle planifié.' : 'Connecte-toi pour enregistrer tes contrôles.'}
                    </Text>
                  )}
                  <Pressable accessibilityRole="button" onPress={() => setTab('calendar')}>
                    <Text style={styles.linkText}>{nextExam ? 'Gérer mes contrôles' : 'Ajouter un contrôle'}</Text>
                  </Pressable>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Aujourd’hui</Text>
                  <Text style={styles.sectionCount}>{sessions.length} sessions</Text>
                </View>

                <View style={styles.sessionList}>
                  {sessions.map((session) => {
                    const isDone = session.status === 'done';
                    return (
                      <View
                        key={session.id}
                        style={[styles.sessionCard, isDone && styles.sessionDone]}
                      >
                        {session.time ? (
                          <View style={styles.timeColumn}>
                            <Text style={[styles.sessionTime, isDone && styles.muted]}>{session.time}</Text>
                          </View>
                        ) : null}
                        <View style={[styles.subjectIcon, { backgroundColor: session.soft }]}>
                          <Text style={[styles.subjectIconText, { color: session.tone }]}>{session.icon}</Text>
                        </View>
                        <View style={styles.sessionCopy}>
                          <Text style={[styles.sessionSubject, { color: session.tone }]}>
                            {session.subject}
                          </Text>
                          <Text style={[styles.sessionTitle, isDone && styles.doneText]} numberOfLines={1}>
                            {session.title}
                          </Text>
                          <Text style={styles.duration}>⏱  {session.duration} min</Text>
                          {session.deckId ? (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setRequestedDeckId(session.deckId ?? null);
                                setTab('cards');
                              }}
                            >
                              <Text style={styles.linkText}>Réviser · {session.deckTitle ?? 'ouvrir le paquet'}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isDone ? 'Marquer cette session comme non faite' : 'Marquer cette session comme faite'}
                          onPress={() => toggleDone(session.id)}
                          style={[
                            styles.checkButton,
                            isDone && { backgroundColor: session.tone, borderColor: session.tone },
                          ]}
                        >
                          {isDone ? <Text style={styles.checkMark}>✓</Text> : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>À réviser</Text>
                  <Pressable accessibilityRole="button" onPress={() => setTab('cards')}>
                    <Text style={styles.linkText}>Voir tout</Text>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ouvrir les cartes de révision"
                  onPress={() => setTab('cards')}
                  style={styles.deckCard}
                >
                  <View style={styles.deckIcon}>
                    <Text style={styles.deckIconText}>A</Text>
                  </View>
                  <View style={styles.deckCopy}>
                    <Text style={styles.deckName}>Tes cartes de révision</Text>
                    <Text style={styles.deckMeta}>Crée un paquet ou importe un fichier CSV</Text>
                  </View>
                  <View style={styles.deckAction}>
                    <Text style={styles.deckActionText}>OUVRIR</Text>
                  </View>
                </Pressable>
              </>
            ) : tab === 'calendar' ? (
              <CalendarScreen
                userEmail={userEmail}
                onGoToProfile={() => setTab('profile')}
                sessions={userEmail ? remoteSessions : []}
                onSessionsUpdated={async () => setRemoteSessions(await listSessionViews())}
                onOpenDeck={(deckId) => {
                  setRequestedDeckId(deckId);
                  setTab('cards');
                }}
                onExamsUpdated={async () => {
                  const [nextSubjects, nextExams] = await Promise.all([listSubjects(), listExams()]);
                  setRemoteSubjects(nextSubjects);
                  setRemoteExams(nextExams);
                }}
              />
            ) : tab === 'cards' ? (
              <CardsScreen userEmail={userEmail} initialDeckId={requestedDeckId} />
            ) : (
              <ProfileScreen
                subjects={shownSubjects}
                subjectName={subjectName}
                userEmail={userEmail}
                userName={userName}
                completedSessionCount={completedSessionCount}
                completedStudyMinutes={completedStudyMinutes}
                currentStreak={currentStreak}
                onOpenPlanner={() => setTab('calendar')}
                recoveringPassword={recoveringPassword}
                onRecoveryComplete={() => setRecoveringPassword(false)}
                dataMessage={dataMessage}
                onSubjectNameChange={setSubjectName}
                onAddSubject={async () => {
                  const name = subjectName.trim();
                  if (!name) {
                    setDataMessage('Indique le nom du cours.');
                    return;
                  }
                  if (name.length > 60) {
                    setDataMessage('Le nom du cours ne peut pas dépasser 60 caractères.');
                    return;
                  }
                  const existingNames = (userEmail ? remoteSubjects : subjects)
                    .map((subject) => subject.name.toLocaleLowerCase('fr-FR'));
                  if (existingNames.includes(name.toLocaleLowerCase('fr-FR'))) {
                    setDataMessage('Ce cours existe déjà.');
                    return;
                  }
                  if (userEmail) {
                    try {
                      const subject = await createSubject(name);
                      setRemoteSubjects((current) => [...current, subject]);
                      setDataMessage('');
                    } catch (error) {
                      setDataMessage(error instanceof Error ? error.message : 'Impossible d’ajouter ce cours.');
                      return;
                    }
                    setSubjectName('');
                    return;
                  }
                  setSubjects((current) => [
                    ...current,
                    { name, color: '#63CDA5', exams: 0 },
                  ]);
                  setDataMessage('');
                  setSubjectName('');
                }}
                onRenameSubject={async (subject, newName) => {
                  const name = newName.trim();
                  if (!name) {
                    setDataMessage('Indique le nom du cours.');
                    return false;
                  }
                  const existingNames = (userEmail ? remoteSubjects : subjects)
                    .filter((item) => item.name !== subject.name)
                    .map((item) => item.name.toLocaleLowerCase('fr-FR'));
                  if (existingNames.includes(name.toLocaleLowerCase('fr-FR'))) {
                    setDataMessage('Ce cours existe déjà.');
                    return false;
                  }
                  if (userEmail && subject.id) {
                    try {
                      await renameSubject(subject.id, name);
                      setRemoteSubjects((current) => current.map((item) =>
                        item.id === subject.id ? { ...item, name } : item
                      ));
                      setDataMessage('');
                      return true;
                    } catch (error) {
                      setDataMessage(error instanceof Error ? error.message : 'Impossible de modifier ce cours.');
                      return false;
                    }
                  }
                  setSubjects((current) => current.map((item) =>
                    item.name === subject.name ? { ...item, name } : item
                  ));
                  setDataMessage('');
                  return true;
                }}
                onDeleteSubject={async (subject) => {
                  if (userEmail && subject.id) {
                    try {
                      await deleteSubject(subject.id);
                      const [nextExams, nextSessions] = await Promise.all([
                        listExams(),
                        listSessionViews(),
                      ]);
                      setRemoteSubjects((current) => current.filter((item) => item.id !== subject.id));
                      setRemoteExams(nextExams);
                      setRemoteSessions(nextSessions);
                      setDataMessage('');
                    } catch (error) {
                      setDataMessage(error instanceof Error ? error.message : 'Impossible de supprimer ce cours.');
                    }
                    return;
                  }
                  setSubjects((current) => current.filter((item) => item.name !== subject.name));
                }}
                onDeleteData={async () => {
                  if (userEmail) {
                    try {
                      await deleteAccount();
                      await supabase?.auth.signOut();
                      setRemoteSubjects([]);
                      setRemoteExams([]);
                      setRemoteSessions([]);
                      setDataMessage('Compte supprimé.');
                    } catch (error) {
                      setDataMessage(error instanceof Error ? error.message : 'Impossible de supprimer le compte.');
                    }
                    return;
                  }
                  try {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.localStorage.removeItem('revilo.subjects');
                      window.localStorage.setItem('revilo.cards', '[]');
                    } else {
                      await AsyncStorage.multiSet([
                        ['revilo.subjects', '[]'],
                        ['revilo.cards', '[]'],
                      ]);
                    }
                  } catch (error) {
                    setDataMessage(error instanceof Error ? error.message : 'Impossible d’effacer les données hors ligne.');
                    return;
                  }
                  setSubjects([]);
                }}
              />
            )}
          </View>

          {isWide ? (
            <View style={styles.sideColumn}>
              <View style={styles.streakCard}>
                <Text style={styles.sideEyebrow}>SÉRIES DE RÉVISION</Text>
                <View style={styles.streakRow}>
                  <View>
                    <Text style={styles.streakNumber}>{currentStreak}</Text>
                    <Text style={styles.streakLabel}>jours d’affilée</Text>
                  </View>
                  <Text style={styles.flame}>{currentStreak ? '🔥' : '—'}</Text>
                </View>
                <View style={styles.weekRow}>
                  {weekDays.map((day, index) => (
                    <View key={`${day.date}-${index}`} style={styles.dayColumn}>
                      <View style={[styles.dayDot, day.done && styles.dayDone]}>
                        {day.done ? <Text style={styles.dayCheck}>✓</Text> : null}
                      </View>
                      <Text style={styles.dayLabel}>{day.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Pressable accessibilityRole="button" onPress={() => setTab('calendar')} style={styles.examCard}>
                <Text style={styles.sideEyebrow}>PROCHAIN CONTRÔLE</Text>
                {nextExam ? (
                  <>
                    <Text style={styles.examName}>{nextExam.title}</Text>
                    <Text style={styles.examDate}>
                      {nextExamSubject?.name ?? 'Cours'} · {new Date(`${nextExam.exam_date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.settingsText}>Aucun contrôle planifié. Appuie pour en ajouter un.</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.nav, isWide && styles.navWide]}>
        <NavButton label="Aujourd’hui" icon="⌂" active={tab === 'today'} onPress={() => setTab('today')} />
        <NavButton label="Calendrier" icon="▦" active={tab === 'calendar'} onPress={() => setTab('calendar')} />
        <NavButton label="Cartes" icon="▣" active={tab === 'cards'} onPress={() => setTab('cards')} />
        <NavButton label="Profil" icon="○" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
    </View>
  );
}

function CalendarScreen({
  userEmail,
  onGoToProfile,
  sessions,
  onSessionsUpdated,
  onExamsUpdated,
  onOpenDeck,
}: {
  userEmail: string | null;
  onGoToProfile: () => void;
  sessions: SessionView[];
  onSessionsUpdated: () => Promise<void>;
  onExamsUpdated: () => Promise<void>;
  onOpenDeck: (deckId: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [exams, setExams] = useState<Awaited<ReturnType<typeof listExams>>>([]);
  const [chapters, setChapters] = useState<Awaited<ReturnType<typeof listChapters>>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [confirmDeleteExamId, setConfirmDeleteExamId] = useState<string | null>(null);
  const [confirmDeleteChapterId, setConfirmDeleteChapterId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return dateKey(date);
  });
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDifficulty, setChapterDifficulty] = useState<1 | 2 | 3>(2);
  const [blockedDate, setBlockedDate] = useState('');
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Record<number, number>>({});
  const [plannerMessage, setPlannerMessage] = useState('');
  const [plannerBusy, setPlannerBusy] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    Promise.all([listSubjects(), listExams(), listAvailability(), listBlockedDays()])
      .then(async ([nextSubjects, nextExams, nextAvailability, nextBlocked]) => {
        const nextChapters = await listChapters(nextExams.map((exam) => exam.id));
        setSubjects(nextSubjects);
        setExams(nextExams);
        setChapters(nextChapters);
        setAvailability(nextAvailability);
        setBlockedDates(nextBlocked);
        setSelectedSubjectId((current) => current || nextSubjects[0]?.id || '');
        setSelectedExamId((current) => current || nextExams[0]?.id || '');
      })
      .catch((error: unknown) => setPlannerMessage(
        error instanceof Error ? error.message : 'Impossible de charger le planning.'
      ));
  }, [userEmail]);

  const addExam = async () => {
    if (!selectedSubjectId || !examTitle.trim() || !examDate) {
      setPlannerMessage('Choisis un cours et renseigne le nom et la date du contrôle.');
      return;
    }
    if (!isValidDateKey(examDate)) {
      setPlannerMessage('Saisis une date valide au format AAAA-MM-JJ.');
      return;
    }
    if (examDate < dateKey(new Date())) {
      setPlannerMessage('La date du contrôle ne peut pas être passée.');
      return;
    }
    setPlannerBusy(true);
    try {
      if (editingExamId) {
        await updateExam(editingExamId, selectedSubjectId, examTitle, examDate);
        setExams((current) => current.map((exam) => exam.id === editingExamId
          ? { ...exam, subject_id: selectedSubjectId, title: examTitle.trim(), exam_date: examDate }
          : exam
        ));
        setEditingExamId(null);
        setPlannerMessage('Contrôle modifié.');
      } else {
        const exam = await createExam(selectedSubjectId, examTitle, examDate);
        setExams((current) => [...current, exam]);
        setSelectedExamId(exam.id);
        setPlannerMessage('Contrôle ajouté.');
      }
      setExamTitle('');
      await onExamsUpdated();
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible d’ajouter l’examen.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const addChapter = async () => {
    if (!selectedExamId || !chapterTitle.trim()) {
      setPlannerMessage('Choisis un examen et indique le nom du chapitre.');
      return;
    }
    setPlannerBusy(true);
    try {
      const chapter = await createChapter(selectedExamId, chapterTitle, chapterDifficulty);
      setChapters((current) => [...current, chapter]);
      setChapterTitle('');
      setChapterDifficulty(2);
      setPlannerMessage('Chapitre ajouté.');
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible d’ajouter le chapitre.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const toggleBlockedDate = async () => {
    if (!isValidDateKey(blockedDate)) {
      setPlannerMessage('Saisis une date valide au format AAAA-MM-JJ.');
      return;
    }
    const currentlyBlocked = blockedDates.includes(blockedDate);
    setPlannerBusy(true);
    try {
      await setBlockedDay(blockedDate, !currentlyBlocked);
      setBlockedDates((current) => currentlyBlocked
        ? current.filter((date) => date !== blockedDate)
        : [...current, blockedDate].sort()
      );
      setPlannerMessage(currentlyBlocked ? 'Jour disponible à nouveau.' : 'Jour bloqué.');
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible de modifier ce jour.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const generatePlan = async () => {
    if (chapters.length === 0) {
      setPlannerMessage('Ajoute au moins un chapitre à réviser avant de planifier.');
      return;
    }
    setPlannerBusy(true);
    try {
      await saveAvailability(availability);
      const plan = await generateAndSavePlan();
      await onSessionsUpdated();
      if (plan[0]) {
        setSelectedDate(plan[0].date);
        const [year, monthNumber] = plan[0].date.split('-').map(Number);
        setMonth(new Date(year, monthNumber - 1, 1));
      }
      setPlannerMessage(
        plan.length ? `${plan.length} session(s) ajoutée(s) au planning.` : 'Aucune session générée : vérifie les chapitres, les disponibilités et les dates.'
      );
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible de générer le planning.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const monthLabel = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const mondayOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const changeMonth = (amount: number) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  };
  const days = [
    ...Array.from({ length: mondayOffset }, () => ''),
    ...Array.from({ length: monthDays }, (_, index) => String(index + 1)),
  ];
  const selectedSessions = sessions.filter((session) => session.session_date === selectedDate);
  const selectedDayExams = exams.filter((exam) => exam.exam_date === selectedDate);
  const upcomingExams = exams.filter((exam) => exam.exam_date >= dateKey(new Date()));
  const selectedExam = exams.find((exam) => exam.id === selectedExamId);

  const removeSelectedExam = async () => {
    if (!selectedExam) return;
    setPlannerBusy(true);
    try {
      await deleteExam(selectedExam.id);
      setExams((current) => current.filter((exam) => exam.id !== selectedExam.id));
      setChapters((current) => current.filter((chapter) => chapter.exam_id !== selectedExam.id));
      setSelectedExamId('');
      setEditingExamId(null);
      setConfirmDeleteExamId(null);
      await Promise.all([onExamsUpdated(), onSessionsUpdated()]);
      setPlannerMessage('Contrôle supprimé.');
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible de supprimer le contrôle.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const removeChapter = async (chapterId: string) => {
    setPlannerBusy(true);
    try {
      await deleteChapter(chapterId);
      setChapters((current) => current.filter((chapter) => chapter.id !== chapterId));
      setConfirmDeleteChapterId(null);
      await onSessionsUpdated();
      setPlannerMessage('Chapitre supprimé.');
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible de supprimer le chapitre.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const changeSessionStatus = async (
    sessionId: string,
    status: 'done' | 'postponed' | 'missed' | 'planned'
  ) => {
    setPlannerBusy(true);
    try {
      await updateSessionStatus(sessionId, status);
      if (status === 'postponed' || status === 'missed') {
        const newPlan = await generateAndSavePlan();
        setPlannerMessage(
          newPlan.length
            ? `Session mise à jour; ${newPlan.length} séance(s) replanifiée(s).`
            : 'Session mise à jour; aucune nouvelle séance possible avec les disponibilités actuelles.'
        );
      } else {
        setPlannerMessage('Session mise à jour.');
      }
      await onSessionsUpdated();
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible de modifier la session.');
    } finally {
      setPlannerBusy(false);
    }
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>{monthLabel.toLocaleUpperCase('fr-FR')}</Text>
          <Text style={styles.sectionTitle}>Calendrier</Text>
        </View>
        <View style={styles.monthActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mois précédent"
            onPress={() => changeMonth(-1)}
            style={styles.monthButton}
          ><Text style={styles.monthButtonText}>‹</Text></Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mois suivant"
            onPress={() => changeMonth(1)}
            style={styles.monthButton}
          ><Text style={styles.monthButtonText}>›</Text></Pressable>
        </View>
      </View>

      {userEmail ? (
        <View style={styles.plannerCard}>
          <Text style={styles.settingsTitle}>Cours et contrôles</Text>
          {subjects.length === 0 ? (
            <>
              <Text style={styles.settingsText}>Ajoute d’abord un cours pour pouvoir y associer un contrôle.</Text>
              <Pressable accessibilityRole="button" onPress={onGoToProfile} style={styles.addSubjectButton}>
                <Text style={styles.addSubjectButtonText}>Ajouter un cours</Text>
              </Pressable>
            </>
          ) : (
            <>
              {upcomingExams.length > 0 ? (
                <>
                  <Text style={styles.plannerLabel}>Mes prochains contrôles</Text>
                  {upcomingExams.map((exam) => {
                    const subject = subjects.find((item) => item.id === exam.subject_id);
                    return (
                      <Pressable
                        key={exam.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedExamId(exam.id)}
                        style={[styles.examListRow, selectedExamId === exam.id && styles.examListRowActive]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subjectRowName}>{exam.title}</Text>
                          <Text style={styles.subjectRowMeta}>
                            {subject?.name ?? 'Cours'} · {new Date(`${exam.exam_date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </View>
                        <Text style={styles.subjectRowMeta}>
                          {chapters.filter((chapter) => chapter.exam_id === exam.id).length} chapitre(s)
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
              <Text style={styles.plannerLabel}>Cours du contrôle</Text>
              <View style={styles.deckChoices}>
                {subjects.map((subject) => (
                  <Pressable
                    key={subject.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedSubjectId(subject.id)}
                    style={[styles.deckChoice, selectedSubjectId === subject.id && styles.deckChoiceActive]}
                  >
                    <Text style={[styles.deckChoiceText, selectedSubjectId === subject.id && styles.deckChoiceTextActive]}>
                      {subject.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.plannerFormRow}>
                <TextInput
                  value={examTitle}
                  onChangeText={setExamTitle}
                  placeholder="Ex. Contrôle chapitre 3"
                  placeholderTextColor="#A1A4B1"
                  style={styles.subjectInput}
                />
                <TextInput
                  value={examDate}
                  onChangeText={setExamDate}
                  accessibilityLabel="Date du contrôle au format année-mois-jour"
                  keyboardType="numbers-and-punctuation"
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor="#A1A4B1"
                  style={styles.plannerDateInput}
                />
              </View>
              <Pressable disabled={plannerBusy} accessibilityRole="button" onPress={() => void addExam()} style={styles.addSubjectButton}>
                <Text style={styles.addSubjectButtonText}>
                  {editingExamId ? 'Enregistrer les modifications' : 'Ajouter le contrôle'}
                </Text>
              </Pressable>

              {exams.length ? (
                <>
                  <Text style={styles.plannerLabel}>Chapitres à réviser</Text>
                  <View style={styles.deckChoices}>
                    {exams.map((exam) => (
                      <Pressable
                        key={exam.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedExamId(exam.id);
                          if (exam.subject_id) setSelectedSubjectId(exam.subject_id);
                          setConfirmDeleteExamId(null);
                        }}
                        style={[styles.deckChoice, selectedExamId === exam.id && styles.deckChoiceActive]}
                      >
                        <Text style={[styles.deckChoiceText, selectedExamId === exam.id && styles.deckChoiceTextActive]}>
                          {exam.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {selectedExam ? (
                    <View style={styles.plannerActionRow}>
                      <Pressable
                        disabled={plannerBusy}
                        accessibilityRole="button"
                        onPress={() => {
                          setEditingExamId(selectedExam.id);
                          setSelectedSubjectId(selectedExam.subject_id ?? '');
                          setExamTitle(selectedExam.title);
                          setExamDate(selectedExam.exam_date);
                        }}
                        style={styles.plannerActionButton}
                      >
                        <Text style={styles.plannerActionText}>Modifier le contrôle sélectionné</Text>
                      </Pressable>
                      {editingExamId ? (
                        <Pressable
                          disabled={plannerBusy}
                          accessibilityRole="button"
                          onPress={() => {
                            setEditingExamId(null);
                            setExamTitle('');
                          }}
                          style={styles.plannerActionButton}
                        >
                          <Text style={styles.plannerActionText}>Annuler la modification</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        disabled={plannerBusy}
                        accessibilityRole="button"
                        onPress={() => {
                          if (confirmDeleteExamId === selectedExam.id) {
                            void removeSelectedExam();
                          } else {
                            setConfirmDeleteExamId(selectedExam.id);
                          }
                        }}
                        style={styles.subjectDeleteButton}
                      >
                        <Text style={styles.subjectDeleteText}>
                          {confirmDeleteExamId === selectedExam.id ? 'Confirmer suppression' : 'Supprimer'}
                        </Text>
                      </Pressable>
                      {confirmDeleteExamId === selectedExam.id ? (
                        <Text style={styles.settingsText}>
                          Les chapitres et séances associés seront supprimés aussi.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.addSubjectRow}>
                    <TextInput
                      value={chapterTitle}
                      onChangeText={setChapterTitle}
                      placeholder="Nom du chapitre"
                      placeholderTextColor="#A1A4B1"
                      style={styles.subjectInput}
                    />
                    <Pressable disabled={plannerBusy} accessibilityRole="button" onPress={() => void addChapter()} style={styles.addSubjectButton}>
                      <Text style={styles.addSubjectButtonText}>Ajouter</Text>
                    </Pressable>
                  </View>
                  <View style={styles.difficultyChoices}>
                    {([
                      [1, 'Facile'],
                      [2, 'Moyen'],
                      [3, 'Difficile'],
                    ] as const).map(([difficulty, label]) => (
                      <Pressable
                        key={difficulty}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chapterDifficulty === difficulty }}
                        onPress={() => setChapterDifficulty(difficulty)}
                        style={[styles.difficultyChoice, chapterDifficulty === difficulty && styles.deckChoiceActive]}
                      >
                        <Text style={[styles.deckChoiceText, chapterDifficulty === difficulty && styles.deckChoiceTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {chapters
                    .filter((chapter) => chapter.exam_id === selectedExamId)
                    .map((chapter) => (
                      <View key={chapter.id} style={styles.chapterRowContainer}>
                        <Text style={styles.chapterRow}>
                          {chapter.title} · {['', 'facile', 'moyen', 'difficile'][chapter.difficulty]}
                        </Text>
                        <Pressable
                          disabled={plannerBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer le chapitre ${chapter.title}`}
                          onPress={() => {
                            if (confirmDeleteChapterId === chapter.id) {
                              void removeChapter(chapter.id);
                            } else {
                              setConfirmDeleteChapterId(chapter.id);
                            }
                          }}
                        >
                          <Text style={styles.subjectDeleteText}>
                            {confirmDeleteChapterId === chapter.id ? 'Confirmer' : 'Supprimer'}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                </>
              ) : null}
            </>
          )}

          <Text style={styles.plannerLabel}>Temps disponible pour réviser (minutes par jour)</Text>
          <Text style={styles.settingsText}>Saisis 0 les jours où tu ne peux pas réviser.</Text>
          <View style={styles.availabilityGrid}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
              <View key={`${day}-${index}`} style={styles.availabilityCell}>
                <Text style={styles.availabilityDay}>{day}</Text>
                <TextInput
                  value={String(availability[(index + 1) % 7] ?? 0)}
                  onChangeText={(value) => setAvailability((current) => ({
                    ...current,
                    [(index + 1) % 7]: Math.min(1440, Number(value.replace(/\D/g, '')) || 0),
                  }))}
                  keyboardType="number-pad"
                  style={styles.availabilityInput}
                />
              </View>
            ))}
          </View>

          <Text style={styles.plannerLabel}>Jours indisponibles</Text>
          <View style={styles.plannerFormRow}>
            <TextInput
              value={blockedDate}
              onChangeText={setBlockedDate}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor="#A1A4B1"
              style={styles.subjectInput}
            />
            <Pressable disabled={plannerBusy} accessibilityRole="button" onPress={() => void toggleBlockedDate()} style={styles.addSubjectButton}>
              <Text style={styles.addSubjectButtonText}>
                {blockedDates.includes(blockedDate) ? 'Libérer' : 'Bloquer'}
              </Text>
            </Pressable>
          </View>

          <Pressable disabled={plannerBusy || exams.length === 0 || chapters.length === 0 || Object.values(availability).every((minutes) => minutes <= 0)} accessibilityRole="button" onPress={() => void generatePlan()} style={[styles.importButton, { marginTop: 12 }]}>
            <Text style={styles.importButtonText}>{plannerBusy ? 'Enregistrement…' : 'Planifier mes révisions'}</Text>
          </Pressable>
          {exams.length > 0 && chapters.length === 0 ? (
            <Text style={styles.settingsText}>Ajoute au moins un chapitre avant de planifier les révisions.</Text>
          ) : null}
          {exams.length > 0 && Object.values(availability).every((minutes) => minutes <= 0) ? (
            <Text style={styles.settingsText}>Indique tes disponibilités pour activer la planification.</Text>
          ) : null}
          {plannerMessage ? <Text style={styles.authMessage}>{plannerMessage}</Text> : null}
        </View>
      ) : (
        <View style={styles.plannerCard}>
          <Text style={styles.settingsText}>Connecte-toi pour enregistrer tes cours et tes contrôles.</Text>
          <Pressable accessibilityRole="button" onPress={onGoToProfile} style={styles.addSubjectButton}>
            <Text style={styles.addSubjectButtonText}>Créer ou connecter mon compte</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.calendarCard}>
        <View style={styles.weekdays}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            const dateKey = day
              ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${day.padStart(2, '0')}`
              : '';
            const active = dateKey === selectedDate;
            const daySessions = sessions.filter((session) => session.session_date === dateKey);
            const dayExams = exams.filter((exam) => exam.exam_date === dateKey);
            return (
              <Pressable
                key={`${day}-${index}`}
                disabled={!day}
                accessibilityRole={day ? 'button' : undefined}
                accessibilityLabel={day ? `${day} ${monthLabel}` : undefined}
                onPress={() => setSelectedDate(dateKey)}
                style={[styles.calendarDay, active && styles.calendarDayActive]}
              >
                {day ? <Text style={[styles.calendarDayText, active && styles.calendarDayTextActive]}>{day}</Text> : null}
                <View style={styles.calendarDots}>
                  {dayExams.slice(0, 2).map((exam) => {
                    const subjectColor = subjects.find((subject) => subject.id === exam.subject_id)?.color ?? '#F49A55';
                    return <View key={`exam-${exam.id}`} style={[styles.calendarDot, { backgroundColor: subjectColor }]} />;
                  })}
                  {daySessions.slice(0, 3).map((session) => (
                    <View key={session.id} style={[styles.calendarDot, { backgroundColor: session.subjectColor }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text style={styles.sectionCount}>
          {selectedDayExams.length} contrôle(s) · {selectedSessions.length} séance(s)
        </Text>
      </View>
      {selectedDayExams.map((exam) => {
        const subject = subjects.find((item) => item.id === exam.subject_id);
        const tone = subject?.color ?? '#F49A55';
        return (
          <View key={exam.id} style={styles.examCalendarCard}>
            <View style={[styles.subjectIcon, { backgroundColor: `${tone}20` }]}>
              <Text style={[styles.subjectIconText, { color: tone }]}>!</Text>
            </View>
            <View style={styles.sessionCopy}>
              <Text style={[styles.sessionSubject, { color: tone }]}>CONTRÔLE · {subject?.name ?? 'Cours'}</Text>
              <Text style={styles.sessionTitle}>{exam.title}</Text>
            </View>
          </View>
        );
      })}
      <View style={styles.sessionList}>
        {selectedSessions.map((session) => (
          <View key={session.id}>
            <View style={styles.sessionCard}>
              <View style={[styles.subjectIcon, { backgroundColor: `${session.subjectColor}20` }]}>
                <Text style={[styles.subjectIconText, { color: session.subjectColor }]}>
                  {session.subjectName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.sessionCopy}>
                <Text style={[styles.sessionSubject, { color: session.subjectColor }]}>{session.subjectName}</Text>
                <Text style={styles.sessionTitle}>{session.chapterTitle}</Text>
                <Text style={styles.duration}>
                  {session.duration} min · {session.status === 'done' ? 'faite' : session.status === 'postponed' ? 'reportée' : session.status === 'missed' ? 'manquée' : 'planifiée'}
                </Text>
                {session.deck_id ? (
                  <Pressable accessibilityRole="button" onPress={() => session.deck_id && onOpenDeck(session.deck_id)}>
                    <Text style={styles.linkText}>Ouvrir {session.deckTitle ?? 'le paquet de cartes'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <View style={styles.sessionActionRow}>
              <Pressable
                disabled={plannerBusy}
                accessibilityRole="button"
                onPress={() => void changeSessionStatus(session.id, session.status === 'done' ? 'planned' : 'done')}
                style={styles.sessionActionButton}
              >
                <Text style={styles.sessionActionText}>{session.status === 'done' ? 'Annuler fait' : 'Marquer faite'}</Text>
              </Pressable>
              <Pressable
                disabled={plannerBusy}
                accessibilityRole="button"
                onPress={() => void changeSessionStatus(session.id, 'postponed')}
                style={styles.sessionActionButton}
              >
                <Text style={styles.sessionActionText}>Reporter</Text>
              </Pressable>
              <Pressable
                disabled={plannerBusy}
                accessibilityRole="button"
                onPress={() => void changeSessionStatus(session.id, 'missed')}
                style={styles.sessionActionButton}
              >
                <Text style={styles.sessionActionText}>Manquée</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {selectedSessions.length === 0 ? (
          <Text style={styles.settingsText}>
            {sessions.length === 0 && exams.length === 0
              ? 'Aucun contrôle ni cours planifié.'
              : 'Aucune séance de révision ce jour-là.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function isRemoteCard(card: CardRecord | { front: string; back: string }): card is CardRecord {
  return 'id' in card && typeof card.id === 'string';
}

type LocalCard = {
  front: string;
  back: string;
  progress?: ReviewState;
};

function isStoredLocalCard(value: unknown): value is LocalCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  if (typeof card.front !== 'string' || typeof card.back !== 'string') return false;
  if (card.progress === undefined) return true;
  if (!card.progress || typeof card.progress !== 'object' || Array.isArray(card.progress)) return false;
  const progress = card.progress as Record<string, unknown>;
  return typeof progress.easeFactor === 'number'
    && Number.isFinite(progress.easeFactor)
    && typeof progress.interval === 'number'
    && Number.isInteger(progress.interval)
    && typeof progress.repetitions === 'number'
    && Number.isInteger(progress.repetitions)
    && typeof progress.nextReviewAt === 'string'
    && isValidDateKey(progress.nextReviewAt);
}

function parseLocalCards(value: string | null): LocalCard[] {
  if (value === null) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isStoredLocalCard)) {
    throw new Error('Les cartes hors ligne ont un format invalide.');
  }
  return parsed.map((card) => ({
    front: card.front,
    back: card.back,
    ...(card.progress ? { progress: card.progress } : {}),
  }));
}

function CardsScreen({
  userEmail,
  initialDeckId,
}: {
  userEmail: string | null;
  initialDeckId: string | null;
}) {
  const [mode, setMode] = useState<'cards' | 'quiz' | 'import'>('cards');
  const [csv, setCsv] = useState('');
  const [importReport, setImportReport] = useState('');
  const [deckName, setDeckName] = useState('');
  const [deckRename, setDeckRename] = useState('');
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);
  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [deckId, setDeckId] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [deckSubjectId, setDeckSubjectId] = useState('');
  const [deckChapterId, setDeckChapterId] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<SubjectRecord[]>([]);
  const [availableExams, setAvailableExams] = useState<ExamRecord[]>([]);
  const [availableChapters, setAvailableChapters] = useState<ChapterRecord[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizMode, setQuizMode] = useState<'choice' | 'written' | 'trueFalse'>('choice');
  const [quizQuestionLimit, setQuizQuestionLimit] = useState('10');
  const [quizWrittenAnswer, setQuizWrittenAnswer] = useState('');
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizMissedIds, setQuizMissedIds] = useState<string[]>([]);
  const [quizMissedFronts, setQuizMissedFronts] = useState<string[]>([]);
  const [operationMessage, setOperationMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardsStorageReady, setCardsStorageReady] = useState(false);
  const [cards, setCards] = useState<(CardRecord | LocalCard)[]>([]);

  useEffect(() => {
    let active = true;
    if (!userEmail) {
      setCards([]);
      setDeckId(null);
      setDecks([]);
      setDeckSubjectId('');
      setDeckChapterId('');
      setAvailableSubjects([]);
      setAvailableExams([]);
      setAvailableChapters([]);
      setCardsStorageReady(false);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem('revilo.cards');
          if (active) setCards(parseLocalCards(stored));
          setCardsStorageReady(true);
        } catch {
          setOperationMessage('Les cartes hors ligne sont illisibles.');
        }
      } else {
        AsyncStorage.getItem('revilo.cards').then((stored) => {
          if (!active) return;
          setCards(parseLocalCards(stored));
          setCardsStorageReady(true);
        }).catch((error: unknown) => {
          if (!active) return;
          setOperationMessage(error instanceof Error ? error.message : 'Impossible de charger les cartes hors ligne.');
          setCardsStorageReady(true);
        });
      }
      return () => { active = false; };
    }

    setCardsStorageReady(false);
    setCards([]);
    Promise.all([listDecks(), listSubjects(), listExams()])
      .then(async ([nextDecks, nextSubjects, nextExams]) => {
        if (!active) return;
        const nextChapters = await listChapters(nextExams.map((exam) => exam.id));
        if (!active) return;
        setDecks(nextDecks);
        setAvailableSubjects(nextSubjects);
        setAvailableExams(nextExams);
        setAvailableChapters(nextChapters);
        const selected = nextDecks.find((deck) => deck.id === initialDeckId) ?? nextDecks[0];
        setDeckId(selected?.id ?? null);
        setDeckRename(selected?.title ?? '');
        setDeckSubjectId(selected?.subject_id ?? nextSubjects[0]?.id ?? '');
        setDeckChapterId(selected?.chapter_id ?? '');
        if (selected) {
          const nextCards = await listCards(selected.id);
          if (active) setCards(nextCards);
        } else {
          setCards([]);
        }
      })
      .catch((error: unknown) => {
        if (active) setOperationMessage(error instanceof Error ? error.message : 'Impossible de charger les paquets.');
      });

    return () => { active = false; };
  }, [initialDeckId, userEmail]);

  useEffect(() => {
    if (!cardsStorageReady || userEmail) return;
    const value = JSON.stringify(cards);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('revilo.cards', value);
      } catch (error) {
        setOperationMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer les cartes hors ligne.');
      }
    } else {
      void AsyncStorage.setItem('revilo.cards', value).catch((error: unknown) => setOperationMessage(
        error instanceof Error ? error.message : 'Impossible d’enregistrer les cartes hors ligne.'
      ));
    }
  }, [cards, cardsStorageReady, userEmail]);

  const selectDeck = async (selected: DeckRecord) => {
    setDeckId(selected.id);
    setDeckSubjectId(selected.subject_id ?? '');
    setDeckChapterId(selected.chapter_id ?? '');
    setCards([]);
    setCardIndex(0);
    setConfirmDeleteDeck(false);
    setConfirmDeleteCard(false);
    setBusy(true);
    try {
      setCards(await listCards(selected.id));
      setDeckRename(selected.title);
      setCardIndex(0);
      setCardFlipped(false);
      setConfirmDeleteCard(false);
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de charger les cartes.');
    } finally {
      setBusy(false);
    }
  };

  const addDeck = async () => {
    if (!deckName.trim() || !userEmail) {
      setOperationMessage('Indique le nom du paquet.');
      return;
    }
    setBusy(true);
    try {
      const deck = await createDeck(
        deckName,
        deckSubjectId || undefined,
        deckChapterId || undefined
      );
      setDecks((current) => [...current, deck]);
      setDeckId(deck.id);
      setCards([]);
      setConfirmDeleteDeck(false);
      setConfirmDeleteCard(false);
      setDeckRename(deck.title);
      setDeckName('');
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de créer le paquet.');
    } finally {
      setBusy(false);
    }
  };

  const renameCurrentDeck = async () => {
    const selected = decks.find((deck) => deck.id === deckId);
    if (!selected || !userEmail) return;
    setBusy(true);
    try {
      await renameDeck(selected.id, deckRename);
      setDecks((current) => current.map((deck) =>
        deck.id === selected.id ? { ...deck, title: deckRename.trim() } : deck
      ));
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de renommer le paquet.');
    } finally {
      setBusy(false);
    }
  };

  const removeCurrentDeck = async () => {
    const selected = decks.find((deck) => deck.id === deckId);
    if (!selected || !userEmail) return;
    setBusy(true);
    try {
      await deleteDeck(selected.id);
      const remaining = decks.filter((deck) => deck.id !== selected.id);
      setDecks(remaining);
      setDeckId(remaining[0]?.id ?? null);
      setCards(remaining[0] ? await listCards(remaining[0].id) : []);
      setDeckRename(remaining[0]?.title ?? '');
      setConfirmDeleteDeck(false);
      setConfirmDeleteCard(false);
      setOperationMessage('');
      setCardIndex(0);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de supprimer le paquet.');
    } finally {
      setBusy(false);
    }
  };

  const removeCurrentCard = async () => {
    const current = cards[cardIndex];
    if (!current) return;
    setBusy(true);
    try {
      if (userEmail && isRemoteCard(current)) {
        await deleteCard(current.id);
      }
      const remaining = cards.filter((_, index) => index !== cardIndex);
      setCards(remaining);
      setCardIndex(remaining.length ? cardIndex % remaining.length : 0);
      setCardFlipped(false);
      setConfirmDeleteCard(false);
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de supprimer la carte.');
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async (quality: number) => {
    const card = cards[cardIndex];
    if (!card) return;
    if (userEmail && 'id' in card) {
      setBusy(true);
      try {
        const previous = await getCardProgress(card.id);
        const next = scheduleCard(previous, quality);
        await saveCardProgress(card.id, { ...next, quality });
        setOperationMessage('');
      } catch (error) {
        setOperationMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer la progression.');
        setBusy(false);
        return;
      }
      setBusy(false);
    } else {
      if (!isRemoteCard(card)) {
        const previous = card.progress ?? {
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewAt: new Date().toISOString().slice(0, 10),
        };
        const next = scheduleCard(previous, quality);
        setCards((current) => current.map((item, index) =>
          index === cardIndex && !isRemoteCard(item) ? { ...item, progress: next } : item
        ));
      }
    }
    setCardIndex((current) => (current + 1) % cards.length);
    setCardFlipped(false);
  };

  useEffect(() => {
    if (!userEmail) return;
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizMissedIds([]);
    setQuizMissedFronts([]);
    setQuizWrittenAnswer('');
  }, [deckId, userEmail]);
  const card = cards[cardIndex];
  const selectedDeck = decks.find((deck) => deck.id === deckId);
  const quizQuestionCount = Math.min(
    cards.length,
    Math.max(1, Math.min(50, Number.parseInt(quizQuestionLimit, 10) || 1))
  );
  const quizCard = cards.length > 0 ? cards[quizIndex % cards.length] : undefined;
  const quizOtherAnswers = quizCard
    ? Array.from(new Set(cards.map(({ back }) => back)))
      .filter((answer) => answer !== quizCard.back)
    : [];
  const quizAnswers = quizCard
    ? quizOtherAnswers.slice(0, 2).concat(quizCard.back).sort((left, right) => left.localeCompare(right, 'fr'))
    : [];
  const quizStatementIsTrue = quizIndex % 2 === 0 || quizOtherAnswers.length === 0;
  const quizStatement = quizStatementIsTrue
    ? quizCard?.back
    : quizOtherAnswers[quizIndex % quizOtherAnswers.length];
  const chaptersForSelectedSubject = availableChapters.filter((chapter) =>
    availableExams.find((exam) => exam.id === chapter.exam_id)?.subject_id === deckSubjectId
  );

  const addCard = async () => {
    const front = cardFront.trim();
    const back = cardBack.trim();
    if (!front || !back) {
      setOperationMessage('Renseigne le recto et le verso de la carte.');
      return;
    }
    if (front.length > 2000 || back.length > 2000) {
      setOperationMessage('Le recto et le verso sont limités à 2 000 caractères.');
      return;
    }
    if (userEmail && !deckId) {
      setOperationMessage('Crée d’abord un paquet avant d’ajouter une carte.');
      return;
    }

    setBusy(true);
    try {
      if (userEmail && deckId) {
        const [created] = await addCards(deckId, [{ front, back }]);
        setCards((current) => [...current, created]);
      } else {
        setCardsStorageReady(true);
        setCards((current) => [...current, { front, back }]);
      }
      setCardFront('');
      setCardBack('');
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible d’ajouter la carte.');
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async () => {
    const imported = csv
      .split(/\r?\n/)
      .map((line) => line.split(';'))
      .filter((columns) => columns.length >= 2 && columns[0].trim() && columns[1].trim())
      .map(([front, back]) => ({ front: front.trim(), back: back.trim() }));

    if (imported.length === 0) {
      setImportReport('Aucune carte valide trouvée. Utilise deux colonnes séparées par « ; ».');
      return;
    }
    if (userEmail) {
      if (!deckId) {
        setImportReport('Crée d’abord un paquet avant d’importer des cartes.');
        return;
      }
      setBusy(true);
      try {
        const created = await addCards(deckId, imported);
        setCards((current) => [...current, ...created]);
        setImportReport(`${created.length} carte(s) importée(s).`);
        setOperationMessage('');
      } catch (error) {
        setOperationMessage(error instanceof Error ? error.message : 'Impossible d’importer les cartes.');
      } finally {
        setBusy(false);
      }
    } else {
      setCardsStorageReady(true);
      setCards((current) => [...current, ...imported]);
      setImportReport(`${imported.length} carte(s) importée(s).`);
    }
  };

  const answerQuiz = (answer: string, expectedAnswer = quizCard?.back ?? '') => {
    if (!quizCard) return;
    const normalizeAnswer = (value: string) => value.trim().toLocaleLowerCase('fr-FR');
    const correct = normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    if (correct) {
      setQuizScore((score) => score + 1);
    } else {
      setQuizMissedFronts((current) => [...current, quizCard.front]);
      if (isRemoteCard(quizCard)) {
        setQuizMissedIds((current) => [...current, quizCard.id]);
      }
    }
    if (quizIndex + 1 >= quizQuestionCount) {
      setQuizFinished(true);
      if (userEmail && deckId) {
        const score = quizScore + (correct ? 1 : 0);
        const missedIds = correct || !isRemoteCard(quizCard)
          ? quizMissedIds
          : [...quizMissedIds, quizCard.id];
        void saveQuizResult(deckId, quizQuestionCount, score, missedIds)
          .catch((error: unknown) => setOperationMessage(
            error instanceof Error ? error.message : 'Impossible d’enregistrer le résultat du quiz.'
          ));
      }
    } else {
      setQuizIndex((index) => index + 1);
    }
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>{deckId ? decks.find((deck) => deck.id === deckId)?.title ?? 'MES CARTES' : 'MES CARTES'}</Text>
          <Text style={styles.sectionTitle}>
            {mode === 'cards' ? 'Séance de cartes' : mode === 'quiz' ? 'Quiz' : 'Importer'}
          </Text>
        </View>
        {mode === 'cards' ? (
            <Text style={styles.sectionCount}>{cards.length ? cardIndex + 1 : 0} / {cards.length}</Text>
        ) : null}
      </View>

      {userEmail ? (
          <View style={styles.deckPicker}>
            <View style={styles.deckChoices}>
              {decks.map((deck) => (
                <Pressable
                  key={deck.id}
                  accessibilityRole="button"
                  onPress={() => void selectDeck(deck)}
                  style={[styles.deckChoice, deck.id === deckId && styles.deckChoiceActive]}
                >
                  <Text style={[styles.deckChoiceText, deck.id === deckId && styles.deckChoiceTextActive]}>
                    {deck.title}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedDeck ? (
              <View style={styles.addSubjectRow}>
                <TextInput
                  value={deckRename}
                  onChangeText={setDeckRename}
                  accessibilityLabel="Nom du paquet sélectionné"
                  maxLength={80}
                  placeholder="Renommer ce paquet"
                  placeholderTextColor="#A1A4B1"
                  style={styles.subjectInput}
                />
                <Pressable disabled={busy} accessibilityRole="button" onPress={() => void renameCurrentDeck()} style={styles.addSubjectButton}>
                  <Text style={styles.addSubjectButtonText}>Renommer</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() => confirmDeleteDeck ? void removeCurrentDeck() : setConfirmDeleteDeck(true)}
                  style={styles.subjectDeleteButton}
                >
                  <Text style={styles.subjectDeleteText}>{confirmDeleteDeck ? 'Confirmer' : 'Supprimer'}</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.plannerLabel}>Associer le nouveau paquet (facultatif)</Text>
            <View style={styles.deckChoices}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !deckSubjectId }}
                onPress={() => {
                  setDeckSubjectId('');
                  setDeckChapterId('');
                }}
                style={[styles.deckChoice, !deckSubjectId && styles.deckChoiceActive]}
              >
                <Text style={[styles.deckChoiceText, !deckSubjectId && styles.deckChoiceTextActive]}>Aucun cours</Text>
              </Pressable>
              {availableSubjects.map((subject) => (
                <Pressable
                  key={subject.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: subject.id === deckSubjectId }}
                  onPress={() => {
                    setDeckSubjectId(subject.id);
                    setDeckChapterId('');
                  }}
                  style={[styles.deckChoice, subject.id === deckSubjectId && styles.deckChoiceActive]}
                >
                  <Text style={[styles.deckChoiceText, subject.id === deckSubjectId && styles.deckChoiceTextActive]}>
                    {subject.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {chaptersForSelectedSubject.length ? (
              <>
                <Text style={styles.plannerLabel}>Chapitre lié (facultatif)</Text>
                <View style={styles.deckChoices}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !deckChapterId }}
                    onPress={() => setDeckChapterId('')}
                    style={[styles.deckChoice, !deckChapterId && styles.deckChoiceActive]}
                  >
                    <Text style={[styles.deckChoiceText, !deckChapterId && styles.deckChoiceTextActive]}>Aucun chapitre</Text>
                  </Pressable>
                  {chaptersForSelectedSubject.map((chapter) => (
                    <Pressable
                      key={chapter.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: chapter.id === deckChapterId }}
                      onPress={() => setDeckChapterId(chapter.id)}
                      style={[styles.deckChoice, chapter.id === deckChapterId && styles.deckChoiceActive]}
                    >
                      <Text style={[styles.deckChoiceText, chapter.id === deckChapterId && styles.deckChoiceTextActive]}>
                        {chapter.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <View style={styles.addSubjectRow}>
              <TextInput
                value={deckName}
                onChangeText={setDeckName}
                placeholder="Nom du nouveau paquet"
                placeholderTextColor="#A1A4B1"
                style={styles.subjectInput}
              />
              <Pressable disabled={busy} accessibilityRole="button" onPress={() => void addDeck()} style={styles.addSubjectButton}>
                <Text style={styles.addSubjectButtonText}>Créer</Text>
              </Pressable>
            </View>
          </View>
      ) : null}

      <View style={styles.modeRow}>
        {(['cards', 'quiz', 'import'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            onPress={() => setMode(item)}
            style={[styles.modeButton, mode === item && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === item && styles.modeButtonTextActive]}>
              {item === 'cards' ? 'Cartes' : item === 'quiz' ? 'Quiz' : 'CSV'}
            </Text>
          </Pressable>
        ))}
      </View>

      {operationMessage ? <Text style={styles.authMessage}>{operationMessage}</Text> : null}
      {mode === 'cards' ? cards.length > 0 && card ? (
        <>
          <View style={styles.manualCardForm}>
            <TextInput
              value={cardFront}
              onChangeText={setCardFront}
              placeholder="Recto de la carte"
              placeholderTextColor="#A1A4B1"
              style={styles.authInput}
            />
            <TextInput
              value={cardBack}
              onChangeText={setCardBack}
              placeholder="Verso de la carte"
              placeholderTextColor="#A1A4B1"
              style={styles.authInput}
            />
            <Pressable disabled={busy} accessibilityRole="button" onPress={() => void addCard()} style={styles.addSubjectButton}>
              <Text style={styles.addSubjectButtonText}>{busy ? 'Enregistrement…' : 'Ajouter une carte'}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setCardFlipped((flipped) => !flipped)} style={styles.flashcard}>
            <Text style={styles.flashcardLabel}>{cardFlipped ? 'RÉPONSE' : 'QUESTION'}</Text>
            <Text style={styles.flashcardText}>{cardFlipped ? card.back : card.front}</Text>
            <Text style={styles.flashcardHint}>{cardFlipped ? 'Tu connais la réponse ?' : 'Appuie pour retourner'}</Text>
          </Pressable>

          {cardFlipped ? (
            <View style={styles.qualityGrid}>
              {[
                [0, 'Oublié'],
                [1, 'Très difficile'],
                [2, 'Difficile'],
                [3, 'Correct'],
                [4, 'Bien'],
                [5, 'Facile'],
              ].map(([quality, label]) => (
                <Pressable
                  key={quality}
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() => void handleNext(Number(quality))}
                  style={[
                    styles.qualityButton,
                    Number(quality) < 3 && styles.qualityBad,
                    Number(quality) === 3 && styles.qualityMedium,
                    Number(quality) > 3 && styles.qualityGood,
                  ]}
                >
                  <Text style={styles.qualityTitle}>{label}</Text>
                  <Text style={styles.qualityScore}>Note {quality}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            onPress={() => confirmDeleteCard ? void removeCurrentCard() : setConfirmDeleteCard(true)}
            style={styles.cardDeleteButton}
          >
            <Text style={styles.subjectDeleteText}>{confirmDeleteCard ? 'Confirmer la suppression' : 'Supprimer cette carte'}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.importCard}>
          <Text style={styles.importHint}>
            {userEmail ? 'Crée un paquet pour ajouter des cartes.' : 'Aucune carte pour le moment. Ajoute-en une ci-dessous ou importe un CSV.'}
          </Text>
          <View style={styles.manualCardForm}>
            <TextInput
              value={cardFront}
              onChangeText={setCardFront}
              placeholder="Recto de la carte"
              placeholderTextColor="#A1A4B1"
              style={styles.authInput}
            />
            <TextInput
              value={cardBack}
              onChangeText={setCardBack}
              placeholder="Verso de la carte"
              placeholderTextColor="#A1A4B1"
              style={styles.authInput}
            />
            <Pressable disabled={busy} accessibilityRole="button" onPress={() => void addCard()} style={styles.addSubjectButton}>
              <Text style={styles.addSubjectButtonText}>{busy ? 'Enregistrement…' : 'Ajouter une carte'}</Text>
            </Pressable>
          </View>
        </View>
      ) : mode === 'quiz' ? (
        <View style={styles.quizCard}>
          {cards.length === 0 ? (
            <Text style={styles.importHint}>Ajoute des cartes pour commencer un quiz.</Text>
          ) : quizFinished ? (
            <>
              <Text style={styles.flashcardLabel}>RÉSULTAT</Text>
              <Text style={styles.quizResult}>{quizScore}/{quizQuestionCount}</Text>
              {quizMissedFronts.length ? (
                <View style={styles.quizMissedList}>
                  <Text style={styles.settingsTitle}>À revoir</Text>
                  {quizMissedFronts.map((front, index) => (
                    <Text key={`${front}-${index}`} style={styles.settingsText}>{front}</Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.settingsText}>Tout juste, bravo !</Text>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuizIndex(0);
                  setQuizScore(0);
                  setQuizFinished(false);
                  setQuizMissedIds([]);
                  setQuizMissedFronts([]);
                  setQuizWrittenAnswer('');
                }}
                style={styles.restartButton}
              >
                <Text style={styles.restartButtonText}>Recommencer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.quizSetupRow}>
                <Text style={styles.settingsText}>Nombre de questions (max. {cards.length})</Text>
                <TextInput
                  accessibilityLabel="Nombre de questions du quiz"
                  value={quizQuestionLimit}
                  editable={quizIndex === 0 && !quizFinished}
                  onChangeText={(value) => setQuizQuestionLimit(value.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  style={styles.quizLimitInput}
                />
              </View>
              <Text style={styles.flashcardLabel}>QUESTION {quizIndex + 1}/{quizQuestionCount}</Text>
              <Text style={styles.quizQuestion}>{quizCard?.front}</Text>
              <View style={styles.quizTypeRow}>
                {([
                  ['choice', 'QCM'],
                  ['written', 'Réponse écrite'],
                  ['trueFalse', 'Vrai ou faux'],
                ] as const).map(([type, label]) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: quizMode === type }}
                    onPress={() => setQuizMode(type)}
                    style={[styles.quizTypeButton, quizMode === type && styles.modeButtonActive]}
                  >
                    <Text style={[styles.modeButtonText, quizMode === type && styles.modeButtonTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {quizOtherAnswers.length === 0 ? (
                <Text style={styles.settingsText}>Ajoute une deuxième carte avec une réponse différente pour lancer le quiz.</Text>
              ) : quizMode === 'written' ? (
                <View style={styles.quizAnswerForm}>
                  <TextInput
                    value={quizWrittenAnswer}
                    onChangeText={setQuizWrittenAnswer}
                    accessibilityLabel="Ta réponse au quiz"
                    onSubmitEditing={() => {
                      answerQuiz(quizWrittenAnswer);
                      setQuizWrittenAnswer('');
                    }}
                    returnKeyType="done"
                    style={styles.authInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      answerQuiz(quizWrittenAnswer);
                      setQuizWrittenAnswer('');
                    }}
                    style={styles.addSubjectButton}
                  >
                    <Text style={styles.addSubjectButtonText}>Valider</Text>
                  </Pressable>
                </View>
              ) : quizMode === 'trueFalse' ? (
                <View style={styles.answerGrid}>
                  <Text style={styles.quizQuestion}>{quizStatement}</Text>
                  {['Vrai', 'Faux'].map((answer) => (
                    <Pressable
                      key={answer}
                      accessibilityRole="button"
                      onPress={() => answerQuiz(answer, quizStatementIsTrue ? 'Vrai' : 'Faux')}
                      style={styles.answerButton}
                    >
                      <Text style={styles.answerText}>{answer}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.answerGrid}>
                  {quizAnswers.map((answer) => (
                    <Pressable
                      key={answer}
                      accessibilityRole="button"
                      onPress={() => answerQuiz(answer)}
                      style={styles.answerButton}
                    >
                      <Text style={styles.answerText}>{answer}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.importCard}>
          <Text style={styles.importTitle}>Importer des cartes CSV</Text>
          <Text style={styles.importHint}>Une carte par ligne : recto;verso</Text>
          <TextInput
            value={csv}
            onChangeText={setCsv}
            multiline
            placeholder={'to persevere;persévérer\na journey;un voyage'}
            placeholderTextColor="#A1A4B1"
            style={styles.csvInput}
          />
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => void importCsv()} style={styles.importButton}>
            <Text style={styles.importButtonText}>{busy ? 'Importation…' : 'Importer les cartes'}</Text>
          </Pressable>
          {importReport ? <Text style={styles.importReport}>{importReport}</Text> : null}
        </View>
      )}
    </View>
  );
}

function AuthPanel({
  userEmail,
  recoveringPassword,
  onRecoveryComplete,
}: {
  userEmail: string | null;
  recoveringPassword: boolean;
  onRecoveryComplete: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const runAuth = async (action: 'signup' | 'signin' | 'reset') => {
    if (!supabase) {
      setMessage('Configure les variables Supabase pour activer les comptes.');
      return;
    }
    if (!email.trim()) {
      setMessage('Indique ton adresse e-mail.');
      return;
    }
    if (action !== 'reset' && password.length < 6) {
      setMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      if (action === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              typeof window === 'undefined' ? undefined : window.location.origin,
          },
        });
        if (error) throw error;
        setMessage('Compte créé. Vérifie ton e-mail si la confirmation est activée.');
      } else if (action === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setMessage('Connexion réussie.');
      } else {
        const redirectTo = typeof window === 'undefined' ? undefined : window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setMessage('Un e-mail de réinitialisation a été envoyé.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de contacter Supabase.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMessage('Tu es déconnecté.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de se déconnecter.');
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async () => {
    if (!supabase) return;
    if (password.length < 6) {
      setMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('Ton mot de passe a été modifié.');
      setPassword('');
      onRecoveryComplete();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de modifier le mot de passe.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.authCard}>
      <Text style={styles.settingsTitle}>
        {recoveringPassword ? 'Choisir un nouveau mot de passe' : userEmail ? 'Compte connecté' : 'Créer ou connecter un compte'}
      </Text>
      {recoveringPassword ? (
        <>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Nouveau mot de passe"
            placeholderTextColor="#A1A4B1"
            style={styles.authInput}
          />
          <Pressable disabled={busy} accessibilityRole="button" onPress={updatePassword} style={styles.authPrimary}>
            <Text style={styles.authPrimaryText}>{busy ? 'Patiente…' : 'Enregistrer le mot de passe'}</Text>
          </Pressable>
        </>
      ) : userEmail ? (
        <Pressable disabled={busy} accessibilityRole="button" onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutButtonText}>{busy ? 'Déconnexion…' : 'Se déconnecter'}</Text>
        </Pressable>
      ) : (
        <>
          {!isSupabaseConfigured ? (
            <Text style={styles.authConfigNote}>Supabase n’est pas encore configuré : renseigne le fichier .env.</Text>
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Adresse e-mail"
            placeholderTextColor="#A1A4B1"
            style={styles.authInput}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mot de passe"
            placeholderTextColor="#A1A4B1"
            style={styles.authInput}
          />
          <View style={styles.authActions}>
            <Pressable disabled={busy} accessibilityRole="button" onPress={() => runAuth('signin')} style={styles.authPrimary}>
              <Text style={styles.authPrimaryText}>{busy ? 'Patiente…' : 'Se connecter'}</Text>
            </Pressable>
            <Pressable disabled={busy} accessibilityRole="button" onPress={() => runAuth('signup')} style={styles.authSecondary}>
              <Text style={styles.authSecondaryText}>Créer un compte</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={() => runAuth('reset')}>
            <Text style={styles.resetText}>Mot de passe oublié ?</Text>
          </Pressable>
        </>
      )}
      {message ? <Text style={styles.authMessage}>{message}</Text> : null}
    </View>
  );
}

function ProfileScreen({
  subjects,
  subjectName,
  userEmail,
  userName,
  completedSessionCount,
  completedStudyMinutes,
  currentStreak,
  onOpenPlanner,
  recoveringPassword,
  onRecoveryComplete,
  dataMessage,
  onSubjectNameChange,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
  onDeleteData,
}: {
  subjects: { id?: string; name: string; color: string; exams: number }[];
  subjectName: string;
  userEmail: string | null;
  userName: string | null;
  completedSessionCount: number;
  completedStudyMinutes: number;
  currentStreak: number;
  onOpenPlanner: () => void;
  recoveringPassword: boolean;
  onRecoveryComplete: () => void;
  dataMessage: string;
  onSubjectNameChange: (value: string) => void;
  onAddSubject: () => void | Promise<void>;
  onRenameSubject: (
    subject: { id?: string; name: string; color: string; exams: number },
    name: string
  ) => Promise<boolean>;
  onDeleteSubject: (subject: { id?: string; name: string; color: string; exams: number }) => void | Promise<void>;
  onDeleteData: () => void | Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [managedSubjectName, setManagedSubjectName] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');
  const [deleteSubjectConfirmation, setDeleteSubjectConfirmation] = useState<string | null>(null);
  const studyTimeLabel = completedStudyMinutes < 60
    ? `${completedStudyMinutes} min`
    : `${Math.floor(completedStudyMinutes / 60)} h ${String(completedStudyMinutes % 60).padStart(2, '0')}`;
  return (
    <View>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {userName?.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? 'R'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{userName ?? 'Mon profil'}</Text>
          <Text style={styles.profileEmail}>{userEmail ?? 'Mode hors ligne'}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{currentStreak}</Text>
          <Text style={styles.statLabel}>jours d’affilée</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedSessionCount}</Text>
          <Text style={styles.statLabel}>sessions faites</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.studyStatNumber]}>{studyTimeLabel}</Text>
          <Text style={styles.statLabel}>temps révisé</Text>
        </View>
      </View>

      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Mes cours</Text>
        <Text style={styles.sectionCount}>{subjects.length} cours</Text>
      </View>

      {subjects.length ? (
        <View style={styles.subjectList}>
          {subjects.map((subject, index) => {
            const managed = managedSubjectName === subject.name;
            return (
              <View key={subject.id ?? `${subject.name}-${index}`}>
                <View style={styles.subjectRow}>
                  <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subjectRowName}>{subject.name}</Text>
                    <Text style={styles.subjectRowMeta}>{subject.exams} contrôle(s)</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Gérer le cours ${subject.name}`}
                    onPress={() => {
                      setManagedSubjectName(managed ? null : subject.name);
                      setEditingSubjectName(subject.name);
                      setDeleteSubjectConfirmation(null);
                    }}
                  >
                    <Text style={styles.subjectArrow}>{managed ? '×' : '···'}</Text>
                  </Pressable>
                </View>
                {managed ? (
                  <View style={styles.subjectManagePanel}>
                    <TextInput
                      value={editingSubjectName}
                      onChangeText={setEditingSubjectName}
                      accessibilityLabel="Nouveau nom du cours"
                      maxLength={60}
                      style={styles.subjectInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={async () => {
                        if (await onRenameSubject(subject, editingSubjectName)) {
                          setManagedSubjectName(null);
                        }
                      }}
                      style={styles.addSubjectButton}
                    >
                      <Text style={styles.addSubjectButtonText}>Renommer</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        if (deleteSubjectConfirmation === subject.name) {
                          void onDeleteSubject(subject);
                          setManagedSubjectName(null);
                          setDeleteSubjectConfirmation(null);
                        } else {
                          setDeleteSubjectConfirmation(subject.name);
                        }
                      }}
                      style={styles.subjectDeleteButton}
                    >
                      <Text style={styles.subjectDeleteText}>
                        {deleteSubjectConfirmation === subject.name ? 'Confirmer' : 'Supprimer'}
                      </Text>
                    </Pressable>
                    {deleteSubjectConfirmation === subject.name ? (
                      <Text style={styles.settingsText}>
                        Cette suppression efface aussi les contrôles, chapitres et séances associés.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.settingsText}>Ajoute tes cours pour pouvoir y associer des contrôles.</Text>
      )}

      <View style={styles.addSubjectRow}>
        <TextInput
          value={subjectName}
          onChangeText={onSubjectNameChange}
          placeholder="Nom du cours (ex. Mathématiques)"
          placeholderTextColor="#A1A4B1"
          style={styles.subjectInput}
        />
        <Pressable accessibilityRole="button" onPress={onAddSubject} style={styles.addSubjectButton}>
          <Text style={styles.addSubjectButtonText}>Ajouter</Text>
        </Pressable>
      </View>
      {userEmail ? (
        <Pressable accessibilityRole="button" onPress={onOpenPlanner} style={[styles.addSubjectButton, { marginTop: 10 }]}>
          <Text style={styles.addSubjectButtonText}>Planifier un contrôle</Text>
        </Pressable>
      ) : null}

      <AuthPanel userEmail={userEmail} recoveringPassword={recoveringPassword} onRecoveryComplete={onRecoveryComplete} />

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Données personnelles</Text>
        <Text style={styles.settingsText}>
          {userEmail
            ? 'Tes données sont synchronisées avec ton compte Supabase.'
            : 'En mode hors ligne, tes données restent sur cet appareil.'}
        </Text>
        {dataMessage ? <Text style={styles.authMessage}>{dataMessage}</Text> : null}
        {!userEmail ? (
          <Text style={styles.settingsText}>Pour créer et synchroniser des contrôles, connecte-toi à ton compte.</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (userEmail && !confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            void onDeleteData();
            setConfirmDelete(false);
          }}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>
            {userEmail
              ? confirmDelete ? 'Confirmer la suppression du compte' : 'Supprimer mon compte'
              : 'Effacer mes données'}
          </Text>
        </Pressable>
        {confirmDelete ? (
          <Text style={styles.settingsText}>Cette action est irréversible et supprimera les données liées au compte.</Text>
        ) : null}
      </View>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Informations légales</Text>
        <Link href="/confidentialite" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.legalLink}>Politique de confidentialité</Text>
          </Pressable>
        </Link>
        <Link href="/mentions-legales" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.legalLink}>Mentions légales</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function NavButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navButton}>
      <Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#F7F8FC' },
  scroll: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 110 },
  pageWide: { alignItems: 'center', paddingHorizontal: 48, paddingTop: 44, paddingBottom: 140 },
  layout: { width: '100%', maxWidth: 1120 },
  layoutWide: { flexDirection: 'row', gap: 28 },
  mainColumn: { flex: 1, minWidth: 0 },
  sideColumn: { width: 290, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { color: '#9A9DAB', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  title: { color: '#20243A', fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  wave: { fontSize: 25 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EDE9FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#6657F4', fontWeight: '800', fontSize: 14 },
  onlineDot: { position: 'absolute', right: 1, bottom: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: '#63CDA5', borderWidth: 2, borderColor: '#F7F8FC' },
  hero: { minHeight: 150, borderRadius: 24, backgroundColor: '#6657F4', padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, overflow: 'hidden' },
  heroCopy: { flex: 1, paddingRight: 12 },
  heroLabel: { color: '#CAC5FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 7 },
  heroText: { color: '#E8E6FF', fontSize: 14, lineHeight: 20 },
  progressRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 8, borderColor: '#FFFFFF', borderRightColor: '#AFA7FF', alignItems: 'center', justifyContent: 'center' },
  progressValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#20243A', fontSize: 18, fontWeight: '800' },
  sectionCount: { color: '#A0A3AF', fontSize: 13, fontWeight: '600' },
  linkText: { color: '#6657F4', fontSize: 13, fontWeight: '800' },
  sessionList: { gap: 10, marginBottom: 28 },
  sessionCard: { minHeight: 96, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', padding: 12, flexDirection: 'row', alignItems: 'center' },
  sessionDone: { opacity: 0.72, backgroundColor: '#FBFBFD' },
  sessionActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 8 },
  sessionActionButton: { minHeight: 34, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  sessionActionText: { color: '#6657F4', fontSize: 10, fontWeight: '800' },
  timeColumn: { width: 50, alignItems: 'center' },
  sessionTime: { color: '#777B8C', fontSize: 12, fontWeight: '800' },
  muted: { color: '#AEB1BC' },
  subjectIcon: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  subjectIconText: { fontSize: 22, fontWeight: '900' },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionSubject: { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  sessionTitle: { color: '#25283A', fontSize: 15, fontWeight: '800', marginBottom: 5 },
  doneText: { textDecorationLine: 'line-through', color: '#777B8C' },
  duration: { color: '#A1A4B1', fontSize: 12, fontWeight: '600' },
  checkButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#DADDE7', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkMark: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  deckCard: { minHeight: 82, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', padding: 12, flexDirection: 'row', alignItems: 'center' },
  deckCardStarted: { borderColor: '#EF6F91', backgroundColor: '#FFF9FB' },
  deckIcon: { width: 58, height: 58, borderRadius: 14, backgroundColor: '#FFEAF1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  deckIconText: { color: '#EF6F91', fontSize: 22, fontWeight: '900' },
  deckCopy: { flex: 1 },
  deckName: { color: '#25283A', fontSize: 15, fontWeight: '800', marginBottom: 5 },
  deckMeta: { color: '#9A9DAB', fontSize: 12 },
  deckAction: { backgroundColor: '#FFF0F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  deckActionText: { color: '#EF6F91', fontSize: 11, fontWeight: '900' },
  streakCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#EEF0F5', padding: 20 },
  sideEyebrow: { color: '#A0A3AF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 14 },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  streakNumber: { color: '#25283A', fontSize: 34, fontWeight: '900', lineHeight: 36 },
  streakLabel: { color: '#777B8C', fontSize: 12, marginTop: 2 },
  flame: { fontSize: 34 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayColumn: { alignItems: 'center', gap: 6 },
  dayDot: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#F0F1F5', alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: '#6657F4' },
  dayCheck: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  dayLabel: { color: '#A1A4B1', fontSize: 10, fontWeight: '700' },
  examCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#EEF0F5', padding: 20 },
  examRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  examIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  examIconText: { color: '#6657F4', fontSize: 21, fontWeight: '900' },
  examName: { color: '#25283A', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  examDate: { color: '#F49A55', fontSize: 12, fontWeight: '700' },
  examProgressTrack: { height: 7, borderRadius: 4, backgroundColor: '#EEEFF4', overflow: 'hidden' },
  examProgress: { width: '68%', height: 7, borderRadius: 4, backgroundColor: '#6657F4' },
  examHint: { color: '#A1A4B1', fontSize: 11, marginTop: 9 },
  nav: { position: 'absolute', left: 12, right: 12, bottom: 12, height: 72, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#25283A', shadowOpacity: 0.08, shadowRadius: 18, elevation: 8 },
  navWide: { left: '50%', right: 'auto', width: 460, marginLeft: -230, bottom: 18 },
  navButton: { minWidth: 62, alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: '#A8ABB7', fontSize: 20, lineHeight: 24, marginBottom: 3 },
  navIconActive: { color: '#6657F4' },
  navLabel: { color: '#A8ABB7', fontSize: 10, fontWeight: '700' },
  navLabelActive: { color: '#6657F4' },
  modeRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EEF0F5', padding: 5, marginBottom: 14 },
  modeButton: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: '#6657F4' },
  modeButtonText: { color: '#979AAA', fontSize: 12, fontWeight: '800' },
  modeButtonTextActive: { color: '#FFFFFF' },
  deckPicker: { marginBottom: 14 },
  deckChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  deckChoice: { borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', paddingHorizontal: 12, paddingVertical: 9 },
  deckChoiceActive: { backgroundColor: '#F0EEFF', borderColor: '#6657F4' },
  deckChoiceText: { color: '#777B8C', fontSize: 12, fontWeight: '700' },
  deckChoiceTextActive: { color: '#6657F4' },
  plannerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', padding: 16, marginBottom: 16 },
  plannerLabel: { color: '#777B8C', fontSize: 12, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  plannerFormRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  plannerActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  plannerActionButton: { minHeight: 40, borderRadius: 12, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  plannerActionText: { color: '#6657F4', fontSize: 11, fontWeight: '800' },
  examListRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: '#EEF0F5', backgroundColor: '#FFFFFF' },
  examListRowActive: { borderColor: '#6657F4', backgroundColor: '#F8F7FF' },
  examCalendarCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#F5E9E3', padding: 12, marginBottom: 8 },
  difficultyChoices: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  difficultyChoice: { flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', paddingVertical: 9 },
  chapterRow: { color: '#777B8C', fontSize: 12, paddingVertical: 4, paddingHorizontal: 4 },
  chapterRowContainer: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  plannerDateInput: { width: 120, height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', paddingHorizontal: 10, color: '#25283A', fontSize: 12 },
  availabilityGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  availabilityCell: { flex: 1, alignItems: 'center', gap: 5 },
  availabilityDay: { color: '#777B8C', fontSize: 11, fontWeight: '800' },
  availabilityInput: { width: '100%', minWidth: 32, height: 40, borderRadius: 10, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: '#EEF0F5', textAlign: 'center', color: '#25283A', paddingHorizontal: 2 },
  quizCard: { minHeight: 290, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center', padding: 20 },
  quizSetupRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  quizLimitInput: { width: 58, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#EEF0F5', textAlign: 'center', color: '#25283A', marginBottom: 8 },
  quizTypeRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 12 },
  quizTypeButton: { minHeight: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#F7F8FC' },
  quizAnswerForm: { width: '100%', flexDirection: 'row', gap: 8, alignItems: 'center' },
  quizQuestion: { color: '#25283A', fontSize: 25, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  quizResult: { color: '#6657F4', fontSize: 42, fontWeight: '900', marginBottom: 20 },
  quizMissedList: { width: '100%', marginBottom: 16 },
  answerGrid: { width: '100%', gap: 8 },
  answerButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#F5F4FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  answerText: { color: '#6657F4', fontSize: 14, fontWeight: '800' },
  restartButton: { height: 44, borderRadius: 14, backgroundColor: '#6657F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  restartButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  importCard: { minHeight: 290, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', padding: 20 },
  manualCardForm: { marginBottom: 14 },
  importTitle: { color: '#25283A', fontSize: 18, fontWeight: '900', marginBottom: 5 },
  importHint: { color: '#9A9DAB', fontSize: 12, marginBottom: 14 },
  csvInput: { minHeight: 150, borderRadius: 16, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: '#EEF0F5', padding: 14, color: '#25283A', textAlignVertical: 'top', marginBottom: 12 },
  importButton: { height: 48, borderRadius: 14, backgroundColor: '#6657F4', alignItems: 'center', justifyContent: 'center' },
  importButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  importReport: { color: '#63A58A', fontSize: 12, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  monthActions: { flexDirection: 'row', gap: 8 },
  monthButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center' },
  monthButtonText: { color: '#6657F4', fontSize: 22, lineHeight: 24, fontWeight: '700' },
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#EEF0F5', padding: 14 },
  weekdays: { flexDirection: 'row', marginBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', color: '#A1A4B1', fontSize: 11, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.285%', aspectRatio: 1, maxHeight: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  calendarDayActive: { backgroundColor: '#6657F4' },
  calendarDayText: { color: '#5E6275', fontSize: 13, fontWeight: '700' },
  calendarDayTextActive: { color: '#FFFFFF' },
  calendarDots: { height: 12, marginTop: 3, flexDirection: 'row', gap: 3, alignItems: 'center' },
  calendarDot: { width: 5, height: 5, borderRadius: 3 },
  flashcard: { minHeight: 290, borderRadius: 28, backgroundColor: '#6657F4', alignItems: 'center', justifyContent: 'center', padding: 28, marginBottom: 14 },
  flashcardLabel: { color: '#C9C5FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginBottom: 18 },
  flashcardText: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  flashcardHint: { color: '#DAD7FF', fontSize: 12, marginTop: 34 },
  qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  qualityButton: { width: '31%', minHeight: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardDeleteButton: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 10 },
  qualityBad: { backgroundColor: '#FFF0F2' },
  qualityMedium: { backgroundColor: '#FFF4E8' },
  qualityGood: { backgroundColor: '#EAF8F2' },
  qualityTitle: { color: '#25283A', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  qualityScore: { color: '#8D91A1', fontSize: 10 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#EEF0F5', padding: 18, marginBottom: 14 },
  profileAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#EDE9FF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  profileAvatarText: { color: '#6657F4', fontSize: 16, fontWeight: '900' },
  profileName: { color: '#25283A', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  profileEmail: { color: '#9A9DAB', fontSize: 12 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minHeight: 92, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center' },
  statNumber: { color: '#6657F4', fontSize: 28, fontWeight: '900', marginBottom: 3 },
  studyStatNumber: { fontSize: 18 },
  statLabel: { color: '#777B8C', fontSize: 11, fontWeight: '700' },
  subjectList: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', overflow: 'hidden' },
  subjectRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F2F6' },
  subjectDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  subjectRowName: { color: '#25283A', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  subjectRowMeta: { color: '#A1A4B1', fontSize: 11 },
  subjectArrow: { color: '#B4B7C2', fontSize: 24 },
  subjectManagePanel: { padding: 12, borderTopWidth: 1, borderTopColor: '#F1F2F6', gap: 8 },
  subjectDeleteButton: { minHeight: 40, borderRadius: 12, backgroundColor: '#FFF0F2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  subjectDeleteText: { color: '#D85F70', fontSize: 11, fontWeight: '900' },
  addSubjectRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  subjectInput: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', paddingHorizontal: 14, color: '#25283A' },
  addSubjectButton: { height: 48, borderRadius: 14, backgroundColor: '#6657F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  addSubjectButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  settingsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', padding: 16, marginTop: 16 },
  settingsTitle: { color: '#25283A', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  settingsText: { color: '#9A9DAB', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  deleteButton: { height: 44, borderRadius: 12, backgroundColor: '#FFF0F2', alignItems: 'center', justifyContent: 'center' },
  deleteButtonText: { color: '#D85F70', fontSize: 12, fontWeight: '900' },
  authCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', padding: 16, marginTop: 16 },
  authConfigNote: { color: '#F49A55', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  authInput: { height: 48, borderRadius: 14, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: '#EEF0F5', paddingHorizontal: 14, color: '#25283A', marginTop: 8 },
  authActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  authPrimary: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#6657F4', alignItems: 'center', justifyContent: 'center' },
  authPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  authSecondary: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' },
  authSecondaryText: { color: '#6657F4', fontSize: 12, fontWeight: '900' },
  resetText: { color: '#6657F4', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  authMessage: { color: '#777B8C', fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  signOutButton: { height: 44, borderRadius: 12, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' },
  signOutButtonText: { color: '#6657F4', fontSize: 12, fontWeight: '900' },
  legalLink: { color: '#6657F4', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
});
