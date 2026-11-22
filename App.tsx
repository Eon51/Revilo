import { StatusBar } from 'expo-status-bar';
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
  createChapter,
  createExam,
  createSubject,
  createDeck,
  deleteAccount,
  generateAndSavePlan,
  getCardProgress,
  listAvailability,
  listCards,
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
  SubjectRecord,
  SessionView,
  CardRecord,
  DeckRecord,
} from './lib/api/repository';
import { scheduleCard } from './lib/review';

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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const [localStorageReady, setLocalStorageReady] = useState(Platform.OS === 'web');
  const [remoteSubjects, setRemoteSubjects] = useState<SubjectRecord[]>([]);
  const [remoteSessions, setRemoteSessions] = useState<SessionView[]>([]);
  const [doneSessions, setDoneSessions] = useState<string[]>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem('revilo.doneSessions') ?? '[]');
    } catch {
      return [];
    }
  });
  const [deckStarted, setDeckStarted] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjects, setSubjects] = useState<{ name: string; color: string; exams: number }[]>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return [
        { name: 'Mathématiques', color: '#6657F4', exams: 2 },
        { name: 'Histoire', color: '#F49A55', exams: 1 },
        { name: 'Anglais', color: '#EF6F91', exams: 1 },
      ];
    }
    try {
      return JSON.parse(window.localStorage.getItem('revilo.subjects') ?? 'null') ?? [
        { name: 'Mathématiques', color: '#6657F4', exams: 2 },
        { name: 'Histoire', color: '#F49A55', exams: 1 },
        { name: 'Anglais', color: '#EF6F91', exams: 1 },
      ];
    } catch {
      return [
        { name: 'Mathématiques', color: '#6657F4', exams: 2 },
        { name: 'Histoire', color: '#F49A55', exams: 1 },
        { name: 'Anglais', color: '#EF6F91', exams: 1 },
      ];
    }
  });

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user.email ?? null);
      setRecoveringPassword(event === 'PASSWORD_RECOVERY');
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!userEmail) {
      setRemoteSubjects([]);
      setRemoteSessions([]);
      return () => { active = false; };
    }

    Promise.all([listSubjects(), listSessionViews()])
      .then(([nextSubjects, nextSessions]) => {
        if (!active) return;
        setRemoteSubjects(nextSubjects);
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
    Promise.all([
      AsyncStorage.getItem('revilo.subjects'),
      AsyncStorage.getItem('revilo.doneSessions'),
    ]).then(([storedSubjects, storedSessions]) => {
      if (!active) return;
      try {
        if (storedSubjects) setSubjects(JSON.parse(storedSubjects));
        if (storedSessions) setDoneSessions(JSON.parse(storedSessions));
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
      window.localStorage.setItem('revilo.subjects', value);
    } else {
      void AsyncStorage.setItem('revilo.subjects', value).catch((error: unknown) => {
        setDataMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer les matières hors ligne.');
      });
    }
  }, [localStorageReady, subjects]);

  useEffect(() => {
    if (!localStorageReady) return;
    const value = JSON.stringify(doneSessions);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('revilo.doneSessions', value);
    } else {
      void AsyncStorage.setItem('revilo.doneSessions', value).catch((error: unknown) => {
        setDataMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer les sessions hors ligne.');
      });
    }
  }, [doneSessions, localStorageReady]);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const demoSessions = [
    {
      id: 'math',
      time: '09:00',
      subject: 'Mathématiques',
      title: 'Limites et continuité',
      duration: 45,
      icon: '∑',
      tone: '#6657F4',
      soft: '#F0EEFF',
    },
    {
      id: 'history',
      time: '14:30',
      subject: 'Histoire',
      title: 'La Première Guerre mondiale',
      duration: 30,
      icon: 'H',
      tone: '#F49A55',
      soft: '#FFF1E7',
    },
  ];
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
      }))
    : demoSessions.map((session) => ({ ...session, status: 'planned' }));
  const shownSubjects = userEmail
    ? remoteSubjects.map((subject) => ({ ...subject, exams: 0 }))
    : subjects;

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
      return;
    }
    setDoneSessions((current) =>
      current.includes(id)
        ? current.filter((sessionId) => sessionId !== id)
        : [...current, id]
    );
  };

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView
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
                <Text style={styles.eyebrow}>DIMANCHE 22 NOVEMBRE</Text>
                <Text style={styles.title}>Bonjour, Noé <Text style={styles.wave}>👋</Text></Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les notifications"
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>NB</Text>
                <View style={styles.onlineDot} />
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
                          : doneSessions.length === sessions.length)
                        ? 'Bravo, tout est fait !'
                          : sessions.length === 0 ? 'Ton planning est vide' : 'Tu es prêt pour tes révisions'}
                    </Text>
                    <Text style={styles.heroText}>
                        {sessions.length === 0
                          ? 'Aucune session prévue aujourd’hui'
                          : `${sessions.filter((session) => userEmail
                            ? session.status === 'done'
                            : doneSessions.includes(session.id)).length} sur ${sessions.length} sessions terminées`}
                    </Text>
                  </View>
                  <View style={styles.progressRing}>
                    <Text style={styles.progressValue}>
                        {Math.round((sessions.length === 0 ? 0 : sessions.filter((session) => userEmail
                          ? session.status === 'done'
                          : doneSessions.includes(session.id)).length / sessions.length) * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Aujourd’hui</Text>
                  <Text style={styles.sectionCount}>{sessions.length} sessions</Text>
                </View>

                <View style={styles.sessionList}>
                  {sessions.map((session) => {
                    const isDone = userEmail
                      ? session.status === 'done'
                      : doneSessions.includes(session.id);
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
                  onPress={() => setDeckStarted((started) => !started)}
                  style={[styles.deckCard, deckStarted && styles.deckCardStarted]}
                >
                  <View style={styles.deckIcon}>
                    <Text style={styles.deckIconText}>A</Text>
                  </View>
                  <View style={styles.deckCopy}>
                    <Text style={styles.deckName}>Anglais · B2</Text>
                    <Text style={styles.deckMeta}>24 cartes · 8 à revoir</Text>
                  </View>
                  <View style={styles.deckAction}>
                    <Text style={styles.deckActionText}>{deckStarted ? 'EN PAUSE' : 'RÉVISER'}</Text>
                  </View>
                </Pressable>
              </>
            ) : tab === 'calendar' ? (
              <CalendarScreen
                userEmail={userEmail}
                sessions={userEmail ? remoteSessions : []}
                onSessionsUpdated={async () => setRemoteSessions(await listSessionViews())}
              />
            ) : tab === 'cards' ? (
              <CardsScreen userEmail={userEmail} />
            ) : (
              <ProfileScreen
                subjects={shownSubjects}
                subjectName={subjectName}
                userEmail={userEmail}
                recoveringPassword={recoveringPassword}
                onRecoveryComplete={() => setRecoveringPassword(false)}
                dataMessage={dataMessage}
                onSubjectNameChange={setSubjectName}
                onAddSubject={async () => {
                  const name = subjectName.trim();
                  if (!name) return;
                  if (userEmail) {
                    try {
                      const subject = await createSubject(name);
                      setRemoteSubjects((current) => [...current, subject]);
                      setDataMessage('');
                    } catch (error) {
                      setDataMessage(error instanceof Error ? error.message : 'Impossible d’ajouter cette matière.');
                      return;
                    }
                    setSubjectName('');
                    return;
                  }
                  setSubjects((current) => [
                    ...current,
                    { name, color: '#63CDA5', exams: 0 },
                  ]);
                  setSubjectName('');
                }}
                onDeleteData={async () => {
                  if (userEmail) {
                    try {
                      await deleteAccount();
                      await supabase?.auth.signOut();
                      setRemoteSubjects([]);
                      setRemoteSessions([]);
                      setDataMessage('Compte supprimé.');
                    } catch (error) {
                      setDataMessage(error instanceof Error ? error.message : 'Impossible de supprimer le compte.');
                    }
                    return;
                  }
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.localStorage.removeItem('revilo.subjects');
                    window.localStorage.removeItem('revilo.doneSessions');
                    window.localStorage.setItem('revilo.cards', '[]');
                  } else {
                    void AsyncStorage.multiSet([
                      ['revilo.subjects', '[]'],
                      ['revilo.doneSessions', '[]'],
                      ['revilo.cards', '[]'],
                    ]).catch((error: unknown) => setDataMessage(
                      error instanceof Error ? error.message : 'Impossible d’effacer les données hors ligne.'
                    ));
                  }
                  setDoneSessions([]);
                    setSubjects([]);
                }}
              />
            )}
          </View>

          {isWide ? (
            <View style={styles.sideColumn}>
              <View style={styles.streakCard}>
                <Text style={styles.sideEyebrow}>SÉRIES</Text>
                <View style={styles.streakRow}>
                  <View>
                    <Text style={styles.streakNumber}>6</Text>
                    <Text style={styles.streakLabel}>jours d’affilée</Text>
                  </View>
                  <Text style={styles.flame}>🔥</Text>
                </View>
                <View style={styles.weekRow}>
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                    <View key={`${day}-${index}`} style={styles.dayColumn}>
                      <View style={[styles.dayDot, index < 5 && styles.dayDone]}>
                        {index < 5 ? <Text style={styles.dayCheck}>✓</Text> : null}
                      </View>
                      <Text style={styles.dayLabel}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.examCard}>
                <Text style={styles.sideEyebrow}>PROCHAIN EXAMEN</Text>
                <View style={styles.examRow}>
                  <View style={styles.examIcon}><Text style={styles.examIconText}>π</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.examName}>Mathématiques</Text>
                    <Text style={styles.examDate}>Dans 12 jours</Text>
                  </View>
                </View>
                <View style={styles.examProgressTrack}>
                  <View style={styles.examProgress} />
                </View>
                <Text style={styles.examHint}>68 % du programme planifié</Text>
              </View>
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
  sessions,
  onSessionsUpdated,
}: {
  userEmail: string | null;
  sessions: SessionView[];
  onSessionsUpdated: () => Promise<void>;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [exams, setExams] = useState<Awaited<ReturnType<typeof listExams>>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return dateKey(date);
  });
  const [chapterTitle, setChapterTitle] = useState('');
  const [blockedDate, setBlockedDate] = useState('');
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Record<number, number>>({});
  const [plannerMessage, setPlannerMessage] = useState('');
  const [plannerBusy, setPlannerBusy] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    Promise.all([listSubjects(), listExams(), listAvailability(), listBlockedDays()])
      .then(([nextSubjects, nextExams, nextAvailability, nextBlocked]) => {
        setSubjects(nextSubjects);
        setExams(nextExams);
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
      setPlannerMessage('Choisis une matière et renseigne le nom et la date de l’examen.');
      return;
    }
    setPlannerBusy(true);
    try {
      const exam = await createExam(selectedSubjectId, examTitle, examDate);
      setExams((current) => [...current, exam]);
      setSelectedExamId(exam.id);
      setExamTitle('');
      setPlannerMessage('Examen ajouté.');
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
      await createChapter(selectedExamId, chapterTitle, 2);
      setChapterTitle('');
      setPlannerMessage('Chapitre ajouté.');
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Impossible d’ajouter le chapitre.');
    } finally {
      setPlannerBusy(false);
    }
  };

  const toggleBlockedDate = async () => {
    if (!blockedDate) return;
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
    setPlannerBusy(true);
    try {
      await saveAvailability(availability);
      const plan = await generateAndSavePlan();
      await onSessionsUpdated();
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
          <Text style={styles.settingsTitle}>Construire mon planning</Text>
          {subjects.length === 0 ? (
            <Text style={styles.settingsText}>Ajoute d’abord une matière depuis ton profil.</Text>
          ) : (
            <>
              <Text style={styles.plannerLabel}>Matière de l’examen</Text>
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
                  placeholder="Nom de l’examen"
                  placeholderTextColor="#A1A4B1"
                  style={styles.subjectInput}
                />
                <TextInput
                  value={examDate}
                  onChangeText={setExamDate}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor="#A1A4B1"
                  style={styles.plannerDateInput}
                />
              </View>
              <Pressable disabled={plannerBusy} accessibilityRole="button" onPress={() => void addExam()} style={styles.addSubjectButton}>
                <Text style={styles.addSubjectButtonText}>Ajouter l’examen</Text>
              </Pressable>

              {exams.length ? (
                <>
                  <Text style={styles.plannerLabel}>Ajouter un chapitre</Text>
                  <View style={styles.deckChoices}>
                    {exams.map((exam) => (
                      <Pressable
                        key={exam.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedExamId(exam.id)}
                        style={[styles.deckChoice, selectedExamId === exam.id && styles.deckChoiceActive]}
                      >
                        <Text style={[styles.deckChoiceText, selectedExamId === exam.id && styles.deckChoiceTextActive]}>
                          {exam.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
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
                </>
              ) : null}
            </>
          )}

          <Text style={styles.plannerLabel}>Temps de révision disponible (minutes/jour)</Text>
          <View style={styles.availabilityGrid}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
              <View key={`${day}-${index}`} style={styles.availabilityCell}>
                <Text style={styles.availabilityDay}>{day}</Text>
                <TextInput
                  value={String(availability[(index + 1) % 7] ?? 0)}
                  onChangeText={(value) => setAvailability((current) => ({
                    ...current,
                    [(index + 1) % 7]: Number(value.replace(/\D/g, '')) || 0,
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

          <Pressable disabled={plannerBusy} accessibilityRole="button" onPress={() => void generatePlan()} style={[styles.importButton, { marginTop: 12 }]}>
            <Text style={styles.importButtonText}>{plannerBusy ? 'Enregistrement…' : 'Générer le planning'}</Text>
          </Pressable>
          {plannerMessage ? <Text style={styles.authMessage}>{plannerMessage}</Text> : null}
        </View>
      ) : (
        <Text style={styles.settingsText}>Connecte-toi pour créer des examens et générer ton planning.</Text>
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
        <Text style={styles.sectionCount}>{selectedSessions.length} sessions</Text>
      </View>
      <View style={styles.sessionList}>
        {selectedSessions.map((session) => (
          <View key={session.id} style={styles.sessionCard}>
            <View style={[styles.subjectIcon, { backgroundColor: `${session.subjectColor}20` }]}>
              <Text style={[styles.subjectIconText, { color: session.subjectColor }]}>
                {session.subjectName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.sessionCopy}>
              <Text style={[styles.sessionSubject, { color: session.subjectColor }]}>{session.subjectName}</Text>
              <Text style={styles.sessionTitle}>{session.chapterTitle}</Text>
              <Text style={styles.duration}>{session.duration} min · {session.status}</Text>
            </View>
          </View>
        ))}
        {selectedSessions.length === 0 ? (
          <Text style={styles.settingsText}>
            {sessions.length === 0 ? 'Connecte-toi pour afficher ton planning.' : 'Aucune session ce jour-là.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function isRemoteCard(card: CardRecord | { front: string; back: string }): card is CardRecord {
  return 'id' in card && typeof card.id === 'string';
}

function CardsScreen({ userEmail }: { userEmail: string | null }) {
  const [mode, setMode] = useState<'cards' | 'quiz' | 'import'>('cards');
  const [csv, setCsv] = useState('');
  const [importReport, setImportReport] = useState('');
  const [deckName, setDeckName] = useState('');
  const [deckId, setDeckId] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizMissedIds, setQuizMissedIds] = useState<string[]>([]);
  const [operationMessage, setOperationMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardsStorageReady, setCardsStorageReady] = useState(Platform.OS === 'web');
  const [cards, setCards] = useState<(CardRecord | { front: string; back: string })[]>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return [
        { front: 'to persevere', back: 'persévérer' },
        { front: 'hardly ever', back: 'presque jamais' },
        { front: 'to get on with', back: 'bien s’entendre avec' },
      ];
    }
    try {
      return JSON.parse(window.localStorage.getItem('revilo.cards') ?? 'null') ?? [
        { front: 'to persevere', back: 'persévérer' },
        { front: 'hardly ever', back: 'presque jamais' },
        { front: 'to get on with', back: 'bien s’entendre avec' },
      ];
    } catch {
      return [
        { front: 'to persevere', back: 'persévérer' },
        { front: 'hardly ever', back: 'presque jamais' },
        { front: 'to get on with', back: 'bien s’entendre avec' },
      ];
    }
  });

  useEffect(() => {
    let active = true;
    if (!userEmail) {
      setDeckId(null);
      setDecks([]);
      setCardsStorageReady(false);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem('revilo.cards');
          if (stored !== null && active) setCards(JSON.parse(stored));
          setCardsStorageReady(true);
        } catch {
          setOperationMessage('Les cartes hors ligne sont illisibles.');
          setCardsStorageReady(true);
        }
      } else {
        AsyncStorage.getItem('revilo.cards').then((stored) => {
          if (!active) return;
          if (stored !== null) setCards(JSON.parse(stored));
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
    listDecks()
      .then(async (nextDecks) => {
        if (!active) return;
        setDecks(nextDecks);
        const selected = nextDecks[0];
        setDeckId(selected?.id ?? null);
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
  }, [userEmail]);

  useEffect(() => {
    if (!cardsStorageReady || userEmail) return;
    const value = JSON.stringify(cards);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('revilo.cards', value);
    } else {
      void AsyncStorage.setItem('revilo.cards', value).catch((error: unknown) => setOperationMessage(
        error instanceof Error ? error.message : 'Impossible d’enregistrer les cartes hors ligne.'
      ));
    }
  }, [cards, cardsStorageReady, userEmail]);

  const selectDeck = async (selected: DeckRecord) => {
    setDeckId(selected.id);
    setBusy(true);
    try {
      setCards(await listCards(selected.id));
      setCardIndex(0);
      setCardFlipped(false);
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de charger les cartes.');
    } finally {
      setBusy(false);
    }
  };

  const addDeck = async () => {
    if (!deckName.trim() || !userEmail) return;
    setBusy(true);
    try {
      const deck = await createDeck(deckName);
      setDecks((current) => [...current, deck]);
      setDeckId(deck.id);
      setCards([]);
      setDeckName('');
      setOperationMessage('');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Impossible de créer le paquet.');
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
  }, [deckId, userEmail]);
  const card = cards[cardIndex];
  const quizCard = cards.length > 0 ? cards[quizIndex % cards.length] : undefined;

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
      setCards((current) => [...current, ...imported]);
      setImportReport(`${imported.length} carte(s) importée(s).`);
    }
  };

  const answerQuiz = (answer: string) => {
    if (!quizCard) return;
    const correct = answer === quizCard.back;
    if (correct) {
      setQuizScore((score) => score + 1);
    } else if (isRemoteCard(quizCard)) {
      setQuizMissedIds((current) => [...current, quizCard.id]);
    }
    if (quizIndex + 1 >= cards.length) {
      setQuizFinished(true);
      if (userEmail && deckId) {
        const score = quizScore + (correct ? 1 : 0);
        const missed = correct || !isRemoteCard(quizCard)
          ? quizMissedIds
          : [...quizMissedIds, quizCard.id];
        void saveQuizResult(deckId, cards.length, score, missed)
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
          <Text style={styles.eyebrow}>PAQUET ANGLAIS · B2</Text>
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
          <Pressable accessibilityRole="button" onPress={() => setCardFlipped((flipped) => !flipped)} style={styles.flashcard}>
            <Text style={styles.flashcardLabel}>{cardFlipped ? 'RÉPONSE' : 'QUESTION'}</Text>
            <Text style={styles.flashcardText}>{cardFlipped ? card.back : card.front}</Text>
            <Text style={styles.flashcardHint}>{cardFlipped ? 'Tu connais la réponse ?' : 'Appuie pour retourner'}</Text>
          </Pressable>

          {cardFlipped ? (
            <View style={styles.qualityGrid}>
              {[0, 3, 5].map((quality) => (
                <Pressable
                  key={quality}
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() => void handleNext(quality)}
                  style={[
                    styles.qualityButton,
                    quality === 0 && styles.qualityBad,
                    quality === 3 && styles.qualityMedium,
                    quality === 5 && styles.qualityGood,
                  ]}
                >
                  <Text style={styles.qualityTitle}>{quality === 0 ? 'Encore' : quality === 3 ? 'À peine' : 'Bien'}</Text>
                  <Text style={styles.qualityScore}>Note {quality}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.importCard}>
          <Text style={styles.importHint}>
            {userEmail ? 'Crée un paquet puis importe tes cartes CSV.' : 'Aucune carte disponible.'}
          </Text>
        </View>
      ) : mode === 'quiz' ? (
        <View style={styles.quizCard}>
          {cards.length === 0 ? (
            <Text style={styles.importHint}>Ajoute des cartes pour commencer un quiz.</Text>
          ) : quizFinished ? (
            <>
              <Text style={styles.flashcardLabel}>RÉSULTAT</Text>
              <Text style={styles.quizResult}>{quizScore}/{cards.length}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuizIndex(0);
                  setQuizScore(0);
                  setQuizFinished(false);
                  setQuizMissedIds([]);
                }}
                style={styles.restartButton}
              >
                <Text style={styles.restartButtonText}>Recommencer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.flashcardLabel}>QUESTION {quizIndex + 1}/{cards.length}</Text>
              <Text style={styles.quizQuestion}>{quizCard?.front}</Text>
              <View style={styles.answerGrid}>
                {[quizCard?.back, cards[(quizIndex + 1) % cards.length].back, cards[(quizIndex + 2) % cards.length].back]
                  .filter((answer): answer is string => Boolean(answer))
                  .sort((a, b) => `${quizIndex}-${a}`.localeCompare(`${quizIndex}-${b}`))
                  .map((answer) => (
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
    const { error } = await supabase.auth.signOut();
    setMessage(error?.message ?? 'Tu es déconnecté.');
    setBusy(false);
  };

  const updatePassword = async () => {
    if (!supabase) return;
    if (password.length < 6) {
      setMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error?.message ?? 'Ton mot de passe a été modifié.');
    if (!error) {
      setPassword('');
      onRecoveryComplete();
    }
    setBusy(false);
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
  recoveringPassword,
  onRecoveryComplete,
  dataMessage,
  onSubjectNameChange,
  onAddSubject,
  onDeleteData,
}: {
  subjects: { name: string; color: string; exams: number }[];
  subjectName: string;
  userEmail: string | null;
  recoveringPassword: boolean;
  onRecoveryComplete: () => void;
  dataMessage: string;
  onSubjectNameChange: (value: string) => void;
  onAddSubject: () => void | Promise<void>;
  onDeleteData: () => void | Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <View>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>NB</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>Noé Bert</Text>
          <Text style={styles.profileEmail}>{userEmail ?? 'Mode hors ligne'}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>6</Text>
          <Text style={styles.statLabel}>jours d’affilée</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>18</Text>
          <Text style={styles.statLabel}>sessions faites</Text>
        </View>
      </View>

      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Mes matières</Text>
        <Text style={styles.sectionCount}>{subjects.length} matières</Text>
      </View>

      <View style={styles.subjectList}>
        {subjects.map((subject) => (
          <View key={subject.name} style={styles.subjectRow}>
            <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.subjectRowName}>{subject.name}</Text>
              <Text style={styles.subjectRowMeta}>{subject.exams} examen(s)</Text>
            </View>
            <Text style={styles.subjectArrow}>›</Text>
          </View>
        ))}
      </View>

      <View style={styles.addSubjectRow}>
        <TextInput
          value={subjectName}
          onChangeText={onSubjectNameChange}
          placeholder="Nom de la matière"
          placeholderTextColor="#A1A4B1"
          style={styles.subjectInput}
        />
        <Pressable accessibilityRole="button" onPress={onAddSubject} style={styles.addSubjectButton}>
          <Text style={styles.addSubjectButtonText}>Ajouter</Text>
        </Pressable>
      </View>

      <AuthPanel userEmail={userEmail} recoveringPassword={recoveringPassword} onRecoveryComplete={onRecoveryComplete} />

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Données personnelles</Text>
        <Text style={styles.settingsText}>
          {userEmail
            ? 'Tes données sont synchronisées avec ton compte Supabase.'
            : 'En mode hors ligne, tes données restent sur cet appareil.'}
        </Text>
        {dataMessage ? <Text style={styles.authMessage}>{dataMessage}</Text> : null}
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
  page: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 110 },
  pageWide: { alignItems: 'center', paddingHorizontal: 48, paddingTop: 44, paddingBottom: 48 },
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
  plannerDateInput: { width: 120, height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', paddingHorizontal: 10, color: '#25283A', fontSize: 12 },
  availabilityGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  availabilityCell: { flex: 1, alignItems: 'center', gap: 5 },
  availabilityDay: { color: '#777B8C', fontSize: 11, fontWeight: '800' },
  availabilityInput: { width: '100%', minWidth: 32, height: 40, borderRadius: 10, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: '#EEF0F5', textAlign: 'center', color: '#25283A', paddingHorizontal: 2 },
  quizCard: { minHeight: 290, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center', padding: 20 },
  quizQuestion: { color: '#25283A', fontSize: 25, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  quizResult: { color: '#6657F4', fontSize: 42, fontWeight: '900', marginBottom: 20 },
  answerGrid: { width: '100%', gap: 8 },
  answerButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#F5F4FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  answerText: { color: '#6657F4', fontSize: 14, fontWeight: '800' },
  restartButton: { height: 44, borderRadius: 14, backgroundColor: '#6657F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  restartButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  importCard: { minHeight: 290, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F5', padding: 20 },
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
  qualityGrid: { flexDirection: 'row', gap: 8 },
  qualityButton: { flex: 1, minHeight: 70, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
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
  statLabel: { color: '#777B8C', fontSize: 11, fontWeight: '700' },
  subjectList: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF0F5', overflow: 'hidden' },
  subjectRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F2F6' },
  subjectDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  subjectRowName: { color: '#25283A', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  subjectRowMeta: { color: '#A1A4B1', fontSize: 11 },
  subjectArrow: { color: '#B4B7C2', fontSize: 24 },
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
});
